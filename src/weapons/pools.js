import { WEAPONS } from '../config.js';

export function makePool(size) {
  const items = Array.from({ length: size }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0,
    radius: WEAPONS.bullet.playerRadius, damage: 0,
    pierce: 0, hitCount: 0, life: 0, trailTimer: 0,
    color: WEAPONS.bullet.playerColor, hits: [],
  }));
  return { items, cursor: 0 };
}

function makeTrail() {
  return {
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
    color: WEAPONS.bullet.playerColor,
  };
}

/** Fixed-size visual bullet trail pool; recycles the oldest segment. */
export class TrailPool {
  constructor(capacity = WEAPONS.trails.poolSize) {
    this.items = Array.from({ length: capacity }, makeTrail);
    this.cursor = 0;
  }

  reset() {
    for (const trail of this.items) trail.active = false;
  }

  spawn(bullet) {
    const cfg = WEAPONS.trails;
    const trail = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    trail.active = true;
    trail.x = bullet.x;
    trail.y = bullet.y;
    trail.vx = bullet.vx;
    trail.vy = bullet.vy;
    trail.life = cfg.life;
    trail.maxLife = cfg.life;
    trail.color = bullet.color;
  }

  update(dt) {
    for (const trail of this.items) {
      if (!trail.active) continue;
      trail.life -= dt;
      if (trail.life <= 0) trail.active = false;
    }
  }

  draw(ctx) {
    const cfg = WEAPONS.trails;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const trail of this.items) {
      if (!trail.active) continue;
      const ratio = trail.life / trail.maxLife;
      ctx.globalAlpha = ratio * cfg.alpha;
      ctx.strokeStyle = trail.color;
      ctx.lineWidth = cfg.width * ratio;
      ctx.beginPath();
      ctx.moveTo(trail.x - trail.vx * cfg.length, trail.y - trail.vy * cfg.length);
      ctx.lineTo(trail.x, trail.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function obtain(pool) {
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
