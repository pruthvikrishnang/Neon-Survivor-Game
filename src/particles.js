const TAU = Math.PI * 2;

function makeParticle() {
  return {
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
    size: 2, drag: 2.5, color: '#51f6ff',
  };
}

/** Fixed-size particle pool. Oldest particles are recycled when full. */
export class ParticlePool {
  /** @param {number} capacity */
  constructor(capacity = 900) {
    this.items = Array.from({ length: capacity }, makeParticle);
    this.cursor = 0;
  }

  reset() {
    for (const p of this.items) p.active = false;
  }

  /**
   * @param {number} x @param {number} y @param {string} color
   * @param {number} count @param {number} speed @param {number} life
   */
  burst(x, y, color, count, speed = 190, life = 0.55) {
    for (let i = 0; i < count; i += 1) {
      const p = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.items.length;
      const angle = Math.random() * TAU;
      const velocity = speed * (0.35 + Math.random() * 0.9);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * velocity;
      p.vy = Math.sin(angle) * velocity;
      p.life = life * (0.6 + Math.random() * 0.7);
      p.maxLife = p.life;
      p.size = 1.5 + Math.random() * 2.6;
      p.drag = 2.2 + Math.random() * 2;
      p.color = color;
    }
  }

  /** @param {number} dt */
  update(dt) {
    for (const p of this.items) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.items) {
      if (!p.active) continue;
      const ratio = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, ratio * 1.4);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * ratio, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function makeGem() {
  return { active: false, x: 0, y: 0, value: 1, phase: 0 };
}

/** Pooled XP gems with magnet attraction and collection. */
export class GemPool {
  /** @param {number} capacity */
  constructor(capacity = 320) {
    this.items = Array.from({ length: capacity }, makeGem);
    this.cursor = 0;
  }

  reset() {
    for (const gem of this.items) gem.active = false;
  }

  /** @param {number} x @param {number} y @param {number} value */
  spawn(x, y, value) {
    const gem = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    gem.active = true;
    gem.x = x;
    gem.y = y;
    gem.value = value;
    gem.phase = Math.random() * TAU;
  }

  /**
   * Attract and collect gems. Returns XP gathered this frame.
   * @param {number} dt @param {import('./player.js').Player} player
   * @returns {number}
   */
  update(dt, player) {
    let collected = 0;
    const magnet = player.stats.magnet;
    for (const gem of this.items) {
      if (!gem.active) continue;
      const dx = player.x - gem.x;
      const dy = player.y - gem.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist < magnet) {
        const pull = 260 + (1 - dist / magnet) * 620;
        gem.x += (dx / dist) * pull * dt;
        gem.y += (dy / dist) * pull * dt;
      }
      if (dist < player.radius + 12) {
        gem.active = false;
        collected += gem.value;
      }
    }
    return collected;
  }

  /** @param {CanvasRenderingContext2D} ctx @param {number} time */
  draw(ctx, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const gem of this.items) {
      if (!gem.active) continue;
      const big = gem.value >= 10;
      const color = gem.value >= 10 ? '#ffb340' : gem.value >= 5 ? '#ff3bd4' : gem.value >= 2 ? '#8dff6e' : '#51f6ff';
      const size = big ? 11 : gem.value >= 5 ? 8 : gem.value >= 2 ? 6.5 : 5;
      const bob = Math.sin(time * 4 + gem.phase) * 1.6;
      ctx.save();
      ctx.translate(gem.x, gem.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      ctx.fillRect(-size - 3, -size - 3, (size + 3) * 2, (size + 3) * 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-size / 5, -size / 5, size * 0.4, size * 0.4);
      ctx.restore();
    }
    ctx.restore();
  }
}

function poly(ctx, sides, radius, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * TAU;
    if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
}

/**
 * Procedural enemy sprite renderer (kept here with the other canvas FX helpers
 * so enemy logic stays focused on simulation).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} enemy
 * @param {number} time
 */
export function drawEnemy(ctx, enemy, time) {
  const color = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
  const flash = enemy.hitFlash > 0;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius + 7, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;

  if (enemy.type === 'chaser' || enemy.type === 'mini') {
    const s = enemy.radius;
    ctx.rotate(enemy.angle);
    ctx.beginPath();
    ctx.moveTo(s * 1.4, 0);
    ctx.lineTo(-s, s * 0.85);
    ctx.lineTo(-s * 0.45, 0);
    ctx.lineTo(-s, -s * 0.85);
    ctx.closePath();
    ctx.fillStyle = flash ? '#ffffff' : 'rgba(255, 59, 107, 0.18)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (enemy.type === 'shooter') {
    ctx.rotate(enemy.angle);
    const s = enemy.radius;
    ctx.beginPath();
    ctx.moveTo(s * 1.25, 0);
    ctx.lineTo(0, s * 0.9);
    ctx.lineTo(-s, 0);
    ctx.lineTo(0, -s * 0.9);
    ctx.closePath();
    ctx.fillStyle = flash ? '#ffffff' : 'rgba(255, 179, 64, 0.16)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(0, -3, s * 1.1, 6);
  } else if (enemy.type === 'tank') {
    ctx.rotate(time * 0.4);
    poly(ctx, 6, enemy.radius);
    ctx.fillStyle = flash ? '#ffffff' : 'rgba(180, 92, 255, 0.17)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    poly(ctx, 3, enemy.radius * 0.5, -time * 0.8);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = 26;
    poly(ctx, 6, enemy.radius, time * 0.2);
    ctx.fillStyle = flash ? '#ffffff' : 'rgba(255, 43, 214, 0.16)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i += 1) {
      const start = time * (0.6 + i * 0.3) + i * 2;
      ctx.globalAlpha = 0.5 - i * 0.1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 12 + i * 9, start, start + 2.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = flash ? '#ffffff' : color;
    ctx.beginPath();
    ctx.arc(0, 0, 17 + Math.sin(time * 6) * 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  if (enemy.type === 'tank' && enemy.hp < enemy.maxHp) {
    const pct = enemy.hp / enemy.maxHp;
    ctx.fillStyle = 'rgba(4, 8, 18, 0.8)';
    ctx.fillRect(enemy.x - 23, enemy.y - enemy.radius - 13, 46, 5);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x - 23, enemy.y - enemy.radius - 13, 46 * pct, 5);
  }
}
