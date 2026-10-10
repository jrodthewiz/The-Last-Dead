# First-person arms V5

The active first-person asset is `assets/survivor/fps-arms-v5.glb`. This rebuild
authors new glove/sleeve geometry, a new skeleton, new weights and new Actions
in headless Blender 2.93. The earlier arm meshes and animations are preserved.
Only measured weapon grip frames and hardware dimensions inform the new forms.

Fifteen arms cover all eight weapons. Each hand has three joints per digit,
an anatomical flexion axis, blended joint weights and a continuous thumb web.
The sleeves use continuous quad panels and a separate elbow cloth pivot to
retain volume during runtime grip correction. Glove panel stitches are surface
geometry. Embedded PBR maps add leather grain, fabric weave and roughness.

Thirty-two named Actions cover idle, walk, draw, and fire or strike. Draw opens
and seats the fingers; the firing hand flexes its trigger finger while the
support hand braces. Bat/saw grips load earlier in the strike. Runtime transitions
blend the authored local poses before grip seating. Absolute track sampling
avoids stale mixer caches; solved IK poses never become the next bind pose.
The existing weapon assembly motion still owns aim, equip movement and recoil.

## Editable source and rebuild

Master: `.art-source/fps-arms-v5/The_Last_Dead_FPS_Arms_v5.blend`.
Eight separate collections contain rigs and excluded weapon reference meshes.
The Breach collection opens with its idle Action on the timeline. Bone groups
distinguish arm, finger and cloth controls. Local X bends the fingers.

PowerShell, from this repository:

```powershell
# Rebuild everything from original definitions. This replaces V5 artist edits.
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --factory-startup --python scripts/rebuild-fps-arms-v5.py
# Add reference assemblies, editing organization and embedded PBR surfaces.
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --factory-startup --python scripts/export-fps-arms-v5.py -- --prepare
node scripts/optimize-fps-glb.mjs assets/survivor/fps-arms-v5.glb
```

To export saved artist edits without rebuilding, run only the export script
without `--prepare`, followed by the optimizer. The optimizer removes bind-only
tracks and retains embedded images. Runtime builds do not require Blender.

The continuity repair is reproducible with `scripts/repair-fps-arms-v5.py --
--weapons all` through Blender's `--python` option. It replaces glove/sleeve
surfaces, updates thumb/index bind frames and protects palm skin ownership.
Existing Actions are compared before deliberate, idempotent corrections:
thumb draw release reverses at half amplitude, index draw release decreases,
and firearm pulls concentrate in distal index joints. The index follows the
outside upper grip edge; this does not establish trigger-pad contact.
The rejected master/export are preserved beside the editable master.

## Review and verification

Open `/fps-arms-review.html` on the local game server for an isolated workshop
with weapon, clip, playback, time scrubbing and clay controls. This page renders
the actual exported skin through the production grip solver; its neutral studio
lighting is separate from native game lighting.
Close-up diagnostics temporarily hide hardware to reveal glove anatomy.

`tests/fps-arms-v3.test.mjs` now verifies the active V5 export, including hardware
contact, adult proportions, wrist cones, sleeve cap exclusion, repeatability,
elbow volume, aim and melee transforms, and gait transitions. The neighboring
hand-grip and viewmodel-motion tests cover unaffected interaction/body systems.
The structural shell check welds export seam duplicates and rejects detached
anatomical components. `scripts/audit-fps-contact.mjs` samples signed distances
against the actual fitted handle volumes and reports whether they are closed.
`FP_CONTACT_DENSE=1` checks every vertex, including the Hand-owned palm;
digit-only sparse measurements cannot rule out clipping. Planar open handle
ends are capped for inside/outside classification only.

Native glove/canvas material roles are explicit, preserving the Blender
vertex-color palette and embedded normal/roughness maps through weapon styling.

`tests/fps-arms-workshop.mjs` captures every weapon plus action and close-up
views. `FP_WORKSHOP_VIDEO=1` also records a continuous studio playback video.
`tests/fps-arms-browser.mjs` captures the native game on a separate ephemeral
server/browser, exercising all weapon selections, representative full attacks,
and look-down body poses. Scoped startup omits unused interior/enemy warmups;
it does not certify whole-world startup performance or mobile performance.
`FP_CAPTURE_CONTINUOUS=1` adds uninterrupted wall-clock production rendering
of idle, gait, attack and recovery for representative shotgun/bat/saw grips.
Use `FP_CAPTURE_VIDEO=1` to retain that footage. The run records frame timing;
it does not assume a stable frame rate.

Rendered evidence lives under `output/playwright/fps-arms-v5-workshop/` and
`output/playwright/fps-arms-v5-game/`. Technical checks establish rig correctness;
the player's judgment of animation quality remains the visual acceptance gate.
