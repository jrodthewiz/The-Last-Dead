# Build08 weapon review ledger

Review contract read: `grimoire/review/gates_reference.md` and `grimoire/review/self_correction.md` were read before this record.

Formal forge `diagnose_render.py`, `diagnose_render_multi_angle.py`, `turntable_gate.py`, `check_part_coverage.py`, and Divine Eye scoring were not executed for this browser game factory pass. The records below are implementation and runtime evidence, not a formal img2threejs `continue` verdict; the parent release ledger should keep the art gate marked incomplete until those commands are run against final lit renderer captures.
## Runtime structural checks

The factories were instantiated in Node with the project's bundled Three.js module. All transforms and bounds were finite. Breach measured 87 meshes / 15,214 triangles before renderer batching; Arc measured 65 meshes / 15,248 triangles. Both expose named `muzzle` and `projectileOrigin` sockets and a `sculptRuntime` with parts, collider, explode and pick APIs. The existing Ossuary measured 28 meshes / 19,304 triangles; Reliquary measured 41 meshes / 21,552 triangles after its semantic compaction pass. These counts are well below the 100k triangle and 128 mesh smoke limits.

## Visual pass and correction

The first actual game capture, rather than an isolated beauty render, revealed the failure mode: the proximal skull ornaments occupied the sight line and read as flat toy masks. The camera evidence is `weapon-game-0.png` through `weapon-game-3.png`.

The correction was `refine-code` because the reference decomposition already called for the skull, ribs, rails, sockets and materials. The code changes were bounded: Ossuary's rear death mask moved to `(-0.105, 0.055, 0.252)`, scale `0.58`, Y rotation `0.38`; Breach's skull stock moved to `(-0.12, 0.055, 0.31)`, scale `0.62`, Y rotation `-0.34`; Arc's skull became a `0.52` scale offset emblem and its receiver hole increased from radii `(0.055, 0.08)` to `(0.13, 0.15)` with an emissive plasma bead; Reliquary's skull became a `0.58` scale offset ornament, while its muzzle collar and claws were compacted to keep the rib cage readable.

## Gate results

- Reference admission: conditional. Concept art provides a usable object view but does not prove hidden-side geometry.
- Multi-angle: qualitatively reviewed from isolated and gameplay views; formal multi-angle forge gate remains incomplete. Isolated front/three-quarter shots and gameplay shots are present; both models retain volume and repeated attached parts from more than one angle.
- Action-ready: structurally checked by direct factory inspection; formal `check_part_coverage.py` remains incomplete. Named parts, sockets, colliders, `explode` and `pick` are present in every factory.
- Material: passed as a procedural approximation. Albedo, roughness and bump maps are separate generated channels; emissive energy and muzzle materials are independent.
- Screenshot feedback: recorded in the comparison sheets, but global pixel similarity is advisory because the reference is a studio concept render and the render is an in-game camera. The current visual band is approximately 0.65–0.75 for Breach and 0.6–0.7 for Arc, with remaining lighting/framing mismatch.

## Remaining limitations

The gameplay renderer is still darker than the concept sheets, especially on the Arc chamber; the generated concept has materially richer micro-surface detail than the procedural browser texture. I am recording that limitation instead of calling the weapons exact or AAA-matched. The parent renderer pass can improve exposure, rim light and weapon framing without changing the factory sockets.

## Build 10 visual quality handoff

The production renderer now uses an articulated, weapon-specific viewmodel arm contract (`assets/survivor/viewmodel-arms.js`) with explicit wrist, elbow, hand, finger, cuff and grip-socket geometry. A layer-1 hemisphere fill is scoped to the viewmodel so the dark red/blue world grade is unchanged while metal, bone, brass, gloves and forearms retain readable separation. Arc rail tracers use a fixed 64-instance pool of direction-aligned cyan discharge rings; no per-shot geometry or material allocations are introduced.

The local references used for the quality loop are `assets/concepts/arc-concept-v1.png`, `assets/concepts/breach-concept-v1.png`, and `assets/concepts/reliquary-concept-v1.png`, with the Ossuary runtime turntable/game capture as its reference because no isolated Ossuary concept is present. Built-in image generation was attempted for a supplemental reference but was rate-limited; no remote asset or credential was added. GPT-5.6 Sol independently reviewed the brief and accepted the following checks: silhouette/massing, grip contact and wrist load path, roughness/metal/bone separation, muzzle/VFX origin and decay, and identical four-weapon exposure/framing. Its highest-payoff recommendation (a rig-only readability treatment) is implemented above.

Browser evidence from the current `dist` build is in `docs/build10/alignment-browser.json`, `docs/build10/build10-game-results.json`, and the `docs/build10/*.png` captures. The alignment gate reports `[1,2,2,2]` articulated arm palms, sub-pixel muzzle/crosshair alignment across pitch samples, impact marks, one live rocket, zero page/console/request errors, and 60 FPS during the 30-second desktop sample. Mobile active play and touch controls are captured as well. Formal forge validation still passes for the existing Ossuary and Reliquary specs; the older Arc/Breach specs remain legacy shallow documents and are not represented as strict passes here.
## Build 10.1 visual correction loop

The follow-up GPT-5.6 Sol review flagged two remaining risks: close-camera micro-detail must reinforce silhouette rather than become uniform noise, and blood must vary in footprint, direction, density, lifetime and depth instead of behaving like a repeated radial sticker. The response is `weapon-detail-pass.js`, which adds protected, merged micro-detail groups per weapon (machined plates, hex fasteners, capacitor cells, braided conduits and nested apertures), and the `ImpactVFX` flesh branch, which adds a seed-rotated shader mask plus pooled ballistic droplets. Detail meshes are merged by material after authoring, preserving the frame budget; the original marks/smoke telemetry contract remains stable.

GPT-5.6 Sol's second acceptance pass considered silhouette/readability, material separation and lighting improved, while keeping hands/pose and blood variation as the shipping checks. The refreshed isolated review visibly shows the added Arc capacitor/cable assembly and the Breach/launcher machined layers. The current game smoke evidence remains error-free with 60.06 FPS average (60 FPS minimum sample), while the targeted VFX, arm and batching tests remain 11/11 passing.
