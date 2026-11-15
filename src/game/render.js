import { COLORS, GAME, UI, WORLD } from '../config.js';
import { drawReticle } from '../ui.js';

export function renderGame(game, alpha = 1) {
  void alpha;
  const ctx = game.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  ctx.save();
  const sx = (Math.random() * 2 - 1) * game.shake;
  const sy = (Math.random() * 2 - 1) * game.shake;
  ctx.translate(sx, sy);
  ctx.drawImage(game.background, 0, 0);
  game.gems.draw(ctx, game.time);
  game.enemies.draw(ctx, game.time);
  game.weapons.draw(ctx, game.player);
  game.player.draw(ctx, game.time);
  game.particles.draw(ctx);
  if (game.state === 'playing') {
    game.input.drawJoystick(ctx, game.time);
    if (!game.upgradeOpen) {
      if (game.input.aim.active) {
        drawReticle(ctx, game.input.aim.x, game.input.aim.y, COLORS.pinkReticle);
      } else if (!game.input.isTouchMode()) {
        drawReticle(ctx, game.input.mouse.x, game.input.mouse.y, COLORS.cyanReticle);
      }
    }
  }
  ctx.restore();
  ctx.drawImage(game.vignette, 0, 0);
  if (game.state === 'playing' && game.player.alive) {
    const cfg = UI.dangerVignette;
    const hpRatio = game.player.hp / game.player.maxHp;
    if (hpRatio <= cfg.threshold) {
      const urgency = 1 - hpRatio / cfg.threshold;
      const pulse = 0.5 + Math.sin(game.time * cfg.pulseSpeed) * 0.5;
      ctx.save();
      ctx.globalAlpha = (cfg.alphaBase + cfg.alphaPulse * pulse) * (0.5 + urgency * 0.5);
      ctx.drawImage(game.dangerVignette, 0, 0);
      ctx.restore();
    }
  }
  if (game.hitFlash > 0) {
    ctx.fillStyle = `rgba(${COLORS.hitFlashRgb}, ${(game.hitFlash * GAME.hitFlashAlpha).toFixed(3)})`;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
  game.ui.setHud(game);
}
