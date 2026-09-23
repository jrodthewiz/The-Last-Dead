# Prop quality loop

Date: 2026-09-23

The first combined capture ([props-front.png](props-front.png), [props-side.png](props-side.png), [props-back.png](props-back.png)) exposed one visual defect in the lightweight factories: the wheelchair's silhouette was legible, but the dark preview hid most of its rusted metal and oxblood cloth; the cabinet defaulted to its rear face, its upper panel was too short, and its pulls read as horizontal rails.

The bounded code revision changed only the cabinet factory and the standalone preview light/camera contract:

- The preview turns the cabinet `Math.PI + 0.08` so its front faces the fixed camera.
- Preview hemisphere/key lighting is neutral and brighter (`1.85` hemisphere, `4.0` directional key, desaturated rim) so geometry can be judged before the final afterlife light.
- Upper panels grow from `0.47 m` to `0.90 m` and are split into two leaves.
- Lower wood panels shorten to `0.70 m`, with a real center seam, door stiles, and horizontal frame rails.
- The frame, cap, plinth, and door rails use the dark wood material. Pulls are short vertical cylinders with separate caps.
- Frosted panels use a dark dirty-gray panel response (`0x53595a` fallback) instead of pale bone.

The factories remain within the lightweight contract after the revision: the wheelchair is 2,004 triangles and 5 owned fallback material slots; the cabinet is 352 triangles and 4 owned fallback material slots. `tests/afterlife-props.test.mjs` passes all four structural checks, including finite geometry, metre-scale bounds, twin-door cues, orbit volume, sockets, colliders, and disposal.

This loop is intentionally a single bounded revision. The remaining limitation is material richness at very close range: the props use compact authored PBR scalars and low-segment geometry rather than projected or scanned textures. They are intended to read in a cold local pool inside the game, where the afterlife surface pass can supply the shared dampness language.
