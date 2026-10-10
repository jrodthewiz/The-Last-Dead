# Blackwater inspection10: constructed stairs and an upstairs listening room

CAPE LODGE75 now has open balustrades with continuous sloping handrails, framed upper windows, a constructed bed with folded/draped bedding, an open writing desk, headphones, a route sheet and a packed travel case. One warm desk lamp gives the upstairs activity a focal point. This is a bounded art revision at world158/248m. All94 coastal ground-floor interiors remain accessible; this house remains the only verified explorable upper storey. The full graphic-horror/AAA goal remains active.

## Actual game images for Codex Remote

- [Stair entrance](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-stairs-entry.jpg)
- [Opening and continuous rails](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-stairs-down.jpg)
- [Upper bedroom](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-bedroom.jpg)
- [Draped bedding](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-bed-close.jpg)
- [Listening desk](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-desk.jpg)
- [Framed upper window](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-window.jpg)
- [House exterior](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-house.jpg)
- [Retained downstairs radio station](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-radio.jpg)
- [Town](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-town.jpg)
- [Portrait cottage](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-10-mobile.jpg)

These are native WebGPU game screenshots from the final guarded run, with resizing/JPEG compression only. Desktop delivery is960×600; portrait is390×844. Ten JPEG files are33–77KB. Original PNGs, six unenhanced320×200 previews and measured scene crops are in `output/playwright/blackwater-10/final-07-free-cursor`. Game canvas crop RGB standard deviations16.30–99.82 confirm nonblank rendered content outside the main HUD. The matched desk crop has encoded luminance60.34 unlit versus197.80 lit; this establishes a local focal pool, not physical shadow occlusion.

The user’s existing tab and [local server](http://127.0.0.1:5200/) were preserved. QA used its own ephemeral server and browser. The images are embedded using absolute local paths for remote inspection.

## Shared construction and preserved routes

`cape75-structure.js` keeps the14 treads,1.60m stair width, turning landing, real slab opening and original floor heights. The lower floor is0.20m above terrain; the upper slab top is2.6475m and bedroom rug top2.6605m. Terrain remains terrain.

The model now supplies801 finite boxes:623 rendered boxes and178 retained proxies, plus four visible continuous sloped grips. Of the proxies,140 are thin slices linked explicitly to their rendered grip. Each has under0.10m horizontal depth and a centreline span at most0.05m; measured maximum AABB corner slack is0.0277068m. They replace neither a complete opaque guard nor an invisible full wall. Eight tested visible/finite shot gaps pass through the balusters while each post remains solid. Landing guards use the same open grammar. Player and the unchanged0.64m enemy radius retain their actual stair route and standing headroom.

All18 existing upper window bays receive frames, four-pane divisions and projecting sills. One damaged evacuation sash supplies a visual interruption. Closed glazing retains the finite exterior collision envelope. No new through-wall upper portal was introduced.

`cape75-upstairs-art.js` replaces the rendering of26 upper-furniture proxies with supported, constructed geometry. Those original conservative collision bounds remain authoritative; the art adds zero collision solids. The actual rug remains rendered and supported. Contents touch named desk, drawer, headphone-pad and case surfaces. Render rays verify open drawer/case cavities, broad cloth folds and the gravity turn around the bed rail. The room door and both close-inspection positions retain full actor clearance.

The old diagonal pickup camera route now correctly meets a stair post. The revised inspection follows the real hall before approaching the downstairs cabinet. A new source regression starts on the street and uses the existing movement/tick loop to reach the case. Native browser W input follows the hall too, collecting four fittings with no position/floor reassignment between its waypoints.

## Geometry, light and source costs

Controlled source triangles grow33,143→41,750, **+8,607**, while the house retains15 material submissions. The structural revision adds4,188 rendered triangles and the upstairs art adds4,419. Native seed1474 has41,831 triangles. Existing named lower art stays at13,174 triangles within its independent15,018 budget; the original lower-room allowance was not consumed by later floors. Only this authored two-storey house receives a45,000 whole-model ceiling. Other building ceilings and the whole-coast budget remain unchanged.

The upper lamp uses an existing two-material fixture batch, touches the shared desk top and targets the supported route sheet. Its2.7m range cannot reach the lower floor. Global practical count is now6, fixture triangles832→1,096, fixture submissions remain2 and additional shadow maps remain0. Existing lower repair lamp, discovery support, painted material roles, original Blender v2 arms/holds,378 licensed procedural trees, hills, river and bridges remain.

The final27 native-captured core runtime/asset hashes all match current source and the immutable `verified-dist-04` build. The reviewer’s03 environment hashes match final07; a concurrent glove-tint correction is preserved and captured in final07. Six additional presentation files were compared at delivery: `ui.js` and `game-interface.css` had later shared edits. Those edits were preserved. Final screenshots certify the captured UI snapshot, not those later UI revisions. Evidence is in `source-snapshot-check.json` and `review-visual-source-check.json`; the latter intentionally excludes the shared glove-tint change.

## Verification and free-cursor background QA

`node build.mjs` passed. The final structure/authority/all-interior/authored-cottage/physics/light/discovery group passed44 tests. After adding the actual street-to-case regression, its four-test file passed; three overlap the preceding group. The new background input guard passed two tests proving that pointer/fullscreen/keyboard capture attempts throw before any original native API executes, including browsers without optional keyboard-lock support. These overlapping groups are not summed into a larger claimed run.

Checks preserve all94 ground-floor routes and187 apertures; actual player ascent/descent and bedroom inspection positions; stable stair support; jump/slab and rifle/shotgun/rocket contact; scoped enemy pursuit; two-floor effects and blast separation; actual15-body cosmetic rigs, fast drops, the real opening, shared801-box Cannon statics and disposal ownership. No new crowd, co-op, human fear or full-campaign certification is claimed.

The original browser test explicitly requested native pointer lock after the app’s webdriver guard. Another authorized chat traced desktop mouse interference to that bypass. It has been removed. `tests/background-input-guard.mjs` now installs a fail-fast guard before loading the owned page: native pointer lock, fullscreen and keyboard lock are denied and counted. It never pretends to acquire a lock. All46 final observations show webdriver enabled, no pointer lock, no fullscreen and **zero native capture attempts**. Actual browser keyboard W events continue through the ordinary input intent. Firing is now explicitly a controlled `shoot()` engine call; the final test does not claim real mouse-input acceptance. SIGINT closes only the owned browser through normal test cleanup.

The final coordinated native Chrome149.0.7827.55 run loaded in43,391ms and passed45 desktop/portrait captures, hall pickup,29 ascent/inspection waypoints,25 descent/exit waypoints, five interior archetypes, bridge travel, lamp-off/on comparisons, controlled rifle rendering and live shadow recentering. The upstairs journey uses one controlled outside start, aim-only steering and the real1/120s tick with rendering deferred between captures. Its enemy cohort is temporarily empty; separate source simulation verifies scoped enemy movement. Feet reach2.6605m on the rug and0m after exiting. Fittings0→4; visible cases11→10. Console/page errors and HTTP failures are zero. Existing warnings are Windows ignoring powerPreference and one zero-vertex draw notice. Portrait is a desktop GPU viewport, not phone hardware.

The failed/interrupted predecessors are preserved in `qa-attempts.json`:01 diagonal-post pickup obstruction;02 unexplained WebGPU device loss;03 a complete historical45-view pass using earlier tint/native mouse flow;04 interrupted to remove the input bypass;05 Playwright CDP assertion before game Start;06 fatal process out-of-memory after13 captures. Its14 recorded input checks still show zero native capture attempts. Final07 passed with bounded diagnostics and the existing local resource coordinator. A passing retry does not explain or generally resolve the earlier driver/transport failures.

The harness now retains numeric house/structure/material/resource summaries rather than serializing every building’s authoring plan and batch arrays on every screenshot. The final formatted report is497,545bytes versus6,664,357bytes in03. The final command uses the local queue with declared3GiB RAM,1.5GiB VRAM and2 CPU slots, an owned process tree, and a768MiB Node heap limit. Default queue RAM admission/caps remain off. No other chat’s process or the user’s server was stopped.

## Measured rendering

At1280×800/DPR1, scene measurements use22 submit-fenced stationary scene/first-person samples after eight warmup samples. They are not total gameplay FPS. Queue CPU allocation and host load differ from prior runs, so lower timings do not establish a graphics speedup.

| Final configuration | Draws | Triangles | Median | P95 |
| --- | ---: | ---: | ---: | ---: |
| Upstairs listening desk |575|2,162,621|20.4ms|22.5ms|
| Town original static details |1,041|1,668,016|30.1ms|32.9ms|
| Town pooled static details |929|1,668,028|25.3ms|26.7ms|
| Town repeat |929|1,668,028|28.5ms|31.8ms|
| Forest |217|820,765|16.1ms|18.9ms|
| River |251|963,098|20.6ms|24.3ms|

The pooled comparison still removes112 submissions. The final normal-loop upstairs check records80 RAF intervals after10 warmup frames: median16.7ms/P9516.8ms with an empty enemy cohort. Preceding03 recorded16.8ms/P9549.9ms, so variation is material. Neither establishes sustained combat or phone performance. Tracked memory is896,984,506bytes (~855MiB). Building batching remains1,250→484 submissions in35 chunks, now2,017,602 triangles. Three seconds of live W travel24.29m and trigger four cached shadow recenters. Bridge camera height remains exactly1.60m above its shared deck/terrain authority.

## Focused art review and exact visual scorecard

The available `craft_authorship_skeptic` role read the actual brief and review contract; no saved-profile fallback or full council was used. It inspected native03 images, current code,09 comparisons and six unenhanced320px previews. Final07 environment hashes bind those findings to the delivered geometry.

CONFIRMED local improvements: continuous grips/separated posts/rising treads and the opening remain readable at320px; framed four-pane windows and sills remain visible; blanket side-drop and turned corner survive that scale; the desk light, paper, open drawer and headphone arch establish an abandoned workstation. The specific09 opaque-guard/flat-cover objection should not be repeated unchanged.

Remaining RISK: pillows look thin/faceted, map coast/path semantics fade at320px and a particular evacuation story has not been established through human recall. Counterevidence: low-poly faceting belongs to the intended graphic language, and paired radio/listening stations plus the map and case form deliberate relationships. The landing is CONFIRMED sparse, but broad uniform walls alone do not prove that the entire active scene is primitive-dominant.

| Exact category |09→10 /3| Evidence and limit |
| --- | ---: | --- |
| Art direction |2→2|Construction and resident activity improved; whole-game showcase identity unproved.|
| Hero/player |2→2|Existing Blender arms/holds retained; shared glove tint preserved.|
| Obstacles/enemies |1→1|Scoped pursuit works; three polished hostile roles remain unproved.|
| Rewards/interactables |1→1|Useful downstairs kit retained; broader authored variety remains work.|
| World/environment |2→2|Upper construction improved; sparse landing and other upper floors remain.|
| Materials/textures |2→2|Shared painted roles retained; no category-wide resource/detail leap.|
| Lighting/render |2→2|Supported practical makes a visible focal pool.|
| VFX/motion |1→1|Still views and source contacts do not prove polished combat motion.|
| UI/HUD |2→2|Captured desktop/portrait feedback fits; later shared UI revisions unverified here.|
| Performance evidence |2→2|Native metrics/input/viewport/hash evidence; combat/phone and instability gaps remain.|

**Average1.7/3. Automatic failures:** no newly confirmed stair/bed/desk primitive-blockout failure remains; local pillow/case primitive appearance and sparse-shell dominance remain risks. Premium/AAA acceptance still fails decisively because enemies, rewards and motion are below2 and the average is below2.3. This is progress, not full AAA completion.

The next bounded art experiment is one pillow silhouette revision and one broad map cue revision from the same320px cameras. Accept visible compressed pillow volume and distinguishable coast/path/endpoint; discard fine seams/marks that vanish. A30-second unprompted room recall test with4/5 fresh viewers connecting listening, planning and packing could establish the evacuation reading. It has not been performed. Exterior bay location recognition also remains unverified.

## External sourcing and loading ledgers

Credential probe output from the current Windows presence-only Process/User/Machine check, with no values printed:

```text
TRIPO_API_KEY=MISSING
GEMINI_API_KEY=MISSING
ELEVENLABS_API_KEY=MISSING
```

The3D generator, image generator and audio generator SKILL.md/API/integration references were loaded in preceding06–09 ledgers and carry forward. Provider generation remains blocked by those credentials; none was attempted. Chosen sources: hero/player retains original editable Blender v2 masters and bundled GLB; enemies/vehicles/weapons retain bundled authored/imported assets; signature props/pickups use original supported Blackwater geometry; world/sky/background retain original terrain/sky and licensed MIT [EZ-Tree](https://github.com/dgreenheck/ez-tree); materials/textures/decals retain painted roles/licensed bark/leaves; logos/icons/GUI retain authored UI; audio/SFX/voice retain existing game audio. No new audio-quality acceptance or proprietary game code/assets are claimed.

Skill-loading ledger: root reread `C:/Users/wolfk/.codex/skills/threejs-game-director/SKILL.md` and used its explicit focused-phase delegation requirement. Architecture and upstairs-art workers loaded procedural architecture/AAA references; gameplay, UI, debug/profile, QA/release and generator phases retain the loaded sibling skills and references recorded in [inspection09](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-inspection-09.md) and linked preceding ledgers. The reviewer freshly loaded the director, AAA builder and exact scorecard references. No plugin deployment or external messaging was performed by this phase.

Reference ledger: this phase loaded procedural-architecture `SKILL.md` and `references/grammar-and-mesh-compiler.md`, AAA `render-recipes.md` and `references/checklists/material-lighting-quality.md`, exact `references/visual-scorecard.md` and `references/checklists/aaa-visual-scorecard.md`, and QA `references/checklists/visual-verification.md`. Mistaken reads of `references/material-lighting-quality.md` and `references/aaa-visual-scorecard.md` were corrected to the actual checklist paths. Gameplay-workflows.md, physics-engine-selection.md, implementation-blueprint.md, model-recipes.md, procedural-model-quality.md, performance-safe-visual-detail.md, aaa-game-quality-gate.md, UI fit/readability, debug-profile-checklists.md, performance-profile.md, QA/release/playtest checklists and generator/audio integration references carry forward from the verified09 ledger. New input safety was verified through the repository’s Playwright harness and two denial tests, not an invented native-capture success.

## Phase ledger

| Phase | Bounded result | Broader status |
| --- | --- | --- |
| Gameplay systems |Shared stairs/floors/collision retained; hall pickup tested|Other upper floors, crowds and co-op remain work|
| External asset sourcing |Presence probe; original supported geometry|Provider credentials missing|
| AAA graphics |Constructed rails/windows/cloth/desk;320px review|Exact score1.7/3; pillow/story refinement remains|
| UI |Captured HUD/portrait fit retained|Later shared UI changes and phone hardware unverified|
| Debug/profile |Bounded diagnostics, native fences, normal-loop sample, hashes/pixels|Memory/driver/transport failures recorded; combat cost remains|
| QA/release |45 final captures; actual free-cursor W journey; zero native capture attempts|No full-game release certification|

Physics engine selection remains the custom arcade controller at a1/120s timestep with shared finite collider authority, plus bundled cannon-es0.20 for cosmetic bodies. The fully explorable-world and AAA visual goal remains active.
