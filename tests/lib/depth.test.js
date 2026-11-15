import assert from 'node:assert/strict';
import {
  ALL_UPGRADES, applyUpgrade, isUpgradeAvailable, rollUpgrades, WeaponSystem,
} from '../../src/weapons.js';
import { EnemyManager, bossKindForWave } from '../../src/enemies.js';
import { Player } from '../../src/player.js';
import { CodexTracker } from '../../src/codex.js';
import { WEAPON_TYPES } from '../../src/config.js';
import { test } from './harness.js';

const close = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
};

test('weapon selection changes projectile and orbit stats', () => {
  const player = new Player(800, 600, 'shotgun');
  assert.equal(player.stats.shots, WEAPON_TYPES.shotgun.shots);
  assert.equal(player.stats.weaponKind, 'projectile');
  player.setWeapon('laser');
  assert.equal(player.stats.pierce, WEAPON_TYPES.laser.pierce);
  player.setWeapon('blades');
  assert.equal(player.stats.weaponKind, 'orbit');
  assert.equal(player.stats.orbitCount, WEAPON_TYPES.blades.orbitCount);
  assert.equal(player.stats.shots, 0);
  player.setWeapon('nope');
  assert.equal(player.weapon, 'blades');
});

test('crit, explosive and reach upgrades change the right stats', () => {
  const pulse = new Player(800, 600, 'pulse');
  applyUpgrade(pulse, 'crit');
  close(pulse.stats.critChance, 0.12);
  assert.equal(pulse.stats.critMultiplier, 2);
  applyUpgrade(pulse, 'explosive');
  close(pulse.stats.explosionRadius, 61);
  close(pulse.stats.explosionDamage, 0.47);

  const blades = new Player(800, 600, 'blades');
  applyUpgrade(blades, 'reach');
  applyUpgrade(blades, 'reach');
  close(blades.stats.orbitRadius, 72 * 1.24);
  close(blades.stats.orbitSpeed, 2.8 * 1.16);
});

test('synergies unlock only after their prerequisites', () => {
  const pulse = new Player(800, 600, 'pulse');
  const rail = ALL_UPGRADES.find((upgrade) => upgrade.id === 'railDetonator');
  assert.equal(isUpgradeAvailable(pulse, rail), false);
  applyUpgrade(pulse, 'pierce');
  applyUpgrade(pulse, 'pierce');
  applyUpgrade(pulse, 'explosive');
  assert.equal(applyUpgrade(pulse, 'railDetonator'), true);
  assert.equal(pulse.stats.pierce, 3);
  close(pulse.stats.explosionRadius, 89);

  const laser = new Player(800, 600, 'laser');
  applyUpgrade(laser, 'burn');
  applyUpgrade(laser, 'burn');
  applyUpgrade(laser, 'fireRate');
  applyUpgrade(laser, 'fireRate');
  applyUpgrade(laser, 'fireRate');
  assert.equal(applyUpgrade(laser, 'thermalCascade'), true);
  close(laser.stats.burnDps, 12);
  assert.equal(applyUpgrade(new Player(800, 600), 'burn'), false);
});

test('evolutions require level 10 and 20 and roll first', () => {
  const player = new Player(800, 600);
  player.level = 9;
  assert.equal(rollUpgrades(player).some((pick) => pick.id === 'apexProtocol'), false);
  player.level = 10;
  assert.equal(rollUpgrades(player, 1)[0].id, 'apexProtocol');
  assert.equal(applyUpgrade(player, 'apexProtocol'), true);
  close(player.stats.damage, 15);
  assert.equal(player.maxHp, 140);

  player.level = 20;
  const horizon = rollUpgrades(player, 1)[0];
  assert.equal(horizon.id, 'eventHorizon');
  assert.equal(applyUpgrade(player, 'eventHorizon'), true);
  close(player.stats.damage, 27);
  assert.equal(player.stats.shots, 3);
  assert.equal(player.stats.pierce, 4);
  close(player.stats.moveSpeed, 260 * 1.15);
});

test('boss rotation cycles warden, weaver, colossus', () => {
  assert.equal(bossKindForWave(5).id, 'warden');
  assert.equal(bossKindForWave(10).id, 'weaver');
  assert.equal(bossKindForWave(15).id, 'colossus');
  assert.equal(bossKindForWave(20).id, 'warden');
});

test('new enemy behaviours explode, summon and burn', () => {
  const manager = new EnemyManager(1600, 900);
  const player = { x: 800, y: 450, radius: 14, alive: true };
  const bomber = manager.spawn('bomber', player, 810, 450);
  let explosions = 0;
  manager.handlers.onExplode = () => { explosions += 1; };
  bomber.fuseTimer = 0.01;
  manager.update(0.02, player);
  assert.equal(explosions, 1);
  assert.equal(bomber.dead, true);

  const summoner = manager.spawn('summoner', player, 100, 100);
  summoner.summonTimer = 0;
  manager.update(0.02, player);
  assert.ok(manager.countType('mini') >= 2);

  const chaser = manager.spawn('chaser', player, 500, 500);
  const hp = chaser.hp;
  chaser.burnDps = 10;
  chaser.burnTimer = 0.5;
  chaser.burnTick = 0.01;
  manager.update(0.02, player);
  assert.ok(chaser.hp < hp);
});

test('orbit blades damage nearby enemies with a per-enemy cooldown', () => {
  const player = new Player(800, 600, 'blades');
  player.x = 400;
  player.y = 300;
  const enemy = { x: 472, y: 300, radius: 14, id: 1, dead: false, orbitCd: 0 };
  const grid = { queryCircle: () => [enemy] };
  const hits = [];
  const system = new WeaponSystem({ width: 1600, height: 900 }, {
    onEnemyHit: (target, damage, meta) => hits.push({ target, damage, meta }),
  });
  system.update(1 / 60, player, { x: 0, y: 0 }, grid, false);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].target, enemy);
  assert.equal(hits[0].meta.orbit, true);
  assert.equal(hits[0].damage, player.stats.damage);
  assert.equal(enemy.orbitCd, player.stats.orbitHitCooldown);
  system.update(1 / 60, player, { x: 0, y: 0 }, grid, false);
  assert.equal(hits.length, 1, 'cooldown prevents immediate re-hit');
});

test('codex encounters persist across tracker instances', () => {
  const original = globalThis.localStorage;
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)); },
    removeItem: (key) => { memory.delete(key); },
  };
  try {
    const tracker = new CodexTracker();
    assert.equal(tracker.seeEnemy('dasher'), true);
    assert.equal(tracker.seeEnemy('dasher'), false);
    assert.equal(tracker.seeUpgrades(['crit', 'crit']), true);
    const reloaded = new CodexTracker();
    const snapshot = reloaded.snapshot();
    assert.equal(snapshot.enemies.find((entry) => entry.id === 'dasher').seen, true);
    assert.equal(snapshot.enemies.find((entry) => entry.id === 'warden').seen, false);
    assert.equal(snapshot.upgrades.find((entry) => entry.id === 'crit').seen, true);
    assert.equal(snapshot.upgrades.find((entry) => entry.id === 'burn').seen, false);
  } finally {
    globalThis.localStorage = original;
  }
});
