import { Player } from '../player.js';
import { EnemyManager } from '../enemies.js';
import { WeaponSystem, rollUpgrades, applyUpgrade } from '../weapons.js';
import { ParticlePool, GemPool } from '../particles.js';
import { createArenaBackground, createVignette, createDangerVignette } from '../ui.js';
import { saveSettings } from '../storage.js';
import { BestScore } from '../best.js';
import { TimeScale } from '../time.js';
import { CodexTracker } from '../codex.js';
import { GAME, PARTICLES, TIME, WORLD } from '../config.js';
import {
  hurt, onBossPhase, onEnemyDeath, onEnemyHit, onEnemyShoot,
  onExplode, onPlayerShoot, onSpawn,
} from './combat.js';
import { renderGame } from './render.js';

export class Game {
  constructor({ canvas, ui, audio, input }) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.ui = ui; this.audio = audio; this.input = input;
    this.state = 'menu'; this.time = 0;
    this.best = new BestScore((best) => this._onAllTimeBest(best));
    this.codex = new CodexTracker();
    this.particles = new ParticlePool(PARTICLES.poolSize);
    this.gems = new GemPool(PARTICLES.gemPoolSize);
    this.timeScale = new TimeScale();
    this.player = new Player(WORLD.width, WORLD.height);
    this.weapons = new WeaponSystem(
      { width: WORLD.width, height: WORLD.height },
      {
        onShoot: (x, y, angle) => onPlayerShoot(this, x, y, angle),
        onEnemyHit: (enemy, damage, meta) => onEnemyHit(this, enemy, damage, meta),
        onPlayerHit: (damage) => hurt(this, damage),
      },
    );
    this.enemies = new EnemyManager(WORLD.width, WORLD.height, {
      onShoot: (shot) => onEnemyShoot(this, shot),
      onDeath: (enemy) => onEnemyDeath(this, enemy),
      onContact: (damage) => hurt(this, damage),
      onExplode: (x, y, radius, damage, color) => onExplode(this, x, y, radius, damage, color),
      onSpawn: (enemy) => onSpawn(this, enemy),
      onBossPhase: (enemy) => onBossPhase(this, enemy),
    });
    this._resetRun();
    this.background = createArenaBackground(WORLD.width, WORLD.height);
    this.vignette = createVignette(WORLD.width, WORLD.height);
    this.dangerVignette = createDangerVignette(WORLD.width, WORLD.height);
    this.best.sync();
  }

  get bestScore() { return this.best.value; }
  _resetRun() {
    this.score = 0; this.combo = 0; this.comboTimer = 0;
    this.wave = 0; this.waveInProgress = false; this.intermission = 0;
    this.shake = 0; this.hitFlash = 0; this.upgradeOpen = false; this.pendingUpgrades = 0;
    this._dashQueued = false;
    this._bossHitGate = 0;
    this.timeScale.reset();
    this.player.reset();
    this.enemies.reset();
    this.weapons.reset();
    this.particles.reset();
    this.gems.reset();
  }
  start(weaponId = null) {
    this.audio.init();
    if (weaponId) this.player.setWeapon(weaponId);
    this._resetRun();
    this.codexOpen = false;
    this.state = 'playing';
    this.input.reset();
    this.ui.showPlaying();
    this.beginWave();
  }
  beginWave() {
    this.wave += 1;
    this.waveInProgress = true;
    this.intermission = 0;
    this.enemies.startWave(this.wave);
    const boss = this.wave % GAME.bossEvery === 0;
    this.ui.banner(`WAVE ${this.wave}`, boss ? 'BOSS INCOMING' : '');
    if (boss) this.audio.boss();
    else this.audio.wave();
  }

  pause() {
    if (this.state !== 'playing' || this.upgradeOpen || this.codexOpen) return;
    this.state = 'paused';
    this.input.reset();
    this.ui.showPause();
  }

  resume() {
    if (this.state !== 'paused' || this.codexOpen) return;
    this.state = 'playing';
    this.input.reset();
    this.ui.showPlaying();
  }

  togglePause() {
    if (this.state === 'paused') this.resume();
    else this.pause();
  }

  requestDash() {
    if (this.state === 'playing' && !this.upgradeOpen) this._dashQueued = true;
  }

  quitToMenu() {
    this.state = 'menu';
    this.codexOpen = false;
    this.upgradeOpen = false;
    this.pendingUpgrades = 0;
    this.input.reset();
    this.ui.showMenu(this.bestScore);
  }

  openCodex() {
    if (this.codexOpen || this.state === 'playing') return;
    this.codexOpen = true;
    this._codexReturn = this.state;
    this.ui.showCodex(this.codex.snapshot());
    this.audio.click();
  }

  closeCodex() {
    if (!this.codexOpen) return;
    this.codexOpen = false;
    if (this._codexReturn === 'paused' && this.state === 'paused') this.ui.showPause();
    else this.ui.showMenu(this.bestScore);
    this.audio.click();
  }

  toggleMute() {
    const muted = this.audio.toggleMuted();
    this.ui.setMuted(muted);
    saveSettings({ volume: this.audio.volume, muted });
    this.audio.click();
  }

  setVolume(value) {
    this.audio.setVolume(value);
    this.ui.setVolume(value);
    saveSettings({ volume: this.audio.volume, muted: this.audio.muted });
  }

  update(realDt) {
    this.time += realDt;
    this.shake = Math.max(0, this.shake - realDt * GAME.shakeDecay);
    this.hitFlash = Math.max(0, this.hitFlash - realDt * GAME.hitFlashDecay);
    this._bossHitGate = Math.max(0, this._bossHitGate - realDt);
    this.particles.update(realDt);
    this.weapons.updateTrails(realDt);
    const input = this.input;
    if (this.codexOpen) {
      if (input.consume('Escape') || input.consume('KeyP')) this.closeCodex();
      return;
    }
    if (input.consume('KeyM')) this.toggleMute();
    if ((input.consume('Escape') || input.consume('KeyP')) && !this.upgradeOpen) this.togglePause();
    if (this.state === 'menu') {
      if (input.consume('Enter') || input.consume('Space')) this.start(this.ui.getSelectedWeapon());
      return;
    }
    if (this.state === 'gameover') {
      if (input.consume('Enter') || input.consume('Space') || input.consume('KeyR')) this.start();
      return;
    }
    if (this.state !== 'playing' || this.upgradeOpen) return;
    const simDt = this.timeScale.advance(realDt);
    if (simDt <= 0) return;
    this._updatePlaying(simDt);
  }

  _updatePlaying(dt) {
    const player = this.player;
    const aim = this._aimPoint();
    const move = this.input.moveVector();
    const wantsDash = this._dashQueued
      || this.input.consume('Space')
      || this.input.consume('ShiftLeft')
      || this.input.consume('ShiftRight');
    this._dashQueued = false;
    if (wantsDash && player.tryDash(move, aim)) this.audio.dash();
    player.update(dt, move, aim);
    this.enemies.update(dt, player);
    if (this.state !== 'playing') return;
    this.weapons.update(dt, player, aim, this.enemies.grid, this.input.isFiring());
    if (this.state !== 'playing') return;
    const xp = this.gems.update(dt, player);
    if (xp > 0) {
      this.audio.pickup();
      this._gainXp(xp);
    }
    this._updateCombo(dt);
    if (this.upgradeOpen) return;
    if (!player.alive) {
      this.gameOver();
      return;
    }
    if (this.waveInProgress && this.enemies.isWaveCleared()) this._clearWave();
    else if (!this.waveInProgress) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.beginWave();
    }
  }

  _aimPoint() {
    const input = this.input;
    if (input.aim.active) return { x: input.aim.x, y: input.aim.y };
    if (input.isTouchMode()) {
      const target = this.enemies.nearest(this.player.x, this.player.y);
      if (target) return { x: target.x, y: target.y };
      return {
        x: this.player.x + Math.cos(this.player.aimAngle) * GAME.aimFallbackDistance,
        y: this.player.y + Math.sin(this.player.aimAngle) * GAME.aimFallbackDistance,
      };
    }
    return { x: input.mouse.x, y: input.mouse.y };
  }

  _updateCombo(dt) {
    if (this.combo <= 0) return;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
  }

  _multiplier() {
    return 1 + Math.min(this.combo, GAME.comboMax) * GAME.comboStep;
  }

  _gainXp(amount) {
    const levels = this.player.addXp(amount);
    if (levels <= 0) return;
    this.pendingUpgrades += levels;
    this.timeScale.slowMotion(TIME.slowMo.levelUpDuration);
    this.audio.levelUp();
    this._openUpgrade();
  }

  _openUpgrade() {
    if (this.upgradeOpen || this.state !== 'playing' || !this.player.alive) return;
    const choices = rollUpgrades(this.player);
    if (choices.length === 0) {
      this.pendingUpgrades = 0;
      this.player.heal(GAME.fallbackHeal);
      this.upgradeOpen = false;
      this.ui.showPlaying();
      return;
    }
    this.codex.seeUpgrades(choices.map((choice) => choice.id));
    this.upgradeOpen = true;
    this.ui.showLevelUp(choices, this.player.upgrades, (id) => this._pickUpgrade(id));
  }

  _pickUpgrade(id) {
    applyUpgrade(this.player, id);
    this.audio.upgrade();
    this.pendingUpgrades = Math.max(0, this.pendingUpgrades - 1);
    this.upgradeOpen = false;
    if (this.pendingUpgrades > 0) this._openUpgrade();
    else this.ui.showPlaying();
  }

  _clearWave() {
    this.waveInProgress = false;
    this.intermission = GAME.intermission;
    const bonus = this.wave * GAME.waveBonus;
    this.score += bonus;
    this.player.heal(GAME.waveClearHeal);
    this.audio.waveClear();
    this.ui.banner('WAVE CLEAR', `+${bonus} SCORE`);
  }

  gameOver() {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.upgradeOpen = false;
    this.pendingUpgrades = 0;
    this.input.reset();
    const newBest = this.best.record(this.score);
    this.audio.gameOver();
    this.ui.showGameOver({
      score: this.score, wave: this.wave, best: this.bestScore, newBest,
    });
    this.best.submit(this.score);
  }

  _onAllTimeBest(best) {
    if (this.state === 'menu') this.ui.showMenu(best);
    else if (this.state === 'gameover') {
      this.ui.showGameOver({ score: this.score, wave: this.wave, best, newBest: this.score >= best });
    }
  }

  render(alpha = 1) {
    renderGame(this, alpha);
  }
}
