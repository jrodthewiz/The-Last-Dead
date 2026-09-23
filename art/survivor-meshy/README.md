# The Last Dead survivor v02

New character generated from the approved front/back references with the existing Duals Meshy workflow, then prepared in Blender 2.93. The original procedural survivor remains in `../survivor-rig`.

## Deliverables

- `TLD_Survivor_Meshy_v02_GameRig.blend`: editable character, packed textures, full-body skeleton, optional arm/leg IK handles, eye/hand sockets, studio and first-person review cameras.
- `exports/tld-survivor-v02.glb`: portable character with two skinned meshes and three animation clips.
- `TLD_Survivor_Meshy_v02.blend`: preserved imported Meshy bind pose.
- `tld-survivor-v02/rigged.glb`: untouched Meshy rig result. `model.glb` is the unrigged source.
- `basic-animations/`: original included walking/running downloads. No additional paid animation requests.
- `review/`: Blender renders and a render of the actual exported GLB in the repository's Three.js.

## Blender use

The file opens with `Idle_Relaxed` active. Press Space over the viewport to play its subtle breathing. Select `TLD_Meshy_Survivor`, open the Dope Sheet's Action Editor, and select `Walk_Forward` or `Run_Forward` for locomotion. Set the timeline end to 32 for walking or 20 for running. The muted NLA tracks preserve export clips; keep them muted during normal Action Editor work.

FK uses the existing 24 Meshy bones. The lower spine is named `Spine02`, followed by `Spine01`, then upper chest `Spine`; this is the provider's order, not a naming error. Fingers and face have no independent joints.

For IK, show viewport Extras, expand `ANIMATOR_CONTROLS`, and set the armature Object Custom Property `Arm_IK` or `Leg_IK` to 1. Move/rotate the corresponding `CTRL_LeftHand`, `CTRL_RightHand`, `CTRL_LeftFoot`, or `CTRL_RightFoot`. Pole controls guide elbows/knees. Both blends default to 0 for the FK animation clips. Clear or duplicate the active action before authoring a new pose. Bake evaluated pose animation before game export; Blender constraints are not runtime IK.

## First-person integration

Bind-pose height is 1.78 m. Blender faces +Y; glTF faces -Z with +Y up. Keep the exported parent hierarchy and its existing scale intact. Add an outer game actor transform for locomotion.

Hide `TLD_Head_Hide_For_Local_Player` for the local player's camera while keeping `TLD_Body_Arms_Torso_Legs` visible. Keep the head for remote players. Use camera layers or a separate shadow pass if the local player needs a head shadow.

`SOCKET_FirstPerson_Eye` is a stable reference at 1.66 m. `VIEW_FirstPerson_LookDown` demonstrates a 16 cm forward camera offset at steep downward pitch to avoid the jacket obscuring the feet. Blend that offset with pitch and apply game collision checks. Do not parent gameplay look directly to animated Head rotation.

`SOCKET_LeftHand` and `SOCKET_RightHand` follow the wrists. Weapon-specific grip offsets, aiming, recoil and reload clips still need to be authored. The generated hand topology and lack of finger joints make this a full-body foundation, not a finished close-up weapon-hand rig. There is no facial animation or LOD chain yet. The GLB is about 35 MB; texture compression and LOD work are appropriate before shipping.

The character is now integrated into the game through `assets/survivor/meshy-survivor.js` and `survivor-runtime.js`. Runtime asset: `assets/survivor/tld-survivor-v02.glb` (about 9.5 MB, 2K JPEG albedo, non-emissive clothing). All four existing weapons use the new textured sleeves/forearms with the existing fitted gripping hands. The local head/body arms are hidden to prevent duplicates; the peer retains the full body. Idle/walk/run blend with movement, and the game adds jump/slide poses without changing the simulation or hit detection.

The game waits for the model during its existing preparation step. A failed model load retains the previous procedural survivor and weapon arms. Renderer diagnostics expose `survivor.status`, source and sleeve count. Browser playtest and screenshots are in `docs/survivor/meshy-in-game/`; run `node tests/meshy-survivor-game.mjs` from the repository root to repeat them. `export-runtime.py` rebuilds the compact runtime asset from the Blender master.

## Verification and provenance

62,250 triangles, 24 joints, two skinned primitives, one shared textured material. Source skin has at most four influences per vertex and no non-normalized weight sums. The GLB verification samples every skinned vertex at five times in each clip and checks finite deformation, expected clips, weight sums and browser errors. See `inspection.json`, `rig-validation.json`, and `threejs-validation.json`.

Rebuild locally: run Blender in background with `import-inspect.py`, then `finish-rig.py`. Validate using `node art/survivor-meshy/verify-export.mjs` from the repository root. The scripts assert background execution and cannot reset an open UI scene.

Source task: `01a09510-2f99-76ca-8cf0-71efa0184c45` (30 credits). Rig task: `01a09513-bd80-77e7-b91a-d90df084f03e` (5 credits). Both succeeded on 2026-09-12. Account balance changed from 3,189 to 3,154. Exact task snapshots and hashes are preserved in `tld-survivor-v02/`; signed URLs and credentials are excluded.
