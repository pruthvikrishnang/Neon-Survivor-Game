import { SpatialGrid, circleOverlap } from './weapons.js';
import { drawEnemy } from './particles.js';
import { ENEMIES, WORLD } from './config.js';

const TAU = Math.PI * 2;
export const ENEMY_TYPES = ENEMIES.types;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Enemy mix for a wave. Total caps so late waves stay performant.
 * @param {number} wave 1-based wave number
 * @returns {{chasers:number, shooters:number, tanks:number, boss:boolean, total:number}}
 */
export function waveComposition(wave) {
  const cfg = ENEMIES.composition;
  const w = Math.max(1, Math.floor(wave));
  const total = Math.min(ENEMIES.maxWaveTotal, cfg.baseTotal + w * cfg.perWave);
  const tanks = w >= cfg.tanks.unlockWave
    ? Math.min(
      cfg.tanks.base + Math.floor((w - cfg.tanks.unlockWave) / cfg.tanks.every),
      Math.floor(total * cfg.tanks.maxShare),
    )
    : 0;
  const shooters = w >= cfg.shooters.unlockWave
    ? Math.min(
      cfg.shooters.base + Math.floor((w - cfg.shooters.unlockWave) * cfg.shooters.every),
      Math.floor(total * cfg.shooters.maxShare),
    )
    : 0;
  return {
    chasers: Math.max(1, total - shooters - tanks),
    shooters, tanks, boss: w % cfg.bossEvery === 0, total,
  };
}

/**
 * Stat multipliers applied to every enemy spawned on a wave.
 * @param {number} wave
 * @returns {{hp:number, speed:number, damage:number}}
 */
export function enemyScaling(wave) {
  const cfg = ENEMIES.scaling;
  const w = Math.max(1, Math.floor(wave));
  return {
    hp: 1 + (w - 1) * cfg.hpPerWave,
    speed: Math.min(cfg.speedMax, 1 + (w - 1) * cfg.speedPerWave),
    damage: 1 + (w - 1) * cfg.damagePerWave,
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
    this.grid = new SpatialGrid(width, height, WORLD.gridCell);
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
    this.spawnTimer = ENEMIES.spawn.initialDelay;
  }

  /** Spawn one enemy; returns it so callers can reposition it. */
  spawn(type, player) {
    const base = ENEMY_TYPES[type];
    if (!base) return null;
    const scale = enemyScaling(this.wave);
    const isBoss = type === 'boss';
    const cfg = ENEMIES.boss;
    const pos = isBoss
      ? { x: this.width / 2, y: this.height * cfg.spawnY }
      : this._pickSpawn(player);
    const hp = isBoss
      ? base.hp * (1 + Math.max(0, this.wave - cfg.hpWaveStart) * cfg.hpPerWave)
      : base.hp * scale.hp;
    const enemy = {
      id: this._nextId, type, x: pos.x, y: pos.y, radius: base.radius, hp, maxHp: hp,
      speed: base.speed * scale.speed, damage: base.damage * scale.damage,
      shotDamage: base.damage * scale.damage * (isBoss ? cfg.shotDamageMultiplier : 1),
      xp: base.xp, score: base.score, color: base.color, angle: 0, dead: false,
      hitFlash: 0, contactCd: 0,
      fireTimer: ENEMIES.shooter.initialFireBase + Math.random() * ENEMIES.shooter.initialFireRandom,
      attackTimer: ENEMIES.bossAI.initialAttack,
      pattern: 0, strafe: Math.random() < 0.5 ? -1 : 1, isBoss,
    };
    this._nextId += 1;
    this.enemies.push(enemy);
    if (isBoss) this.boss = enemy;
    return enemy;
  }

  _pickSpawn(player) {
    const cfg = ENEMIES.spawn;
    let best = { x: cfg.margin, y: cfg.margin };
    let bestDist = -1;
    for (let i = 0; i < cfg.attempts; i += 1) {
      const edge = Math.floor(Math.random() * 4);
      const t = Math.random();
      const x = edge < 2
        ? cfg.margin + t * (this.width - cfg.margin * 2)
        : (edge === 2 ? cfg.margin : this.width - cfg.margin);
      const y = edge >= 2
        ? cfg.margin + t * (this.height - cfg.margin * 2)
        : (edge === 0 ? cfg.margin : this.height - cfg.margin);
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
    const cfg = ENEMIES.spawn;
    const aliveCap = cfg.aliveBase + Math.min(cfg.aliveMaxExtra, this.wave * cfg.alivePerWave);
    if (this.spawnTimer > 0 || this.countAlive() >= aliveCap) return;
    this.spawn(this.queue[this.queueIndex], player);
    this.queueIndex += 1;
    this.spawnTimer = Math.max(cfg.minInterval, cfg.intervalBase - this.wave * cfg.intervalPerWave);
  }

  _updateEnemy(enemy, dt, player) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.angle = Math.atan2(dy, dx);
    if (enemy.type === 'shooter') this._updateShooter(enemy, dt, player, dist);
    else if (enemy.type === 'boss') this._updateBoss(enemy, dt, player, dist);
    else {
      const wobble = enemy.type === 'chaser'
        ? Math.sin(this.time * ENEMIES.wobbleSpeed + enemy.id) * ENEMIES.wobbleAmplitude
        : 0;
      enemy.x += Math.cos(enemy.angle + wobble) * enemy.speed * dt;
      enemy.y += Math.sin(enemy.angle + wobble) * enemy.speed * dt;
    }
    enemy.x = clamp(enemy.x, enemy.radius, this.width - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, this.height - enemy.radius);
    if (player.alive && enemy.contactCd <= 0
      && circleOverlap(enemy.x, enemy.y, enemy.radius, player.x, player.y, player.radius)) {
      const applied = this.handlers.onContact?.(enemy.damage, enemy);
      enemy.contactCd = enemy.isBoss ? ENEMIES.contact.bossCooldown : ENEMIES.contact.cooldown;
      if (applied && !enemy.isBoss) {
        enemy.x -= Math.cos(enemy.angle) * ENEMIES.contact.knockback;
        enemy.y -= Math.sin(enemy.angle) * ENEMIES.contact.knockback;
      }
    }
  }

  _updateShooter(enemy, dt, player, dist) {
    const cfg = ENEMIES.shooter;
    const nx = (player.x - enemy.x) / dist;
    const ny = (player.y - enemy.y) / dist;
    if (dist > cfg.far || dist < cfg.near) {
      const sign = dist > cfg.far ? 1 : -1;
      enemy.x += nx * enemy.speed * dt * sign;
      enemy.y += ny * enemy.speed * dt * sign;
    } else {
      enemy.x += -ny * enemy.strafe * enemy.speed * cfg.strafe * dt;
      enemy.y += nx * enemy.strafe * enemy.speed * cfg.strafe * dt;
    }
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < cfg.fireRange) {
      this.handlers.onShoot?.({
        x: enemy.x, y: enemy.y, angle: enemy.angle, speed: cfg.bulletSpeed,
        damage: enemy.shotDamage, radius: cfg.bulletRadius, color: cfg.bulletColor,
      });
      enemy.fireTimer = Math.max(cfg.fireMin, cfg.fireBase - this.wave * cfg.firePerWave);
    }
  }

  _updateBoss(enemy, dt, player, dist) {
    const cfg = ENEMIES.bossAI;
    const enraged = enemy.hp / enemy.maxHp < cfg.enrageThreshold;
    const speed = enemy.speed * (enraged ? cfg.enragedSpeed : 1);
    const nx = (player.x - enemy.x) / dist;
    const ny = (player.y - enemy.y) / dist;
    if (dist > cfg.far || dist < cfg.near) {
      const sign = dist > cfg.far ? 1 : -1;
      enemy.x += nx * speed * dt * sign;
      enemy.y += ny * speed * dt * sign;
    } else {
      enemy.x += -ny * enemy.strafe * speed * cfg.strafe * dt;
      enemy.y += nx * enemy.strafe * speed * cfg.strafe * dt;
    }
    enemy.attackTimer -= dt;
    if (enemy.attackTimer > 0) return;
    if (enemy.pattern === 0) {
      const count = enraged ? cfg.radialEnragedCount : cfg.radialCount;
      for (let i = 0; i < count; i += 1) {
        this.handlers.onShoot?.({
          x: enemy.x, y: enemy.y,
          angle: (i / count) * TAU + this.time * cfg.radialSpin,
          speed: cfg.radialSpeed, damage: enemy.shotDamage,
          radius: cfg.radialRadius, color: cfg.radialColor,
        });
      }
    } else {
      const shots = enraged ? cfg.aimedEnragedCount : cfg.aimedCount;
      for (let i = 0; i < shots; i += 1) {
        this.handlers.onShoot?.({
          x: enemy.x, y: enemy.y,
          angle: enemy.angle + (i - (shots - 1) / 2) * cfg.aimedStep,
          speed: cfg.aimedSpeed, damage: enemy.shotDamage * cfg.aimedDamageMultiplier,
          radius: cfg.aimedRadius, color: cfg.aimedColor,
        });
      }
    }
    enemy.pattern = 1 - enemy.pattern;
    enemy.attackTimer = Math.max(
      cfg.attackMin,
      (enraged ? cfg.attackEnragedBase : cfg.attackBase) - this.wave * cfg.attackPerWave,
    );
  }

  _separate(enemy) {
    const near = this.grid.queryCircle(
      enemy.x,
      enemy.y,
      enemy.radius + ENEMIES.separation.queryMargin,
      this._query,
    );
    for (const other of near) {
      if (other === enemy || other.dead || other.id <= enemy.id) continue;
      const dx = other.x - enemy.x;
      const dy = other.y - enemy.y;
      const minDist = enemy.radius + other.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 0 || distSq >= minDist * minDist) continue;
      const dist = Math.sqrt(distSq);
      const push = (minDist - dist) * ENEMIES.separation.pushShare;
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
    enemy.hitFlash = ENEMIES.hitFlash;
    if (enemy.hp > 0) return;
    enemy.hp = 0;
    enemy.dead = true;
    if (enemy.isBoss) this.boss = null;
    this.handlers.onDeath?.(enemy);
    if (enemy.type === 'tank') {
      for (let i = 0; i < ENEMIES.tankSplit.count; i += 1) {
        const mini = this.spawn('mini', { x: enemy.x, y: enemy.y });
        if (!mini) break;
        const angle = enemy.angle + Math.PI * i;
        mini.x = clamp(
          enemy.x + Math.cos(angle) * ENEMIES.tankSplit.offset,
          mini.radius,
          this.width - mini.radius,
        );
        mini.y = clamp(
          enemy.y + Math.sin(angle) * ENEMIES.tankSplit.offset,
          mini.radius,
          this.height - mini.radius,
        );
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
