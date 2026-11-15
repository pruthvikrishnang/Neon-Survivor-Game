import assert from 'node:assert/strict';
import { circleOverlap, SpatialGrid, applyUpgrade, rollUpgrades } from '../../src/weapons.js';
import { waveComposition, enemyScaling } from '../../src/enemies.js';
import { Player } from '../../src/player.js';
import { loadBest, saveBest, loadSettings, saveSettings } from '../../src/storage.js';
import { ENEMIES } from '../../src/config.js';
import { test } from './harness.js';

test('circleOverlap detects overlap, touching and miss', () => {
  assert.equal(circleOverlap(0, 0, 10, 5, 0, 4), true);
  assert.equal(circleOverlap(0, 0, 10, 14, 0, 4), true, 'exact tangency counts');
  assert.equal(circleOverlap(0, 0, 10, 15, 0, 4), false);
  assert.equal(circleOverlap(0, 0, 10, 12, 16, 10), true);
});

test('spatial grid inserts, queries by radius and ignores dead entities', () => {
  const grid = new SpatialGrid(300, 300, 100);
  const near = { x: 50, y: 52, radius: 10 };
  const far = { x: 260, y: 260, radius: 10 };
  const dead = { x: 55, y: 55, radius: 10, dead: true };
  grid.insert(near);
  grid.insert(far);
  grid.insert(dead);

  const found = grid.queryCircle(50, 50, 20, []);
  assert.equal(found.length, 1);
  assert.equal(found[0], near);

  const all = grid.queryCircle(150, 150, 300, []);
  assert.equal(all.length, 2);
  assert.ok(all.includes(far));

  grid.clear();
  assert.equal(grid.queryCircle(50, 50, 100, []).length, 0);
});

test('spatial grid finds entities across adjacent cells', () => {
  const grid = new SpatialGrid(500, 500, 50);
  const a = { x: 49, y: 49, radius: 4 };
  const b = { x: 51, y: 51, radius: 4 };
  grid.insert(a);
  grid.insert(b);
  const result = grid.queryCircle(50, 50, 3, []);
  assert.deepEqual(new Set(result), new Set([a, b]));
});

test('wave 1 is chasers only while later waves unlock new enemies', () => {
  const w1 = waveComposition(1);
  assert.equal(w1.chasers, w1.total);
  assert.equal(w1.shooters, 0);
  assert.equal(w1.tanks, 0);

  const w2 = waveComposition(2);
  assert.ok(w2.shooters > 0, 'shooters unlock on wave 2');
  assert.equal(waveComposition(3).tanks > 0, true, 'tanks unlock on wave 3');
  assert.ok(waveComposition(4).dashers > 0, 'dashers unlock on wave 4');
  assert.ok(waveComposition(6).bombers > 0, 'bombers unlock on wave 6');
  assert.ok(waveComposition(8).summoners > 0, 'summoners unlock on wave 8');
});

test('bosses appear every fifth wave', () => {
  assert.equal(waveComposition(5).boss, true);
  assert.equal(waveComposition(10).boss, true);
  assert.equal(waveComposition(15).boss, true);
  assert.equal(waveComposition(6).boss, false);
  assert.equal(waveComposition(9).boss, false);
});

test('wave composition is consistent and capped', () => {
  for (let wave = 1; wave <= 60; wave += 1) {
    const comp = waveComposition(wave);
    const sum = comp.chasers + comp.shooters + comp.tanks
      + comp.dashers + comp.bombers + comp.summoners;
    assert.equal(comp.total, sum);
    assert.ok(comp.chasers > 0);
    assert.ok(comp.total <= ENEMIES.maxWaveTotal, 'enemy count is capped');
  }
  assert.ok(waveComposition(30).total >= waveComposition(4).total);
});

test('enemy scaling increases and speed stays capped', () => {
  const early = enemyScaling(1);
  const mid = enemyScaling(5);
  const late = enemyScaling(50);
  assert.equal(early.hp, 1);
  assert.ok(mid.hp > early.hp);
  assert.ok(late.hp > mid.hp);
  assert.ok(late.damage > mid.damage);
  assert.ok(late.speed <= 1.55);
  assert.ok(late.speed >= early.speed);
});

test('upgrades stack and change derived player stats', () => {
  const player = new Player(800, 600);
  const baseDamage = player.stats.damage;
  const baseInterval = player.stats.fireInterval;
  applyUpgrade(player, 'damage');
  applyUpgrade(player, 'damage');
  assert.ok(player.stats.damage > baseDamage);
  assert.equal(player.upgrades.damage, 2);

  applyUpgrade(player, 'fireRate');
  assert.ok(player.stats.fireInterval < baseInterval);
  applyUpgrade(player, 'multishot');
  assert.equal(player.stats.shots, 2);
  applyUpgrade(player, 'pierce');
  assert.equal(player.stats.pierce, 1);
});

test('max hp upgrade increases health without exceeding the new cap', () => {
  const player = new Player(800, 600);
  player.hp = 100;
  applyUpgrade(player, 'maxHp');
  assert.equal(player.maxHp, 122);
  assert.equal(player.hp, 122);
  player.hp = 20;
  applyUpgrade(player, 'maxHp');
  assert.equal(player.maxHp, 144);
  assert.equal(player.hp, 42);
});

test('upgrades respect their level cap', () => {
  const player = new Player(800, 600);
  for (let i = 0; i < 10; i += 1) applyUpgrade(player, 'pierce');
  assert.equal(player.upgrades.pierce, 3);
  assert.equal(applyUpgrade(player, 'pierce'), false);
  assert.equal(applyUpgrade(player, 'nope'), false);
});

test('rollUpgrades returns distinct affordable cards', () => {
  const player = new Player(800, 600);
  for (let i = 0; i < 8; i += 1) applyUpgrade(player, 'fireRate');
  let seed = 0.42;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const picks = rollUpgrades(player, 3, rng);
  assert.equal(picks.length, 3);
  assert.equal(new Set(picks.map((pick) => pick.id)).size, 3);
  assert.ok(!picks.some((pick) => pick.id === 'fireRate'), 'maxed upgrades are excluded');
});

test('player levelling carries XP and grows the next threshold', () => {
  const player = new Player(800, 600);
  assert.equal(player.level, 1);
  const gained = player.addXp(player.xpToNext + 3);
  assert.equal(gained, 1);
  assert.equal(player.level, 2);
  assert.equal(player.xp, 3);
  assert.ok(player.xpToNext > 6);
});

test('storage helpers survive a missing localStorage', () => {
  const best = loadBest();
  assert.ok(Number.isInteger(best) && best >= 0);
  assert.equal(typeof saveBest(42), 'boolean');
  const settings = loadSettings();
  assert.equal(typeof settings.volume, 'number');
  assert.equal(typeof settings.muted, 'boolean');
  assert.equal(typeof saveSettings({ volume: 0.2, muted: true }), 'boolean');
});
