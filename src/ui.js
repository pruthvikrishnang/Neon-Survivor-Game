const $ = (id) => document.getElementById(id);

/** DOM HUD, menus, wave banner and upgrade picker. */
export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), score: $('score'), best: $('best-hud'), wave: $('wave-label'),
      level: $('level-pill'), combo: $('combo'), hpFill: $('hp-fill'), hpText: $('hp-text'),
      xpFill: $('xp-fill'), xpText: $('xp-text'), bossWrap: $('boss-wrap'),
      bossName: $('boss-name'), bossFill: $('boss-fill'), banner: $('wave-banner'),
      bannerMain: $('wave-banner-main'), bannerSub: $('wave-banner-sub'),
      menu: $('menu'), pause: $('pause'), gameover: $('gameover'), levelup: $('levelup'),
      menuBest: $('menu-best'), cards: $('upgrade-cards'), newBest: $('new-best'),
      goScore: $('go-score'), goWave: $('go-wave'), goBest: $('go-best'),
      menuMute: $('menu-mute-btn'), volume: $('volume-slider'), mute: $('mute-btn'),
      start: $('start-btn'), resume: $('resume-btn'), pauseRestart: $('pause-restart-btn'),
      pauseMenu: $('pause-menu-btn'), pauseBtn: $('pause-btn'), goRestart: $('go-restart-btn'),
      goMenu: $('go-menu-btn'),
    };
    this.screens = { menu: this.el.menu, pause: this.el.pause, gameover: this.el.gameover, levelup: this.el.levelup };
    this._bannerTimer = 0;
    this._picked = false;
    this._last = {};
  }

  /** Wire DOM controls to game actions. */
  setHandlers(handlers) {
    const bind = (el, fn) => el.addEventListener('click', () => {
      el.blur();
      handlers.click?.();
      fn();
    });
    bind(this.el.start, handlers.start);
    bind(this.el.resume, handlers.resume);
    bind(this.el.pauseRestart, handlers.restart);
    bind(this.el.pauseMenu, handlers.menu);
    bind(this.el.goRestart, handlers.restart);
    bind(this.el.goMenu, handlers.menu);
    bind(this.el.pauseBtn, handlers.pause);
    bind(this.el.mute, handlers.toggleMute);
    bind(this.el.menuMute, handlers.toggleMute);
    this.el.volume.addEventListener('input', (event) => {
      handlers.volume(Number(event.target.value) / 100);
    });
  }

  _hideScreens() {
    for (const el of Object.values(this.screens)) el.classList.add('hidden');
  }

  showPlaying() {
    this._hideScreens();
    this.el.hud.classList.remove('hidden');
  }

  showMenu(best) {
    this._hideScreens();
    this.el.hud.classList.add('hidden');
    this.el.menu.classList.remove('hidden');
    this.el.menuBest.textContent = String(best);
    this.hideBanner();
  }

  showPause() {
    this._hideScreens();
    this.el.hud.classList.remove('hidden');
    this.el.pause.classList.remove('hidden');
  }

  showGameOver({ score, wave, best, newBest }) {
    this._hideScreens();
    this.el.hud.classList.add('hidden');
    this.el.gameover.classList.remove('hidden');
    this.el.goScore.textContent = String(score);
    this.el.goWave.textContent = String(wave);
    this.el.goBest.textContent = String(best);
    this.el.newBest.classList.toggle('hidden', !newBest);
    this.hideBanner();
  }

  /**
   * Show three upgrade cards.
   * @param {Array<{id:string,name:string,tag:string,describe:Function}>} choices
   * @param {Record<string, number>} levels
   * @param {(id:string) => void} onPick
   */
  showLevelUp(choices, levels, onPick) {
    this._hideScreens();
    this.el.hud.classList.remove('hidden');
    this.el.levelup.classList.remove('hidden');
    this.el.cards.replaceChildren();
    this._picked = false;
    for (const choice of choices) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      const tag = document.createElement('span');
      tag.className = 'upgrade-tag';
      tag.textContent = choice.tag;
      const name = document.createElement('h3');
      name.className = 'upgrade-name';
      name.textContent = choice.name;
      const desc = document.createElement('p');
      desc.className = 'upgrade-desc';
      desc.textContent = choice.describe();
      const level = document.createElement('span');
      level.className = 'upgrade-level';
      level.textContent = `LV ${(levels[choice.id] || 0) + 1} / ${choice.max}`;
      card.append(tag, name, desc, level);
      card.addEventListener('click', () => {
        if (this._picked) return;
        this._picked = true;
        card.blur();
        for (const child of this.el.cards.children) child.disabled = true;
        onPick(choice.id);
      });
      this.el.cards.appendChild(card);
    }
  }

  /**
   * Read live game state into the HUD (called every rendered frame).
   * @param {import('./game.js').Game} game
   */
  setHud(game) {
    const p = game.player;
    const boss = game.enemies.boss;
    this._text(this.el.score, String(game.score));
    this._text(this.el.best, `BEST ${game.bestScore}`);
    this._text(this.el.wave, `WAVE ${game.wave}`);
    this._text(this.el.level, `LV ${p.level}`);
    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    this.el.hpFill.style.width = `${hpPct.toFixed(2)}%`;
    this._text(this.el.hpText, `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`);
    const xpPct = Math.max(0, Math.min(100, (p.xp / p.xpToNext) * 100));
    this.el.xpFill.style.width = `${xpPct.toFixed(2)}%`;
    this._text(this.el.xpText, `XP ${p.xp} / ${p.xpToNext}`);
    if (game.combo >= 2) {
      this.el.combo.classList.remove('hidden');
      const multiplier = 1 + Math.min(game.combo, 20) * 0.1;
      this._text(this.el.combo, `x${multiplier.toFixed(1)} · ${game.combo} COMBO`);
    } else {
      this.el.combo.classList.add('hidden');
    }
    if (boss) {
      this.el.bossWrap.classList.remove('hidden');
      this._text(this.el.bossName, 'THE WARDEN');
      const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      this.el.bossFill.style.width = `${pct.toFixed(2)}%`;
    } else {
      this.el.bossWrap.classList.add('hidden');
    }
  }

  _text(el, text) {
    if (this._last[el.id] === text) return;
    this._last[el.id] = text;
    el.textContent = text;
  }

  /** @param {string} main @param {string} [sub] */
  banner(main, sub = '') {
    const el = this.el.banner;
    this.el.bannerMain.textContent = main;
    this.el.bannerSub.textContent = sub;
    el.classList.remove('hidden', 'show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => el.classList.remove('show'), 1950);
  }

  hideBanner() {
    clearTimeout(this._bannerTimer);
    this.el.banner.classList.add('hidden');
    this.el.banner.classList.remove('show');
  }

  /** @param {boolean} muted */
  setMuted(muted) {
    this.el.menuMute.textContent = `SOUND: ${muted ? 'OFF' : 'ON'}`;
    this.el.mute.textContent = muted ? 'MUTED' : 'SND';
  }

  /** @param {number} value 0..1 */
  setVolume(value) {
    this.el.volume.value = String(Math.round(Math.max(0, Math.min(1, value)) * 100));
  }
}

/**
 * Pre-render the neon arena floor.
 * @param {number} width @param {number} height
 * @returns {HTMLCanvasElement}
 */
export function createArenaBackground(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, 80, width / 2, height / 2, width * 0.72,
  );
  gradient.addColorStop(0, '#0b1228');
  gradient.addColorStop(0.55, '#060a18');
  gradient.addColorStop(1, '#02030a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 80) {
    ctx.strokeStyle = x % 400 === 0 ? 'rgba(81, 246, 255, 0.09)' : 'rgba(81, 246, 255, 0.035)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 80) {
    ctx.strokeStyle = y % 400 === 0 ? 'rgba(255, 59, 212, 0.07)' : 'rgba(81, 246, 255, 0.035)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(81, 246, 255, 0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, width - 4, height - 4);
  ctx.strokeStyle = 'rgba(255, 59, 212, 0.25)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  return canvas;
}

/**
 * Pre-render a vignette overlay.
 * @param {number} width @param {number} height
 * @returns {HTMLCanvasElement}
 */
export function createVignette(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, height * 0.3, width / 2, height / 2, width * 0.68,
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {string} color */
export function drawReticle(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.moveTo(x - 15, y);
  ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 15, y);
  ctx.moveTo(x, y - 15);
  ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x, y + 15);
  ctx.stroke();
  ctx.restore();
}
