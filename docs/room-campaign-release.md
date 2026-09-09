# Compact campaign progression

The live campaign uses twelve authored rooms in three sectors. Each sector has three combat encounters followed by an exit vestibule. Clear an encounter, walk through an unlocked doorway, then fight the next encounter. The HUD identifies the room and objective. Enemy mixes, durability, budgets and simultaneous population rise across the descent.

## Architecture and sources

The room graph uses deterministic rectangular bands with paired carved doorways. Collision cells are authoritative for movement, AI and ray occlusion. A separate open-door render grid prevents closed collision gates from becoming permanent wall meshes. Co-op snapshots carry progression and rebuild collision gates on receipt.

This adapts room/portal and brush-opening ideas, not a port of an engine algorithm. Primary references: [id Software Doom](https://github.com/id-Software/DOOM) and [Quake visibility source](https://github.com/id-Software/Quake/blob/master/WinQuake/r_main.c). Local read-only research covered Dogfight floorplanMapSpec.js, floorplanGenerationProfile.js, floorplanVisibility.js, floorplanMapValidation.js, playableMapRuntime.js, kingGunfightMap.js and pineGunfightMap.js. No Dogfight staging or assets were modified. A full BSP compiler or portal PVS renderer is not implemented.

## Quality and performance

Full resolution is retained. Static transforms are frozen after batching; room batches retain their boundaries; weapon batching preserves animated parts. Enemy variations reuse the imported Warden mesh and shared Bellwraith geometry. Bundled crypt-wall, gunmetal PBR and flesh/metal textures supply room surfaces.

Two optimizations retain shading: skip direct BRDF evaluation for lights whose contribution is zero, and scissor the full-resolution transmission pass to conservatively bounded refraction samples. Isolated pixel tests returned zero differing channels. Transmission falls back to the complete viewport for unsupported geometry or near-plane-intersecting volumes.

The 144 FPS target is 6.94 ms per frame. Baseline 1920x1080 on the detected NVIDIA GTX 1650: Ossuary median 13.0 ms / p95 24.1 ms; Arc median 30.7 ms / p95 76.9 ms. These measurements do not support a 144 FPS guarantee. Final measurements and campaign QA are recorded separately below when complete.

## Workflow ledger

Applied skills: threejs-game-director (phase delegation and release evidence); threejs-debug-profiler (reproduction and measured frame budgets); local-dev-instances (preserve owned local server and user tab); threejs-procedural-materials (bounded direct-light shader change). Read performance/debug reference checklists and shadow-systems guidance. Model variants preserve the existing img2threejs/imported asset work rather than replacing it with low-detail stand-ins.

Phases: source/layout research; gameplay room/gate implementation; authored room materials and geometry; enemy variants; HUD; render optimization; traversal and visual QA; production build. Each phase was assigned bounded file ownership. Existing audio/network/weapon edits from other work were preserved.

## Verification

- Engine, room-gate, body and batching tests exercise collision, ray occlusion, physical room entry, existing combat and animation contracts.
- Room visual contract checks paired doorway openings and animated gate ownership.
- Browser traversal artifacts: `docs/room-progression-qa/`.
- Isolated shading evidence: `.logs/bounded-lighting.json`, `.logs/transmission-region.json`.
- Performance harness: `tests/frame-budget.mjs`; captures uncapped frame intervals, CPU render time and GPU timer queries at full 1080p.

Visual review is ongoing; the first screenshot exposed an overly dark blank starting wall and triggered another materials/composition pass. Do not treat the initial screenshot as an approved visual target.

## Measured result

The integrated full-resolution first-room sample (4 active enemies, 1920x1080, GTX 1650) measured Ossuary median 21.0 ms / p95 29.6 ms and Arc median 35.5 ms / p95 50.7 ms. Draw calls were 218 and 411 respectively, versus 249 and 562 in the old production sample. The new room layout/view differs from baseline, so this is not an isolated speedup comparison. The new scene is slower in this sample despite fewer draw calls. **144 FPS remains unmet**, and late encounters have not been certified to that budget. Evidence: `.logs/frame-budget-room-campaign-final.json`.

Combined engine, physical gate, first-person body, weapon batching and static-world checks passed 32/32. The production build includes every new runtime module. Existing local source server remains at http://127.0.0.1:5200/; its process and the user's game tab were not restarted.

## Visual review

The revised `docs/room-progression-qa/desktop-room-01-start.png` was inspected at 1440x900: the doorway is visible, wall panel relief and sector signals read, and the first-person weapon remains intact. The initial black-wall view was rejected. Current local-playtest scorecard (subjective, 10-point scale): entry readability 8, material variation 7, structural detail 6, horror identity 7, frame-budget compliance 2. This is a playable iteration, not a certified premium/144-FPS release.

## Final route corrections

A reserved pair of Manhattan corridors is carved through each room band before gate walls are applied. Cover blocks and rendered wall proxies use the same filtered recipe. Door openings explicitly clear old arena wall flags, rather than merely omitting new wall flags. This fixes old partitions that could strand the Ossuary rooms. A permanent regression checks both doorway approaches in every room/sector. The deterministic physical traversal reaches all nine encounter gates and all three sector exits, ending in victory.

Rapid sector changes also revealed a Three.js compileAsync/material disposal race. Outgoing room resources are retired only after their pending compilation resolves; detached rooms do not remain visible.

## Browser acceptance

The final browser run passed all nine encounter gates and three sector exits, ending in victory. It also passed real keyboard movement/weapon switching, death/restart, three sector screenshots and the 390x844 touch/HUD view. There were zero page errors and zero failed requests. The log retains texture-not-yet-loaded warnings during preparation; no missing asset requests occurred. See `docs/room-progression-qa/room-campaign-browser.json` and adjacent screenshots. All 33 combined automated checks pass.

## Final production performance

Latest built `/dist/` sample at full 1920x1080 on GTX 1650: Ossuary median 22.6 ms (44.2 FPS), p95 36.1 ms, 217 draw calls; Arc median 30.9 ms (32.4 FPS), p95 41.2 ms, 407 draw calls. Zero runtime errors. **The 144 FPS requirement is not achieved.** Evidence: `.logs/frame-budget-production-room-campaign.json`.
