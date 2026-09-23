# Afterlife mourning cabinet loop 02

Reference: `references/mourning-cabinet.png` (1254 x 1254 PNG, square, single object on a neutral background).

## Suitability

Pass for a stylized, low-poly real-time prop. The narrow case, twin doors, frosted upper panels, lower recessed wood panels, pulls, top cap, and plinth are clearly visible in a three-quarter view. The hidden rear joinery, interior shelves, and exact hinge construction are not observable and remain explicit approximations.

## Observation

The subject is a tall narrow two-door cabinet with a shallow rectangular depth. Its approximate game-scale envelope is 0.72 m wide, 0.32 m deep, and 2.05 m tall. The case is a dark wooden carcass with a thin top cap and a thin raised plinth. Two framed doors occupy the front face and meet at a narrow vertical dark seam. Each door has a tall frosted dark upper panel and a lower recessed wood panel. A pair of short tarnished brass pulls sits around mid-height. A small rectangular maker plaque sits below the top cap.

The dominant silhouette is a simple upright cuboid with a small top overhang and a slight side reveal. The identity comes from the split door seam, repeated inset frames, frosted upper panels, warm hardware, and worn edge highlights rather than from complex curvature.

## Materials

The carcass and lower door panels read as blackened brown wood: dielectric, high roughness around 0.78 with lower roughness on rubbed edges, dark cavity seams, and sparse vertical grain implied by the material response. The upper panels are opaque frosted glass or dirty translucent board in the reference; the lightweight runtime uses a muted pale dielectric panel so it remains readable without a transmission pass. The pulls, hinges, top cap, plaque, and plinth edge use tarnished brass/iron: metalness around 0.7, roughness around 0.5, with desaturated warm albedo. The meeting seam and door recess use near-black matte material.

## Detail inventory

1. `twin-door-split`: narrow real center gap; geometry; high confidence.
2. `upper-frosted-panels`: two tall translucent-looking panels; muted opaque approximation; high confidence.
3. `lower-recessed-panels`: two wood panels below the horizontal rail; geometry; high confidence.
4. `door-stiles`: paired outer and center vertical rails; geometry; high confidence.
5. `pull-pair`: two short horizontal tarnished pulls with caps; repeated hardware; high confidence.
6. `top-plaque`: small rectangular maker plate; geometry; medium confidence.
7. `top-cap`: shallow overhanging lid; assembled solid; high confidence.
8. `thin-plinth`: low raised base with shadow step; assembled solid; high confidence.
9. `side-hinges`: two vertical hinge bars; tubular relief; medium confidence.
10. `cavity-seams`: dark recessed door field around the panels; material/geometry; high confidence.

## Implementation contract

The factory is a deterministic, code-only approximation. It uses a small box assembly with shared low-segment tube hardware and no runtime image load. It targets fewer than 3,000 triangles, fewer than five material slots, a depth close to 0.32 m, and a named hinge/socket hierarchy so a future map event can open or rattle the doors without rebuilding the prop.

## Review limits

The reference does not reveal the rear or inside, so no interior contents are claimed. The frosted upper panels are represented as opaque, low-cost surfaces; if a later close-up needs visible transmission, the panel can be swapped to the project's existing glass material without changing the silhouette or placement contract.
