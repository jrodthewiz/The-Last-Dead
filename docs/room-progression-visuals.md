# Room progression visual kit

The room pass gives the campaign a compact Doom/Quake-style visual grammar: a
short forward spine, side pockets for flanking, boundary doors that read as
real architectural openings, and a distinct landmark in each combat band. The
visual kit consumes progression-authored room data when available and uses a
deterministic four-room fallback for standalone renderer/playground runs.

## Layout contract

`buildHorrorDetails(root, materials, course)` now returns `rooms`,
`roomChunks`, `roomPlan`, and `route`. It also appends only animated portal
roots to `authored.moving` and wraps `authored.animate(time)` with the room
signal animation.

Each room root is named `RoomChunk_<sector>_<room>` and carries:

- `userData.roomChunk = true`
- `userData.roomId`, `sectorId`, and `streamRadius`
- `userData.roomBounds` as a world-space `THREE.Box3`
- `userData.roomBoundsArray` and `roomBoundsCells` for serializers/culling
- `userData.staticBatchEligible = true`, `roomBatchBoundary = true`,
  `preserveBatchBoundary = true`, `noBatch = false`

The progression source can provide `course.rooms`,
`course.roomPlan.rooms`, or `course.layout.rooms`. A room may use
`bounds:{minX,minZ,maxX,maxZ}` plus `portals`. Horizontal portals carve the
north/south boundary and vertical flank portals carve west/east boundaries;
the frame is placed at the same span. This keeps collision/progression doors
and visible doors on the same edge. Interior `cross-court` links do not create
an accidental wall.

The fallback room graph is an entry bay, two flank pockets, and an objective
vault. Progression-authored rooms can instead provide paired door spans and a
side loop inside a combat band. Rooms are linked by a low profile route deck
only when a declared non-flank portal connects them; arbitrary center-to-center
rails are never added. The graph is small enough to iterate quickly while still
creating route choice and sightline breaks. It does not modify collision data.

## Visual language

The three sectors share construction rules but carry separate material roles:

- Bloodworks: oxblood wall panels, warm steel, ivory supports, clinical red
  signals, worn copper hazard strips.
- Ossuary: indigo stone, bone trim, dark iron, ultraviolet signal seams, rib
  and spine feature bays.
- Choir: oxblood plaster, burnished brass, warm iron, amber signal seams,
  suspended bell and pipe feature bays.

`room-materials.js` reuses the bundled crypt-wall albedo, gunmetal
albedo/normal/roughness, and industrial flesh/metal surfaces as the PBR base
layers. It adds one small procedural tile per sector/style/purpose for linear
wall, panel, and floor breakup; each tile has seams, scratches, edge wear, and
sector-specific marks. Those layers are reused through shared
`MeshStandardMaterial` roles with albedo maps in sRGB space and detail
normal/roughness maps in linear space. The geometry kit reuses a compact
library of boxes, pillars, pipes, rings, bells, and spheres; floor tiles,
ceiling coffers, hazard borders, and portal frames use `InstancedMesh`.

Static wall shells, pillars, floors, route decks, and feature bays remain
batch eligible. Portal groups are the only dynamic room objects and are marked
`noBatch`; they use emissive signal meshes and a small oscillating gate, with
no per-room `PointLight` additions. Major pillars and portal jambs cast
shadows; small repeated details only receive light to protect the frame budget.

## Skill and reference ledger

| Guidance | Status | Path | Use |
| --- | --- | --- | --- |
| AAA graphics builder | loaded | `threejs-aaa-graphics-builder/SKILL.md` | Production graphics workflow and sourcing gate |
| Visual scorecard | loaded | `threejs-aaa-graphics-builder/references/visual-scorecard.md` | Active-play scoring and automatic-failure rules |
| Implementation blueprint | loaded | `threejs-aaa-graphics-builder/references/implementation-blueprint.md` | Material roles, world layers, batching, diagnostics |
| Model recipes | loaded | `threejs-aaa-graphics-builder/references/model-recipes.md` | Authored world-kit and modular-prop rules |
| Render recipes | loaded | `threejs-aaa-graphics-builder/references/render-recipes.md` | Small lighting stack, readable depth, shadow discipline |
| AAA game quality gate | loaded | `threejs-aaa-graphics-builder/references/checklists/aaa-game-quality-gate.md` | Release criteria |
| AAA visual scorecard | loaded | `threejs-aaa-graphics-builder/references/checklists/aaa-visual-scorecard.md` | Premium/showcase thresholds |
| Performance-safe detail | loaded | `threejs-aaa-graphics-builder/references/checklists/performance-safe-visual-detail.md` | Instancing, shadow, DPR, and worst-case checks |
| Image generator | loaded | `threejs-image-generator/SKILL.md` | Texture/reference decision gate |
| 3D generator | loaded | `threejs-3d-generator/SKILL.md` | High-value model sourcing decision gate |
| 3D API notes | loaded | `threejs-3d-generator/references/api-notes.md` | Provider task/download rules |
| Three.js integration | loaded | `threejs-3d-generator/references/threejs-integration.md` | Runtime asset intake/performance rules |
| Image/3D workflows | loaded | `threejs-3d-generator/references/image-generator-workflows.md` | 2D-to-3D handoff rules |

## Asset sourcing ledger

| Surface | Source | Decision/evidence |
| --- | --- | --- |
| Room shells, walls, doors, coffers | Procedural Three.js | Repeated support architecture; authored geometry is cheaper to cull/batch and keeps portals aligned to progression bounds |
| Wall/panel/floor surfaces | Procedural texture tile + existing material library | Four small shared style tiles per sector; no unique per-room texture allocation |
| Hero/enemy models | Existing bundled GLB/procedural enemy families | This room pass does not duplicate high-value actor assets; renderer already owns their import and pooling |
| Signature sector landmarks | Existing `world-authored.js` machinery plus room feature bays | Existing landmark factories are reused; room kit adds only compact support silhouettes |
| Generated 3D assets | Skipped for this support-surface pass | `TRIPO_API_KEY=MISSING`; no new hero/landmark generation was needed because the repo already contains bundled high-value models and the requested room geometry is repeated modular architecture |
| Generated 2D assets | Skipped for this support-surface pass | `GEMINI_API_KEY=MISSING`; procedural tile references provide the required readable variation without adding network/runtime dependencies |

The required credential probe was attempted from the documented director path,
but the local Bash runner returned an access-denied error. The direct shell
status checks were `GEMINI_API_KEY=MISSING` and `TRIPO_API_KEY=MISSING`; no
credentials were written to source or assets.

## Performance contract

The kit targets a 144 Hz desktop frame budget of 6.94 ms. It keeps room detail
within shared-resource geometry, instanced tile/trim batches, conservative
room-root bounds, no per-room dynamic lights, and no frame-loop allocation from
room animation. The renderer owns final DPR, static batching, culling, and
profiling. The room-side acceptance checks are:

- each room has a finite world-space bounds box;
- all static room roots remain batch eligible;
- only portal roots are moving/no-batch;
- geometry/material identity is reused across rooms;
- sector changes do not create a new light per room;
- the active-play renderer diagnostics are collected by the parent browser pass.

Run the room contract smoke check with:

```text
node tests/room-visual-contract.mjs
```

The browser performance evidence and 144 FPS result belong to the parent
renderer pass; this module deliberately does not claim a measured 144 FPS
until that active-play check completes on the target machine.

## Files

- `room-materials.js` — cached sector/style palettes and procedural surface tiles.
- `roomMaterialsReady()` — optional parent prewarm hook for bundled PBR texture uploads.
- `room-kit.js` — room shells, real boundary openings, portal frames, feature bays, route links, bounds metadata, and animation.
- `world-horror.js` — integration into the existing authored world hook.
- `tests/room-visual-contract.mjs` — headless geometry/metadata contract check.
