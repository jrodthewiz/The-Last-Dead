# Build08 enemy visibility QA

## Diagnosis and repair

The campaign stream was producing enemy entries, but the renderer had an unconditional early continue after the Bellwraith branch. Generic entries therefore skipped their world transform and could remain at the procedural origin. The renderer now applies the simulation transform before the generic death-state path, while the Bellwraith continue remains scoped to its own authored branch.

The Warden path now routes kinds 0, 1, and 2 through the authored GLB base plus procedural regalia. The regalia is named and pickable, uses independent procedural albedo/roughness/bump maps, and adds readable per-kind silhouettes: agile stalker, caster halo, and heavy back plate.

Bellwraith geometry previously extended below local y=0. The factory now applies a 1.1 render scale, derives its floor offset from measured Box3 bounds, exposes floorOffset and visualSize in userData, and keeps the collider synchronized with those measured bounds. Current procedural bounds are size [1.650272, 1.982302, 1.267152] with floorOffset 1.121560.

## Hardware test contract

tests/build08-enemy-visibility.mjs runs in an isolated Playwright Chromium context using the installed Chrome binary and --use-angle=d3d11, with no SwiftShader flag. It waits for naturally spawned campaign enemies across the first three queues, aims at each live enemy, and records the rendered root position, visible mesh state, authored Warden marker, and camera. The gate requires:

- at least one natural sample for each kind 0, 1, and 2;
- authored Warden root and visible root;
- at least one visible mesh;
- root-to-simulation position error no greater than 0.01;
- no page errors or failed asset responses.

The run writes docs/build08-enemy-visibility-actual.png and docs/build08-enemy-visibility-results.json. It does not inject an enemy or navigate the user's existing tab.

## Evidence

The latest hardware-backed run passed all three natural variants:

- kind 0 stalker: EvilWarden root, 37 meshes, 35 visible meshes, authoredWarden true, position error 0;
- kind 1 caster: EvilWarden root, 41 meshes, 39 visible meshes, authoredWarden true, position error 0;
- kind 2 brute: EvilWarden root, 41 meshes, 39 visible meshes, authoredWarden true, position error 0.

The latest natural run reported 276 renderer calls, 251,378 triangles, 793 geometries, and 48 textures on the NVIDIA D3D11 path. The standalone Warden review reported 38 calls and 33,722 triangles per instance; the three-variant review reported 123 calls and 103,198 triangles before world rendering. GLB geometry and textures are shared between instances by the renderer.

The fixed-view screenshot proves presence and transform alignment for the current scene. It does not establish a final performance budget or cover every lighting angle; those remain part of the root smoke and playtest pass.

## Validation

Source syntax checks passed for npc-warden.js, npc-bellwraith.js, and tests/build08-enemy-visibility.mjs. The Node model contract passes for both Bellwraith and Reliquary. The generated JSON and screenshot are the review artifacts for the hardware run.
