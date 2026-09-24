# Dread refinement reference judge

Status: **baseline recorded; final verdict deferred until matched runtime captures arrive**.

This is a deliberately strict visual review for the current dread refinement pass. It covers the four changes the user called out: blood, primitive decoration, weapon identity, and enemy motion. A model description, source image, or implementation note is not runtime evidence. The acceptance decision needs captures from the running game and a small diagnostic record from the same build.

## Baseline actually inspected

The current baseline is recorded in the files beside this review:

- [`blood-before.png`](blood-before.png) shows several dark red floor pools in the Catacombs. They have irregular outer edges, but at this distance they read as flat decals with a uniform value. There is no visible impact direction, wound attachment, thickness, or wet/dry separation in this frame. The bright arch and large weapon occupy more visual attention than the blood.
- [`scene-before.png`](scene-before.png) shows a clean, long firing lane with two Ash Witnesses standing in full view. The repeated arch-and-post forms and the large rib-like left prop are legible, but they still read as a small kit of repeated primitives. The scene has little occlusion or transitional dressing to make the lane feel inhabited or unsafe.
- [`weapon-1-before.png`](weapon-1-before.png) through [`weapon-4-before.png`](weapon-4-before.png) show four different first-person silhouettes, but the action state is not demonstrated. Color accents and the lower-right labels carry much of the identity; a still does not prove that any internal carriage, barrel, coil, shutter, or other mechanism visibly operates.

The baseline code explains why these are hard gates. `renderer.js` previously built gore from generic instanced icosahedra and spheres and built blood from an instanced `PlaneGeometry`; the new pass intentionally removes the detached capsule/eye/skull proxies and is moving toward a restrained residue sheet plus the animated corpse. The baseline `npc-afterlife-model.js` exposed only Idle, Shuffle, and Collapse; the v02 package now reports authored Shuffle, AttackLunge, HitRecoil, and Collapse clips. `docs/weapon-mechanism-iteration.md` described the rejected jaw/rib/claw pass, so the weapon gate below is mechanism-neutral and judges the new manufactured designs by what visibly moves in-game.

## Interim v02 review (not acceptance)

The matched [`blood-after.png`](blood-after.png) is a real improvement in restraint: the large bright pools are gone, the residue is darker, smaller, and less like a neon decal, and the after capture reports no errors. It is still only a seeded residue state (`blood: 4`, `gore: 0`, `impacts.marks: 0`); the frame does not show a wound, directional hit spray, corpse contact, or kill transition. Keep the material direction, but hold the blood gate until the requested real-hit and real-kill captures show where the residue comes from and how it lands.

The [`ash-witness-dread-v02-gait.png`](ash-witness-dread-v02-gait.png) sheet shows a readable shuffle phase: the legs alternate, the pelvis and shoulders shift slightly, and the pose avoids the earlier T-pose concern. The [`ash-witness-dread-v02-actions.png`](ash-witness-dread-v02-actions.png) sheet shows an arm reach, head/torso changes, and a clear hit-recoil bend. At this thumbnail scale, the attack still reads more as an arm reach than a committed rear-foot-to-torso lunge, so the attack gate remains conditional until runtime frames prove contact timing, foot planting, and recovery. The Blender sampling record is useful provenance and reports foot paths and spine/head ranges; it cannot replace the in-game sequence.

The interim first-pass after capture reported 219 calls and 256,060 GPU triangles versus 239 calls and 328,776 GPU triangles in the matched before record, with 64 versus 76 renderer textures and no reported errors. Those numbers came from the old controlled-time diagnostic path and are historical only; they are not the final budget evidence. The lower blood counts also meant that frame had not exercised the hit/kill path.

## Four acceptance gates

### 1. Blood must read as attached, directional material

**Required evidence:** one matched hit frame and one matched kill frame, before and after, with the same camera, exposure, weapon slot, enemy distance, and hit direction. Include the renderer counts for gore, blood, calls, triangles, and textures.

**Pass conditions:**

1. The hit leaves a readable contact or wound cue whose shape follows the impact direction. A floor pool alone is insufficient.
2. The blood has at least two visible material states at game scale: a dark wet body or clot and a restrained edge/splatter variation. It should read oxblood or near-black red with controlled highlights; pink or red emissive wash fails.
3. At least one secondary element has a physical relationship to the hit: a short directional spray, a clinging wound mark, a grounded clot, or a detached piece with a visible landing/contact. Generic floating icosahedra and round droplets fail if they are the only readable forms.
4. Marks sit on a surface or body, do not visibly z-fight or float, and do not cover the whole lane. The effect must remain readable for a moment after impact without turning into a permanent red carpet.

**Budget gate:** reuse the shared texture/material and existing instancing where possible. The after capture must report the delta; a blood pass that adds a dynamic light, an unbounded particle pool, or a material per mark does not pass the lightweight requirement. Use the existing `MAX_GORE`/`MAX_BLOOD` capacities as an upper bound unless a lower bound is documented.

### 2. Decoration must gain authored silhouette and structural purpose

**Required evidence:** one same-camera before/after pair of the reviewed lane, with at least two changed locations visible: one grounded obstruction or divider and one piece of side dressing. Mark the changed objects in the capture metadata or annotate the review copy.

**Pass conditions:**

1. The replacement has a silhouette that is recognizable at this camera distance and is built from a purposeful design language such as a collapsed medical fixture, cable-supported shrine, service cabinet, suspended body frame, or irregular bone/metal structure. A recolored box, another torus, a straight bar, or a stack of cubes is not an authored replacement.
2. The object connects visually to the room: it has a plausible contact shadow or floor contact, a material relationship with the surrounding stone/metal, and a clear reason to occupy that location. Floating lintels and disconnected ornaments fail.
3. The decoration improves the read of the playable space by creating a framed sightline, a partial occlusion, or a deliberate focal edge. It must not hide the player, enemy, or weapon read in the proof frame, and it must not alter collision or route access unless that is explicitly part of the change.
4. The final capture shows the actual runtime object. ImageGen, Meshy, Blender, and concept-gallery images may establish intent or provenance, but cannot count as the in-game result.

**Budget gate:** report added calls, rendered triangles, and texture memory for the two replacements. Keep the change within the existing lightweight target and avoid a new light for a prop. If the scene is only recolored or rearranged, mark this gate failed even when the screenshot looks cleaner.

### 3. Each weapon needs a distinct silhouette and a visible mechanism cycle

**Required evidence:** for slots 1–4, capture an idle frame, a mechanism action frame, and a return-to-idle frame at the same FOV and hand placement. A short state trace should identify the shot/charge input and the mechanism value over time. Include per-weapon draw and triangle counts, including any added meshes.

**Pass conditions:**

1. The four silhouettes remain distinct in a grayscale thumbnail at the actual game scale. Labels, HUD color, and emissive accents cannot carry identity by themselves.
2. The action is a physical, readable change rather than only a bloom or color pulse. The moving subassembly must expose the weapon's function and survive a dark-room frame: for the current redesign this means the captive-bolt/cylinder carriage, break-action twin barrels and extractor, exposed coil/capacitor cage, and shutter/aperture core respectively. Those examples describe the current designs; a later mechanism can pass with a different silhouette if its moving relationship is equally clear.
3. The motion has a start, peak, and return. It should be timed to the existing shot or charge state and not remain permanently open. A single idle still, a muzzle flash, or a test report without frames fails.
4. The mechanism reinforces the weapon's function and silhouette. Four near-identical block guns with different glow colors fail even when all four technically animate.

**Budget gate:** use the existing target of no new dynamic lights or per-frame allocations and the redesigned factory's small shared kit. The final report must state the actual calls and triangles; do not substitute source-file counts for the rendered measurement. The current redesign note reports the actual authored factory sizes as Ossuary 68 meshes / 11,982 triangles, Breach 50 / 9,414, Arc Lance 49 / 10,914, and Reliquary 54 / 10,506. These are source geometry budgets; the direct runtime draw/triangle evidence is recorded below.

### 4. The Ash Witness must carry weight through gait and attack

**Required evidence:** a locomotion sequence of at least three timestamps (contact, transfer, push-off) and an attack sequence of windup, commit, and recovery. Use the same enemy, camera, speed, and floor. Include the clip/state name and, if available, root and foot displacement diagnostics.

**Pass conditions:**

1. Locomotion shows a planted foot or clear contact, a pelvis shift, and counter-motion through the shoulders/head. The feet must not skate while the root translates. An isolated still, a bobbing root, or a warning ring is not evidence of weight.
2. The attack carries mass from a rear foot through the torso into the strike. The windup, contact/commit, and recovery are visually different, and the hand/arm motion agrees with the damage window. A red ring or material emissive pulse without body motion fails.
3. The actor remains readable as a person under the scene lighting: feet stay grounded, the face/torso do not snap between clips, and there is no T-pose, frozen arm, or visible blend pop.
4. The implementation must fit the current shared Ash Witness asset and two-instance budget. A new high-poly enemy is not a substitute for authored motion. If an attack clip is unavailable, a deterministic, art-directed overlay may pass only when the action sequence visibly transfers weight and the screenshots prove it.

**Current risk:** the v02 package now exposes `AshWitness_AttackLunge` and `AshWitness_HitRecoil`, but the runtime helper still has to demonstrate correct triggering and blending with simulation-owned attack timing. The authored clip list, Blender sampling ranges, or Meshy research alone cannot pass this gate.

## Review protocol

- Compare like with like: same 1536×864 viewport, FOV, camera position, exposure, weapon slot, enemy distance, and time in the encounter. Do not compare a concept or a close-up preview to a gameplay frame.
- Separate visual proof from provenance. A generated image can guide a silhouette; it cannot prove the runtime shader, animation, collision, or budget.
- Record `errors`, calls, rendered/GPU triangles, textures, heap, and asset decode status for the after build. An attractive frame with a broken loader or an unbounded pool is not an acceptance.
- Judge the worst visible frame as well as the hero frame. If a mechanism disappears behind the hands, the blood becomes a flat red decal at distance, or the attack reads as a slide in the action frame, the corresponding gate remains open.

## Final visual review of the v03 runtime captures

The action set now supplies the evidence that was missing from the interim review: [`blood-hit.png`](blood-hit.png), [`blood-kill.png`](blood-kill.png), [`blood-residue.png`](blood-residue.png), the four idle/action/rest triplets, [`gait-0.png`](gait-0.png) through [`gait-3.png`](gait-3.png), [`attack-windup.png`](attack-windup.png), [`attack-commit.png`](attack-commit.png), [`attack-recover.png`](attack-recover.png), and the final production decoration views [`mortuary-console.png`](mortuary-console.png) and [`mortuary-hatch.png`](mortuary-hatch.png). [`actions-qa.json`](actions-qa.json) reports no errors, real hit/kill FX, nonzero mechanism pulses with return-to-rest values near zero, and the authored attack/gait state weights. Its per-weapon counts were refreshed directly and are reconciled with the final scene record below.

### Gate results

1. **Blood — visual pass with a bounded hit-readability limitation.** The kill frame now shows a dark, grounded pool and a directional trail under the corpse, with small dark clots and a restrained torso spray. The residue frame preserves the contact relationship after collapse. The old reflective white pool and large faceted toy chunks are gone. The single-hit frame still reads primarily as a red beam plus a small floor contact stain; the wound attachment is subtle at this distance. That is a follow-up readability opportunity rather than a reason to reopen the material pass, because the kill and residue frames establish the intended physical result.
2. **Decoration — pass with a bounded distance/readability limitation.** The corrected production [`scene-after.png`](scene-after.png) removes the diagonal rod/pale bead distraction while preserving the lane. The labeled runtime closeups show two authored fixtures: [`mortuary-console.png`](mortuary-console.png) has a grounded manufactured silhouette with chamfered drawer fronts, attached pulls, and a projecting middle tray; [`mortuary-hatch.png`](mortuary-hatch.png) shows a recessed wall hatch with a chamfered lip, pull, and label plate. The direct `decor` record identifies `HorrorKit_furniture-colonnade` index 1 at `[68.218, 0, 90.542]` and `StoryWallRelief_skull-ossuaries_MortuaryHatchLip` index 49 at `[90, 3.15, 88.295]`, with no missing or fallback props. The main hero view remains dark and the central arch kit is still visibly authored from repeated forms, so this is a bounded set-dressing correction rather than a total architectural rewrite, but the requested primitive removal now has actual runtime evidence.
3. **Weapons — visual pass, with two mechanisms needing continued legibility monitoring.** The four triplets are materially more distinct than the baseline: Ossuary has a drum/chamber silhouette, Breach exposes twin pressure barrels and top valves, Arc Lance is an open coil/cage, and Reliquary has a sealed aperture with ribbed housing. Breach and Arc show the clearest physical action; Ossuary and Reliquary still communicate some of their cycle through dark-on-dark movement plus pulse light, so their moving carriage/shutter should stay visible in ordinary play. The trace proves all four mechanism values rise and return, but it retains legacy field names (`jawTension`, `pressurePulse`, `cagePulse`, `ritualPulse`); map those names to the redesigned mechanisms in the final report so provenance is not ambiguous. The visual redesign is a substantial improvement and the direct per-weapon counts pass the lightweight budget gate below.
4. **Ash Witness motion — pass with bounded weight polish.** The gait frames show a planted approach with changing stance and no T-pose or frozen arms. The attack sequence has distinct windup, commit, and recovery: the head/torso lead into the strike, the feet separate through commit, the arm follows through, and the actor returns to the locomotion pose. It is still an arm-led attack rather than a heavy lunge, and the close enemy is very pale, which reduces clothing/shadow detail, but the body timing is now readable and the earlier T-like failure is resolved. The runtime state record supports the visual sequence; no root-slide or blend-pop blocker is visible.

### Verified performance and QA

The direct-refresh [`capture-after.json`](capture-after.json) is the final Catacombs budget record after the decoration correction. Against the matched baseline's 239 calls, 328,776 GPU triangles, and 76 renderer textures, the after scene reports 242 calls, 248,172 GPU triangles, and 67 textures, with two Ash Witness instances, five loaded clips, and no errors. That is three additional calls (+1.3%), 80,604 fewer GPU triangles (-24.5%), and nine fewer textures (-11.8%). The after capture's 607,012 total scene triangles are also below the baseline's 676,908.

The refreshed per-weapon action traces in [`actions-qa.json`](actions-qa.json) show bounded mechanism cost and return to the idle footprint. Slot 1 (JSON weapon 0) is 239 → 247 → 239 calls and 193,144 → 193,670 → 193,144 GPU triangles; slot 2 is 241 → 249 → 241 and 199,156 → 199,890 → 199,156; slot 3 is 235 → 245 → 235 and 200,624 → 201,614 → 200,624; slot 4 is 241 → 249 → 241 and 200,248 → 200,806 → 200,248. Each trace uses 65 textures, has a nonzero action pulse, and returns to a near-zero mechanism/recoil value.

The full eight-map production run in [`qa-results.json`](qa-results.json) reports no browser, asset, or runtime errors. Its 180-frame sample has a 16.7 ms median and 16.8 ms p95, and the recorded heap is 97 MB used out of 169 MB total. These numbers pass the lightweight performance gate, while the final Catacombs capture above includes the corrected props.

### Final review status

All four visual gates and the performance gate pass with the bounded visual notes above. The main remaining limits are dark distance readability for the console and the darker Ossuary/Reliquary mechanism movement; neither blocks this requested lightweight refinement. Historical first-pass 219-call numbers and the earlier cached action-capture counts are superseded by the direct-refresh records above.
