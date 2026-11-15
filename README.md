# Neon Survivor

A complete, dependency-free top-down arena survival shooter built with HTML5 Canvas and vanilla ES modules. Survive escalating waves, collect XP, draft upgrades, and burn down bosses in a neon grid arena.

No build step, no external assets, no CDNs, no image or audio files. Every sprite, effect, and sound is generated procedurally at runtime.

## Play for free

Try **Neon Survivor** for free in your browser — no install or signup:

https://pruthvikrishnang.github.io/Neon-Survivor-Game/

The live GitHub Pages version keeps your best score in browser `localStorage`. For the shared server-side all-time best, run the included Node server below.

## Run

ES modules require an HTTP origin, so open the game through a local server rather than double-clicking `index.html`.

For the shared, server-persisted all-time best score, use the included dependency-free Node server:

```powershell
cd neon-survivor
node server.mjs
```

Then open <http://127.0.0.1:8765>.

The all-time best is stored in `data/all-time-best.json` and survives browser refreshes, closed games, browser-data clearing, and server restarts. The game reads the file at startup and only grows the record; a lower new score can never replace it. You can also edit that file directly while the server is stopped.

Any static server still runs the game, but only the Node server provides the shared persistent all-time best. With a plain static server, the best score falls back to per-browser `localStorage`:

```powershell
python -m http.server 8000
```

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Move |
| Mouse | Aim; the ship auto-fires |
| Hold left mouse | Rapid fire |
| `Space` / `Shift` | Dash with brief invulnerability |
| `Esc` / `P` | Pause or resume |
| `M` | Mute / unmute |
| `Enter` / `Space` | Start from menu, or restart after game over |
| `R` | Restart after game over |
| Codex button | Open persistent encounter log from menu or pause |
| Touch, left half | Virtual joystick |
| Touch, right half | Drag to aim and fire; auto-aims when idle |
| Touch dash button | Dash; shows a cooldown ring until ready |

## Features

- Wave-based survival with chasers, ranged shooters, armored tanks, charging dashers, exploding bombers, summoners, and a boss every five waves.
- Three rotating bosses (Warden, Weaver, Colossus) with distinct attack patterns and a 50% health phase change.
- Four selectable weapons: balanced Pulse, close-range Scatter, piercing Lance, and orbiting blades.
- Automatic firing with rapid fire while the mouse is held.
- XP gems, level-ups, and a three-card upgrade draft.
- Eleven stackable upgrade tracks, including crit, explosive rounds, burn, and orbit reach, plus two conditional synergies.
- Rare Apex Protocol and Event Horizon evolutions at levels 10 and 20.
- Persistent Codex that records enemies and upgrades encountered across runs in `localStorage`.
- Score combo multiplier that decays when kills stop.
- Player health, invulnerability frames, contact damage, and enemy projectiles.
- Procedurally drawn arena, glowing grid, vignette, particles, explosions, and screen shake.
- Game-feel layer: hit-stop on boss/tank impacts, spawn warning markers, floating damage numbers, bullet trails, a dash with cooldown ring, low-HP danger pulse, and slow-motion on level-up and boss death.
- Procedural Web Audio sound effects with persisted mute and volume settings.
- Shared all-time best persisted by the Node server in `data/all-time-best.json`, with `localStorage` fallback and migration when the server is unavailable.
- Fixed-step 60 Hz simulation, catch-up limiting, and automatic pause when the tab loses visibility.
- Responsive 16:9 letterboxed canvas with desktop, keyboard, mouse, and basic multitouch support.
- Object pooling for bullets, particles, and XP gems to keep late waves smooth.

## Project structure

```text
neon-survivor/
  index.html           Canvas, HUD, menus, weapon select, Codex, and overlays
  style/
    base.css           Variables, layout, shared screens, and buttons
    hud.css            HUD, health/XP bars, boss bar, and wave banner
    screens.css        Menu, pause, game-over, stats, and weapon select
    levelup.css        Upgrade draft cards and evolution styling
    codex.css          Persistent Codex layout
  server.mjs           Static server plus all-time-best API
  data/
    all-time-best.json Shared persisted all-time best score (created automatically)
  README.md
  CHANGELOG.md         Release notes and verification history
  DECISIONS.md         Design decisions and development workflow
  src/
    config.js          Barrel over the split config modules
    config/            Core, player, enemy, weapon, upgrade, UI, audio, particle tuning
    time.js            Hit-stop and slow-motion time scaling
    main.js            Boot, event wiring, fixed-timestep game loop
    game.js            Barrel over game state, combat, and render modules
    game/              State machine, combat events, render orchestration
    best.js            Local/server all-time best synchronization
    player.js          Movement, weapon stats, health, XP, evolutions, ship drawing
    codex.js           Persistent enemy/upgrade encounter tracker
    enemies.js         Barrel over wave, placement, AI, lifecycle, and render modules
    enemies/           Wave composition, spawning, enemy AI, boss integration
    bosses/index.js    Boss movement, attack patterns, and phase changes
    weapons.js         Barrel over grid, pools, upgrades, and weapon system
    weapons/           Spatial grid, bullets, pools, orbiting blades, upgrade logic
    particles.js       Barrel over particle/gem pools and enemy drawing
    particles/         Particle pool, gem pool, enemy shapes, and draw helpers
    audio.js           Procedural Web Audio sound effects
    input.js           Keyboard, mouse, and touch input
    ui.js              Barrel over DOM UI, backgrounds, reticle, and Codex view
    ui/                HUD, screens, weapon cards, Codex renderer, backgrounds
    storage.js         Local storage, Codex, and all-time-best API client
  tests/
    logic.test.js      Dependency-free Node test runner
    lib/               Split core, behavior, depth, and harness tests
```

## Architecture and design decisions

- **Fixed internal resolution.** The simulation and canvas are always 1600x900. CSS scales the stage to the viewport while preserving 16:9, so gameplay coordinates never depend on window size.
- **Fixed timestep.** `main.js` runs updates at a fixed 60 Hz with an accumulator, clamps long frames, and limits catch-up steps. This keeps physics, collision, and balance deterministic across refresh rates.
- **Simulation time vs real time.** Gameplay runs through `TimeScale`, so hit-stop freezes only simulation while rendering, shake decay, particles, trails, and the HUD keep animating. Priority is pause/level-up, then hit-stop, then slow-motion.
- **No camera.** The arena is intentionally a single fixed screen. This keeps the arcade-siege feel, simplifies touch controls, and ensures every threat is visible.
- **Always-on auto-fire.** Projectile weapons fire toward the cursor automatically; holding the mouse increases the fire rate. Orbit blades trade range for persistent contact damage. This keeps the game playable with one hand and makes the upgrade draft the main source of tactical choice.
- **Weapon-specific upgrade pools.** Each weapon declares which upgrades it can roll, so Scatter does not offer rail pierce and Pulse does not offer burn. Synergies appear only when their prerequisite levels are met, and evolutions replace a regular card at levels 10 and 20.
- **Broad-phase collisions.** Enemies are inserted into a uniform spatial grid. Player bullet queries include a margin for large enemies so tanks and bosses cannot be missed when their centers sit in adjacent cells.
- **Wave spawning is drip-fed.** Wave composition is capped and enemies are released gradually. This avoids a single-frame spawn spike while still filling the arena during long waves.
- **Bosses rotate and phase.** Warden, Weaver, and Colossus cycle across boss waves with different radial, aimed-fan, and spiral patterns. Each boss enrages at 50% health, adds projectiles, and shortens its attack cycle. They are deliberately one-per-wave and telegraphed by a banner.
- **Pooled effects and projectiles.** Bullet, particle, and gem pools recycle the oldest entries when full, trading absolute fidelity in extreme cases for stable memory and frame time.
- **Procedural identity.** The entire visual language comes from canvas primitives, gradients, glow strokes, and generated UI styling. Audio is synthesized with oscillators and noise buffers, so the project has zero binary assets.
- **Persistent all-time best.** `server.mjs` exposes `GET /api/best` and `POST /api/best`. It stores only the highest submitted score in `data/all-time-best.json`; reloads and restarts read that file, so a new lower score cannot become the high score. The browser also keeps a local copy and merges it upward on startup, so an existing local best seeds the server and a server best replaces stale browser data. With plain static hosting, the game silently falls back to per-browser `localStorage`.
- **Persistent Codex.** Encountered enemy types and upgrade cards are saved separately from run state, so the Codex survives restarts without adding permanent power. Boss Codex entries use the boss kind (Warden, Weaver, Colossus), and tank splits reveal the Mite entry.
- **Safe failure handling.** All storage and API access is wrapped. If `localStorage` is blocked or the persistence server is unreachable, scores, settings, and Codex progress still work in memory for the session.
- **Testable logic.** Wave math, scaling, collision, spatial queries, weapon stats, upgrade availability, evolutions, Codex persistence, boss phases, and storage fallbacks are separated from the DOM and covered by Node tests.
- **Central tuning, split modules.** Gameplay constants, colors, audio parameters, UI timings, persistence keys, and server defaults live under `src/config/`; existing imports still resolve through `src/config.js`. Pure mathematical and rendering geometry stays close to its drawing code.

## Tuning

Gameplay balance, enemy scaling, spawn rates, weapon definitions, upgrade pools, colors, audio, UI timings, storage keys, and server defaults are centralized under `src/config/` and re-exported from `src/config.js`. Change values there instead of editing individual modules.

## Testing

Run the logic tests with Node (no packages required):

```powershell
node tests/logic.test.js
```

The suite covers circle overlap, adjacent-cell spatial queries, wave composition and caps, enemy scaling, upgrade stacking and caps, upgrade rolling, player levelling, boss attack patterns and phase changes, dash cooldown/invulnerability timing, hit-stop countdown and priority, telegraph-to-spawn transitions, weapon selection, crit/explosive/reach stats, synergy requirements, evolutions, orbit cooldowns, bomber/summoner/burn behavior, Codex persistence, and storage fallbacks.

The game has also been exercised in headless Chrome for startup, weapon selection, start/pause/Codex/resume transitions, no console errors, and earlier all-time-best persistence, 320-enemy stress, and server API checks.

For automation, the running game is exposed as `window.neonSurvivor`. This is intentional and useful for debugging; it is not required for normal play.

## Known limitations

- The arena is fixed at 1600x900 with no scrolling or camera.
- Touch support provides a joystick, right-side aim/fire, and a dash button, but there is no dedicated fullscreen button or mobile-specific UI layout.
- The all-time best, audio settings, and Codex persist; there is no run save, permanent stat progression, or unlock system.
- The shared all-time best requires running `server.mjs`. Plain static hosting falls back to browser-local persistence, so different browsers or cleared browser data can differ without the Node server.
- Pools cap bullets, particles, trails, and gems. In extreme late-game situations, the oldest effects are recycled.
- Difficulty ramps continuously with wave number; there is no difficulty selector.
- Audio starts only after a user gesture, as required by browser autoplay policies.
- Balance is tuned for short arcade runs and is not intended to be a long-session roguelite.
