# Dread refinement reference judge

Status: **baseline recorded; final verdict deferred until matched runtime captures arrive**.

This is a deliberately strict visual review for the current dread refinement pass. It covers the four changes the user called out: blood, primitive decoration, weapon identity, and enemy motion. A model description, source image, or implementation note is not runtime evidence. The acceptance decision needs captures from the running game and a small diagnostic record from the same build.

## Baseline actually inspected

The current baseline is recorded in the files beside this review:

- [`blood-before.png`](blood-before.png) shows several dark red floor pools in the Catacombs. They have irregular outer edges, but at this distance they read as flat decals with a uniform value. There is no visible impact direction, wound attachment, thickness, or wet/dry separation in this frame. The bright arch and large weapon occupy more visual attention than the blood.
- [`scene-before.png`](scene-before.png) shows a clean, long firing lane with two Ash Witnesses standing in full view. The repeated arch-and-post forms and the large rib-like left prop are legible, but they still read as a small kit of repeated primitives. The scene has little occlusion or transitional dressing to make the lane feel inhabited or unsafe.
- [`weapon-1-before.png`](weapon-1-before.png) through [`weapon-4-before.png`](weapon-4-before.png) show four different first-person silhouettes, but the action state is not demonstrated. Color accents and the lower-right labels carry much of the identity; a still does not prove that the jaw, valves, cage, claws, or vents visibly operate.

The current code explains why these are hard gates. `renderer.js` builds gore from instanced icosahedra and spheres and builds blood from an instanced `PlaneGeometry`. `secondary-vfx.js` supplies one shared 128px mask. `npc-afterlife-model.js` has Idle, Shuffle, and Collapse clips; locomotion weight is selected from measured root displacement, and the current file has no attack clip. `docs/weapon-mechanism-iteration.md` names four mechanism pulses, but the notes and stills do not replace action-frame evidence.

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
2. The action is a physical, readable change rather than only a bloom or color pulse: Ossuary jaw/ribs open and settle; Breach breech/valves recoil and reset; Arc Lance cage/vents open around its core; Reliquary claws/vents part and close. The relevant moving part must be visible above the hands and survive a dark-room frame.
3. The motion has a start, peak, and return. It should be timed to the existing shot or charge state and not remain permanently open. A single idle still, a muzzle flash, or a test report without frames fails.
4. The mechanism reinforces the weapon's function and silhouette. Four near-identical block guns with different glow colors fail even when all four technically animate.

**Budget gate:** use the existing target of no new dynamic lights or per-frame allocations and the documented small addition (the Breach valves are four low-segment meshes). The final report must state the actual calls and triangles; do not substitute source-file triangle counts for the rendered measurement.

### 4. The Ash Witness must carry weight through gait and attack

**Required evidence:** a locomotion sequence of at least three timestamps (contact, transfer, push-off) and an attack sequence of windup, commit, and recovery. Use the same enemy, camera, speed, and floor. Include the clip/state name and, if available, root and foot displacement diagnostics.

**Pass conditions:**

1. Locomotion shows a planted foot or clear contact, a pelvis shift, and counter-motion through the shoulders/head. The feet must not skate while the root translates. An isolated still, a bobbing root, or a warning ring is not evidence of weight.
2. The attack carries mass from a rear foot through the torso into the strike. The windup, contact/commit, and recovery are visually different, and the hand/arm motion agrees with the damage window. A red ring or material emissive pulse without body motion fails.
3. The actor remains readable as a person under the scene lighting: feet stay grounded, the face/torso do not snap between clips, and there is no T-pose, frozen arm, or visible blend pop.
4. The implementation must fit the current shared Ash Witness asset and two-instance budget. A new high-poly enemy is not a substitute for authored motion. If an attack clip is unavailable, a deterministic, art-directed overlay may pass only when the action sequence visibly transfers weight and the screenshots prove it.

**Current risk:** `npc-afterlife-model.js` currently exposes only `AshWitness_Idle`, `AshWitness_Shuffle`, and `AshWitness_Collapse`. Its shuffle weight is derived from measured root speed, while `enemy.attacking` currently controls the warning ring and material response. That means the burden of proof is on the new action frames: the existing clip list alone cannot pass this gate.

## Review protocol

- Compare like with like: same 1536×864 viewport, FOV, camera position, exposure, weapon slot, enemy distance, and time in the encounter. Do not compare a concept or a close-up preview to a gameplay frame.
- Separate visual proof from provenance. A generated image can guide a silhouette; it cannot prove the runtime shader, animation, collision, or budget.
- Record `errors`, calls, rendered/GPU triangles, textures, heap, and asset decode status for the after build. An attractive frame with a broken loader or an unbounded pool is not an acceptance.
- Judge the worst visible frame as well as the hero frame. If a mechanism disappears behind the hands, the blood becomes a flat red decal at distance, or the attack reads as a slide in the action frame, the corresponding gate remains open.

## Verdict

No final verdict is issued yet. The baseline is visibly short of the requested bar for blood material, authored set dressing, mechanism proof, and enemy attack weight. I will update this document after the parent supplies the matched runtime captures and measurements; earlier passes should not be treated as acceptance for this stricter review.
