# Blackwater inspection 08 — a readable radio repair corner

The selected graphic horror direction continues in **CAPE LODGE 75**. A player-facing radio, exposed circuitry, supported tools and a warm desk lamp now make its workbench recognizable. The kitchen gains shaped refrigerator doors and hardware, layered cabinet fronts and a real open shelf. This is one bounded address improvement; the wider AAA target remains active.

## Actual game images and access

- [Lit radio workbench](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-08-radio.jpg)
- [Same close view with lamp disabled](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-08-radio-unlit.jpg)
- [Standing radio view](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-08-radio-standing.jpg)
- [Kitchen](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-08-kitchen.jpg)
- [Kitchen reverse inspection](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-08-kitchen-close.jpg)
- [Town](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-08-town.jpg)
- [Portrait cottage](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-08-mobile.jpg)

These are native WebGPU game screenshots, resized/compressed without exposure enhancement or concept substitution. Desktop delivery is 960 × 600; portrait is 390 × 844. Files are 36–79 KB and use absolute paths for Codex Remote. Originals and genuine 320 × 200 standing radio/kitchen previews remain in `output/playwright/blackwater-08/final`.

Local game: [127.0.0.1:5200](http://127.0.0.1:5200/). The cottage is at world x158/z248, south of the z232 road. WASD moves, mouse aims/fires, number keys equip, B opens the field kit. The user's existing game tab and server were not restarted or navigated. QA used its own ephemeral server/browser and closed both.

## Construction and gameplay evidence

The radio's former back-facing blob is replaced with an open shell, contrasting enamel bezel, recessed speaker grille, tuning scale/dial, handle and telescopic aerial. Its controls face the actual player approach. A removed back, PCB, capacitors, transformer, wires, screwdriver and pliers rest on the real desktop. Larger components carry the repair story without relying on tiny repeated detail.

The refrigerator has shaped enamel casing, separated stepped doors, dark gaskets, handles, hinges, leveling feet, lower vents and rear condenser. Cabinet fronts have inset rails; the upper shelf has a physically open cavity over 24 cm deep, with supported plates and a cup. Generic radio/paper/fridge duplicates are excluded only at this authored address.

The controlled source model increases **29,007 → 31,439 triangles: +2,432**, with **15 material submissions and 13 furniture colliders unchanged**. The actual native seed 1474 model has **31,520 triangles**, compared with 29,088 in07. There are 153 authored module roles, 2,859 primitive records and zero duplicate owners. Walls, floors and cloth retain the preceding geometry. The reserved four-metre through-route and repair discovery anchor remain clear. All **94 ground-floor interiors / 187 apertures** pass the source regression. Upper floors remain closed.

Actual W input still collects **LODGERS’ RADIO REPAIR KIT**: fittings **0 → 4**, visible cases **11 → 10**. The starting pose and empty pack were controlled; collection was not called directly. Serialization, support, one-time collection and full-pack preservation pass source checks.

## Lighting and renderer diagnostics

The task lamp's base touches the desktop at world y1.09 m. Its articulated stem and tapered shade aim at the front repair area. Native light position is [162.5,1.83,243.7], target [161.93,1.27,243.5], intensity12, range4.5 m, cone0.62 rad, penumbra0.55. It adds **one SpotLight, zero shadow maps and zero fixture batches**; the coast now has five practical lights in the same two fixture submissions. All lamp geometry totals832 triangles. Owned fixture materials/geometry dispose once; borrowed district materials survive teardown.

Matched standing and close lamp-on/off captures show a warm focal pool with cool surroundings. The close repair-surface crop has mean encoded RGB [19.4,30.1,32.7] with the light off and [100.6,94.8,75.9] on. Automatic exposure is not locked; these are image measurements, not irradiance or a controlled photometric gain. Correctly extracted scene crops have channel standard deviations **17.2–74.8**, proving nonblank canvas content beyond HUD text.

The existing local 2048 sunlight map still covers the cottage player at actual projection [0.533,0.524,0.412]. A normal three-second W walk moved **24.36 m** and caused four cached-map recenters. The bridge walk maintained the camera **1.60 m above the shared ground/deck authority**.

Current same-build stationary diagnostics at 1280 × 800/DPR1:

| Configuration | Draws | Triangles | Median | P95 |
| --- | ---: | ---: | ---: | ---: |
| Original static details | 1,040 | 1,664,852 | 25.7 ms | 28.2 ms |
| Pooled static details | 928 | 1,664,864 | 26.3 ms | 30.1 ms |
| Pooled town repeat | 928 | 1,664,864 | 25.1 ms | 27.1 ms |
| Forest | 216 | 818,129 | 14.0 ms | 14.7 ms |
| River | 250 | 960,462 | 14.2 ms | 15.8 ms |

These are 22 submit-fenced scene/first-person resolve samples after eight discarded samples, **not gameplay FPS**. Existing pooling again removes112 native submissions; timings do not establish a causal speed increase. Tracked memory is899,314,272 bytes (~858 MiB). Building batching remains 1,250 → 484 submissions in 35 chunks, now 2,007,291 triangles. Cross-iteration totals also include concurrent work outside this cottage; the source delta above is the controlled comparison. Sustained combat and phone hardware remain unverified.

## Verification evidence

`node build.mjs` passed. The delegated focused cottage and all-interior group passed **9/9 tests**. Root's final task-lamp/discovery group passed **5/5 tests**. These disjoint groups cover supported geometry, real speaker/dial first-hit rays from the standing approach, shelf cavity, lamp footprint/aim/yaw, disposal, unchanged routes/colliders and collection.

Native Chrome 149.0.7827.55 loaded the isolated built game in **23,022 ms**. QA passed **33 desktop/portrait captures**, real firing, five archetype doorway walks, bridge traversal, supported pickup, live shadow recentering and portrait fit. Console/page errors and HTTP failures: **zero**. Existing warnings: Windows ignores powerPreference; one zero-vertex draw notice. Portrait is a 390 × 844 desktop GPU viewport, not phone hardware certification.

The immutable `output/playwright/blackwater-08/verified-dist` was hashed before/after QA. Final cottage, architecture, furniture and practical-light source hashes match that captured build. Evidence: `output/playwright/blackwater-08/final/cape-report.json`, `delivery-pixels.json` and parent `source-snapshot-check.json`. Native command: `node tests/cape-exploration-browser.mjs` with explicit PLAYWRIGHT_PATH, CHROME_PATH, CAPE_QA_ROOT, CAPE_QA_OUTPUT and CAPE_QA_LABEL overrides. This run has no failed capture predecessor.

## Exact visual scorecard

A focused read-only image reviewer inspected the actual on/off, standing, reverse and 320-pixel views. The radio's identity/hierarchy improves. The lit station is distinguishable at 320 pixels; individual repair tools alone do not prove the interrupted-repair story at that size. No severe highlight clipping is visible. Smooth light beneath furniture remains a risk because this practical does not cast shadows.

| Exact category | Score / 3 | Evidence and limit |
| --- | ---: | --- |
| Art direction | 2 | Painted graphic palette; large interiors remain uniform. |
| Hero/player | 2 | Existing clean Blender first-person work retained. |
| Obstacles/enemies | 1 | This pass does not establish three polished hostile roles. |
| Rewards/interactables | 1 | Supported useful discovery works; broader reward variety unproved. |
| World/environment | 2 | More specific cottage construction; upper floors still closed. |
| Materials/textures | 2 | Enamel separation, seams and hardware; large faces remain flat. |
| Lighting/render | 2 | Recognizable local light source and focal hierarchy; local shadow risk. |
| VFX/motion | 1 | Real firing checked; polished combat sequence unproved. |
| UI/HUD | 2 | Named pickup/field kit feedback and portrait fit. |
| Performance evidence | 2 | Native counts/fences; sustained combat/phone gaps. |

**Average: 1.7/3. Automatic failures remaining:** confirmed **local primitive dominance** from cabinet sides, backsplash, walls and ceiling. This does not establish a whole-game failure. The new workstation strengthens existing 2s; it does not justify a category-wide 3 or AAA acceptance.

Disconfirming next visual tests: inspect a short lateral walk around the desk for distracting light leakage; revise one cabinet's painted construction seams and compare at the existing standing view; show an uncaptioned320-pixel view to fresh viewers for radio/repair recognition. Broader acceptance still requires sustained town combat against a declared frame budget.

## Next explorable-floor boundary

A read-only gameplay investigation identifies a concrete prerequisite: the engine currently treats buildings/furniture as infinite-height 2D blockers and returns one terrain height at each X/Z. The renderer seals the two visible storeys apart, and cosmetic physics has no house slabs or stairs. Adding stair meshes alone would not make upstairs traversal work.

The next bounded implementation should opt only Cape75 into one shared plan for finite walls/slab pieces, stair opening, treads, landing and upper room. Terrain stays terrain; player support selection, finite-height body collision, eye/actor bases, bullets/projectiles and Cannon statics must consume that plan. Acceptance requires real ascent/descent, two occupants sharing X/Z on different floors, ceiling contact, shots blocked by slabs and bodies landing on the correct floor. See [bounded implementation plan](C:/Users/wolfk/Desktop/thelastdead/docs/cape75-upstairs-plan.md). No upstairs implementation is claimed in08.

## External asset sourcing and audio

Credential probe output: the current Windows presence-only probe checked Process/User/Machine environment scopes, printing no values:

```text
TRIPO_API_KEY=MISSING
GEMINI_API_KEY=MISSING
ELEVENLABS_API_KEY=MISSING
```

3D generator, image generator and audio generator skills and API/integration references carry forward from 06/07 and were loaded before source decisions. Provider generation remains blocked by credentials; none was attempted. Chosen sources: hero/player retains original Blender v2 arms/hold masters and runtime GLB; enemies/weapons retain bundled authored/imported assets; signature props/pickups use original Blackwater geometry; world/sky/background use original terrain/sky and licensed [EZ-Tree](https://github.com/dgreenheck/ez-tree); materials/textures/decals use painted roles and retained licensed bark/leaf maps; logos/icons/GUI art retain authored UI. Audio/SFX/voice retain existing game audio. No new generated audio or audio-quality acceptance is claimed. No proprietary game code/assets were copied.

## Skill-loading ledger and reference ledger

Director remains active. Gameplay systems, AAA graphics builder, UI designer, debug/profiler, QA/release and 3D/image/audio generator skills/references carry forward from [07](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-inspection-07.md) and linked06/02–05 ledgers. Focused geometry, read-only upstairs investigation and visual review follow the director's explicit phase-delegation instruction.

Current phase reads include the graphics implementation-blueprint.md, material-lighting-quality.md and performance-safe-visual-detail.md; procedural architecture grammar/compiler and geometry/material references. The gameplay investigation read gameplay-workflows.md and physics-engine-selection.md. Relevant prior phase references remain loaded: visual-scorecard.md, model-recipes.md, render-recipes.md, aaa-game-quality-gate.md, aaa-visual-scorecard.md, ui-patterns.md and UI fit/readability checklists, debug-profile-checklists.md, performance-profile.md, qa-release-checklists.md, visual-verification.md, playtest-qa.md, release.md, generator API/integration/workflows and audio-workflows.md. Paths are under C:/Users/wolfk/.codex/skills and expanded in prior ledgers. No reference-based approval or fallback is asserted.

## Phase ledger

| Phase | Bounded output | Broader status |
| --- | --- | --- |
| Gameplay systems | Supported pickup and 94 ground-floor authority retained | Upstairs finite supports/solids pending |
| External asset sourcing | Presence probe and original prop geometry | Generation blocked by credentials |
| AAA graphics | Readable radio/light and better furniture anatomy | Local primitive gate remains |
| UI | Named discovery and portrait fit retained | Touch/phone not certified |
| Debug/profile | Same-build native counts and diagnostic evidence | Combat cost/memory remain work |
| QA/release | Source suites, built native input, captures/pixels/hashes passed | No release/full-campaign certification |

Physics remains the custom arcade controller at a 1/120 s timestep plus bundled cannon-es for cosmetic bodies. Lamp and repair pieces add no new colliders or physics engine. This iteration is inspectable; the broad quality and fully explorable-world goal remains active.
