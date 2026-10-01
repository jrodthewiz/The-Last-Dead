# Map v5: shared projection bake, readable crossings, fair arrivals

This pass continues the offline Imagegen workflow in the real dungeon. A registered cabinet painting supplies broad wood wear to the existing shared 512px color-map slot. Rib Colonnade's seven cover cells move to the flanks, and every new doorway arrival warning receives its full half-second reaction window. Existing models, colliders, articulation, shaders, material slots, enemy roster and encounter budgets remain intact.

## Production texture and performance contract

The full model-specific atlases remain inspection prototypes. Their earlier benchmark showed that adding a map to a plain material costs GPU work and memory. This production pass instead replaces `assets/textures/afterlife-cabinet-wood-v1.webp` with `assets/textures/afterlife-cabinet-wood-projected-v3.webp` in `renderer.js`. Cabinets, drawer cover, the piano and other wood dressing reuse the same existing material role. Weapon wood retains its separate original asset.

Built-in Imagegen painted the native six-view clay sheet. Its rear CaseBody face supplies a registered planar surface window, excluding posts, caps and hardware. `scripts/bake-shared-wood.py` projects that window into the original UV tile, matches the original average brightness, and retains the shipped tile's high-frequency grain at 0.65 weight. The narrow projection would otherwise soften the wood. A 20px periodic boundary blend controls repeating seams. This is an offline hybrid bake, not a runtime projector or a replacement cabinet model.

| Texture budget | Original | New bake |
| --- | ---: | ---: |
| Dimensions | 512 × 512 | 512 × 512 |
| Shared color-map slot | 1 | 1 |
| RGBA8 + mip estimate | 1.33 MiB | 1.33 MiB |
| Download | 40,548 bytes | 36,884 bytes |
| Decoded opposite-edge maximum difference | 54 / 255 | 10 / 255 |
| Added geometry, samplers, lights, shader features or passes | 0 | 0 |

The runtime export uses WebP quality 88/method 6. The uncompressed authoring tile has identical boundary pixels; lossy compression introduces the measured small decoded edge difference. The baker rejects a replacement larger than the original download. The lossless source, source model, original texture and prompts remain preserved. Authoring inputs are in `.art-source/projection-texture/cabinet/`, including `painted-wood-v3.png`, `prompt-wood-v3.txt`, `shared-wood-v3.png` and `shared-wood-v3-report.json`. They are not runtime inputs.

The production render-budget gate passes. In all four final artwork variants, renderer counts remain exactly 263 calls, 300,689 triangles, 103 textures, 1,048 geometries and 249 compiled programs at a 1280×720 drawing buffer. These totals include the actual world, transmission and bodycam passes. They are a frozen scene fixture, not universal gameplay totals.

Final GTX 1650 / ANGLE D3D11 timings from `output/playwright/map-v5-accepted/report.json`:

| Counterbalanced run | CPU render submission median | GPU median | GPU samples |
| --- | ---: | ---: | ---: |
| Original 1 | 5.00 ms | 8.785 ms | 75 |
| Projected 1 | 4.90 ms | 8.718 ms | 75 |
| Projected 2 | 5.90 ms | 9.493 ms | 75 |
| Original 2 | 5.20 ms | 8.907 ms | 75 |

The first pair is effectively equal; a later projected repeat is slower. The preceding complete compressed pass measured original GPU medians 9.966/12.657ms and projected 12.532/9.087ms, with the same exact inventory. Host/run variation prevents resolving a small performance difference from these measurements. There is no added render mechanism, texture residency, sampler work or download cost, but the timing evidence is not an all-hardware zero-impact guarantee or a proof of FPS improvement. No whole-atlas conversion of plain materials is enabled.

## Routes and spawning

Rib Colonnade's previous central cover required three turns and 32m from its southern arrival to the court approach. The same seven cover cells now provide flank refuges, exposing a 24m straight route. The local north threshold changes from 20m/two turns to 12m/no turns. East crypt arrival exposes the central junction. The floor retains 396 walkable cells, 41 cover cells, 84 authored enemies, and its original 11 rooms/11 corridors/21 openings. Permanent wall segments decrease from 366 to 365. Whole-floor shortest entry-to-exit distance remains 188m/14 turns. Closed combat/key doors still gate progression.

Independent visual review caught floor decoration still crossing the southern approach. `world-polish.js` now banks five existing F3 floor groups toward the flanks after deterministic placement: tipped barrel, bone pile, skull and two candle clusters, with attached eyes/flames moved together. Only X/Z translations change. Actual transformed mesh bounds now have zero intersections with both body/view strips, versus at least five before. The kit retains 126 instances, 13 instanced draws and 105,878 instance triangles; geometry, materials, scales, rotations, seed order and upright landmarks remain unchanged. This placement correction runs once during world construction.

The first warning previously lasted about 0.333s at 60Hz; a canceled co-op staging pad could retry with only 0.183s warning. New and retried warnings now defer arrival until the existing 0.5s lead has elapsed. Outstanding warnings also reserve their staging pad with the existing enemy separation rule. Two due enemies cannot warn on the same pad. Commitment still rechecks door connectivity, player visibility and distance, collision-safe ingress and both players' positions. The existing global 12-enemy limit and encounter budgets remain unchanged. Reservations use a bounded scan during spawn attempts/commitment, with the existing 0.15s retry throttle; there is no new per-frame path search.

Worker evidence: `docs/map-flow-v5-notes.md` and `docs/spawn-v5-notes.md`. New regressions reproduce the old failures, test continuous body clearance and sightlines, and exercise warnings at 30/60/120Hz, co-op interruption and one-pad contention.

## Verification and visual review

Build passes. The combined engine/AI/topology/ingress/progression/pressure/bake/set-dressing suite passes 67 distinct tests, with two additional world-polish/batching checks passing separately: 69 distinct checks total. `tests/map-v5-browser.mjs` tests the production build on a separate ephemeral server and Chrome session, preserving the user's existing game tab and source server. It checks actual cabinet old/new artwork, near/design/far/no-post views, game views with bodycam, south/east F3 arrivals with open/closed doors, nonblank canvas pixels, portrait overflow, pause/resume/restart and browser/resource errors.

GPU comparison swaps only image data in the SAME shared texture source and existing map objects. It freezes the actual scene pose and camera, then renders the full scene/transmission/bodycam pipeline. Animation/FX decay cannot change the draw inventory between variants. Each variant warms for 60 frames and samples 75 frames in old/new/new/old order. Disjoint timer queries measure GPU work asynchronously; CPU values measure rendering submission only. This isolates the artwork replacement and does not measure simulation cost or imply active gameplay FPS. Initial diagnostic captures with a corner camera and evolving pose are preserved in `output/playwright/map-v5` and `map-v5-final`; those failed QA fixtures are not acceptance evidence.

Final production browser QA passes with zero console/page/resource errors, 12 scene screenshots, nonblank pixel samples in every view, no horizontal portrait overflow and working pause/resume/restart. Evidence: `output/playwright/map-v5-accepted/report.json`. The independent visual agent's second review passes the corrected south/east approaches and portrait HUD: the center floor is continuous, the log/piles are on the flanks, the east lane remains readable beside the rib plinth, and text/touch controls do not overlap. Its first review accepts the wood surface as a modest near-view improvement, without conspicuous seams or invented hardware; at distance it is too subtle to claim a major upgrade. Both review records remain preserved, with final sign-off at `output/playwright/map-v5-accepted/visual-review.json`.

The final two-minute browser journey uses real keyboard/mouse inputs with scripted aim/navigation guidance. It passes with 47 kills, 47 grounded doorway arrivals, four completed rooms, reinforcement phases, zero deaths and zero console/page/resource errors. Desktop captures show about 60 FPS at the sampled moments; portrait shows about 55 FPS. These are sampled running-game HUD values, not a before/after FPS guarantee. Evidence: `output/playwright/map-v5-live-final/report.json` and its three gameplay screenshots. Pause/resume/restart passes in the separate final view test.

The first journey reached the same 47 kills/four rooms but failed its strict error gate on one `net::ERR_NO_BUFFER_SPACE` audio request. The same 58,712-byte asset returns HTTP 200 from the retained source server, and the clean final-build retry has no such failure. The original failure remains recorded in `output/playwright/map-v5-live/report.json`, rather than being filtered from error reporting.

## Skill-loading ledger

Director active: `C:/Users/wolfk/.codex/skills/threejs-game-director/SKILL.md`. The five sibling skills were loaded from `C:/Users/wolfk/.codex/skills/`: `threejs-gameplay-systems`, `threejs-aaa-graphics-builder`, `threejs-game-ui-designer`, `threejs-debug-profiler`, `threejs-qa-release`. `threejs-visual-validation` and system `C:/Users/wolfk/.codex/skills/.system/imagegen/SKILL.md` also guide this pass. Imagegen is the requested image generator; no separate Gemini API job is needed. 3D generator and audio generator: not needed for this bounded existing-model/material/route iteration.

## Reference ledger

All paths below are relative to the corresponding loaded skill directory under `C:/Users/wolfk/.codex/skills/` unless stated otherwise.

| Reference | Loaded | Applicability |
| --- | --- | --- |
| Gameplay `references/gameplay-workflows.md` | Yes | Route, ingress, fair encounters, real input |
| Gameplay `references/physics-engine-selection.md` | Yes, workers | Retain grid collision, fixed engine timestep, body proxies |
| Gameplay new-game scaffold/checklist | Not needed | Existing game; no new physics engine or scaffold |
| AAA `references/visual-scorecard.md` | Yes | Conservative quality review; no premium/AAA certification |
| AAA `references/implementation-blueprint.md` | Yes | Reuse assets/material roles and bounded scene detail |
| AAA `references/model-recipes.md`, `render-recipes.md` | Yes | Preserve hierarchy, UVs, geometry, exposure, sampler budgets |
| AAA `references/checklists/procedural-model-quality.md`, `material-lighting-quality.md`, `performance-safe-visual-detail.md` | Yes | Actual-lit surface checks, named hierarchy, preserved instance geometry and measured replacement |
| UI patterns/checklists | Not needed | No UI implementation changes; existing HUD checked during QA |
| Debug `references/debug-profile-checklists.md`, `references/checklists/performance-profile.md` | Yes | GPU vs CPU, warmup, resources and reproducible fixture |
| QA `references/qa-release-checklists.md` | Yes | Production build, input, console/page errors, desktop/mobile viewport |
| QA `references/checklists/visual-verification.md`, `playtest-qa.md`, `release.md` | Yes | Nonblank screenshots, actual journey, scope limits |
| Validation `references/graphics-validation-protocol.md` | Yes | Frozen camera/pose, no-post, near/design/far and timing |
| System imagegen `references/prompting.md` | Yes | Registered material painting, existing images inspected first |
| Tripo/Gemini/audio API/workflow references | Not needed | No new model, API image job, audio or paid asset work |

## External asset sourcing ledger

Chosen material/texture source: built-in Imagegen, original generated file `C:/Users/wolfk/.codex/generated_images/01a0ef15-6269-7113-be09-421e34f5658e/exec-cee3e1ca-1e5e-4639-b589-a9309a27c17d.png`, preserved copy/prompt in the authoring archive and actual baked WebP under `assets/textures/`. Hero/player, enemies/weapons, signature props/pickups, world/sky/background, logos/icons/UI and audio/SFX remain existing shipped sources. No credential probe or paid external model/audio generation is needed: this pass adds no such assets and makes no premium asset-category claim.

## Phase ledger

| Phase | Status | Evidence/checklist output |
| --- | --- | --- |
| Gameplay systems | Done | Two focused workers; topology/body and actual decorative bounds, gates, warnings, commitment, co-op tests; 69 distinct checks pass |
| External asset sourcing | Done | Built-in Imagegen reference painting, prompt/archive, actual bounded baked texture |
| AAA graphics / material iteration | Done for this scope | Original geometry/UV/material hierarchy; same maps/samplers/lights; independent near-view material and corrected-layout PASS; no premium claim |
| UI | Skipped implementation; QA done | Existing HUD only; portrait layout/overflow and pause/resume/restart pass |
| Debug/profile | Done | Real GPU queries, exact resource invariants, fixed view/pose and smaller download; recorded noisy timing limits |
| QA/release | Done for bounded local iteration | Build, 69 distinct checks, final production/browser/input and independent visual checks pass; director report audit passes; no deployment |

## Reproduction and limits

Set `PLAYWRIGHT_PATH` and `CHROME_PATH` if local defaults are absent. Set a Python interpreter with numpy/Pillow for the offline baker. Build and QA need only the repository's runtime assets, Node and local browser tooling.

```powershell
& $bakePython scripts/bake-shared-wood.py
node build.mjs
node --test --test-isolation=none tests/map-flow-v5.test.mjs tests/spawn-v5.test.mjs tests/dungeon-route-topology.test.mjs tests/dungeon-footprint.test.mjs tests/dungeon-ingress.test.mjs tests/dungeon-flow.test.mjs tests/dungeon-encounter-progression.test.mjs tests/enemy-pressure.test.mjs enemy-ai.test.mjs engine.test.mjs tests/projection-texture.test.mjs tests/world-setdressing.test.mjs tests/world-polish.test.mjs
$env:V5_OUTPUT='output/playwright/map-v5-accepted'
node tests/map-v5-browser.mjs
$env:V3_OUTPUT='output/playwright/map-v5-live-final'
$env:V3_PLAY_SECONDS='120'
node tests/dungeon-v3-game.mjs
```

Changed in this iteration: `renderer.js`'s world wood texture path; new `assets/textures/afterlife-cabinet-wood-projected-v3.webp` and `scripts/bake-shared-wood.py`; F3 cover/sightlines in `playground/map/dungeon-data.js`; five floor-group translations in `world-polish.js`; warning lead/reservation logic in `engine.js` and `enemy-ai.js`; new `tests/map-flow-v5.test.mjs`, `tests/spawn-v5.test.mjs`, `tests/map-v5-browser.mjs`; this report, worker notes, projection experiment continuation and progress notes. Existing unrelated checkout changes are preserved.

Run URL: http://127.0.0.1:5200/. Refresh when ready; the existing tab has not been navigated or restarted. Source server PID 26316 remains running. Controls remain mouse/WASD, mouse fire, F parry, Space jump, Shift dash, E grapple, Escape pause. A full human campaign, physical-phone input and other GPUs are outside this pass. A player watching every viable staging lane can deliberately keep arrivals queued. Replacing artwork cannot supply missing geometric relief or physically accurate normals. Future kits should reuse existing maps/trim slots; full unique-atlas conversion still requires a separately passing cost/quality gate. No premium/AAA/showcase certification is claimed: dim destinations, primitive bone forms and subtle wood improvement at distance remain limitations.
