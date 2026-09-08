# Breach image analysis and quality contract

## Intake

Reference: `references/breach-concept-v1.png`.

Suitability is conditional but admitted: the concept is a clean, isolated three-quarter product render with a readable object silhouette and visible receiver, barrel, stock, grip and muzzle. The rear underside and opposite side are hidden, so those regions are authored as stylized inference rather than claimed exact reconstruction.

## Observation

The macro silhouette is a long twin-barrel weapon with a compact receiver, a raised rail, a bone rib cage wrapped around the barrel jacket, a vertebral lower rail, a side trigger guard and a skull/bone butt ornament. The muzzle identity comes from two deep black bores, bright copper collars and the broken bone claws around the front ring.

The meso systems are: paired barrel shells and bores; six repeated ribs per side; a segmented vertebral brace; a bevelled receiver with side plates and rivets; a leather grip with repeated wraps; and a rear skull with two cavities, cheek arches, jaw and teeth. Micro details are mapped to collars, rivets, joint spheres, grip wraps, wear maps and emissive muzzle rings.

Materials are inferred as worn gunmetal (high metalness, medium roughness), oxidized brass (high metalness, lower roughness), aged porous bone (zero metalness, high roughness with bump), dark leather (low metalness, high roughness), soot cavities, and hot orange muzzle emission.

## Quality contract

The factory must hold a readable long-gun silhouette from front and three-quarter views; keep the twin bores distinct; keep every rib attached to the barrel jacket; preserve a non-planar skull with concave eye sockets; and provide named muzzle, projectile, recoil, heat, inspect and explosion-ready part anchors. It is a real-time stylized reconstruction, not a photogrammetric copy.

## Iteration note

The first gameplay camera made the skull stock too frontal and mask-like. Pass 2 moved the stock to `(-0.12, 0.055, 0.31)`, scaled the group to `0.62`, and rotated it around Y by `-0.34` so the mechanical rails remain the primary sight-line read. This is a code correction driven by the actual FPS screenshot, not a reference pixel score.
