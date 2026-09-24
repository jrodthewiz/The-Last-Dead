# Zombie chase, swipe and impact pass

The player loop is to evade a pursuing zombie, read its committed windup, then shoot or parry and see the impact and aftermath. The new motion and effects use the existing game simulation, character rig, blood atlas and recorded hit sounds.

## Changes

- Blender-authored `AshWitness_Chase` adds a longer uneven stride, bent support knees, forward torso weight and asymmetric reaching arms. The existing idle, shuffle, hit recoil and collapse clips remain available.
- `AshWitness_AttackLunge` now coils the shoulder, swipes across the body, follows through and recovers. Runtime samples its contact frame directly from the authoritative windup and strike timers. Stalker, Skitter and Bloodhound therefore share the contact pose while keeping their different attack tempos.
- Chase cadence follows actual distance traveled. The body turns into its path; stopped or blocked roots stop stepping. Canceled windups fade out without a phantom swipe.
- Ordinary zombie reach is 0.34 game cells (1.36 metres), with a closer stopping distance and a restrained visual lunge. Large Warden attack reach and ranged attacks retain their existing behavior.
- Hits emit seeded forward spray and smaller reverse droplets. Ordinary rounds do not eject large chunks. Strong/lethal hits retain heavier feedback, recoil and collapse.
- Airborne droplets leave small floor stains; forward spatter attaches only to a nearby ray-tested wall. A fixed 64-slot pool supplies wet-to-dry residue in one draw. The gore setting hides it and level resets clear it.
- Conventional bullets and both rifles use short, rapidly fading streaks. Energy weapons retain their existing beam language.

## Assets and ownership

Authoring script: `scripts/chase-swipe-blender.py`, Blender 2.93 in background mode with two threads. Editable source: `.art-source/afterlife-iteration/Ash_Witness_Chase_v03.blend`. Runtime: `assets/models/afterlife-ash-witness-chase-v03.glb`, 2,463,768 bytes, six clips, 24 joints, one texture and 27,512 triangles. The original v02 source and runtime asset remain available for other work. The packaged asset requires no mesh decoder at runtime.

The animation changes live in `npc-afterlife-model.js`; attack range and directional hit particles remain simulation-owned in `engine.js`. `impact-vfx.js` and the new `blood-deposits.js` own cosmetic spatter; `combat-vfx.js` owns short tracer presentation. Existing melee reaction hooks are preserved. No new sound or texture generation was needed.

## Verification

**Pass:** production build; 65 focused engine, animation, impact, rifle and melee tests; 120 seconds of keyboard/mouse play; desktop/mobile captures; cinematic-menu return; zero browser or asset errors. The shipped Stalker, Skitter and Bloodhound all sampled attack time `0.374999991` on the authoritative damage frame. The real shot emitted nine droplets, which left three grounded stains. See [the motion preview](index.html) and [the full browser report](final/qa-results.json).

`tests/chase-impact.test.mjs` checks actual damage-frame timing, distance-driven gait, stopping, windup cancellation, close attack reach, directional spray, stain lifetime and reset, wall attachment, and tracer length. Existing engine, blood/VFX, melee, rifle and hit-contract tests cover their shared paths.

`tests/chase-impact-game.mjs` opens the production build on its own ephemeral server, records an actual simulated chase and repeated swipes, samples the shipped rig's hands and feet, captures contact for all three zombie variants, fires a real shot, follows droplets to the floor, checks mobile framing, plays with keyboard/mouse input for two minutes, and returns to the cinematic menu. Its final report is `final/qa-results.json`. Captures in `before/` and `iteration-1/` show the earlier passes, including the excessive original swipe range. The original port 5200 game server and user tab are preserved.

## Reference ledger

Loaded successfully from the installed skills:

- Gameplay systems: `references/gameplay-workflows.md` and `references/physics-engine-selection.md`.
- Procedural animation: `references/procedural-motion-and-docking-systems.md`.
- Procedural VFX: `references/procedural-vfx-system.md` (bounded pools, event direction and lifetime ownership).
- QA release: `references/qa-release-checklists.md`, `checklists/visual-verification.md`, and `checklists/playtest-qa.md`.
- AAA graphics: `checklists/material-lighting-quality.md` and `checklists/performance-safe-visual-detail.md`.

The game retains its custom deterministic collision; no rigid-body engine was added. This is an in-place skeletal chase with distance-based cadence, not inverse-kinematic foot locking or a physical ragdoll. Mobile evidence is browser emulation. The motion capture uses deterministic simulation steps; performance claims must use the separate live-play evidence.
