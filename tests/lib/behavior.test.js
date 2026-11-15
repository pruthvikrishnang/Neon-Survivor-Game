import assert from 'node:assert/strict';
import { EnemyManager } from '../../src/enemies.js';
import { Player } from '../../src/player.js';
import { TimeScale } from '../../src/time.js';
import { DASH, ENEMIES, LOOP, TIME } from '../../src/config.js';
import { test } from './harness.js';

test('boss alternates radial and aimed attacks and clears its slot on death', () => {
  const shots = [];
  let deaths = 0;
  const manager = new EnemyManager(1600, 900, {
    onShoot: (shot) => shots.push(shot),
    onDeath: () => { deaths += 1; },
  });
  manager.wave = 5;
  const player = { x: 800, y: 450, alive: false };
  const boss = manager.spawn('boss', player);
  assert.ok(boss && boss.isBoss);
  assert.equal(manager.boss, boss);

  boss.attackTimer = 0;
  manager.update(1 / 60, player);
  const radial = shots.length;
  assert.equal(radial, 12);

  boss.attackTimer = 0;
  manager.update(1 / 60, player);
  assert.equal(shots.length - radial, 5);

  manager.damage(boss, 1e9);
  assert.equal(boss.dead, true);
  assert.equal(manager.boss, null);
  assert.equal(deaths, 1);
});

test('boss phase transition fires once when health crosses half', () => {
  let phases = 0;
  const manager = new EnemyManager(1600, 900, { onBossPhase: () => { phases += 1; } });
  manager.wave = 10;
  const player = { x: 800, y: 450, alive: false };
  const boss = manager.spawn('boss', player);
  assert.equal(boss.bossKind, 'weaver');
  boss.hp = boss.maxHp * 0.49;
  manager.update(1 / 60, player);
  assert.equal(boss.phase, 2);
  assert.equal(phases, 1);
  manager.update(1 / 60, player);
  assert.equal(phases, 1);
});

test('dash cooldown gates re-use and invulnerability covers exactly the dash', () => {
  const player = new Player(1600, 900);
  const aim = { x: player.x + 100, y: player.y };
  assert.equal(player.tryDash({ x: 0, y: 0 }, aim), true);
  assert.ok(player.dashTimer > 0);
  assert.ok(player.dashCooldown > 0);
  assert.equal(player.tryDash({ x: 0, y: 0 }, aim), false, 'cannot dash during cooldown');
  assert.equal(player.takeDamage(10), false, 'invulnerable at dash start');
  assert.equal(player.hp, player.maxHp);

  player.update(DASH.duration * 0.5, { x: 0, y: 0 }, aim);
  assert.equal(player.takeDamage(10), false, 'still invulnerable mid-dash');
  player.update(DASH.duration * 0.5 + 0.001, { x: 0, y: 0 }, aim);
  assert.equal(player.dashTimer, 0);
  assert.equal(player.takeDamage(10), true, 'vulnerable once the dash ends');
  assert.equal(player.hp, player.maxHp - 10);
  assert.equal(player.tryDash({ x: 0, y: 0 }, aim), false, 'cooldown outlasts the dash');
});

test('hit-stop counts down in real frames and outranks slow-motion', () => {
  const timeScale = new TimeScale();
  timeScale.hitStop(2);
  assert.equal(timeScale.hitStopActive, true);
  assert.equal(timeScale.advance(LOOP.step), 0);
  assert.equal(timeScale.hitStopActive, true);
  assert.equal(timeScale.advance(LOOP.step), 0);
  assert.equal(timeScale.hitStopActive, false);
  assert.equal(timeScale.advance(LOOP.step), LOOP.step);

  timeScale.slowMotion(1);
  timeScale.hitStop(1);
  assert.equal(timeScale.advance(LOOP.step), 0, 'hit-stop pauses slow-motion');
  assert.ok(timeScale.slowMoActive, 'slow-motion timer does not drain during hit-stop');
  assert.equal(timeScale.advance(LOOP.step), LOOP.step * TIME.slowMo.scale);
});

test('telegraphed spawns stay safe, block wave clear and then spawn', () => {
  const manager = new EnemyManager(1600, 900);
  const player = { x: 800, y: 450, radius: 14, alive: false };
  manager.startWave(1);
  manager.queue = ['chaser'];
  manager.spawnTimer = 0;

  manager.update(LOOP.step, player);
  assert.equal(manager.enemies.length, 0);
  assert.equal(manager.telegraphs.length, 1);
  assert.equal(manager.isWaveCleared(), false, 'pending telegraph keeps the wave open');
  const telegraph = manager.telegraphs[0];
  const distance = Math.hypot(telegraph.x - player.x, telegraph.y - player.y);
  assert.ok(distance >= ENEMIES.spawn.safeDistance, 'spawn marker is outside the safe radius');

  manager.update(ENEMIES.spawn.telegraphDuration + 0.01, player);
  assert.equal(manager.telegraphs.length, 0);
  assert.equal(manager.enemies.length, 1);
  assert.equal(manager.enemies[0].type, 'chaser');
});
