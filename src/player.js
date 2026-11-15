import { COLORS, DASH, PLAYER } from './config.js';

export const BASE_STATS = PLAYER.baseStats;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** The player ship: movement, aiming, health, XP and stacking upgrades. */
export class Player {
  /**
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  constructor(worldWidth, worldHeight) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.radius = PLAYER.radius;
    this.upgrades = {};
    this.reset();
  }

  reset() {
    this.x = this.worldWidth / 2;
    this.y = this.worldHeight / 2;
    this.aimAngle = 0;
    this.vx = 0;
    this.vy = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = PLAYER.xpStart;
    this.invuln = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashX = 0;
    this.dashY = 0;
    this.hp = PLAYER.baseStats.maxHp;
    this.maxHp = PLAYER.baseStats.maxHp;
    this.upgrades = {
      fireRate: 0, damage: 0, multishot: 0, pierce: 0,
      speed: 0, maxHp: 0, magnet: 0,
    };
    this.recomputeStats();
    this.hp = this.maxHp;
  }

  /** Recalculate derived stats from upgrade levels. Heals when max HP grows. */
  recomputeStats() {
    const u = this.upgrades;
    const previousMax = this.maxHp;
    const base = PLAYER.baseStats;
    const upgrade = PLAYER.upgrades;
    this.stats = {
      damage: base.damage * (1 + upgrade.damagePerLevel * u.damage),
      fireInterval: Math.max(
        upgrade.minFireInterval,
        base.fireInterval * Math.pow(upgrade.fireRateMultiplier, u.fireRate),
      ),
      shots: 1 + u.multishot,
      pierce: u.pierce,
      moveSpeed: base.moveSpeed * (1 + upgrade.speedPerLevel * u.speed),
      maxHp: base.maxHp + upgrade.hpPerLevel * u.maxHp,
      magnet: base.magnet * (1 + upgrade.magnetPerLevel * u.magnet),
      bulletSpeed: base.bulletSpeed,
    };
    this.maxHp = this.stats.maxHp;
    if (this.maxHp > previousMax) this.hp += this.maxHp - previousMax;
    this.hp = Math.min(this.hp, this.maxHp);
  }

  /**
   * Start a dash in the movement direction, or aim direction when stationary.
   * @param {{x:number,y:number}} move
   * @param {{x:number,y:number}} aim
   * @returns {boolean}
   */
  tryDash(move, aim) {
    if (!this.alive || this.dashTimer > 0 || this.dashCooldown > 0) return false;
    let dx = move.x;
    let dy = move.y;
    const length = Math.hypot(dx, dy);
    if (length > DASH.minInput) {
      dx /= length;
      dy /= length;
    } else {
      const aimX = aim.x - this.x;
      const aimY = aim.y - this.y;
      const aimLength = Math.hypot(aimX, aimY);
      if (aimLength > DASH.minInput) {
        dx = aimX / aimLength;
        dy = aimY / aimLength;
      } else {
        dx = Math.cos(this.aimAngle);
        dy = Math.sin(this.aimAngle);
      }
    }
    this.dashX = dx;
    this.dashY = dy;
    this.dashTimer = DASH.duration;
    this.dashCooldown = DASH.cooldown;
    this.invuln = Math.max(this.invuln, DASH.duration);
    return true;
  }

  /**
   * Move and aim. Dash movement replaces normal movement while active.
   * @param {number} dt
   * @param {{x:number,y:number}} move
   * @param {{x:number,y:number}} aim
   */
  update(dt, move, aim) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const dashDt = this.dashTimer > 0 ? Math.min(dt, this.dashTimer) : 0;
    const normalDt = dt - dashDt;
    if (dashDt > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dashDt);
      this.vx = this.dashX * DASH.speed;
      this.vy = this.dashY * DASH.speed;
      this.x += this.vx * dashDt;
      this.y += this.vy * dashDt;
    }
    if (normalDt > 0) {
      const speed = this.stats.moveSpeed;
      this.vx = move.x * speed;
      this.vy = move.y * speed;
      this.x += this.vx * normalDt;
      this.y += this.vy * normalDt;
    }
    this.x = clamp(this.x, this.radius, this.worldWidth - this.radius);
    this.y = clamp(this.y, this.radius, this.worldHeight - this.radius);
    const dx = aim.x - this.x;
    const dy = aim.y - this.y;
    if (dx * dx + dy * dy > PLAYER.aimDeadZoneSq) this.aimAngle = Math.atan2(dy, dx);
  }

  /**
   * @param {number} amount
   * @returns {boolean} true when damage was actually applied
   */
  takeDamage(amount) {
    if (this.invuln > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = PLAYER.invuln;
    return true;
  }

  /** @param {number} amount */
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * Add XP and resolve level-ups.
   * @param {number} amount
   * @returns {number} number of levels gained
   */
  addXp(amount) {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = Math.round(PLAYER.xpBase + this.level * PLAYER.xpGrowth);
      gained += 1;
    }
    return gained;
  }

  /** @returns {boolean} */
  get alive() {
    return this.hp > 0;
  }

  /**
   * Draw the dash readiness ring around the ship.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time
   */
  _drawDashRing(ctx, time) {
    const cfg = DASH.ring;
    const radius = this.radius + cfg.radiusPad;
    const ready = this.dashCooldown <= 0;
    ctx.save();
    ctx.lineWidth = cfg.width;
    ctx.strokeStyle = COLORS.dashRingBack;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (ready) {
      ctx.globalAlpha = cfg.readyAlpha + Math.sin(time * cfg.readyPulseSpeed) * cfg.readyPulseAmp;
      ctx.strokeStyle = COLORS.dashRingReady;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const progress = 1 - this.dashCooldown / DASH.cooldown;
      ctx.globalAlpha = cfg.cooldownAlpha;
      ctx.strokeStyle = COLORS.cyanBright;
      ctx.beginPath();
      ctx.arc(
        this.x,
        this.y,
        radius,
        cfg.startAngle,
        cfg.startAngle + Math.PI * 2 * progress,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Draw the ship, shield and aim guide.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time
   */
  draw(ctx, time) {
    if (!this.alive) return;
    const d = PLAYER.draw;
    this._drawDashRing(ctx, time);
    const blink = this.invuln > 0 && Math.floor(time * d.blinkRate) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.aimAngle);
    ctx.globalAlpha = blink ? d.blinkAlpha : 1;

    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = d.glowBlur;
    ctx.fillStyle = COLORS.cyanSoft;
    ctx.beginPath();
    ctx.arc(0, 0, d.auraRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(d.hullNose, 0);
    ctx.lineTo(-d.hullBack, d.hullSide);
    ctx.lineTo(-d.hullNotch, 0);
    ctx.lineTo(-d.hullBack, -d.hullSide);
    ctx.closePath();
    ctx.fillStyle = COLORS.cyanInk;
    ctx.fill();
    ctx.lineWidth = d.hullStroke;
    ctx.strokeStyle = COLORS.cyanBright;
    ctx.stroke();

    ctx.shadowBlur = d.cockpitBlur;
    ctx.fillStyle = COLORS.cyanPale;
    ctx.beginPath();
    ctx.arc(d.cockpitX, 0, d.cockpitRadius, 0, Math.PI * 2);
    ctx.fill();

    const flame = d.flameBase + Math.sin(time * d.flameSpeed) * d.flameWave;
    ctx.shadowColor = COLORS.pink;
    ctx.fillStyle = COLORS.pinkFlame;
    ctx.beginPath();
    ctx.moveTo(-d.hullBack, d.flameTail);
    ctx.lineTo(-d.hullBack - flame, 0);
    ctx.lineTo(-d.hullBack, -d.flameTail);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (this.invuln > 0) {
      ctx.save();
      ctx.strokeStyle = COLORS.cyanShield;
      ctx.lineWidth = d.shieldWidth;
      ctx.beginPath();
      ctx.arc(
        this.x,
        this.y,
        this.radius + d.shieldRadius + Math.sin(time * d.shieldSpeed) * d.shieldWave,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = d.magnetAlpha;
    ctx.strokeStyle = COLORS.violet;
    ctx.lineWidth = d.magnetWidth;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.stats.magnet, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
