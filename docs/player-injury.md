# Zombie grabs and player injuries

The implementation adds close-contact neck grabs with an escape window, persistent wounds, survivable limb loss, and neck/limb/torso fatalities. The existing bodycam, dungeon, weapon, creature-motion and audio work is preserved.

## Player behavior

- A close zombie warns before latching. Dash, jump or parry can evade the reach; walls cancel it.
- During the grab, keep moving, fire at the attacker, or press **F twice**, allowing the parry cooldown between presses. Killing the attacker also releases the player.
- The initial latch gives 1.25 seconds before bite damage. Failed struggles escalate through injuries and health loss. A rare late grab can sever a support limb while leaving gunfire and escape controls usable.
- Leg wounds modestly reduce movement. Wounds persist until restart or co-op revival.
- Fatalities show a brief camera fall before the death screen. Torso fatalities release three pooled organ strands. The gore setting hides blood, severed surfaces, detached anatomy and organs; reduced motion limits camera roll and shake.
- The host owns injury progression in co-op; client prediction cannot inflict bite damage or independently escape a grab.

## Completion fixes

The saved browser report failed because a 12 ms fixture timer raced with live fixed-step combat: combat could release the artificial grab just before the HUD sampled it. Staged captures now freeze simulation in `ready` mode while retaining the normal rendering/HUD loop. The real encounter tests continue to use authoritative simulation and actual keyboard input.

The HUD also hid on actual `dead` mode during the 1.6-second fatal presentation. It now remains visible during that beat and hides when the finish screen takes over. The first fatal frame forces a HUD update, avoiding a throttle race when rendering takes longer. The browser test records the actual fatal HUD frame and checks visibility through its ancestors, real world-space camera coordinates, natural torso death, and the restart button.

The final art review found that collision damping arrested the torso while it was still upright. Fatal fragments now finish a bounded forward fall within the death beat; floor clearance uses their rotated bounds, including the bounds' offset from the sampled skin centroid. Survivable severing retains its independent motion. Local wound spray retains the atlas shader and receives a light-response cap to prevent the body lamp from turning blood white.

## Verification

- Build and 49 engine, AI, bite and injury-geometry checks pass, including horizontal torso settlement and rotated floor clearance.
- Offline Web Audio checks pass: all injury samples decode; layered cues stay bounded; mute/group volume/pause work; release leaves no tail. Injury plus automatic fire peaks at 0.764 (−2.34 dBFS at full volume).
- WebRTC two-context transport regression passes (1 ms host RTT).
- Production integration in `output/playwright/player-injury/report.json` passes: full-health escape through two real F presses; authoritative torso fatality and fatal HUD; death/restart cleanup; gore toggle; portrait fit; pause/resume/menu return; 120 seconds and 11 actual-input cycles; zero browser/HTTP/WebGL errors. Final visual refinements are checked separately below.
- Final production build repeats all paths successfully in `output/playwright/player-injury-final/report.json`, including another 120-second run with explicit pointer capture, verified mouse-triggered shots and player travel, and zero browser/network/WebGL errors. Direct WebGL pixel samples pass at 1280×720 (209 color buckets) and 390×844 (115 buckets); settled corpse and portrait screenshots were inspected. Both torso and previously severed support limb now lie on the floor, and wound spray retains dark red shading under the body lamp. Pixel evidence: `output/playwright/player-injury-final/pixel-report.json`.

## Independent quality review

A separate read-only visual agent reviewed desktop and portrait captures through three corrective passes. Its reviews exposed defects that functional checks alone missed: idle-looking arms, an upright non-gore body, a misplaced trial mouth overlay, clipped crown highlights, prompt/health overlap, face occlusion, and an arched intact corpse.

The contact pose now uses two-bone arm reach in world metres, keeping the imported rig's segment lengths and restoring its original transforms before normal animation. Real combat capture confirms both hands and approximately 0.49 m head contact distance. The scanned face is retained; the trial mouth overlay was removed. Close lamp specular response is bounded so crown texture survives. Desktop instructions sit beside the face; portrait instructions occupy the upper gap and say **TAP PARRY**.

Gore-off fatalities use a baked whole-body side fall, including the original jacket surface before its first-person bend. Arms and legs relax before the pose is baked; the live skeleton's rotations are restored afterward. Gore-on torsos use a bounded irregular tear, dark cavity, and three dark organ strands that follow the early fall before spilling. Fall orientation and floor settlement use presentation time, so a stalled frame cannot leave the corpse suspended. Physics integration remains bounded.

The reviewed production journey in `output/playwright/player-injury-quality-final/report.json` passes with zero browser/network/WebGL errors: real two-parry escape, captured natural held pose, authoritative torso death, fatal HUD, restart, both gore settings, portrait fit, pause/resume/menu, and 120 seconds of controls. It records 14 shots, 0.769 cells of travel and a final crowded headless sample of 40.9 FPS. Direct pixels contain 198 desktop and 112 portrait color buckets. The exact final build repeats the full journey plus 15 seconds of controls in `output/playwright/player-injury-quality-reviewed/report.json`, including the relaxed side corpse and forced fatal-HUD transition; all 13 views pass with zero browser errors.

The independent agent's final verdict is **visual pass for coherent gameplay presentation**, with no blocking defect in its five inspected final views: `gore-off-clear`, `gore-off`, `natural-held`, `portrait-held`, and `terminal-body-clear`. It confirms resolution of the stiff corpse pose, prompt clearance, crown shading and dark gore. Its bounded scope and remaining asset limitations are recorded below and in the adjacent `visual-review.json` evidence.

The build and 54 engine/AI/bite/injury/motion checks pass, including contact at different import scales, restoration, gore-off whole-body floor contact and a four-second skipped-frame fall regression. Audio and WebRTC evidence above remains applicable; this review did not alter those systems.

Commands (set `PLAYWRIGHT_PATH` and `CHROME_PATH` when packages/executables are not discoverable locally):

```powershell
npm.cmd run build
node --test --test-isolation=none engine.test.mjs enemy-ai.test.mjs tests/player-bite.test.mjs tests/player-injury-visuals.test.mjs
node tests/bite-audio.test.mjs
node tests/player-injury-browser.mjs
node tests/network.test.mjs
```

The browser test serves `dist` on an ephemeral port in a separate headless Chrome. The existing source server at `http://127.0.0.1:5200/` belongs to this repository; it and the user's tab are preserved.

## Reference ledger

All listed references were read successfully; none were skipped or failed:

- Debug profiler: `references/debug-profile-checklists.md` and `references/checklists/scene-debugging.md` — state ordering, camera, assets, render loop and errors.
- QA release: `references/qa-release-checklists.md` plus `references/checklists/{visual-verification,playtest-qa,release}.md` — production build, controls, failure/retry, responsive fit, screenshots and diagnostics.
- Game UI designer: `references/checklists/{game-ui-quality,hud-readability,responsive-ui-fit}.md` — fatal prompt visibility and portrait fit.
- Graphics builder: `references/checklists/{procedural-model-quality,material-lighting-quality,performance-safe-visual-detail}.md` — anatomical silhouette, light response, bounded pools and camera clearance.
- Debug profiler: `references/checklists/performance-profile.md` — draw/triangle/texture evidence and limits of a headless sample.
- Procedural animation: `references/procedural-motion-and-docking-systems.md` — world/local pose ownership, reach, restoration and continuous fall presentation.
- Procedural geometry: `references/profile-sweeps-and-mesh-writers.md` — bounded organic sweeps, tear rim and cavity construction.

## Art and QA limits

Detached anatomy reuses partitions of the bundled survivor's skinned mesh. The torso opening improves cut readability, but these remain stylized game effects rather than an anatomical simulation or a premium authored gore asset. Organ strands remain visibly procedural. The scanned zombie has no usable facial jaw rig; its close struggle is readable, but screenshots do not certify an anatomically convincing open-mouth bite or animation timing. Portrait rendering checks do not certify gameplay on a physical phone. No new paid asset jobs, publication, or deployment are part of this pass.

The control smoke does not certify campaign completion. Headless FPS samples vary with crowd and machine load; this is functional/visual verification and does not certify a frame-rate target.

## Current checkout integration continuation

Continued against the newer map v5, spawn-warning and cabinet-texture baseline. Five remaining lifecycle defects are corrected: same-run floor/sector changes clear detached injury debris; guest starts clear the previous fatal presentation deadline; host snapshots collect cues before sending and flush terminal state immediately; released/idle snapshots with fresh local bite damage do not duplicate the generic damage sound; downed guests cannot predict shot/parry sounds until revival. Ordinary damage and the other player's injury cues retain their previous behavior.

Build and 79 combined CPU checks pass, including five new entrypoint lifecycle checks and a scene-geometry floor-reset regression. The updated production browser journey in `output/playwright/player-injury-current-integration/report.json` passes all 13 views, natural escape/torso death, two guest terminal rounds separated by starts, canonical cue deduplication, gore settings, portrait fit and pause/resume/menu. Its 120-second input run records 12 cycles, 14 shots and 0.669 cells of travel with zero browser/HTTP/WebGL errors. Direct pixels contain 217 desktop and 106 portrait color buckets. The crowded final headless sample is 30 FPS; it is not a performance certification.

Inspected `natural-held`, `portrait-held`, `terminal-body-clear` and `gore-off-clear`; their existing presentation remains coherent with the current environment. The installed web-game client with the existing Windows overrides completes two additional control bursts and screenshot/state checks in `output/playwright/player-injury-current-controls`. Two-context local WebRTC transport passes with 1 ms host RTT; the entrypoint timing regressions use the real frame/snapshot functions with an isolated transport harness rather than public PeerJS signaling.

The additional audio check exposed a probe-fixture error: the authored cue waveform contributed to the constant foley measurement. The probe now disconnects the authored master output while retaining the direct foley bus, and verifies gain before, during and after ducking (1 → 0.62 → 1). Runtime audio tuning is preserved. All audio checks pass; injury plus automatic fire remains at 0.764 peak, −2.34 dBFS at full volume.

Reproduce the added lifecycle coverage with `node --test --test-isolation=none tests/main-injury-lifecycle.test.mjs tests/player-injury-visuals.test.mjs`. The existing source server, PID 26316, still belongs to this repository and serves the source checkout on port 5200. Its process and the user's game tab were preserved. No paid generation, commits or deployment were required.

## Gore direction v2: authored anatomy and force-specific injury

The requested direction is grounded bodycam horror with sustained, fast combat and occasional severe injuries that have visible consequences. Invincible is a reference for escalation, weight and reaction; our creatures, assets and combat remain original. This is a production plan plus an isolated anatomy proof, not certification that the current game has reached professional visual quality.

### Research that changes the implementation

Valve's first-party [Rendering Wounds in Left 4 Dead 2](https://cdn.akamai.steamstatic.com/apps/valve/2010/gdc2010_vlachos_l4d2wounds.pdf) demonstrates separate wound geometry, pose-space skin removal and blood around the cut edge. A wound model fills the opening; shadows must obey the same removal. It avoids preparing every combination of damaged body meshes. Our proposed adaptation is an authored wound insert attached to the skeleton, a bounded mask in the body's material, and matching depth/shadow masks. Two active wound sites per actor is an initial budget to measure, not a certified browser performance limit. Valve's historical instruction/memory figures do not predict this game's cost.

Invincible's directors discuss keeping severe violence deliberate and avoiding desensitization in Skybound's [season-two finale production interview](https://www.skybound.com/article/behind-the-scenes-of-invincibles-season-2-finale). Our design inference is to give cuts, tears and crushing different animations and outcomes, and reserve the most severe beats for meaningful combat events. No fan-consensus claim or reproduction of a particular scene is needed.

The show's sound editor describes contact-specific friction, tension, cracks, tearing and viscous impacts in [Inside Sound Design: Cutting Gore on Invincible](https://www.boomboxpost.com/blog/2026/06/23/inside-sound-design-cutting-gore-on-invincible). Translate that technique into a small timed sequence: pressure/contact, tension, rupture, then the body or organ landing. Avoid stacking the complete sequence on every bullet. Our existing audio bus and voice limits are the starting point; current injury plus fire peaks at 0.764, −2.34 dBFS. New cues require another headroom and audibility check in actual combat, with controlled music/foley ducking rather than a global loudness increase.

Blender's [baking documentation](https://docs.blender.org/manual/en/latest/render/cycles/baking.html) distinguishes color-only diffuse baking from lighting and supports normal baking for detailed surfaces. Its [Bisect tool](https://docs.blender.org/manual/en/2.80/modeling/meshes/editing/subdividing/bisect.html) can cut and fill a mesh; a filled plane is only a topology operation. Our inference is that skin, fat, muscle, bone and cavity must be authored separately for a convincing cross-section. Generated color artwork cannot replace that construction or calibrated normal/roughness data.

### Current quality baseline

The read-only audit inspected current bite, corpse, gore-off, portrait and map captures. Bone-dominant mesh partitioning leaves unfinished anatomical cuts; organs repeat constant-radius tube shapes; the scanned zombie lacks a jaw/finger rig. A separate torso opening is not body bisection, and the current engine has no live abdominal rupture or head-crush state. Blood atlas v2 is useful for distant residue, but its painted highlights cannot certify close-up material realism.

The stricter professional-art score is **1.4/3** across art direction, player, enemies, interactables, world, materials, lighting, VFX, UI and performance evidence. This supersedes no functional result: prior PASS meant coherent, readable gameplay, not premium anatomy. Crowded headless captures near 30 FPS, around 688 draws and 590k GPU triangles leave no justification for unbounded new skin/material copies. Functional QA and an attractive offline image are separate from the art gate.

Visual scorecard (current active-play baseline; source-only study changes no gameplay score):

- Art direction: before 2 / after 2 — coherent bodycam/dungeon identity in current integration views.
- Hero/player: before 1 / after 1 — unfinished bone-partition cuts and repetitive organ sweeps.
- Obstacles/enemies: before 1 / after 1 — repeated scanned silhouette; closed mouth cannot show a convincing bite.
- Rewards/interactables: before 1 / after 1 — provisional limited evidence in the inspected combat views.
- World/environment: before 2 / after 2 — authored dungeon landmarks and route layers retained.
- Materials/textures: before 1 / after 1 — albedo-only character materials and painted blood lighting limits.
- Lighting/render: before 1 / after 1 — dark injury views obscure the cavity and close tissue separation.
- VFX/motion: before 1 / after 1 — generic organ motion; stills do not certify bite timing.
- UI/HUD: before 2 / after 2 — readable injury state in desktop/portrait evidence.
- Performance evidence: before 2 / after 2 — renderer counts and real-input browser QA, without a frame-rate guarantee.

Average: before **1.4/3**, after **1.4/3**. Automatic failures remaining: obvious procedural anatomy, repeated enemy silhouette and darkness obscuring missing/weak internal detail. The next pass is authored matched cuts and tissue motion, with jaw/contact animation, followed by a new active-play audit. This is deliberately a stricter scope than the previous readability review.

### Mechanics and order of integration

| Outcome | Required authored visual | Gameplay rule and acceptance evidence |
| --- | --- | --- |
| Arm or leg cut | Matched body stump and detached cap, clothing tear, exposed layers; side-specific attachment | Hit region plus force determines a cut. A severed support limb retains the current firing/escape controls. Zombie response changes by missing region. Verify both sides across every relevant clip. |
| Abdominal rupture | Recessed cavity, irregular bowel bundle, mesenteric attachments, actual tissue maps | A live spill keeps a tether and permits fighting out of the grab. Tune bleeding/movement consequences independently of gore visibility. Verify standing, locomotion, knockdown, floor contact and recovery. Current runtime only spills on a fatal torso injury. |
| Bisection | Separate upper/lower body with matching anatomical cross-sections and clothing boundary | A sufficiently powerful cut has a specific fatal outcome, instead of scattering every region. Zombies have a bounded fall/crawl variant if designed; player bisection is fatal. Verify floor, camera and restart. |
| Head crush | Authored compression/broken-head variant, jaw and hand contact, contained fragments | A rare close finisher or late failed struggle, with a readable wind-up. Do not trigger a long camera sequence for ordinary kills. Player crushing is fatal. Verify silhouette, contact and timing from the player's actual view. |

Build arm-cut integration first because matched surfaces test the entire wound pipeline with limited geometry. The abdominal study below establishes the next asset direction. Then add live rupture and only afterward bisection/head crushing. Each phase needs a complete playable slice before another asset family. Preserve the current 1.25-second initial escape window, host authority, attacker-kill rescue and two-parry escape unless a separately tested balance change is intentional. A visual gore setting must not change combat balance; the current enemy dismember path couples some speed penalties to that flag and requires correction in the first integration phase.

### Runtime architecture and quality gate

Record anatomical region, side, wound variant and a monotonic injury sequence in host-owned actor state. The renderer derives local cosmetic debris and one-shot audio from that state; it must not decide damage or release a grab. Reuse existing player/enemy snapshot records and keep debris out of authoritative simulation unless it affects collision. Current `run.limbs` is not a networked anatomical system.

Use skeleton-attached near wound meshes and pooled static detached fragments. Ordinary Three.js [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) is not a drop-in solution for individually animated skeletons; [SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html) has different skin/bone requirements. Instanced crowd skinning is a separate measured optimization. Start with two wound sites, shared maps and explicit fragment/voice caps, then compare the same crowd, camera and lighting against the saved baseline.

Review authored assets under neutral, warm, cold and untextured lighting. Reject obvious tubes/rings, stretched maps, unfinished backs, floating organs, uniform gore responses and mouth/weapon intersections. Fit to the actual latest rig at idle, shuffle, chase, attack, recoil and collapse, preserving inverse binds, clip names and import scale. Verify masks and shadows, all gore settings, reduced motion, skipped frames, co-op event order, death, restart, revival and floor changes. Compare frame time, draws, GPU triangles, texture memory and bounded allocations at an identical crowd count. A physical phone and sustained campaign run remain separate certification work.

### Isolated Blender / ImageGen proof

The source-only review at [gore-proof.html](http://127.0.0.1:5200/gore-proof.html) loads `art/gore-proof/ash-witness-abdominal-proof-v1.glb`. It provides packed/floor-reference poses, neutral/warm/cold light, textured/clay surfaces, orbit and front/side/back inspection. The current Ash Witness motion v04 GLB was used read-only for scale and attachment measurements. This study is excluded from the production build.

The offline script is `scripts/gore-anatomy-proof.py`; the editable master and generation input live in `.art-source/gore-proof`. The manifest records topology, dimensions, triangles, UVs, source hashes and remaining limitations. Built-in ImageGen produced a four-quadrant tissue color reference, preserved as `tissue-atlas-imagegen-v1.png`; no new paid model, animation or audio jobs were submitted. It is generated artwork, not real blood photography or a calibrated scan. The initial renders exposed stretched striping and a concentric wound rim; those were rejected for correction.

The morph is an authored floor-placement reference. It does not simulate organ mass, volume, collision or attachment under live animation. The insert requires skin removal to form a genuine cavity in a character. The texture has faint baked highlights and no calibrated normal, roughness or subsurface maps. Integration is withheld until these visible and technical limits pass the corresponding gates. Proof verification and final visual verdict are recorded below after review.

The revised proof has **14,492 triangles, three materials, one 1024² atlas and nine browser draws**, with a 2,738,404-byte GLB. The export uses three texture declarations referring to one image/sampler; the browser confirms one shared texture. It is an art study budget, not the shipping wound budget. Before rollout, target a simplified close wound under 8k added triangles, at most three draws through sensible merging, and lower-resolution far variants, then measure actual benefits. Twelve copies of the current study alone would add about 174k triangles and 108 draws; it is unsuitable for indiscriminate crowd attachment.

### Research / skill execution ledger

Applied game director, graphics builder, gameplay, game UI, debug profiler and QA release skills; built-in ImageGen overrides the optional Gemini-provider path because the user requested ImageGen. Graphics references read: visual scorecard, implementation blueprint, model/render recipes and AAA visual, material/lighting and performance-safe-detail checklists. UI quality/readability/responsive checklists and QA visual/checklist references were read for the review viewer. The research agent read gameplay workflows, physics selection and 3D integration references; the asset worker read procedural geometry profile sweeps and procedural-model-quality. Direct Blender current-English pages intermittently returned 402; official indexed excerpts and accessible versioned documentation supplied the bounded claims above. Valve's PDF text was read; some requested PDF screenshots failed, so no unseen diagram is claimed as evidence.

API probes showed empty `TRIPO_API_KEY`, `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` in the probed Git Bash profile, with no secret values printed. This is a local-profile finding, not a claim that those services are unavailable everywhere. Blender and built-in ImageGen completed the bounded proof without those providers. No production game mechanics, map, spawns or existing character assets were replaced by this research phase.

Literal probe output:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

Asset sourcing ledger:

| Surface | Decision | Output / evidence |
| --- | --- | --- |
| Existing zombie and survivor | Reuse bundled external models as read-only fit references | `assets/models/afterlife-ash-witness-motion-v04.glb`; `assets/survivor/tld-survivor-v02.glb`. A new creature job is unnecessary for this isolated wound study. |
| Tissue color | Built-in ImageGen | `.art-source/gore-proof/tissue-atlas-imagegen-v1.png`; summarized brief/provenance in `imagegen-provenance.json`. |
| Wound, bowel, membrane | Hybrid ImageGen + offline Blender | `scripts/gore-anatomy-proof.py` → editable `.blend` → candidate GLB/manifest. Generator skills were read; local provider probes are empty. This is a study, not an accepted procedural-only hero replacement. |
| Main dungeon/props/blood residue | Preserve current assets | No new high-value world surface is part of this research phase. Existing map v5 and projected wood remain the gameplay baseline. |

### Proof verification and independent disposition

`node --test --test-isolation=none tests/gore-proof-assets.test.mjs` passes four checks: exported drawable geometry/normals/budget, actual morph positions/normals and endpoints, atlas/source provenance and topology diagnostics, and exclusion from the production build. `npm.cmd run build` passes; the resulting `dist` contains neither the viewer nor `art/gore-proof`.

The final separate-headless-Chrome run in `output/playwright/gore-proof-browser/report.json` passes ten desktop/portrait views, real lighting/pose/surface/view clicks, exported morph settling, real pointer orbit, visible canvas pixels and caption/layout clearance, with zero browser/HTTP errors. It measures nine draws, 14,492 triangles, three materials and one shared texture. The first run's missing-favicon failure is retained as historical evidence; the viewer now supplies an inline icon. These checks do not prove organ physics or gameplay realism.

Independent review identifies improved cavity thickness, differentiated tissue roles and nonidentical organ paths, but rejects professional realism. Main blockers are rope-like clean loops, flat geometric membranes and straight vessels, a cord-like spill endpoint, painted material response, and unverified moving-body cavity/attachment. Caption overlap was corrected by placing text outside the canvas; a Cavity close view makes the narrow spill inspectable. The art verdict remains **BELOW_PROFESSIONAL_REALISM / NOT_FOR_RUNTIME**. Exact reviewed screenshots and findings live in `output/playwright/gore-proof-browser/visual-review.json`.

The next concrete asset pass is a sculpted irregular packed bowel mass with contact flattening and folded thin membranes, followed by a weighted offset spill pose and role-specific normal/roughness detail. It should be judged in clay before additional texture work and fitted to a cut character across actual clips before runtime adoption. The current proof and existing game baseline remain reviewable; no asset purchase, commit or deployment was required.

Reproduce the isolated proof and viewer checks:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --factory-startup --python scripts/gore-anatomy-proof.py
node --test --test-isolation=none tests/gore-proof-assets.test.mjs
$env:PLAYWRIGHT_PATH='C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CHROME_PATH='C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
node tests/gore-proof-browser.mjs
```

## Jaw and support rig v05

This pass extends the existing Ash Witness skeleton rather than regenerating the character. Original body animation remains authoritative. New support controls use `node.extras.articulation` with `role`, local `axis`, `maxAngleRadians` and `sign`; grips infer left/right from their bone names. `character-articulation.js` owns these new joints exclusively. It restores the prior underlying pose before the mixer, applies an absolute quaternion offset after body animation, then replaces that overlay with the relevant local/peer player's canonical bite pose after neck and wrist reach.

The asset adds **Jaw**, **Tongue**, **LeftGrip** and **RightGrip** to the existing 24 joints. Jaw weights deform the scanned chin/lower lip, with a real cut in the mouth seam and a weighted oral cavity, gums, 20 upper/lower teeth and tongue. Hands in this scan have fused finger silhouettes: grip joints curl weighted groups; they are not independent finger chains. Original arm/neck/spine chains already support reaching and body posing. Six nondeforming nodes — `Socket_Head`, `Socket_Neck`, `Socket_Chest`, `Socket_Abdomen`, `Socket_LeftWrist`, `Socket_RightWrist` — provide named locations for later wound assets. They inherit the original rig scale; attachments must account for it.

Preserve original joint order, rest transforms, inverse binds, all six animation channels, animation extras and packed texture bytes. Blender's [vertex-weight documentation](https://docs.blender.org/manual/id/5.0/modeling/meshes/properties/vertex_groups/vertex_weights.html) explains bone influence through groups and normalized weights; actual export tests enforce normalized four-influence weights here. A binary merge/packing step avoids losing the v04 WebP material or contact/fall metadata through Blender 2.93 interchange. Original v04 remains read-only and available for comparison.

Normal attacks use restrained jaw/grip poses. Bite preparation opens before the existing 1.25-second damage beat and subsequent 0.9-second intervals, then closes into contact. Combat peaks at normalized 0.66 (0.383 radians / approximately 22 degrees) to reduce stretching in the coarse scanned cheeks; the bench retains the full authoring range. An interrupted windup releases from the pose actually reached, blending into the underlying recovery pose. Terminal simulation time is frozen at zero, so final hand relaxation has a separate presentation age keyed by attacker and sequence. Held poses use simulation time and freeze when that clock pauses. Reduced motion bounds the added jaw range to 0.42; gore visibility does not change these articulation rules.

Oral additions share two new material roles, merged into two added primitive groups. Actor instances cache one material clone per shared source material; oral surfaces preserve their authored roughness while using the existing close-lamp response cap. There is no per-contact mesh, texture or shader allocation. The source-only `rig-review.html` bench compares original/rigged, jaw/grip, six clips and head/hand/body views through the actual game model wrapper. It is excluded from the normal build.

Authoring source/master/candidates live in `scripts/rig-zombie-v05.py`, `.art-source/character-rig-v05` and `art/character-rig-v05`. The first visual pass rejected lower-lip spikes, upper-tooth occlusion and a misplaced hand camera despite passing rig-preservation checks. The corrected GLB is installed separately as `assets/models/afterlife-ash-witness-rig-v05.glb`; the original v04 is retained. Final evidence is recorded below. This rig work does not certify full facial expressions, independent fingers, skull-crush topology, live organ collision or professional-quality gore.

The old foreground weapon crossed the attacker's face during close grabs. An envelope-controlled hip tuck keeps the weapon and viewmodel arms together, with stronger translation/pitch for long weapons and the saw, a compact-gun profile, and width adjustment for portrait. Recovery rejoins the normal handling pose. This changes presentation only; authoritative aim, firing, rescue shots and parry remain unchanged. All eight weapons are inspected in the game rather than assuming the pistol represents their different silhouettes.

The larger candidate exposed a Chrome loading anomaly in the bundled Three `FileLoader` progress-stream wrapper. DevTools recorded every one of the 3,689,188 bytes, no explicit abort, and a usable parsed mesh, yet reported `net::ERR_ABORTED`; a direct buffered fetch of the same file completed normally. `loadAfterlifeModel` now fully consumes the response, validates GLB magic/version/declared length, and calls the loader's `parseAsync`, retaining headers, credentials, resource path, manager accounting and abort signal. HTTP and truncated-file failures are tested. No vendor code or server configuration was changed, and final rig-viewer requests complete without ignoring request failures.

| Asset budget | v04 source | v05 support rig |
| --- | ---: | ---: |
| Triangles | 27,512 | 31,905 |
| Skin joints | 24 | 28 |
| Character draws / materials (without shadows or warning ring) | 1 | 3 |
| Packed images | 1 | 1, exact original WebP |
| GLB bytes | 2,681,432 | 3,689,188 |

This adds 4,393 triangles, two character draws and 1,007,756 download bytes per template. Geometry/textures remain shared across actor clones, while skeletal palettes and owned material state are per actor. The draw increase can also affect shadow rendering; these budgets are not a crowd-instancing or frame-rate guarantee. Compact packing removed 2,274,900 obsolete buffer bytes without changing reachable animation/image data.

### Rig verification

The final engine/AI/map-v5/spawn/bite/motion/rig/injury/lifecycle regression command passes **82 distinct checks**. The production build includes the new controller/GLB and excludes the source bench and `art` archive. Candidate and installed GLBs match exactly: SHA256 `26556b4da1694df57995311a796a557622da6d81b6a1ca7f39edd65a79c7426e`.

Final viewer QA in `output/playwright/character-rig-v05/browser/report.json` passes **16 desktop/portrait views with zero errors**, real pose/asset/clip/slider/orbit controls, playback pause, a completed collapse and the bounded combat opening. Sampling actual exported skinned vertices measures 7.82 cm maximum jaw displacement and 3.54 cm left grip displacement. These measurements prove deformation, not dental contact or biomechanical realism. The completed collapse view also caught and fixed stale head-camera framing when returning to rest.

The final production journey in `output/playwright/character-rig-v05/game/report.json` passes **31 views with zero browser/HTTP/WebGL errors**: natural two-parry escape without damage, real held and pre-contact jaw poses, torso fatality, grip relaxation with frozen terminal time, restart, guest fatal-round/cue deduplication, eight desktop and eight portrait weapon silhouettes, gore toggles, reduced motion and pause/resume/menu. Two actual actor instances use distinct canonical victim clocks (local jaw 0.18 / peer 0.6571). The final 120 seconds of real inputs records 11 cycles, 12 shots and 0.548 cells of travel. The sampled 32.62 FPS varies from earlier runs and is an observation, not performance-target certification.

One earlier natural capture paused the simulation at latch before the first held step could update AI facing, showing the back of the head. The test now allows a real held step before freezing and additionally inspects the natural preparation beat. The animation driver follows the engine's locked grapple `aimAngle` during windup and held progress zero, then resumes held AI facing; it never changes engine state. A regression starts with opposite stale AI facing and covers windup/latch/recovery. Final anatomical Jaw forward/victim horizontal dots are 0.9883 held and 0.9814 preparation; head-to-camera distance is approximately 0.35 m. This verifies facing and bounded reach, not tooth-to-neck collision. Historical evidence remains in `game-paused-at-latch`.

Earlier trials and the rejected common weapon tuck are retained as `game-initial`, `game-first-tuck` and `game-clearance`. The installed web-game client completes two separate source-game control/capture bursts, with both state screenshots and floor inspection viewed and no error files. Independent `independent-review.json` approves **bounded runtime articulation** after 12 independent CPU checks and the saved game views. Remaining art limits include a rectangular cavity at wide opening, a simple tongue surface, coarse cheeks, fused thumb/finger silhouettes, small outer-mouth/weapon/HUD overlaps and unproven physical finger/teeth contact. Professional anatomical realism and whole-game premium quality remain uncertified. The summary ledger is `output/playwright/character-rig-v05/verification.json`.

The current source server is still PID 26316 at port 5200 in this checkout. No user game tab was navigated or reloaded; the rig appears on the next user reload. No new paid jobs, commits or deployment were needed.

Reproduce the rig checks and source bench:

```powershell
node --test --test-isolation=none tests/character-articulation.test.mjs tests/character-asset-load.test.mjs tests/character-rig-v05.test.mjs tests/afterlife-motion-v04.test.mjs
node build.mjs
$env:PLAYWRIGHT_PATH='C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CHROME_PATH='C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
node tests/rig-review-browser.mjs
node tests/player-injury-browser.mjs
```

The source bench is [rig-review.html](http://127.0.0.1:5200/rig-review.html). The editable master is `.art-source/character-rig-v05/Ash_Witness_Rig_v05.blend`; rebuilding is an authoring operation followed by fresh acceptance, not a runtime dependency.

Skill/reference ledger for this bounded pass: game director (narrow orchestration), procedural animation plus `procedural-motion-and-docking-systems.md`, 3D generator plus `threejs-integration.md`, graphics model/procedural-model/material-lighting/performance-safe-detail checklists, QA release plus QA/visual/playtest/release checklists, web-game client and responsive UI fit. All required references for those executed phases were loaded. Source decision: reuse the already bundled external character, author the missing rig/interior offline in Blender, retain original textures. No new external model, image, audio or animation job is required for the rig extension. UI scope is the source-only bench; damage, progression, map and spawn systems are unchanged.

## 2026-09-30 — brutal close counters

The current v05 zombie rig now supports three force-specific player counters. The direction is exaggerated fictional horror combat: an open-hand arm chop, a neck-twist execution, and pulling abdominal tissue free while escaping a bite. These extend the existing player injury system; the map v5 routes, encounter warnings, weapons, six imported character clips and oral controls remain in place.

| Input / opening | Result | Contact / total time | Damage / cost |
| --- | --- | --- | --- |
| F / RB within 1.08 m of an intact ordinary zombie | Arm chop; remove one actual posed arm and leave a matching stump | 0.18 / 0.65 s | 8 damage / 10 energy |
| F / RB on a staggered zombie with health at or below min(12, 40% max health) | Twist and detach the head; finish that weakened target | 0.24 / 0.90 s | 12 damage / 10 energy |
| F / RB, then another press after parry cooldown while held in a bite | First press adds free escape progress; second releases immediately, then commits the optional torso pull | 0.22 / 1.00 s after the second press | 12 damage / 10 energy for the counter |

Ordinary punches, projectile parries, movement escape and rescue gunfire remain available. Missing energy or a severed player arm never blocks the free bite escape. Dedicated counters require both arms and only target the Ash Witness kind-0 rig; casters, brutes, anchors and bosses retain their ordinary combat responses. A target receives one authored counter wound. Two players cannot reserve the same target. The HUD exposes the opening through the existing close-contact panel and follows the active keyboard/controller device. Extraction prompts wait until recovery has ended. The user's platform scope is PC and controller; no new mobile implementation or mobile acceptance is required.

Movement remains live and incoming damage remains effective during all three actions. Weapon firing, delayed rifle mechanisms and extraction stop while the hands perform the counter. Range, aim, wall obstruction, a missing target, death or losing an arm cancels before contact without damage. Damage applies once on the authoritative world clock; guest prediction cannot advance it. The contact tolerance is 1.24 m. One global per-player sequence survives co-op revival and resets on a new run.

`brutalWound` carries type, side, region, player ID, sequence and contact time. It drives persistent body masking, a wound insert, exact captured skin fragments, presentation and co-op sound. An arm wound reduces movement modestly; a twisted neck kills; a torso tear sets the existing wound flag. Generic kill randomization does not add unrelated severed parts to a counter. Gore-off hides the cut, tissue, fragments and spray while retaining the same simulation wounds, penalties, damage and escape rules. This also fixes an older gore setting dependency in ordinary wound penalties.

### Presentation and ownership

`brutal-combat-visuals.js` restores its pose layer before the next animation update, then runs after the ordinary mixer, survivor animation, bite reach and final oral articulation. It uses world-space two-bone reach on the imported survivor arms, with wrist targets below the scanned palm/finger silhouette. The existing weapon is tucked away for the short hand action. Torso framing looks downward and clears the local jacket; it restores the normal view/body on recovery. Remote counters pose their own survivor arm chains.

A measured bug caused alternating front/back poses: restoring a pure-yaw quaternion can yield an equivalent XYZ Euler representation with X/Z = pi. Replacing only Euler Y on the following frame reverses the yaw. Counter restoration now preserves the original Euler representation, and `animateAfterlifeModel` writes the entire upright canonical rotation. Body facing is then fitted using the actual chest socket. Independent Three.js math checks reproduce the old negative turn and verify the fix; regression tests cover headings beyond ninety degrees.

Source geometry, materials and textures remain shared until an actor acquires a wound. That actor receives owned cut geometry/material hooks and matching depth/distance masks. Release restores the original geometry, material hooks and shadow materials. Detached skin captures actual posed world positions, source UVs, source vertex colors and transformed authored normals, preserving the imported surface rather than regenerating smoothing at the cut. Connecting triangles clip at interpolated .5 one-hot region membership, exactly complementary to the live body/shadow mask. This fixes the former duplicate connecting triangles and numeric region interpolation. The cut's posed segment lengths determine a centroid, stored in the original socket's centimetre coordinates; body and detached caps use that same centre and measured planar span. A captured head's geometric centre controls the grip. The fragment pool reuses no original live skeleton.

Wound inserts live in world-metre groups, copying socket position/orientation and compensating for the rig's centimetre parents. Intestines move from the abdominal opening into the hands, then drop back against the wound. The mesh is an authored static bundle, not a softbody simulation. Fluids use four irregular tiles from the existing blood atlas, with bounded diffuse/specular response under the strong body lamp. Generic burst particles still create floor residue, but the new counter spray replaces their duplicate foreground representations.

Budgets: at most **12 selected wounded actors**, **6 detached fragments** and **48 spray instances**. Selection prioritizes living, near actors before allocating, preventing every old corpse from evicting/rebuilding the pool each frame. A 32-actor CPU fixture verifies retained allocation identities, replaced-entry cleanup and floor/restart reset. This is bounded pooling, not instanced skeletal crowds; individual zombie palettes/draws remain.

### Anatomy source and budget

The headless Blender source is `scripts/build-brutal-anatomy.py`; the editable master is `.art-source/brutal-anatomy-v1/Brutal_Anatomy_v1.blend`. Runtime loads only `assets/models/brutal-anatomy-v1.glb`. Authoring candidates and three neutral close-ups are preserved under `art/brutal-anatomy-v1` and excluded from the production build.

The kit contains NeckWound, ArmWound, AbdomenWound and IntestinalBundle: **21,588 triangles**, **4 total primitive groups**, **1 PBR material**, **3 embedded 512 × 256 PNG maps**, and **1,499,816 bytes**. A torso wound uses two groups. Final SHA256: `34554073a2966bfa888551f36d9bb2dd1f708b3d22005fb5a514d62abe42ab7d`. Export checks cover closed topology, winding, degenerate triangles, finite normals/UVs, texture decoding and identical authoring/runtime bytes. A corrective Blender export maps the broad closed backing to dark cavity tissue, retaining gray only on the exterior skin border; three front and two back neutral images were inspected. No bone ordering, inverse binds, original v05 texture or animation arrays are changed.

External sourcing ledger: reuse the bundled, previously acquired Meshy character and survivor; reuse the previously generated tissue atlas; author missing caps/organ geometry and coupled surface maps offline. Reuse the bundled blood decal atlas and licensed audio samples. No new paid provider operation, credit spending or credentials are needed for this slice. The material fields are authored approximations, with some baked illumination in the existing tissue color source.

### Audio

`BRUTAL_COMBAT_CUES` layers two short cloth/whoosh samples at preparation; chop and twist use two impact/tear layers, and rip uses three. Contact sound follows the canonical contact event rather than a render-frame estimate. Cues use the existing injury/SFX bus with bounded voices and small seeded variation. Host forwarding includes start/contact, while player/enemy/sequence dedup prevents repeated snapshots from replaying them. A new run explicitly resets only the counter cue ledger. Listener-side `castRay` selects remote wall occlusion without modifying the shared event.

Independent audio verification passes **30 checks** using **128 decoded bundled samples**, including both listener sides of a real engine wall, pause/mute/master/SFX volume, source priority, restart replay, canonical transport dedup and host/guest routing. The loudest tested fire/counter/ambience fixture peaks at **0.793733**, below the 0.95 acceptance limit. This proves tested mix headroom and runtime routing; it is not a listening-room or all-device loudness certification. Evidence: `output/playwright/brutal-combat/audio.json` and `tests/brutal-audio.test.mjs`.

### Phase and reference ledger

Game director: loaded and used for bounded integration. Gameplay and Blender art were delegated to focused workers; independent QA/audio used a separate read-only reviewer. Root owns runtime presentation, integration and final verification. Gameplay, asset authoring, presentation and audio are implemented; final browser acceptance is tracked by the receipts below. Whole-game premium art, independent finger/dental collision, deformable organs and extra execution types are outside this implemented slice.

Required references loaded for executed phases:

| Phase | Skill / reference path under `C:/Users/wolfk/.codex/skills` | Read / result |
| --- | --- | --- |
| Gameplay | `threejs-gameplay-systems/SKILL.md`, `references/gameplay-workflows.md`, `references/physics-engine-selection.md` | Yes. Existing fixed-step grid/LOS collision retained; fragments are cosmetic. Initial mistaken singular workflow path was corrected. |
| Art source | `threejs-3d-generator/SKILL.md`, `references/threejs-integration.md`; graphics `model-recipes.md` and procedural-model/material-lighting/performance-safe-detail checklists | Yes, including author worker review. Existing external asset reused; original skin/clips preserved. |
| Animation | `threejs-procedural-animation/SKILL.md`, `references/procedural-motion-and-docking-systems.md` | Yes. Restore before mix, world-space reach, canonical contact and release checked. |
| VFX | `threejs-procedural-vfx/SKILL.md`, `references/procedural-vfx-system.md`, packaged reentry example | Yes. Bounded owned geometry, instanced fluids and stable selection. |
| Audio | `threejs-audio-generator/SKILL.md`, `references/audio-workflows.md` | Yes. Existing real sample layers; independent level/lifecycle/spatial checks. |
| UI / QA | `threejs-game-ui-designer/SKILL.md`, `references/ui-patterns.md`, game-ui-quality/hud-readability/responsive-ui-fit checklists; `threejs-qa-release/SKILL.md`, `references/qa-release-checklists.md`, visual-verification/playtest-qa/release checklists | Yes. Mistaken QA/UI workflow filenames were corrected to the actual references. PC controls, readable prompts, controller menu scrolling, pause/restart, imported assets and errors reviewed. Mobile is outside the user's scope; earlier portrait captures are historical/incidental regression evidence. |
| Browser loop | `develop-web-game/SKILL.md`, installed web-game client | Yes. Repository wrapper adapts paths/warmup only; source tab preserved. |

No public deployment, commit or paid generation is performed. Testing uses separate headless Chrome pages and a separate ephemeral production server. The user's source server and existing game tab at port 5200 remain untouched.

Presentation acceptance is narrower than professional realism. The old source has coarse scanned cheek/jaw geometry and fused finger silhouettes; the wound kit has procedural bone/fascia folds and static bowel loops. Skin boundaries use weighted partitions rather than bespoke fracture topology. Fragment floor settling is cosmetic and does not collide with every wall/prop. These limits remain visible at extreme close range and are not certified as AAA or realistic anatomy.

### PC and controller

`gamepad-input.js` accepts standard browser mappings and feeds the existing fixed-step intents and co-op parry/hook sequences. Radial stick deadzone is .18; full travel gives 2.8 rad/s yaw and 2 rad/s pitch, scaled by the existing sensitivity setting. Keyboard/mouse stay available. Controller labels use Xbox-style names:

| Control | Action |
| --- | --- |
| Left / right stick | Move / look |
| RT / LT | Fire / alternate fire |
| RB / LB | Parry, close counter or bite escape / tether |
| A / B / left-stick click | Jump / hold slide / dash |
| Hold X | Corpse extraction |
| Y / D-pad | Cycle owned weapons |
| Start | Pause / resume |
| Menus: stick or D-pad / A / B | Focus or scroll the open controls sheet / confirm / back |

Discrete actions require fresh presses. Pause, loading, blur, hidden tabs and controller replacement/disconnection clear held state and require centered sticks plus released buttons before rearming. Controller start/resume skips mouse capture. The controls panel scrolls its actual existing overflow ancestor, keeping the last binding reachable at 1280 × 720. Physical controller models, vibration and driver behavior were not tested; co-op code text needs keyboard entry. Browser sound startup can require an initial mouse/keyboard gesture.

### Final verification receipts

The final focused CPU command passes **127 checks**: counter timing/interruptions/authority, controller input/menus/lifecycle, exact imported rig/texture/clip preservation, clipped skin/UV/normal/color, scaled cut-frame tracking, player injury, map v5, spawn warnings and AI.

```powershell
node --test --test-isolation=none tests/gamepad-input.test.mjs tests/brutal-counter.test.mjs tests/brutal-visuals.test.mjs tests/character-asset-load.test.mjs tests/character-rig-v05.test.mjs tests/character-articulation.test.mjs tests/afterlife-motion-v04.test.mjs tests/player-injury-visuals.test.mjs tests/main-injury-lifecycle.test.mjs tests/player-bite.test.mjs tests/spawn-v5.test.mjs tests/map-flow-v5.test.mjs enemy-ai.test.mjs engine.test.mjs
node build.mjs
```

- `output/playwright/brutal-combat/pc-accepted/report.json`: **17 PC views, PASS, zero errors**. Real F input starts all three counters; canonical contact drives wound/hands/spray, torso facing stays above .9 dot, gore-off retains the tested kill, restart clears owned pools, pause/resume returns idle. Matched render/state receipts freeze the actual render rather than staging a separate image. Root and independent reviewer inspect the images; the independent verdict retains art limitations.
- `output/playwright/brutal-combat/controller-final/report.json`: **14 integration checks, PASS, zero errors**. Injected standard `navigator.getGamepads` snapshots go through the production frame loop: menu confirmation/scrolling, stick movement/look, actual RT/LT weapon events, Y ownership, held RB one-hit guard, two RB bite escape, pause/resume, disconnect/reconnect, blur/focus and keyboard/mouse return. This is browser integration evidence, not physical hardware certification.
- `output/playwright/brutal-combat/injury-regression/report.json`: existing **31-view journey plus 120 seconds of actual pointer-lock mouse/keyboard input**, PASS, zero errors; 12 input cycles, 13 recorded mouse shots, .660 cells traveled. Covers natural escape, terminal injuries, all eight weapons, original oral articulation, gore-off, restart and menus. Its legacy portrait rows are retained regression fixtures, not new mobile work.
- `output/playwright/brutal-combat/controls-final`: installed web-game client exits successfully after two source-game input bursts; both state JSONs, gameplay images and floor-residue inspection were opened. States show movement, encounter navigation, an active bite and subsequent escape/wound. Firing is independently proven by the actual-input injury/controller checks; the client's `shots` field counts rifle sequence, not all weapon events. No error files were emitted.
- `output/playwright/brutal-combat/audio.json`: final 30 real sample/mix/routing checks, PASS, peak .786655; highest observed across both runs was .793733. Full joined co-op visual play and physical controller hardware remain unverified; CPU authority and canonical event routing are verified. No stable-FPS benchmark is claimed from shared-machine captures.

The runtime kit manifest and `output/playwright/brutal-combat/verification.json` identify the final asset hash, source/build matching and acceptance scope. `independent-review.json` preserves earlier failed presentations and the final bounded verdict. Remaining work for a later art pass is bespoke neck/shoulder fracture topology, better survivor sleeve weights and independently closing fingers, sculpted organ/membrane surfaces and deformable contact. Full-body bisection and head crushing are not implemented by these three counters.

Counter frames use cached measured cap placement rather than rebuilding a deforming boundary surface every frame. Reduced motion suppresses the small impact/roll impulse, while the directed downward framing for torso contact remains; still captures do not certify temporal comfort. The neck/shoulder border and survivor sleeves remain visibly angular in macro views. This is a functional, integrated horror-combat upgrade with a measured presentation gate, not the previously requested whole-game professional-art acceptance.
