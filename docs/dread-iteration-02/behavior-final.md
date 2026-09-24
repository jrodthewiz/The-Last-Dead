# Behavior final — Dread iteration 02

Review date: 2026-09-23  
Scope: the real hit/attack contract, lethal transition, corpse grounding and heading, and the bounded update/lifetime path. This is a source and artifact audit; I did not launch the browser or Blender.

## Result

The bounded behavior gate passes. I found no concrete runtime defect to file in this pass.

The focused contract test now covers the four transitions that matter here (`tests/afterlife-hit-contract.test.mjs:84`, `:119`, and `:153`):

- A real shot during windup damages the enemy while keeping `attackActive: true` and `hitActive: false` through the authoritative slash contact.
- An idle real hit starts `HitRecoil`.
- A lethal real shot starts `Collapse` at full weight.
- A real parry clears the windup/contact and leaves recoil as the visible response.

The test passes 3/3. `node scripts/afterlife-character-runtime-check.mjs` also passes its attack, recoil, collapse, and disposal checks.

## Corpse and heading

`npc-afterlife-model.js:149` resolves the six support bones once when the model is created. The dead branch at `npc-afterlife-model.js:287-299` reuses that array, advances the existing collapse action, and scans six cached matrix entries to keep the minimum support height at `.09`. There are no app-level vector, array, or bone lookup allocations in that corpse update. The existing `root.updateMatrixWorld(true)` is a bounded scene-graph update, not a ragdoll or per-vertex bounds scan.

The final production trace in [`final/actions-qa.json`](final/actions-qa.json) confirms the result. The settled samples both report collapse weight `1`, collapse clip time `1.833333`, head Y `0.09`, left foot Y `0.140028`, and right foot Y `0.233628`; the repeated samples are identical. The earlier collapse sample is still in motion (head Y `1.631743` at clip time `.5`), so the final capture demonstrates completion rather than an accidental starting pose.

`renderer.js:1441-1443` keeps a dead Ash Witness root in place and updates its animation, but only faces a live root toward the player. The three collapse samples retain `rootYaw: -3.141592653589793`, including the sample taken after moving the player, so corpse heading is stable.

## Lifetime and bounds note

Dead IDs are intentionally included in the renderer's `alive` set while they remain in `run.course.enemies` (`renderer.js:1441`). That keeps the corpse visible and updates its settled pose; contact shadows are skipped for dead enemies (`renderer.js:1504`). The final diagnostics show `afterlifeEnemies: 1`, `enemies: 0`, and `enemyContactShadows: 0`, which is the expected single-corpse fixture state. When the simulation removes an enemy from the course, the normal visual cleanup removes its root as well. Current wave and dungeon progression are finite, so this retention is bounded by the wave contents; I am recording it as the intended aftermath behavior, not a defect.

This audit establishes that the new corpse path itself adds no per-frame application allocations. It does not claim the whole renderer is allocation-free: `_updateEnemies` still owns its existing per-frame bookkeeping, including the `alive` set. No change is recommended from this bounded evidence.

## Verification

- `node --test tests/afterlife-hit-contract.test.mjs` — 3 passed.
- `node scripts/afterlife-character-runtime-check.mjs` — `{ "ok": true }`.
- Final artifact: `docs/dread-iteration-02/final/actions-qa.json` — empty `errors` and `requests`; completed collapse and stable post-camera-change yaw recorded.
