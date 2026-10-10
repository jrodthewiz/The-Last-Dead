# Meshy variant rig preparation

`scripts/prepare-zombie-variant.py` is an offline Blender/mathutils GLB authoring tool. It performs no API work and never overwrites a provider source. Keep paid raw outputs in `.art-source/zombie-variants-meshy/{id}/rig.glb`.

```powershell
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --python scripts/prepare-zombie-variant.py -- --input .art-source/zombie-variants-meshy/fever-runner/rig.glb --output assets/models/zombie-variants/fever-runner.glb --report docs/zombie-variants/fever-runner-rig.json
```

The input contract is one self-contained, uncompressed humanoid GLB skin, four influences per vertex, and separate shoulder/upper-arm/forearm/hand and thigh/calf/foot chains on both sides. Three spine joints, hips, neck and head are required. Meshy and Mixamo-style names are mapped to the canonical game names using the actual spine hierarchy. Unsupported, branching or degenerate chains fail authoring before a runtime file is saved.

The tool preserves the target mesh positions, normals, UVs, triangles, materials, textures and original inverse binds. A normalization wrapper places the bind mesh on the floor at 1.86 metres and aligns the shoulder axis. Canonical world rotation deltas are mapped to the new bind basis. Arm and leg bind direction alignment handles neutral arms-down rigs. Two-bone IK fits the canonical hand/foot trajectories using the new limb lengths. Local translations and scales stay constant on every joint except Hips; source bone translations are never copied onto a differently proportioned rig.

All ten named v07 actions retain their source durations and extras. AttackLunge includes an explicit 0.375-second contact sample. Locomotion receives a constant skin-derived floor correction. Run additionally adapts vertical pelvis support to the actual soles during its 0.42 support duty, smoothly releasing that correction in each flight interval. This prevents calf/ankle blend weights from leaving a different provider foot shape floating in mid-stance. Collapse uses skin-derived support through the fall. Weighted Jaw/LeftGrip/RightGrip controls and six anatomical sockets are added when absent. The new lower-face control preserves the provider's closed-face topology; it does not add an oral cavity, teeth or a tongue.

Per-variant receipts include source/output hashes, normalization, weighted control counts, original PBR preservation, triangle count, complete skinned bounds, ground corrections and IK reach residuals. These receipts describe the uncompressed authored asset. The final packing stage may compress textures and prune unused provider buffers; its own receipt must identify the final bytes and hash.

`tests/zombie-variant-assets.test.mjs` imports real GLBs into the game runtime and verifies the ten clips, chains and sockets, independent geometry, stable limb lengths, full-skin bounds, actual jaw/grip deformation, running flight, exact attack time, and crawler rise/recovery floor clearance. A successful bake alone is not a visual or runtime acceptance result.

Reference ledger: `threejs-3d-generator/references/threejs-integration.md` and `threejs-procedural-animation/references/procedural-motion-and-docking-systems.md` were read. The user chose Meshy, so Tripo provider instructions do not apply to account generation.
