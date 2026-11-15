# Changelog

All notable changes to Neon Survivor are documented here.

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
