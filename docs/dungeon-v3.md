# Dungeon direction v3: a place with a route

The v2 systems pass did not solve the overall composition: repeated tall cover hid the machinery, room roles did not define the route, the camera light dominated the image, and otherwise safe spawns still appeared in arbitrary places. This pass changes the map and encounter structure as well as its presentation.

## Applied direction

The descent is a ruined industrial and ritual complex. Each floor has a recognizable palette, a readable arrival, a sequence of named places, a useful equipment detour, and a concluding fight. The player should recognize the destination from its machinery and architecture before reading a label. Protect long views at junctions; place tactical cover on the flanks instead of building repeated slab mazes across every chamber.

Combat comes from the place: creatures stage beyond sight, walk along an authored approach, and cross a real doorway facing their travel direction. Use contact, reinforcement and final-push phases. Give nearby entrance movement an audible and readable cue. Keep enemy health stable and keep fighting frequent; extend the run through distinct places and combat developments rather than empty waiting or inflated health.

During combat the player holds a recognizable space. Between fights, guidance describes the next reachable turn. A player leaving the fight gets a return instruction instead of being sent after one straggler through unrelated rooms. Physical route strips follow the actual open path. Optional supplies remain useful, without being mandatory sightseeing.

Lighting belongs to fixtures and architecture. Warm practical pools and cooler depth reveal room forms; a camera-adjacent body light supplies local visibility. Steel arches should read as steel, not white halos. Large machinery changes from dormant to pressure to restored state when its encounter resolves. Preserve the grounded firearms, existing creature clips, audio mix and bodycam identity.

## Implemented changes

- Explicit route and room identity contracts across all five floors, with 6–7 required combat stops each. F1 now has 7 rather than 4, plus its optional shotgun/recovery branch.
- F1 shortcut gates respect approach milestones. F3 circulation follows its actual crypt loop. The final lift still requires the key and required encounters.
- Removed 18 isolated walkable floor pockets. Five important rooms reduce solid cover from 38 cells to 10; eight arrival-to-landmark/onward sightlines are tested. Gallery Crossing no longer has a central notch blocking its opposing entrances. Render geometry and collision come from the same edited source.
- Doorway ingress groups include exact half-cell portal centres, exterior staging paths, arrival headings and room ownership. No random floor residents or rise/drop arrivals. Co-op visibility, clearance, connectivity and door state are rechecked before commitment.
- Two or three pressure phases per encounter; required population totals are 111/108/123/156/136 across floors 1–5. Individual enemy health is unchanged. Concurrent room caps are 4–10, global cap 12. The first spawn measures 3.87s, physical entry 9.97–13.75s; approach can be seen/heard in the corridor before that.
- HUD route count follows required rooms. Guidance shows the immediate turn distance or tells the player to hold/return. Phase and entrance cues replace vague repeated goal text.
- Floor palettes survive the final material pass; structural arch crowns match their steel supports. Warm practical hues remain intact. The camera light now originates 0.25m ahead instead of 1.4m, with a broader cone and reduced intensity; this avoids inverse-square hotspots against close cover.
- Existing landmark rigs use separate controlled state surfaces and nearby practicals. Large membrane emission is restrained; route strips add one instance draw. Six active practical lights remain the budget; up to two now cover architectural fixtures ahead instead of being consumed by nearby lamps behind the camera.
- Viewmodel materials exclude the camera lantern while retaining their authored material bounce, key/rim lighting and point-light muzzle flash. This corrects the silver washout caused by moving the body light close to the camera, without another world render.

## Verification ledger

- Build passed with the new `dungeon-landmarks.js` runtime module.
- 39 focused map/topology/door/progression/composition tests pass, including five-floor movement, key/descent readiness, render/collision correspondence and new sightlines.
- 43 relevant engine/AI/flow/ingress/topology tests pass. These overlap the map suites and are not an additional 43 unique tests. New tests verify real room entry, portal crossing and heading, grounded height, door closure, co-op warning cancellation and phase release.
- Four HUD tests pass: route count, combat hold, immediate turn distance and existing progression states.
- Focused material/light/composition tests pass, including arch material classification, bounded lights, route markers and machinery states.
- Browser evidence: `output/playwright/dungeon-v3-before/`, `dungeon-v3-after/`, `dungeon-v3-play/`, `dungeon-v3-final-light/`. Final scene pixel sampling measures a central crop, excluding the edge HUD.
- The initial baseline capture completed its screenshots but recorded one `ERR_NO_BUFFER_SPACE` resource failure. The next isolated comparison passed with no browser errors; the failed baseline is not counted as a clean QA pass.

### Final local QA

- Production build passes. A three-minute actual keyboard/fire run with debug aim recorded 58 kills, 63 grounded doorway spawns, no deaths, and four cleared rooms (three required plus optional Sluice). It reached Foundry Hall, the fourth of seven required stops, while reinforcement phases continued. This verifies a longer opening route, not a promised human completion time.
- The run recorded no browser, HTTP or runtime errors. Desktop captures measured about 50-59 FPS and 335-353 draws; portrait measured about 47 FPS and 250 draws on this test machine. These are observations, not a device-independent performance guarantee.
- After the final light correction, seven matched desktop/portrait views pass shader compilation, error collection, scene-pixel checks and portrait overflow checks. Inspection confirms dark weapon metal is preserved, the court machinery and onward doorway are exposed, and steel arches no longer form white halos.
- Twelve final focused tests pass for practical selection, palette retention, landmark state, route cues, HUD behavior and viewmodel shader isolation. The latter preserves existing material hooks/cache identity and leaves the global world-light shader unchanged.
- A separate final Foundry Hall fixture runs live arrivals for 20 seconds and records five approaching creatures, 270 draws and about 60 FPS with no errors. `output/playwright/dungeon-v3-lighting/hall-approach.png` confirms the opened corridor and preserved dark gun surfaces. It also verifies viewmodel materials are not shared with world meshes. Distant creatures remain silhouettes at long range; this is still a dark horror treatment.
- Automated camera fixtures freeze/relocate the player for composition comparison; their objective text is not a campaign progression test. The separate live run supplies progression evidence.

## Skill-loading ledger and reference ledger

Continued the already loaded threejs-game-director workflow with gameplay systems, AAA graphics, UI, debug/profile and QA/release phases; existing workers owned map, encounter and visual files separately. The applicable skill/reference paths and asset-source ledger are in [v2 implementation report](v2-implementation-report.md). Gameplay/physics and graphics references were additionally reviewed by the phase workers. The existing grid collider and fixed timestep remain the physics engine choice.

External asset sourcing: chosen sources remain the bundled hero/player firearms, Meshy creature GLB, authored world/sky/background dungeon kit and materials/textures/decals. The 3D generator, image generator and audio generator were considered under the prior loaded sourcing workflow. No new generation or credit spend was needed to reveal and direct existing hero geometry. Existing high-value asset evidence: `assets/models/afterlife-ash-witness-motion-v04.glb` and `assets/textures/dungeon-enamel-wayfinding-v2.webp`.

Credential probe output remains the prior literal session result:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

Audio uses the existing measured mix and `assets/audio/ambience/ossuary-dungeon.ogg`; new ingress cues reuse its positional approach voice. No new recording or mix-level claims.

## Phase ledger and visual scorecard

Gameplay systems, map topology, UI, AAA graphics implementation and debug/profile are integrated. QA/release is local build/browser verification; no deployment, server restart or user-tab reload. The source and bundled assets remain self-contained.

Conservative 0–3 visual scorecard: art direction 2, hero/player 2, obstacles/enemies 2, rewards/interactables 2, world/environment 2, materials/textures 2, lighting/render 2, VFX/motion 2, UI/HUD 2, performance evidence 2; average 2.0. Automatic failures/limits: repeated creature silhouette and modular architecture remain. This is a stronger playable demo iteration, not a premium/AAA claim. Desktop and mobile portrait screenshot inspection, console/page error collection and renderer/canvas metrics establish the limits of automated verification; mobile touch play and a full human campaign run are not certified.
