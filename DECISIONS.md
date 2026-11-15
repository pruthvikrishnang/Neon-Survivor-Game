# Decisions

## 2026-11-15: Centralize tunable values in `src/config.js`

### Context

Gameplay tuning was spread across player, enemy, weapon, particle, game, input, UI, audio, storage, and server modules. Changing one balance value required finding every duplicated number and risked inconsistent behavior.

### Decision

All gameplay tuning, colors, wave scaling, spawn rates, damage, HP, audio parameters, UI timings, storage keys, and server defaults live in `src/config.js`, grouped by domain.

Pure structural values remain local: loop indices, unit conversions, array offsets, `Math.PI`, zero comparisons, and path geometry that only describes a shape. These are not tuning knobs and moving them would make the render code harder to read without improving balance control.

### Consequences

- Balance changes now happen in one file.
- Module-level exports such as `BASE_STATS`, `ENEMY_TYPES`, and `UPGRADES` are preserved by re-exporting config values, so existing tests and debug code keep working.
- The config file is intentionally larger than other modules. It is a reference file, not executable game logic.
- No new dependencies or build step were introduced.

## 2026-11-15: Preserve behavior during the config refactor

### Decision

Before changing code, capture a deterministic snapshot of wave composition, enemy scaling, player stats and upgrades, enemy spawning and attacks, collision behavior, and upgrade metadata. After the refactor, regenerate the snapshot with the same random seed and compare hashes.

### Verification

The before and after snapshots are byte-identical. `node tests/logic.test.js` passes 14/14, and headless Chrome checks cover the live menu, gameplay loop, transitions, input, and a 320-enemy stress scenario without console errors.

## 2026-11-15: Development workflow

- Start each task on a new branch.
- Keep changes small and run `node tests/logic.test.js` before committing.
- Update `CHANGELOG.md` for every task.
- Commit with a clear, scoped message.
- Never commit runtime `data/all-time-best.json`, logs, or dependencies.
- Never leave the game broken; verify the browser flow when gameplay or rendering changes.

## Known limitation: static GitHub Pages hosting

GitHub Pages serves the game as static files and cannot run `server.mjs`. On the live site, the all-time best falls back to per-browser `localStorage`. The shared server-persisted score remains available when running the included Node server locally or on a Node-capable host.
