# Afterlife wheelchair loop 01

Reference: `references/wheelchair.png` (1254 x 1254 PNG, square, single object on a neutral background).

## Suitability

Pass for a stylized, low-poly real-time prop. The frame, wheels, seat, back, arms, and foot plates are all visible in a three-quarter view. The rear faces of the tubular frame and the underside of the seat are partially hidden, so the unseen welds and underside bracing are approximations rather than reference-exact reconstruction.

## Observation

The subject is an empty manual wheelchair. Its bounding footprint is bilateral across the axle, with a longer front-to-back dimension than width and a low seat over two large rear wheels. The visible macro assemblies are a tubular metal frame, two large spoked wheels, two small front casters, a dark oxblood seat sling, a matching suspended back sling, two arm pads, two push handles, cross braces, and two foot plates.

The large wheel planes are vertical and face laterally; each has a dark outer tire, a lighter worn inner rim, a central hub, and a sparse radial spoke set. The rear uprights rise behind the seat and bend backward into short push handles. The front frame drops from the arm supports toward the casters. The seat is a thin, slightly concave cloth shell with a dark edge seam. The back cloth hangs between the rear uprights with a shallow downward sag at the center. The foot plates are small rectangular metal slabs below the front legs.

The inferred game-scale envelope is 0.68 m wide, 1.05 m deep, and 1.10 m high. This is an approximation anchored to the parent map's metre convention; the reference contains no scale marker.

## Materials

The frame and wheel rims read as oxidized steel: mid-dark neutral albedo, metalness around 0.7, roughness around 0.55 with brighter worn edges and dark cavity grime. The tire is a near-black matte rubber with roughness around 0.85. The seat and back are cracked oxblood canvas or leather: low saturation dark red, roughness around 0.8, darker seams, and a few desaturated worn patches. The foot plates are pitted metal and should share the frame metal response. No source texture is projected; the runtime material remains a compact authored approximation.

## Detail inventory

1. `large-wheel-tire`: two continuous torus volumes; dark matte rubber; high confidence.
2. `large-wheel-rim`: two smaller torus volumes inside the tire; oxidized metal; high confidence.
3. `spoke-clusters`: two repeated radial spoke systems; thin metal; high confidence.
4. `wheel-hubs`: two short axle cylinders with cap; metal; high confidence.
5. `rear-uprights`: paired vertical tubes with curved handles; metal; high confidence.
6. `arm-pad-seams`: two thin oxblood pads with dark edge strips; fabric; medium confidence.
7. `seat-sling-sag`: one conforming cloth shell with a lower center; fabric; high confidence.
8. `back-sling-sag`: one vertical cloth shell with a lower center; fabric; high confidence.
9. `cross-braces`: two diagonal tubes below the seat; metal; medium confidence.
10. `caster-forks`: paired front supports; metal; high confidence.
11. `caster-wheels`: two small matte wheels; rubber; high confidence.
12. `foot-plates`: two pitted rectangular plates; metal; high confidence.
13. `fastener-caps`: small hubs and arm support collars; instanced or shared low-segment cylinders; medium confidence.

## Implementation contract

The factory is a deterministic, code-only approximation. It uses shared low-segment cylinders for tubes and spokes, two torus pairs for the wheels, two deformed grid shells for cloth, and compact box/cylinder plates. It targets fewer than 3,000 triangles, fewer than five material slots, no external runtime image load, and a named action-ready hierarchy. A future map pass may rotate or animate the empty chair; the prop itself has no per-frame animation.

## Review limits

The single reference does not prove the back-side tube routing, underside welds, or true cloth thickness. A three-quarter runtime view must preserve the wheel silhouette, visible spoke rhythm, seat/back sag, and grounded caster contacts. If the prop is read as a generic chair, refine the wheel-to-frame and oxblood cloth contrast before adding micro detail.
