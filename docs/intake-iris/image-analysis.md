# Intake Containment Iris — image analysis

Reference: `docs/build10/build10-game-desktop.png` (1280×800 in-situ gameplay capture).

## Suitability

Conditional: the target is clearly visible and front-facing in the center-left of the frame, but
it is embedded in a lit room and partially occluded by the weapon, bloom, and HUD. The image is
evidence for macro silhouette, placement, and palette; it is not a clean source for exact surface
colour or hidden-side geometry. The reconstruction is intentionally an authored, game-ready
industrial prop rather than an exact mesh extraction.

## Observation (bottom-up)

- **Identification:** a wall-mounted circular mechanical lock / containment iris attached to the
  intake pressure door. `primaryDomain=object`, confidence 0.93. The small white crosshair is a
  separate gameplay reticle.
- **Silhouette:** radial, near-bilateral assembly inside a rectangular pressure-door frame. The
  visible footprint is approximately 2.2–2.5 m across at a 5 m wall height. The depth is hidden by
  frontal framing, so the replacement uses a recessed cylindrical housing and proud front plates.
- **Macro:** pressure-door shutter and frame (context), circular lock housing, central aperture,
  perimeter hardware.
- **Meso:** stepped annular bezel, recessed dark cavity, eight radial iris petals, radial support
  struts, status spine, perimeter fasteners, and a central spindle/lens.
- **Micro:** alternating metal/hazard segments, bevel highlights, dark cavity occlusion, warm red
  emissive seam, and small mechanical bolt heads. Bloom obscures exact roughness and any lettering.
- **Spatial relationships:** the housing is attached-to the door face with an overlap/proud mount;
  the bezel is flush-with the housing front; the petals are embedded-in the inner aperture; the
  spindle is centered inside the cavity; fasteners are socketed around the bezel; lamps sit above
  the door and remain separate from the prop mesh.
- **Materials:** frame is dark painted metal (high roughness, low-to-mid metalness); bezel is worn
  steel with a satin response; hazard accents are orange painted metal; signal elements are
  emissive red/amber; cavity is matte near-black; lens is transparent/low-roughness physical glass
  over a dark inner volume. Values are inferred from the capture and existing material library.
- **Identity features:** concentric stepped construction, eight articulated iris petals, a narrow
  vertical status spine, and a hot red central lens. These are the features the previous torus +
  sphere marker failed to communicate.
- **Uncertainty:** rear mount, actuator linkage, seal material, and exact door depth are occluded or
  undetermined. They are represented as plausible industrial substructure and marked as authored
  approximation, not reference truth.

## Quality contract

The prop must read as a fabricated 3D containment lock from front and three-quarter views, with no
single flat billboard or lone torus carrying the identity. It must expose named macro/meso parts,
retain the existing setpiece position and objective semantics, use independent PBR material roles,
and stay within a small real-time budget (under roughly 20k triangles for the lock assembly).

