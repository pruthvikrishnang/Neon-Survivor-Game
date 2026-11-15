/**
 * Tiny procedural sound engine built on the Web Audio API.
 * Every effect is synthesised on demand; no audio files are loaded.
 */
export class AudioEngine {
  /** @param {{volume?: number, muted?: boolean}} settings */
  constructor(settings = {}) {
    this.volume = Number.isFinite(settings.volume) ? settings.volume : 0.6;
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
      limiter.threshold.value = -14;
      limiter.ratio.value = 8;
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
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.015);
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
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    } catch {
      /* audio is decorative; fail silently */
    }
  }

  _makeNoise() {
    const length = Math.floor(this.ctx.sampleRate);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _noise(duration, volume, cutoff = 900) {
    if (!this._ready() || !this.noiseBuffer) return;
    try {
      const t0 = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(cutoff, t0);
      filter.Q.value = 0.8;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + duration + 0.02);
    } catch {
      /* ignore */
    }
  }

  shoot() {
    if (!this._gate('shoot', 42)) return;
    this._tone(840, 0.065, 'square', 0.022, 380);
  }

  enemyShoot() {
    if (!this._gate('enemyShoot', 70)) return;
    this._tone(330, 0.12, 'sawtooth', 0.018, 180);
  }

  hit() {
    if (!this._gate('hit', 45)) return;
    this._tone(210, 0.05, 'square', 0.014, 120);
  }

  explode(big = false) {
    if (!this._gate('explode', big ? 90 : 40)) return;
    this._noise(big ? 0.55 : 0.2, big ? 0.22 : 0.09, big ? 320 : 700);
    this._tone(big ? 90 : 160, big ? 0.4 : 0.14, 'sawtooth', big ? 0.09 : 0.035, 40);
  }

  pickup() {
    if (!this._gate('pickup', 55)) return;
    this._tone(980, 0.07, 'sine', 0.03, 1480);
  }

  levelUp() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => this._tone(freq, 0.16, 'triangle', 0.055, null, i * 0.075));
  }

  upgrade() {
    this._tone(660, 0.1, 'triangle', 0.05, 990);
    this._tone(990, 0.14, 'sine', 0.035, 1320, 0.07);
  }

  hurt() {
    if (!this._gate('hurt', 120)) return;
    this._tone(190, 0.22, 'sawtooth', 0.07, 70);
    this._noise(0.14, 0.06, 420);
  }

  wave() {
    this._tone(392, 0.18, 'triangle', 0.045);
    this._tone(587, 0.24, 'triangle', 0.04, null, 0.11);
  }

  waveClear() {
    this._tone(784, 0.12, 'sine', 0.04);
    this._tone(1047, 0.2, 'sine', 0.035, null, 0.08);
  }

  boss() {
    this._tone(70, 0.9, 'sawtooth', 0.09, 44);
    this._tone(105, 0.7, 'square', 0.04, 60, 0.06);
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) => this._tone(freq, 0.32, 'triangle', 0.055, null, i * 0.16));
    this._noise(0.8, 0.06, 240);
  }

  click() {
    this._tone(520, 0.04, 'square', 0.025, 700);
  }
}
