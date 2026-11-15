import { GAME, UI as UI_CONFIG, WEAPON_TYPES } from '../config.js';
import { renderCodex } from './codexView.js';

const $ = (id) => document.getElementById(id);

/** DOM HUD, menus, weapon select, Codex and upgrade picker. */
export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), score: $('score'), best: $('best-hud'), wave: $('wave-label'),
      level: $('level-pill'), weapon: $('weapon-label'), combo: $('combo'),
      hpFill: $('hp-fill'), hpText: $('hp-text'), xpFill: $('xp-fill'), xpText: $('xp-text'),
      bossWrap: $('boss-wrap'), bossName: $('boss-name'), bossFill: $('boss-fill'),
      banner: $('wave-banner'), bannerMain: $('wave-banner-main'), bannerSub: $('wave-banner-sub'),
      menu: $('menu'), pause: $('pause'), gameover: $('gameover'), levelup: $('levelup'),
      codex: $('codex'), codexList: $('codex-list'), codexClose: $('codex-close-btn'),
      menuBest: $('menu-best'), cards: $('upgrade-cards'), newBest: $('new-best'),
      goScore: $('go-score'), goWave: $('go-wave'), goBest: $('go-best'),
      menuMute: $('menu-mute-btn'), volume: $('volume-slider'), mute: $('mute-btn'),
      dash: $('dash-btn'), weaponSelect: $('weapon-select'), weaponBlurb: $('weapon-blurb'),
      start: $('start-btn'), resume: $('resume-btn'), pauseRestart: $('pause-restart-btn'),
      pauseMenu: $('pause-menu-btn'), pauseBtn: $('pause-btn'), goRestart: $('go-restart-btn'),
      goMenu: $('go-menu-btn'), menuCodex: $('codex-btn'), pauseCodex: $('pause-codex-btn'),
    };
    this.screens = {
      menu: this.el.menu, pause: this.el.pause, gameover: this.el.gameover,
      levelup: this.el.levelup, codex: this.el.codex,
    };
    this.selectedWeapon = 'pulse';
    this._bannerTimer = 0;
    this._picked = false;
    this._last = {};
    this._handlers = {};
    this._buildWeaponSelect();
  }

  _buildWeaponSelect() {
    this.el.weaponSelect.replaceChildren();
    for (const weapon of Object.values(WEAPON_TYPES)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'weapon-card';
      button.dataset.weapon = weapon.id;
      const name = document.createElement('strong');
      name.textContent = weapon.name;
      const tag = document.createElement('span');
      tag.textContent = weapon.tag;
      button.append(name, tag);
      button.addEventListener('click', () => {
        this._handlers.click?.();
        this.selectWeapon(weapon.id);
      });
      this.el.weaponSelect.appendChild(button);
    }
    this.selectWeapon(this.selectedWeapon);
  }

  selectWeapon(id) {
    const weapon = WEAPON_TYPES[id] || WEAPON_TYPES.pulse;
    this.selectedWeapon = weapon.id;
    for (const button of this.el.weaponSelect.children) {
      button.classList.toggle('selected', button.dataset.weapon === weapon.id);
    }
    this.el.weaponBlurb.textContent = weapon.description;
  }

  getSelectedWeapon() {
    return this.selectedWeapon;
  }

  setHandlers(handlers) {
    this._handlers = handlers;
    const bind = (el, fn) => el.addEventListener('click', () => {
      el.blur();
      handlers.click?.();
      fn?.();
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
    bind(this.el.menuCodex, handlers.codex);
    bind(this.el.pauseCodex, handlers.codex);
    bind(this.el.codexClose, handlers.codexClose);
    this.el.volume.addEventListener('input', (event) => {
      handlers.volume(Number(event.target.value) / UI_CONFIG.volumeScale);
    });
    this.el.dash.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.el.dash.blur();
      handlers.dash?.();
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
    this.selectWeapon(this.selectedWeapon);
    this.hideBanner();
  }

  showPause() {
    this._hideScreens();
    this.el.hud.classList.remove('hidden');
    this.el.pause.classList.remove('hidden');
  }

  showCodex(snapshot) {
    this._hideScreens();
    this.el.hud.classList.add('hidden');
    this.el.codex.classList.remove('hidden');
    renderCodex(this.el.codexList, snapshot);
    this.hideBanner();
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

  showLevelUp(choices, levels, onPick) {
    this._hideScreens();
    this.el.hud.classList.remove('hidden');
    this.el.levelup.classList.remove('hidden');
    this.el.cards.replaceChildren();
    this._picked = false;
    for (const choice of choices) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `upgrade-card${choice.kind === 'evolution' ? ' evolution' : ''}`;
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
      level.textContent = choice.kind === 'evolution'
        ? 'EVOLUTION'
        : `LV ${(levels[choice.id] || 0) + 1} / ${choice.max}`;
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

  setHud(game) {
    const p = game.player;
    const boss = game.enemies.boss;
    this._text(this.el.score, String(game.score));
    this._text(this.el.best, `BEST ${game.bestScore}`);
    this._text(this.el.wave, `WAVE ${game.wave}`);
    this._text(this.el.level, `LV ${p.level}`);
    this._text(this.el.weapon, WEAPON_TYPES[p.weapon].name);
    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    this.el.hpFill.style.width = `${hpPct.toFixed(2)}%`;
    this._text(this.el.hpText, `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`);
    const xpPct = Math.max(0, Math.min(100, (p.xp / p.xpToNext) * 100));
    this.el.xpFill.style.width = `${xpPct.toFixed(2)}%`;
    this._text(this.el.xpText, `XP ${p.xp} / ${p.xpToNext}`);
    if (game.combo >= UI_CONFIG.comboMin) {
      this.el.combo.classList.remove('hidden');
      const multiplier = 1 + Math.min(game.combo, GAME.comboMax) * GAME.comboStep;
      this._text(this.el.combo, `x${multiplier.toFixed(1)} · ${game.combo} COMBO`);
    } else {
      this.el.combo.classList.add('hidden');
    }
    const showDash = game.input.isTouchMode() && game.state === 'playing' && !game.upgradeOpen;
    this.el.dash.classList.toggle('hidden', !showDash);
    if (boss) {
      this.el.bossWrap.classList.remove('hidden');
      this._text(this.el.bossName, boss.name || UI_CONFIG.bossName);
      const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      this.el.bossFill.style.width = `${pct.toFixed(2)}%`;
    } else {
      this.el.bossWrap.classList.add('hidden');
    }
  }

  _text(el, text) {
    if (!el || this._last[el.id] === text) return;
    this._last[el.id] = text;
    el.textContent = text;
  }

  banner(main, sub = '') {
    const el = this.el.banner;
    this.el.bannerMain.textContent = main;
    this.el.bannerSub.textContent = sub;
    el.classList.remove('hidden', 'show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => el.classList.remove('show'), UI_CONFIG.bannerDuration);
  }

  hideBanner() {
    clearTimeout(this._bannerTimer);
    this.el.banner.classList.add('hidden');
    this.el.banner.classList.remove('show');
  }

  setMuted(muted) {
    this.el.menuMute.textContent = `SOUND: ${muted ? 'OFF' : 'ON'}`;
    this.el.mute.textContent = muted ? 'MUTED' : 'SND';
  }

  setVolume(value) {
    this.el.volume.value = String(
      Math.round(Math.max(0, Math.min(1, value)) * UI_CONFIG.volumeScale),
    );
  }
}
