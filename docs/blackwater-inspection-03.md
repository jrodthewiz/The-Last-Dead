# Blackwater inspection 03 — selected graphic horror
Date: 2026-10-03. User selected A / graphic horror, superseding further B/C direction work. This is a bounded environment iteration toward the larger apocalypse-town goal; it is not a complete AAA game claim.

## Delivered
Graphic horror is now the Blackwater runtime default, with the same role palette and three lighting bands used in the inspection. Runtime has 50 owned material variants and 13 spatial ink chunks (236,480 triangles, 1.6-pixel extrusion after source scale/instancing is baked). Source geometry/materials remain recoverable. One 2048 static directional shadow covers the 120m authored district rather than relying on the main coast shadow centered at spawn. Explicit TSL lighting excludes viewmodel/arena fills; local fixtures are excluded from the coast's general lighting list.

One of eight houses is furnished and enterable. Original 16×16m lot at world 192,72, yaw π remains intact. Twelve planned furniture/partition rectangles drive collision. Real front and rear doorways are centered at x194, z64 and z80; the corridor x192..196, z62..84 stays clear. One existing tree moved from 194.4,81 to 198.4,81 using the shared visual/collision record. Seven houses remain closed. The house measures 21,887 triangles / 15 material batches.

Interiors now have inward-facing window reveals, sashes, glazing, boards and curtains; warm furniture wood, living wood/rug and cool kitchen linoleum. Pharmacy story adds depleted stock, evacuation cartons, first-aid satchel, queue tape and departure notice. House story adds an interrupted meal, bag, carton, map, keys and photo. Story uses nine draws / 3,472 triangles; four surviving downward lamps use two fixture draws / 648 triangles and no local shadow maps. The closed industrial street endpoint adds four draws.

The first interior renders exposed clipped ceiling discs, flat black windows and undifferentiated green floors. Fresh corrected captures and an independent read-only direction review confirmed those three defects resolved at full size and 390px. Broad blank walls and sparse family-story readability remain artistic refinements.

## Actual image evidence
- [Built game: downtown and living room](blackwater-03-game.jpg) — normal weapon, HUD and bodycam active.
- [Closer house renders: living room and kitchen](blackwater-03-house.jpg) — native engine asset inspection with indirect GTAO and screen contours.
- [Street and pharmacy inspection](blackwater-03-street.jpg).
- Full frames and JSON evidence: output/playwright/blackwater-03/.

All images are native WebGPU renders of source game assets. JPEG delivery only resizes, stacks and compresses screenshots; no scene pixels were retouched and no AI concept image substitutes for a game render. Game bodycam/exposure differs from the cleaner inspection pipeline. Compact non-ignored JPEGs are provided directly for Codex Remote.

## Verification
58 source tests passed across engine, enemy AI, coastal world, district, models and graphic ownership. Seven focused rendering tests also passed, including two repeats and five additional compile/lifetime cases (63 unique checks total). Tests cover reciprocal walls, route continuity, real sight/rays through portals, furniture collision, fixed lot bounds, truck clearance, cache persistence, finite geometry and idempotent disposal preserving borrowed resources. The existing physics engine remains the custom grid/capsule authority, fixed timestep 1/120; no physics-library replacement.

Build passed. Isolated browser inspection passed with zero console/page error and HTTP failures, real W/S house traversal and return, pharmacy collection, and 390px controls/canvas resize. Isolated built-game Start → play passed in 43,086ms, actual W entered pharmacy and collected its persistent cache, S exited, W crossed living room/kitchen/rear exit, health remained 100. Actual source art-direction diagnostics confirm graphic-horror. Existing user tab and local server were not restarted or navigated. No complete combat campaign, real phone GPU, full-game mobile HUD, or loading-cancellation playthrough is claimed.

Renderer retirement now defers Blackwater resource disposal while an outgoing compile poll is pending, matching the existing retired-world buffer policy. That narrow cleanup change was syntax checked and its actual retirement path passed controlled pending-success, pending-failure and immediate-disposal tests; startup/traversal captures were taken before that cleanup-only change. It does not alter the delivered scene. Browser compile-cancellation verification remains open.

## Measured rendering
Submit-fenced stationary sequences at 1280×800, DPR1, native WebGPU in our isolated desktop browser. Inspection: 30 samples, first eight excluded; a fresh animation frame precedes every render. Production profiling temporarily suppresses its ordinary renderer call while manually measuring scene+bodycam; simulation/UI continue separately. These are renderer timings, not sustained gameplay or phone FPS.

| View | Draws | Triangles | Median ms | p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Inspection downtown | 530 | 396,435 | 14.6 | 21.6 |
| Inspection houses | 358 | 221,181 | 10.9 | 12.5 |
| Inspection pharmacy | 284 | 228,385 | 10.8 | 14.6 |
| Inspection living | 292 | 180,619 | 9.9 | 13.5 |
| Inspection kitchen | 262 | 172,055 | 9.2 | 10.5 |
| Inspection rear yard | 482 | 377,569 | 11.7 | 13.6 |
| Built game downtown | 1,153 | 1,507,441 | 29.5 | 32.0 |
| Built game living | 1,131 | 1,454,364 | 32.1 | 45.9 |

Inspection warmed allocation ~316.6MiB; built game reported 535,814,231 bytes (~511MiB). At a 33.3ms / 30fps render budget, downtown meets the measured p95; the house misses p95. Full-coast submission/bodycam and interior occlusion remain performance work. Different machine load and shader cache state prevent claiming a precise speedup against earlier tranches.

## Visual scorecard
Independent focused review of corrected environment frames, scale 0..3:

| Exact category | A inspection 02 | Corrected 03 | Evidence / limit |
| --- | --- | --- | --- |
| Art direction | 2 | 2 | Coherent exterior palette and ink; interior grouping improved |
| Hero/player | UNVERIFIED | UNVERIFIED | Existing gun/hands visible in production; focused hero review not performed |
| Obstacles/enemies | UNVERIFIED | UNVERIFIED | No active infected encounter in this tranche |
| Rewards/interactables | UNVERIFIED | UNVERIFIED visually | Pharmacy collection verified; desirability/feedback not fully rated |
| World/environment | 2 | 2 | Furnished connected rooms and evacuation story |
| Materials/textures | 2 | 2 | Role separation and window depth now visible |
| Lighting/render | 2 | 2 | Clipped ceiling discs resolved; source/runtime lamps shared |
| VFX/motion | UNVERIFIED | UNVERIFIED | Input/translation pass, no full effects/motion review |
| UI/HUD | UNVERIFIED | UNVERIFIED | Desktop production visible, inspector fits390px; full HUD review open |
| Performance evidence | 2 | 2 | Counts/memory/timings/build; interior p95 budget miss |

Five verified-category average 2.0/3, no scores of3. Complete ten-category average unavailable. Automatic failures: none newly confirmed in corrected environment stills. Full-game gates remain open: actor/weapon consistency, infected encounters, richer environmental history, phone performance and sustained combat profiling. Premium requires all categories≥2 and average≥2.3; this pass does not establish that.

## Skill-loading ledger
Director and sibling gameplay systems, AAA graphics, UI, debug/profile, QA/release and 3D/image generator skills were loaded in this continuing task; paths and common phase references are preserved in [inspection02](blackwater-inspection-02.md). Audio generator public skill and audio-workflows reference were additionally read; no audio implementation or premium audio claim in03. Procedural architecture, geometry, materials, shadows, camera direction, AO and visual-validation specialists were loaded. Root owns render integration, review UI, QA and reporting; workers owned geometry/collision and story/lamps; read-only critic reviewed actual captures. No skill-loading fallback.

## Reference ledger
Common required phase references carried forward from inspection02, including visual-scorecard, implementation-blueprint, model-recipes, render-recipes, AAA quality/scorecard, performance-safe visual detail, gameplay-workflows, UI patterns/checklists, debug profile/scene checklists and QA visual/playtest/release checklists.

Additional full references read:
- threejs-procedural-architecture/references/grammar-and-mesh-compiler.md and authored-financial-tower/building-system.js example.
- threejs-procedural-geometry/references/profile-sweeps-and-mesh-writers.md and sculpted-gallery-frame/frame-geometry.js.
- threejs-shadow-systems/references/cached-clipmap-shadows.md; only one bounded static map implemented, not a whole-world clipmap.
- threejs-gameplay-systems/references/physics-engine-selection.md; existing custom authority retained.
- threejs-game-ui-designer/references/checklists/{game-ui-quality,hud-readability,responsive-ui-fit}.md.
- threejs-3d-generator/references/{api-notes,threejs-integration,image-generator-workflows}.md.
- threejs-audio-generator/references/audio-workflows.md.
- Matching bundled r184 native LightsNode, NodeMaterial and ShadowNode code verified custom light arrays, camera/light layer filtering and shadow-camera layer ownership.

## External asset sourcing
Credential probe output (fresh Windows process/user presence check; no secret values):

    TRIPO_API_KEY=MISSING
    GEMINI_API_KEY=MISSING
    ELEVENLABS_API_KEY=MISSING

The prior director shell probe emitted no useful markers on this host, so the literal Windows presence check establishes availability. 3D generator, image generator and audio generator loaded; external generation blocked by missing respective credentials. Chosen sources: original editable architecture/furniture/props; world/sky/background uses the original district and analytical graphic sky; existing player/enemy/weapon/UI/audio assets. Materials/textures/decals remain hybrid original signs/maps plus local CC0 Poly Haven scans preserved in assets/blackwater-kit/texture-sources.json (e.g. assets/textures/blackwater/red_brick_diff.jpg). A drops scan albedo/normal/roughness for broad color groups but preserves printed sign maps. No proprietary Dead Island/Left4Dead code or assets copied. No new generated audio; existing audio unverified for premium quality.

## Phase ledger
| Phase | Status | Evidence / next gate |
| --- | --- | --- |
| Gameplay systems | Bounded house/pharmacy complete | Existing authority preserved; source and real-input traversal checks pass |
| AAA graphics | Selected direction adopted; AAA target open | Corrected shared source and runtime, captures, independent critique; no complete-game quality claim |
| UI | Inspector done for this tranche | House/kitchen/rear/walk controls, A default,390px fit; full HUD mobile review open |
| Debug/profile | Bounded evidence complete | Buffers/ownership, draw/triangle/memory/timing reports; interior p95 remains over budget |
| QA/release | Tranche passed |63 unique checks, build, native inspection and actual built-game walk; no publish or full-campaign claim |

Next bounded work should make the interrupted family departure readable through a few midground traces, add more authored structural damage, then verify an infected encounter in the selected style. Full-coast visibility/performance and actor/audio consistency remain work toward the larger goal.
