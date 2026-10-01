# Combat realism refinement — 30 September 2026

This iteration improves the existing chest finisher, bite presentation, enemy animation and impact effects on the current standalone checkout. It keeps the newer dungeon, spawn progression, weapons, PC/controller controls and compact HUD. The result is a bounded demo improvement; it does not certify photoreal anatomy or whole-game professional quality.

## What changed

- **Grasp and recovery:** six additive controls curl proximal/distal finger clusters and oppose the thumbs on the existing survivor. Heart, firearm and bracing poses use different envelopes. Arm IK follows the actual heart/firearm targets. Pickup camera retraction fits the victim's existing rotated collision boxes, with a 42 cm maximum during the crouch. It clears the coat interior without changing the source coat geometry. Camera yaw resets each ordinary frame, preventing accumulated recovery rotation. The chainsaw receives a lower, wider bite tuck so its bar clears the open mouth.
- **Anatomy:** a new Blender-authored v2 chest/heart kit has discontinuous cloth/tissue edges, thinner fraying, mottled surfaces, visible severed vessel lumens and relative compression/lag shapes. Canonical extraction age drives compression, vessel settling and wound tension. Lighting calibration keeps maroon contours readable under the body lamp without emissive tissue.
- **Soft tissue:** the authored textured intestinal bundle now supplies player injury strands. Each of its three instances has independent bounded sag and damped bend. The same helper softens attached zombie intestines. Normals follow the deformation; conservative bounds prevent false culling and support a floor clamp. Source geometry, UVs and shared maps remain intact.
- **Impacts:** built-in ImageGen produced a new transparent blood atlas with contact spatter, a thin directional spray, smear and sparse drops. Airborne blood uses small pooled volume droplets, velocity-oriented stretch with constant volume, exact gravity/linear-drag trajectories and short fade-out. Counter radii are 2.5–5.5 mm. Non-emissive red body color and restrained wet response replace black oval and silver/glow artifacts. Impact sheets/stains are smaller and briefer; selected falling droplets deposit once. Replacement co-op snapshots resolve the current actor by ID rather than leaving a contact stain attached to an obsolete object.
- **Enemy motion:** seeded idle phase/rate, eased blend endpoints, uninterrupted rapid-hit recoil, a 160 ms recoil-to-gait release, and jaw/grip anticipation/contact/recovery layer over the preserved six source clips. Contact uses the authored swipe time, including the different tested attack tempos. Damage remains owned by the engine.
- **Weapon effects and ownership:** powder weapons use a short warm, feathered gas flare instead of the geometric pink cross. The rifle pressure layer becomes textured haze; its existing activation remains intact. Shot sequence fixes flare variation, rather than wall-clock rotation. Existing mechanical weapon motion remains. Detail materials are registered with each weapon's ownership metadata, and cleanup releases native instance buffers.

V/R3 still requires a wounded, recently staggered supported target and 15 energy. Contact/extraction/release/recovery remain **0.24 / 0.68 / 0.95 / 1.50 seconds**. Existing F/RB counters, shooting, movement, pause, restart, gore toggle and reduced motion remain available. Refer to [the controls and authority contract](chest-finisher.md).

## Research and application

The [Three.js color-management manual](https://threejs.org/manual/pages/color-management.html) informed linear material/instance colors, sRGB color maps and non-color normal/roughness maps. The [physical-material documentation](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) informed modest roughness/specular response and avoiding additional expensive optical features on tiny droplets. The lamp-response limits are an explicit artistic calibration, not a physically measured blood shader.

[Blender relative shape keys](https://docs.blender.org/manual/en/4.2/animation/shape_keys/shape_keys_panel.html), the installed Blender exporter and bundled GLTFLoader informed independently resettable compression and lag targets. [Spring physics](https://gafferongames.com/post/spring_physics/) informed damped settling; the runtime uses bounded analytic envelopes rather than claiming a soft-body solver. [Three.js animation actions](https://threejs.org/docs/pages/AnimationAction.html) and [skinned meshes](https://threejs.org/docs/pages/SkinnedMesh.html) informed pose restoration and preserving source binds. [Valve's L4D AI presentation](https://cdn.akamai.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf) supports separating locomotion/animation presentation from authoritative gameplay. [ShaderMaterial documentation](https://threejs.org/docs/pages/ShaderMaterial.html) was checked for the rendering workflow; the final gas flare reuses ordinary textured materials.

These are primary technical references. Their applicability to this game's specific anatomy and art direction is an engineering inference, checked against actual source geometry and captured runtime frames. The newer Blender manual describes concepts; generation used installed Blender 2.93. In this bundled loader, morph POSITION/NORMAL load, but morph TANGENT deltas do not; the GLB retains them for interchange while runtime uses base tangents and morphed normals.

## Skill-loading ledger

Loaded means the local SKILL.md was read, not a slash invocation. Skill root: `C:/Users/wolfk/.codex/skills/`.

| Skill | Work performed |
| --- | --- |
| threejs-game-director | Phase/evidence coordination; required independent agent work |
| threejs-gameplay-systems | Preserved input, damage boundaries, authority and restart lifecycle |
| threejs-aaa-graphics-builder | Source/neutral/runtime comparisons, material and geometry gates |
| threejs-game-ui-designer | Desktop readability review; existing newer HUD preserved |
| threejs-debug-profiler | Pose/resource/camera diagnosis and measured renderer receipts |
| threejs-qa-release | Build, primary journey, input, canvas, screenshots and regression checks |
| threejs-procedural-animation | Absolute semantic clocks, bounded release motion and pose restoration |
| threejs-procedural-vfx | Fixed pools, analytic motion, ownership and HDR contribution |
| threejs-3d-generator | Sourcing workflow loaded; retained existing Meshy characters and Blender-authored anatomy |
| threejs-image-generator | Sourcing workflow loaded; native ImageGen used for the new decal atlas |
| threejs-audio-generator | Sourcing workflow loaded; existing bundled library reused and measured |
| develop-web-game | Installed client exercised in two independent input/capture bursts |
| imagegen | Native image generation and preservation/conversion workflow; `C:/Users/wolfk/.codex/skills/.system/imagegen/SKILL.md` |

Independent responsibilities: chest_mechanics owned NPC/action animation and its tests; corpse_physics owned the additive survivor grip and reviewed runtime captures; heart_art owned Blender anatomy/soft-tissue authoring and its tests. Root integrated effects, materials, camera and lifecycle changes. No user-owned side chats were created.

## Reference ledger

The following local references were read under the skill root:

| Skill | References |
| --- | --- |
| gameplay systems | `references/gameplay-workflows.md` |
| AAA graphics | `references/visual-scorecard.md`, `implementation-blueprint.md`, `model-recipes.md`, `render-recipes.md`; `references/checklists/{material-lighting-quality,performance-safe-visual-detail,procedural-model-quality,aaa-visual-scorecard,aaa-game-quality-gate}.md` |
| UI | `references/ui-patterns.md` |
| debug/profile | `references/debug-profile-checklists.md`; `references/checklists/{scene-debugging,performance-profile}.md` |
| QA/release | `references/qa-release-checklists.md`; `references/checklists/{visual-verification,playtest-qa,release}.md` |
| procedural animation | `references/procedural-motion-and-docking-systems.md` |
| procedural VFX | `references/procedural-vfx-system.md` |

The image/audio/3D SKILL.md sourcing guidance was also read. Earlier nonexistent candidate reference paths were corrected; they are not counted as loaded. Primary online sources are linked above.

## External asset sourcing

Chosen sources use existing authored assets plus a new generated decal. No paid provider jobs were submitted in this iteration.

| Category | Chosen sources and integration |
| --- | --- |
| Hero/player | Existing `assets/survivor/tld-survivor-v02.glb`; isolated additive grip controls and existing arm IK |
| Obstacles/enemies | Existing `assets/models/afterlife-ash-witness-rig-v05.glb`, its preserved six clips and jaw/grips; existing variant/locomotion systems |
| Rewards/interactables/signature anatomy | Blender `assets/models/chest-anatomy-v2.glb`; existing generated tissue swatches with revised de-lit albedo/roughness/normal maps; existing equipped firearm clone |
| World/sky/background | Current bundled dungeon kit, textures, lighting and bodycam presentation preserved |
| Materials/textures/decals | Native ImageGen source → `assets/textures/blood-residue-atlas-v3.webp`; original PNG archived and conversion/hash recorded in `art/combat-realism-v1/blood-atlas-v3-manifest.json` |
| UI/logos | Current compact HUD and menus preserved; no new generation |
| Audio | Existing 128-sample bundled library, including `assets/audio/sourced/weapons/carrion-sks-01.ogg` and `assets/audio/sfx/processed/carrion-auto-rifle.wav`; decoded keys are recorded in the audio receipt and exact source paths remain in the existing manifest. No new audio asset or licensing claim |

The 3D generator, image generator and audio generator workflows were considered alongside existing assets. Native ImageGen was the available generation path used; Tripo/Gemini/ElevenLabs were not called. The earlier 23-credit Meshy authorization was not spent again.

Credential probe output from the actually executed director `scripts/probe_asset_credentials.sh` in Git Bash:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

That packaged script prints an empty value for unset variables. This is evidence about that Bash environment, not a global Windows credential inventory. No secret values were printed. Blender authoring and native ImageGen did not require those keys.

## Phase ledger

| Phase | Result and practical limit |
| --- | --- |
| Gameplay systems | Canonical timing/eligibility retained; hit contact, natural shot→V, escapes, fatality, restart and settings checked |
| AAA graphics | Bounded hand/anatomy/effect improvement accepted in reviewed frames; whole-game premium gate remains unmet |
| UI | Current desktop HUD preserved, including concurrent compact labels; no mobile support added |
| Debug/profile | Camera accumulation, coat occlusion, near-black organs, oversized drops, obsolete guest targets and instance disposal corrected; diagnostics recorded |
| QA/release | Source/build verification, CPU suite, separate headless browsers and visual review; local iteration only, no deployment |

## Physics, resources and performance evidence

The existing physics engine remains bundled MIT `cannon-es 0.20.0`: fixed **60 Hz timestep**, 15 source-bone collider proxies / 14 joints per supported ragdoll, four active ragdolls and twelve drops. Camera clearance uses those fitted boxes as presentation constraints. Collision remains cosmetic rigid floor/wall contact; no deformable tissue/cloth collision or gameplay damage from ragdolls is implied.

The v2 kit reduces triangles **23,280 → 21,508**, retaining two draw groups, one material and three embedded 1024×512 maps. Bytes increase **2,675,712 → 3,618,192** due to authored shape data. Heart compression/vessel maximum source deltas are 7.68/6.91 mm; wound tension is 4.52 mm. Procedural tissue delta is bounded to 25 mm. Source bounds and UVs are preserved, and owned morph textures/geometries are released on cleanup. Three player organ instances use native per-instance morph support in the actual bundled `three.core.js`.

Blood pool limits are 160 impact droplets, 48 counter droplets, 36 injury droplets and 260 ordinary combat droplets, each pool sharing its geometry/material. No new mesh or geometry is allocated per droplet per frame. The weapon flare reuses one texture for its layers. Native instance buffers are explicitly disposed.

Representative before/after chest renderer counts and pickup/floor measurements are recorded in the final verification JSON. Counts include view-dependent shadow-cache updates and different active objects; they are not a uniform FPS improvement claim. The 16-actor animation/world-matrix Node benchmark was 0.611 ms, excluding GPU/browser rendering. Actual browser diagnostics are captured; they do not certify a hardware FPS target or physical controller.

At the recorded pickup view, calls were **278 → 275**, triangles **367,146 → 366,238**, geometries **1,055 → 1,055** and resident textures **132 → 134**. The final wrist-to-firearm target gap was **10.36 mm** versus **7.59 mm** in the baseline; grasp shape/readability improved, but this sample does not establish an accuracy improvement. Other repeated captures vary with the simulated drop pose. Source-skin floor checks pass within the documented tolerance.

## Visual scorecard

Scores use the loaded 0–3 skill rubric. This is a bounded comparison of captured combat views and source evidence, not a fresh whole-campaign audit. Existing world/reward categories retain their prior shortcomings.

| Category | Before | After | Evidence / remaining gap |
| --- | ---: | ---: | --- |
| Art direction | 2 | 2 | Bodycam/dungeon palette retained; source quality uneven |
| Hero/player | 1 | 2 | Better grasp/IK/pickup framing; fused digits and broad tattered cuffs |
| Obstacles/enemies | 1 | 1 | Better motion; shared coarse face/silhouettes remain |
| Rewards/interactables | 1 | 1 | Existing weapons/pickups preserved; no complete pickup-art revision |
| World/environment | 2 | 2 | Current textured routes retained; no comprehensive environment revision here |
| Materials/textures | 2 | 2 | New blood atlas and mottled anatomy; sculpt/cloth still stylized |
| Lighting/render | 2 | 2 | Organs/drops readable under lamp; intentionally dark exposure and view limits |
| VFX/motion | 1 | 2 | Canonical attack contact, compression, sag, blood and gas-flare refinement |
| UI/HUD | 2 | 2 | Current compact desktop HUD remains readable |
| Performance evidence | 2 | 3 | Bounded pools, ownership, source/build hashes and measured diagnostics |
| **Average** | **1.6** | **1.9** | Below the 2.3 premium threshold and several categories below 2 |

Automatic failures remaining for a premium claim: limited enemy silhouette variety, uneven world/interactable art, fused source digits, angular/tattered source sleeve silhouette and schematic anatomy/regular intestinal coils. No photorealism or "nothing primitive" certification. The next art pass requires authored separate digit/cloth topology and more anatomically grounded sculpting, followed by the same neutral/runtime checks; additional overlays cannot supply that topology.

## Verification and evidence

Build and **427/427 CPU tests** pass. Final browser journeys pass: 16 chest views/13 checks plus 90 temporal frames, 17 existing counter views, 31 injury views, 14 controller checks, all eight weapon poses, three enemy contact tempos, two installed-client input bursts and local WebRTC transport. The separate live-combat run exercised actual input for 120 seconds. Final console/page errors and HTTP failures are empty in browser receipts. Injury canvas readback records nonblank pixel spread, color buckets and lit samples; the weapon review also records nonblank center pixels. These results establish the stated local journeys, not every map or hardware configuration.

The final audio probe decoded all **128 sources** and exercised the existing runtime filters/compressors. Its dense four-second combat mix peaked at **0.727 / −2.77 dBFS**, below the 0.95 headroom gate. Master/voice mute, SFX mute tolerance, nearby-threat priority, a three-attack-voice budget and rendered weapon-bus duck/restore **1 → 0.76 → 1** pass. Source variant selection can change the exact mixed peak. This is measured mix regression, not listening certification on every playback device. Local two-context WebRTC transport passed with a measured 1 ms host RTT.

Final detailed status and hashes: `output/playwright/combat-realism-v1/verification.json`. Browser evidence is kept separately from earlier accepted work:

| Journey | Receipt |
| --- | --- |
| Source baseline | `baseline-chest/report.json` |
| Final chest + 90 sampled frames | `blood-final-chest/report.json`, `blood-final-chest/independent-visual-review.json` |
| Existing chop/twist/rip counters | `counters-clean/report.json` |
| Final injury / all weapons | `injury-final-accepted/report.json` |
| Controller / eight-weapon poses | `controller/report.json`, `weapons/report.json` |
| Enemy contact/live play | `enemy-motion/qa-results.json` (120 seconds actual input); `enemy-final/qa-results.json` (final effects) |
| Installed game client | `skill-client/` (two input bursts, screenshots and state) |
| Decoded/rendered audio mix | `audio/after.json`, `audio/after-mix.wav` |
| Local transport | `local-network/command.log` |
| CPU suite | `cpu-tests-final.txt` |

All paths in the table are below `output/playwright/combat-realism-v1/`. Rejected intermediate folders remain as evidence: nearly black heart, coat-camera occlusion and oversized dark drops were corrected before bounded acceptance. Neutral Blender/export/import receipts remain under `art/chest-anatomy-v2/`. The final independent receipt includes actual inspected image hashes and scope limits; temporal sampling is not a claim that every frame was independently inspected.

The earlier `counters/` forced fixtures retained prior twist debris while snapshot clocks skipped ahead; its rip views showed that old head mid-flight. Final `counters-clean/` starts the existing visual run-boundary cleanup for each synthetic action, producing isolated action evidence. Live gameplay debris persistence is unchanged.

The old injury test still emits legacy portrait captures; these are incidental regression evidence, not mobile acceptance or added support. Desktop, keyboard/mouse and browser-standard controller integration are the requested platform scope. Physical hardware controller, external PeerJS signaling and an entire campaign completion are not certified by these runs.

Reproduction uses Node, bundled runtime assets and local Playwright/Chrome overrides:

```powershell
$env:PLAYWRIGHT_PATH='C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CHROME_PATH='C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
node build.mjs
$unitFiles=@(rg -l 'node:test' -g '*test.mjs' -g '!vendor/**' -g '!dist/**' -g '!node_modules/**')
node --test --test-isolation=none $unitFiles
$env:CHEST_TEMPORAL='1'; node tests/chest-finisher-browser.mjs
node tests/brutal-combat-browser.mjs
node tests/player-injury-browser.mjs
node tests/controller-browser.mjs
node tests/combat-motion-browser.mjs
node tests/chase-impact-game.mjs
node scripts/run-v2-skill-client.mjs
node tests/audio-v2-mix.mjs
node tests/network.test.mjs
```

Root used distinct output environment overrides so old accepted receipts remain intact. Browser jobs run sequentially with isolated tabs/processes and ephemeral test servers, except the source review/client uses the preserved `http://127.0.0.1:5200/` server. Build excludes `.art-source`, authoring proofs, docs, tests and temporary adapters. Original v1 heart, source zombie and survivor hashes are guarded in the final receipt. No source-server restart, user-tab reload, paid provider job, commit or deployment was performed.
