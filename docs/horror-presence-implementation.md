# The Last Dead: the place remembers

This implements the encounter hypotheses from [the September 30 research loop](horror-research-loop-2026-09-30.md). The design connects auditory imitation, unnatural intention, contamination, pressure and personal infestation. It adds nondamaging environmental encounters while preserving the existing combat tells and movement controls.

## What is integrated

| Research experiment | Runtime behavior | Primary location |
| --- | --- | --- |
| E01 Answering wall | Retains up to four actual footfall intervals. After the player stops in eligible calm space, pipes and wall foley repeat that irregular timing. | First eligible room after walking |
| E02 Under the cuff | One canonical roach traverses the right sleeve for 1.3 seconds, then a localized fold travels over the actual sleeve mesh. Missing source arms suppress it. | Floor 4 west aisle; bounded room fallback |
| E03 Wrong movement | A cloned Ash Witness turns its torso while its head catches up approximately 430 ms later. Feet and joint lengths remain coherent. | Floor 1 crane gantry |
| E04 Contact transfer | The specimen touches a clean handle; a filament and residue remain at that contact surface. Gore-off uses oil and fibers. | Floor 2 drain ward |
| E05 Small strain | A weighted knuckle reaches glass, then its actual cloned skin locally compresses by at most 16 mm. | Floor 3 vault |
| E06 Approach | Four short spatial samples progress toward a source; occlusion filters and a brief final rough texture alter the perceived approach. | Floor 4 tower; eligible room fallback |
| E07 Recognition | The previously learned irregular pattern returns in a specimen's grip and pipe membranes. Sound and visible pulses share the same cumulative interval schedule. | Floor 3 apse, floor 5 organ, later-floor callback |
| E08 Recovery | One major sequence at a time. Scenes last 6–9 seconds; then a 68-second major-scene cooldown and at least 24 seconds excluding legacy horror cues. Combat, injury and actual recovery rooms take precedence. | All modes |

The surgical table also uses the learned motif to displace a small area of linen over a specimen. Floor 2's theater is its authored primary site. Room-specific fallback scenes make the system available outside those exact rooms without spawning damaging enemies.

## Implementation and boundaries

[horror-presence.js](../horror-presence.js) owns the simulation clock, bounded memory, room selection, shared scare budget and validated co-op state. New scenes require five calm seconds, health of at least 35, no nearby living threat within five cells, no nearby projectile, no active encounter and no incompatible hand/weapon action. Floor transitions keep the in-run rhythm while cancelling the current scene. A new run forgets it. No microphone, biometric data or persistent player profile is used.

World actors use a walkable anchor with a clear wall ray from the player. Fallback fixtures stay within 1.5 cells (six meters), and cannot appear within 0.55 cells of the observer. All poses remain presentation only: they do not change collisions, aim, damage, weapons, rewards or progression. The player can look away, leave, fire or interrupt a scene.

[horror-encounter-visuals.js](../horror-encounter-visuals.js) reuses one cloned rig and one fixture group. Local skin copies belong to this presentation; the source model and packed textures remain shared. [horror-cuff-visuals.js](../horror-cuff-visuals.js) owns at most one geometry copy, restores exact source positions/normals and adds zero meshes, materials or draws. Reduced motion uses a smaller stationary sleeve fold, smaller pressure movement and synchronized head/body turning.

[horror-presence-audio.js](../horror-presence-audio.js) uses existing bundled samples, HRTF positions and existing group gains. It owns at most three short voices. The rough final breath uses 38 Hz amplitude modulation at depth 0.08; this is a short audible timbre treatment, not an infrasonic fear claim. Simulation scheduling prevents late timer callbacks after pause or death. Only this system's sources are cancelled. Restart also resets cue-ID deduplication.

The host owns shared room anchors, rhythm and phase. Snapshots are bounded and course-validated, and clients reject stale/repeated sound IDs. Acceptance synchronizes the client clock so one snapshot interval cannot be counted twice. A guest's local weapon action suppresses its presentation while preserving the canonical shared actor. A paused co-op host keeps the shared phase running while its local audio and new effects stay quiet. A host's personal cuff event stays on the host's body; the guest still observes the canonical host crawl through the existing player snapshot. Full two-player environmental presentation needs its dedicated browser check before multiplayer fidelity is certified; local WebRTC transport passed separately at 2 ms RTT.

Legacy drop/window/audio cues consult the same scare budget. Essential dungeon ingress and combat warnings retain their gameplay function. Existing vermin swarms suppress new encounters. A cuff sequence cannot replace an active rat/roach crawl. Its new lead-in is cosmetic and does not add health damage or a new player input. Recognition callbacks require a pattern learned in the current run.

## Coordination and source ledger

The user authorized parallel integration and coordination with the existing chats. Ownership notes were sent to **Enhance procedural G gore effect**, **Improve zombie AI and animation**, and **Update rendering for bodycam FPS**. No chats were interrupted. Their anatomy, extraction, AI, animation, foreground arm assets and rendering edits were preserved. Integration consists of small hooks in `main.js`, `renderer.js`, `horror-scares-game.js` and the explicit runtime build list, plus four independent runtime modules.

| Surface | Source | Work in this pass |
| --- | --- | --- |
| Specimen | Bundled `assets/models/afterlife-ash-witness-rig-v05.glb`, existing imported model and Blender articulation chain | One independent clone; joint-preserving choreography; local weighted geometry copy |
| Sleeve | Existing authored `TLD_ViewSleeve_Right` or labelled procedural fabric fallback | Deform the source cloth; preserve original geometry ownership |
| Roach | Existing bundled `vermin-v1.glb` and canonical crawl system | Single short nondamaging lead-in |
| Fixtures | Existing worn-steel and afterlife-wood texture materials | Authored enamel, glass, handle, pipes and linen supporting geometry |
| Audio | Existing sampled footstep, mechanism, moan, slide and blood pools | Short source-specific arrangements; no new recordings or paid generation |
| UI / world art | Existing game | Existing controls, HUD, menus, bodycam, lights and rooms retained |

The relevant 3D, image and audio generator skills were read before choosing asset reuse. Existing high-value imported assets already provide the specimen, foreground arms and insects; this pass does not spend new provider credits or claim unavailable credentials. The ignored `.art-source` archive is never runtime input.

## Skill and phase ledger

Loaded skills under `C:/Users/wolfk/.codex/skills/`: `threejs-game-director`, `threejs-gameplay-systems`, `threejs-aaa-graphics-builder`, `threejs-game-ui-designer`, `threejs-debug-profiler`, `threejs-qa-release`, `threejs-3d-generator`, `threejs-image-generator`, `threejs-audio-generator`, `develop-web-game`, and `local-dev-instances`.

References read by the integration team: gameplay workflows; graphics implementation blueprint, model recipes, render recipes and visual scorecard; audio workflows; generator API notes, Three.js integration and image-generator workflows; debug/profile checklists, scene debugging and performance profile; QA/release checklist, visual verification, playtest QA and release. No UI redesign phase or external generation phase was performed.

| Phase | Evidence / status |
| --- | --- |
| Research | Primary-source loop and controlled experiment specifications in the research brief |
| Gameplay direction | Pure scheduler tests cover actual rhythm, eligibility, pacing, lifecycle and snapshot validation |
| Visual execution | Weighted production GLB contact and exact sleeve restoration tested; browser acceptance tracked separately |
| Audio integration | Bounded source ownership, mute, deduplication, restart and cancellation tested |
| Production integration | Explicit runtime list; `npm run build` passes |
| Browser verification | See [horror-presence-qa.md](horror-presence-qa.md) and its linked receipts for final status |
| Human research | Pending: fear, skin-crawling, disgust, enjoyment, bug attribution and novelty ratings |

## Verification and practical limits

Focused command:

```text
node --test --test-isolation=none tests/horror-presence.test.mjs tests/horror-cuff-visuals.test.mjs tests/horror-encounter-visuals.test.mjs
```

The Windows sandbox denies Node's default test subprocess spawn; `--test-isolation=none` runs the actual tests directly. The focused suite passes all 29 cases, including shaped-room placement, a real hand-to-observer visibility ray, co-op host pause, exact guest phase acceptance, local suppression and crawl preservation. The latest broader shared-checkout pass is 110/110 across engine, AI, vermin, bites, brutal counters, extraction and dungeon/build integration. Earlier Ossuary/counter failures and a transient extraction syntax error were sent to their owning chats; those failures no longer appear in the current pass. Receipts are saved under `output/playwright/horror-presence/`. These selected checks do not certify every test or the whole campaign.

GPU tests use task-owned Chrome contexts and port-zero source/built servers. They preserve the player's tab and port 5200 server. Concurrent builds briefly removed the shared `dist` assets during one rejected production probe; production verification therefore uses a verified fixed copy of the build in this repository's QA output directory. Developer fixtures exist only behind `?horrorqa=1` with the developer gate. They freeze normal simulation stepping while retaining the real renderer, mode, settings, input and lifecycle systems for deterministic captures.

Final browser acceptance passes 17 source checks with 41 captured frames, and 16 production-copy checks with 40 captured frames. Both report zero browser, HTTP or request failures. The source live journey lasted 131.3 seconds and exercised actual movement, aim, jumping and firing; the admitted-shot counter reached 16 by its end. The installed develop-web-game client also completed two separate control bursts, with 7.739 cells of measured travel and the second burst ending in normal enemy-caused death at 28.4 simulation seconds. Its recorded run was validated against active-play entry, movement, clock advancement and valid terminal lifecycle; the earlier premature-input rejection is retained separately. See [the control receipt](../output/playwright/horror-skill-client/verification.json). The fixed production copy's integration bytes match source; its complete runtime/asset copy is verified separately by the QA report. See [the machine receipt](../output/playwright/horror-presence/verification.json) and [the browser report](horror-presence-qa.md). Cold startup on the shared machine was slow and is recorded in the stage timestamps; this pass does not certify startup or interactive frame-time targets.

The first browser iterations rejected distant/occluded anchors, an opaque fixture backing and a reflected lantern hotspot despite passing scene-state checks. Placement was constrained by distance and wall visibility, the backing moved below the contact area, and the glass fill changed to a nearly clear nonreflective surface. Regression tests cover the real shaped rooms on all five floors and an unobstructed hand-to-observer line. The QA fixtures also now clear residual velocities, initialize missing pacing after retry and use the real Start flow. Final screenshots, audio evidence and lifecycle results are recorded by the QA report rather than inferred from node counts.

This is an implemented horror prototype loop, not evidence that the game is more frightening than any existing game. Current creature/sleeve fidelity, contact legibility under the bodycam lens, headphones versus speakers and perceived audio loudness remain human-review concerns. The next research loop should compare each treatment to the matched controls in the brief before changing intensities or claiming fear/enjoyment gains.
