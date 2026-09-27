# Story progression and event performance

This pass retains the authored five-floor map and changes the pacing around its
existing rooms, doors, keys and lifts. Story encounters are tied to entering their
authored rooms, with spawn warnings and staggered arrivals. Clearing an encounter
creates an exploration beat before entering the next threat zone. The HUD reports
the next room and floor progress instead of a global wave countdown.

Selected existing arches now use the normal room-clear door system: the Foundry
pump entrance, both Deep Ward approaches, the lower Ossuary entrance, and the
west Aisle threshold. Initially reachable room counts change from 8/7/6/8/2 to
6/6/5/5/2 across the five floors. The duplicate always-open arch into floor four's
Reliquary Niche is now a secret vent, matching its other threshold.

Floor transitions suspend simulation, paint the loading overlay, and prepare the
next floor before returning control. Restart uses the same preparation path.
The existing game tab and server are preserved; browser checks use independent
browser processes and the loading test serves the production build on an
ephemeral local port.

## Scope and skill-loading ledger

Loaded skills from `C:/Users/wolfk/.codex/skills/`: threejs-game-director,
threejs-gameplay-systems, threejs-debug-profiler, threejs-game-ui-designer,
threejs-qa-release. Gameplay, performance and UI work were delegated by the
director's phase workflow; integration and production browser QA run in the root
task. Existing uncommitted art, audio, pickup and loading edits are preserved.

## Reference ledger

References loaded successfully:

- Gameplay: `references/gameplay-workflows.md`.
- Debug: `references/debug-profile-checklists.md`,
  `references/checklists/scene-debugging.md`,
  `references/checklists/performance-profile.md`.
- UI: `references/ui-patterns.md`, `references/checklists/game-ui-quality.md`,
  `references/checklists/hud-readability.md`,
  `references/checklists/responsive-ui-fit.md`.
- QA: `references/qa-release-checklists.md`,
  `references/checklists/playtest-qa.md`,
  `references/checklists/visual-verification.md`,
  `references/checklists/release.md`.

Asset sourcing/graphics phase: unchanged authored artwork and bundled assets;
this is a gameplay/performance pass, with no new asset generation or premium
graphics claim. No physics engine or movement collision representation changes.

## Verification

- `node tests/story-floor-loading.mjs` serves `dist` on an ephemeral port and
  checks keyboard movement, pause/resume, a deliberately delayed floor
  preparation, simulation freeze, automatic resume, later-floor actor resources,
  desktop/mobile HUD fit, and restart. First integrated run passed with 12
  prepared second-floor actors, no WebGL context loss, and no browser/HTTP
  errors. Screenshots and JSON: `.logs/story-progression/`.
- Screenshot review exposed one stale-HUD frame at floor resume. The transition
  now updates the HUD immediately before returning control; the browser test
  asserts the new floor label. The final production run passed again with the
  correct `Reach Sterile Intake` objective at both 1280×720 and 390×844, no
  viewport overflow, and zero browser/HTTP errors. Both screenshots were
  reviewed; the canvas is visibly rendered and the desktop floor label is current.
- Engine/campaign progression, dungeon art and dynamic door checks: 35 passed
  during integration. HUD, footprint and all-five-floor door checks: 8 passed.
- Final combined Node validation: **57/57 passed** across engine, campaign rooms,
  Story encounters, HUD, map traversal, footprint, map art and all-floor doors.
  Includes waiting without entering, safe staggered spawning, caps, queued-enemy
  completion, reachable next encounters, key pickup, five-floor descent, victory
  and reset. Route assertions caught and fixed a Catacombs ordering softlock:
  authored spawn order now keeps the accessible Stores encounter before the vault.
- Final `node build.mjs` and `git diff --check`: passed.

The final event profile uses actual encounter arrivals (2, 4, 3 and 3 prepared
actors consumed), not repeated calls while an encounter is already active. All
11 scenarios produced zero new shader programs, GPU buffer allocations or
texture uploads. Pickups and door changes retained the same world root. Local
synchronized samples: evidence 32.3 ms, key 19 ms, doors 16.2–16.5 ms, spawn
warning 12.2 ms, and encounter arrivals 16.8–22.9 ms. The eight-weapon firing
sweep took 127.5 ms across its rendered frames. These are event diagnostics on
this machine, not a sustained frame-rate guarantee. Report:
`.logs/event-performance-after.json`; command: `node tests/event-performance.mjs`.

The renderer now preallocates visible spawn-warning rings and uploads their
buffers during preparation. Preparation is keyed to the dungeon course, so
later floors get the same actor, scenery and effect preparation as the first.

## Phase ledger and checklist

- Gameplay systems: done; 57-test combined suite includes live movement routes
  and deterministic encounter coverage. Some full-descent fixtures mark spawned
  enemies defeated to isolate reachability from combat skill.
- UI: done; named objectives and encounter counts, exploration/clear/key/exit
  states, floor-loading success and error path, immediate floor HUD refresh.
- Debug/profile: done; pickup hot-path allocations reduced, stable-light fixes
  retained, visible pooled warning rings, course-scoped preparation and measured
  real event scenarios.
- QA/release: done for this change; build, unit/integration checks, separate
  production browser lifecycle, screenshots, browser errors and event diagnostics.
- AAA graphics/assets/audio generation: skipped; existing authored assets retained.

## Files and remaining limits

Runtime changes: `engine.js`, `main.js`, `ui.js`, `renderer.js`,
`dungeon-weapon-loot.js`, `dungeon-evidence.js`,
`playground/map/dungeon-data.js`. Tests: `tests/map-playground.test.mjs`,
`tests/dungeon-encounter-progression.test.mjs`,
`tests/room-progression-ui.test.mjs`, `tests/story-floor-loading.mjs`, and
`tests/event-performance.mjs`.

Play at `http://127.0.0.1:5200/` after refreshing and starting a new run. Existing
controls are unchanged: WASD movement, mouse aim, fire, Escape pause/resume,
R restart. Browser tests use explicit `PLAYWRIGHT_PATH` / `CHROME_PATH` overrides
when dependencies are not installed locally.

The new progression is Story-only; campaign/co-op rules remain separate. These
checks do not establish sustained FPS on every device or constitute a manual
combat playthrough of all floors. Narrow mobile objectives retain the existing
ellipsis treatment. No external deployment or server restart was performed.
