import { LOOP, TIME } from './config.js';

/**
 * Converts real frame time into simulation time.
 * Priority: hard pause/level-up pause > hit-stop > slow-motion > normal.
 */
export class TimeScale {
  constructor(cfg = TIME) {
    this.cfg = cfg;
    this.hitStopTimer = 0;
    this.slowMoTimer = 0;
  }

  reset() {
    this.hitStopTimer = 0;
    this.slowMoTimer = 0;
  }

  /** @param {number} frames */
  hitStop(frames) {
    const duration = Math.max(0, frames) * LOOP.step;
    this.hitStopTimer = Math.max(this.hitStopTimer, duration);
  }

  /** @param {number} duration seconds */
  slowMotion(duration) {
    this.slowMoTimer = Math.max(this.slowMoTimer, Math.max(0, duration));
  }

  /** @returns {boolean} */
  get hitStopActive() {
    return this.hitStopTimer > 0;
  }

  /** @returns {boolean} */
  get slowMoActive() {
    return this.slowMoTimer > 0;
  }

  /**
   * Advance timers by real time and return the simulation timestep.
   * Paused time does not consume hit-stop or slow-motion.
   * @param {number} realDt
   * @param {boolean} [paused]
   * @returns {number}
   */
  advance(realDt, paused = false) {
    if (paused || realDt <= 0) return 0;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - realDt);
      return 0;
    }
    if (this.slowMoTimer > 0) {
      this.slowMoTimer = Math.max(0, this.slowMoTimer - realDt);
      return realDt * this.cfg.slowMo.scale;
    }
    return realDt;
  }
}
