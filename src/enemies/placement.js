import { ENEMIES } from '../config.js';

export function pickSpawn(width, height, player) {
  const cfg = ENEMIES.spawn;
  const safeSq = cfg.safeDistance * cfg.safeDistance;
  let bestX = cfg.margin;
  let bestY = cfg.margin;
  let bestDist = -1;
  for (let i = 0; i < cfg.attempts; i += 1) {
    const edge = Math.floor(Math.random() * 4);
    const t = Math.random();
    const x = edge < 2
      ? cfg.margin + t * (width - cfg.margin * 2)
      : (edge === 2 ? cfg.margin : width - cfg.margin);
    const y = edge >= 2
      ? cfg.margin + t * (height - cfg.margin * 2)
      : (edge === 0 ? cfg.margin : height - cfg.margin);
    const dist = (x - player.x) ** 2 + (y - player.y) ** 2;
    if (dist > bestDist) {
      bestDist = dist;
      bestX = x;
      bestY = y;
    }
  }
  if (bestDist < safeSq) {
    const corners = [
      [cfg.margin, cfg.margin],
      [width - cfg.margin, cfg.margin],
      [cfg.margin, height - cfg.margin],
      [width - cfg.margin, height - cfg.margin],
    ];
    for (const [x, y] of corners) {
      const dist = (x - player.x) ** 2 + (y - player.y) ** 2;
      if (dist > bestDist) {
        bestDist = dist;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { x: bestX, y: bestY };
}

export function pickBossSpawn(width, height, player) {
  const x = width / 2;
  const y = height * ENEMIES.boss.spawnY;
  const safe = ENEMIES.spawn.safeDistance;
  if ((x - player.x) ** 2 + (y - player.y) ** 2 >= safe * safe) return { x, y };
  return pickSpawn(width, height, player);
}
