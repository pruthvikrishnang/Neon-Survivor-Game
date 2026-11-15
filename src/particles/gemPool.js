import { COLORS, PARTICLES } from '../config.js';

const TAU = Math.PI * 2;

function makeGem() {
  return { active: false, x: 0, y: 0, value: 1, phase: 0 };
}

/** Pooled XP gems with magnet attraction and collection. */
export class GemPool {
  constructor(capacity = PARTICLES.gemPoolSize) {
    this.items = Array.from({ length: capacity }, makeGem);
    this.cursor = 0;
  }

  reset() {
    for (const gem of this.items) gem.active = false;
  }

  spawn(x, y, value) {
    const gem = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    gem.active = true;
    gem.x = x;
    gem.y = y;
    gem.value = value;
    gem.phase = Math.random() * TAU;
  }

  update(dt, player) {
    let collected = 0;
    const magnet = player.stats.magnet;
    const cfg = PARTICLES.gem;
    for (const gem of this.items) {
      if (!gem.active) continue;
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist < magnet) {
        const pull = cfg.pullBase + (1 - dist / magnet) * cfg.pullBoost;
        gem.x += (dx / dist) * pull * dt;
        gem.y += (dy / dist) * pull * dt;
      }
      if (dist < player.radius + cfg.collectPad) {
        gem.active = false;
        collected += gem.value;
      }
    }
    return collected;
  }

  draw(ctx, time) {
    const cfg = PARTICLES.gem;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const gem of this.items) {
      if (!gem.active) continue;
      const big = gem.value >= cfg.thresholds.amber;
      const color = big
        ? COLORS.amber
        : gem.value >= cfg.thresholds.pink
          ? COLORS.pink
          : gem.value >= cfg.thresholds.green ? COLORS.green : COLORS.cyan;
      const size = big
        ? cfg.sizes.amber
        : gem.value >= cfg.thresholds.pink
          ? cfg.sizes.pink
          : gem.value >= cfg.thresholds.green ? cfg.sizes.green : cfg.sizes.cyan;
      const bob = Math.sin(time * cfg.bobSpeed + gem.phase) * cfg.bobAmount;
      ctx.save();
      ctx.translate(gem.x, gem.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      ctx.fillRect(
        -size - cfg.glowInset,
        -size - cfg.glowInset,
        (size + cfg.glowInset) * 2,
        (size + cfg.glowInset) * 2,
      );
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(
        -size * cfg.innerInset,
        -size * cfg.innerInset,
        size * cfg.innerScale,
        size * cfg.innerScale,
      );
      ctx.restore();
    }
    ctx.restore();
  }
}
