# Build08 img2threejs weapon pass

This pass rebuilds the four first-person weapon silhouettes as procedural Three.js assets. The staged references are the generated concept sheets in `references/`: `breach-concept-v1.png` and `arc-concept-v1.png`, plus the existing `assets/concepts/reliquary-concept-v1.png`. Ossuary keeps its existing concept route and receives a volume/detail correction.

The reference images are treated as art direction, not as texture maps. Hidden sides, underside geometry, exact branding, and exact PBR values are inferred and are recorded as approximations. No external mesh is silently substituted for the authored factories.

## Pass contract

- `weapon-breach.js` — twin recessed bores, receiver shell, top rail, six-bone rib cage, vertebral lower rail, skull stock, trigger assembly, side plates, muzzle and inspect sockets.
- `weapon-arc.js` — caged reactor with glass shell, emissive core and plasma bead, brass/energy helix, rails, coil guards, skull stock emblem, bone claw emitter, muzzle and inspect sockets.
- `weapon-ossuary.js` — volumetric cranium and layered brow, cheek, nasal bridge, socket-rim, jaw, and side mounted rear death-mask correction.
- `weapon-reliquary.js` — layered cranium and facial planes, side mounted skull and compacted collar, asymmetrical muzzle claws, rib cage, reactor, vertebrae, cables and action sockets.

All four expose `root.userData.sculptRuntime` with named parts, collider metadata, `explode(amount)`, `pick(raycaster)`, materials, textures, and action sockets. The required sockets are `muzzle`, `projectileOrigin`, `muzzleFlash`, `recoil`, `heat`, and `inspect` where the weapon uses them.

## Evidence

The isolated factory contract check recorded finite bounds, bounded triangle counts, and action sockets for Breach and Arc. The actual hardware Chrome first-person captures are `weapon-game-0.png` through `weapon-game-3.png`; the reference/render comparison sheets are `breach-comparison.png` and `arc-comparison.png`.

The first FPS capture exposed a proximal skull mask that read as a toy face. The correction moved that ornament off the sight line and reduced its scale, opened the Arc receiver cage, and compacted the Reliquary muzzle/skull silhouette. These changes are recorded in `review.md` with the remaining limitations.

The procedural geometry is improved for this pass but is still an approximation of the generated concept art. The comparison sheets use a gameplay camera and lighting, so their global pixel similarity is advisory; the semantic checks focus on silhouette, visible part presence, readable action sockets, and 3D depth.
