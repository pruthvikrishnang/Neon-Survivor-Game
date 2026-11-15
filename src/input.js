import { COLORS, INPUT } from './config.js';

const MOVE_KEYS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
};
const BLOCK_DEFAULT = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
]);

/**
 * Keyboard, mouse and multitouch input. Touch uses a left-side virtual
 * joystick for movement and a right-side pointer for aim/fire.
 */
export class Input {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  constructor(canvas, worldWidth, worldHeight) {
    this.canvas = canvas;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: worldWidth / 2, y: worldHeight / 2, down: false };
    this.pointerType = 'mouse';
    this.touchMode = false;
    this.joy = { active: false, id: -1, bx: 0, by: 0, x: 0, y: 0, dx: 0, dy: 0 };
    this.aim = { active: false, id: -1, x: 0, y: 0 };
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (event) => {
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (BLOCK_DEFAULT.has(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pressed.clear();
      this.mouse.down = false;
      this._resetTouch();
    });

    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('pointerdown', (event) => this._onDown(event));
    this.canvas.addEventListener('pointermove', (event) => this._onMove(event));
    window.addEventListener('pointerup', (event) => this._onUp(event));
    window.addEventListener('pointercancel', (event) => this._onUp(event));
  }

  _toWorld(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: this.worldWidth / 2, y: this.worldHeight / 2 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.worldWidth,
      y: ((event.clientY - rect.top) / rect.height) * this.worldHeight,
    };
  }

  _onDown(event) {
    const pos = this._toWorld(event);
    this.pointerType = event.pointerType === 'touch' ? 'touch' : 'mouse';
    if (this.pointerType === 'touch') {
      this.touchMode = true;
      try { this.canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
      if (!this.joy.active && pos.x < this.worldWidth * INPUT.touchSplit) {
        this.joy = {
          active: true, id: event.pointerId, bx: pos.x, by: pos.y,
          x: pos.x, y: pos.y, dx: 0, dy: 0,
        };
      } else if (!this.aim.active) {
        this.aim = { active: true, id: event.pointerId, x: pos.x, y: pos.y };
      }
    } else {
      this.touchMode = false;
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
      this.mouse.down = true;
    }
  }

  _onMove(event) {
    const pos = this._toWorld(event);
    if (event.pointerType === 'touch') {
      if (this.joy.active && this.joy.id === event.pointerId) {
        let dx = pos.x - this.joy.bx;
        let dy = pos.y - this.joy.by;
        const len = Math.hypot(dx, dy);
        if (len > INPUT.joystickRadius) {
          dx = (dx / len) * INPUT.joystickRadius;
          dy = (dy / len) * INPUT.joystickRadius;
        }
        this.joy.dx = dx;
        this.joy.dy = dy;
        this.joy.x = this.joy.bx + dx;
        this.joy.y = this.joy.by + dy;
      }
      if (this.aim.active && this.aim.id === event.pointerId) {
        this.aim.x = pos.x;
        this.aim.y = pos.y;
      }
    } else {
      this.touchMode = false;
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
    }
  }

  _onUp(event) {
    if (this.joy.active && this.joy.id === event.pointerId) this._resetJoystick();
    if (this.aim.active && this.aim.id === event.pointerId) this.aim = { active: false, id: -1, x: 0, y: 0 };
    if (event.pointerType !== 'touch') this.mouse.down = false;
  }

  _resetJoystick() {
    this.joy = { active: false, id: -1, bx: 0, by: 0, x: 0, y: 0, dx: 0, dy: 0 };
  }

  _resetTouch() {
    this._resetJoystick();
    this.aim = { active: false, id: -1, x: 0, y: 0 };
  }

  /** Clear held inputs (used when pausing or restarting). */
  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.mouse.down = false;
    this._resetTouch();
  }

  /** @returns {{x: number, y: number}} normalised movement vector */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.joy.active) {
      x = this.joy.dx / INPUT.joystickRadius;
      y = this.joy.dy / INPUT.joystickRadius;
    } else {
      if (this._anyDown(MOVE_KEYS.left)) x -= 1;
      if (this._anyDown(MOVE_KEYS.right)) x += 1;
      if (this._anyDown(MOVE_KEYS.up)) y -= 1;
      if (this._anyDown(MOVE_KEYS.down)) y += 1;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  _anyDown(codes) {
    for (const code of codes) if (this.keys.has(code)) return true;
    return false;
  }

  /** @param {string} code @returns {boolean} */
  consume(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** Call once per simulation frame after input has been consumed. */
  endFrame() {
    this.pressed.clear();
  }

  /** @returns {boolean} */
  isFiring() {
    return this.mouse.down || this.aim.active;
  }

  /** @returns {boolean} */
  isTouchMode() {
    return this.touchMode;
  }

  /** @param {CanvasRenderingContext2D} ctx @param {number} time */
  drawJoystick(ctx, time) {
    if (!this.joy.active) return;
    const pulse = INPUT.pulseBase + Math.sin(time * INPUT.pulseSpeed) * INPUT.pulseAmplitude;
    ctx.save();
    ctx.globalAlpha = INPUT.joystickAlpha;
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = INPUT.lineWidth;
    ctx.beginPath();
    ctx.arc(this.joy.bx, this.joy.by, INPUT.joystickRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.cyanJoystick;
    ctx.beginPath();
    ctx.arc(this.joy.x, this.joy.y, INPUT.knobRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.cyanKnob;
    ctx.beginPath();
    ctx.arc(this.joy.x, this.joy.y, INPUT.knobRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
