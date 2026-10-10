# Blackwater / inspection 02

This is the second bounded rendering iteration after the first comparison was rejected. The AAA target remains open. This pass makes two art directions distinct enough to choose at phone size; it does not establish parity with Dead Island or Left 4 Dead.

Open the separate [live inspection](http://127.0.0.1:5200/blackwater-review.html?look=cartoon). The existing game tab and its server were kept intact. A and C use the same geometry, building seeds, camera matrices and physical layout. B is withheld from the controls because it did not develop an identity distinct enough to earn a third choice.

| Direction | Actual treatment | Codex Remote comparison |
| --- | --- | --- |
| A — Graphic horror | Three light bands, broad colour groups, screen contours, designed cloud banks and warm pharmacy destination | [Downtown above houses](blackwater-02-a.jpg) |
| C — Realism direction | Scanned brick/timber/asphalt, quiet painted siding and stone/concrete roles, physical roughness/normal maps, local wet gutters and HDR sky reflections | [Downtown above houses](blackwater-02-c.jpg) |

The JPEGs are 960 × 1212, about 105 KiB each, saved in non-ignored docs for Remote delivery. They only resize, encode and arrange actual native WebGPU screenshots. No AI-generated scene, painted replacement, or scene-pixel retouching is included. These are engine-backed inspection renders of the real game models; the main game's full renderer does not yet expose the A/C style selector.

## What changed

The shared district has sixteen lots, including eight houses and the continuous pharmacy interior. Wrecks now have tapered bodies, deformed hoods, physical wheel apertures, curved tyres/fenders, inset glazing, rubber seals, wipers and light lenses. Luggage has rounded edges, straps and handles. Failed pharmacy canopy/parapet pieces connect to rubble below; the nearest house has a broken porch, exposed rafters and missing upper cladding. A medical trolley and abandoned chairs, weeds, gutter drains, litter and broken bricks support the evacuation story. Lower warehouses, a water tower and a mill bridge replace the large background boxes.

The first scanned material pass failed visibly: one peeled plaster map dominated siding, trim, ceilings and paving; asphalt looked brown and brick looked uniformly pale. That pass was corrected. Painted clapboard, limestone, concrete and paving now have separate quiet surface identities. Heavy peeling is an explicit damaged-plaster material rather than a universal skin. Current source scans use red brick and neutral asphalt. The brick tile represents 1.4 metres and asphalt 2.1 metres. The exact download URLs, authors, transformations, hashes and CC0 licensing are in [texture-sources.json](../assets/blackwater-kit/texture-sources.json).

The pharmacy has two local warm practicals and luminous fixture geometry. The camera includes the abandoned wreck/luggage in the foreground, the pharmacy in the middle and the industrial landmark beyond. A and C preserve the open doorway and six-metre road corridor.

## Rendering and resource ownership

Native Three.js r184 WebGPU rendering owns:

1. Full-resolution geometric-normal/depth pre-pass. Sky and hull outlines are excluded.
2. Half-resolution r184 GTAO, twelve samples and a 0.55 metre radius.
3. A 3×3 depth/geometric-normal bilateral reconstruction, fed into indirect material lighting. Sun and emission retain their energy.
4. Lit scene, then explicit tone mapping/colour conversion into an encoded intermediate.
5. r184 FXAA on the encoded image. A additionally derives 1.3 pixel contours from depth and geometric normals.

There is no temporal accumulation, bent-normal output, SSR or volumetric-weather claim. Normals for AO are geometric; material diagnostics additionally display the actual mapped shading normals. Wet gutter position drives both road colour and roughness. The original materials remain recoverable, and repeated style changes preserve source geometry. The controller disposes owned passes, intermediate targets, materials and noise/sky textures without disposing borrowed model materials or surface scans.

Matching official implementation references: [r184 AO example](https://github.com/mrdoob/three.js/blob/r184/examples/webgpu_postprocessing_ao.html), [r184 FXAA source](https://github.com/mrdoob/three.js/blob/r184/examples/jsm/tsl/display/FXAANode.js). Vendored addon imports point to the already bundled r184 modules; the MIT license remains in vendor/THREE-LICENSE.txt. Runtime makes no texture-provider requests.

The whole subject has 253 source meshes and 221,421 triangles before camera visibility, shadows or extra rendering passes. Four active scanned sets contain twelve maps, 10.93 MiB on disk and an estimated 128 MiB with RGBA8 mipmaps. Additional small procedural maps, shadows and rendering targets are separate costs.

## Verification

- 54 source tests passed: existing engine/AI, coastal layout, Blackwater collisions/models, real portal rays, truck corridor, deterministic geometry, outward vehicle glazing, visible tyres through fender openings, finite attributes, budgets and ownership.
- The desktop canvas and mobile inspection-control layout were captured. Mobile verification is layout/resize evidence, not phone GPU or touch-walking validation.
- Both A and C passed actual W/S keyboard pharmacy entry → persistent supply pickup → street return in the engine-backed inspection. Desktop captures and 390px control/resize checks passed.
- The built production app passed real Start, pointer capture and the same entry/pickup/exit path after debug position setup into the block. Its cold startup was 119.8 seconds; full-world preparation remains slow.
- Styling QA captures twelve matching views across Original/A/C, material albedo/roughness/normals, pipeline depth/normals/AO, and an otherwise identical no-AO frame. It exercises camera translation, restoration and idempotent disposal. Each measured frame waits for a new animation frame so scene passes actually refresh.
- No console/page error or HTTP error was recorded. Build passed.

Evidence is under output/playwright/blackwater-02/report.json, walk-cartoon/inspection-report.json and walk-realism/inspection-report.json. Built-app evidence is output/playwright/blackwater-01/production-report.json. Source screenshots were inspected directly and again through the compact Remote JPEGs.

| View at 1280×800, DPR 1 | Original median / p95 ms | A median / p95 ms | C median / p95 ms |
| --- | --- | --- | --- |
| Downtown | 13.2 / 15.2 | 26.5 / 29.4 | 34.2 / 38.7 |
| Houses | 10.7 / 13.0 | 16.9 / 20.0 | 20.7 / 23.2 |
| Pharmacy | 10.3 / 10.9 | 17.0 / 18.8 | 19.5 / 21.6 |
| Overview | 14.2 / 17.3 | 29.9 / 33.5 | 27.3 / 30.4 |

These are warmed render-submit/fence wall-clock diagnostics on this machine, not pure GPU timestamps or sustained whole-game FPS. Extra scene/AO passes bring downtown to 514 draws and 358,997 rendered triangles; houses use 316 draws and 182,687 triangles. Renderer allocation accounting peaks near 348 MiB after warming both looks. The 33.3ms inspection budget is not met by C downtown or A overview p95. Main-world frame rate and true phone-GPU performance remain unverified. Further render batching/pass optimization is required before promoting the chosen direction to the whole game.

## Independent visual scorecard

A read-only ruthless creative director reviewed actual downtown/houses captures at full resolution and at 390px. It found the directions useful to choose, with A currently more coherent. It found no still-image defect that needed another correction before showing this comparison. This is evidence-based critique, not a council vote.

| Exact category | Before A/C | After A | After C | Evidence |
| --- | --- | --- | --- | --- |
| Art direction | 1 / 1 | 2 | 1 | A has coherent contours/value groups; C still puts physical textures on conspicuously stylized forms |
| Hero/player | UNVERIFIED | UNVERIFIED | UNVERIFIED | Not judged in the comparison |
| Obstacles/enemies | UNVERIFIED | UNVERIFIED | UNVERIFIED | Wrecks do not verify active enemy telegraphs |
| Rewards/interactables | UNVERIFIED | UNVERIFIED | UNVERIFIED | Collection later passed, but full visual desirability/feedback was not reviewed |
| World/environment | 1 / 1 | 2 | 2 | Foreground evacuation objects, damage and a background landmark |
| Materials/textures | 1 / 2 | 2 | 2 | Corrected role hierarchy and physical scales |
| Lighting/render | 1 / 1 | 2 | 2 | Destination light, AO/no-AO contact comparison and readable values |
| VFX/motion | UNVERIFIED | UNVERIFIED | UNVERIFIED | Translation/traversal later passed, but a full effects/motion review is pending |
| UI/HUD | UNVERIFIED | UNVERIFIED | UNVERIFIED | Inspection controls fit; full game's HUD hierarchy not rated |
| Performance evidence | 2 / 2 | 2 | 2 | Counts, budgets, build and browser evidence; whole-game profiling remains open |

Applicable visible-category average: before A 1.2/3, C 1.4/3; after A 2.0/3, C 1.8/3. A complete ten-category average is unavailable. Automatic failures/remaining quality gates prevent an AAA/showcase claim: repeated clean facade rhythms still dominate, realistic vehicle transitions are insufficient, the interior lacks an interrupted evacuation history, and the far street remains sparse under the gantry. Premium requires every category at least 2 and an average at least 2.3; showcase requires at least 2.7 and six categories at 3. This pass does not meet those gates.

The next bounded environment change should open and furnish one house, connect a larger structural failure to its debris and evacuation story, and give the pharmacy displaced shelving/packaging while preserving the route. Art direction choice can then govern model proportions, material wear and lighting across that richer slice. Encounter pacing, infected movement and sound, weapon/character presentation and longer objectives remain separate work toward the user's full apocalypse-town goal.

## Skill-loading ledger

Root public skill files loaded from C:/Users/wolfk/.codex/skills:

- threejs-game-director/SKILL.md — coordination and evidence rules.
- threejs-skill-router/SKILL.md — smallest relevant rendering skill set.
- threejs-aaa-graphics-builder/SKILL.md — AAA graphics quality gates; geometry/surface/lighting production.
- threejs-gameplay-systems/SKILL.md — gameplay systems and existing grid/timestep preservation.
- threejs-game-ui-designer/SKILL.md — UI/readability and inspection selector fitting.
- threejs-debug-profiler/SKILL.md — debug/profile measurements and defects.
- threejs-qa-release/SKILL.md — QA/release journey, build and browser evidence.
- threejs-3d-generator/SKILL.md and threejs-image-generator/SKILL.md — external sourcing considered before fallback.
- threejs-screen-space-ambient-occlusion/SKILL.md, threejs-procedural-materials/SKILL.md, threejs-shadow-systems/SKILL.md, threejs-camera-direction/SKILL.md and threejs-visual-validation/SKILL.md — applied specialist contracts.

Delegated worker ownership: architecture/district/set-dressing; source materials/maps/asset ledger; read-only visual critique. Root owned rendering, cameras, integration, QA and this report. No sibling-loading fallback was needed. Audio generator is not applied to this bounded render comparison; no audio asset change or full audio-quality claim is made.

## Reference ledger

The following relevant references/checklists were read in their filesystem-backed skill roots before or during their respective phases:

- threejs-aaa-graphics-builder/references/{visual-scorecard,implementation-blueprint,model-recipes,render-recipes}.md
- threejs-aaa-graphics-builder/references/checklists/{aaa-game-quality-gate,aaa-visual-scorecard,procedural-model-quality,material-lighting-quality,performance-safe-visual-detail}.md
- threejs-gameplay-systems/references/gameplay-workflows.md
- threejs-game-ui-designer/references/ui-patterns.md
- threejs-debug-profiler/references/debug-profile-checklists.md and references/checklists/performance-profile.md and references/checklists/scene-debugging.md
- threejs-qa-release/references/qa-release-checklists.md and references/checklists/{visual-verification,playtest-qa,release}.md
- threejs-screen-space-ambient-occlusion/references/gtao-bent-normal-pipeline.md
- threejs-procedural-materials/references/procedural-pbr-system.md
- threejs-camera-direction/references/camera-rig-and-cinematic-systems.md
- threejs-visual-validation/references/graphics-validation-protocol.md
- Matching bundled r184 PassNode, RenderPipeline, RTTNode and complete FXAANode source; official r184 AO example.

Shadow clipmap, new physics-engine selection, new character/VFX/audio and general image-pipeline rewrites were not implemented; their deeper references were not needed for this pass.

## External asset sourcing

Credential probe output (presence only; no secret printed):

    TRIPO_API_KEY=MISSING
    GEMINI_API_KEY=MISSING
    ELEVENLABS_API_KEY=MISSING

The director shell probe produced no useful marker text on this host; the process/user environment presence check above established the literal results. External 3D generator and image generator API calls were unavailable. Chosen sources:

- Hero/player, enemies/weapons: existing game assets; no new generated asset in this pass.
- Vehicles and signature props: original authored geometry with physical footprint preservation.
- World/sky/background: editable original architecture/industrial silhouettes plus analytical/procedural sky.
- Materials/textures/decals: hybrid local Poly Haven CC0 scans and restrained authored fine-grain maps/signage. Example real outputs: assets/textures/blackwater/red_brick_diff.jpg and assets/textures/blackwater/clean_asphalt_diff.jpg.
- Logos/icons/GUI art: existing inspection controls and original in-world signs.
- Audio/SFX/voice: existing game audio; audio generator not needed for this still-render direction tranche.

Provider usage, licenses and exact source evidence are preserved in the asset ledger. No proprietary game source code was copied.

## Phase ledger

| Phase | Status | Evidence / limit |
| --- | --- | --- |
| Gameplay systems | Preserved and verified | Existing physics engine is the grid/capsule authority, fixed 1/120 timestep, original collider footprints and clear truck/doorway routes |
| AAA graphics | Bounded iteration complete; AAA gate open | Authored forms/damage, corrected surfaces, native render pipeline, matching captures and independent review |
| UI | Inspection selector verified | Two visible directions, keyboard walk controls and 390px fitting |
| Debug/profile | Complete for this inspection; full world open | Field/pass diagnostics, once-per-frame timings, restoration/ownership; some budget misses |
| QA/release | Bounded checks passed | 54 tests, build, both style walks, built production smoke; no publish or complete campaign claim |
