import { COLORS, PARTICLES } from '../config.js';

const TAU = Math.PI * 2;

export function poly(ctx, sides, radius, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * TAU;
    if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
}

export function drawChaser(ctx, enemy, flash) {
  const cfg = PARTICLES.enemyDraw;
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
}

export function drawShooter(ctx, enemy, flash) {
  const cfg = PARTICLES.enemyDraw;
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
  ctx.fillStyle = enemy.color;
  ctx.fillRect(0, -cfg.shooterBarrelOffset, s * cfg.shooterBarrel, cfg.shooterBarrelHeight);
}

export function drawTank(ctx, enemy, time, flash) {
  const cfg = PARTICLES.enemyDraw;
  ctx.rotate(time * cfg.tankRotate);
  poly(ctx, 6, enemy.radius);
  ctx.fillStyle = flash ? COLORS.white : COLORS.violetSoft;
  ctx.fill();
  ctx.lineWidth = cfg.tankLineWidth;
  ctx.stroke();
  poly(ctx, 3, enemy.radius * cfg.tankInnerScale, time * cfg.tankInnerRotate);
  ctx.lineWidth = cfg.tankInnerLineWidth;
  ctx.stroke();
}

export function drawDasher(ctx, enemy, time, flash) {
  const cfg = PARTICLES.enemyDraw;
  const s = enemy.radius;
  const charging = enemy.dashState === 'charge';
  const winding = enemy.dashState === 'windup';
  ctx.rotate(enemy.angle);
  if (winding) {
    ctx.globalAlpha = 0.35 + Math.sin(time * 18) * 0.2;
    ctx.strokeStyle = COLORS.cyanBright;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(enemy.dashRange || 180, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.moveTo(s * (charging ? 1.9 : cfg.dasherNose), 0);
  ctx.lineTo(-s * cfg.dasherBack, s * cfg.dasherWing);
  ctx.lineTo(-s * 0.35, 0);
  ctx.lineTo(-s * cfg.dasherBack, -s * cfg.dasherWing);
  ctx.closePath();
  ctx.fillStyle = flash ? COLORS.white : COLORS.cyanSoft;
  ctx.fill();
  ctx.lineWidth = cfg.lineWidth;
  ctx.strokeStyle = charging ? COLORS.white : enemy.color;
  ctx.stroke();
  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.24, 0, TAU);
  ctx.fill();
}

export function drawBomber(ctx, enemy, time, flash) {
  const cfg = PARTICLES.enemyDraw;
  const s = enemy.radius;
  const fusing = enemy.fuseTimer > 0;
  const pulse = 0.5 + Math.sin(time * (fusing ? cfg.bomberFuseSpeed : 5)) * 0.5;
  ctx.rotate(time * 0.9);
  poly(ctx, cfg.bomberSegments, s);
  ctx.fillStyle = flash ? COLORS.white : COLORS.amberSoft;
  ctx.fill();
  ctx.lineWidth = cfg.lineWidth;
  ctx.strokeStyle = fusing ? COLORS.white : enemy.color;
  ctx.stroke();
  ctx.globalAlpha = fusing ? 0.55 + pulse * 0.45 : 0.75;
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = cfg.lineWidth;
  ctx.beginPath();
  ctx.arc(0, 0, s * (cfg.bomberInner + pulse * 0.18), 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = fusing ? COLORS.white : COLORS.amber;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.18, 0, TAU);
  ctx.fill();
}

export function drawSummoner(ctx, enemy, time, flash) {
  const cfg = PARTICLES.enemyDraw;
  const s = enemy.radius;
  ctx.rotate(-time * 0.6);
  poly(ctx, 8, s, Math.PI / 8);
  ctx.fillStyle = flash ? COLORS.white : COLORS.violetSoft;
  ctx.fill();
  ctx.lineWidth = cfg.lineWidth;
  ctx.stroke();
  for (let i = 0; i < cfg.summonerRings; i += 1) {
    const start = time * (0.8 + i * 0.35) + i * 2.1;
    ctx.globalAlpha = 0.6 - i * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, s + cfg.summonerRingGap * (i + 1), start, start + cfg.summonerRingArc);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  ctx.arc(0, 0, s * cfg.summonerCore, 0, TAU);
  ctx.fill();
}

export function drawBoss(ctx, enemy, time, flash) {
  const cfg = PARTICLES.enemyDraw;
  const rings = enemy.bossKind === 'weaver' ? 4 : enemy.bossKind === 'colossus' ? 2 : 3;
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = cfg.bossGlowBlur;
  poly(ctx, 6, enemy.radius, time * cfg.bossRotate);
  ctx.fillStyle = flash ? COLORS.white : COLORS.bossSoft;
  ctx.fill();
  ctx.lineWidth = cfg.tankLineWidth;
  ctx.stroke();
  ctx.shadowBlur = 0;
  for (let i = 0; i < rings; i += 1) {
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
  ctx.fillStyle = flash ? COLORS.white : enemy.color;
  ctx.beginPath();
  ctx.arc(0, 0, cfg.bossCoreRadius + Math.sin(time * cfg.bossCoreSpeed) * cfg.bossCoreWave, 0, TAU);
  ctx.fill();
}
