# Chest finisher and articulated corpse physics

This pass adds a bare-hand blade thrust through a wounded zombie's chest, a timed heart extraction, a physical body release and an equipped-firearm drop/recovery. The existing F/RB arm chop, neck twist and two-press bite escape remain available. Platform scope is PC and standard-mapped controllers, as requested.

## Playing the new move

Press **V / R3** close to an injured, recently staggered Ash Witness. The target must have at most 65% of its maximum health and either at least 0.18 seconds of remaining stagger or an unexpired 450 ms opening after a real nonlethal stagger. Suppressed hits during AI stun grace cannot renew that opening. Both player arms must be intact, and the action costs 15 energy. A healthy enemy, a wall between the actors, an unsupported rig or another player's reservation prevents commitment. The HUD uses the same pure candidate selector as the engine. The opening follows the authoritative host clock, including guest down/revival.

| Boundary | Time from commitment | Result |
| --- | ---: | --- |
| Thrust contact | 0.24 s | One lethal hit; chest wound recorded |
| Heart extraction | 0.68 s | `heartRemoved` recorded once |
| Release | 0.95 s | Corpse and extracted heart enter local physics |
| Recovery complete | 1.50 s | Weapon controls return |

Damage and movement remain live during the action. Before contact, loss of reach, aim, line of sight, an arm, or the target cancels without a wound. After contact, movement can continue while the presentation finishes; downing, arm loss or target removal cancels the remaining phases. A cancelled contact cannot invent an extracted heart. G/X cannot harvest a second heart from this corpse.

The host owns all damage, anatomical flags and action boundaries. V/R3 uses an independent network sequence, consumed before held weapon fire. Guest prediction never applies a chest hit. Cosmetic ragdolls do not move gameplay entities or determine damage.

## Presentation and ownership

The action layers analytical wrist targets and the existing two-bone arm IK over the imported survivor and zombie models. The left hand braces beside the opening; the right hand points into the cavity, withdraws, presents the heart and releases it. The chest insert and the live skin/shadow discard share the chest socket frame. Original skin, textures, bones, six clips and existing zombie jaw/grip support remain intact.

The finisher's cloned survivor arms receive two additive wrist children, `LeftHand_CounterCurl` and `RightHand_CounterCurl`. Original distal finger weights transfer into free skin slots while preserving existing forearm influences and lateral thumbs. The measured 28.6-degree curl moves fingertips 5.62/5.67 cm; it resets absolutely each frame. Only cloned skin attributes, the added skeleton and its geometry wrapper are owned. Topology, UVs, textures, original binds/bones and the source GLB remain exact. This bends the existing finger clusters, with no primitive hand overlay.

The equipped firearm is captured from its actual render hierarchy, including instanced pieces. Camera-only hands, sleeve geometry and depth-range callbacks are excluded. Socket metadata contains cycles, so the capture copies geometry/transforms directly rather than serializing `userData`. It owns material copies and borrows original geometry/textures. A brief crouch and bounded lean follow the actual fallen grip, including lateral deflection from corpse contact. The lean uses measured arm segment lengths and stops changing after retrieval. The weapon reattaches only after the wrist reaches its grip; the loadout and ammunition are retained. Final sampled separation is 9.77 mm.

Heart extraction visibility is gated by the authoritative `heartRemoved`/extraction flag. Network snapshot replacement refreshes the wound reference. Restart, course replacement, actor removal and disposal release attachments, owned materials and physics handles.

## Physics choice and boundaries

The small cosmetic world uses locally bundled **cannon-es 0.20.0**, with its MIT license. This keeps runtime/build requirements at Node.js and bundled files, without a new WASM loader or runtime installation. The [official cone/twist constraint](https://github.com/pmndrs/cannon-es/blob/master/src/constraints/ConeTwistConstraint.ts) provides limited articulated joints; [Three.js skinned meshes](https://threejs.org/docs/pages/SkinnedMesh.html) continue to render the preserved imported skin.

Each complete supported corpse has 15 invisible rigid proxies and 14 constrained joints. Source bone world frames are captured at handoff; only the pelvis translates, while source segment translations and scales remain exact. Held finisher bodies are kinematic until release. Physics owns released and frozen corpses before the renderer's visible or hidden collapse-mixer paths.

The world uses a fixed 60 Hz step, bounded frame catch-up, explicit damping/friction, sleeping and a four-active-ragdoll/twelve-drop budget. Imported-skin collision envelopes are prepared during loading and reused at handoff. Preparation refreshes attached skin bind inverses on fresh unrendered normalized clones; hierarchy matrices alone are insufficient. Release refits those cached envelopes to the final held pose once, preserving bodies and joints without a new vertex scan. Older corpses freeze in their final pose. A flat floor plane and merged course wall segments collide with cosmetic objects; gate revision changes refresh static colliders without deleting bodies. Routine backward guest clock corrections do not reset the world. Explicit run/course reset owns replay cleanup.

Dropped organs, detached parts and firearms preserve the actual world pose, scale and geometry centroid. Instanced geometry contributes to their bounds. Lifetime expiry writes the final pose before releasing its body.

This is rigid articulated physics, not soft tissue simulation. Living actors, detailed props, stairs and individual cloth vertices are outside collision scope. The speed cap and fixed substeps limit tunneling; cannon-es here has no full continuous collision detection. Supported imported humanoids use the new solver; other enemy rigs retain their existing presentation.

## Asset evidence

`assets/models/chest-anatomy-v1.glb` contains original Blender-authored `ChestWound` and `Heart` components. Their dimensions are 0.170 × 0.190 × 0.080 m and 0.100 × 0.130 × 0.080 m. Local +Z points out of the wound. The runtime asset is 2,675,712 bytes, 23,280 triangles, two draw groups, one material and three embedded 1024 × 512 PBR maps.

Final SHA-256: `896c71c578f6a6ff78b09b152ab9918e8e472d9ac5cda73fa7a3ea542f0685b5`. Candidate/runtime bytes match. The editable packed master is preserved in `.art-source/chest-anatomy-v1/Chest_Anatomy_v1.blend`; authoring files and proof renders are excluded from builds. Closed authored surfaces, finite/unit attributes, nondegenerate triangles/UVs and embedded PNG decoding pass the export audit.

The existing generated tissue atlas is reused for material continuity with the previous anatomy kit, with original sculpted forms and authored roughness/normal detail. No credentials, new paid generation jobs or credits were used. Source/proof details are in the asset manifest and `art/chest-anatomy-v1/export-audit.json`. The original zombie GLB was not replaced.

## Audio

Canonical start, contact, extraction and release events schedule short nonlooping layers from the existing licensed, normalized sample library. They use the existing SFX/injury buses, voice budget, sequence deduplication and listener-specific spatial/occlusion paths. The new arrangements separate the chest impact, wet extraction and release accents. No synthetic placeholder waveform or paid sound generation was added.

## Verification ledger

The gameplay, procedural-animation, procedural-VFX, audio and QA skills/references were read by the implementation team. The art worker additionally read graphics quality and 3D/image integration references. The physics selection reference was read before choosing the bounded JS-only solver. The director's delegation rule was applied with disjoint engine/input, art and physics ownership; the parent owns presentation and browser QA.

Focused engine/input/authority, skin/rig preservation, wound presentation and physical drop/rig tests are implemented. Browser fixtures exercise actual V/R3 input through contact, extraction, release, weapon recovery, full-body settling, gore off, reduced motion, pause and restart. They use separate Chrome windows and an ephemeral production server; the user's existing tab and server on 5200 stay intact.

Final results are recorded in `output/playwright/chest-finisher/verification.json`. Earlier failed/review iterations remain preserved under the same directory.

| Verification | Accepted evidence |
| --- | --- |
| CPU gameplay, authority, rig, physics, injury, map and spawn regression | 167 passed, zero failed/cancelled; `cpu-tests-accepted.txt` |
| New chest sequence | 16 views, 12 checks, zero errors; `pc-accepted-final/report.json` |
| Existing chop/twist/rip | 17 views, zero errors; `existing-counters-accepted/report.json` |
| Standard controller input | 14 checks, zero errors; `controller/report.json`; new R3 additionally exercised in chest QA |
| Existing injury paths and ordinary inputs | 31 views, zero errors; 120 seconds, 11 cycles, 13 actual mouse shots and 0.548 cells travelled; `injury-regression-final/report.json` |
| Audio decode, event ownership, budgets, mute/pause and mix | 38 passed, 128 samples decoded; full mix peak 0.793; `audio/audio.json` |
| Installed web-game client | Two input bursts and inspected screenshot/state artifacts; `controls/` |
| Independent visual review | All 16 current chest views inspected and hashed; `independent-review.json` |

The chest browser test waits for the real weapon assets, clicks the canvas to acquire pointer lock, fires a bodyshot and presses V after a 120 ms reaction interval. It additionally samples the last held pose before release, the actual fallen firearm wrist anchor, and deformed source skin after settling. The final visible skin minimum is +0.0542 m in the side-view fixture; this is a sampled clearance, not a universal collision guarantee. The controller probe injects standard browser gamepad state through the actual application input path; physical controller hardware remains untested.

The fitted four-ragdoll/twelve-drop Node benchmark on the shared i7-9750H measures a 2.531 ms median / 4.189 ms p95 active physics step over its first three seconds. Updating and syncing bones together measures 2.938 / 4.766 ms. Loading preparation takes 79.34 ms; prepared release takes 1.550 ms median. All 15 regions on all four rigs are audited as fitted. This receipt excludes rendering and is not a browser FPS guarantee. See `physics-cpu.json`.

Reproduce the combined CPU suite with Node:

```text
node --test --test-isolation=none tests/gamepad-input.test.mjs tests/brutal-counter.test.mjs tests/brutal-visuals.test.mjs tests/chest-presentation.test.mjs tests/corpse-physics.test.mjs tests/character-asset-load.test.mjs tests/character-rig-v05.test.mjs tests/character-articulation.test.mjs tests/afterlife-motion-v04.test.mjs tests/player-injury-visuals.test.mjs tests/main-injury-lifecycle.test.mjs tests/player-bite.test.mjs tests/spawn-v5.test.mjs tests/map-flow-v5.test.mjs enemy-ai.test.mjs engine.test.mjs tests/hand-grip-rig.test.mjs
```

Build with `node build.mjs`. Run browser jobs sequentially with local Playwright/Chrome or explicit `PLAYWRIGHT_PATH` and `CHROME_PATH`: `tests/chest-finisher-browser.mjs`, `tests/brutal-combat-browser.mjs`, `tests/controller-browser.mjs`, `tests/player-injury-browser.mjs` and `tests/brutal-audio.test.mjs`. These harnesses create their own pages/servers. `scripts/run-v2-skill-client.mjs` uses a separate page on the existing source server. Their output directories can be selected through the harness environment variables; the accepted artifact paths above identify the reviewed runs.

## Quality limits

The corrected action reads clearly in the sampled PC views, but the original survivor still has fused finger clusters and visible angular sleeve ends. The new support joints provide a curved grip, without independent digit contacts. The chest rim remains ring-like, and the authored organ's macro anatomy and generated-image PBR detail remain stylized. The natural-shot capture also exposes an existing bright flower-like impact cluster and saturated spray that need a separate material/shape pass for realism. Gripping/squeezing is a rigid attachment with a short contraction envelope, not deformable tissue. Full-body bisection, head crushing and living physical ragdolls are not implemented by this pass. No whole-game professional-photorealism claim is made.

Physical controller hardware, actual joined-co-op corpse agreement and performance across lower-end PCs remain unverified; browser-standard gamepad injection and authoritative CPU/network fixtures are distinct evidence.
