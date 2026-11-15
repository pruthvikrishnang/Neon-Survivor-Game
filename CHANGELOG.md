# Changelog

All notable changes to Neon Survivor are documented here.

## [1.3.0] - 2026-11-15

### Added

- Four selectable weapons: Pulse, Scatter, Lance, and orbiting blades, each with distinct stats and upgrade pools.
- Dasher, bomber, and summoner enemies with windup charges, fuse explosions, and minion spawning.
- Warden, Weaver, and Colossus boss rotation with radial, aimed-fan, and spiral patterns plus a 50% health phase change.
- Crit, explosive, burn, and orbit-reach upgrades, plus Rail Detonator and Thermal Cascade synergies.
- Apex Protocol and Event Horizon evolutions at player levels 10 and 20.
- Persistent Codex for encountered enemies, bosses, and upgrade cards, saved in `localStorage`.
- Weapon select cards, Codex screens from menu/pause, and evolution card styling.

### Changed

- Split config, weapons, enemies, particles, game, and UI into focused modules; original import paths remain available through barrels.
- Split `style.css` into `style/base.css`, `hud.css`, `screens.css`, `levelup.css`, and `codex.css`.
- Split the Node tests into core, behavior, depth, and harness modules.
- New enemy unlocks are layered into wave composition: dashers wave 4, bombers wave 6, summoners wave 8.
- Tank splits and summoner minions reveal the Mite Codex entry; boss encounters reveal the specific boss kind.
- README structure, features, controls, architecture, testing, and limitations updated.

### Verified

- `node tests/logic.test.js`: 26/26 tests pass.
- Headless Chrome: menu, four weapon cards, weapon selection, start, pause, Codex open/close, resume, and no console exceptions.
- Source files remain under 300 lines; legacy pre-split files removed.

## [1.2.0] - 2026-11-15

### Added

- Hit-stop on boss hits, boss deaths, and tank deaths, driven by simulation time only.
- Spawn telegraphs: pulsing warning markers that resolve into enemies after 0.5s and keep the wave open until resolved.
- Floating damage numbers that reuse the particle pool.
- `Space`/`Shift` and a touch-button dash with brief invulnerability, a cooldown ring, and a dash sound.
- Pooled bullet trails for player and enemy shots.
- Low-HP red danger vignette that pulses harder as health drops.
- Slow-motion on level-up (after the upgrade overlay closes) and boss death.
- `src/time.js` `TimeScale` controller with pause > hit-stop > slow-motion priority.

### Changed

- Spawn placement now rejects positions closer than 220px to the player.
- Wave clear waits for pending telegraphs as well as live enemies.
- The movement vector is read once per simulation frame and shared by dash checks and player movement.
- Particles and bullet trails update on real time, so hit-stop and slow-motion do not freeze visual feedback.
- README controls, feature list, architecture, structure, and limitations updated.

### Verified

- `node tests/logic.test.js`: 17/17 tests pass.
- Headless Chrome feature checks: keyboard dash starts invulnerability/cooldown, boss hit triggers hit-stop and damage text, boss death triggers slow-motion, danger overlay and dash button render without exceptions.
- Headless Chrome startup, layout, input, race-guard, transitions, and 320-enemy stress checks pass with `ISSUES []`.

## [1.1.0] - 2026-11-15

### Added

- `src/config.js` as the single source of truth for gameplay, wave scaling, enemy stats, colors, audio, input, UI, storage, and server defaults.
- `CHANGELOG.md` and `DECISIONS.md` to record release notes and design decisions.
- A documented branch-based workflow for future changes.

### Changed

- Player, enemies, weapons, particles, game orchestration, input, UI, audio, storage, the game loop, and the Node server now consume centralized config values.
- README project structure now lists the config and project-history files.

### Verified

- `node tests/logic.test.js`: 14/14 tests pass.
- Deterministic logic snapshot before and after the refactor: identical.
- Headless Chrome smoke test: menu, start, five-minute simulated run, pause/resume, menu, game-over transitions, and no console errors.
- Headless Chrome layout, input, race-guard, and 320-enemy stress checks pass.
- Shared all-time-best server restarted cleanly and reports `0`.
