import { COLORS, PARTICLES } from '../config.js';
import {
  drawBomber, drawBoss, drawChaser, drawDasher, drawShooter,
  drawSummoner, drawTank,
} from './enemyShapes.js';

const TAU = Math.PI * 2;

/** Procedural enemy sprite renderer. */
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

  if (enemy.type === 'chaser' || enemy.type === 'mini') drawChaser(ctx, enemy, flash);
  else if (enemy.type === 'shooter') drawShooter(ctx, enemy, flash);
  else if (enemy.type === 'tank') drawTank(ctx, enemy, time, flash);
  else if (enemy.type === 'dasher') drawDasher(ctx, enemy, time, flash);
  else if (enemy.type === 'bomber') drawBomber(ctx, enemy, time, flash);
  else if (enemy.type === 'summoner') drawSummoner(ctx, enemy, time, flash);
  else drawBoss(ctx, enemy, time, flash);
  ctx.restore();

  if (enemy.type !== 'boss' && enemy.hp < enemy.maxHp) {
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
