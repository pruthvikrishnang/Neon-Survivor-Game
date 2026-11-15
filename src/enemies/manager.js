import { ENEMIES, WORLD } from '../config.js';
import { SpatialGrid, circleOverlap } from '../weapons.js';
import { updateEnemy } from './ai.js';
import { pickBossSpawn, pickSpawn } from './placement.js';
import { drawEnemies } from './render.js';
import {
  ENEMY_TYPES, WAVE_KEYS, bossKindForWave, enemyScaling, waveComposition,
} from './waves.js';

const TAU = Math.PI * 2;
const WAVE_TYPES = Object.freeze({
  chasers: 'chaser', shooters: 'shooter', tanks: 'tank',
  dashers: 'dasher', bombers: 'bomber', summoners: 'summoner',
});
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Spawner, wave bookkeeping and shared enemy lifecycle. */
export class EnemyManager {
  constructor(width, height, handlers = {}) {
    this.width = width;
    this.height = height;
    this.handlers = handlers;
    this.grid = new SpatialGrid(width, height, WORLD.gridCell);
    this.enemies = [];
    this.telegraphs = [];
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
    this.telegraphs.length = 0;
    this.queue.length = 0;
    this.queueIndex = 0;
    this.spawnTimer = 0;
    this.wave = 0;
    this.boss = null;
    this._nextId = 1;
    this.grid.clear();
  }

  startWave(wave) {
    this.wave = wave;
    this.boss = null;
    this.telegraphs.length = 0;
    const comp = waveComposition(wave);
    const types = [];
    for (const key of ['chasers', ...WAVE_KEYS]) {
      for (let i = 0; i < comp[key]; i += 1) types.push(WAVE_TYPES[key]);
    }
    for (let i = types.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    this.queue = comp.boss ? ['boss', ...types] : types;
    this.queueIndex = 0;
    this.spawnTimer = ENEMIES.spawn.initialDelay;
  }

  spawn(type, player, atX = null, atY = null) {
    const base = ENEMY_TYPES[type];
    if (!base) return null;
    const scale = enemyScaling(this.wave);
    const isBoss = type === 'boss';
    const kind = isBoss ? bossKindForWave(this.wave) : null;
    const cfg = ENEMIES.boss;
    let x = atX;
    let y = atY;
    if (x === null || y === null) {
      const pos = isBoss ? pickBossSpawn(this.width, this.height, player) : pickSpawn(this.width, this.height, player);
      x = pos.x;
      y = pos.y;
    }
    const hp = isBoss ? kind.hp * (1 + Math.max(0, this.wave - cfg.hpWaveStart) * cfg.hpPerWave) : base.hp * scale.hp;
    const damage = (isBoss ? kind.damage : base.damage) * scale.damage;
    const enemy = {
      id: this._nextId, type, codexId: isBoss ? kind.id : type,
      name: isBoss ? kind.name : base.name, x, y,
      radius: isBoss ? kind.radius : base.radius, hp, maxHp: hp,
      speed: (isBoss ? kind.speed : base.speed) * scale.speed,
      damage, shotDamage: damage * (isBoss ? cfg.shotDamageMultiplier : 1),
      xp: isBoss ? kind.xp : base.xp, score: isBoss ? kind.score : base.score,
      color: isBoss ? kind.color : base.color, accent: isBoss ? kind.accent : base.color,
      angle: 0, dead: false, hitFlash: 0, contactCd: 0,
      fireTimer: ENEMIES.shooter.initialFireBase + Math.random() * ENEMIES.shooter.initialFireRandom,
      attackTimer: isBoss ? kind.initialAttack : 0,
      pattern: 0, phase: 1, isBoss, bossKind: isBoss ? kind.id : null,
      bossConfig: isBoss ? kind : null, strafe: Math.random() < 0.5 ? -1 : 1,
      burnDps: 0, burnTimer: 0, burnTick: 0, orbitCd: 0,
      dashState: 'idle', dashTimer: Math.random() * ENEMIES.dasher.idleDelay,
      dashAngle: 0, dashRange: 0, fuseTimer: 0, exploding: false,
      summonTimer: ENEMIES.summoner.summonBase * (0.5 + Math.random() * 0.5),
    };
    this._nextId += 1;
    this.enemies.push(enemy);
    if (isBoss) this.boss = enemy;
    this.handlers.onSpawn?.(enemy);
    return enemy;
  }

  update(dt, player) {
    this.time += dt;
    this._compact();
    this._updateTelegraphs(dt, player);
    this._spawnTick(dt, player);
    this.grid.clear();
    for (const enemy of this.enemies) if (!enemy.dead) this.grid.insert(enemy);
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.contactCd = Math.max(0, enemy.contactCd - dt);
      enemy.orbitCd = Math.max(0, enemy.orbitCd - dt);
      this._updateBurn(enemy, dt);
      if (enemy.dead) continue;
      updateEnemy(this, enemy, dt, player);
      if (!enemy.dead) this._separate(enemy);
    }
  }

  _updateBurn(enemy, dt) {
    if (enemy.burnTimer <= 0) return;
    enemy.burnTimer -= dt;
    enemy.burnTick -= dt;
    if (enemy.burnTick <= 0) {
      enemy.burnTick += ENEMIES.burn.tick;
      this.damage(enemy, enemy.burnDps * ENEMIES.burn.tick);
    }
    if (enemy.burnTimer <= 0) enemy.burnDps = 0;
  }

  _compact() {
    let write = 0;
    for (let i = 0; i < this.enemies.length; i += 1) {
      if (!this.enemies[i].dead) { this.enemies[write] = this.enemies[i]; write += 1; }
    }
    this.enemies.length = write;
  }

  _updateTelegraphs(dt, player) {
    if (this.telegraphs.length === 0) return;
    for (const telegraph of this.telegraphs) {
      if (!telegraph.active) continue;
      telegraph.remaining -= dt;
      if (telegraph.remaining > 0) continue;
      telegraph.active = false;
      this.spawn(telegraph.type, player, telegraph.x, telegraph.y);
    }
    let write = 0;
    for (let i = 0; i < this.telegraphs.length; i += 1) {
      if (this.telegraphs[i].active) {
        this.telegraphs[write] = this.telegraphs[i];
        write += 1;
      }
    }
    this.telegraphs.length = write;
  }

  _spawnTelegraph(type, player) {
    const pos = type === 'boss'
      ? pickBossSpawn(this.width, this.height, player)
      : pickSpawn(this.width, this.height, player);
    this.telegraphs.push({
      active: true, type, x: pos.x, y: pos.y,
      remaining: ENEMIES.spawn.telegraphDuration,
      phase: Math.random() * TAU,
    });
  }

  countTelegraphs() {
    let count = 0;
    for (const telegraph of this.telegraphs) if (telegraph.active) count += 1;
    return count;
  }

  _spawnTick(dt, player) {
    if (this.queueIndex >= this.queue.length) return;
    this.spawnTimer -= dt;
    const cfg = ENEMIES.spawn;
    const aliveCap = cfg.aliveBase + Math.min(cfg.aliveMaxExtra, this.wave * cfg.alivePerWave);
    if (this.spawnTimer > 0 || this.countAlive() + this.countTelegraphs() >= aliveCap) return;
    this._spawnTelegraph(this.queue[this.queueIndex], player);
    this.queueIndex += 1;
    this.spawnTimer = Math.max(cfg.minInterval, cfg.intervalBase - this.wave * cfg.intervalPerWave);
  }

  _separate(enemy) {
    const near = this.grid.queryCircle(
      enemy.x, enemy.y, enemy.radius + ENEMIES.separation.queryMargin, this._query,
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

  damage(enemy, amount) {
    if (enemy.dead) return;
    enemy.hp -= amount;
    enemy.hitFlash = ENEMIES.hitFlash;
    if (enemy.hp > 0) return;
    enemy.hp = 0;
    enemy.dead = true;
    enemy.burnDps = 0;
    if (enemy.isBoss) this.boss = null;
    this.handlers.onDeath?.(enemy);
    if (enemy.type === 'tank') {
      for (let i = 0; i < ENEMIES.tankSplit.count; i += 1) {
        const mini = this.spawn('mini', { x: enemy.x, y: enemy.y });
        if (!mini) break;
        const angle = enemy.angle + Math.PI * i;
        mini.x = clamp(enemy.x + Math.cos(angle) * ENEMIES.tankSplit.offset, mini.radius, this.width - mini.radius);
        mini.y = clamp(enemy.y + Math.sin(angle) * ENEMIES.tankSplit.offset, mini.radius, this.height - mini.radius);
      }
    }
  }

  damageArea(x, y, radius, damage, exclude = null) {
    let hits = 0;
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy === exclude) continue;
      if (!circleOverlap(x, y, radius, enemy.x, enemy.y, enemy.radius)) continue;
      this.damage(enemy, damage);
      hits += 1;
    }
    return hits;
  }

  countType(type) {
    let count = 0;
    for (const enemy of this.enemies) if (!enemy.dead && enemy.type === type) count += 1;
    return count;
  }

  countAlive() {
    let count = 0;
    for (const enemy of this.enemies) if (!enemy.dead) count += 1;
    return count;
  }

  isWaveCleared() {
    return this.queueIndex >= this.queue.length
      && this.telegraphs.length === 0
      && this.countAlive() === 0;
  }

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

  draw(ctx, time) {
    drawEnemies(this, ctx, time);
  }
}
