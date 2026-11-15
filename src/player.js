export const BASE_STATS = Object.freeze({
  damage: 10,
  fireInterval: 0.34,
  shots: 1,
  pierce: 0,
  moveSpeed: 260,
  maxHp: 100,
  magnet: 90,
  bulletSpeed: 900,
});

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
    this.radius = 16;
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
    this.xpToNext = 6;
    this.invuln = 0;
    this.hp = 100;
    this.maxHp = 100;
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
    this.stats = {
      damage: BASE_STATS.damage * (1 + 0.3 * u.damage),
      fireInterval: Math.max(0.065, BASE_STATS.fireInterval * Math.pow(0.845, u.fireRate)),
      shots: 1 + u.multishot,
      pierce: u.pierce,
      moveSpeed: BASE_STATS.moveSpeed * (1 + 0.1 * u.speed),
      maxHp: BASE_STATS.maxHp + 22 * u.maxHp,
      magnet: BASE_STATS.magnet * (1 + 0.6 * u.magnet),
      bulletSpeed: BASE_STATS.bulletSpeed,
    };
    this.maxHp = this.stats.maxHp;
    if (this.maxHp > previousMax) this.hp += this.maxHp - previousMax;
    this.hp = Math.min(this.hp, this.maxHp);
  }

  /**
   * Move and aim.
   * @param {number} dt
   * @param {{x:number,y:number}} move
   * @param {{x:number,y:number}} aim
   */
  update(dt, move, aim) {
    this.invuln = Math.max(0, this.invuln - dt);
    const speed = this.stats.moveSpeed;
    this.vx = move.x * speed;
    this.vy = move.y * speed;
    this.x = clamp(this.x + this.vx * dt, this.radius, this.worldWidth - this.radius);
    this.y = clamp(this.y + this.vy * dt, this.radius, this.worldHeight - this.radius);
    const dx = aim.x - this.x;
    const dy = aim.y - this.y;
    if (dx * dx + dy * dy > 4) this.aimAngle = Math.atan2(dy, dx);
  }

  /**
   * @param {number} amount
   * @returns {boolean} true when damage was actually applied
   */
  takeDamage(amount) {
    if (this.invuln > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = 0.85;
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
      this.xpToNext = Math.round(6 + this.level * 4.5);
      gained += 1;
    }
    return gained;
  }

  /** @returns {boolean} */
  get alive() {
    return this.hp > 0;
  }

  /**
   * Draw the ship, shield and aim guide.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time
   */
  draw(ctx, time) {
    if (!this.alive) return;
    const blink = this.invuln > 0 && Math.floor(time * 18) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.aimAngle);
    ctx.globalAlpha = blink ? 0.35 : 1;

    ctx.shadowColor = '#51f6ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(81, 246, 255, 0.14)';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(23, 0);
    ctx.lineTo(-13, 13);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-13, -13);
    ctx.closePath();
    ctx.fillStyle = '#0a2233';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8ffbff';
    ctx.stroke();

    ctx.shadowBlur = 10;
    ctx.fillStyle = '#eaffff';
    ctx.beginPath();
    ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    const flame = 9 + Math.sin(time * 22) * 3;
    ctx.shadowColor = '#ff3bd4';
    ctx.fillStyle = 'rgba(255, 59, 212, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-13, 5);
    ctx.lineTo(-13 - flame, 0);
    ctx.lineTo(-13, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (this.invuln > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(81, 246, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 9 + Math.sin(time * 12) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#b45cff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.stats.magnet, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
