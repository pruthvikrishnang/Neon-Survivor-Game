import { COLORS, GAME, TIME } from '../config.js';

export function onPlayerShoot(game, x, y, angle) {
  const cfg = GAME.bursts.shoot;
  game.audio.shoot();
  game.particles.burst(
    x + Math.cos(angle) * cfg.offset,
    y + Math.sin(angle) * cfg.offset,
    COLORS.cyanBright,
    cfg.count,
    cfg.speed,
    cfg.life,
  );
}

export function onEnemyShoot(game, shot) {
  const cfg = GAME.bursts.enemyShoot;
  game.weapons.fireEnemy(shot);
  game.audio.enemyShoot();
  game.particles.burst(shot.x, shot.y, shot.color, cfg.count, cfg.speed, cfg.life);
}

export function onEnemyHit(game, enemy, damage, meta = {}) {
  const killed = enemy.hp <= damage;
  if (enemy.isBoss) {
    if (game._bossHitGate <= 0) {
      game.timeScale.hitStop(TIME.hitStop.bossHitFrames);
      game._bossHitGate = TIME.hitStop.bossHitCooldown;
    }
    if (killed) game.timeScale.hitStop(TIME.hitStop.bossDeathFrames);
  } else if (killed && enemy.type === 'tank') {
    game.timeScale.hitStop(TIME.hitStop.tankDeathFrames);
  }
  game.particles.damageText(
    enemy.x, enemy.y - enemy.radius, damage,
    meta.crit ? COLORS.white : enemy.color, enemy.isBoss,
  );
  game.enemies.damage(enemy, damage);
  if (meta.burnDps > 0 && !enemy.dead) {
    if (enemy.burnTimer <= 0) enemy.burnTick = 0.25;
    enemy.burnDps = Math.max(enemy.burnDps, meta.burnDps);
    enemy.burnTimer = Math.max(enemy.burnTimer, game.player.stats.burnDuration);
  }
  if (meta.explosionRadius > 0) {
    game.enemies.damageArea(
      enemy.x, enemy.y, meta.explosionRadius, meta.explosionDamage, enemy,
    );
    const cfg = GAME.bursts.explode;
    game.particles.burst(enemy.x, enemy.y, COLORS.amber, cfg.count, cfg.speed, cfg.life);
    game.audio.explode(false);
  }
  game.audio.hit();
}

export function onEnemyDeath(game, enemy) {
  const cfg = GAME.deathBurst;
  if (enemy.isBoss) game.timeScale.slowMotion(TIME.slowMo.bossDeathDuration);
  game.combo = Math.min(GAME.comboLimit, game.combo + 1);
  game.comboTimer = GAME.comboDuration;
  game.score += Math.round(enemy.score * game._multiplier());
  game.shake = Math.max(
    game.shake,
    enemy.isBoss ? GAME.shake.bossDeath : enemy.type === 'tank' ? GAME.shake.tankDeath : GAME.shake.death,
  );
  const count = enemy.isBoss ? cfg.bossCount : enemy.type === 'tank' ? cfg.tankCount : cfg.count;
  game.particles.burst(
    enemy.x,
    enemy.y,
    enemy.color,
    count,
    enemy.isBoss ? cfg.bossSpeed : cfg.speed,
    enemy.isBoss ? cfg.bossLife : cfg.life,
  );
  game.audio.explode(enemy.isBoss);
  if (enemy.isBoss) {
    for (let i = 0; i < cfg.bossGemCount; i += 1) {
      const angle = (i / cfg.bossGemCount) * Math.PI * 2;
      game.gems.spawn(
        enemy.x + Math.cos(angle) * cfg.bossGemRadius,
        enemy.y + Math.sin(angle) * cfg.bossGemRadius,
        cfg.bossGemValue,
      );
    }
  } else {
    game.gems.spawn(enemy.x, enemy.y, enemy.xp);
  }
}

export function onSpawn(game, enemy) {
  game.codex.seeEnemy(enemy.codexId);
}

export function onBossPhase(game, enemy) {
  game.ui.banner('PHASE 2', enemy.name);
  game.audio.boss();
}

export function onExplode(game, x, y, radius, damage, color) {
  if (game.state !== 'playing' || game.upgradeOpen) return;
  const cfg = GAME.bursts.explode;
  game.particles.burst(x, y, color, cfg.count, cfg.speed, cfg.life);
  game.audio.explode(radius > 90);
  const dx = game.player.x - x;
  const dy = game.player.y - y;
  const reach = radius + game.player.radius;
  if (dx * dx + dy * dy <= reach * reach) hurt(game, damage);
}

export function hurt(game, damage) {
  if (game.state !== 'playing' || game.upgradeOpen) return false;
  const applied = game.player.takeDamage(damage);
  if (!applied) return false;
  game.shake = Math.max(game.shake, GAME.shake.hit);
  game.hitFlash = GAME.hitFlashDuration;
  game.audio.hurt();
  const cfg = GAME.bursts.hurt;
  game.particles.burst(game.player.x, game.player.y, COLORS.red, cfg.count, cfg.speed, cfg.life);
  if (!game.player.alive) game.gameOver();
  return true;
}
