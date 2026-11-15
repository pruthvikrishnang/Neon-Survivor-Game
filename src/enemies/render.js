import { ENEMIES } from '../config.js';
import { drawEnemy } from '../particles.js';
import { ENEMY_TYPES } from './waves.js';

const TAU = Math.PI * 2;

function drawTelegraph(ctx, telegraph, time) {
  const cfg = ENEMIES.telegraph;
  const base = ENEMY_TYPES[telegraph.type];
  if (!base) return;
  const pulse = 0.5 + Math.sin(time * cfg.pulseSpeed + telegraph.phase) * 0.5;
  const radius = base.radius + cfg.radiusPad;
  ctx.save();
  ctx.translate(telegraph.x, telegraph.y);
  ctx.strokeStyle = base.color;
  ctx.fillStyle = base.color;
  ctx.lineWidth = cfg.lineWidth;
  ctx.globalAlpha = cfg.alphaBase + pulse * cfg.alphaPulse;
  ctx.beginPath();
  ctx.arc(0, 0, radius + radius * cfg.pulseScale * pulse, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-cfg.tickLength, 0);
  ctx.lineTo(cfg.tickLength, 0);
  ctx.moveTo(0, -cfg.tickLength);
  ctx.lineTo(0, cfg.tickLength);
  ctx.stroke();
  ctx.globalAlpha = cfg.fillAlpha;
  ctx.beginPath();
  ctx.arc(0, 0, cfg.coreRadius + pulse * cfg.coreRadius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawEnemies(manager, ctx, time) {
  for (const telegraph of manager.telegraphs) {
    if (telegraph.active) drawTelegraph(ctx, telegraph, time);
  }
  for (const enemy of manager.enemies) if (!enemy.dead) drawEnemy(ctx, enemy, time);
}
