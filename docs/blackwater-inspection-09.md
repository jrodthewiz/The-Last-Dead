# Blackwater inspection 09 — a genuinely playable upper floor

CAPE LODGE 75 now has a continuous two-flight staircase, an upper landing and a bedroom with a bed, writing desk and packed trunk. This is a bounded gameplay and structural change at world158/248 m. Only this house has an explorable upper storey; all94 coastal ground-floor interiors remain accessible. The graphic-horror art target remains active. The new upper rooms are visibly less finished than the authored radio corner downstairs.

## Actual game screenshots and access

- [Stair entrance](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-09-stairs-entry.jpg)
- [Turning landing](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-09-stairs-turn.jpg)
- [Real opening viewed from upstairs](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-09-stairs-down.jpg)
- [Upper landing room](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-09-upstairs.jpg)
- [Upper bedroom](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-09-bedroom.jpg)
- [Upper writing desk](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-09-desk.jpg)
- [Retained radio repair corner](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-09-radio.jpg)
- [Town](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-09-town.jpg)
- [Portrait cottage](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-09-mobile.jpg)

These are native WebGPU game screenshots, resized/compressed without exposure enhancement. Desktop delivery is960×600; portrait is390×844. The nine files are30–82KB and use absolute paths for Codex Remote. Original PNGs, six320×200 stair/upstairs previews and pixel evidence are in `output/playwright/blackwater-09/final-03`. Correctly extracted scene crops have RGB standard deviations14.85–24.16, confirming nonblank canvas content beyond the HUD.

The local game remains [127.0.0.1:5200](http://127.0.0.1:5200/). Cape75 is south of the z232 road. WASD moves and mouse aims. The existing user tab/server were preserved; every browser check owned and closed its own ephemeral server and Chrome.

## One shared finite structure

`assets/blackwater-kit/cape75-structure.js` supplies290 serializable finite boxes,278 rendered boxes and12 finite lower-furniture collider proxies. Rendering, player/enemy clearance, support, bullets/projectiles and cosmetic Cannon statics consume these same bounds. Owned coarse grid walls and infinite furniture blockers are bypassed only for this house. Other addresses retain their established ground-floor authority. Closed upper windows and walls above the lower portals have finite height.

The lower floor is0.20m above terrain. The upper slab top is2.6475m; the13mm rug top is2.6605m. Four slab pieces surround a real opening at localx[-5.46,-2.00],z[-.65,3.05]. Fourteen treads rise174.821mm each with300mm run and1.60m clear width; the turning landing is at world1.42375m. Upper ceiling contact uses the finite underside. Terrain stays terrain and never encodes upstairs height.

Centre-owned support prevents stationary actors from climbing merely because their radius overlaps a higher tread. Each step rise is bounded to0.20m. Stair contact distinguishes ankle/foot clearance from the full torso radius; walls and rails retain the full player/enemy clearance. The first lower rail returns provide a measured0.66m lateral approach for the unchanged0.64m enemy radius beside the unchanged radio desk.

Enemies retain world navigation until they enter the house, then use the shared stair path when their target is on another floor. The actual existing movement loop passes a street-to-upstairs pursuit and descent. This verifies one scoped route, not every archetype, crowd or multiplayer encounter.

Rifle and shotgun traces and rocket segments hit the same slab; short segments pass through the actual opening. The slab blocks blasts between floors. Enemy/player eyes and render bases use actor support. Blood, pools, loose gore and detached limbs retain their own floor. Cannon uses the same290 boxes; previous-bottom support sweeps prevent tested fast drops from tunnelling through slabs while preserving bodies below them and the open stairwell. This is bounded contact correction, not a general CCD engine replacement.

## Construction cost and retained content

Controlled source geometry grows31,439→33,143 triangles, **+1,704**, with15 material submissions retained. Native seed1474 has33,224 triangles versus31,520 in08. Existing lower cloth, original Blender v2 arms/holds and the repair station remain. The radio desk and discovery anchor are unchanged. The model retains13 legacy furniture metadata entries, while this house's runtime uses12 finite proxies and its shared structural guard instead of the removed left partition.

All94 ground-floor routes and187 aperture regressions pass. Actual W still collects LODGERS’ RADIO REPAIR KIT: fittings0→4 and visible cases11→10. The coast retains378 licensed procedural trees, shared hills/river/bridges, five practical lights and the clean first-person resolve without REC, grain or lens distortion.

## Verification and native journey

`node build.mjs` passed. The movement/combat/interior/terrain/body regression group passed112 tests before the final thin-rug and NPC navigation corrections. The final focused structure/authority/all-interior/authored-cottage/physics group passed29 tests after the rug correction; the final six authority tests passed again after scoping street navigation. These groups overlap and are not added into a larger claimed total. Existing isolated WebRTC two-context transport regression passed. It does not certify open-world co-op, whose current UI still starts the campaign.

The authority checks include actual forward input through both flights and bedroom, dash/diagonal travel, stationary tread stability, two actors sharing horizontal coordinates on different floors, player falling through the opening, underside jump contact, rifle/shotgun/rocket contact, floor-specific effects and blast occlusion. Physics checks include the actual imported fifteen-body rig on both storeys, drops through the hole, fast impacts, tissue correction and rebuild/disposal ownership.

Native Chrome149.0.7827.55 loaded the final isolated built game in27,343ms. The final run passed40 desktop/portrait captures, real firing, five doorway archetypes, bridge travel, repair pickup and live shadow recentering. Console/page errors and HTTP failures: zero. Existing warnings: Windows ignores powerPreference; one zero-vertex draw notice. Portrait uses a desktop GPU viewport and does not certify phone hardware.

The upstairs journey starts once outside at158/237m. Actual held W, aim-only steering and the real1/120s tick reach24 ascent waypoints and25 return waypoints. Rendering is deferred between waypoint screenshots. Coordinates, floors and activeInterior are never reassigned during the journey. The enemy cohort is temporarily empty for this input check; actual enemy movement is separately verified by source simulation. The player stands on the bedroom rug at2.6605m and exits onto terrain at0m. Six captures show intermediate stairs/upper rooms from that journey.

Attempt01 found the real13mm rug obstruction and was preserved as a failed predecessor in `final`. Its corrected support passes attempt02. Attempt03 binds the final NPC navigation code to a fresh frozen build. All26 captured runtime/source hashes match current source; the reviewer’s attempt02 visual source hashes match final03. Evidence: `final-03/cape-report.json`, `final-03/delivery-pixels.json`, `source-snapshot-check.json` and `review-visual-source-check.json` under `output/playwright/blackwater-09`. Native command is `node tests/cape-exploration-browser.mjs` with explicit PLAYWRIGHT_PATH, CHROME_PATH and CAPE_QA_ROOT/OUTPUT/LABEL overrides.

## Measured rendering

At1280×800/DPR1, the final same-build measurements use22 submit-fenced stationary scene/first-person samples after eight discarded samples. They are not total gameplay FPS.

| Configuration | Draws | Triangles | Median | P95 |
| --- | ---: | ---: | ---: | ---: |
| Original static details | 1,040 | 1,664,856 | 28.7ms | 32.7ms |
| Pooled static details | 928 | 1,664,868 | 30.2ms | 40.0ms |
| Pooled town repeat | 928 | 1,664,868 | 29.7ms | 35.2ms |
| Forest | 216 | 818,133 | 14.6ms | 15.5ms |
| River | 250 | 960,466 | 16.4ms | 22.4ms |

Pooling still removes112 native submissions, but these timings do not prove a speed increase. The preceding successful attempt02 had a town median24.8ms; run variation remains material. Tracked memory is896,302,369 bytes (~855MiB). Building batching remains1,250→484 submissions in35 chunks, now2,008,995 triangles. A normal three-second W walk travels22.07m and causes three cached shadow recenters. The bridge camera remains1.60m above its shared ground/deck authority. Sustained combat and a declared phone frame budget remain unverified.

## Exact visual scorecard and next art boundary

A focused read-only reviewer inspected the actual stair, upper-room and retained lower-cottage images. Shared visual-source hashes bind that review to final03 geometry. Vertical exploration is meaningful, but the upstairs is visibly a blockout beside the stronger downstairs radio station.

| Exact category | Score /3 | Evidence and limit |
| --- | ---: | --- |
| Art direction | 2 | Graphic palette retained; new large faces remain uniform. |
| Hero/player | 2 | Existing clean Blender arms/holds retained. |
| Obstacles/enemies | 1 | Scoped stair pursuit works; polished hostile roles not established. |
| Rewards/interactables | 1 | Useful radio kit retained; broader variety remains unproved. |
| World/environment | 2 | Real continuous upper floor; its visual finish remains weak. |
| Materials/textures | 2 | Retained construction maps; bare upper panes and box furniture. |
| Lighting/render | 2 | Lower task-light hierarchy retained; upstairs lacks a focal source. |
| VFX/motion | 1 | Shared-floor effects tested; polished combat sequence unproved. |
| UI/HUD | 2 | Journey/kit feedback and portrait fit pass. |
| Performance evidence | 2 | Native counts/fences; sustained combat/phone gaps remain. |

**Average1.7/3. Automatic failures: confirmed local primitive dominance** in the stair guards and upstairs. This is not a whole-game verdict or AAA completion. The next bounded art changes should be a constructed continuous handrail/posts, one framed/silled window bay and one interrupted upstairs activity connected to the radio repair. Counterevidence: the current guards protect a readable route; window bay spacing establishes the envelope; bed/desk distinguish room functions. Acceptance tests: readable constructed stairs at320pixels while traversal stays intact, standing window recognition matching its exterior, and fresh-player recall of one deliberate upstairs event. Extra darkness or more scattered boxes would not establish these results.

## External sourcing, audio and ledgers

Credential probe output: the current Windows presence-only Process/User/Machine probe prints no values:

```text
TRIPO_API_KEY=MISSING
GEMINI_API_KEY=MISSING
ELEVENLABS_API_KEY=MISSING
```

3D generator, image generator and audio generator skills/API integration references carry forward from06–08. Generation remains blocked by credentials; none was attempted. Chosen sources: hero/player keeps original editable Blender v2 masters/runtimeGLB; enemies and weapons keep bundled authored/imported assets; signature props/pickups use original Blackwater geometry; world/sky/background retain original terrain/sky and licensed [EZ-Tree](https://github.com/dgreenheck/ez-tree); materials/textures/decals retain painted roles/licensed bark and leaves; logos/icons/GUI retain authored UI. Audio/SFX/voice retain existing game audio; no new audio-quality acceptance is claimed. No proprietary game code/assets were copied.

Skill-loading ledger: director, gameplay systems, AAA graphics builder, UI designer, debug/profiler, QA/release and3D/image/audio generator phases carry forward from [08](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-inspection-08.md) and linked earlier ledgers. The director's explicit phase-delegation instruction authorizes focused structure, cosmetic physics and read-only visual review. No full council or profile impersonation was requested.

Reference ledger: root read `threejs-gameplay-systems/references/gameplay-workflows.md` and `physics-engine-selection.md`; structure/physics phases used the same bounded authority contract and procedural architecture grammar/compiler/material references. Relevant loaded phase references remain implementation-blueprint.md, material-lighting-quality.md, performance-safe-visual-detail.md, visual-scorecard.md, model-recipes.md, render-recipes.md, aaa-game-quality-gate.md, aaa-visual-scorecard.md, ui-patterns.md, UI fit/readability checklists, debug-profile-checklists.md, performance-profile.md, qa-release-checklists.md, visual-verification.md, playtest-qa.md, release.md, generator API/integration/workflows and audio-workflows.md. Expanded paths under C:/Users/wolfk/.codex/skills remain in preceding ledgers.

## Phase ledger

| Phase | Bounded output | Broader status |
| --- | --- | --- |
| Gameplay systems | Finite shared upstairs, pursuit, impacts and supports | Other upper floors/crowds/co-op remain work |
| External asset sourcing | Presence probe/original structure geometry | Provider credentials missing |
| AAA graphics | Rendered playable structure; exact focused critique | Primitive gate remains |
| UI | Journey/repair feedback and portrait fit retained | Touch/phone not certified |
| Debug/profile | Native counts/fences, immutable hashes/pixels | Combat cost/memory remain work |
| QA/release | Source checks, native W journey and40 captures | No release/full-campaign certification |

Physics engine selection remains the custom arcade controller at a1/120s timestep plus bundled cannon-es0.20 for cosmetic bodies. The fully explorable-world and AAA visual goal remains active.
