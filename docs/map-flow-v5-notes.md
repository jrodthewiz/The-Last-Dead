# Map flow v5: Catacomb crossing

The Rib Colonnade now uses seven authored flank-cover cells in place of its generic colonnade pattern. Its shallow four-cell depth previously put two solid cover cells directly on the processional aisle. The southern arrival could not see the court approach, and reaching the central north threshold required stepping sideways around the barricade. The east crypt arrival also faced a cover cell when looking toward the central junction.

The western cover mass and lower eastern pair retain two fallback positions around the existing rib stacks. The center aisle and east arrival lane now expose the next decision. No room, opening, corridor, landmark, key, encounter, prop, or light was added. The source remains `playground/map/dungeon-data.js`; the compiler and live course adapter continue consuming the same authored data.

## Deterministic measurements

Before means the previous v4 colonnade pattern reconstructed on the current floor data. After means the authored v5 cover. Both use fully open topology; these are route and geometry-budget measurements, not frame-rate measurements. One cell is four metres.

| Measure | Before | After |
| --- | ---: | ---: |
| Southern hub arrival → central north threshold | 20 m / 2 turns | 12 m / 0 turns |
| Southern hub arrival → court approach | 32 m / 3 turns | 24 m / 0 turns |
| Whole-floor shortest entry → exit | 188 m / 14 turns | 188 m / 14 turns |
| Walkable cells | 396 | 396 |
| Hub cover cells | 7 | 7 |
| Whole-floor cover cells | 41 | 41 |
| Compiler boundary-wall segments, including cover boundaries | 472 | 466 |
| Permanent rendered wall segments, excluding cover boundaries | 366 | 365 |
| Authored room encounter budget | 84 | 84 |
| Rooms / corridors / openings | 11 / 11 / 21 | 11 / 11 / 21 |

The ray from southern arrival `(19.5,17.5)` toward the court approach `(19.5,11.5)` previously hit cover after half a cell. It now reaches the approach when the intervening combat door is open. The east arrival interior `(23.5,15.5)` has a clear horizontal view to the junction `(19.5,15.5)`. Room-shape wall bays still constrain diagonal views; the design does not promise a straight diagonal between every doorway.

## Checks and ownership

Changed files in this map-flow subtask:

- `playground/map/dungeon-data.js`: the F3 hub's cover and authored arrival sightlines only. Other existing repository changes are preserved.
- `tests/map-flow-v5.test.mjs`: continuous body-clearance, both arrival sightlines, local route improvement, unchanged budget/gate/landmark data, and key-versus-required-combat descent checks.
- `world-polish.js`: the F3-only decorative floor-cluster correction described below, before instancing.
- This document.

Focused command:

```powershell
node --test --test-isolation=none tests/map-flow-v5.test.mjs tests/dungeon-route-topology.test.mjs tests/dungeon-footprint.test.mjs tests/dungeon-ingress.test.mjs tests/dungeon-flow.test.mjs
```

All 23 initial tests passed. After the decorative correction below, adding `tests/world-polish.test.mjs` and `tests/world-setdressing.test.mjs` to this command passes all 28 tests. Existing coverage includes every floor's required encounters and descent, reserved collision/render wall slots, optional loop reachability, no isolated floor pockets, exact doorway ingress, co-op spawn safety, and body motion through arrival openings. The new tests sample a radius of `.32` cells at `.125`-cell intervals along both improved lanes. The reliquary key is reachable before its gate; taking it does not mark unplayed mandatory encounters as cleared or set `exitReady`.

No build or GPU/browser capture was run by the map-flow worker. Integrated production/browser verification belongs to the parent task and must be reported separately. The cover and rendered-wall budgets do not increase, but that alone is not a measurement of whole-game frame time. A full human campaign and physical-phone play remain outside the deterministic checks.

## Decorative clearance correction after visual review

The first integrated south-arrival captures, `output/playwright/map-v5-compressed/f3-south-final.png` and `f3-south-no-post.png`, exposed a limitation of grid-only checks: a pale tipped barrel, candles, bone rubble and skull scatter still crossed the now-open center aisle. Both images were inspected. The authoritative source is `world-polish.js` → `buildWorldLifeKit` → `dressOssuary`, whose deterministic `WorldLife_*` instances are built by the cathedral kit. The similarly named `course.props` placement records are not consumed by that builder. The preserved upright rib landmarks were not the failing objects.

Five floor clusters now move to authored flanks, after recipe generation and before instancing. The table uses world X/Z in metres; all values are relative to the same fixed seed and LIFE_VERSION 2 recipe.

| Instance family / index | Before X/Z | After X/Z |
| --- | --- | --- |
| `barrelTipped` / 4 | 76.857 / 64.220 | 75 / 66.5 |
| `bonePile` / 12 | 76.133 / 59.598 | 74.7 / 62.7 |
| `skull` / 8 | 78.330 / 60.674 | 85.8 / 58.2 |
| `wax` / 1 | 75.971 / 59.907 | 74.8 / 57.8 |
| `wax` / 5 | 77.945 / 62.887 | 83.5 / 66.7 |

The skull's attached eye instance and the two flame instances attached to each wax cluster move by their parent's exact translation. Y position, scale, rotation, material, geometry and generation seed order stay identical. The floor keeps **126 instances, 13 instanced draws and 105,878 instance triangles**; no extra material, light, texture or mesh is created by the correction. The banking function executes once during world construction and adds no frame-loop work. Other floors return immediately without moving any cluster.

The added regression builds the actual source and corrected instanced meshes, compares their budgets and every transform element other than X/Z translation, then tests transformed mesh bounding boxes against two body/view volumes: central X76.72–79.28, Z46–70 and east X78–94, Z60.72–63.28, both at Y0.15–2 m. The source reproduces at least five intersecting instances; the corrected geometry has zero intersections. Each relocated cluster center remains on walkable floor. The index selectors deliberately refer to this stable recipe; a future recipe/version change must rerun these real-geometry checks rather than assume those indices still represent the same groups. Final integrated recapture remains the parent task's responsibility.

## Reference ledger

Loaded `threejs-gameplay-systems/SKILL.md`, `references/gameplay-workflows.md`, and `references/physics-engine-selection.md`; also loaded `threejs-qa-release/SKILL.md`, `references/qa-release-checklists.md`, `references/checklists/playtest-qa.md`, and `references/checklists/visual-verification.md`. All required references for this bounded layout/topology subtask were read successfully. The existing grid collision stays in place; no new physics engine, package, runtime loop, collider type, or timestep was introduced. The playable loop remains: move through readable thresholds, survive room encounters, retrieve the floor key, then descend after required combat is complete.
