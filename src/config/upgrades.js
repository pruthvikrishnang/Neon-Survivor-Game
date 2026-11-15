const PROJECTILE = Object.freeze(['pulse', 'shotgun', 'laser']);
const ALL_WEAPONS = Object.freeze(['pulse', 'shotgun', 'laser', 'blades']);

export const UPGRADES = Object.freeze([
  Object.freeze({ id: 'fireRate', name: 'Overclock', tag: 'RATE', max: 8, weapons: Object.freeze(['pulse', 'shotgun', 'laser']), describe: () => 'Fire 18% faster. Holding fire pushes it further.' }),
  Object.freeze({ id: 'damage', name: 'Heavy Rounds', tag: 'DMG', max: 7, weapons: ALL_WEAPONS, describe: () => 'Weapon damage +30%.' }),
  Object.freeze({ id: 'multishot', name: 'Split Shot', tag: 'SPLIT', max: 4, weapons: ALL_WEAPONS, describe: () => 'Add +1 projectile or orbiting blade.' }),
  Object.freeze({ id: 'pierce', name: 'Rail Core', tag: 'PIERCE', max: 3, weapons: Object.freeze(['pulse', 'laser']), describe: () => 'Shots punch through +1 extra enemy.' }),
  Object.freeze({ id: 'speed', name: 'Thrusters', tag: 'MOVE', max: 4, weapons: ALL_WEAPONS, describe: () => 'Move speed +10%.' }),
  Object.freeze({ id: 'maxHp', name: 'Hull Plating', tag: 'HP', max: 5, weapons: ALL_WEAPONS, describe: () => 'Max HP +22 and instantly restore 22 HP.' }),
  Object.freeze({ id: 'magnet', name: 'Mag Field', tag: 'MAGNET', max: 4, weapons: ALL_WEAPONS, describe: () => 'XP pickup radius +60%.' }),
  Object.freeze({ id: 'explosive', name: 'Fracture Rounds', tag: 'BLAST', max: 2, weapons: Object.freeze(['pulse', 'shotgun']), describe: () => 'Impacts detonate for splash damage.' }),
  Object.freeze({ id: 'crit', name: 'Targeting Spike', tag: 'CRIT', max: 3, weapons: PROJECTILE, describe: () => 'Add +12% chance to deal double damage.' }),
  Object.freeze({ id: 'burn', name: 'Thermal Lance', tag: 'BURN', max: 2, weapons: Object.freeze(['laser']), describe: () => 'Laser hits ignite enemies for damage over time.' }),
  Object.freeze({ id: 'reach', name: 'Wide Orbit', tag: 'ORBIT', max: 3, weapons: Object.freeze(['blades']), describe: () => 'Blades orbit 12% wider and 8% faster.' }),
  Object.freeze({
    id: 'railDetonator',
    name: 'Rail Detonator',
    tag: 'SYNERGY',
    max: 1,
    weapons: Object.freeze(['pulse']),
    requires: Object.freeze({ pierce: 2, explosive: 1 }),
    describe: () => 'Piercing blasts grow larger and hit harder. Requires Rail Core 2 + Fracture Rounds.',
  }),
  Object.freeze({
    id: 'thermalCascade',
    name: 'Thermal Cascade',
    tag: 'SYNERGY',
    max: 1,
    weapons: Object.freeze(['laser']),
    requires: Object.freeze({ burn: 2, fireRate: 3 }),
    describe: () => 'Burning targets take more damage and the lance cycles faster. Requires Thermal Lance 2 + Overclock 3.',
  }),
]);

export const EVOLUTIONS = Object.freeze([
  Object.freeze({
    id: 'apexProtocol',
    name: 'Apex Protocol',
    tag: 'EVOLUTION',
    max: 1,
    kind: 'evolution',
    level: 10,
    weapons: ALL_WEAPONS,
    describe: () => 'Evolve the hull: +50% damage, +15% fire rate, +2 pierce and +40 max HP.',
  }),
  Object.freeze({
    id: 'eventHorizon',
    name: 'Event Horizon',
    tag: 'EVOLUTION',
    max: 1,
    kind: 'evolution',
    level: 20,
    weapons: ALL_WEAPONS,
    describe: () => 'Final form: +80% damage, +2 projectiles, +2 pierce and +15% move speed.',
  }),
]);

export const ALL_UPGRADES = Object.freeze([...UPGRADES, ...EVOLUTIONS]);

export const WEAPON_UPGRADE_IDS = Object.freeze(
  Object.fromEntries(ALL_WEAPONS.map((weapon) => [
    weapon,
    ALL_UPGRADES.filter((upgrade) => upgrade.weapons.includes(weapon)).map((upgrade) => upgrade.id),
  ])),
);
