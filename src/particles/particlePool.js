import { PARTICLES } from '../config.js';

const TAU = Math.PI * 2;

function makeParticle() {
  return {
    active: false, kind: 0, big: false, text: '',
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
    size: PARTICLES.defaults.size,
    drag: PARTICLES.defaults.drag,
    color: PARTICLES.defaults.color,
  };
}

/** Fixed-size particle pool. Oldest particles are recycled when full. */
export class ParticlePool {
  constructor(capacity = PARTICLES.poolSize) {
    this.items = Array.from({ length: capacity }, makeParticle);
    this.cursor = 0;
  }

  reset() {
    for (const p of this.items) p.active = false;
  }

  burst(x, y, color, count, speed = PARTICLES.burst.speed, life = PARTICLES.burst.life) {
    const cfg = PARTICLES.burst;
    for (let i = 0; i < count; i += 1) {
      const p = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.items.length;
      const angle = Math.random() * TAU;
      const velocity = speed * (cfg.speedMin + Math.random() * cfg.speedSpread);
      p.active = true;
      p.kind = 0;
      p.text = '';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * velocity;
      p.vy = Math.sin(angle) * velocity;
      p.life = life * (cfg.lifeMin + Math.random() * cfg.lifeSpread);
      p.maxLife = p.life;
      p.size = cfg.sizeBase + Math.random() * cfg.sizeSpread;
      p.drag = cfg.dragBase + Math.random() * cfg.dragSpread;
      p.color = color;
    }
  }

  damageText(x, y, amount, color, big = false) {
    const cfg = PARTICLES.damage;
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    p.active = true;
    p.kind = 1;
    p.big = big;
    p.text = Math.max(1, Math.round(amount)).toString();
    p.x = x;
    p.y = y;
    p.vx = (Math.random() * 2 - 1) * cfg.drift;
    p.vy = -cfg.riseSpeed * (0.85 + Math.random() * 0.3);
    p.life = cfg.life;
    p.maxLife = cfg.life;
    p.drag = cfg.drag;
    p.color = color;
  }

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

  draw(ctx) {
    const burst = PARTICLES.burst;
    const damage = PARTICLES.damage;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.items) {
      if (!p.active || p.kind !== 0) continue;
      const ratio = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, ratio * burst.alphaScale);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * burst.trail, p.y - p.vy * burst.trail);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * ratio, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = damage.shadowBlur;
    for (const p of this.items) {
      if (!p.active || p.kind !== 1) continue;
      const ratio = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, ratio * damage.alphaScale);
      ctx.font = p.big ? damage.fontBig : damage.font;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }
}
