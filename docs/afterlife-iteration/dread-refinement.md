# Dread refinement: structural silhouettes

The latest active frames showed the same failure across the descent: repeated
smooth hoops, a pole with identical half-ribs, pale skull beads on flat wall
plates, and campaign ossuary piles made from many small spheres. Those forms
read as debug primitives at the player's eye height and weakened the horror
illusion.

This pass keeps the authored landmarks, route openings, and collision grid
unchanged. It replaces the visible support language in three static factories:

- `world-authored.js` now uses a faceted, beveled extruded tunnel rib. It keeps
  the existing `TunnelRib_*` names and jamb clearances while reading as a
  connected load-bearing band instead of a smooth torus.
- `world-horror.js` replaces the ossuary colonnade pole/half-torus/skull stack
  with two continuous service rails, full-width curved ribs, base plates, a
  top header, and restrained attachment collars. Every rib now meets a rail,
  so the silhouette reads as installed industrial hardware rather than snapped
  branches. The niche is an empty open mortuary frame with one narrow sill slit
  instead of a floating lump and cross.
- F3 tunnel bands now use the shared `wornSteel`/`steel` source material with an
  explicit `roomTrim` role. When the renderer supplies
  `assets/textures/dread-worn-steel-v1.webp`, the afterlife surface pass keeps
  its map on the authored arches and service details without another texture
  allocation.
- `world-setdressing.js` replaces the campaign skull mound's 33 skulls with
  nine irregular load fragments and four exposed remains, retaining the
  ossuary landmark cue and candle edge.

The fresh runtime frame exposed two remaining primitive artifacts. The bright
diagonal rod was the second, unnamed warmline tube in `makeTunnelSetpiece`; it
is removed while the dark supported service conduit remains. The pale faceted
wall ball was a `RibStackSkull_*` child emitted by `buildRibStack` in the
dungeon landmark source. `world-authored.js` now strips only those children on
F3 rib-stack landmarks, leaving each landmark's anchored ribs, spine, and base
in place. This changes neither collision topology nor the route, and it adds
no geometry or draw calls.

## Measured geometry budget

Counts below are geometry triangles per shared source mesh; instance totals are
shown where the factory repeats the mesh. They were measured from the
pre-change source and the current factories with the same deterministic seed.

| Surface | Before | After | Change |
| --- | ---: | ---: | ---: |
| Story tunnel rib | 384 / rib | 236 / rib | -148, 38.5% lower |
| F3 service frame | 1,712 / instance × 7 | 1,148 / instance × 7 | -3,948 total |
| F3 mortuary niche | 516 / instance × 10 | 240 / instance × 10 | -2,760 total |
| F3 niche signal | 192 / instance × 10 | 12 / instance × 10 | -1,800 total |
| Campaign skull mound | 8,430 total | 2,006 total | -6,424, 76.2% lower |

The affected geometry is merged by its existing material roles. The service
frame and niche share one existing static material batch; the worn-steel map is
owned by the parent material library and is not loaded or duplicated here. No
new draw class, light, or collision surface was introduced. Parent-owned blood
surface treatment remains the only blood atlas path.

## Review framing

For the screenshot judge, use a 16:9 Catacombs entry view at standing eye
height. Keep the first tunnel centered enough to show the clear lane, with the
left wall occupying roughly the left third so the connected service rails and
one empty wall niche are readable in silhouette. Keep the lamp exposure below
clipping; the goal is to judge the worn metal map, grounded base plates, sill
slit, and the dark negative space behind the arch. A secondary campaign Ossuary
frame should show one rubble mound at the edge of the route rather than aiming
directly at the prop.

Validation is covered by `tests/dread-refinement.test.mjs`, `tests/dungeon-art.test.mjs`,
and `tests/world-setdressing.test.mjs`. Browser capture remains parent-owned.

## Final visual-review correction

The connected rib frame above still read as a primitive tree in the actual
entry view. It is superseded by `ossuary-mortuary-console-v4`: grounded uprights,
three chamfered drawer fronts, tubular pulls, label plates, and a projecting
middle transfer tray. The current console is 672 triangles per instance × 7,
in one merged instanced draw. The earlier 1,148-triangle service-frame budget
is historical.

The remaining pale wall bead was a separate renderer source:
`StoryWallRelief_skull-ossuaries_NicheSkull`. Runtime raycasting identified
instance 49 at the right of the entry lane. The renderer's skull-ossuaries
branch now produces mortuary hatch lips, recessed faces, pulls, and labels in
the same four instance pools. The entire entry overhead conduit is removed;
the earlier removal of only the signal tube did not remove the diagonal rod.

Final production captures are `../dread-refinement/scene-after.png`,
`mortuary-console.png`, and `mortuary-hatch.png`. The closeups use the gameplay
lantern at additional viewpoints; they do not alter exposure or lighting.
The matched two-enemy frame now measures 242 calls, 248,172 rendered triangles,
and 67 textures, versus the original 239 / 328,776 / 76. Routes and collision
remain unchanged.
