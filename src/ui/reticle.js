import { UI as UI_CONFIG } from '../config.js';

export function drawReticle(ctx, x, y, color) {
  const cfg = UI_CONFIG.reticle;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = cfg.lineWidth;
  ctx.beginPath();
  ctx.arc(x, y, cfg.radius, 0, Math.PI * 2);
  ctx.moveTo(x - cfg.outer, y);
  ctx.lineTo(x - cfg.inner, y);
  ctx.moveTo(x + cfg.inner, y);
  ctx.lineTo(x + cfg.outer, y);
  ctx.moveTo(x, y - cfg.outer);
  ctx.lineTo(x, y - cfg.inner);
  ctx.moveTo(x, y + cfg.inner);
  ctx.lineTo(x, y + cfg.outer);
  ctx.stroke();
  ctx.restore();
}
