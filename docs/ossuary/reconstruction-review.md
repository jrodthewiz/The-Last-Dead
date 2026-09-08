# Ossuary reconstruction record

Built-in image generation produced reference.png for this project. The img2threejs workflow was used for intake, local spec search, detailed component/material specification, a blockout and multi-angle inspection. This is a stylized procedural interpretation, not an extracted mesh or exact image match.

Observed identity: elongated hexagonal barrel, six red chambers, bone cage, vertebral top rail, curved horn, skull muzzle with sockets/fangs, wrapped grip. Hidden reverse surfaces were inferred. A rear death mask was added deliberately to make the theme readable in first person.

Evidence: blockout-three-quarter.png, structure-three-quarter.png, final-three-quarter.png, final-front.png, final-right.png, final-rear.png, final-left.png, game-idle.png and game-hit.png.

The authored sculpt specification passed strict schema/quality validation. The original reference was admitted by the intake tool (1402x1122; dominant connected subject). The screenshot pixel-matching diagnostic did NOT pass: IoU .256, aspect delta .309, scale delta .541. Its segmentation treated nearly the whole dark render as foreground, so the multi-angle non-collapse result is not useful evidence of fidelity. No full sequential img2threejs certification or exact reference fidelity is claimed. Visual inspection instead identified the pale smooth horn and glossy bone; these were corrected with a narrower dark ridged horn, more matte bone, proper RGBA roughness-channel packing and independent bump data.

Runtime hierarchy retains named semantic parts, rotating chamber and muzzle socket; fixed surfaces are merged within part/material. Picking and explode hooks are exposed in sculptRuntime for review tooling. The game uses authoritative ray hits and bounded effects, not the visual meshes as damage colliders.
