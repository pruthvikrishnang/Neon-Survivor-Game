# Changelog

All notable changes to Neon Survivor are documented here.

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
