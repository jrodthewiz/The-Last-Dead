# Reliquary image-to-3D evidence

## Reference and intake

- Source: assets/concepts/reliquary-concept-v1.png
- Source type: generated stylized weapon concept, single three-quarter view, full target visible.
- Probe: PNG 1536x1024, technical suitability pass.
- Admission: ADMITTED, pHash 17771985362191956194.
- Reconstruction route: generic object track, stylized procedural approximation.
- Generated prompt intent: a ribcage-and-bone rocket launcher with a skull rear receiver, vertebra brace, gunmetal barrel, toothed muzzle, brass clamps, cables, and a visible red ammunition core.

## Layered observation

The macro silhouette is a long first-person weapon with a broad rib-cage receiver and a narrower barrel terminating in a circular muzzle socket. The receiver, barrel, muzzle, grip, rear skull, and top spine are separate functional masses. The muzzle opening is a real socket target with an inner dark liner, not a painted circle.

The meso hierarchy is: receiver shell, rear skull, vertebra brace, core, barrel, muzzle socket, pressure vents, bone fins, grip, feed cables, recoil rails, clamps, and soot collar. Recoil rails and barrel/muzzle share stable transform groups. Cables are endpoint-rooted between receiver and barrel sockets. The muzzle exposes projectile origin and muzzle-flash sockets.

The material palette is separated into scorched gunmetal, dry ivory bone, tarnished brass, dark wrapped leather, soot, and a hot red emissive core. Gunmetal uses a satin roughness response with machined bump. Bone uses matte pore variation and chipped edge relief. Brass uses lower roughness and metallic response. Soot remains matte and localized around the muzzle/vents. The concept’s highlights are treated as lighting evidence rather than baked albedo.

Identity features mapped into the spec include receiver rib bevels/grooves, rear skull sockets, vertebrae, barrel scuffs, muzzle socket and teeth, core emission/gloss, pressure vents, brass clamp fasteners, chipped fins, grip wraps, cable grooves, soot, and recoil rail bevels.

## Limits and decision

The image does not expose the firing pin, chamber interior, exact cable routing, or grip underside. Those are explicit stylized assumptions. The runtime contract still exposes recoil, heat, muzzle, projectile, inspect, and explosion sockets, so gameplay can evolve without rebuilding the model.

Quality decision: continue into code after the strict spec gate. Review should include neutral three-quarter, grazing metal/bone, first-person gameplay, and exploded component views. The image is style and structure evidence; generated procedural geometry remains the implementation authority.
