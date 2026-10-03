# Thai Kit harbor composition

This pass uses the user-requested Vibe3D / `@thai-kit/props` source from Dogfight. The editable factories are local runtime imports; no generation API or network fetch occurs during play. See the asset manifest for pinned source hashes, MIT provenance, measured bounds and resource budgets.

## Layout

- Seven building placements across the six existing lots replace the earlier Kenney building set. Five real three-dimensional building factories give Customs, Cold Storage, Workshop, Netmakers and Dock Offices different silhouettes. Power Cut has two rotated walk-up wings fitted inside its existing side bands.
- Customs Market groups food carts facing a clear walking lane, with seating and refuse collection opposite. East Transit places an abandoned van and tuk-tuk in the outer lay-by.
- Netmakers retains the open gate, rifle and tool cache; a parked pickup, drums and bin make an occupied working yard without closing the route.
- Loading aprons attach small vehicle and salvage clusters to the north side of Dock Road. The road centre remains clear for driving.
- Waterfront tables and carts create four pauses along the promenade. Street lamps establish a repeated junction rhythm. The northern perimeter gets short freight barriers rather than a new blocked route.

No random scatter is used. All coordinates are deterministic render metres. Solid supporting props export conservative yaw-aware AABBs for the engine to convert into gameplay coordinates. Existing building, yard and passage boundaries remain authoritative and visible. Nothing is added inside Power Cut or across the Netmakers gate. The old shipping container and roof water tower should be removed to avoid intersections with the replacement architecture.

## Runtime contract

`makeHarborThaiLayout(course)` returns `buildings`, `props`, `colliders` and named `zones`. `footprintFor(placement)` returns `{id,minX,maxX,minZ,maxZ}`. Building fit envelopes preserve proportions; rotated narrow wings have explicit local fit dimensions.

`new HarborThaiVisuals(parent, layout)` exposes `ready`, `diagnostics` and `dispose()`. Factories run once per asset per world. Placements clone shared geometry/material/texture resources. `dispose()` prevents late import placement; the enclosing world's normal disposer releases the resources. No added point lights, frame-loop allocation or animation is required.

The downloaded ghost tower was deliberately excluded: actual bounds revealed a two-triangle billboard with an unavailable texture, unsuitable for a walkable building. The existing Kenney player truck remains the functional driving vehicle.

## Verification

`node --test --test-isolation=none tests/harbor-thai-layout.test.mjs` passes: deterministic layout, unique IDs, world limits, interaction-point clearances, open Power Cut and Netmakers gate, and rotated vehicle bounds. Full-game navigation, renderer budgets and active screenshots are integration checks owned by the main pass; these unit checks do not establish visual quality or release readiness.

## Reference ledger

Read before implementation: graphics-builder `implementation-blueprint.md`, `model-recipes.md`, `render-recipes.md`, `visual-scorecard.md`, `checklists/performance-safe-visual-detail.md`; gameplay `physics-engine-selection.md`. Existing flat-road custom collision remains appropriate for static simplified bounds. No physics engine or renderer rewrite is introduced. Asset sourcing is explicitly the requested existing Vibe3D kit, with measured local source bounds instead of invented replacement geometry. No premium/AAA claim is made by this layout pass.

## Vibe3D map integration — 2026-10-02

The full existing 128 x 120 metre harbor now uses the pinned Thai Kit for seven building placements and 64 supporting props. The old Kenney buildings, shipping container and rooftop tower are removed; the functional Kenney driving truck remains. Market, transit, loading apron, salvage yard and promenade clusters share deterministic layout data with 64 conservative static prop collision footprints. Player/vehicle movement, sight rays, enemy pathfinding and the backpack field map consume those bounds.

Verification: 56 focused engine, AI, collision, map, navigation, vehicle and weapon tests pass. Production build passes. All 18 imported factories independently compile and render on the vendored Three r184. The assembled map renders all 71 placements without console or asset errors; the fixed street view records 149 draw calls and 68,076 triangles. These are view-specific counts, not a framerate benchmark. Screenshots in output/playwright/harbor cover street, truck, water, market, transit, yard and district overview.

This is a complete asset/layout pass on the current bounded harbor expedition. Buildings are exterior scenery with conservative collision envelopes; interiors, streamed neighborhoods and full open-world simulation remain future work. No claim of universal flicker-free rendering or production framerate is made.

Full-game browser rerun passed: real movement collects two weapons, backpack equips melee while retaining the other pickup, truck enters/drives/brakes/exits safely, water advances, and desktop/mobile backpack + field map checks pass with zero console, page or HTTP errors. Initial run missed a brief Q tap at low browser framerate; harness now holds Q until the state changes, then releases it. This is a test-input timing correction, not a gameplay bypass. Full report: output/playwright/thai-harbor/browser-report.json.
