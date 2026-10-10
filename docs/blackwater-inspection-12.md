# Blackwater inspection12 - Main Street and the failed evacuation checkpoint

Status: this bounded Main Street/checkpoint iteration is complete. Six final actual game captures, scoped native input/graphics checks, 16 unique source checks, production build and focused craft reviews pass. The first dark sign failed review; the pale bold-label correction passes the final fixed views. Whole-game AAA acceptance remains incomplete. This is a bounded graphic-horror iteration. It does not meet whole-game AAA acceptance.

## Player promise and change

Main Street should show a failed evacuation through recognizable construction and related traces. The existing two striped trestles become supported steel/timber checkpoints with a pale, dark-lettered EVACUATION identifier, a hinge-damaged gate held by a strap, and an attached registration tray with an opened folio. The folio is scenery, not a new pickup or objective.

The road has three authored maintenance repairs, two paired braking paths terminating at the existing wrecks, repair-edge cracks and curb drainage stains. Stable world-metre fields feed the live graphic-horror material adapter. Fine marks fade with the pixel footprint; square concrete slabs retain a 1.5m rhythm. These are matte colour changes with no displacement, textures, extra road draws or collision changes. Toon bands, world lighting and the clean first-person post-processing remain the same.

The field contract is world XZ metres -> road footprint/rotated repairs -> repair seams, paired capped tyre strokes and gutter exposure -> matte painted albedo. Repair edges share the primary repair distance; tyre traces share their authored path and axle spacing. Each named road field has an actual shader debug output. The scalar and TSL versions use the same algebraic bundle; unit checks alone do not establish pixel parity.

Both barriers remain inside their canonical, relocated shallow footprints. East at world222/50.3m uses5.2x.65m, yaw-.06; west at164.4/61.1m uses4.7x.65m, yaw.05. East costs896 triangles/7 material batches and west876/7. Each owns one sign material and one browser canvas texture, borrows the district palette, and disposes its geometry/sign once. No additional lights, shadows, collision solids, door blockers or implicit landmark caches were introduced.

## Verification and comparison contract

Eleven new road/checkpoint source checks and five focused regression checks pass,16/16. They cover finite buffers/normals/winding, actual supported parts and the broken-slat opening, actual sign texture retention through the graphic adapter, per-vertex containment in both relocated collider footprints, resource ownership, immutable fields/real wreck destinations, subpixel filtering,94 reciprocal ground-floor routes, the six-metre road passage and cached sunlight. Build passes using Node and bundled assets; verified-dist-v1 preserves the exact runtime before browser inspection. Source-test-receipt-v1.json and checked-source-hashes-v1.json bind those results. The final palette/type change reruns all seven checkpoint checks successfully (788.5752ms), preserving shop-sign defaults. Build passes again. final-sign-source-receipt.json binds the two corrected sign sources, QA script and verified-dist-v2; that snapshot differs from v1 only in checkpoint.js/materials.js.

Baseline native game captures use Chrome154.0.8037.93/NVIDIA-turing WebGPU. Start reaches play in48,790ms, six controlled-view captures and all seven actual-W waypoints succeed, and eight background-input checks report zero native pointer/fullscreen/keyboard attempts. Console/page and HTTP errors are zero. A harness cleanup mistake calls close on the server wrapper after all checks; the terminal job therefore exits1. The verifier now closes server.server. The original result and failure remain recorded.

World geometry, camera/controller, lighting and post-processing sources match the baseline, apart from the two intended district/material edits and their two new modules. A complete runtime-tree comparison also finds three shared foreground arm/weapon sources changed since inspection11. Those foreground pixels are excluded from the road/checkpoint comparison; no new Blender edit is claimed by this pass. Another chat subsequently updates renderer.js for the authored FPS articulation; current-source-binding-final.json records that renderer difference. All listed environment, lighting, layout, surface and checkpoint sources bind to their respective frozen capture snapshots.

Native-v1 fails before play with unknown device loss: "A valid external Instance reference no longer exists" / "Instance dropped in popErrorScope", plus blob-texture and ERR_INSUFFICIENT_RESOURCES errors. Concurrent memory pressure is observed, but a single root cause is not proved. Isolating the exact production materials on two planes passes native WebGPU compilation and all seven final/field views with zero console errors, page errors and HTTP errors. This isolation is a diagnostic, not game imagery. Native-v2 is cancelled by the shared queue for Emergency GPU pressure before valid captures. Native-v3 reserves2.4GiB GPU capacity; reservations include estimated overhead and are not measured peaks. All attempts are retained in output/playwright/blackwater-12/qa-attempts.json.

Native-v6 fixed street and pharmacy-entry captures pass at1280x800, Chrome154/NVIDIA-turing WebGPU; Start89,605ms. Seven actual-W waypoints pass; four background-input guards report zero pointer/fullscreen/keyboard attempts; console/page/HTTP errors zero; owned browser/server cleanup true. The craft lens narrowly accepts street hierarchy at960/320 pixels, preserving lane and enemy clarity. Checkpoint/portrait subsequently pass native-v11; full-world field views remain uncollected, with the separate actual-production-material isolation retained. Acceptance is three macro road features at960px and two at320px with lane paint/enemy silhouettes preserved; checkpoint identity, failed gate and attached procedure at960px and primary barrier/sign silhouette at320px. No fresh-player comprehension, combat FPS, phone hardware, live co-op or full-game release is inferred from these checks.

Native-v3 is cancelled while queued before any process is admitted. The scoped native-v4 verifier sets the existing native compilationConcurrency control to1 before Start; it changes compiler overlap rather than image content. The bundled default is8. This may lengthen loading and cannot reduce persistent resource residency. It is a diagnostic control, not a production rendering change or proof of the failure's cause. Native-v4 times out while queued with1.8GiB reservation and no admission. Native-v5 also times out without admission at1.6GiB. Native-v6 uses a1.5GiB planning estimate for the reduced scope; this is not a measured cap. No failed attempt supplies valid after screenshots.

Native-v7 extended views use the same startup exclusions but are cancelled during startup by emergency GPU pressure. Owned-process counter samples reach666.61MiB dedicated GPU allocation before cancellation; this is not a completed-view or lifetime peak. Passing v6 evidence remains valid.

The native-v6 scoped browser installs instance hooks before the first menu frame. It keeps all dependency waits, the full-resolution actual renderer, original camera, lights and shadows, the current screenshot enemy cohort and normal visible/shadow draw preparation. It omits the forced whole-exterior precompile and unused legacy Q-interior, hidden interaction and synthetic representative-enemy warmups. Those skips do not hide meshes in the real draw. The first street view settles for20 rendered frames and a GPU fence; the seven actual-W waypoints retain the disclosed temporary-empty-enemy collision test. No full-game readiness or continuous traversal rendering is inferred. See scoped-startup-contract.json.

Native-v8 reaches play108,808ms but shared emergency GPU pressure cancels it before the first checkpoint capture. Owned-process dedicated-memory samples reach1409.71MiB; periodic samples are not a transient/lifetime peak. Native-v9 reduces only the actual inspection viewport to640x400 desktop and390x844 portrait, retaining render scale, four-sample antialiasing, shaders, world geometry, camera FOV, lights and shadows. This is a smaller-window visual inspection; no large-desktop performance or exact-pixel parity with the1280px baseline is inferred.

A full-world software fallback is rejected: production water uses raw WGSL through vgpu and is deliberately uncullable, so forcing a GLSL WebGL backend would change or break the real graph. Isolated CPU asset fixture attempts fail before valid imagery due to a subject.root setup error, now corrected only in the preserved diagnostic source. No software preview is delivered or counted as game imagery. Those failures and the blocked compatibility preflight remain in qa-attempts.json.

Native-v9 is cancelled after Start130,024ms without a capture; periodic owned allocation reaches1196.21MiB. Native-v10 fails on a QA guard comparing camera-local position to world coordinates. Correcting that check with getWorldPosition and making console failures end the test promptly yields native-v11 exit0: Start83,293ms, three actual checkpoint images, five guarded input stages, zero console errors, page errors and HTTP errors and owned browser/server cleanup true. Native WebGPU adapter is NVIDIA-turing/Chrome154. Dedicated GPU counters sample only the owned process tree, reaching970.246MiB; these are periodic observations, not transient/lifetime peak or another thread's usage.

For v11, the actual warmup run and replacement play run each receive one controlled starting pose at219/60m, before the original render. The first actual world draw camera is219/1.6/60m. This avoids uploading the unused default camera view; actual shadow casters and always-drawn water remain. Four disclosed startup skips stay in place. The640x400 desktop and390x844 portrait captures settle20 rendered frames and a native GPU fence. The original first-world FOV damps normally from82.70 to75 for delivered stills.

The craft lens fails the first checkpoint's dominant identifier: dim serif lettering on a dark face disappears into the storefront shadow at640/320px. A larger mobile view makes the label readable but weak. It confirms the physical support/gate relationships; the attached registration tray/folio is too small or obscured to judge activity. The essential correction changes only the checkpoint's printed palette/type to parchment face, near-charcoal bold sans ink and dark border, retaining shop-sign defaults, geometry, textures owned per sign, light/shadow count and collisions. Native-v12 uses960x600 desktop/390x844 portrait plus a close view aimed at the actual world-space document. This is a controlled environment inspection, not an interaction or gameplay-performance claim.

Native-v12 final sign capture exits0 on Chrome154/NVIDIA-turing WebGPU. Start67,124ms; four original game views at960x600 desktop/390x844 portrait; six input guard stages with zero pointer/fullscreen/keyboard-lock attempts; zero console errors, page errors and HTTP errors; owned browser/server cleanup true. Twenty periodic owned-tree dedicated-memory samples reach923.4375MiB. The larger viewport and lower observed sample are not evidence of a general memory/performance improvement; allocation/counter timing and shared pressure differ. No steady gameplay FPS, phone hardware or full startup certification follows.

The focused craft review now narrowly passes the promised fixed views: the main EVACUATION identifier reads close/portrait, a distinct pale sign mass survives320px, and the failed right-gate diagonal remains visible. The closer document view confirms a supported open/folded folio with a retaining strap; written registration semantics and gameplay interaction remain unverified. Dark support rails still merge in places and subtitle/folio disappear at approach distance. The next falsifier is a moving threat crossing the shadowed landmark or a novice discovery test. checkpoint-craft-review-v12.md preserves the evidence/counterevidence/test verdict.

The final complete live-dist comparison checks574 frozen files against577 live files. Seventeen differences come from other foreground/FPS, injury and body-spear/combat work, including three new FPS asset files. They are preserved and listed in final-live-runtime-tree-comparison.json; these captures do not certify that later work. The shared material-hook delta is conditional on body-cut uniforms. Environment geometry/layout/materials, lighting/post and the checkpoint sources used here match the live dist; current renderer.js includes the separate authored-arm integration. The final checkpoint file is fetched through the existing5200 server with HTTP200 and an exact hash match. No tab/server is restarted or navigated.

## Exact whole-game visual scorecard

| Category | Before /3 | After /3 | Limit |
| --- | ---: | ---: | --- |
| Art direction | 2 | 2 | Selected graphic horror; whole-world cohesion remains work. |
| Hero/player | 2 | 2 | Editable Blender arms/holds retained; broad polish not certified here. |
| Obstacles/enemies | 1 | 1 | Three fully polished hostile roles remain unproved. |
| Rewards/interactables | 1 | 1 | Existing useful route/kit; the checkpoint folio is scenery. |
| World/environment | 2 | 2 | Better constructed street landmark; other upper floors remain work. |
| Materials/textures | 2 | 2 | Shared painted roles and named surface causes; broad polish incomplete. |
| Lighting/render | 2 | 2 | Existing bands/lights/shadows retained; Street and checkpoint fixed-view composition pass narrowly. |
| VFX/motion | 1 | 1 | Polished combat motion needs evidence. |
| UI/HUD | 2 | 2 | Existing responsive game interface retained. |
| Performance evidence | 2 | 2 | Actual native inspection and owned-process sampling; shared GPU/startup instability remains. |

Average1.7/3 before and after. Automatic failures: below2.3 average; enemies, rewards and motion below2. No AAA completion claim. Next whole-game passes require encounter/animation polish, more authored useful interiors and measured hardware performance rather than more surface marks alone.

## Skill-loading ledger, reference ledger and external asset sourcing

The loaded threejs-game-director skill requires focused-phase delegation. A worker owns the new checkpoint model/tests; root owns road fields, dispatch, integration and QA; the actual craft_authorship_skeptic role gives read-only evidence/counterevidence/test-based review. No council vote or designer endorsement is claimed. Other chats' edits are preserved.

Gameplay systems, AAA graphics, UI, debug/profile, QA/release,3D generator,image generator and audio generator skills and required references retain their recorded reads in inspection11 and preceding ledgers. Current fresh reads include director, procedural-fields and its field-stack recipes/planet shared-field example, AAA implementation/model/render recipes, procedural-model-quality/performance-safe-detail guidance, visual-scorecard, debug-profile checklists and local-dev-instances. The checkpoint worker freshly loads relevant AAA/procedural geometry references. Required reference coverage includes gameplay-workflows, physics-engine-selection, visual-scorecard, implementation-blueprint, model-recipes, render-recipes, AAA quality gates, UI fit/readability, performance-profile, QA visual/playtest/release,3D API/integration/image workflows and audio workflows. No new game scaffold is required.

Fresh presence-only Windows Process/User/Machine credential probe output, with no values printed:

```text
TRIPO_API_KEY=MISSING
GEMINI_API_KEY=MISSING
ELEVENLABS_API_KEY=MISSING
```

External asset sourcing, chosen sources: hero/player uses original editable Blender masters and bundled viewmodel-arms-v2.glb; enemies/vehicles/weapons retain existing authored/imported assets; signature props/pickups use the original supported checkpoint kit; world/sky/background retains original terrain/sky and licensed MIT EZ-Tree; materials/textures/decals retain painted roles, licensed bark/leaves and existing CC0 scans; logos/icons/GUI art retains authored UI/sign canvas; audio/SFX/voice retains existing spatial/game audio and equip cues. Generator skills were loaded before source decisions. No new provider generation was attempted because credentials are missing. No proprietary game code/assets were copied. The blocked provider/audio sourcing is not proof of premium quality.

## Phase ledger

| Phase | Bounded evidence | Broader status |
| --- | --- | --- |
| Gameplay systems |94-door, road/proxy and ownership regressions. | Scoped actual-W pass; encounters/other upper floors/co-op remain work. |
| External asset sourcing | Fresh credential probe and original supported kit. | Missing provider credentials recorded. |
| AAA graphics | Checkpoint anatomy and live filtered road fields. | Street native/craft acceptance passes narrowly; initial checkpoint readability fails; final correction passes focused review; whole-game1.7/3. |
| UI | Existing HUD and clean first-person presentation retained. | Actual390x844 portrait captured; phone hardware not tested. |
| Debug/profile | Frozen build, full tree comparison, successful native shader isolation and retained failures. | Startup/resource instability is unresolved. |
| QA/release |16 source checks and production build pass. | Six final actual native images pass capture/input checks; focused reviews pass; no release/FPS claim. |

Physics engine remains the custom arcade controller with fixed timestep1/120s and shared finite collider authority; bundled cannon-es0.20 handles cosmetic bodies. Source checks retain this authority rather than replacing it. Audio matrix: existing ambience/weapon/equip/interaction hooks retained, no added checkpoint sound; no new generated audio or hardware audio quality certification.

## Inspection and reproducible checks

Game URL: http://127.0.0.1:5200/. Existing healthy server is node24220, command line explicitly points to this repository's server.mjs/dist; ownership was rechecked at final inspection; HTTP200 was checked earlier. No server was stopped or restarted and no existing tab was navigated. The latest build is served on a user-initiated refresh.

Runtime files for this pass: blackwater-street-surfaces.js, blackwater-render-looks.js, blackwater-district-visuals.js, assets/blackwater-kit/checkpoint.js, the optional checkpoint-only sign parameters in assets/blackwater-kit/materials.js and the explicit build list in build.mjs. Tests/fixtures/reports are inspection assets. The QA fixture stays outside the production build.

New source checks: `node --max-old-space-size=384 --test --experimental-test-isolation=none tests/blackwater-street-surfaces.test.mjs tests/blackwater-checkpoint.test.mjs`. Regression checks use the all-ninety-four/every-ground-floor/all-houses/graphic-adapter/cached-sunlight patterns across blackwater-all-interiors, blackwater-district, blackwater-graphic and harbor-shadow-coverage tests. Build: `node --max-old-space-size=384 build.mjs`. Native wrappers pass local Playwright/Chrome paths to tests/blackwater-street-browser.mjs through the shared resource queue.

Actual native game PNGs, guarded input, hashes, source binding, delivery JPEG provenance, pixel statistics and craft review are recorded under output/playwright/blackwater-12. The street/pharmacy JPEGs are resized from1280px native captures to960px; final checkpoint JPEGs retain their960px or390px dimensions; the earlier v11 files retain640px/390px. Only compression/resizing is applied; no AI or content alteration. The director evidence audit checks required report sections; it is not an AAA acceptance test.

## Actual game images

![Final checkpoint](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-12-after-checkpoint-close-v12.jpg)

![Supported open folio](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-12-after-checkpoint-document-v12.jpg)

![Main Street](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-12-after-street-v6.jpg)
