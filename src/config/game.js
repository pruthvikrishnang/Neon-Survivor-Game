export const GAME = Object.freeze({
  bossEvery: 5,
  intermission: 2.4,
  waveBonus: 25,
  waveClearHeal: 6,
  comboStep: 0.1,
  comboMax: 20,
  comboLimit: 99,
  comboDuration: 3,
  fallbackHeal: 30,
  aimFallbackDistance: 200,
  shakeDecay: 55,
  hitFlashDecay: 2.4,
  hitFlashDuration: 0.42,
  hitFlashAlpha: 0.35,
  shake: Object.freeze({ hit: 9, bossDeath: 18, tankDeath: 5, death: 2.5 }),
  bursts: Object.freeze({
    shoot: Object.freeze({ count: 2, speed: 90, life: 0.16, offset: 22 }),
    enemyShoot: Object.freeze({ count: 2, speed: 70, life: 0.2 }),
    hurt: Object.freeze({ count: 12, speed: 140, life: 0.45 }),
    explode: Object.freeze({ count: 18, speed: 240, life: 0.5 }),
  }),
  deathBurst: Object.freeze({
    bossCount: 60,
    tankCount: 26,
    count: 14,
    bossSpeed: 340,
    speed: 210,
    bossLife: 0.9,
    life: 0.6,
    bossGemCount: 6,
    bossGemRadius: 48,
    bossGemValue: 8,
  }),
});

export const STORAGE = Object.freeze({
  bestKey: 'neon-survivor:best',
  settingsKey: 'neon-survivor:settings',
  codexKey: 'neon-survivor:codex',
  defaultSettings: Object.freeze({ volume: 0.6, muted: false }),
});

export const SERVER = Object.freeze({
  defaultPort: 8765,
  defaultHost: '127.0.0.1',
  apiPath: '/api/best',
  maxBodyBytes: 2048,
  jsonIndent: 2,
});
