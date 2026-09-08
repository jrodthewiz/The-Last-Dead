# Build 06 / Reliquary

The Last Dead remains standalone in Desktop/thelastdead. This release adds three arena sectors, nine authored waves, paced and telegraphed reinforcements, enemy mutations, a bone rocket launcher, explosion shaders, and locally bundled CC0 sound effects and ambience.

## Gameplay and controls

The Bloodworks introduces basic pressure; the Ossuary mixes faster and armored variants; the Choir of Teeth combines ranged pressure and Bellwraith encounters. The director uses deterministic queues, active-enemy caps, safe spawn anchors and intermissions. Clear the current sector and enter its exit to descend. The third exit completes the campaign.

Weapon 4 is the Reliquary. Primary fire launches a travelling rocket; alternate fire detonates the owner's live rocket. Splash falls off with distance, respects walls, and supports rocket jumps. The Ossuary receives additional recoil, heat and muzzle feedback. Existing coin, core, arc, parry and tether combinations remain available.

Audio includes weapon fire, impacts, footsteps, jumping/landing, enemy attacks/deaths, explosions and looping ambience. It unlocks on interaction, follows pause/resume and volume settings, and retains procedural fallback layers. See [sources and licenses](audio-sources.md).

## Reference and asset ledger

- Gameplay: existing project movement/combat contracts and the user's fast Doom/ULTRAKILL-inspired direction. This is an original arena foundation; full ULTRAKILL parity is not claimed.
- Art: generated Bellwraith and Reliquary references in assets/concepts; image-to-procedural reconstruction specifications and evidence in [build06-art](build06-art/).
- Runtime models: authored Three.js geometry with animation sockets, recoil and enemy motion. No online generation service or credential is required to play.
- Sound: 25 bundled CC0 source files used by 35 manifest entries, with provenance in audio-sources.md. All source files decode successfully; all 35 entries decoded in Chrome.
- Workflow: game director, gameplay, img2threejs, UI, audio, graphics/VFX and QA skill references informed their respective implementation slices. Reconstruction visual reviews remain distinct from geometry smoke tests; strict reference-fidelity certification is not claimed.

## Verification

- 26 combined engine, campaign integration, model and survivor checks passed. The campaign test clears all nine waves through simulation ticks and actual shots, including spawn safety and final victory.
- Guest rocket splash attribution regression fixed and covered by integration tests.
- Real two-context WebRTC transport passed. Internet-wide NAT compatibility is not certified; no TURN relay is provisioned.
- Isolated Chrome verifies rendering, input focus/pointer lock, actual rocket firing, shader compilation, audio decoding and pause/resume. The user's existing browser tabs are preserved.
- Nine model review views are recorded in [build06-reviews](build06-reviews/). Controlled scenes are visual evidence, not claims of a complete human campaign playthrough.
- Production build uses an explicit runtime manifest; required new imports fail the build if absent. Server checks cover public PORT binding and module delivery.

Final browser/co-op evidence is recorded in [campaign QA](build06-qa.md) and the build06 game review artifacts alongside this report.

## Visual assessment and remaining scope

| Area | Assessment |
| --- | --- |
| Art direction | Cohesive industrial horror and bone/bronze weapon language |
| Hero/player | Existing survivor/first-person integration preserved; automated articulation checks pass |
| Enemies | Four families plus mutations; Bellwraith silhouette receives a separate reference review |
| Rewards/interactables | Blood healing, coins and sector exits retain gameplay feedback |
| World/environment | Three arena layouts and sector material/lighting identities; larger traversal maps remain future work |
| Materials/textures | Stylized procedural models; reference-level sculpt and surface detail remain a quality target |
| Lighting/rendering | Existing horror lighting with compiled explosion shaders; hardware coverage remains limited |
| VFX/motion | Pooled fire, smoke, embers, shockwaves, recoil and owner-visible rocket effects |
| UI/HUD | Four weapon slots, sector route, wave pressure and intermission state; mobile menu checked at 390 px |
| Performance | Browser diagnostics recorded; broad device certification and a locked frame-rate target are not claimed |

Bosses, full weapon-tech parity, matchmaking, host migration and larger traversal levels are outside this release. Screenshots and measured checks support the delivered slice; the project is not represented as a finished commercial game.

## Skill-loading ledger and phase ledger

| Phase | Applied references | Result |
| --- | --- | --- |
| Gameplay systems | threejs-game-director, threejs-gameplay-systems | Deterministic campaign and owner-aware rocket combat implemented; simulation regressions pass |
| AAA graphics direction | img2threejs, procedural VFX and renderer references | Concepts, procedural model passes and pooled shader effects; stylized scope, no AAA fidelity claim |
| UI | threejs-game-ui-designer | Campaign route, four-weapon HUD and responsive menu integrated |
| Audio | threejs-audio-generator and source licenses | Bundled CC0 assets selected; fetch/decode and fallback mixer verified |
| Debug/profile | threejs debugging and visual diagnostics | Isolated Chrome focus, shader compilation and runtime diagnostics checked |
| QA/release | threejs-qa-release | Automated campaign/model/server checks, browser review, explicit asset packaging and Railway release verification |

Final isolated Chrome pass: desktop and mobile completed with no page/console errors; all 35 audio entries decoded; pointer lock and weapon 4 firing produced a real explosion pool (fire, smoke, embers and shockwave). The final report is docs/build06-game-results.json. One Warden fetch aborted during scene replacement after its ready state; no persistent asset load failure remained.

Performance limitation: this automated browser used SwiftShader software rendering, measured 0.56 FPS over the 30-second sample, and cannot establish hardware-accelerated playability. The scene measured 161 draw calls and 40,812 triangles on desktop. A hardware browser performance pass remains outstanding; this release is a playable development build, not performance-certified.
