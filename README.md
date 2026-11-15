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
| `Esc` / `P` | Pause or resume |
| `M` | Mute / unmute |
| `Enter` / `Space` | Start from menu, or restart after game over |
| `R` | Restart after game over |
| Touch, left half | Virtual joystick |
| Touch, right half | Drag to aim and fire; auto-aims when idle |

## Features

- Wave-based survival with chasers, ranged shooters, armored tanks, and a boss every five waves.
- Boss fights with radial bullet bursts, aimed volleys, and a health bar.
- Automatic firing with rapid fire while the mouse is held.
- XP gems, level-ups, and a three-card upgrade draft.
- Seven stackable upgrade tracks: fire rate, damage, multishot, pierce, move speed, max HP, and magnet radius.
- Score combo multiplier that decays when kills stop.
- Player health, invulnerability frames, contact damage, and enemy projectiles.
- Procedurally drawn arena, glowing grid, vignette, particles, explosions, and screen shake.
- Procedural Web Audio sound effects with persisted mute and volume settings.
- Shared all-time best persisted by the Node server in `data/all-time-best.json`, with `localStorage` fallback and migration when the server is unavailable.
- Fixed-step 60 Hz simulation, catch-up limiting, and automatic pause when the tab loses visibility.
- Responsive 16:9 letterboxed canvas with desktop, keyboard, mouse, and basic multitouch support.
- Object pooling for bullets, particles, and XP gems to keep late waves smooth.

## Project structure

```text
neon-survivor/
  index.html           Canvas, HUD, menus, upgrade picker, and overlays
  style.css            Neon UI, responsive 16:9 layout, transitions
  server.mjs           Static server plus all-time-best API
  data/
    all-time-best.json Shared persisted all-time best score (created automatically)
  README.md
  src/
    main.js            Boot, event wiring, fixed-timestep game loop
    game.js            State machine, waves, scoring, upgrades, rendering
    best.js            Local/server all-time best synchronization
    player.js          Movement, stats, health, XP, upgrades, ship drawing
    enemies.js         Wave composition, spawning, enemy AI, bosses
    weapons.js         Bullets, collision broad phase, upgrades
    particles.js       Particle/gem pools, enemy drawing helpers
    audio.js           Procedural Web Audio sound effects
    input.js           Keyboard, mouse, and touch input
    ui.js              DOM HUD and screens, procedural background helpers
    storage.js         Local storage and all-time-best API client
  tests/
    logic.test.js      Dependency-free Node logic tests
```

## Architecture and design decisions

- **Fixed internal resolution.** The simulation and canvas are always 1600x900. CSS scales the stage to the viewport while preserving 16:9, so gameplay coordinates never depend on window size.
- **Fixed timestep.** `main.js` runs updates at a fixed 60 Hz with an accumulator, clamps long frames, and limits catch-up steps. This keeps physics, collision, and balance deterministic across refresh rates.
- **No camera.** The arena is intentionally a single fixed screen. This keeps the arcade-siege feel, simplifies touch controls, and ensures every threat is visible.
- **Always-on auto-fire.** The ship fires toward the cursor automatically; holding the mouse increases the fire rate. This keeps the game playable with one hand and makes the upgrade draft the main source of tactical choice.
- **Broad-phase collisions.** Enemies are inserted into a uniform spatial grid. Player bullet queries include a margin for large enemies so tanks and bosses cannot be missed when their centers sit in adjacent cells.
- **Wave spawning is drip-fed.** Wave composition is capped and enemies are released gradually. This avoids a single-frame spawn spike while still filling the arena during long waves.
- **Bosses use scripted patterns.** Bosses alternate radial bursts and aimed multi-shot volleys, with attack timing and enrage behavior scaled by wave. They are deliberately one-per-wave and telegraphed by a banner.
- **Pooled effects and projectiles.** Bullet, particle, and gem pools recycle the oldest entries when full, trading absolute fidelity in extreme cases for stable memory and frame time.
- **Procedural identity.** The entire visual language comes from canvas primitives, gradients, glow strokes, and generated UI styling. Audio is synthesized with oscillators and noise buffers, so the project has zero binary assets.
- **Persistent all-time best.** `server.mjs` exposes `GET /api/best` and `POST /api/best`. It stores only the highest submitted score in `data/all-time-best.json`; reloads and restarts read that file, so a new lower score cannot become the high score. The browser also keeps a local copy and merges it upward on startup, so an existing local best seeds the server and a server best replaces stale browser data. With plain static hosting, the game silently falls back to per-browser `localStorage`.
- **Safe failure handling.** All storage and API access is wrapped. If `localStorage` is blocked or the persistence server is unreachable, scores and settings still work in memory and local storage for the session.
- **Testable logic.** Wave math, scaling, collision, spatial queries, upgrade application, XP thresholds, boss patterns, and storage fallbacks are separated from the DOM and covered by Node tests.

## Testing

Run the logic tests with Node (no packages required):

```powershell
node tests/logic.test.js
```

The suite covers circle overlap, adjacent-cell spatial queries, wave composition and caps, enemy scaling, upgrade stacking and caps, upgrade rolling, player levelling, boss attack patterns, and storage fallbacks.

The game has also been exercised in headless Chrome for startup, real menu clicks, a five-minute simulated run, pause/resume/menu/game-over transitions, all-time-best persistence across reloads and cleared local storage, a 320-enemy stress scenario, and the server API across restarts with no console errors.

For automation, the running game is exposed as `window.neonSurvivor`. This is intentional and useful for debugging; it is not required for normal play.

## Known limitations

- The arena is fixed at 1600x900 with no scrolling or camera.
- Touch support provides a joystick and right-side aim/fire, but there is no dedicated fullscreen button or mobile-specific UI layout.
- Only the all-time best and audio settings persist; there is no run save, meta-progression, or unlock system.
- The shared all-time best requires running `server.mjs`. Plain static hosting falls back to browser-local persistence, so different browsers or cleared browser data can differ without the Node server.
- Pools cap bullets, particles, and gems. In extreme late-game situations, the oldest effects are recycled.
- Difficulty ramps continuously with wave number; there is no difficulty selector.
- Audio starts only after a user gesture, as required by browser autoplay policies.
- Balance is tuned for short arcade runs and is not intended to be a long-session roguelite.
