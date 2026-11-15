import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { WeaponSystem, rollUpgrades, applyUpgrade } from './weapons.js';
import { ParticlePool, GemPool } from './particles.js';
import { createArenaBackground, createVignette, drawReticle } from './ui.js';
import { saveSettings } from './storage.js';
import { BestScore } from './best.js';
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 900;
/** Orchestrates the state machine, waves, scoring and rendering. */
export class Game {
  /** @param {{canvas:HTMLCanvasElement,ui:object,audio:object,input:object}} deps */
  constructor({ canvas, ui, audio, input }) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.ui = ui; this.audio = audio; this.input = input;
    this.state = 'menu'; this.time = 0;
    this.best = new BestScore((best) => this._onAllTimeBest(best)); this.particles = new ParticlePool(900);
    this.gems = new GemPool(320);
    this.player = new Player(WORLD_WIDTH, WORLD_HEIGHT);
    this.weapons = new WeaponSystem(
      { width: WORLD_WIDTH, height: WORLD_HEIGHT },
      {
        onShoot: (x, y, angle) => this._onPlayerShoot(x, y, angle),
        onEnemyHit: (enemy, damage) => {
          this.enemies.damage(enemy, damage);
          this.audio.hit();
        },
        onPlayerHit: (damage) => this._hurt(damage),
      },
    );
    this.enemies = new EnemyManager(WORLD_WIDTH, WORLD_HEIGHT, {
      onShoot: (shot) => this._onEnemyShoot(shot),
      onDeath: (enemy) => this._onEnemyDeath(enemy),
      onContact: (damage) => this._hurt(damage),
    });
    this._resetRun();
    this.background = createArenaBackground(WORLD_WIDTH, WORLD_HEIGHT);
    this.vignette = createVignette(WORLD_WIDTH, WORLD_HEIGHT); this.best.sync();
  }
  get bestScore() { return this.best.value; }
  _resetRun() {
    this.score = 0; this.combo = 0; this.comboTimer = 0;
    this.wave = 0; this.waveInProgress = false; this.intermission = 0;
    this.shake = 0; this.hitFlash = 0; this.upgradeOpen = false; this.pendingUpgrades = 0;
    this.player.reset();
    this.enemies.reset();
    this.weapons.reset();
    this.particles.reset();
    this.gems.reset();
  }
  /** Start a fresh run from any state. */
  start() {
    this.audio.init();
    this._resetRun();
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
    const boss = this.wave % 5 === 0;
    this.ui.banner(`WAVE ${this.wave}`, boss ? 'BOSS INCOMING' : '');
    if (boss) this.audio.boss();
    else this.audio.wave();
  }
  pause() {
    if (this.state !== 'playing' || this.upgradeOpen) return;
    this.state = 'paused';
    this.input.reset();
    this.ui.showPause();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.reset();
    this.ui.showPlaying();
  }
  togglePause() {
    if (this.state === 'paused') this.resume();
    else this.pause();
  }
  quitToMenu() {
    this.state = 'menu';
    this.upgradeOpen = false;
    this.pendingUpgrades = 0;
    this.input.reset();
    this.ui.showMenu(this.bestScore);
  }
  /** Master mute toggle, also persisted. */
  toggleMute() {
    const muted = this.audio.toggleMuted();
    this.ui.setMuted(muted);
    saveSettings({ volume: this.audio.volume, muted });
    this.audio.click();
  }
  /** @param {number} value 0..1 */
  setVolume(value) {
    this.audio.setVolume(value);
    this.ui.setVolume(value);
    saveSettings({ volume: this.audio.volume, muted: this.audio.muted });
  }
  /** @param {number} dt fixed timestep in seconds */
  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 55);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.4);
    const input = this.input;
    if (input.consume('KeyM')) this.toggleMute();
    if ((input.consume('Escape') || input.consume('KeyP')) && !this.upgradeOpen) {
      this.togglePause();
    }
    if (this.state === 'menu') {
      if (input.consume('Enter') || input.consume('Space')) this.start();
      return;
    }
    if (this.state === 'gameover') {
      if (input.consume('Enter') || input.consume('Space') || input.consume('KeyR')) this.start();
      return;
    }
    if (this.state !== 'playing' || this.upgradeOpen) return;
    this._updatePlaying(dt);
  }
  _updatePlaying(dt) {
    const player = this.player;
    const aim = this._aimPoint();
    player.update(dt, this.input.moveVector(), aim);
    this.enemies.update(dt, player);
    if (this.state !== 'playing') return;
    this.weapons.update(dt, player, aim, this.enemies.grid, this.input.isFiring());
    if (this.state !== 'playing') return;
    const xp = this.gems.update(dt, player);
    if (xp > 0) {
      this.audio.pickup();
      this._gainXp(xp);
    }
    this.particles.update(dt);
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
        x: this.player.x + Math.cos(this.player.aimAngle) * 200,
        y: this.player.y + Math.sin(this.player.aimAngle) * 200,
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
    return 1 + Math.min(this.combo, 20) * 0.1;
  }
  _gainXp(amount) {
    const levels = this.player.addXp(amount);
    if (levels <= 0) return;
    this.pendingUpgrades += levels;
    this.audio.levelUp();
    this._openUpgrade();
  }
  _openUpgrade() {
    if (this.upgradeOpen || this.state !== 'playing' || !this.player.alive) return;
    const choices = rollUpgrades(this.player, 3);
    if (choices.length === 0) {
      this.pendingUpgrades = 0;
      this.player.heal(30);
      this.upgradeOpen = false;
      this.ui.showPlaying();
      return;
    }
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
    this.intermission = 2.4;
    const bonus = this.wave * 25;
    this.score += bonus;
    this.player.heal(6);
    this.audio.waveClear();
    this.ui.banner('WAVE CLEAR', `+${bonus} SCORE`);
  }
  _onPlayerShoot(x, y, angle) {
    this.audio.shoot();
    this.particles.burst(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, '#8ffbff', 2, 90, 0.16);
  }
  _onEnemyShoot(shot) {
    this.weapons.fireEnemy(shot);
    this.audio.enemyShoot();
    this.particles.burst(shot.x, shot.y, shot.color, 2, 70, 0.2);
  }
  _onEnemyDeath(enemy) {
    this.combo = Math.min(99, this.combo + 1);
    this.comboTimer = 3;
    this.score += Math.round(enemy.score * this._multiplier());
    this.shake = Math.max(this.shake, enemy.isBoss ? 18 : enemy.type === 'tank' ? 5 : 2.5);
    const count = enemy.isBoss ? 60 : enemy.type === 'tank' ? 26 : 14;
    this.particles.burst(enemy.x, enemy.y, enemy.color, count, enemy.isBoss ? 340 : 210, enemy.isBoss ? 0.9 : 0.6);
    this.audio.explode(enemy.isBoss);
    if (enemy.isBoss) {
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        this.gems.spawn(enemy.x + Math.cos(angle) * 48, enemy.y + Math.sin(angle) * 48, 8);
      }
    } else {
      this.gems.spawn(enemy.x, enemy.y, enemy.xp);
    }
  }
  /** @param {number} damage @returns {boolean} */
  _hurt(damage) {
    if (this.state !== 'playing' || this.upgradeOpen) return false;
    const applied = this.player.takeDamage(damage);
    if (!applied) return false;
    this.shake = Math.max(this.shake, 9);
    this.hitFlash = 0.42;
    this.audio.hurt();
    this.particles.burst(this.player.x, this.player.y, '#ff3b6b', 12, 140, 0.45);
    if (!this.player.alive) this.gameOver();
    return true;
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
  /** @param {number} [alpha] unused interpolation factor, kept for the loop API */
  render(alpha = 1) {
    void alpha;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.save();
    const sx = (Math.random() * 2 - 1) * this.shake;
    const sy = (Math.random() * 2 - 1) * this.shake;
    ctx.translate(sx, sy);
    ctx.drawImage(this.background, 0, 0);
    this.gems.draw(ctx, this.time);
    this.enemies.draw(ctx, this.time);
    this.weapons.draw(ctx);
    this.player.draw(ctx, this.time);
    this.particles.draw(ctx);
    if (this.state === 'playing') {
      this.input.drawJoystick(ctx, this.time);
      if (!this.upgradeOpen) {
        if (this.input.aim.active) drawReticle(ctx, this.input.aim.x, this.input.aim.y, 'rgba(255, 59, 212, 0.6)');
        else if (!this.input.isTouchMode()) drawReticle(ctx, this.input.mouse.x, this.input.mouse.y, 'rgba(81, 246, 255, 0.55)');
      }
    }
    ctx.restore();
    ctx.drawImage(this.vignette, 0, 0);
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 42, 92, ${(this.hitFlash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }
    this.ui.setHud(this);
  }
}
