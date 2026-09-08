# Build 03 — The Warden

## Visible changes
- Original generated medical-foundry menu artwork, cleaner title layout, expandable co-op forms, visible revision/settings and responsive HUD.
- Overhead structural ribs, suspended organic machinery, warning signage, equipment vents and floor wear; revised lighting keeps movement lanes visible.
- Authored gunmetal PBR maps reused from the user's Dogfight project. Local footsteps and low-health heartbeat.
- One original Meshy warden replaces melee enemies, with skeletal walking and local attack/hit/death reactions. Existing procedural enemies remain for ranged/heavy classes and loading fallback.

## Character pipeline
One resulting NPC was authorized and generated. Preview 01a07f7f-de0d-7713-9b22-c39338af661c; texture refine 01a07f80-baa4-7513-bc38-7b64de870f4d; final rig 01a07f8d-631f-71c8-802a-a71bd7ab11d6. Initial local import failure and overlength-prompt rejection produced no task; a read-only task list verified that before resubmission. Rigging the raw >300,000-face model was rejected; the same asset was reduced locally and then rigged successfully. No alternate NPC generations or paid animation packs were purchased.

Blender 2.93 was launched in a separate background process. An existing meshoptimizer/glTF-Transform workflow completed the reduction faster, so its output was selected and only the task-owned Blender process was stopped. Raw source had 1,918,070 faces; local reduction produced 29,998. Final rigged GLB renders 29,936 character triangles and is 9,086,176 bytes. Texture maximum edge is 2048. The walking clip was included in the rig result. Source and optimization records are retained outside the runtime assets in .art-source/warden.

Meshy produced a horned bone-mask demon with claws and torn clothing; it is an original stylized interpretation, not an exact surgical-uniform reconstruction. The requested exposed cardiac core was not reproduced. The animation normalization was corrected after a real screenshot exposed unit-scale drift; an automated posed-height check now guards that defect. Material metallic defaults were corrected for skin/cloth readability.

Provider workflow references: [Meshy text-to-3D](https://docs.meshy.ai/en/api/text-to-3d), [Meshy rigging](https://docs.meshy.ai/en/api/rigging). Credentials stayed in Dogfight's local environment source and are never in runtime files. Three.js loader/utilities use the existing matching vendored runtime and its retained license.

## Verification
- Desktop and touch input/layout suite passed after menu/audio/material changes, with no browser errors.
- Co-op natural UI handshake, guest movement and firing, shared death state and disconnect passed after adding the disclosure.
- Simulation combat journey won all three waves: 18 kills, 51 shots, physical exit reached, no health grants or skipped enemies. This is an assisted deterministic simulation check, not a human playtest.
- NPC front/side and live arena screenshots, animated height check, skeleton/clip diagnostics: tests/npc-visual.mjs, docs/npc-visual.json, warden-front.png, warden-side.png, warden-gameplay.png.
- Final build and engine/browser checks are recorded with the delivery.

## Quality assessment
The menu and character are materially stronger. Active arena architecture and weapon silhouettes remain procedural and repeated; full premium/AAA and full ULTRAKILL parity are not claimed. This remains one arena, three waves, three enemy classes and three combo-capable weapons. Physical mobile and cross-internet NAT certification remain open.

Updated visual scorecard (0–3): art direction 2; hero/player 1; obstacles/enemies 2; rewards/interactables 1; environment 2; materials 2; lighting 2; VFX/motion 2; UI/HUD 2; performance evidence 2. Average 1.8. Remaining pass: authored weapon geometry, richer encounter spaces and measured target-device optimization.

Final measured checks: posed NPC height 1.928 m; hit flash and completed collapse verified; no browser errors. Desktop input capture with five enemies/two wardens: 80,022 authored triangles, 241 draw calls, 27 textures, sampled 37.0 FPS in headless Chrome under local test load. Touch emulation verifies movement and layout, not physical-phone performance or sustained NPC combat.
