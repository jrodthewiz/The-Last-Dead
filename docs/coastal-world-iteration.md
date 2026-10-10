# Open Coast — quick playable map iteration

Requested October 2, 2026: rapidly expand the existing game into an explorable open-world map, reusing the current map and the strongest ideas from the researched browser games, with water around its sides.

## Play

Choose **OPEN COAST** on the title screen, or open `http://127.0.0.1:5200/?district=harbor` and start Open Coast. The original harbor-only layout is available with `?district=harbor&world=harbor`.

- WASD/mouse: walk and look; existing combat and movement controls remain available.
- Q beside the truck: enter/exit. W/S drive, A/D steer, Space brakes.
- B → Field Map: choose Saltwind Square, East Works, Inlet Overlook or Lighthouse Cape. Follow chapter objective restores Low Tide guidance.
- Original six interiors, Netmakers checkpoint, equipment, pickups and Low Tide chapter remain playable.

## Map

384 × 320 metre bounding area, with an L-shaped coastline and a large southwest inlet. Land covers 97,280 square metres. A continuous 12-metre road network joins the original harbor to residential blocks, industrial blocks and the cape. Twenty-four additional Thai Kit buildings reuse existing local model factories. Four new salvage caches, two weapon finds, four additional infected spawn positions and an off-road lighthouse give the extension destinations.

Building lots and ocean cells use the existing four-metre collision grid. Props and the lighthouse use bounded collision rectangles. The map derives from those same land, road and building records. The truck controller remains the existing flat-road arcade model. New architecture is instanced by source geometry and spatial cell; repeated slabs/rails are also instanced. Walking-route static edge tests are cached across destination changes.

## Water

The ocean surrounds all outer edges and the inlet. A four-kilometre plane concentrates geometry near the inhabited coast. Three shared analytic wave bands displace the surface and generate normals; derivative-filtered smaller waves add detail. Fresnel reflection, an estimated absorption path, crest-linked foam and sun glints provide the surface response. WebGPU and WebGL source paths share wave constants and optical math, with native WebGPU used by the game.

Reflection is an analytic sky/cloud approximation, not captured buildings. The water is a scenery boundary; swimming, boats, tide simulation and underwater refraction are outside this first iteration. This finite map loads together; distance/frustum culling and instancing are not persistent world streaming.

## Reuse and creative decisions

The researched Leonida Stories 3D informed connected road/lots and seeded variation; Last Courier informed selectable distant destinations and a return-home exploration loop. This implementation uses original layout/integration code and the project's existing licensed Thai Kit, vehicle, audio and combat assets. No external game repository was copied wholesale and no new paid generation was used. Dead Signal contracts and Quiet Hours survival systems were deferred to keep this request focused on delivering a playable map quickly.

## Workflow and verification

Skills/references read: Three.js game director (narrow existing-map iteration), gameplay systems/workflows, physics engine selection, first-playable checklist, water optics/surface system and analytic example, QA/release workflow and visual/playtest/release checklists, develop-web-game, field-map UI patterns and readability/fit checklists. Gameplay, water and browser verification were delegated in bounded tasks. Existing custom movement authority was retained.

Source checks cover connected destinations, every original room and pickup, reciprocal walls, blocked sea/building footprints, lighthouse clearance, a continuous truck route, selected walking routes, map coverage, and checkpoint pickup preservation. All 23 coastal/harbor/navigation/vehicle/chapter tests and six loading-preparation checks pass. Production build passes.

Native WebGPU water animation and four actual HarborWorld views pass with zero browser errors (`output/playwright/coastal-water`). The real field-kit UI passes at 1440×900 and 960×640: B opens, Lighthouse selection supplies a 533 m route, Escape closes, and content fits without horizontal overflow (`output/playwright/coastal-map`).

Open Coast now prepares the visible scene rather than forcing every campaign weapon, boss, hidden interior and anatomy effect through startup. Unseen effects can still incur first-use work. The full app reached play in 187,970 ms in the automated browser; cold startup remains a performance limitation.

The full production-app browser journey passes: keyboard walking across the old harbor boundary, weapon collection, Q truck entry, driving/braking/exit, B field-map destination selection, and animated coastal water. Zero page, console or HTTP errors were recorded. The test removes enemies after initialization and places the player at bounded test locations; this verifies those interactions rather than an uninterrupted survival playthrough. Screenshots, diagnostics and report: `output/playwright/coastal-world/`. The bundled develop-web-game client also passes a keyboard movement loop using the real engine and HarborWorld fixture. Existing user tab and port-5200 server were preserved.

## Quick quality pass — October 2
Inspected previous street/overview views: paving joints on grass, very narrow shoulders, center stripes crossing junctions and empty lot edges were the most visible defects. Added a dedicated seeded grass surface, interrupted two-metre sidewalks with pale curbs, building approach paths, intersection-aware center markings, and distributed low scrub. Existing collision and road widths are unchanged; repeated details stay in the existing spatial instance batches. No new external assets were needed for these repeated support surfaces.
References read: director, graphics builder, implementation blueprint, render recipes, material/procedural/performance checklists, QA release and visual verification. Narrow desktop environment pass; no premium or release claim.
Verification: production build passed; four native WebGPU HarborWorld views passed with zero page/console errors; bundled develop-web-game client verified real engine keyboard movement (x16 to17.0201), with screenshot and no error report. Inspected updated street and overview images. Full application/combat startup was not repeated for these visual-only changes. Existing user tab/server preserved.

## Second quick quality pass — October 2
Reviewed the current coast view: oversized equally spaced rocks dominated the rail silhouette. Replaced them with smaller staggered, color-varied riprap below the parapet; added a lower rail. Added lighthouse door/handle, inset windows/sills, balcony handrails and lantern mullions within its existing collision footprint. Added pedestrian crossing paint at three main-spine junctions. Reused existing materials and instancing; no new external assets or gameplay collision changes.
Verification: build passes; five native WebGPU views including a new close lighthouse view pass with zero page/console errors. Coast and lighthouse screenshots inspected. Bundled keyboard movement fixture passes. This is a focused environment pass, not a full combat/startup retest. Director/graphics/QA references remain as above, plus model recipes read for tower details. Existing user's tab/server preserved.

## Interior cohesion pass — October 2
Polished the six existing enterable harbor rooms: distinct muted wall accents tied to numbered entrance plaques, purpose-specific operational notices connected to the chapter, framed exits, window sills/upper blinds, and electrical conduits. Corrected control-room meters and conduit overlapping the notice. Preserved floor layout, interaction stations and collision. This does not add interiors to the 24 extension buildings.
Verification: eight interior/chapter tests and build pass. Native WebGPU renders of all six rooms, two entrances and exterior return pass with zero page/console errors. Inspected final control-room and entrance screenshots. Existing director/graphics/QA reference ledger applies; reused materials and small support geometry, no new assets. Full production startup/combat was not repeated for this bounded visual pass; user tab/server preserved.

## Procedural neighborhood replacement — October 3

The 24 fixed extension placements are superseded by 94 deterministic street-front lots. `coastal-neighborhood-layout.js` plans residential, industrial and cape blocks, retaining ten rear courtyards and connected four-metre passages. Building heights and widths vary within district rules. Sixty trees, forty benches and twenty lamps have matching collision proxies; main roads, landmarks, pickups, room doors and truck routes remain clear.

This pass directly adapts the `frontage()` source from L1vsun/NEONBAY, commit baac38fecd1698c67dcf75ccffb1a82592798e9c, under MIT. Runtime `assets/community/neonbay-frontage.js` preserves the edge-tangent/inward-normal placement, seeded dimensions and bounded fit retries, with rectangular blocks and four-metre snapping for our existing collision authority. Attribution and license are bundled beside it. This imports a specific generation subsystem, not NEON BAY's whole world, driving system, renderer or shaders. Earlier statements describing inspiration-only reuse apply to the initial 24-building expansion.

A separate sizing defect was corrected: coastal models now fill their authored footprint and height. The old uniform minimum scale could shrink the visible building far inside its solid collision lot. Cardinal rotation tests verify world bounds. Original harbor fitting remains unchanged.

`coastal-neighborhood-visuals.js` compiles paved passages, courtyard joints, trees, benches, lamps and ground-floor shopfront awnings/shutters into spatial instance batches. There are no additional dynamic lights. The generator replaces random scrub in developed blocks. All 94 new buildings remain exterior shells; the original six playable interiors are preserved.

Iteration controls: seed, block bands, depth and dimension ranges, district height rules and source-model selection live in `coastal-neighborhood-layout.js`; frontage fitting lives in `assets/community/neonbay-frontage.js`; appearance and prop compilation live in `coastal-neighborhood-visuals.js`. Geometry is generated from the same lot data used by collision and the field map.

Workflow: director, procedural architecture grammar/mesh compiler and example, gameplay, graphics and QA skill/reference checks applied. Existing Thai Kit architecture supplies buildings; repeated support props use procedural instancing. No paid generation, new combat/UI/audio work, or premium-quality claim. The source reuse is pinned and locally bundled; no GitHub requests occur at runtime.

Neighborhood verification: 12 focused layout/interior/footprint tests passed, including five deterministic seeds, disjoint grid footprints, reachable courtyards, all original destinations, reciprocal collision walls, and continuous main truck routes. Native WebGPU six-view verification in `output/playwright/coastal-density/final-verified` has zero browser/HTTP errors and no zero-capacity instance buffers. Street median/p95:12.9/19.9ms; courtyard13.8/20ms; whole-map overview29.8/48.9ms at1280x800. These are scene-fixture measurements, not full combat FPS. The overview renders1593draws and2.16million triangles; aerial performance remains a limitation. Original 24-building imagery is in `output/playwright/performance-freeze/final-npc-warmup/active.png`; the density folder named baseline actually captured an intermediate93-building state and is not a valid original-layout performance baseline.

The browser pass caught and fixed an empty scrub InstancedMesh after replacing random vegetation, and a batching pass that would have incorrectly collapsed pre-existing instance batches. All new neighborhood batches now retain their placements and have nonempty buffers.

Dense-map cold preparation exposed another issue: native Three's uniform matrix-array capacity is embedded in WGSL, so exact per-batch instance counts create distinct shader programs. `coastal-instancing.js` now rounds allocation capacity to powers of two while preserving the actual draw count and bounding volume. Thai architecture, coastal slabs, vegetation and frontage batches share this helper. Three additional tests verify allocation, draw counts, padded-instance exclusion from bounds, and rejection of empty/invalid counts (15 focused tests total). The first unbucketed full-app run failed with GPU device loss after about291seconds; another chat's GPU profile overlapped part of that run, so its timing cannot isolate density alone. Final verification follows the capacity correction.

## Single campaign entry and startup work — October 3

Player direction: one expanding open-world campaign. Blackwater / Low Tide and the connected coast are its current playable world; dungeon systems and future authored districts belong to that campaign rather than competing main-menu map choices. This change does not claim the legacy five dungeon floors have been physically connected to the coast, or that exterior neighborhood shells have become playable interiors.

The public menu now has one Play Campaign action, with Dev Mode — Fly Around (F2) immediately underneath. Both enter the same world. Default URLs, `?debug`, `?dev`, and old district links select the full coastal campaign. Explicit `?dungeon=N`, `?campaign=1`, and `?sector=N` routes remain development fixtures; co-op retains its existing arena behavior. Existing Low Tide checkpoints restore at Netmakers.

Startup now selects its target course before renderer preparation and keeps that exact course through asynchronous completion. Previously, retry could warm up the previous world and then create a different world at the moment gameplay started. Co-op preparation also targets its actual arena. Duplicate start requests are ignored while preparation is pending.

Validation: 32 focused Node checks pass for campaign routes, start/retry/co-op preparation, checkpoint restore, flight controls, coast connectivity/collision, six room transitions and Low Tide chapter progression. Responsive menu checks cover 1440x900, 1280x720, 844x390, 390x844 and 320x568, including controls reached by scrolling. Layout evidence: `output/playwright/campaign-menu/menu-report.json`. The layout fixture deliberately isolates the real UI module from rendering; it is not evidence of completed gameplay startup.

Skill/reference ledger: narrow game-director workflow; gameplay systems and gameplay-workflows; UI patterns, game-UI quality, HUD readability and responsive fit; debug-profile checklists and performance profile; QA-release checklist, visual verification, playtest QA and release checklist. UI and performance work use focused workers. Existing geometry, textures and audio are retained; no new asset generation or premium visual completion is claimed. The NEONBAY/night-street source records above remain authoritative for the adaptations already in this repository.

Final status for this map pass: all 15 focused tests and the production build pass. Six final native WebGPU views after capacity bucketing pass with zero browser/HTTP/GPU errors (`output/playwright/coastal-density/final-capacity`). The map and source integration are complete. Full-application loading/G/fly performance after the capacity change is NOT verified in this pass: another user chat's `startup-profile.mjs baseline2` remained active, and this task left that process untouched rather than running another competing GPU test. Earlier fixture timings describe the scene only. The user should not interpret the denser map as a new guarantee of freeze-free gameplay or reduced cold load time. No browser or server from this map QA was left running.

Startup profiling result: the bundled WebGPU compiler now schedules preparation in approximately eight-millisecond slices instead of yielding after every cached render object and shader stage. `scripts/vendor-webgpu.mjs` preserves the patch when regenerating the vendor build. No visual content was removed. Twenty-one compiler/loading/interior tests pass, bringing this pass to 53 focused checks, and the production build passes.

A controlled 5,000-object test using the actual `compileAsync` method, stubbed GPU managers and a timer-backed scheduler measured 5,000 yields / 75,742 ms before versus 2 yields / 38.75 ms after. This isolates scheduling overhead; it is not a game startup speedup measurement. Evidence: `output/playwright/compilation-scheduling-benchmark.json`.

The updated full app reached gameplay in 164.755 seconds in headless Chromium with D3D11, with no console/page errors and a visually inspected nonblank world. Exterior compilation took 124.844 seconds; interaction preparation 14.505 seconds; NPC preparation 4.484 seconds; six interiors 1.847 seconds. Scene diagnostics counted 3,016 meshes, 685 materials, 1,182 geometries, 1,771,756 triangles, 1,452 draw calls and 152 textures at 1280x720/DPR1. Cold loading is still too slow. A valid full-startup improvement percentage is unavailable: the baseline browser stalled past 300 seconds, the successful run used a different ANGLE option, and concurrent scene changes prevent equivalence. Next performance work should measure shader/material variants and exterior preparation before expanding the scene further. Evidence: `output/playwright/startup-after.json` and `startup-after.png`.

The suspected menu-rendering overlap was ruled out: the main loop already skips rendering while a start is pending. No redundant menu guard was retained. The user's existing game tab and port-5200 server were preserved.

Production interaction checks: ordinary Play Campaign entered the full coast in 140.231 seconds. F2 entered flight, E raised camera altitude without moving the player, Escape paused, Resume returned to play, and F2 returned to the player. Retry retained the coastal campaign and used the exact prepared course, but took another 134.269 seconds. This confirms that repeated world preparation, not only a cold asset download, remains a player-facing limitation. These timings are observed runs, not a controlled before/after comparison.

Final production journey passed, including title-screen Dev Mode button into the same coastal world with flight active. No page, console or HTTP errors. Evidence: output/playwright/campaign-menu/live-report.json, live-menu.png and live-flight.png. All test-owned browsers and the ephemeral production server were closed; the existing user tab and server were not restarted.

## 2026-10-05 — searchable interiors and workshop economy

The coastal scavenging pass adds 17 sealed, Q-searchable supply cases on existing furniture. Clinics provide antiseptic and cloth, homes/laundry provide cloth, and workshops/warehouses/cape retreats provide mixed supplies. These stops are deterministic, physically supported and bounded; no random respawn or new enemy population is introduced. The existing Works and Cape rifle IDs now occupy clear, reserved tables in Warehouse 46 and Cape Lodge 79. They require Q to stash and remain separate from equipping in B.

The field kit gains a separate twelve-unit supply pouch, bench-made bandages (two cloth plus one antiseptic), and carried healing of up to 35 health. The three-bandage limit, full-case retention, one-at-a-time material discard and safehouse save migration keep the economy usable. Hardened fittings retain their existing eight-scrap cost and 25% damage effect. Marking the nearest workshop now reaches its actual bench approach; the street graph hands off to bounded indoor routes around furniture. All 46 bench routes pass physical clearance checks.

The 70 focused source/simulation/geometry tests and build pass, including the ninety-four-building resource limits and original upstairs discovery. All twelve edited runtime dependencies match source, dist and the unchanged port-5200 server. Rendered desktop appearance/input, GPU performance and mobile layout remain unverified pending the Three.js skill's required browser approval.

### Approved desktop visual follow-up

Desktop QA and the requested quality iteration are complete for the scavenging/workshop flow. The supply pouch and workbench now have explicit desktop grid areas; opening the kit and marking a bench reset the content scroll. The pouch shows current life and treatment amount. Supply cases have separate lids, seams, hollow handles, catches and category colours within the same three pooled draws. Painted case/rifle materials use the coast's explicit lights. Five finite task fixtures illuminate the key clinic, workshop and rifle surfaces through the existing two fixture draws, with zero additional shadow maps.

Rendered geometry revealed that the original Cape79 rifle approach stood on the porch side of its boarded window. The new diagonal indoor approach is walkable, reachable and has a tested unobstructed native-render sightline. Persistent Q/B hints describe the current usable object. Held Q now performs one coastal loot action until released, preventing a rifle press from also collecting the neighbouring warehouse case.

The verified native WebGPU desktop journey has seventeen reviewed screenshots, sixteen real W approach segments, and actual Q/B/inventory inputs. Both rifles disappear only after stash; the current gun remains equipped until selected in B. Crafting spends2 cloth/1 antiseptic, healing raises60 to95 once, and weapon fitting spends8 scrap. All page/console/HTTP error counts are zero;78 focused tests and the build pass across final checks. Evidence is in output/playwright/coastal-scavenging/verified/report.json, desktop-review.jpg and live-integration.json. Sixteen runtime files match source/dist/immutable QA/live port5200; existing PID24220 and the user's tab remain intact.

This is a bounded desktop journey with controlled transit starts and health/scrap, enemies omitted during inspection, and unused startup warmups skipped. It preserves the actual visible world and production native rendering, but makes no mobile, full-startup, combat or performance acceptance claim. Prior snapshots and the held-Q failure remain preserved for comparison.
