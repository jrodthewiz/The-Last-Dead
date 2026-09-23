# The Last Dead — survivor rig v01

`The_Last_Dead_Survivor_Rig_v01.blend` is the editable Blender 2.93 authoring project created in the user's previously untitled window. It is independent of the Duals/JROD Blender study. The startup cube, camera and light are preserved in a hidden collection.

## Included

- Six skinned visibility regions: torso, left/right legs, left/right arms, head. Existing game survivor geometry and textures; this is a rigging pass, not a new character sculpt.
- 62 bones: 54 exported deformation/attachment bones and eight authoring controls. Three joints per finger, spine/chest, clavicles, hips, knees, ankles, toes, neck and head.
- Two-bone hand and foot IK with elbow/knee poles. `arms_IK` and `legs_IK` object properties blend between IK and FK.
- `camera_socket` on the root and `weapon_socket` at the right palm. Camera guides for overview, first person and looking down.
- Seven editable actions at 30 fps: `Idle_Ready`, `Walk_Forward`, `Sprint_Forward`, `Crouch_Idle`, `Jump`, `Slide`, `Recoil`.
- `exports/tld-survivor-rig.glb`: self-contained textures, skin and baked animation. Authoring IK controls are excluded. 32,852 triangles, 29 material primitives, about 18.9 MB.

## Working in Blender

Select `TLD_Survivor`, enter Pose Mode, and move the outlined `CTRL_hand.L/R` or `CTRL_foot.L/R` controls. Move the pole controls to direct elbows and knees. Rotate pelvis, spine, chest and fingers directly. Set IK properties to zero to pose limbs using FK.

Use the Action Editor to choose an action. Duplicate an action before editing a new motion. The current action contains baked per-frame control keys, so inserting a key is necessary to keep a pose change when moving the timeline. The rest pose is available from Armature Properties → Rest Position.

All meshes share one armature. Each vertex has normalized weights with at most two influences. Materials and UVs are retained; source height maps were converted into tangent-space normal maps. Geometry remains the original modular procedural artwork, with its existing silhouette, face approximation and garment seams.

## Game handoff

glTF coordinates are metres, Y-up, forward -Z, feet near y=0. Blender uses Z-up and forward +Y. Keep the exported skeleton scale at one. The stable first-person guide is 1.60 m high and 0.26 m ahead of the body's origin; the look-down camera is an inspection guide. Hide the `head` visibility region for the local player. Its `hide_in_first_person` custom property is exported as extras. Hide whole region groups, including all their material primitives.

Use an AnimationMixer for the seven named clips. Walk/sprint are in-place cycles; game simulation owns translation and jump height. `Jump`, `Slide` and `Recoil` are one-shots. `Slide` includes entry and exit rather than a permanent sliding stance. These are starter animations, and the open-hand ready pose is a framing/rig demonstration. Weapon-specific grip alignment, reloads, camera-pitch aim blending and locomotion blending still need game integration and tuning. This GLB has not replaced the live procedural player in `assets/survivor`.

The game's existing body-only 0.38 m offset and procedural joint animation must not simply be applied on top of this full skeleton. A separate adapter should own placement, head visibility and clip blending. Do not parent the authoritative movement camera to the animated head bone.

## Verification and reproduction

`validation.json` checks normalized skin weights and IK endpoints across every authored frame. Final endpoint error is below 0.1 mm across all seven actions. `threejs-validation.json` checks the actual GLB in the repository's Three.js loader at five samples per action: seven unique clips, finite skinned vertices, normalized skin weights and zero browser errors. `review/` includes Blender pose/camera renders and a Three.js export screenshot. This is asset validation, not an integrated game playtest or a mesh-quality certification.

Export the current saved blend in a separate background Blender process:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' -b 'C:/Users/wolfk/Desktop/thelastdead/art/survivor-rig/The_Last_Dead_Survivor_Rig_v01.blend' --python 'C:/Users/wolfk/Desktop/thelastdead/art/survivor-rig/export-review.py' -- --export-only
node art/survivor-rig/verify-export.mjs
```

Omit `--export-only` to regenerate the review renders. Verification uses local Playwright or `PLAYWRIGHT_PATH`; it serves file contents through isolated browser request routes and does not restart or alter the user's game tab/server. The exporter samples the evaluated IK skeleton into a separate constraint-free copy without modifying the authoring blend.

The guarded construction sequence is `initialize-project.py`, `build-rig.py`, `refine-first-person.py`, `finalize-rig.py`, then `fix-sockets-and-view.py`. Run only in a new, empty Blender project. Initialization refuses an existing saved file, and subsequent scripts require the exact Last Dead rig path. `extract-survivor.mjs` regenerates the intermediate mesh/texture source from this repository's original survivor factory.
