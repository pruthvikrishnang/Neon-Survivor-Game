import { SpatialGrid, circleOverlap } from './weapons.js';
import { drawEnemy } from './particles.js';
const TAU = Math.PI * 2;
export const ENEMY_TYPES = Object.freeze({
  chaser: { hp: 22, speed: 108, radius: 14, damage: 10, xp: 1, score: 10, color: '#ff3b6b' },
  mini: { hp: 12, speed: 178, radius: 9, damage: 7, xp: 1, score: 6, color: '#ff8a9c' },
  shooter: { hp: 32, speed: 72, radius: 15, damage: 8, xp: 2, score: 18, color: '#ffb340' },
  tank: { hp: 170, speed: 44, radius: 26, damage: 18, xp: 5, score: 40, color: '#b45cff' },
  boss: { hp: 800, speed: 54, radius: 52, damage: 24, xp: 40, score: 500, color: '#ff2bd6' },
});
const MAX_WAVE_TOTAL = 64;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/**
 * Enemy mix for a wave. Total caps so late waves stay performant.
 * @param {number} wave 1-based wave number
 * @returns {{chasers:number, shooters:number, tanks:number, boss:boolean, total:number}}
 */
export function waveComposition(wave) {
  const w = Math.max(1, Math.floor(wave));
  const total = Math.min(MAX_WAVE_TOTAL, 6 + w * 3);
  const tanks = w >= 3 ? Math.min(2 + Math.floor((w - 3) / 2), Math.floor(total * 0.18)) : 0;
  const shooters = w >= 2 ? Math.min(2 + Math.floor((w - 2) * 0.8), Math.floor(total * 0.35)) : 0;
  return {
    chasers: Math.max(1, total - shooters - tanks),
    shooters, tanks, boss: w % 5 === 0, total,
  };
}
/**
 * Stat multipliers applied to every enemy spawned on a wave.
 * @param {number} wave
 * @returns {{hp:number, speed:number, damage:number}}
 */
export function enemyScaling(wave) {
  const w = Math.max(1, Math.floor(wave));
  return {
    hp: 1 + (w - 1) * 0.17,
    speed: Math.min(1.55, 1 + (w - 1) * 0.018),
    damage: 1 + (w - 1) * 0.07,
  };
}
/** Spawner, movement AI, tank splitting and boss patterns. */
export class EnemyManager {
  /**
   * @param {number} width @param {number} height
   * @param {{onShoot?:Function,onDeath?:Function,onContact?:Function}} handlers
   */
  constructor(width, height, handlers = {}) {
    this.width = width;
    this.height = height;
    this.handlers = handlers;
    this.grid = new SpatialGrid(width, height, 80);
    this.enemies = [];
    this.queue = [];
    this.queueIndex = 0;
    this.spawnTimer = 0;
    this.wave = 0;
    this.time = 0;
    this.boss = null;
    this._nextId = 1;
    this._query = [];
  }
  reset() {
    this.enemies.length = 0;
    this.queue.length = 0;
    this.queueIndex = 0;
    this.spawnTimer = 0;
    this.wave = 0;
    this.boss = null;
    this._nextId = 1;
    this.grid.clear();
  }
  /** @param {number} wave */
  startWave(wave) {
    this.wave = wave;
    this.boss = null;
    const comp = waveComposition(wave);
    const types = [];
    for (let i = 0; i < comp.chasers; i += 1) types.push('chaser');
    for (let i = 0; i < comp.shooters; i += 1) types.push('shooter');
    for (let i = 0; i < comp.tanks; i += 1) types.push('tank');
    for (let i = types.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    this.queue = comp.boss ? ['boss', ...types] : types;
    this.queueIndex = 0;
    this.spawnTimer = 0.25;
  }
  /** Spawn one enemy; returns it so callers can reposition it. */
  spawn(type, player) {
    const base = ENEMY_TYPES[type];
    if (!base) return null;
    const scale = enemyScaling(this.wave);
    const isBoss = type === 'boss';
    const pos = isBoss ? { x: this.width / 2, y: this.height * 0.18 } : this._pickSpawn(player);
    const hp = isBoss ? base.hp * (1 + Math.max(0, this.wave - 5) * 0.2) : base.hp * scale.hp;
    const enemy = {
      id: this._nextId, type, x: pos.x, y: pos.y, radius: base.radius, hp, maxHp: hp,
      speed: base.speed * scale.speed, damage: base.damage * scale.damage,
      shotDamage: base.damage * scale.damage * (isBoss ? 0.6 : 1),
      xp: base.xp, score: base.score, color: base.color, angle: 0, dead: false,
      hitFlash: 0, contactCd: 0, fireTimer: 1.2 + Math.random(), attackTimer: 1.8,
      pattern: 0, strafe: Math.random() < 0.5 ? -1 : 1, isBoss,
    };
    this._nextId += 1;
    this.enemies.push(enemy);
    if (isBoss) this.boss = enemy;
    return enemy;
  }
  _pickSpawn(player) {
    const m = 44;
    let best = { x: m, y: m };
    let bestDist = -1;
    for (let i = 0; i < 8; i += 1) {
      const edge = Math.floor(Math.random() * 4);
      const t = Math.random();
      const x = edge < 2 ? m + t * (this.width - m * 2) : (edge === 2 ? m : this.width - m);
      const y = edge >= 2 ? m + t * (this.height - m * 2) : (edge === 0 ? m : this.height - m);
      const dist = (x - player.x) ** 2 + (y - player.y) ** 2;
      if (dist > bestDist) { bestDist = dist; best = { x, y }; }
    }
    return best;
  }
  /** @param {number} dt @param {import('./player.js').Player} player */
  update(dt, player) {
    this.time += dt;
    this._compact();
    this._spawnTick(dt, player);
    this.grid.clear();
    for (const enemy of this.enemies) if (!enemy.dead) this.grid.insert(enemy);
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.contactCd = Math.max(0, enemy.contactCd - dt);
      this._updateEnemy(enemy, dt, player);
      if (!enemy.dead) this._separate(enemy);
    }
  }
  _compact() {
    let write = 0;
    for (let i = 0; i < this.enemies.length; i += 1) {
      if (!this.enemies[i].dead) { this.enemies[write] = this.enemies[i]; write += 1; }
    }
    this.enemies.length = write;
  }
  _spawnTick(dt, player) {
    if (this.queueIndex >= this.queue.length) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.countAlive() >= 72 + Math.min(24, this.wave * 2)) return;
    this.spawn(this.queue[this.queueIndex], player);
    this.queueIndex += 1;
    this.spawnTimer = Math.max(0.16, 0.85 - this.wave * 0.025);
  }
  _updateEnemy(enemy, dt, player) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.angle = Math.atan2(dy, dx);
    if (enemy.type === 'shooter') this._updateShooter(enemy, dt, player, dist);
    else if (enemy.type === 'boss') this._updateBoss(enemy, dt, player, dist);
    else {
      const wobble = enemy.type === 'chaser' ? Math.sin(this.time * 4 + enemy.id) * 0.12 : 0;
      enemy.x += Math.cos(enemy.angle + wobble) * enemy.speed * dt;
      enemy.y += Math.sin(enemy.angle + wobble) * enemy.speed * dt;
    }
    enemy.x = clamp(enemy.x, enemy.radius, this.width - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, this.height - enemy.radius);
    if (player.alive && enemy.contactCd <= 0
      && circleOverlap(enemy.x, enemy.y, enemy.radius, player.x, player.y, player.radius)) {
      const applied = this.handlers.onContact?.(enemy.damage, enemy);
      enemy.contactCd = enemy.isBoss ? 0.9 : 0.7;
      if (applied && !enemy.isBoss) {
        enemy.x -= Math.cos(enemy.angle) * 24;
        enemy.y -= Math.sin(enemy.angle) * 24;
      }
    }
  }
  _updateShooter(enemy, dt, player, dist) {
    const nx = (player.x - enemy.x) / dist;
    const ny = (player.y - enemy.y) / dist;
    if (dist > 340 || dist < 220) {
      const sign = dist > 340 ? 1 : -1;
      enemy.x += nx * enemy.speed * dt * sign;
      enemy.y += ny * enemy.speed * dt * sign;
    } else {
      enemy.x += -ny * enemy.strafe * enemy.speed * 0.8 * dt;
      enemy.y += nx * enemy.strafe * enemy.speed * 0.8 * dt;
    }
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < 640) {
      this.handlers.onShoot?.({
        x: enemy.x, y: enemy.y, angle: enemy.angle, speed: 220,
        damage: enemy.shotDamage, radius: 7, color: '#ffb340',
      });
      enemy.fireTimer = Math.max(1.0, 2.3 - this.wave * 0.04);
    }
  }
  _updateBoss(enemy, dt, player, dist) {
    const enraged = enemy.hp / enemy.maxHp < 0.5;
    const speed = enemy.speed * (enraged ? 1.35 : 1);
    const nx = (player.x - enemy.x) / dist;
    const ny = (player.y - enemy.y) / dist;
    if (dist > 250 || dist < 150) {
      const sign = dist > 250 ? 1 : -1;
      enemy.x += nx * speed * dt * sign;
      enemy.y += ny * speed * dt * sign;
    } else {
      enemy.x += -ny * enemy.strafe * speed * 0.65 * dt;
      enemy.y += nx * enemy.strafe * speed * 0.65 * dt;
    }
    enemy.attackTimer -= dt;
    if (enemy.attackTimer > 0) return;
    if (enemy.pattern === 0) {
      const count = enraged ? 16 : 12;
      for (let i = 0; i < count; i += 1) {
        this.handlers.onShoot?.({
          x: enemy.x, y: enemy.y, angle: (i / count) * TAU + this.time * 0.8,
          speed: 175, damage: enemy.shotDamage, radius: 8, color: '#ff3bd4',
        });
      }
    } else {
      const shots = enraged ? 7 : 5;
      for (let i = 0; i < shots; i += 1) {
        this.handlers.onShoot?.({
          x: enemy.x, y: enemy.y, angle: enemy.angle + (i - (shots - 1) / 2) * 0.17,
          speed: 265, damage: enemy.shotDamage * 1.2, radius: 7, color: '#ff3b6b',
        });
      }
    }
    enemy.pattern = 1 - enemy.pattern;
    enemy.attackTimer = Math.max(1.0, (enraged ? 1.7 : 2.7) - this.wave * 0.02);
  }
  _separate(enemy) {
    const near = this.grid.queryCircle(enemy.x, enemy.y, enemy.radius + 60, this._query);
    for (const other of near) {
      if (other === enemy || other.dead || other.id <= enemy.id) continue;
      const dx = other.x - enemy.x;
      const dy = other.y - enemy.y;
      const minDist = enemy.radius + other.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 0 || distSq >= minDist * minDist) continue;
      const dist = Math.sqrt(distSq);
      const push = (minDist - dist) * 0.5;
      enemy.x -= (dx / dist) * push;
      enemy.y -= (dy / dist) * push;
      other.x += (dx / dist) * push;
      other.y += (dy / dist) * push;
    }
  }
  /** Apply damage and handle death, tank splitting and boss bookkeeping. */
  damage(enemy, amount) {
    if (enemy.dead) return;
    enemy.hp -= amount;
    enemy.hitFlash = 0.09;
    if (enemy.hp > 0) return;
    enemy.hp = 0;
    enemy.dead = true;
    if (enemy.isBoss) this.boss = null;
    this.handlers.onDeath?.(enemy);
    if (enemy.type === 'tank') {
      for (let i = 0; i < 2; i += 1) {
        const mini = this.spawn('mini', { x: enemy.x, y: enemy.y });
        if (!mini) break;
        const angle = enemy.angle + Math.PI * i;
        mini.x = clamp(enemy.x + Math.cos(angle) * 26, mini.radius, this.width - mini.radius);
        mini.y = clamp(enemy.y + Math.sin(angle) * 26, mini.radius, this.height - mini.radius);
      }
    }
  }
  countAlive() {
    let count = 0;
    for (const enemy of this.enemies) if (!enemy.dead) count += 1;
    return count;
  }
  /** @returns {boolean} all queued enemies spawned and dead */
  isWaveCleared() {
    return this.queueIndex >= this.queue.length && this.countAlive() === 0;
  }
  /** @returns {object|null} nearest living enemy (used for touch auto-aim) */
  nearest(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dist = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
      if (dist < bestDist) { bestDist = dist; best = enemy; }
    }
    return best;
  }
  /** @param {CanvasRenderingContext2D} ctx @param {number} time */
  draw(ctx, time) {
    for (const enemy of this.enemies) if (!enemy.dead) drawEnemy(ctx, enemy, time);
  }
}
