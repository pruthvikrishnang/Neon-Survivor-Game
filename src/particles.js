import { COLORS, PARTICLES } from './config.js';

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
  /** @param {number} capacity */
  constructor(capacity = PARTICLES.poolSize) {
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

  /**
   * Reuse the particle pool for a floating damage number.
   * @param {number} x @param {number} y @param {number} amount
   * @param {string} color @param {boolean} [big]
   */
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

function makeGem() {
  return { active: false, x: 0, y: 0, value: 1, phase: 0 };
}

/** Pooled XP gems with magnet attraction and collection. */
export class GemPool {
  /** @param {number} capacity */
  constructor(capacity = PARTICLES.gemPoolSize) {
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

  /** @param {CanvasRenderingContext2D} ctx @param {number} time */
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
  const cfg = PARTICLES.enemyDraw;
  const color = enemy.hitFlash > 0 ? COLORS.white : enemy.color;
  const flash = enemy.hitFlash > 0;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.globalAlpha = cfg.glowAlpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius + cfg.glowRadius, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;

  if (enemy.type === 'chaser' || enemy.type === 'mini') {
    const s = enemy.radius;
    ctx.rotate(enemy.angle);
    ctx.beginPath();
    ctx.moveTo(s * cfg.chaserNose, 0);
    ctx.lineTo(-s, s * cfg.chaserBack);
    ctx.lineTo(-s * cfg.chaserNotch, 0);
    ctx.lineTo(-s, -s * cfg.chaserBack);
    ctx.closePath();
    ctx.fillStyle = flash ? COLORS.white : COLORS.redSoft;
    ctx.fill();
    ctx.lineWidth = cfg.lineWidth;
    ctx.stroke();
  } else if (enemy.type === 'shooter') {
    ctx.rotate(enemy.angle);
    const s = enemy.radius;
    ctx.beginPath();
    ctx.moveTo(s * cfg.shooterNose, 0);
    ctx.lineTo(0, s * cfg.shooterSide);
    ctx.lineTo(-s, 0);
    ctx.lineTo(0, -s * cfg.shooterSide);
    ctx.closePath();
    ctx.fillStyle = flash ? COLORS.white : COLORS.amberSoft;
    ctx.fill();
    ctx.lineWidth = cfg.lineWidth;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(
      0,
      -cfg.shooterBarrelOffset,
      s * cfg.shooterBarrel,
      cfg.shooterBarrelHeight,
    );
  } else if (enemy.type === 'tank') {
    ctx.rotate(time * cfg.tankRotate);
    poly(ctx, 6, enemy.radius);
    ctx.fillStyle = flash ? COLORS.white : COLORS.violetSoft;
    ctx.fill();
    ctx.lineWidth = cfg.tankLineWidth;
    ctx.stroke();
    poly(ctx, 3, enemy.radius * cfg.tankInnerScale, time * cfg.tankInnerRotate);
    ctx.lineWidth = cfg.tankInnerLineWidth;
    ctx.stroke();
  } else {
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = cfg.bossGlowBlur;
    poly(ctx, 6, enemy.radius, time * cfg.bossRotate);
    ctx.fillStyle = flash ? COLORS.white : COLORS.bossSoft;
    ctx.fill();
    ctx.lineWidth = cfg.tankLineWidth;
    ctx.stroke();
    ctx.shadowBlur = 0;
    for (let i = 0; i < cfg.bossRings; i += 1) {
      const start = time * (cfg.bossRingSpeedBase + i * cfg.bossRingSpeedStep)
        + i * cfg.bossRingPhaseStep;
      ctx.globalAlpha = cfg.bossRingAlpha - i * cfg.bossRingAlphaStep;
      ctx.lineWidth = cfg.lineWidth;
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        enemy.radius + cfg.bossRingRadius + i * cfg.bossRingGap,
        start,
        start + cfg.bossRingArc,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = flash ? COLORS.white : color;
    ctx.beginPath();
    ctx.arc(0, 0, cfg.bossCoreRadius + Math.sin(time * cfg.bossCoreSpeed) * cfg.bossCoreWave, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  if (enemy.type === 'tank' && enemy.hp < enemy.maxHp) {
    const pct = enemy.hp / enemy.maxHp;
    ctx.fillStyle = COLORS.tankHpBack;
    ctx.fillRect(
      enemy.x - cfg.hpBarOffset,
      enemy.y - enemy.radius - cfg.hpBarGap,
      cfg.hpBarWidth,
      cfg.hpBarHeight,
    );
    ctx.fillStyle = enemy.color;
    ctx.fillRect(
      enemy.x - cfg.hpBarOffset,
      enemy.y - enemy.radius - cfg.hpBarGap,
      cfg.hpBarWidth * pct,
      cfg.hpBarHeight,
    );
  }
}
