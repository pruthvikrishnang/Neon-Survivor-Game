import { ENEMIES } from '../config.js';

const TAU = Math.PI * 2;

function fireBossPattern(manager, enemy, pattern, phase2) {
  const count = phase2 ? pattern.phaseCount : pattern.count;
  const speed = phase2 ? pattern.phaseSpeed : pattern.speed;
  const damage = enemy.shotDamage * pattern.damageMul;
  for (let i = 0; i < count; i += 1) {
    let angle;
    if (pattern.kind === 'radial') {
      angle = (i / count) * TAU + manager.time * pattern.spin;
    } else if (pattern.kind === 'aimedFan') {
      const step = phase2 ? pattern.phaseStep : pattern.step;
      angle = enemy.angle + (i - (count - 1) / 2) * step;
    } else {
      const step = phase2 ? pattern.phaseStep : pattern.step;
      angle = enemy.angle + manager.time * pattern.spin + i * step;
    }
    manager.handlers.onShoot?.({
      x: enemy.x, y: enemy.y, angle, speed, damage,
      radius: pattern.radius, color: pattern.color,
    });
  }
}

export function updateBoss(manager, enemy, dt, player, dist) {
  const cfg = enemy.bossConfig;
  const phase2 = enemy.phase >= 2;
  const speed = enemy.speed * (phase2 ? cfg.enragedSpeed : 1);
  const nx = (player.x - enemy.x) / dist;
  const ny = (player.y - enemy.y) / dist;
  if (dist > cfg.far || dist < cfg.near) {
    const sign = dist > cfg.far ? 1 : -1;
    enemy.x += nx * speed * dt * sign;
    enemy.y += ny * speed * dt * sign;
  } else {
    enemy.x += -ny * enemy.strafe * speed * cfg.strafe * dt;
    enemy.y += nx * enemy.strafe * speed * cfg.strafe * dt;
  }

  if (!phase2 && enemy.hp / enemy.maxHp < ENEMIES.boss.phaseThreshold) {
    enemy.phase = 2;
    manager.handlers.onBossPhase?.(enemy);
  }

  enemy.attackTimer -= dt;
  if (enemy.attackTimer > 0) return;
  fireBossPattern(manager, enemy, cfg.patterns[enemy.pattern], phase2);
  enemy.pattern = (enemy.pattern + 1) % cfg.patterns.length;
  const base = phase2 ? cfg.attackPhase : cfg.attackBase;
  enemy.attackTimer = Math.max(cfg.attackMin, base - manager.wave * cfg.attackPerWave);
}
