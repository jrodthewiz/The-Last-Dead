# FPS arms V5 repair verification — October 9, 2026

Export SHA-256: `e438e0709c12c84cda58bc622b5a50e24d8588d19e760798916be7276402a7a3`.
Editable source: `.art-source/fps-arms-v5/The_Last_Dead_FPS_Arms_v5.blend`.
Original rejected evidence remains in `fps-arms-v5-vision-review.md`; it does
not describe the repaired export.

## Repair

All eight weapon rigs / 15 hands now use continuous glove shells, buried
finger roots, rounded joints, a cupped palm and an integrated thumb web.
Proximal finger caps extend into the palm toward the wrist, eliminating the
backward index stub. Palm ownership in skin weights prevents joint motion
from splitting the metacarpal web. The index routes over the firearm grip edge
and firing concentrates in its distal joints. Draw releases clear the handles.
Sleeve lofts carry compression folds and seam panels; embedded normal and
roughness maps survive export optimization. Explicit native glove/canvas
material roles preserve their authored vertex colors instead of multiplying
them by generic weapon dark tints.

The independent vision reviewer found two decorative Reliquary screws in the
palm. Their rear underside positions occupied the grip mount. Removing those
two fasteners leaves the other chamber details intact and removes that collision.

## Evidence

- `output/fps-arms-v5-final-tests.txt`: 29 passing rig, hand-grip and neighboring
  Blender motion tests, including actual mesh deformation and repeated playback.
- `output/playwright/fps-arms-v5-final-angles/report.json`: 645 captures covering
  all 15 hands, six anatomical directions, material/clay/full hardware,
  opaque handle obliques, draw/fire/strike samples and exposed wrist termination.
  There are 126 labeled review sheets. Transparent views are diagnostic only.
- `output/playwright/fps-arms-v5-final-native/report.json`: eight native WebGPU
  holds, 21 representative attack checkpoints, standing/walking/slide body views
  and uninterrupted four-second shotgun, bat and chainsaw sequences.
- Native temporal review retains 152 frames at 8 Hz and 150 bat-window frames
  at the video's 25 Hz. These are sampled video evidence. Video and page clocks
  were not calibrated; the selected windows include the sequences and boundaries.
- `output/playwright/fps-arms-v5-final-reliquary-hardware/report.json`: 40 fresh
  workshop views after the two-screw correction; this replaces Reliquary hardware
  views from the 645-capture set. Other arm geometry is unchanged.
- `output/playwright/fps-arms-v5-final-reliquary-native/report.json`: fresh
  native hold after the screw correction.
- `output/fps-arms-v5-contact-final-dense.json`: all exported glove vertices,
  including Hand-owned palm vertices, against actual fitted grip volumes.
  Largest measured concealed overlap is 3.36 mm during the bat strike. This is
  not a collision-free certificate. Original large index penetrations exceeded
  20 mm. Closed meshes use ray parity; planar open handle ends receive temporary
  volume caps only, while physical distances use original triangles.
- `output/fps-arms-v5-reliquary-fastener-fixed-audit.json`: zero intrusion against
  the nearby closed merged micro-detail surfaces after the screw correction.
  The right whole glove is 95.07 mm from remaining nearby decorative surfaces.

Continuous telemetry recorded 102 / 119 / 125 rendered frames, maximum frame
intervals of 50.2 / 50.1 / 50.6 ms, and wrist-socket gaps below 0.000000064 m.
Bat world-joint rotation reaches 0.81 radians over 33.3 ms in the fast stroke;
this metric by itself cannot distinguish intended swing speed from an IK pop.
Startup was scoped to visible production rendering on a separate ephemeral
server/browser. Whole-world performance, mobile behavior and locked 60 FPS
were not certified. The user's existing game tab and server were preserved.

## Independent visual verdict

Final mechanical repair gate: **PASS**, by the independent
`character_presentation_owner` vision agent. It inspected all 15 six-angle
material/clay/full-hardware sheets, all 15 opaque handle sheets, 15 exposed
wrist images, 72 representative studio action samples, all eight native holds,
three body views and 21 native attack checkpoints. The corrected Reliquary
supplement covered 12 fresh opaque hardware views and its native hold.
It also inspected all 150 bat video samples at 25 Hz, enlarged adjacent frames
67–73 and all 152 general motion samples at 8 Hz. The fast bat stroke moved
weapon and arms together with retained visible grip; no independent hand jump
or disconnected digit was confirmed. Several buried contact views remain
occluded, so visual review does not certify those surfaces.

The representative Breach repair passed its gate: the handle-face oval, detached roots, backward stub and thumb
flap were absent; native glove readability improved. Trigger-tip seating was
partly hidden by hardware and remains unverified. Palms and finger shafts are
still comparatively simple, and forearms broadly formed. Technical correctness
and correction of visible defects do not establish professional craft quality.


## Requested all-angle recheck

The independent vision agent rechecked all 15 hands across eight weapons from
dorsal, palmar, radial, ulnar, distal and proximal directions in material, clay
and opaque hardware modes: 270 anatomical views. It also rechecked 15 opaque
handle-oblique sets, 15 exposed wrist terminations, 72 representative action
samples and eight saved gameplay holds. Corrected Reliquary views replace the
earlier screw-intersection views. The current source and built GLB still match
the reviewed export SHA above. Camera metadata confirms six distinct directions
per hand and exactly opposing pairs within 4.44e-16 dot-product error.

Visible geometry repair: **PASS**. No returning detached roots, external thumb
flap, backward index stub or exposed grip breakthrough was found. Professional
artistic quality remains unconfirmed; broad plain palms, tubular digits and
broad smooth sleeve folds remain concerns. Hidden trigger seating and buried
contact remain unverified.

A fresh provenance check found that renderer.js differs from the renderer hash
recorded in the saved native captures. The arms, grip, hold-pose and material
code still match. The live workshop was unreachable and its browser inspection
was policy-blocked; latest whole-game appearance was not verified. This recheck
confirms the current exported arm geometry in retained renders and does not
certify the latest whole-game renderer. Machine-readable coverage and limits:
`output/fps-arms-all-angle-confirmation.json`.
