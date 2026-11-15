import { SERVER, STORAGE } from './config.js';

const BEST_KEY = STORAGE.bestKey;
const SETTINGS_KEY = STORAGE.settingsKey;
const CODEX_KEY = STORAGE.codexKey;
const DEFAULT_SETTINGS = STORAGE.defaultSettings;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the persisted best score. Returns 0 when storage is unavailable or corrupt.
 * @returns {number}
 */
export function loadBest() {
  const value = readJSON(BEST_KEY, 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Persist a best score. Safe when localStorage is blocked or full.
 * @param {number} score
 * @returns {boolean} true when the value was written
 */
export function saveBest(score) {
  if (!Number.isFinite(score)) return false;
  return writeJSON(BEST_KEY, Math.max(0, Math.floor(score)));
}

/**
 * Load audio settings with validation and defaults.
 * @returns {{volume: number, muted: boolean}}
 */
export function loadSettings() {
  const raw = readJSON(SETTINGS_KEY, null);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const volume = Number(raw.volume);
  return {
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_SETTINGS.volume,
    muted: Boolean(raw.muted),
  };
}

/**
 * Persist audio settings. Failures are intentionally ignored.
 * @param {{volume: number, muted: boolean}} settings
 * @returns {boolean}
 */
export function saveSettings(settings) {
  if (!settings) return false;
  const volume = Number(settings.volume);
  return writeJSON(SETTINGS_KEY, {
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_SETTINGS.volume,
    muted: Boolean(settings.muted),
  });
}

/**
 * Load the persistent Codex, falling back to empty encounter sets.
 * @returns {{enemies: Record<string, boolean>, upgrades: Record<string, boolean>}}
 */
export function loadCodex() {
  const raw = readJSON(CODEX_KEY, null);
  if (!raw || typeof raw !== 'object') return { enemies: {}, upgrades: {} };
  return {
    enemies: raw.enemies && typeof raw.enemies === 'object' ? raw.enemies : {},
    upgrades: raw.upgrades && typeof raw.upgrades === 'object' ? raw.upgrades : {},
  };
}

/**
 * Persist Codex encounter sets. Failures are intentionally ignored.
 * @param {{enemies: Record<string, boolean>, upgrades: Record<string, boolean>}} codex
 * @returns {boolean}
 */
export function saveCodex(codex) {
  if (!codex) return false;
  return writeJSON(CODEX_KEY, {
    enemies: codex.enemies || {},
    upgrades: codex.upgrades || {},
  });
}

function validateBest(value) {
  const best = Math.floor(Number(value));
  return Number.isFinite(best) && best >= 0 ? best : null;
}

/**
 * Load the shared all-time best from the optional persistence server.
 * Returns null when the server is unavailable, as with plain static hosting.
 * @returns {Promise<number|null>}
 */
export async function loadRemoteBest() {
  try {
    const res = await fetch(SERVER.apiPath, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return validateBest(payload && payload.best);
  } catch {
    return null;
  }
}

/**
 * Submit a score to the persistence server. The server only stores growth.
 * Returns the authoritative all-time best, or null when unavailable.
 * @param {number} score
 * @returns {Promise<number|null>}
 */
export async function saveRemoteBest(score) {
  const best = validateBest(score);
  if (best === null) return null;
  try {
    const res = await fetch(SERVER.apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ score: best }),
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return validateBest(payload && payload.best);
  } catch {
    return null;
  }
}
