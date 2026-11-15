import { Game } from './game.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { loadSettings } from './storage.js';
import { LOOP, WORLD } from './config.js';

const canvas = document.getElementById('game');
const settings = loadSettings();
const audio = new AudioEngine(settings);
const input = new Input(canvas, WORLD.width, WORLD.height);
const ui = new UI();
const game = new Game({ canvas, ui, audio, input });
window.neonSurvivor = game;

ui.setHandlers({
  start: () => game.start(),
  resume: () => game.resume(),
  restart: () => game.start(),
  menu: () => game.quitToMenu(),
  pause: () => game.togglePause(),
  dash: () => game.requestDash(),
  toggleMute: () => game.toggleMute(),
  volume: (value) => game.setVolume(value),
  click: () => audio.click(),
});
ui.setMuted(audio.muted);
ui.setVolume(audio.volume);
ui.showMenu(game.bestScore);

const unlockAudio = () => audio.init();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

let lastTime = performance.now();
let accumulator = 0;

function frame(now) {
  let delta = (now - lastTime) / 1000;
  lastTime = now;
  if (!Number.isFinite(delta) || delta < 0) delta = 0;
  delta = Math.min(delta, LOOP.maxFrameDelta);
  accumulator += delta;

  let steps = 0;
  while (accumulator >= LOOP.step && steps < LOOP.maxSteps) {
    game.update(LOOP.step);
    accumulator -= LOOP.step;
    steps += 1;
  }
  if (steps === LOOP.maxSteps) accumulator = 0;

  game.render(accumulator / LOOP.step);
  if (steps > 0) input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function handleBlur() {
  if (game.state === 'playing') game.pause();
  lastTime = performance.now();
  accumulator = 0;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) handleBlur();
  else {
    lastTime = performance.now();
    accumulator = 0;
  }
});
window.addEventListener('blur', handleBlur);
