import { COLORS, WEAPONS } from '../config.js';
import { circleOverlap } from './grid.js';
import { TrailPool, makePool, obtain } from './pools.js';

const TAU = Math.PI * 2;

/** Pooled bullets, hostile projectiles and orbiting blades. */
export class WeaponSystem {
  constructor(world, callbacks = {}) {
    this.world = world;
    this.callbacks = callbacks;
    this.playerPool = makePool(WEAPONS.pools.player);
    this.enemyPool = makePool(WEAPONS.pools.enemy);
    this.trails = new TrailPool();
    this.cooldown = 0;
    this.orbitAngle = 0;
    this._query = [];
  }

  reset() {
    for (const bullet of this.playerPool.items) bullet.active = false;
    for (const bullet of this.enemyPool.items) bullet.active = false;
    this.trails.reset();
    this.cooldown = 0;
    this.orbitAngle = 0;
  }

  updateTrails(dt) {
    this.trails.update(dt);
  }

  _spawn(pool, x, y, angle, speed, damage, radius, pierce, color, life) {
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
    bullet.trailTimer = 0;
    bullet.life = life;
    bullet.color = color;
    bullet.hits.length = 0;
  }

  _maybeTrail(bullet, dt) {
    bullet.trailTimer -= dt;
    if (bullet.trailTimer <= 0) {
      this.trails.spawn(bullet);
      bullet.trailTimer += WEAPONS.trails.interval;
    }
  }

  fireEnemy(shot) {
    this._spawn(
      this.enemyPool, shot.x, shot.y, shot.angle, shot.speed,
      shot.damage, shot.radius || WEAPONS.bullet.enemyRadius, 0,
      shot.color || WEAPONS.bullet.enemyColor, WEAPONS.bullet.life,
    );
  }

  _fireVolley(player, aim, rapid) {
    const stats = player.stats;
    const baseAngle = Math.atan2(aim.y - player.y, aim.x - player.x);
    for (let i = 0; i < stats.shots; i += 1) {
      const angle = baseAngle + (i - (stats.shots - 1) / 2) * stats.spread;
      const muzzleX = player.x + Math.cos(angle) * stats.muzzleOffset;
      const muzzleY = player.y + Math.sin(angle) * stats.muzzleOffset;
      this._spawn(
        this.playerPool, muzzleX, muzzleY, angle, stats.bulletSpeed,
        stats.damage, stats.bulletRadius, stats.pierce, stats.color, stats.bulletLife,
      );
    }
    this.cooldown = stats.fireInterval * (rapid ? WEAPONS.fire.rapidMultiplier : 1);
    this.callbacks.onShoot?.(player.x, player.y, baseAngle);
  }

  _updateOrbit(dt, player, grid) {
    const stats = player.stats;
    this.orbitAngle = (this.orbitAngle + stats.orbitSpeed * dt) % TAU;
    const count = Math.max(1, stats.orbitCount);
    for (let i = 0; i < count; i += 1) {
      const angle = this.orbitAngle + (i / count) * TAU;
      const x = player.x + Math.cos(angle) * stats.orbitRadius;
      const y = player.y + Math.sin(angle) * stats.orbitRadius;
      const near = grid.queryCircle(x, y, stats.orbitSize + WEAPONS.queryMargin, this._query);
      for (const enemy of near) {
        if (enemy.dead || enemy.orbitCd > 0) continue;
        if (!circleOverlap(x, y, stats.orbitSize, enemy.x, enemy.y, enemy.radius)) continue;
        enemy.orbitCd = stats.orbitHitCooldown;
        const crit = Math.random() < stats.critChance;
        this.callbacks.onEnemyHit?.(enemy, stats.damage * (crit ? stats.critMultiplier : 1), {
          crit, orbit: true, burnDps: 0, explosionRadius: 0, explosionDamage: 0,
        });
      }
    }
  }

  /**
   * Auto-fire, move bullets and resolve collisions.
   * @param {number} dt
   * @param {import('../player.js').Player} player
   * @param {{x:number,y:number}} aim
   * @param {import('../weapons/grid.js').SpatialGrid} grid
   * @param {boolean} [rapid]
   */
  update(dt, player, aim, grid, rapid = false) {
    if (player.alive) {
      if (player.stats.weaponKind === 'orbit') {
        if (grid) this._updateOrbit(dt, player, grid);
      } else {
        this.cooldown -= dt;
        if (this.cooldown <= 0) this._fireVolley(player, aim, rapid);
      }
    }
    this._updatePlayerBullets(dt, grid, player);
    this._updateEnemyBullets(dt, player);
  }

  _updatePlayerBullets(dt, grid, player) {
    const { items } = this.playerPool;
    const world = this.world;
    const margin = WEAPONS.cull.playerMargin;
    const stats = player.stats;
    for (const bullet of items) {
      if (!bullet.active) continue;
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      this._maybeTrail(bullet, dt);
      if (bullet.life <= 0 || bullet.x < -margin || bullet.y < -margin
        || bullet.x > world.width + margin || bullet.y > world.height + margin) {
        bullet.active = false;
        continue;
      }
      if (!grid) continue;
      const candidates = grid.queryCircle(
        bullet.x, bullet.y, bullet.radius + WEAPONS.queryMargin, this._query,
      );
      for (const enemy of candidates) {
        if (enemy.dead || bullet.hits.includes(enemy.id)) continue;
        if (!circleOverlap(bullet.x, bullet.y, bullet.radius, enemy.x, enemy.y, enemy.radius)) continue;
        bullet.hits.push(enemy.id);
        bullet.hitCount += 1;
        const crit = Math.random() < stats.critChance;
        const damage = bullet.damage * (crit ? stats.critMultiplier : 1);
        this.callbacks.onEnemyHit?.(enemy, damage, {
          crit,
          burnDps: stats.burnDps,
          explosionRadius: stats.explosionRadius,
          explosionDamage: bullet.damage * stats.explosionDamage,
        });
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
      this._maybeTrail(bullet, dt);
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

  /** @param {CanvasRenderingContext2D} ctx @param {object} [player] */
  draw(ctx, player = null) {
    const d = WEAPONS.draw;
    this.trails.draw(ctx);
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
      ctx.arc(bullet.x, bullet.y, d.playerCoreRadius, 0, TAU);
      ctx.fill();
    }
    for (const bullet of this.enemyPool.items) {
      if (!bullet.active) continue;
      ctx.globalAlpha = d.enemyGlowAlpha;
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius + d.enemyGlowRadius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = COLORS.white;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * d.enemyCoreScale, 0, TAU);
      ctx.fill();
    }
    if (player && player.alive && player.stats.weaponKind === 'orbit') this._drawOrbit(ctx, player);
    ctx.restore();
  }

  _drawOrbit(ctx, player) {
    const stats = player.stats;
    const count = Math.max(1, stats.orbitCount);
    const d = WEAPONS.draw;
    for (let i = 0; i < count; i += 1) {
      const angle = this.orbitAngle + (i / count) * TAU;
      const x = player.x + Math.cos(angle) * stats.orbitRadius;
      const y = player.y + Math.sin(angle) * stats.orbitRadius;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.shadowColor = stats.color;
      ctx.shadowBlur = d.bladeGlow;
      ctx.fillStyle = stats.color;
      ctx.beginPath();
      ctx.moveTo(0, -stats.orbitSize);
      ctx.lineTo(stats.orbitSize * 0.65, stats.orbitSize * 0.8);
      ctx.lineTo(-stats.orbitSize * 0.65, stats.orbitSize * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
