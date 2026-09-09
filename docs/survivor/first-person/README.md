# First-person body repair

Promoted after staged img2threejs review in `/survivor-playground.html`. The candidate now imports the production modules; Before fix preserves the original body and weapon depth behavior.

The original first-person path hid the pelvis garments and shifted the capped thighs into view. Slide also lowered and scaled the same body twice. The repair restores connected waist/jacket geometry, fits the local upper garment behind the eye, offsets the body by 0.38 m standing / 0.26 m sliding, and grounds the articulated boots from joint transforms. Peer anatomy and animations retain their previous behavior.

Iteration evidence:
- `baseline/`: disconnected thigh caps, no waist or boots.
- `pass1/`: restored waist but upper chest blocked the camera and weapon.
- `pass2/`: bent upper garment back; waist still obscured standing boots.
- `pass3/`: fitted eye offset and stance; both boots visible, slide gun required depth separation.
- `accepted/`: all poses, four slide weapons, forward view, orbit views and mobile capture.
- `comparison.png`: visually reviewed baseline versus accepted standing view.
- `game/`: promoted arena screenshots and 16 pose/weapon checks with zero browser errors.

Weapon meshes reserve the nearest 1% of depth and restore the range after each draw. This preserves weapon self-occlusion and existing world depth. A framebuffer test confirms an opaque green wall continues to hide a red transparent effect after drawing the weapon (sample RGBA 0,102,0,255).

Verification: 23 engine/body/batching tests passed; survivor geometry/animation checks passed; production build passed. Body tests check finite vertices, connected visible garments, both lower-leg footprints in four poses, grounded stance within 1.5 cm, stable geometry/material identities, yaw following, and unchanged peer dimensions. Actual game checks cover four poses times four guns, keyboard movement, mobile capture and restored GL depth range. Switching: 12 switches, zero new programs, texture uploads or geometry buffer uploads, 11.1-45.9 ms measured CPU submissions. Shooting: 12 shots, zero new programs, 11.5-30.6 ms. These timings are local headless measurements, not a guaranteed frame-rate benchmark.

Visible local model cost is 10,784 triangles / 33 meshes, versus the incomplete baseline's 8,000 triangles / 16 meshes. Geometry is built once and reused across movement. Existing cloth and boot materials are retained.

Scope and review: accepted for first-person visibility, connection, grounding and weapon readability. It remains the existing approximate procedural survivor. This is not a new photorealistic face reconstruction or full seven-pass reference certification. The generic reference silhouette diagnostic returned IoU 0.420 against a headless, differently posed local proxy; it is recorded in `reference-diagnostics.json`, not represented as a passing likeness score. Runtime pose/raycast checks and actual arena captures are the relevant acceptance evidence. The five local articulated assemblies expose named parts, joint pivots, eye sockets, click selection and an exploded inspection view.
