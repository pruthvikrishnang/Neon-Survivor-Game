# Decisions

## 2026-11-15: Depth pass with four weapons and level-gated evolutions

### Context

The game had one projectile pattern and seven generic upgrades. New enemies and bosses would add little variety if every run still drafted the same cards.

### Decision

Add Pulse, Scatter, Lance, and orbiting blades. Each weapon declares its own upgrade pool, fire pattern, and derived stats in `src/config/weapons.js`. Add weapon-specific upgrades, two conditional synergies, and evolutions that appear only at levels 10 and 20. Evolution cards are forced to the front of the draft and replace a regular slot.

### Consequences

- Weapon choice changes both combat range and the available draft.
- Synergies require explicit prerequisite levels, so they read as build goals rather than random power spikes.
- Evolutions are rare enough to feel like run-defining moments without adding a separate meta tree.
- All the new tuning stays in config modules rather than spreading through gameplay code.

## 2026-11-15: Persistent Codex without permanent power

### Context

Players had no record of what they had encountered, and the game had no lightweight reason to keep playing across runs.

### Decision

Track seen enemies, boss kinds, and upgrade cards in `localStorage` under a dedicated key. The Codex is informational only: it never grants stats or unlocks. Boss entries use the boss kind, while tank splits and summoner minions reveal the Mite entry. Storage failures degrade to in-memory progress for the session.

### Consequences

- Discovery persists without turning the game into a permanent-progression grind.
- Corrupt or blocked storage cannot break a run.
- Codex writes happen only when a new entry is seen, so repeated spawns do not hit storage every frame.

## 2026-11-15: Boss rotation and readable phase changes

### Decision

Cycle Warden, Weaver, and Colossus across boss waves. Each kind owns three patterns and an enraged phase triggered once below 50% health. Phase two increases projectile count or spread, raises speed, and shortens the attack cycle.

### Consequences

- Boss waves stay surprising across a longer run.
- The 50% threshold gives a clear mid-fight escalation point.
- Pattern data lives in config, while `src/bosses/index.js` only executes it.

## 2026-11-15: Split modules behind stable barrels

### Context

Several files had crossed 300 lines, and the depth pass would add more code.

### Decision

Split config, weapons, enemies, particles, game orchestration, and UI into focused modules. Keep the original files as thin re-export barrels so imports, tests, and debugging hooks keep working. Split CSS by responsibility and load the files in order from `index.html`.

### Consequences

- Every source, style, test, and HTML file stays under 300 lines.
- Import paths such as `./src/weapons.js` and `./src/config.js` remain stable.
- Tests split into focused suites under `tests/lib/` while `node tests/logic.test.js` remains the entry point.

## 2026-11-15: Centralize tunable values in `src/config.js`

### Context

Gameplay tuning was spread across player, enemy, weapon, particle, game, input, UI, audio, storage, and server modules. Changing one balance value required finding every duplicated number and risked inconsistent behavior.

### Decision

All gameplay tuning, colors, wave scaling, spawn rates, damage, HP, audio parameters, UI timings, storage keys, and server defaults live in `src/config.js`, grouped by domain.

Pure structural values remain local: loop indices, unit conversions, array offsets, `Math.PI`, zero comparisons, and path geometry that only describes a shape. These are not tuning knobs and moving them would make the render code harder to read without improving balance control.

### Consequences

- Balance changes now happen in one file.
- Module-level exports such as `BASE_STATS`, `ENEMY_TYPES`, and `UPGRADES` are preserved by re-exporting config values, so existing tests and debug code keep working.
- Config is a reference layer, not executable game logic. It was later split into domain modules behind `src/config.js` when it exceeded the 300-line guideline.
- No new dependencies or build step were introduced.

## 2026-11-15: Preserve behavior during the config refactor

### Decision

Before changing code, capture a deterministic snapshot of wave composition, enemy scaling, player stats and upgrades, enemy spawning and attacks, collision behavior, and upgrade metadata. After the refactor, regenerate the snapshot with the same random seed and compare hashes.

### Verification

The before and after snapshots are byte-identical. `node tests/logic.test.js` passes 14/14, and headless Chrome checks cover the live menu, gameplay loop, transitions, input, and a 320-enemy stress scenario without console errors.

## 2026-11-15: Separate simulation time from visual time

### Context

Hit-stop and slow-motion should change gameplay timing without freezing screen shake, particle bursts, damage numbers, bullet trails, or the HUD. Pauses must still stop everything.

### Decision

`TimeScale` converts real frame time into simulation time. The game update consumes simulation time for player, enemies, weapons, gems, combo, and wave logic, but advances particles, trails, shake, hit flash, and boss hit-stop cooldowns with real time. Priority is hard pause/level-up overlay, then hit-stop, then slow-motion, then normal time.

### Consequences

- Time scaling remains testable outside the DOM.
- Visual effects continue during hit-stop, making impacts read better.
- Paused time does not consume hit-stop or slow-motion timers.
- Level-up slow-motion starts with the overlay and becomes visible for its remaining duration after the player picks an upgrade. This is intentional and should be playtested.

## 2026-11-15: Telegraph every normal spawn but keep tank splits immediate

### Context

Enemies appearing at the arena edge without warning can feel unfair, especially when the player is cornered.

### Decision

Normal wave spawns create a 0.5s pulsing telegraph at a position at least 220px from the player, then spawn the enemy there. Pending telegraphs count as not-cleared for wave completion and against the alive cap. Tank split minis remain immediate direct spawns because they are death effects, not new wave arrivals.

### Consequences

- Waves take slightly longer to clear and peak alive count is unchanged.
- Players get a visual warning and a fair chance to reposition.
- Boss telegraphs use the boss spawn point when it is safe, otherwise a safe edge position.

## 2026-11-15: Development workflow

- Start each task on a new branch.
- Keep changes small and run `node tests/logic.test.js` before committing.
- Update `CHANGELOG.md` for every task.
- Commit with a clear, scoped message.
- Never commit runtime `data/all-time-best.json`, logs, or dependencies.
- Never leave the game broken; verify the browser flow when gameplay or rendering changes.

## Known limitation: static GitHub Pages hosting

GitHub Pages serves the game as static files and cannot run `server.mjs`. On the live site, the all-time best falls back to per-browser `localStorage`. The shared server-persisted score remains available when running the included Node server locally or on a Node-capable host.
