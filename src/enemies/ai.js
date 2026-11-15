import { ENEMIES } from '../config.js';
import { circleOverlap } from '../weapons.js';
import { updateBoss } from '../bosses/index.js';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

function updateShooter(manager, enemy, dt, player, dist) {
  const cfg = ENEMIES.shooter;
  const nx = (player.x - enemy.x) / dist;
  const ny = (player.y - enemy.y) / dist;
  if (dist > cfg.far || dist < cfg.near) {
    const sign = dist > cfg.far ? 1 : -1;
    enemy.x += nx * enemy.speed * dt * sign;
    enemy.y += ny * enemy.speed * dt * sign;
  } else {
    enemy.x += -ny * enemy.strafe * enemy.speed * cfg.strafe * dt;
    enemy.y += nx * enemy.strafe * enemy.speed * cfg.strafe * dt;
  }
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0 && dist < cfg.fireRange) {
    manager.handlers.onShoot?.({
      x: enemy.x, y: enemy.y, angle: enemy.angle, speed: cfg.bulletSpeed,
      damage: enemy.shotDamage, radius: cfg.bulletRadius, color: cfg.bulletColor,
    });
    enemy.fireTimer = Math.max(cfg.fireMin, cfg.fireBase - manager.wave * cfg.firePerWave);
  }
}

function updateDasher(manager, enemy, dt, player, dist) {
  const cfg = ENEMIES.dasher;
  enemy.dashTimer -= dt;
  if (enemy.dashState === 'windup') {
    if (enemy.dashTimer <= 0) {
      enemy.dashState = 'charge';
      enemy.dashTimer = cfg.chargeTime;
      enemy.dashAngle = enemy.angle;
    }
    return;
  }
  if (enemy.dashState === 'charge') {
    const speed = enemy.speed * cfg.chargeSpeed;
    enemy.x += Math.cos(enemy.dashAngle) * speed * dt;
    enemy.y += Math.sin(enemy.dashAngle) * speed * dt;
    if (enemy.dashTimer <= 0) {
      enemy.dashState = 'recover';
      enemy.dashTimer = cfg.recover;
    }
    return;
  }
  if (enemy.dashState === 'recover') {
    if (enemy.dashTimer <= 0) enemy.dashState = 'idle';
    return;
  }
  const speed = enemy.speed * cfg.idleSpeed;
  enemy.x += Math.cos(enemy.angle) * speed * dt;
  enemy.y += Math.sin(enemy.angle) * speed * dt;
  if (dist < cfg.triggerRange && enemy.dashTimer <= 0) {
    enemy.dashState = 'windup';
    enemy.dashTimer = cfg.windup;
    enemy.dashRange = Math.min(cfg.triggerRange, dist + 120);
  }
}

function updateBomber(manager, enemy, dt, player, dist) {
  const cfg = ENEMIES.bomber;
  if (enemy.fuseTimer > 0) {
    enemy.fuseTimer -= dt;
    if (enemy.fuseTimer <= 0 && !enemy.exploding) {
      enemy.exploding = true;
      manager.damage(enemy, enemy.hp);
      manager.handlers.onExplode?.(
        enemy.x, enemy.y, cfg.radius, enemy.damage * cfg.damageMul, enemy.color,
      );
    }
    return;
  }
  const speed = enemy.speed * cfg.speedMul;
  enemy.x += Math.cos(enemy.angle) * speed * dt;
  enemy.y += Math.sin(enemy.angle) * speed * dt;
  if (dist < cfg.triggerRange) enemy.fuseTimer = cfg.fuse;
}

function updateSummoner(manager, enemy, dt, player, dist) {
  const cfg = ENEMIES.summoner;
  const nx = (player.x - enemy.x) / dist;
  const ny = (player.y - enemy.y) / dist;
  if (dist < cfg.near) {
    enemy.x -= nx * enemy.speed * 1.15 * dt;
    enemy.y -= ny * enemy.speed * 1.15 * dt;
  } else if (dist > cfg.far) {
    enemy.x += nx * enemy.speed * dt;
    enemy.y += ny * enemy.speed * dt;
  } else {
    enemy.x += -ny * enemy.strafe * enemy.speed * cfg.strafe * dt;
    enemy.y += nx * enemy.strafe * enemy.speed * cfg.strafe * dt;
  }
  enemy.summonTimer -= dt;
  if (enemy.summonTimer > 0) return;
  const room = Math.max(0, cfg.maxMinions - manager.countType('mini'));
  const count = Math.min(cfg.count, room);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / Math.max(1, count)) * Math.PI * 2 + manager.time;
    manager.spawn('mini', player, enemy.x + Math.cos(angle) * cfg.offset, enemy.y + Math.sin(angle) * cfg.offset);
  }
  enemy.summonTimer = Math.max(cfg.summonMin, cfg.summonBase - manager.wave * cfg.summonPerWave);
}

export function updateEnemy(manager, enemy, dt, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.angle = Math.atan2(dy, dx);
  if (enemy.type === 'shooter') updateShooter(manager, enemy, dt, player, dist);
  else if (enemy.type === 'boss') updateBoss(manager, enemy, dt, player, dist);
  else if (enemy.type === 'dasher') updateDasher(manager, enemy, dt, player, dist);
  else if (enemy.type === 'bomber') updateBomber(manager, enemy, dt, player, dist);
  else if (enemy.type === 'summoner') updateSummoner(manager, enemy, dt, player, dist);
  else {
    const wobble = enemy.type === 'chaser'
      ? Math.sin(manager.time * ENEMIES.wobbleSpeed + enemy.id) * ENEMIES.wobbleAmplitude
      : 0;
    enemy.x += Math.cos(enemy.angle + wobble) * enemy.speed * dt;
    enemy.y += Math.sin(enemy.angle + wobble) * enemy.speed * dt;
  }
  if (enemy.dead) return;
  enemy.x = clamp(enemy.x, enemy.radius, manager.width - enemy.radius);
  enemy.y = clamp(enemy.y, enemy.radius, manager.height - enemy.radius);
  if (!player.alive || enemy.contactCd > 0) return;
  if (!circleOverlap(enemy.x, enemy.y, enemy.radius, player.x, player.y, player.radius)) return;
  const charge = enemy.type === 'dasher' && enemy.dashState === 'charge'
    ? ENEMIES.contact.dasherChargeMul
    : 1;
  const applied = manager.handlers.onContact?.(enemy.damage * charge, enemy);
  enemy.contactCd = enemy.isBoss ? ENEMIES.contact.bossCooldown : ENEMIES.contact.cooldown;
  if (applied && !enemy.isBoss) {
    enemy.x -= Math.cos(enemy.angle) * ENEMIES.contact.knockback;
    enemy.y -= Math.sin(enemy.angle) * ENEMIES.contact.knockback;
  }
}
