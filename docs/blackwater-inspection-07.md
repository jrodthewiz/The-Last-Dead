# Blackwater inspection 07 — an abandoned cottage worth searching

The selected direction remains graphic horror: bold PS2/San Andreas proportions with painted materials and modern clarity. This is a bounded iteration in **CAPE LODGE 75**, not acceptance of the wider AAA target. The fitted kitchen, recessed sink, hob/kettle, upper cabinets, open dresser drawer, packed suitcase, interrupted breakfast and radio repair make this address more specific. Cloth now reads at standing distance. Cabinet faces, partitions, walls and ceiling still look too uniform.

## Actual game images and access

- [Bedroom](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-07-bedroom.jpg)
- [Folded bedding](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-07-bed-close.jpg)
- [Kitchen](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-07-kitchen.jpg)
- [Radio workbench](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-07-radio.jpg)
- [Discovery collected](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-07-discovery.jpg)
- [Town](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-07-town.jpg)
- [Portrait](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-07-mobile.jpg)

These are resized/compressed native WebGPU game screenshots, with no concept substitution or exposure enhancement. Desktop delivery is 960 × 600, 42–95 KB; portrait is 390 × 844. Absolute paths support Codex Remote. Originals and a genuine 320 × 200 standing preview remain in `output/playwright/blackwater-07/final`.

Local game: [127.0.0.1:5200](http://127.0.0.1:5200/). CAPE LODGE 75 occupies world x158/z248, south of the z232 road; its doors face z240/z256. WASD moves, mouse aims/fires, number keys equip, B opens the field kit. The user's game tab/server were not restarted or navigated. QA owned a separate ephemeral server/browser and closed both.

## Gameplay and construction

The repair case rests on the real dresser top at world y1.24 m, x161.55/z249.30. Its approach at x160.26/z249.30 clears furniture with a 64 cm radius. **LODGERS’ RADIO REPAIR KIT** supplies four existing salvaged fittings, half the weapon fitting cost. It adds no healing mechanic or pickup draw pool. An explicit visual base height/yaw supports this case; other cases keep ground placement.

Source tests cover collection once, full-pack preservation, serialization, real support and disappearance. Native W input yielded scrap **0 → 4** and visible cases **11 → 10**. Starting position and empty pack were controlled setups; collection was not called directly.

Only this address receives the authored layer. The final native seeded model has **29,088 triangles, 15 material submissions and 13 furniture colliders**. A controlled source comparison adds 8,146 triangles at unchanged 15 submissions. The suitcase has an obstruction and the pulled drawer enlarges its dresser footprint. The full 4 m through-route and 0.75 m shoulders survive. Source tests cover all **94 coastal ground floors / 187 apertures**. Upper floors remain closed.

QA caught a solid cabinet filling the sink opening, then flat generic curtain panels covering new pleats. The corrected cabinet frames its lowered bowl. Four authored windows replace duplicate cloth panels while all 14 rods remain. Blanket crests reach approximately 11.5 cm; curtains use 11.2 cm pleats/irregular hems without increasing sheet tessellation. Physical rays, projection checks and actual 320-pixel captures prove cloth shape, not whole-room premium quality.

## Lighting and renderer diagnostics

The previous 2048 shadow map stayed over downtown, leaving distant cottages unshadowed. The same 120 m local region now follows exploration. Its center snaps in light space to the 5.86 cm texel grid; a 4 m guard avoids stationary recentering. No new light/map was allocated. Cottage player projection lies inside the actual map at [0.533, 0.524, 0.412]. Three seconds of normal live W travelled 24.2 m and triggered four recenters without errors. This is one cached local map, not cascades or full-coast coverage. Moving-caster refresh, boundaries and sustained movement cost remain unverified.

Correct shadows make the room cooler/darker. Cloth/furniture remain recognizable, but small radio detail loses contrast. Its focal hierarchy needs a restrained practical or contrasting backing.

Static harbor pooling borrows exact geometry/material identities, preserving transforms, UVs, normals, layers, groups and shadow flags. Eligible static details exclude the truck, toggled rooms, chapter mechanisms, animated hooks, transparent sources, opposite winding and large slabs. Original objects/visibility restore during disposal. Inventory falls **165 → 50** submissions in 32 m cells. Existing building batches remain **1,250 → 484** across 35 chunks, preserving 2,004,859 triangles.

Final same-build native comparison, 1280 × 800/DPR1:

| Configuration | Draws | Triangles | Median | P95 |
| --- | ---: | ---: | ---: | ---: |
| Original static details | 1,041 | 1,657,740 | 26.6 ms | 30.6 ms |
| Pooled static details | 929 | 1,657,752 | 25.3 ms | 28.2 ms |
| Pooled town repeat | 929 | 1,657,752 | 44.5 ms | 47.8 ms |
| Forest | 218 | 818,141 | 13.7 ms | 15.0 ms |
| River | 252 | 960,466 | 14.1 ms | 14.7 ms |

These are 22 stationary submit-fenced scene + first-person resolve samples, after eight discarded samples, **not total gameplay FPS**. **112 fewer native draw calls** are confirmed. Conservative batch bounds submit 12 extra triangles. Variable sequential timings prove no causal FPS gain. Town's repeat misses the 33.3 ms renderer budget. Tracked memory is 898,907,842 bytes (~857 MiB). Crowd combat/phone cost remain open.

Paired central-crop mean absolute pixel difference is 3.17/255, RMS 4.74/255; 0.284% of channel samples differ by over32. Exposure/time are not locked, so this supports transform tests/visual inspection, not exact parity. Actual cropped scene-channel standard deviations range 13.6–74.2, demonstrating nonblank canvas content beyond HUD text.

## Verification evidence

`node build.mjs` passed. Latest source groups passed: **15** architecture/cottage/batching/shadow checks and **21** discovery/static pooling/navigation/vehicle/chapter checks. Current-work coastal-instance/pack checks also passed. Overlapping groups are not added together.

Native Chrome **149.0.7827.55** loaded the isolated built game in **23,527 ms**. Final QA passed **29** desktop/mobile screenshots, real firing, five archetype doorway walks, hill/bridge traversal, supported collection, live shadow recentering and portrait fit. Desktop:1280 × 800/DPR1; mobile:390 × 844 desktop GPU viewport, not phone hardware. Console/page errors and HTTP failures: **zero**. Existing warnings: Windows ignores powerPreference; one zero-vertex draw notice.

`output/playwright/blackwater-07/verified-final-dist` was hashed before/after QA. Final cottage/architecture/shadow source hashes also agree with the captured build. An incorrect Chromium executable path caused the first launch failure; its report is preserved separately before using installed `chrome-win64/chrome.exe`. Initial07 images remain separate from final corrections. Failed runs are not acceptance evidence.

Native command: `node tests/cape-exploration-browser.mjs`, with PLAYWRIGHT_PATH, CHROME_PATH, CAPE_QA_ROOT, CAPE_QA_OUTPUT and CAPE_QA_LABEL overrides. Evidence: `output/playwright/blackwater-07/final/cape-report.json`, `delivery-pixels.json` and parent `final-source-snapshot-check.json`.

## Exact visual scorecard

A focused read-only reviewer inspected initial and corrected game images. No full council/vote is claimed. Cloth criticism is resolved; category-wide acceptance is not.

| Exact category | Score / 3 | Evidence and limit |
| --- | ---: | --- |
| Art direction | 2 | Painted town/palette; interiors too rectangular. |
| Hero/player | 2 | Existing authored weapon/wear and clean Blender first-person work retained. |
| Obstacles/enemies | 1 | Current threat frame does not prove three hostile roles. |
| Rewards/interactables | 1 | Supported case/collection verified; two polished reward forms not demonstrated. |
| World/environment | 2 | Specific cottage, open routes, terrain/river; uniform blank surfaces remain. |
| Materials/textures | 2 | Cloth, trim, seams/shared roles; large faces still flat. |
| Lighting/render | 2 | Correct local shadows; radio hierarchy needs work. |
| VFX/motion | 1 | Firing works; polished combat effect/reaction sequence unproved. |
| UI/HUD | 2 | Named collection/pack feedback; portrait fits. |
| Performance evidence | 2 | Paired native counts/diagnostics; combat/phone cost unverified. |

**Average: 1.7/3. Automatic failures remaining:** confirmed **local primitive dominance** in cottage cabinets, partitions, walls and ceiling. This does not establish whole-game primitive dominance; town has layered façades, damage, wrecks and dressing. Premium thresholds remain unmet. Next bounded test: make interrupted radio repair/departure recognizable from standing distance and a320-pixel preview without the toast. Separately capture60seconds of town combat before accepting a gameplay budget.

## External asset sourcing and audio

Credential probe output from this iteration, presence markers only:

```text
TRIPO_API_KEY=MISSING
GEMINI_API_KEY=MISSING
ELEVENLABS_API_KEY=MISSING
```

3D generator, image generator and audio generator instructions were loaded before preceding source decisions. Missing credentials still block provider generation; none was attempted. Chosen sources: hero/player retains original Blender v2 arms/hold masters and runtime GLB; enemies/weapons retain bundled authored/imported assets; signature props/pickups use original Blackwater construction; world/sky/background use original terrain/sky and licensed [EZ-Tree](https://github.com/dgreenheck/ez-tree); materials/textures/decals use painted roles/existing licensed bark/leaf maps; logos/icons/GUI art retain current authored UI; audio/SFX/voice retain existing game audio. No new generated audio/audio acceptance is claimed. No proprietary game code/assets were copied.

## Skill-loading ledger and reference ledger

Director active. Gameplay systems, AAA graphics builder, UI designer, debug/profiler and QA/release skills/references carry forward from [06](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-inspection-06.md) and linked02–05 ledgers. 3D/image/audio generator API/integration/workflow references remain loaded. Focused cottage implementation, read-only town-cost exploration and image critique follow the director's delegation instruction.

Current phase reads: architecture grammar/compiler and authored-tower example; model-recipes.md; render-recipes.md; visual-scorecard.md; procedural-model-quality.md; material-lighting-quality.md; performance-safe-visual-detail.md; aaa-game-quality-gate.md; aaa-visual-scorecard.md; performance-profile.md; qa-release-checklists.md; visual-verification.md; playtest-qa.md; release.md; cached-clipmap-shadows.md and shadow-clipmaps.js. References are under C:/Users/wolfk/.codex/skills; full paths are in prior ledgers. No reference-based approval/fallback is asserted. The existing native WebGPU QA harness exercises normal Start, pointer lock, actual input, GPU fences and isolated ownership.

## Phase ledger

| Phase | Bounded output | Broader status |
| --- | --- | --- |
| Gameplay systems | Supported discovery/collision authority and collection passed | Upper floors/individual encounters open |
| External asset sourcing | Presence probe; authored cottage; licensed forest retained | Generation blocked by credentials |
| AAA graphics | Richer anatomy, readable cloth, correct local sunlight | Local primitive gate still fails |
| UI | Named toast/pack state; portrait fits | Touch/phone not certified |
| Debug/profile | Reversible pooling/paired counts; coverage defect fixed | Combat cost/memory remain work |
| QA/release | Source suites, built native input/captures, pixels/hashes pass | No release/full-campaign certification |

Physics engine remains the custom arcade controller at a1/120s timestep, plus bundled cannon-es for cosmetic rigid bodies. New suitcase/drawer collider footprints share building authority. This iteration is reviewable; the broad AAA goal remains active.
