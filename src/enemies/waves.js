import { ENEMIES } from '../config.js';

export const ENEMY_TYPES = ENEMIES.types;
export const WAVE_KEYS = Object.freeze(['shooters', 'tanks', 'dashers', 'bombers', 'summoners']);

/** @param {number} wave @returns {{boss:boolean, total:number}} */
export function waveComposition(wave) {
  const cfg = ENEMIES.composition;
  const w = Math.max(1, Math.floor(wave));
  const cap = Math.min(ENEMIES.maxWaveTotal, cfg.baseTotal + w * cfg.perWave);
  const counts = {};
  let assigned = 0;
  for (const key of WAVE_KEYS) {
    const rule = cfg[key];
    const count = w >= rule.unlockWave
      ? Math.min(
        rule.base + Math.floor((w - rule.unlockWave) * rule.every),
        Math.floor(cap * rule.maxShare),
      )
      : 0;
    counts[key] = count;
    assigned += count;
  }
  const chasers = Math.max(1, cap - assigned);
  return {
    chasers,
    shooters: counts.shooters,
    tanks: counts.tanks,
    dashers: counts.dashers,
    bombers: counts.bombers,
    summoners: counts.summoners,
    boss: w % cfg.bossEvery === 0,
    total: chasers + assigned,
  };
}

export function bossCycleIndex(wave) {
  const w = Math.max(1, Math.floor(wave));
  const encounter = Math.floor(w / ENEMIES.composition.bossEvery) - 1;
  const length = ENEMIES.bossKinds.length;
  return ((encounter % length) + length) % length;
}

export function bossKindForWave(wave) {
  return ENEMIES.bossKinds[bossCycleIndex(wave)];
}

export function enemyScaling(wave) {
  const cfg = ENEMIES.scaling;
  const w = Math.max(1, Math.floor(wave));
  return {
    hp: 1 + (w - 1) * cfg.hpPerWave,
    speed: Math.min(cfg.speedMax, 1 + (w - 1) * cfg.speedPerWave),
    damage: 1 + (w - 1) * cfg.damagePerWave,
  };
}
