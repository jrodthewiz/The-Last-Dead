# Dread iteration 02 — result and limits

This iteration makes body contact readable, fixes misleading hit/attack animation, and completes the previously upright death pose with a grounded fall. It also improves Ossuary/Reliquary mechanism movement and verifies that their animated meshes survive runtime batching. The [gallery](index.html) contains actual production captures and links to the independent reviews.

## Changes

- Flesh contact uses the incoming shot direction rather than the wall normal behind the target. Its brief atlas splash follows the living target so forward movement cannot swallow it. Ordinary Ossuary/Breach trails are thinner, dimmer, and shorter lived. Impact pools remain bounded at 32 splashes and 160 droplets; no per-hit material or light is created.
- Ash Witness no longer treats its skin texture as a full-strength emission map. A local light-response adjustment is present, although the close attack remains visually pale. Ordinary non-staggering shots preserve the authoritative attack pose; a real parry cancels the attack and plays recoil. Idle hits and lethal shots retain their own responses.
- The old collapse animation ended in a standing bow. A small runtime fall now wraps the existing clip, using six cached rig anchors for floor clearance. It has no physics solver or per-frame vertex scan. The final head anchor is 0.09 m above the floor, versus 1.23 m in the intermediate capture. The root no longer turns toward the player after death.
- Ossuary jaws and Reliquary aperture members open on firing and return to rest. Hinge motion is relative to its authored rest position. Explicit texture color spaces, per-material fill, and corrected shader cache keys improve surface consistency. Post-batching tests verify live attached meshes, rather than detached references.

## Independent checks

The fresh [visual baseline](visual-baseline.md) rejected the earlier pass's generous acceptance: blood, weapons, and close enemies each scored 1/3. The [intermediate review](visual-interim.md) still rejected faint body contact and a pale enemy, leading to another revision. The [final visual review](visual-final.md) scores all three at **2/3, partial**, with atmosphere holding at **2/3**. Groundfall is met; close-body exposure, small immediate blood contact, and subtle weapon motion remain open. The [behavior review](behavior-final.md) checks the simulation/animation contract separately.

The behavior judge reproduced an enemy dealing real melee damage while its model appeared to recoil. Its new engine-plus-animation test confirms ordinary hits retain attack contact, parries cancel it, idle hits recoil, and lethal hits collapse. The model uses synthetic clips for that contract test; the browser captures separately exercise the shipped GLB.

## Verification

- Production build passed. Captures ran against `http://127.0.0.1:5200/dist/` with no browser, shader, or HTTP errors.
- 21 focused checks passed across impacts, animation contracts, enemy telegraphs, preserved decoration, weapon motion, and batching. The behavior judge also ran the 20-test engine suite successfully.
- Four original weapons fired through the real engine, visibly entered action state, and returned to rest. Attack windup/commit/recovery, a nonlethal hit, a lethal hit, and the completed collapse were captured. Changing player position after death left corpse heading unchanged.
- The separately coordinated rifle task verified all six weapon slots, automatic fire, burst, charge/cancel behavior, audio decode, and a 390px HUD in its [production evidence](../rifle-pass/production/). Those rifle additions are concurrent work, not attributed to this art iteration.
- The gallery's screenshot loading and idle/firing controls were checked in the in-app browser. The user's existing tabs and server were retained.

The matched two-enemy Catacombs view remains **242 draw calls and 248,172 rendered triangles**, unchanged from the prior pass. Renderer textures are **69**, versus 67 before the concurrent rifle additions. This art pass adds no runtime model or texture assets. Ossuary and Reliquary remain at 11,982 and 10,506 factory triangles.

The 180-frame fixed-view sample measured **16.7 ms median / 17.4 ms p95**, with approximately **96.2 MiB JavaScript heap used**. Simulation was frozen for that render sample. It is not a sustained gameplay, total RAM, GPU memory, or low-end hardware benchmark.

Evidence: [action trace and built-file hashes](final/actions-qa.json), [matched scene and frame sample](final/capture-after.json), [weapon details](weapon-notes.md), and [scope/asset ledger](coordination.md).

## Limits

This is a useful incremental improvement, not a finished realism pass. The close enemy still needs stronger clothing/skin separation and a more forceful attack silhouette. Weapon movement is functional but subtle from the play camera. The new fall is an authored clip plus a bounded transform, not a physical ragdoll; there is no terrain-aware body collision or foot IK. Contact blood is a short textured plane with droplets, not fluid simulation. Broad decoration and lighting were held for this pass.

The older hit fixture advanced only the renderer; the final fixture advances the simulation too. Its before/after pair is an appearance comparison, not identical elapsed-time evidence. The final trace records the corrected timing. Further melee work requested in the other task begins after this tested six-slot snapshot and is outside these results.
