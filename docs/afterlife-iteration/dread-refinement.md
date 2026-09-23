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
  with a wandering spine, alternating tube ribs, small attachment collars, and
  a single open mortuary niche. The niche signal is a recessed cross-slot
  instead of four floating beads.
- `world-setdressing.js` replaces the campaign skull mound's 33 skulls with
  nine irregular load fragments and four exposed remains, retaining the
  ossuary landmark cue and candle edge.

## Measured geometry budget

Counts below are geometry triangles per shared source mesh; instance totals are
shown where the factory repeats the mesh. They were measured from the
pre-change source and the current factories with the same deterministic seed.

| Surface | Before | After | Change |
| --- | ---: | ---: | ---: |
| Story tunnel rib | 384 / rib | 236 / rib | -148, 38.5% lower |
| F3 colonnade | 1,712 / instance × 7 | 852 / instance × 7 | -6,020 total |
| F3 skull niche | 516 / instance × 10 | 268 / instance × 10 | -2,480 total |
| F3 niche signal | 192 / instance × 10 | 24 / instance × 10 | -1,680 total |
| Campaign skull mound | 8,430 total | 2,006 total | -6,424, 76.2% lower |

The affected geometry is merged by its existing material roles. No new draw
class, texture, light, or collision surface was introduced. Parent-owned blood
surface treatment remains the only blood atlas path.

## Review framing

For the screenshot judge, use a 16:9 Catacombs entry view at standing eye
height. Keep the first tunnel centered enough to show the clear lane, with the
left wall occupying roughly the left third so the rib buttress and one open
wall niche are readable in silhouette. Keep the lamp exposure below clipping;
the goal is to judge the faceted load band, recessed wall depth, and the dark
negative space behind the arch. A secondary campaign Ossuary frame should show
one rubble mound at the edge of the route rather than aiming directly at the
prop.

Validation is covered by `tests/dread-refinement.test.mjs`, `tests/dungeon-art.test.mjs`,
and `tests/world-setdressing.test.mjs`. Browser capture remains parent-owned.
