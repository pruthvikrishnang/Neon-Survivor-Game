import { ALL_UPGRADES, ENEMIES } from './config.js';
import { loadCodex, saveCodex } from './storage.js';

const ENEMY_ENTRIES = Object.freeze([
  ...Object.entries(ENEMIES.types)
    .filter(([id]) => id !== 'boss')
    .map(([id, type]) => ({ id, name: type.name, color: type.color })),
  ...ENEMIES.bossKinds.map((kind) => ({ id: kind.id, name: kind.name, color: kind.color })),
]);

const UPGRADE_ENTRIES = ALL_UPGRADES.map((def) => ({
  id: def.id,
  name: def.name,
  tag: def.tag,
  kind: def.kind || 'upgrade',
  description: def.describe(),
}));

/** Persistent record of enemies and upgrades the player has encountered. */
export class CodexTracker {
  constructor() {
    const saved = loadCodex();
    this.seen = { enemies: { ...saved.enemies }, upgrades: { ...saved.upgrades } };
  }

  seeEnemy(id) {
    if (!id || this.seen.enemies[id]) return false;
    this.seen.enemies[id] = true;
    saveCodex(this.seen);
    return true;
  }

  seeUpgrades(ids) {
    let changed = false;
    for (const id of ids) {
      if (!id || this.seen.upgrades[id]) continue;
      this.seen.upgrades[id] = true;
      changed = true;
    }
    if (changed) saveCodex(this.seen);
    return changed;
  }

  snapshot() {
    return {
      enemies: ENEMY_ENTRIES.map((entry) => ({ ...entry, seen: Boolean(this.seen.enemies[entry.id]) })),
      upgrades: UPGRADE_ENTRIES.map((entry) => ({ ...entry, seen: Boolean(this.seen.upgrades[entry.id]) })),
    };
  }
}
