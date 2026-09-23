# Bloodworks Warden

The Bloodworks Warden is the rigged Meshy character derived from the main-menu reference at `source/menu-warden-reference.png`.

## Handoff files

- `tld-bloodworks-warden-mainmenu/rigged.glb` — untouched Meshy rig output.
- `TLD_Bloodworks_Warden_Animation_Source.blend` — cleaned Blender source. The duplicate visible import is hidden so the file opens with one character.
- `../../assets/models/bloodworks-warden.glb` — game runtime asset.

## Animation contract

The Blender source keeps these named clips on the Meshy rig:

- `TLD_TPose` — reusable horizontal T-pose marker for inspection and future retargeting.
- `TLD_Idle` — authored idle loop.
- `TLD_Walk` — authored locomotion loop.

The game selects `TLD_Idle` and `TLD_Walk` by name, blending them from enemy movement. Attack windup, hit flash, and death fall remain runtime overlays so all size variants reuse the same rig and clips.

## Enemy variants

The campaign uses one runtime asset for three profiles:

- `warden` — base size.
- `wardenBulwark` — 1.28x visual scale, heavier combat profile.
- `wardenColossus` — 1.55x visual scale, boss scale and damage profile.

Proof renders for the source are in `tld-bloodworks-warden-mainmenu/` (`blender-tpose-final.png`, `blender-idle-final.png`, and `blender-walk-final.png`).
