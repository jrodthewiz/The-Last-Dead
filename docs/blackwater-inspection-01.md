# Blackwater / inspection 01

> Superseded comparison: [inspection 02](blackwater-inspection-02.md) contains the corrected geometry, surfaces, two current art directions and updated verification. The study below records the original rejected pass.

Open [the inspection block](http://127.0.0.1:5200/blackwater-review.html). It is also part of the normal coastal world. The inspection page opens separately so the current game session can stay intact.

This first bounded iteration establishes an abandoned downtown beside a residential block. It replaces sixteen existing lots: eight brick shops/corner buildings and eight two-storey houses. Houses have three deterministic roof/siding variants, porches, broken rails, recessed windows and utility fittings. Main Street has nineteen placed wrecks, checkpoint barriers, luggage, fences, noticeboards and utility props, plus scattered fragments and sagging cables.

Bell Pharmacy is the first continuous walk-in building. Its four-metre doorway, shelves and counter use the same collision plan as the visuals. The existing supply system collects a cache inside and preserves its identifier in a Netmakers checkpoint. Houses and the other new shops are closed in this iteration. Small fragments are decorative; solid wrecks, fences and barricades have collision. The centre six metres of the street remains open for the truck.

## Inspect and steer

Use Downtown, Houses, Pharmacy, Courtyard and Overview for repeatable views. Walk the block starts outside the pharmacy: WASD moves, mouse or arrow keys look, and Esc releases the mouse so the view buttons can be used again. Supply collection is automatic on approach. Mobile verification covers the inspection layout and resize; walking currently uses a keyboard.

The useful decisions for the next iteration are the density and character of downtown, the residential style, and how severe the visible destruction should be. The next substantial environment pass should author one recognisable failed evacuation incident with damage connected to its surroundings, then open a house with a kitchen/stairs/backyard route. Encounter pacing, sound-led infected movement, additional interiors, varied melee reactions and longer objectives will need subsequent gameplay iterations to approach the reference games' complexity.

## Rendering direction study

The inspection now has three live material and lighting options, plus Original. These are native WebGPU renders of the actual Blackwater models in the engine-backed inspection scene. This bounded study does not change the main game's default rendering. The paired JPEGs show the same Downtown camera above the same Houses camera, with the same building seeds, layout and sun direction. Only renderer settings, shading, lighting intensity, palette and outlines vary. Screenshot delivery uses compact JPEGs in this non-ignored docs directory for inspection in Codex Remote.

| Choice | Render mechanism | Remote preview |
| --- | --- | --- |
| A — Cartoon | Flat palette, three light bands, bold inverted-hull silhouettes, bright indirect light | [Downtown and houses](blackwater-look-a-cartoon.jpg) |
| B — Illustrated | Weathered textures, six light bands, fine silhouettes, warmer graded light | [Downtown and houses](blackwater-look-b-illustrated.jpg) |
| C — Grounded realism | Physical shading, brick/wood relief and roughness maps, HDR sky reflections, world-space damp asphalt | [Downtown and houses](blackwater-look-c-realism.jpg) |

Visual contract: shaded storefront trim and the pharmacy doorway remain legible; siding, glass, brick and metal stay distinguishable; the cartoon palette reads without weathering maps; realism retains fine aggregate and coherent roughness without repeating grid patterns. Surface relief follows the existing brick courses. Dampness drives both road colour and roughness; aggregate fades with the pixel footprint. Original geometry, collision, navigation and pickup identifiers remain invariant. The studies share near, street and far camera bookmarks. No bloom, screen-space ambient occlusion or image retouching is used. C is a realism direction, not a claim of photorealistic assets or parity with Dead Island. All options still need authored damage, denser prop stories and richer interiors.

The browser study captures four bookmarks for each look, plus albedo, mapped roughness and shading-normal diagnostics. It exercises camera translation, exact camera/projection matching, source geometry preservation, restoration of original material identities, idempotent disposal and a 390px mobile control layout. The disposable controller releases its own textures and materials and restores the previous environment, light colours and exposure without disposing borrowed model materials. The normal inspection's engine-backed entry/cache/exit check also passes after adding the style controls.

Evidence is in `output/playwright/blackwater-looks/report.json`. GPU-submit-and-fence measurements are warmed local diagnostics at 1280×800, DPR 1, not whole-game FPS or pure GPU timestamps. The final successful run stayed below 12 ms p95 across the sixteen frames, within the 25 ms study budget on this test machine. The renderer reported about 69 MiB allocated after warming all styles; this is its own resource accounting, not a driver-level memory measurement. Cartoon/illustrated downtown use 367 draws because the hull outlines add a geometry pass; realism uses 211. The full-world budget remains for later profiling. The style study, restoration checks, separate pharmacy traversal check and build all passed.

```powershell
# Resolve Playwright/Chromium locally or set PLAYWRIGHT_PATH and CHROME_PATH.
node tests/blackwater-looks-browser.mjs
node tests/blackwater-browser.mjs --inspection-only
node build.mjs
```

The inspection can also start directly with `?look=cartoon`, `?look=illustrated` or `?look=realism`. `window.__BLACKWATER_REVIEW__.looks.debug('albedo' | 'roughness' | 'normals' | 'final')` changes the real shader pipeline for diagnostic captures.

## Authoring and ownership

The new models are original source in `assets/blackwater-kit/architecture.js` and `materials.js`. `catalog.json` records local factory presets. They follow the [Vibe3D vibe-model workflow](https://github.com/vibe-stack/vibe3d/blob/main/.agents/skills/vibe-model/SKILL.md): editable Three.js source, deterministic parameters, named anchors/sockets, an ownership-aware dispose method, fixed previews and independent visual critique. This is a direct local implementation of that authoring contract, not an installed Vibe3D CLI or an upstream registry submission. The models are independent of the Thai Kit. Existing scenery elsewhere in the world retains its existing asset sources.

Architecture is planned before geometry and compiled into material batches. A building uses at most eleven mesh batches; each house uses ten. Models borrow district materials and own unique signs or siding clones. `createBuildingPlan` supplies the same furniture rectangles to the mesh and the collision adapter. Metres convert to the engine's four-metre cells at the coastal layout boundary. New lot footprints preserve the original navigation grid, with only the pharmacy cells deliberately opened.

## Validation ledger

Automated source checks: 52 passing engine, enemy AI, coastal layout and new Blackwater checks. They cover reciprocal doorway walls, visibility and bullet occlusion, blocked furniture, a clear supply approach, the truck route, checkpoint persistence, finite mesh attributes, deterministic residential variants, visible portal ray clearance and borrowed-material disposal.

The native WebGPU browser check captures all five inspection views, the integrated HarborWorld district and the mobile layout in a separate browser/server. Its walk test enters the actual grid doorway, collects the cache and returns outside. The report and captures are in `output/playwright/blackwater-01/`. GPU-submit timing in the isolated inspection is a local diagnostic, not a full-world FPS claim.

Commands:

```powershell
node --test --test-isolation=none engine.test.mjs enemy-ai.test.mjs tests/coastal-world.test.mjs tests/blackwater-district.test.mjs tests/blackwater-model.test.mjs
node build.mjs
# Resolve Playwright/Chromium locally or set PLAYWRIGHT_PATH and CHROME_PATH.
node tests/blackwater-browser.mjs
# Fast repeat of just the inspection and entry/cache/exit checks:
node tests/blackwater-browser.mjs --inspection-only
node tests/blackwater-game-smoke.mjs
```

The production smoke test passed in the built app with the real Start action and keyboard movement. It uses a debug position setup to reach this block, then enters, collects and exits through normal gameplay; health stayed at 100 and no runtime or HTTP errors were recorded. Its separate `production-report.json` records the result. The final cold startup took 132 seconds; an earlier successful startup took 161 seconds. Full-world loading remains slow and this iteration does not claim to fix it or establish a frame-rate target. It is not a complete combat campaign playthrough.

Independent first-pass visual review increased brief fit from 63 to 69/100 after distinct house silhouettes, smaller brick courses, pharmacy remnants, notices and cables. The reviewer still finds the road too clean and the disaster story thin. These scores assess an early environment slice, not resemblance to a supplied screenshot or AAA parity. A close rear-shelf capture was also flagged; the traversal capture now stops at the cache and looks across the interior before exiting. The reviewer confirmed that the revised standing-eye view resolves the visible clipping concern. This iteration establishes a reviewable direction. Broader interiors, dense encounter authorship, coastal framing and full-world loading/performance work remain open.
