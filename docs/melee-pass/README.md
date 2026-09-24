# Wake Bat and Ripper Chainsaw

Two immediately available weapons extend the existing rack to eight slots.

| Weapon | Primary | Alternate |
| --- | --- | --- |
| **7 · Wake Bat** | Committed 0.68-second swing; up to two nearby targets | Slower 1.02-second heavy strike; one target; stronger knockback |
| **8 · Ripper Chainsaw** | Hold to spin up, then cut every 0.105 seconds while in reach | A short shove to interrupt an enemy and make space |

Damage resolves at the bat's contact frame. Release stops chainsaw damage
immediately; its motor winds down. Walls block both attacks, and floor/wall
contact uses surface sparks instead of bullet beams. Switching weapons,
pause, restart and death cancel pending melee actions. Mouse wheel and the
touch weapon button cycle all eight slots.

The bat has a windup, strike, brief contact pause, follow-through and recovery.
Both hands follow its model. The chainsaw has an animated closed chain loop,
small motor vibration, sampled startup/engine/cutting/shutdown layers and a
separate brace-and-shove animation. Reduced motion limits viewmodel motion.
Existing gore and audio settings still apply.

## Hit response

Hits apply directional, mass-scaled knockback to enemies. A swept collision
proxy moves a killed enemy without tunnelling through walls; gravity settles
it back to the floor. The Ash Witness rig adds bounded spine, head and limb
springs after its animation mixer, then checks corpse grounding. This is a
lightweight ragdoll-style reaction, not a full rigid-body ragdoll simulation.
Other enemy families receive the movement impulse and their existing hit/death
animations. Chainsaw chatter is weaker than a bat strike and does not keep a
living enemy permanently staggered.

Co-op damage remains host-authoritative. Guest prediction advances only local
swing/rev presentation; authoritative enemy reactions, contacts and impact
audio arrive through the existing snapshots.

## Sources and implementation

- [Model, animation and sourcing ledger](../melee-models.md)
- [Recorded sound sources and audio lifecycle](../melee-audio.md)
- [Additive rig reaction contract](../melee-reaction.md)

The gameplay, visual, audio and QA phases were kept separate. The Three.js
gameplay/physics guidance, graphics/material guidance, audio workflow and
release checklist informed the pass. Generator credential checks found no
Tripo, Gemini or ElevenLabs keys. Models use authored code geometry and an
existing wood texture; audio uses credited CC0 recordings. Blender was not
needed for these meshes or pivots.

## Lightweight verification

See the [follow-up verification and fixes](verification/README.md) for real
touch, sustained co-op, transport-size, and quick-trigger regression coverage.

Focused engine/model/audio tests cover contact timing, heavy strikes, cleave
limits, aim/reach, wall and floor contact, saw cadence, cancellation, prediction,
collision settling, rig stability, static batching and bounded audio sources.
The browser check uses an isolated Chrome session and leaves the user's game
tab and running server intact.

`tests/melee-game.mjs --audio` drives actual keyboard and mouse controls,
captures the attack phases, checks a grounded corpse, checks canvas pixels and
console/HTTP errors, and verifies pause/switch/restart/death audio cleanup.
It also checks the 390 × 844 layout. Test encounters are fixed QA fixtures;
this pass does not claim broad hardware or internet co-op certification.

Production results and images are stored in `production/qa-results.json` and
the adjacent PNG files. Source exploration captures are kept in `source/`.

Verified on September 23, 2026:

- Production static build succeeds.
- 66 combat/model/audio/VFX/batching regression checks passed; a subsequent
  shoulder/grip continuity check passed with all seven melee model checks.
- The isolated production browser check decodes all 126 audio manifest
  entries, with no audio, page, console or HTTP errors.
- A held saw owns one motor loop and one contact loop. Startup/shutdown cues
  remain bounded; pause, restart, death and dispose leave zero melee sources.
- The final arm fit preserves wrist length and hand scale, and keeps sleeve
  roots below the camera throughout the swing.
