# Map design v6

Bell Nave now has a continuous processional aisle, with its four choir-stall cover cells placed on the flanks. The court approach is visible from the southern arrival, while the east–west crossing and four refuge positions remain usable. The actual transformed stall meshes clear the player-width corridor, rather than only the collision grid.

| Bell Nave measurement | Previous | Current |
| --- | ---: | ---: |
| South approach to court apron | 36 m, 4 turns | 28 m, 0 turns |
| East–west crossing | 28 m, 0 turns | 28 m, 0 turns |
| Low stall-role instances intersecting south lane | 8 | 0 |
| Low stall-role instances intersecting cross aisle | 0 | 0 |
| Whole-floor cover cells / walkable cells | 37 / 333 | 37 / 333 |
| Cover kit instanced draws / instance triangles | 5 / 15,836 | 5 / 15,836 |

Continuous collision clearance uses a .32-cell player radius sampled every .125 cells. It passes with both sealed and open gates. Encounter budgets, route order, keys, landmarks and opening data are retained. The detailed layout measurements and pre-existing grid-gate limitation are recorded in [map-design-v6-flow.md](map-design-v6-flow.md).

## Architecture

The room kit now plans bays from contiguous cross-sections of the actual room footprint. Both end supports must attach to physical permanent wall edges. This avoids floating supports over clipped corners and supports mounted in doorways. Bell Nave explicitly authors its bay axis along the processional route.

Foundry and surgical rooms receive wall-connected beam supports. Catacombs receive stone vault ribs; choir halls receive paired structural and bronze ribs. Their lowest assembly bounds remain above 3.6 m. The current floors have 3, 3, 5 and 8 fitted bays respectively. The fifth floor retains its existing bespoke mouth/rib sequence.

All ribs share one small geometry and the existing kit material slots. Instancing keeps the new curved shapes to one crypt batch and two choir batches. The pass adds no textures, lights, shadows or post-processing features. Fitting only supported bays also removes previous bars that crossed open shell spans. Room-kit plan, bay count and vault count remain inspectable through `DungeonPlaceKit.userData`.

## Verification

- Production build passes.
- Focused layout, topology, ingress, room progression, footprint, set dressing, visual direction and architecture checks pass. New checks cover actual transformed choir-stall bounds, deterministic bay plans, physical wall endpoints, doorway reservations, head clearance and shared resources.
- Automated browser checks pass all five floors: 13 desktop/portrait/bodycam/no-post views, nonblank scene pixels, no horizontal portrait overflow, pause/resume/restart, and zero console/page/network errors. Evidence: `output/playwright/map-design-v6-after/report.json`.
- Before views: `output/playwright/map-design-v6-before/`. An initial diagnostic attempt caught a missing runtime module in the then-current build; the clean baseline and final builds load successfully.
- The 120-second live keyboard/mouse journey passes: three rooms cleared, 35 grounded doorway arrivals, reinforcement phases played, zero deaths and zero console/page/network errors. Evidence: `output/playwright/map-design-v6-live/report.json`.
- Independent visual review passes the F4 processional lane, wall-connected vault ribs and F3 passage. Its portrait HUD review flags pre-existing touch controls overlapping the health number/bar in both before and after images. No HUD implementation changed in this request.

Full-scene counters are retained in the browser reports. The views range from roughly 194 to 561 draws because their visible rooms and actors differ. These are scene diagnostics, not evidence of an FPS improvement. The cover relocation retains identical geometry, materials and instance counts. Architecture budget checks isolate the new kit from changing actor poses. The active journey sampled 30 FPS near reinforcements and 10 FPS during sustained combat at roughly 1.49 million triangles; its portrait capture sampled 12.5 FPS. Heavy-combat performance remains limited on this host and was not optimized by this map pass.

The clearance claim applies to collision and the actual choir-stall cover meshes. Existing floor debris remains: a fallen pipe crosses the body strip below .38 m, and a flank pew edge intrudes .10 m into the conservative 1.28 m-radius strip. They do not hide the threshold at eye height in the independent review. There is no claim of zero intersections for every decorative mesh.

## Skills and phase ledger

This is a bounded map iteration, with no whole-game premium certification. Loaded skills: `threejs-game-director`, `threejs-gameplay-systems`, `threejs-aaa-graphics-builder`, `threejs-qa-release`, `threejs-skill-router`, `threejs-procedural-architecture`, under `C:/Users/wolfk/.codex/skills/`.

Applicable references loaded: gameplay workflows and physics-engine selection; graphics implementation blueprint, model recipes, render recipes, visual scorecard, procedural-model, material-lighting and performance-safe-detail checks; architecture grammar/compiler and authored tower planning example; QA/release, visual verification, playtest and release checklists. The existing custom grid collision remains the gameplay authority.

Layout phase: implemented by a focused worker, independently measured and tested. Architecture phase: implemented in the existing shared kit, with independently authored geometry/resource regressions. Visual review and QA: production browser captures, transformed mesh bounds and real input journey. UI, combat, audio and generation phases: no implementation changes for this map task. Existing assets and material roles supply the repeated structural support surfaces; no external generation or credential claim is involved.

Changed for this request: `dungeon-place-kit.js`; the F4 nave cover/sightlines/architecture axis in `playground/map/dungeon-data.js`; `tests/map-design-v6.test.mjs`, `tests/map-architecture-v6.test.mjs`, `tests/map-design-v6-browser.mjs`; these two map reports. Existing unrelated checkout changes are preserved.

## Reproduce

```powershell
node build.mjs
node --test --test-isolation=none tests/map-design-v6.test.mjs tests/map-architecture-v6.test.mjs tests/dungeon-route-topology.test.mjs tests/dungeon-footprint.test.mjs tests/dungeon-ingress.test.mjs tests/dungeon-flow.test.mjs tests/dungeon-encounter-progression.test.mjs tests/map-flow-v5.test.mjs tests/dungeon-art.test.mjs tests/dungeon-visual-direction.test.mjs tests/world-polish.test.mjs tests/afterlife-map-design.test.mjs
$env:PLAYWRIGHT_PATH='C:/Users/wolfk/.codex/skills/develop-web-game/node_modules/playwright'
$env:CHROME_PATH='C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
node tests/map-design-v6-browser.mjs
$env:V3_OUTPUT='output/playwright/map-design-v6-live'
$env:V3_PLAY_SECONDS='120'
node tests/dungeon-v3-game.mjs
```

The normal local URL remains http://127.0.0.1:5200/. The user's existing game tab and server were preserved. Refresh when ready to load the new map. Browser checks use an ephemeral server and separate browser sessions. No deployment or commit was made. A complete human campaign and physical-phone input are outside this bounded map pass.
