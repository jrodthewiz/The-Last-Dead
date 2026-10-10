# Blackwater 06 — painted horror, Blender hands and an explorable coast

Date: 2026-10-04. This is a substantial, inspectable iteration toward the user's selected graphic horror direction. The latest reference is bold N64/PS2/San Andreas forms, Borderlands-like painted shading and modern clarity. It does not establish Dead Island/Left 4 Dead production quality or a finished campaign.

## Delivered scope

All **94 canonical coastal buildings** have furnished, enterable ground floors, with **187 front/rear apertures** and **852 authoritative furnishing rectangles**. Bell Pharmacy's rear remains sealed. The original 16 Blackwater footprints, pharmacy supplies and 18 MAIN story are preserved; 27 apartment ground floors, 31 industrial workplaces and 20 cape cottages extend them. The original six harbor interiors also remain. Upper floors are closed. Shared layouts provide desks, cots, beds, kitchens, workshops, shelving, loading stores and supported contents; they do not yet give every room a unique encounter or discovery.

The first-person arms and all eight hold transforms have editable Blender masters:

- [Arms, gloves and sleeves](C:/Users/wolfk/Desktop/thelastdead/.art-source/viewmodel-arms-v2/The_Last_Dead_Clean_First_Person_Arms_v2.blend)
- [Eight weapon hold poses](C:/Users/wolfk/Desktop/thelastdead/.art-source/viewmodel-motion-v2/The_Last_Dead_Clean_First_Person_Holds_v2.blend)

The runtime [GLB](C:/Users/wolfk/Desktop/thelastdead/assets/survivor/viewmodel-arms-v2.glb) has 27 meshes, 54,636 triangles, three materials/textures and 3,869,952 bytes. SHA-256: `beba75aa9a173532af038c67c286fde96e1149275e4fe0a496a31cdd86f23fcf`. Both palms and all ten digits wear dark leather gloves; canvas cuffs and sleeves retain authored folds and wear. Adult limb metres are independent of weapon display scale. Both grip roots, shoulder-cap visibility and the isolated trigger finger are verified; trigger contact stays within 12 mm through its stroke.

Standing vertical FOV is 75 degrees. Restrained eye-level gait, clean HDR/adaptive exposure and one output conversion replace chest-camera projection, motion blur, grain, chromatic fringe, scanlines and REC overlay. This is flat-screen first-person presence; headset VR is not implemented. The two weapon directional-light targets now move with the camera rig, preserving the same lighting direction through streets, forest, turns and elevation.

The terrain covers 448 × 416 m. Town roads and lots remain level; east/north hills rise to about 5.7 m. A shared 1 m triangle field governs feet, eye height, enemies, anatomy shots, projectiles, deposits and terrain presentation. The winding stream is 304 m long, with a shallow ford and two wooden crossings. Standing eye height is terrain + 1.6 m. Airborne movement preserves absolute foot height across terrain changes. This is a single height field: there is no movement underneath bridges, layered floor authority or slope sliding.

**378 real branch/leaf trees** replace the 60 old round-crown street trees and add 318 forest trees. Six seeded ash/pine templates, three LODs and at most 36 fixed pools bound resources. Trunk proxies use the same placement records; paths, door approaches and banks stay clear. Leaf tips flutter; branches remain static. Four bundled bark/leaf images provide actual cutout foliage and bark detail.

The river uses two centimetre-scale displacement bands, corresponding normal gradients, filtered ripples, Fresnel reflection and bed-depth absorption. Reflection is analytic sky; scene refraction and planar reflections are not implemented. Terrain, trees, water, buildings and furniture are game geometry.

## Rendering and ownership

The stronger palette uses warm brick/plaster, cool teal metal/glass, blue shadow planes, three filtered light bands, faceted terrain, a more visible blue graphic sky and 2.8 px district ink. Roads, grass and bridges use reversible owned materials with no extra surface draws. Held weapons use painted materials and 2.5 px live animated silhouettes. Their geometry, skeletons, morphs, textures, grip sockets and foreground depth remain borrowed from the game.

Injury binding now happens before weapon styling. Native wound hooks preserve blood cues on painted surfaces; separate shared ink masks follow severed limbs without blood tinting the outline. UV-less caps sample zero UVs safely, while valid maps retain their texture transforms. Toggle and disposal restore the exact wound-source material identities.

Shared matrix upload preparation now installs one update hook per shared instance buffer. Ink borrows the prepared source view instead of redefining that hook. These changes resolve the native preparation failures encountered during this pass; failure reports are preserved in the QA output.

Static building batches preserve material identity, geometry schemas, source buffers and transforms in 48 m chunks. Safe material sharing reduced building submissions from 1,250 to 484, in 35 chunks, without removing its 1,996,357 source triangles. This is a source submission count; complete native rendering also includes ink, props, actors and other passes. It is not a measured FPS improvement.

Cannon cosmetic bodies retain the existing 60 Hz simulation. Natural terrain uses an exact 1 m height field plus two bridge decks and four fine approach fields: seven ground colliders, 197,441 samples, 1,579,528 bytes. Fine approach error is about 0.207 mm, under the 3 mm contract. Rare complete fall-through uses a swept support correction; this does not establish general CCD or under-bridge physics. Forest cache meshes now use their authoritative terrain height.

## Actual game captures

These JPEGs resize/compress actual native game screenshots. No painted or generated concept image substitutes for running game rendering. Desktop captures are 1280 × 800 at DPR 1; Remote JPEGs are 960 × 600.

- [Street and rifle](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-06-rifle.jpg)
- [Forest](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-06-forest.jpg)
- [River crossing](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-06-river.jpg)
- [Cottage interior](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-06-house.jpg)
- [Existing infected at six metres](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-06-threat.jpg)

The infected is an existing resident repositioned for a fixed-view art check. QA also sets player positions and manually paces simulation for routes. It does not represent a continuous campaign playthrough. The firing check briefly resumes normal simulation and real mouse input; manual tick advancement alone does not execute the normal shooting loop.

## Verification

Source verification is recorded in bounded groups, with overlapping suites kept separate rather than added into a misleading total:

- 49 focused weapon-style, injury, Blender arm, asset and motion checks passed.
- 19 graphic adapter, camera-relative light and loading/preparation checks passed after the final lighting change.
- 138 engine/combat/AI/anatomy and terrain authority checks passed for the terrain integration.
- 51 corpse/tissue/terrain physics checks passed, including hills, negative ford beds, bridge ramps and fast small bodies.
- Interior authority, bounded tree pools, water/terrain presentation, material sharing and building batches passed their focused checks.

The production build passed. Exact final native acceptance, timings and canvas pixel evidence are filled below after the immutable-build run. Native QA owns an ephemeral server/browser and closes both. The user's existing tab and port 5200 server were preserved. No commit, deployment or whole-campaign/phone-hardware verification is claimed.

Final immutable snapshot QA passed in native Chromium 149.0.7827.55. Real Start reached play in 26.098 s. All 15 views rendered; a real mouse shot advanced shot sequence 0 → 1. Actual W traversal entered apartment, clinic, workshop, warehouse and cottage ground floors. The 8.4 s bridge walk reached z=402.458 m, with standing eye exactly ground + 1.6 m. Both weapon light targets remained camera-relative. The actual 390 × 844 mobile portrait camera fits without horizontal scroll; this is desktop-GPU viewport emulation, not phone hardware.

Console/page errors and HTTP failures: **zero**. Native UV and deprecated viewport warnings were resolved. Remaining warnings were the Windows powerPreference adapter notice and one zero-count draw notice. Runtime hashes were recorded before navigation and checked after QA in the fixed snapshot; this avoids mixing concurrent actor rebuilds into the acceptance evidence.

[Full native report](C:/Users/wolfk/Desktop/thelastdead/output/playwright/blackwater-06/cape-report.json) · [Canvas pixel evidence](C:/Users/wolfk/Desktop/thelastdead/output/playwright/blackwater-06/delivery-pixels.json)

Remote JPEGs are 28–111 KB. The central 800 × 420 scene crops have 193–235 occupied luminance bins and 47.3–75.0 luminance standard deviation, verifying nonblank rendering independently of the HUD border.

| Native view | Draws | Triangles | Median ms | p95 ms |
| --- | ---: | ---: | ---: | ---: |
| town | 1,039 | 1,657,728 | 42.7 | 52.9 |
| forest | 216 | 818,129 | 14.1 | 15.4 |
| river | 250 | 960,462 | 14.4 | 17.8 |

These are 22 stationary submit-fenced scene + clean first-person resolve samples at 1280 × 800/DPR 1, with eight initial samples discarded. They do not measure total gameplay FPS. Tracked renderer memory is 897,560,735 bytes (~856.0 MiB). Town misses both the 16.7 ms and 33.3 ms renderer budgets. Forest meets the 16.7 ms p95 budget; river narrowly misses it. Prior same-view runs varied with uncontrolled machine load/cache state, so no causal speedup is claimed. Town submissions, memory, sustained combat and phone performance remain work.

## Independent exact visual scorecard

A focused read-only ruthless creative director lens reviews the final images, with evidence and counterevidence. No full council, impersonation or vote is claimed. The user's latest critique governs acceptance; source checks do not prove professional appearance or AAA quality.

| Exact category | Score / 3 | Final evidence and limit |
| --- | ---: | --- |
| Art direction | 2 | Painted façades, teal trim, broad colour blocks and comic contours carry through town, weapons and vegetation. |
| Hero/player | 2 | Layered rifle construction, wear, readable silhouette and Blender grip contracts; full animation/contact polish remains unverified. |
| Obstacles/enemies | 1 | Authored residents are visible, but clothing/posture communicate ordinary people more strongly than distinct hostile roles. |
| Rewards/interactables | 1 | Useful equipment and chapter machinery exist; these views do not demonstrate two polished reward forms and collection states. |
| World/environment | 2 | Layered façades, enterable rooms, forest, stream and crossings; house interiors and forest floor remain sparsely articulated. |
| Materials/textures | 2 | Brick courses, painted roles, weapon wear and actual bark/leaf images support the direction. |
| Lighting/render | 2 | Clean projection, camera-relative weapon keys and strong shadow separation; dark street façades obscure detail. |
| VFX/motion | 1 | Actual firing works; a still and input check do not establish polished muzzle/impact/reaction sequences. |
| UI/HUD | 2 | Genre-specific vitals, weapon rack and objectives remain readable in desktop/portrait views. |
| Performance evidence | 2 | Native counts, timings, actual input and 15 views exist; town remains expensive. |

**Average: 1.7/3.** Premium thresholds (every category at least 2; average at least 2.3) are unmet. Scores apply to this evidence set, not an assertion that unshown systems are absent.

**Automatic failures remaining:** no whole-game automatic failure is conclusively established by these captures. Primitive dominance is a **RISK** in the house/bridge views: recognizable furniture exists, but blank planes and block construction dominate. Reward diversity and sustained combat presentation are **UNVERIFIED**. Together with the category scores and town budget miss, these prevent a premium/AAA claim.

Three bounded experiments follow from the critique:

1. **RISK — buildings become interchangeable stops.** The long open road and tidy, blank cottage demonstrate access more than interrupted lives. Counterevidence: purpose-specific furniture and Low Tide's shelter → power → bell consequence → radio reveal provide a foundation. Author one street bay and adjacent house with a distinct disruption, tactical choice and useful discovery. A proposed human-playtest criterion is four of five fresh players recalling that house's event and reason to enter after a short run; no such playtest has been performed.
2. **RISK — people are recognized before hostile roles.** The six-metre resident view carries less comic-horror specificity than the architecture. Counterevidence: authored rigs, preserved colour atlases and cel lighting retain human material semantics. Capture three real roles approaching at six metres, with anticipation and attack. Accept when silhouette, posture and one material cue distinguish them without HUD labels.
3. **CONFIRMED — town renderer cost exceeds the target.** Final scene + resolve p95 is 52.9 ms; forest and river are much cheaper. Counterevidence: actual firing, five interior routes, crossing and error-free native loading passed. Profile one fixed street through 60 seconds of combat and reduce invisible submissions/redundant passes. Proposed acceptance is gameplay p95 below 33.3 ms for a declared 30 FPS target, or 16.7 ms for 60 FPS.

The governing player promise is to fight through a painted abandoned coastal town where recognizable homes offer useful shelter and excursions bring consequences. Protect readable close combat, distinct places with reasons to enter, and bold painted forms with modern detail. Another rendering effect would not resolve the current room/encounter weaknesses.

## External asset sourcing

The forest uses [EZ-Tree](https://github.com/dgreenheck/ez-tree) 1.1.0, commit `dcf309bd86bd521083d9c70f01f2de45fdc7c457`, MIT, with MIT leaf images and CC0 ambientCG Bark001 maps. The [local manifest](C:/Users/wolfk/Desktop/thelastdead/assets/forest-kit/manifest.json) preserves source hashes, license information and adaptations. Runtime uses only bundled files and the existing Three.js vendor.

Chosen sources per surface:

Hero/player: original editable Blender arms/motion masters plus the preserved imported interaction atlas. Enemies/weapons: bundled imported rigs and original game models with native material adaptation. Signature props/pickups: original Blackwater architecture/furniture kit. World/sky/background: original procedural terrain and authored analytic sky. Materials/textures/decals: original painted roles, borrowed atlases and licensed bark/leaf maps. Logos/icons/GUI art: current authored interface. Audio/SFX/voice: existing game audio.

Credential probe output from this active work (Windows process/user presence markers):

```text
TRIPO_API_KEY=MISSING
GEMINI_API_KEY=MISSING
ELEVENLABS_API_KEY=MISSING
```

The 3D generator, image generator and audio generator skills were loaded before the source decision. Missing credentials prevented new provider generation. No paid generation was attempted and no proprietary reference-game code or assets were copied. Existing audio remains; no new generated audio or audio-quality acceptance is asserted.

## Skill-loading ledger, reference ledger and phase ledger

Director active. Gameplay systems, AAA graphics builder, game UI designer, debug/profiler and QA/release public skills and required references carried forward from the continuing 02–05 work. The 3D/image/audio generator instructions and API/integration/workflow references were loaded. Full paths and earlier reference records remain in [05](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-inspection-05.md) and its linked 02–04 records.

Architecture, geometry, materials, fields, shadow systems, camera and visual validation govern ownership, units, bounds and fixed-view checks. For 06, procedural vegetation instructions plus the structured ash reference/examples, and water optics instructions plus the full water-surface reference and analytic-wave example were loaded. Gameplay workflows, physics engine selection, model/render recipes, graphics implementation blueprint, visual scorecard, UI patterns/checklists, debug/profile checklists and QA/release/visual/playtest checklists are retained in the ledger. No missing-reference fallback is claimed.

| Phase | Bounded 06 output / evidence | Remaining broader work |
| --- | --- | --- |
| Gameplay systems | 94 serialized interior plans; matching apertures/furniture; shared terrain/combat heights; real input routes | Individual room rewards, encounters, upper floors, full campaign |
| External asset sourcing | Blender GLB/master manifests; vendored EZ-Tree/license/hash evidence; credential probe | Useful generated hero assets when credentials are available; verified audio |
| AAA graphics | Editable arms/holds, native painted weapon/injury integration, trees, terrain, river and stronger palette | Richer room dressing, varied threats, stronger town composition |
| UI | REC overlay removed; adaptive exposure setting; extended field map; portrait play fits | Real touch/notched phone hardware and wider stress states |
| Debug/profile | Shared-buffer and shader-binding defects resolved; camera-relative keys; exact render counts/timings | Town render budget, total gameplay profiling and memory reduction |
| QA/release | Source suites, production build, isolated native Start/fire/exploration and compact actual captures | Sustained combat, whole-campaign regression and release |

The physics engine remains the existing custom arcade controller with a 1/120 s timestep, with bundled cannon-es for cosmetic rigid bodies. Collider authority is shared with visuals, not inferred from decorative meshes. This report records an inspectable iteration; the broader AAA goal remains open.
