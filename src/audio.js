import { AUDIO } from './config.js';

/**
 * Tiny procedural sound engine built on the Web Audio API.
 * Every effect is synthesised on demand; no audio files are loaded.
 */
export class AudioEngine {
  /** @param {{volume?: number, muted?: boolean}} settings */
  constructor(settings = {}) {
    this.volume = Number.isFinite(settings.volume) ? settings.volume : AUDIO.defaultVolume;
    this.muted = Boolean(settings.muted);
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this._gates = new Map();
  }

  /** Create/resume the audio context. Must be called after a user gesture. */
  init() {
    try {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') void this.ctx.resume();
        return;
      }
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = AUDIO.limiter.threshold;
      limiter.ratio.value = AUDIO.limiter.ratio;
      this.master.connect(limiter);
      limiter.connect(this.ctx.destination);
      this._applyGain();
      this.noiseBuffer = this._makeNoise();
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  /** @param {number} value 0..1 */
  setVolume(value) {
    this.volume = Math.min(1, Math.max(0, Number(value) || 0));
    this._applyGain();
  }

  /** @param {boolean} muted */
  setMuted(muted) {
    this.muted = Boolean(muted);
    this._applyGain();
  }

  /** @returns {boolean} the new muted state */
  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _applyGain() {
    if (!this.master || !this.ctx) return;
    const target = this.muted ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, AUDIO.gainSmoothing);
  }

  _ready() {
    return Boolean(this.ctx && this.ctx.state === 'running' && !this.muted && this.volume > 0);
  }

  _gate(key, ms) {
    if (typeof performance === 'undefined') return true;
    const now = performance.now();
    const last = this._gates.get(key) || 0;
    if (now - last < ms) return false;
    this._gates.set(key, now);
    return true;
  }

  _tone(freq, duration, type, volume, slideTo = null, delay = 0) {
    if (!this._ready()) return;
    const env = AUDIO.envelope;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(AUDIO.minFrequency, freq), t0);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(AUDIO.minFrequency, slideTo),
          t0 + duration,
        );
      }
      gain.gain.setValueAtTime(env.floor, t0);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(env.volumeFloor, volume),
        t0 + env.attack,
      );
      gain.gain.exponentialRampToValueAtTime(env.floor, t0 + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + duration + env.stopPadding);
    } catch {
      /* audio is decorative; fail silently */
    }
  }

  _toneSpec(spec, delay = spec.delay || 0) {
    this._tone(
      spec.freq,
      spec.duration,
      spec.type,
      spec.volume,
      spec.slide ?? null,
      delay,
    );
  }

  _makeNoise() {
    const length = Math.floor(this.ctx.sampleRate);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _noise(duration, volume, cutoff = AUDIO.noise.defaultCutoff) {
    if (!this._ready() || !this.noiseBuffer) return;
    try {
      const t0 = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(cutoff, t0);
      filter.Q.value = AUDIO.noise.q;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, t0);
      gain.gain.exponentialRampToValueAtTime(AUDIO.envelope.floor, t0 + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + duration + AUDIO.envelope.noiseStopPadding);
    } catch {
      /* ignore */
    }
  }

  shoot() {
    if (!this._gate('shoot', AUDIO.gates.shoot)) return;
    this._toneSpec(AUDIO.effects.shoot);
  }

  enemyShoot() {
    if (!this._gate('enemyShoot', AUDIO.gates.enemyShoot)) return;
    this._toneSpec(AUDIO.effects.enemyShoot);
  }

  hit() {
    if (!this._gate('hit', AUDIO.gates.hit)) return;
    this._toneSpec(AUDIO.effects.hit);
  }

  explode(big = false) {
    const gate = big ? AUDIO.gates.explodeBig : AUDIO.gates.explode;
    if (!this._gate('explode', gate)) return;
    const cfg = big ? AUDIO.effects.explode.big : AUDIO.effects.explode.small;
    this._noise(cfg.noiseDuration, cfg.noiseVolume, cfg.cutoff);
    this._toneSpec(cfg.tone);
  }

  pickup() {
    if (!this._gate('pickup', AUDIO.gates.pickup)) return;
    this._toneSpec(AUDIO.effects.pickup);
  }

  levelUp() {
    const cfg = AUDIO.effects.levelUp;
    cfg.notes.forEach((freq, i) => {
      this._tone(freq, cfg.duration, cfg.type, cfg.volume, null, i * cfg.stagger);
    });
  }

  upgrade() {
    for (const spec of AUDIO.effects.upgrade) this._toneSpec(spec);
  }

  hurt() {
    if (!this._gate('hurt', AUDIO.gates.hurt)) return;
    const cfg = AUDIO.effects.hurt;
    this._toneSpec(cfg);
    this._noise(cfg.noiseDuration, cfg.noiseVolume, cfg.cutoff);
  }

  wave() {
    for (const spec of AUDIO.effects.wave) this._toneSpec(spec);
  }

  waveClear() {
    for (const spec of AUDIO.effects.waveClear) this._toneSpec(spec);
  }

  boss() {
    for (const spec of AUDIO.effects.boss) this._toneSpec(spec);
  }

  gameOver() {
    const cfg = AUDIO.effects.gameOver;
    cfg.notes.forEach((freq, i) => {
      this._tone(freq, cfg.duration, cfg.type, cfg.volume, null, i * cfg.stagger);
    });
    this._noise(cfg.noiseDuration, cfg.noiseVolume, cfg.cutoff);
  }

  click() {
    this._toneSpec(AUDIO.effects.click);
  }
}
