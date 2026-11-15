import { ALL_UPGRADES, EVOLUTIONS, UPGRADES, WEAPONS } from '../config.js';

export { ALL_UPGRADES, EVOLUTIONS, UPGRADES };

/**
 * Check weapon pool, level cap, synergy requirements and evolution level.
 * @param {import('../player.js').Player} player
 * @param {object} def
 */
export function isUpgradeAvailable(player, def) {
  if (!def || !def.weapons.includes(player.weapon || 'pulse')) return false;
  if ((player.upgrades[def.id] || 0) >= def.max) return false;
  if (def.kind === 'evolution' && player.level < def.level) return false;
  if (def.requires) {
    for (const [id, level] of Object.entries(def.requires)) {
      if ((player.upgrades[id] || 0) < level) return false;
    }
  }
  return true;
}

/**
 * Apply one level of an upgrade.
 * @param {import('../player.js').Player} player
 * @param {string} id
 * @returns {boolean}
 */
export function applyUpgrade(player, id) {
  const def = ALL_UPGRADES.find((upgrade) => upgrade.id === id);
  if (!isUpgradeAvailable(player, def)) return false;
  player.upgrades[id] = (player.upgrades[id] || 0) + 1;
  player.recomputeStats();
  return true;
}

function shuffled(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

/**
 * Pick distinct affordable regular upgrades, plus one eligible evolution.
 * @param {import('../player.js').Player} player
 * @param {number} [count]
 * @param {() => number} [rng]
 */
export function rollUpgrades(player, count = WEAPONS.fire.choices, rng = Math.random) {
  const evolution = EVOLUTIONS
    .filter((def) => isUpgradeAvailable(player, def))
    .sort((a, b) => b.level - a.level)[0] || null;
  const available = UPGRADES.filter((def) => isUpgradeAvailable(player, def));
  const regulars = shuffled(available, rng).slice(0, count - (evolution ? 1 : 0));
  return evolution ? [evolution, ...regulars] : regulars;
}
