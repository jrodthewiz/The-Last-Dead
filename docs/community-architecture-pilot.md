# Community architecture pilot

## Source shortlist

Likely collection: https://github.com/AgentsLoop/awesome-opus-5.5-games . The user has not confirmed this is the collection they meant. AI/model attribution is the collection's claim, not independently verified.

- https://github.com/StarKnightt/night-street — selected for recessed windows, cornices, fire escapes and fixtures emitted into four material groups. MIT, pinned to 333f064778105640588a95d2c2d150780044e7bf. Its original shader-baking/rendering stack is not imported. Its README reports substantial startup baking cost; this adaptation uses ordinary standard materials.
- https://github.com/L1vsun/NEONBAY — MIT. Useful next reference for coastal district generation, roads, bridges and instanced city rendering. Its driving-focused city does not supply the explorable rooms our game needs. No code incorporated yet.
- https://github.com/az9713/opus-5.5-open-world-game — felt/yarn art direction does not fit Low Tide. Not incorporated.
- https://github.com/LJAguil/Npc-Village — candidate for later interaction research; not selected or incorporated.

## Implemented

Three deterministic tenements replace three far-bank visual buildings, retaining the Thai/Vibe3D district. They face the quay as a joined row, with distinct heights, window details and rooftop equipment. A grounded quay and coping now support the far-bank silhouette. These are background buildings across the water, not newly explorable interiors. All six existing playable rooms, door prompts and collision routes remain authoritative.

The row totals 13,108 triangles and 12 material draws (excluding the two quay meshes and any extra rendering passes). Each building owns four merged geometry groups, opaque windows, computed bounds and normal frustum culling. It adds no dynamic lights, external runtime requests, shader baking or transparent sorting. Source materials are replaced with the game's muted palette. This is a bounded geometry-budget result, not a measured frame-rate improvement.

Source/license manifest: assets/community/source.json and NIGHT-STREET-LICENSE.txt. The generated runtime module is bundled locally. Optional regeneration uses scripts/build-community-building.mjs and the pinned source adaptation in .art-source; the normal build does not require that archive or npm dependencies.

## Verification

- 9 node tests passed: geometry budgets and finite bounds across nine variants, deterministic generation, invalid-input rejection, six rooms, navigation and Thai placement bounds.
- tests/community-buildings-browser.mjs: integrated three-building row, six rooms, native WebGPU identity, both renderer captures, no page/console/shader errors.
- Production build passed.
- Evidence: output/playwright/community-buildings/report.json and webgl-row.png / webgpu-row.png.

## Next bounded iteration

Adapt one facade kit to a playable building only after four-sided exterior detailing, ground-floor door alignment, interior visibility/occlusion and room collision are tested. Preserve the existing room authority. Use NEON BAY's layout approach as a reference for an additional connected block; do not import its entire renderer or replace the current movement/weapon stack. Add geometry/texture budgets and camera-route measurements before district-scale duplication.
