# Implementation ledger

## Phases and owners

| Phase | Owner | Delivered contract |
| --- | --- | --- |
| Direction and preservation | Root + adversarial design reviewer | Five chapters in the existing world; combat and collected assets retained; explicit transfer-containment ending. |
| Gameplay | journey_gameplay | Authoritative deterministic chapter actions, bounded story state, navigation integration, final exit gate, peer relocation/revival foundations. |
| Visuals | journey_visuals | Five locally authored articulated supporting mechanisms with pooled/merged static parts and deferred world disposal. |
| UI and input | Root | Q, independent controller View/Select, contextual touch hold, persistent transmissions and pause archive; existing action bindings retained. |
| Integration and QA | Root + adversarial reviewer | Build includes all modules; engine routes, fixtures, desktop/mobile captures and current arena transport checked separately. |

All workers were explicitly scoped and instructed to preserve other changes. Existing uncommitted lighting, corpse physics, cut-preview, loading and performance work was retained. The adversarial reviewer used the saved gameplay-director, horror-coherence and ruthless-creative-director briefs in a read-only default agent role.

## Skills and references applied

- Three.js Game Director: phase orchestration and asset/verification gates.
- Gameplay Systems: `gameplay-workflows.md`, `physics-engine-selection.md`; retained the existing custom collision engine.
- AAA Graphics Builder: `visual-scorecard.md`, `implementation-blueprint.md`, `model-recipes.md`, `render-recipes.md`.
- Game UI Designer: `ui-patterns.md`, `game-ui-quality.md`, `hud-readability.md`, `responsive-ui-fit.md`, `mobile-input.md`.
- Debug Profiler: `debug-profile-checklists.md`, `scene-debugging.md`, `performance-profile.md`.
- QA Release: `qa-release-checklists.md`, `visual-verification.md`, `playtest-qa.md`, `release.md`.
- Procedural Geometry: `profile-sweeps-and-mesh-writers.md`.
- Procedural Animation: `procedural-motion-and-docking-systems.md`.
- Playwright: isolated headless pages, no interaction with the user's existing tab.
- Three.js 3D, Image and Audio Generator instructions were read before asset decisions; Audio `audio-workflows.md` was consulted. This change reuses the existing imported hero/enemy/weapon assets and sourced audio, and adds authored supporting mechanisms. No unavailable-generation claim or new asset service was needed.

## Asset source and ownership ledger

| Surface | Source | Use |
| --- | --- | --- |
| Existing characters, weapons, animations, gore/VFX | Bundled repository runtime assets/modules | Preserved; new chapter machinery does not replace them. |
| Five worlds, architecture, lamps and landmarks | Existing dungeon course/art-direction and world modules | Preserved; station colors follow each floor's palette. |
| Pump, isolation relays, name casket/socket, chimes, transfer brake | Authored in `journey-visuals.js` | Supporting operable props; per-material static merging, small dynamic actuator groups. |
| Station instruction plates and pressure dial | Local CanvasTexture / authored mesh detail | Created once per floor; disposed with the outgoing world; no per-frame raster creation. |
| Chapter action mechanical sounds / three pitched bell notes | Existing bundled `mechanism` / `wave` samples in `assets/audio-manifest.js` | Quiet spatial one-shots at station actions; obey existing group volume/mute controls. |

`.art-source` remains preservation storage, not runtime input. Runtime/build require no new packages or external services.

## Adversarial findings resolved

- Lore-only sequence risk: each chapter now advances through its own action sequence and visible mechanism aftermath; ordinary encounter queues remain authoritative.
- Navigation overriding chapter goals: journey targets participate in the existing reachable-path policy and are tested against displayed objectives.
- Final automatic victory: signature completion, ordinary clearance and threshold departure are required; shutdown cannot be bypassed by a key alone.
- Nearby corpse hiding OPERATE: chapter prompts remain available alongside a corpse candidate; active extraction/bite/finisher retains presentation priority.
- Pump crowding/bright gauge and shiny ward/bell/casket: smaller recessed assemblies, lower plates, charcoal dial, local matte color calibration; global lighting retained.
- Pump rotation jump and shutdown reversal: continuous committed-turn/cycling angles and analytically integrated deceleration.
- False living-rescue implication: ending describes restored identities and released records, with no unimplemented escort claim.
- Stale revived movement: transient motion/actions cleared without granting new weapons.
- Crypt operation obstructed by existing bone architecture: moved the recovery station to the clear cell at (6.5, 6.5), with a larger landmark clearance. The focused capture shows the casket, plate and operating area; the final adversarial review accepted the playable campaign foundation with no remaining actionable design blocker.

## Evidence and limits

The final unit run reports 631 passes and zero failures. Browser tests exercise real keyboard, touch and controller intent, source scene lifecycle, five mechanism phases and current arena WebRTC. Combat-resolved fixtures and automated enemy defeats are labeled in their tests. A prior test-harness audio mock lacked the listener helpers used by the current runtime; the fixture was corrected. The older melee browser readiness check was corrected to wait for application initialization in the cinematic menu, then weapon readiness after entry.

Public PeerJS registration/loading attempts timed out in the end-to-end arena fixture. Local direct WebRTC passed at 1 ms host RTT. A signaling-only local broker fixture uses the bundled PeerJS OPEN/OFFER/ANSWER/CANDIDATE protocol and the existing test configuration override; all actual gameplay still crosses real RTCDataChannels. Its final arena run passed chunked payloads, bat attacks, coalesced trigger/switch inputs, saw release, pause and disconnect with zero browser errors and zero rejected transport messages. The extended soak was skipped. It is a QA fixture, not a runtime dependency or a change to production signaling. Results are recorded separately; public service availability is not implied.

After the final crypt placement change, 22 focused journey, visual, presentation, signaling and vermin checks passed. The five-chapter keyboard browser run, focused crypt capture, touch hold/cancel, simulated controller intent through the live input bridge and portrait/landscape layout checks also passed. The final build succeeded.

No premium/AAA release claim is made. These chapter mechanisms are a playable campaign foundation; large environmental consequences and human pacing/feel evaluation still merit further art and playtesting work.

### Active-play scorecard

Scale: 0 placeholder, 1 basic styled, 2 premium stylized, 3 showcase. Assessed from refreshed chapter and desktop/mobile active-play captures with source/budget evidence; preserved enemy variants also have the existing regression suite. This evaluates this delivery conservatively, not the game's potential.

| Category | Score | Evidence / remaining limit |
| --- | --- | --- |
| Art direction | 2 | Five floor identities affect materials, machinery forms, signals and story. |
| Hero/player | 2 | Imported survivor and authored weapon presentation retained; first-person silhouette remains clear in revised captures. |
| Obstacles/enemies | 2 | Existing authored variants, encounter staging and animation preserved; chapter screenshots use combat-resolved fixtures. |
| Rewards/interactables | 2 | Distinct operational machinery, state motion, pickups and contextual affordances. |
| World/environment | 2 | Existing layered architecture, landmark, room and prop kits preserved. |
| Materials/textures | 1 | New mechanisms have coherent material roles and calibrated highlights; richer wear/texture detail remains. |
| Lighting/render | 2 | Existing bodycam/lighting preserved; new surfaces calibrated locally after exposure critique. |
| VFX/motion | 2 | Existing combat effects retained; event-driven mechanism animation respects reduced motion. |
| UI/HUD | 2 | Responsive contextual controls and persistent chapter/archive communication. |
| Performance evidence | 2 | Bounded added meshes/triangles, disposal tests, renderer diagnostics, build and browser checks; no target-frame-rate claim. |

Average 1.9. The premium gate (every category at least 2 and average at least 2.3) has not been met; completion here means the playable chapter implementation and preservation contract, not final high-fidelity certification.
