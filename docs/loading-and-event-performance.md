# Loading feedback and event stalls

Start now displays a persistent loading screen with real preparation stages.
The indicator stays until resources are ready, prevents repeated starts, and
automatically enters play. Failure leaves a readable error and reload action.
The overlay supports reduced motion, keyboard focus, and safe-area padding.

Evidence and key lights now remain in the scene with zero intensity after
collection, preserving the compiled lighting configuration. Opening doors
updates existing wall instances and the shadow cache instead of rebuilding
the entire level. Permanent wall dressing excludes opening spans so it cannot
float across an unlocked passage. The collision grid remains authoritative.

The initial loading pass uploads offscreen scenery and concealed scare meshes.
Authored enemies for the starting floor are also built and uploaded before
play, then assigned to their actual simulation entities when waves spawn.
This moves first-use work out of pickups, turns, scares, and wave arrivals.

## Verification

- `node tests/menu-loading.mjs`: delayed asset, persistent loading beyond the
  old toast timeout, duplicate-start prevention, actual stage changes,
  automatic entry, reduced motion, and an injected failure.
- Loading fits 1440×900, 1024×768, 390×844, and 844×390 without overflow.
  Screenshots and fit measurements: `.logs/menu-loading/`.
- `node tests/weapon-pickup-game.mjs`: normal frame-loop collection of Breach,
  Wake, both Foundry records, and the Foundry Key. Notifications, ownership,
  continued simulation, hidden displays, and disabled lights pass. No new
  shader programs, browser errors, or level replacement during collection.
- `node tests/event-performance.mjs`: synchronized GPU measurements of
  evidence, key, door opening/closing, all eight weapons, a scare, and waves.
  Reports: `.logs/event-performance-before.json` and `-after.json`.
- Five-floor door tests check opening, closing, and reopening against the
  authoritative wall list while retaining geometry and instance buffers.
- Engine, map traversal, dressing, architecture, door, and enemy animation
  tests pass. Build: `node build.mjs`.

The baseline captured 38 new shader programs on evidence pickup and 36 on key
pickup, plus a full world rebuild for the key. Both now avoid shader creation,
GPU buffer/texture allocation, and world replacement. Final local samples:
evidence 34.4 ms, key 20.2 ms, doors 14–20.6 ms, scare 23.2 ms, and four wave
arrivals 14.4–21.1 ms. Before actor preparation, a wave arrival took 157.3 ms.
All measured events produced zero new shader programs, buffers, or textures.
The eight-weapon firing sweep took 197 ms total across its nine rendered frames.
Headless timings are
local diagnostic samples with GPU synchronization, not an FPS guarantee.
Later-floor loading and general sustained combat performance are not covered
by the starting-floor browser measurements.

## Reference ledger

All read successfully from `C:/Users/wolfk/.codex/skills/`:

- `threejs-game-ui-designer/references/ui-patterns.md`
- `threejs-game-ui-designer/references/checklists/game-ui-quality.md`
- `threejs-game-ui-designer/references/checklists/hud-readability.md`
- `threejs-game-ui-designer/references/checklists/responsive-ui-fit.md`
- `threejs-game-ui-designer/references/checklists/mobile-input.md`
- Debug profiler references listed in `weapon-pickup-fix.md` were reused for
  source ownership, browser errors, shader/buffer counts, and before/after
  event measurements.

States covered: menu, loading, preparation error, entry to gameplay, pickup
notification, and door transitions. Existing title art is retained; the loading
screen uses CSS and typography. Tests run in separate browser processes and do
not navigate the user's game tab or restart its server.
