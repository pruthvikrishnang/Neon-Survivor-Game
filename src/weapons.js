import { COLORS, WEAPONS, WORLD } from './config.js';

/**
 * Circle-vs-circle overlap used by bullets, pickups and contact damage.
 * @returns {boolean}
 */
export function circleOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy <= reach * reach;
}

/** Uniform-grid broad phase. Each entity is inserted once by its centre cell. */
export class SpatialGrid {
  constructor(width, height, cellSize = WORLD.gridCell) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear() {
    for (const bucket of this.buckets) bucket.length = 0;
  }

  /** @param {{x:number,y:number,radius:number}} entity */
  insert(entity) {
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor(entity.x / this.cellSize)));
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor(entity.y / this.cellSize)));
    this.buckets[row * this.cols + col].push(entity);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {Array} out reusable output array
   * @returns {Array}
   */
  queryCircle(x, y, radius, out = []) {
    out.length = 0;
    const minCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const bucket = this.buckets[row * this.cols + col];
        for (const entity of bucket) {
          if (entity.dead) continue;
          const reach = radius + entity.radius;
          const dx = entity.x - x;
          const dy = entity.y - y;
          if (dx * dx + dy * dy <= reach * reach) out.push(entity);
        }
      }
    }
    return out;
  }
}

/** Upgrade definitions. `describe` returns copy for the next level. */
export const UPGRADES = WEAPONS.upgrades;

/**
 * Apply one level of an upgrade.
 * @param {import('./player.js').Player} player
 * @param {string} id
 * @returns {boolean} false when maxed or unknown
 */
export function applyUpgrade(player, id) {
  const def = UPGRADES.find((upgrade) => upgrade.id === id);
  if (!def) return false;
  const level = player.upgrades[id] || 0;
  if (level >= def.max) return false;
  player.upgrades[id] = level + 1;
  player.recomputeStats();
  return true;
}

/**
 * Pick `count` distinct affordable upgrades.
 * @param {import('./player.js').Player} player
 * @param {number} [count]
 * @param {() => number} [rng]
 * @returns {typeof UPGRADES}
 */
export function rollUpgrades(player, count = WEAPONS.fire.choices, rng = Math.random) {
  const available = UPGRADES.filter((upgrade) => (player.upgrades[upgrade.id] || 0) < upgrade.max);
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = available[i];
    available[i] = available[j];
    available[j] = tmp;
  }
  return available.slice(0, count);
}

function makePool(size) {
  const items = Array.from({ length: size }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0,
    radius: WEAPONS.bullet.playerRadius, damage: 0,
    pierce: 0, hitCount: 0, life: 0, color: WEAPONS.bullet.playerColor, hits: [],
  }));
  return { items, cursor: 0 };
}

function obtain(pool) {
  const { items } = pool;
  for (let i = 0; i < items.length; i += 1) {
    const index = (pool.cursor + i) % items.length;
    if (!items[index].active) {
      pool.cursor = (index + 1) % items.length;
      return items[index];
    }
  }
  return null;
}

/** Pooled player bullets and hostile projectiles, with grid-accelerated hits. */
export class WeaponSystem {
  /**
   * @param {{width:number,height:number}} world
   * @param {{onShoot?:Function,onEnemyHit?:Function,onPlayerHit?:Function}} callbacks
   */
  constructor(world, callbacks = {}) {
    this.world = world;
    this.callbacks = callbacks;
    this.playerPool = makePool(WEAPONS.pools.player);
    this.enemyPool = makePool(WEAPONS.pools.enemy);
    this.cooldown = 0;
    this._query = [];
  }

  reset() {
    for (const bullet of this.playerPool.items) bullet.active = false;
    for (const bullet of this.enemyPool.items) bullet.active = false;
    this.cooldown = 0;
  }

  _spawn(pool, x, y, angle, speed, damage, radius, pierce, color) {
    const bullet = obtain(pool);
    if (!bullet) return;
    bullet.active = true;
    bullet.x = x;
    bullet.y = y;
    bullet.vx = Math.cos(angle) * speed;
    bullet.vy = Math.sin(angle) * speed;
    bullet.damage = damage;
    bullet.radius = radius;
    bullet.pierce = pierce;
    bullet.hitCount = 0;
    bullet.life = WEAPONS.bullet.life;
    bullet.color = color;
    bullet.hits.length = 0;
  }

  /**
   * Spawn one hostile projectile (used by shooters and the boss).
   * @param {{x:number,y:number,angle:number,speed:number,damage:number,radius?:number,color?:string}} shot
   */
  fireEnemy(shot) {
    this._spawn(
      this.enemyPool, shot.x, shot.y, shot.angle, shot.speed,
      shot.damage, shot.radius || WEAPONS.bullet.enemyRadius, 0,
      shot.color || WEAPONS.bullet.enemyColor,
    );
  }

  _fireVolley(player, aim, rapid) {
    const baseAngle = Math.atan2(aim.y - player.y, aim.x - player.x);
    const shots = player.stats.shots;
    const spread = WEAPONS.fire.spread;
    for (let i = 0; i < shots; i += 1) {
      const angle = baseAngle + (i - (shots - 1) / 2) * spread;
      const muzzleX = player.x + Math.cos(angle) * WEAPONS.fire.muzzleOffset;
      const muzzleY = player.y + Math.sin(angle) * WEAPONS.fire.muzzleOffset;
      this._spawn(
        this.playerPool, muzzleX, muzzleY, angle, player.stats.bulletSpeed,
        player.stats.damage, WEAPONS.bullet.playerRadius, player.stats.pierce,
        WEAPONS.bullet.playerColor,
      );
    }
    this.cooldown = player.stats.fireInterval * (rapid ? WEAPONS.fire.rapidMultiplier : 1);
    this.callbacks.onShoot?.(player.x, player.y, baseAngle);
  }

  /**
   * Auto-fire, move bullets and resolve collisions.
   * @param {number} dt
   * @param {import('./player.js').Player} player
   * @param {{x:number,y:number}} aim
   * @param {import('./enemies.js').SpatialGrid} grid
   * @param {boolean} [rapid]
   */
  update(dt, player, aim, grid, rapid = false) {
    this.cooldown -= dt;
    if (player.alive && this.cooldown <= 0) this._fireVolley(player, aim, rapid);
    this._updatePlayerBullets(dt, grid);
    this._updateEnemyBullets(dt, player);
  }

  _updatePlayerBullets(dt, grid) {
    const { items } = this.playerPool;
    const world = this.world;
    const margin = WEAPONS.cull.playerMargin;
    for (const bullet of items) {
      if (!bullet.active) continue;
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.life <= 0 || bullet.x < -margin || bullet.y < -margin
        || bullet.x > world.width + margin || bullet.y > world.height + margin) {
        bullet.active = false;
        continue;
      }
      if (!grid) continue;
      const candidates = grid.queryCircle(
        bullet.x,
        bullet.y,
        bullet.radius + WEAPONS.queryMargin,
        this._query,
      );
      for (const enemy of candidates) {
        if (enemy.dead || bullet.hits.includes(enemy.id)) continue;
        if (!circleOverlap(bullet.x, bullet.y, bullet.radius, enemy.x, enemy.y, enemy.radius)) continue;
        bullet.hits.push(enemy.id);
        bullet.hitCount += 1;
        this.callbacks.onEnemyHit?.(enemy, bullet.damage);
        if (bullet.hitCount > bullet.pierce) {
          bullet.active = false;
          break;
        }
      }
    }
  }

  _updateEnemyBullets(dt, player) {
    const { items } = this.enemyPool;
    const world = this.world;
    const margin = WEAPONS.cull.enemyMargin;
    for (const bullet of items) {
      if (!bullet.active) continue;
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.life <= 0 || bullet.x < -margin || bullet.y < -margin
        || bullet.x > world.width + margin || bullet.y > world.height + margin) {
        bullet.active = false;
        continue;
      }
      if (player.alive && circleOverlap(bullet.x, bullet.y, bullet.radius, player.x, player.y, player.radius)) {
        bullet.active = false;
        this.callbacks.onPlayerHit?.(bullet.damage);
      }
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    const d = WEAPONS.draw;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bullet of this.playerPool.items) {
      if (!bullet.active) continue;
      ctx.strokeStyle = bullet.color;
      ctx.lineWidth = d.playerLineWidth;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * d.playerTrail, bullet.y - bullet.vy * d.playerTrail);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.fillStyle = COLORS.white;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, d.playerCoreRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const bullet of this.enemyPool.items) {
      if (!bullet.active) continue;
      ctx.globalAlpha = d.enemyGlowAlpha;
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius + d.enemyGlowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.white;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * d.enemyCoreScale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
