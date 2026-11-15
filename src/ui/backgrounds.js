import { COLORS, UI as UI_CONFIG } from '../config.js';

export function createArenaBackground(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const cfg = UI_CONFIG.arena;
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, cfg.glowNear,
    width / 2, height / 2, width * cfg.glowRadiusFactor,
  );
  gradient.addColorStop(0, COLORS.bgInner);
  gradient.addColorStop(cfg.gradientMidStop, COLORS.bgMid);
  gradient.addColorStop(cfg.gradientOuterStop, COLORS.bgOuter);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += cfg.gridStep) {
    ctx.strokeStyle = x % cfg.majorEvery === 0 ? COLORS.cyanGridMajor : COLORS.cyanGridMinor;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += cfg.gridStep) {
    ctx.strokeStyle = y % cfg.majorEvery === 0 ? COLORS.pinkGridMajor : COLORS.cyanGridMinor;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = COLORS.cyanBorder;
  ctx.lineWidth = cfg.borderWidth;
  ctx.strokeRect(
    cfg.borderInset,
    cfg.borderInset,
    width - cfg.borderInset * 2,
    height - cfg.borderInset * 2,
  );
  ctx.strokeStyle = COLORS.pinkBorder;
  ctx.lineWidth = cfg.outerWidth;
  ctx.strokeRect(
    cfg.outerInset,
    cfg.outerInset,
    width - cfg.outerInset * 2,
    height - cfg.outerInset * 2,
  );
  return canvas;
}

export function createVignette(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const cfg = UI_CONFIG.vignette;
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, height * cfg.innerFactor,
    width / 2, height / 2, width * cfg.outerFactor,
  );
  gradient.addColorStop(0, COLORS.vignetteClear);
  gradient.addColorStop(1, COLORS.vignetteEdge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

export function createDangerVignette(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const cfg = UI_CONFIG.dangerVignette;
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, height * cfg.innerFactor,
    width / 2, height / 2, width * cfg.outerFactor,
  );
  gradient.addColorStop(0, COLORS.dangerVignetteClear);
  gradient.addColorStop(1, COLORS.dangerVignetteEdge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}
