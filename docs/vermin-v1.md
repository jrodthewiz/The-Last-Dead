# Vermin combat and scent swarms

This pass adds floor rats and cockroaches, a deliberately risky rat pickup, throws and close-range mouth/abdomen infestation, and occasional blood-scent swarms. It preserves the existing dungeon, weapons, character assets, counters and chest finisher. The creatures use an original Blender model and an ImageGen atlas, with host-owned gameplay and native instance batching.

## Controls and behavior

| Input | Result |
| --- | --- |
| Tap G / controller X while looking down | Grab a visible floor rat within 1.4m |
| Tap G / X while holding | Throw along the view direction |
| F / RB with a held rat and supported close zombie | Feed into the mouth; aim down to target the abdomen |
| Hold G / X at a corpse | Existing corpse extraction |
| F / RB without a valid rat target | Existing parry/counter fallback |
| V / R3 | Existing chest finisher |

The feeding range is 1.28m. Pickup lasts .36s; insertion lasts .86s, with one authoritative contact at .32s. The first held-rat bite arrives after1.35s, followed by1HP bites every1.4s. The rat automatically drops after8s. Weapons pause while the hand is occupied. Throws sweep against walls and supported zombie collision proxies; impact and infestation never apply twice. Feeding deals2 immediate damage plus bounded .7 damage ticks over3s; thrown infestation deals1.2 immediate damage and lasts2.4s. Existing damage/scoring owns those hits.

Scent derives from canonical kills, hit counts, new blood and player wounds. A2.2s warning precedes a5.2s swarm; the cooldown is32s. Active floor creatures seek visible fresh blood, then wounded/nearby players, using bounded turns and local wall/LOS checks. Quiet-time events can occur occasionally even without a combat burst. Environmental crawls last4.2s and cause no unavoidable health loss. Deliberately holding a rat is the bite risk. At most three creatures attach to the first-person body/weapon at once.

PC and standard-mapped controller are the requested targets. Physical controller hardware was not used. Mobile support and mobile QA are explicitly outside the user's scope.

## Authority, physics and lifecycle

The host owns creature positions, reservation, bite intervals, contact, infestation and scent. Rat taps use a monotonic input sequence so a tap released before the next50ms packet survives. Guest weapon prediction cannot mutate vermin gameplay. Snapshots include bounded world state plus each player's hand/crawl state; local hand-bite audio is filtered by victim identity, and repeated snapshots cannot replay a cue.

The physics engine choice for this feature is a small custom analytic ballistic sweep using the game's existing wall and actor queries. Timestep remains120Hz;30/60/120Hz equivalence is tested. No additional rigid-body engine is added. Existing cannon-es corpse physics remains intact. Floor movement uses small collision radii and wall checks; the visual meshes never become expensive triangle colliders. Source Rat is ground-pivoted, so rendering removes the simulation collision-center height rather than floating its feet above the floor.

Pause stops solo simulation clocks. Course changes and restart clear hand/crawl and infestation presentation. Arm loss, downing, conflicting actions, lost targets and early out-of-reach pickup cancel safely. Co-op reservation prevents two players taking the same rat. Late asset completion and normal disposal release owned resources without disposing borrowed survivor geometry/materials.

## Asset and animation work

The new Blender-authored GLB contains one indexed Rat (6,124 triangles) and one indexed Cockroach (2,252 triangles), with one shared atlas material and three embedded maps. The file is 1,974,900 bytes, SHA256 `8a8bae91a89e59330ea57cff77d43dee93a20c13c48686ad59d314d3bc5864f4`. Relative POSITION/NORMAL shapes are Rat `ScurryA`, `ScurryB`, `Bite`, `TailLeft`, `TailRight`; Cockroach `ScurryA`, `ScurryB`, `AntennaLeft`, `AntennaRight`. Default weights are zero. Native per-instance morph rows let floor creatures share two draw groups while keeping separate motion phases.

The hand comes from the existing survivor's indexed, skinned left-arm geometry and its source UVs. The additive finger rig and arm IK fit a real rat scruff vertex to a real hand vertex. Ordinary support-arm visibility restores before every subsequent weapon frame. Close contact uses the preserved rig's actual mouth opening; its Jaw origin is a cheek hinge, requiring the authored local offset. Victim pull and body/camera lean are bounded and restored; isolated sleeves cannot translate across the room to fake reach. Crawling samples source weapon/sleeve geometry. Rats can traverse the long-gun receivers for weapons1/2/4/5, with sleeve fallback for smaller tools; roaches follow weapon or sleeve routes.

During a canonical held bite, the rat turns its source incisor geometry toward sampled survivor finger geometry while keeping the scruff attached. Twist is bounded at 1.25 radians and hand recoil at 17.6mm, with a small temporary grip relaxation. The bite overlay applies only in the held phase; insertion and release restore it. Hidden arms, weapons and ancestor groups reject crawl overlays, including after limb loss.

Insertion transitions from the whole rat to a cropped portion of its authored tail at the mouth/abdomen. The abdomen opening chains onto owned copies of the actor's existing material hooks and uses the existing authored wound lip. Bite/impact droplets reuse the small non-emissive fluid-blood pool. Gore-off suppresses blood and wound/tail presentation while preserving the interaction. Reduced motion limits decorative oscillation.

The editable packed master, original generated atlas, support maps and proof history are preserved under `.art-source/vermin-v1/`. That archive is ignored and excluded from runtime builds. The shipped model and manifest live in `assets/models/`; art proof renders and exact import/export receipts live in `art/vermin-v1/`.

## Research and application

[Three.js InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html) supports matrix updates, per-instance morph textures and native buffer disposal. The bundled implementation was checked rather than assuming a different Three.js release. [Blender relative shape keys](https://docs.blender.org/manual/en/4.2/animation/shape_keys/shape_keys_panel.html) informs additive movement shapes; generation/export used installed Blender2.93. [Red Blob's own flow-field article](https://www.redblobgames.com/pathfinding/tower-defense/) informed the distinction between cheap local steering and shared global paths. This implementation uses bounded local steering and wall/LOS queries, not a claimed full flow-field solver.

Anatomical sources in the asset manifest include university natural-history/entomology descriptions for rat proportions/digits and flattened cockroach form, six legs and antennae. Creature meshes are original authored interpretations, not scanned specimens. Applying those references to real-time game silhouettes is an art/engineering inference verified with neutral, morph and in-game views.

## Skill-loading ledger

Loaded means SKILL.md was read in this continuing conversation. The local skill root is `C:/Users/wolfk/.codex/skills/`.

| Skill | Work |
| --- | --- |
| threejs-game-director | Coordinated phases, required independent agents, evidence/report audit |
| threejs-gameplay-systems | Host authority, input, bounded physics, timings, lifecycle |
| threejs-aaa-graphics-builder | Mesh/material/proof quality gates and current-fidelity assessment |
| threejs-game-ui-designer | Contextual prompts, warning priority, PC/controller hints |
| threejs-debug-profiler | Contact/surface/pose diagnosis and renderer measurements |
| threejs-qa-release | Production build, browser journeys, pixel receipts and regressions |
| threejs-procedural-animation | Native morph envelopes, reversible source IK/grip/jaw overlays |
| threejs-procedural-vfx | Fixed droplet/creature pools and owned-resource cleanup |
| threejs-3d-generator | External sourcing workflow; offline Blender selected for controllable topology/shapes |
| threejs-image-generator | Texture sourcing workflow; native ImageGen supplied the atlas |
| threejs-audio-generator | Foley matrix, licensed samples, bounded voices and audio measurements |
| develop-web-game | Installed Playwright input/capture loop |
| imagegen | Built-in generation and workspace/source preservation |

The director explicitly requires delegation. `vermin_engine` owns simulation/engine hooks/tests; `vermin_art` owns Blender meshes/materials/master/proofs; `vermin_visuals` owns imported creature/hand presentation and renderer hooks/tests. Root owns controls, snapshots, prompts, audio, build, integrated QA and this report. No user-owned side chats were created.

## Reference ledger

Reused from the continuing combat-realism work: director phase OS; gameplay systems, animation/VFX and physics selection; graphics model/material/performance/scorecard gates; UI quality/readability/fit; scene/performance debugging; QA visual/playtest/release checklists; generator API/integration and audio workflow guidance. The exact earlier reference paths are recorded in `docs/combat-realism-v1.md`. Re-read for this pass: physics-engine-selection.md, Three.js integration/API notes, image-generator SKILL prompt/integration rules, native ImageGen workflow, audio-workflows.md, performance-profile.md, visual-verification.md, playtest-qa.md, release.md and visual-scorecard.md. The image-generator package has no `references/image-generator-workflows.md`; its equivalent guidance is in SKILL.md itself.

## External asset sourcing

Credential probe output from the actual director Bash script:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

This script prints an empty suffix for missing values. A separate PowerShell process-environment probe reported each key `unset`, without exposing values. This is evidence about these tool processes, not an inventory of every credential on the computer. No new paid Meshy/Tripo/ElevenLabs job was submitted; the earlier23-credit motion approval was not reused.

Chosen sources: existing Meshy survivor and zombie hero/player assets retained; existing authored dungeon world/sky/background retained; new original Blender vermin meshes; native ImageGen materials/textures/decals atlas; existing licensed sampled foley. Native output was `exec-6cac08d0-8ded-4977-97ba-56274870ef2f.png`, copied/packed into the project archive and embedded into `assets/models/vermin-v1.glb` after deliberate compression. The project never depends on the external generated-images directory.

Prompt intent: an evenly lit, seamless2×2 PBR base-color atlas with brown coarse rat fur, muted gray-pink ear/paw/tail skin, dark brown cockroach chitin and subdued mouth tissue; no animals, text, borders, perspective or strong baked shadows. The generated original is1254×1254; runtime albedo is1024JPEG with authored512normal/roughness fields. Residual painted lighting remains; these maps are not calibrated scanned PBR surfaces.

## Audio sourcing and matrix

No new animal recording is claimed. Ten canonical event arrangements use bundled physical scratches/clothing/impact/wet foley, routed below weapon reports and attack warnings. The new rustle pool uses `assets/audio/baseline/interface-scratch_001.ogg` and `interface-scratch_002.ogg`, covered by bundled Kenney CC0 interface license. Other layers retain the existing documented licensed pools.

| Events | Layers/purpose |
| --- | --- |
| pickup / drop | Short scratch at hand release/contact |
| throw | Quiet air/clothing motion |
| stuff / infestation | Scratch plus one bounded wet contact |
| held-rat bite | Brief impact/wet hand feedback |
| landing | Soft contact |
| crawl / warning / swarm | Quiet scratch bursts, never per-frame loops |

A shared four-voice budget covers all vermin foley. Dedup keys include action sequence, rat/target identity and bite count, so duplicates stay silent and later bites remain audible. Master/SFX mute, pause, restart and disposal were measured.130manifest entries decode without errors. Vermin + automatic fire + ambience peak measured0.5121 (−5.81dBFS) at maximum master volume; existing counter mix regression measured0.7935. These are waveform/headroom checks, not a claim of human listening approval or authentic animal voices.

## Phase ledger

| Phase | Status |
| --- | --- |
| Gameplay systems | Implemented; focused authority/collision/input tests pass |
| AAA graphics | Authored model, atlas and morph proofs accepted for bounded fidelity; below professional realism |
| UI | Real keyboard/controller prompts and warning priority verified |
| Debug/profile | Source hand, mouth, floor pivot and melee-arm lookup corrected; bounded renderer diagnostics collected |
| QA/release | Build and 474 CPU checks pass; feature, corrected live soak, audio, controller and chest regressions pass |

## Visual scorecard

Scores use the loaded 0–3 skill rubric and compare these captured combat views with the previous combat-realism report. They are a feature assessment, not a new audit of every room or encounter.

| Category | Before | After | Evidence / remaining gap |
| --- | ---: | ---: | --- |
| Art direction | 2 | 2 | Dirty bodycam dungeon, creatures and restrained foley fit together |
| Hero/player | 2 | 2 | Source scruff grip, bite response and connected reach; fused finger bases and angular cuffs remain |
| Obstacles/enemies | 1 | 1 | Source jaw/socket interaction preserved; existing enemy face and silhouette variety remain limited |
| Rewards/interactables | 1 | 2 | Two authored vermin forms, risky rat handling, infestation and contextual feedback |
| World/environment | 2 | 2 | Existing textured routes preserved; new moving floor life, no comprehensive world-art revision |
| Materials/textures | 2 | 2 | Shared generated atlas with normal/roughness maps; fur/chitin response remains stylized |
| Lighting/render | 2 | 2 | Scene lighting and bodycam retained; small creatures depend on distance and lamp coverage |
| VFX/motion | 2 | 2 | Native per-instance gait, source-surface crawls, canonical bites, reversible IK and fluid contact |
| UI/HUD | 2 | 2 | Existing compact HUD, contextual rat prompts and swarm warning priority |
| Performance evidence | 3 | 3 | Capped instances/voices, measured full-frame renderer counts, lifecycle and asset hash checks |
| **Average** | **1.9** | **2.0** | Below the 2.3 premium threshold; enemy category remains below 2 |

Automatic failures remaining for a premium claim: limited enemy silhouette variety and uneven existing world/interactable art. Additional realism gaps are fused source digits, pointed/tattered cuffs, coarse facial topology, texture-based fur and schematic tissue/organ forms. This pass accepts the requested bounded interactions, not professional photorealism or a whole-game AAA claim. A subsequent art pass needs authored digit/cloth topology and creature/facial sculpting; overlays cannot supply that topology.

## Verification and limits

Build and **474/474 CPU tests** pass. They cover the existing engine/AI/map/spawn/combat modules plus vermin authority, frame-rate-equivalent sweeps, cancellation, scent attraction, packet tap retention, snapshot bounds, grip/contact restoration, hidden-limb routes and disposal. Browser scripts are run separately from the CPU suite.

The existing chest journey passes **12 checks / 16 views**, including real mouse shot → V, heart extraction, source grip, fallen firearm recovery, ragdoll floor contact, controller R3, pause/restart and gore settings. Existing controller integration passes14 checks; existing counter audio passes38 checks. Vermin audio decodes130 samples, covers10 cues with a four-voice budget, and verifies mute, deduplication, pause, restart, cleanup and mix headroom.

Final feature browser QA passes **15 checks / 26 desktop screenshots**, plus72 sampled contact/recovery frames. Root and an independent reviewer inspect the actual captures and selected motion frames. Real G/X pickup/throw and F/RB feeding reach the host; blood from actual rail kills triggers a warning and bounded swarm. Both species follow three tested weapon forms; source tests cover all eight. Pause/restart, gore-off and reduced motion preserve the expected gameplay. Final console/page errors, failed requests and HTTP errors are empty.

The corrected live-input soak lasts **127.506 seconds** across eight cycles, with65.95 seconds of active simulation,6.787 cells of recorded travel (~27.15m),19 actual shot cues, four deaths and fresh retries. The remaining wall time includes death screens and capture/input overhead. These are real frame-loop inputs and authoritative advancement, not a claim of uninterrupted120 seconds of living combat or full-campaign completion.

Sampled full rendered frames measure **285–378 calls**, **326,283–868,248 triangles**, and **108–161 textures**, including the existing game and effects. These counts disable renderer.info auto-reset only for the measurement frame and then restore it. At1280×720 the canvas pixel lit fraction ranges0.769–0.979, with luminance variance0.0080–0.0226. They establish nonblank scene coverage across the captured states; they do not certify every dark room, baseline FPS improvement or a hardware frame-rate target.

| Evidence | Receipt / output |
| --- | --- |
| Feature +72 temporal frames + corrected live input | `output/playwright/vermin-v1/pc/report.json`, `pc/motion/` |
| Hashes, source/build parity and combined validation | `output/playwright/vermin-v1/verification.json` |
| Independent runtime art review | `output/playwright/vermin-v1/independent-review.json` |
| Vermin decoded/mixed audio | `output/playwright/vermin-v1/audio/report.json` |
| Existing counter audio | `output/playwright/vermin-v1/audio-regression/audio.json` |
| Existing controller controls | `output/playwright/vermin-v1/controller-regression/report.json` |
| Existing chest/physics journey | `output/playwright/vermin-v1/chest-regression/report.json` |
| Installed game client input bursts | `output/playwright/vermin-v1/skill-client/` |
| Neutral/morph proofs and editable-master/import/export audits | `art/vermin-v1/visual-review.json`, `export-audit.json`, `runtime-import-audit.json`, `master-audit.json` |

The installed web-game client also passes two source-game input/capture bursts; its two active screenshots, state records and directed floor-residue view were inspected. Local two-context WebRTC transport previously passed with2ms host RTT in this feature pass. This verifies local transport, not public signaling or joined co-op visuals.

Combined verification checks366 runtime files against their source SHA256 hashes and confirms authoring archives, proof benches, docs and tests are excluded from the build. Original survivor, zombie v05, chest v2 and blood v3 hashes remain exact. The independent review binds19 static screenshots and seven selected temporal frames to the final PASS report hash, and retains its contact/silhouette limits. Export/import/master/proof receipts match the final model; the Node loader audit stubs bitmap decoding, while Blender and the real browser decode the actual textures.

The user's source server at `http://127.0.0.1:5200/` (PID26316) and existing tab are preserved; process command and HTTP200 were rechecked. Tests use separate headless browsers and ephemeral preview servers, sequentially. No commit, deployment or paid provider submission is part of this pass.

Known art limits: texture/normal-based fur rather than strands; schematic rat joints/ears and source survivor fused finger bases/tattered sleeve edges; coarse existing zombie facial topology; authored rather than scanned PBR surfaces. Infestation and body crawls use bounded procedural/morph presentation, not a physical soft-body animal solver. Full campaign balance, joined public co-op hardware and professional photorealism are not certified by this feature pass.

Close contact has specific presentation limits: the scruff grip partly occludes nose/lip entry, the recovery hand passes high over the cheek, the preserved abdomen socket reads through the lower coat, and long-gun receiver crawlers can be occluded by the gun/support hand. Rat tail highlights are stronger than the body. These are recorded in the visual review rather than presented as exact physical dental/tissue contact.

The final integration exposed and corrected an actual melee lookup defect: bat/chainsaw source arms were registered on the inner model, while crawl/injury overlays read the outer weapon group. Both now reference the same existing arms; no duplicate geometry is created. A factory regression verifies intact crawling, severed-arm culling and support-hand/transform recovery.

Rejected verification iterations remain under `output/playwright/vermin-v1/rejected-*`: the initial contact fit, an input-freeze timing error, the melee source lookup defect, a soak that inherited the temporal capture's paused state, and a capture that read the HUD before its30Hz refresh. The final soak explicitly begins live play and verifies increasing authoritative time, movement and shot events. Captures wait for the actual warning DOM state. Elapsed wall time alone is insufficient evidence of gameplay.

## Reproduction

PowerShell from this repository (use your local Playwright/Chrome paths when different):

```powershell
$env:PLAYWRIGHT_PATH='C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CHROME_PATH='C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
node build.mjs
$cpuFiles=@(Get-ChildItem tests -Filter '*.test.mjs' | Where-Object {$_.Name -notin @('bite-audio.test.mjs','brutal-audio.test.mjs','enemy-variations.test.mjs','coop-game.test.mjs','network.test.mjs')} | ForEach-Object {$_.FullName})
node --test --test-isolation=none engine.test.mjs enemy-ai.test.mjs @cpuFiles
$env:VERMIN_TEMPORAL='1'
$env:VERMIN_SOAK='1'
node tests/vermin-browser.mjs
node tests/vermin-audio.mjs
$env:CHEST_OUTPUT='output/playwright/vermin-v1/chest-regression'
node tests/chest-finisher-browser.mjs
$env:DEAD_ARRIVAL_OUTPUT='output/playwright/vermin-v1/skill-client'
node scripts/run-v2-skill-client.mjs
```

Run browser commands sequentially. The feature and chest runners start temporary production previews; the installed skill client uses a separate browser on the existing source URL. These commands never navigate the user's current tab.
