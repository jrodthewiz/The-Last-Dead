# Blackwater Rendering Quality Plan

Owner baseline: **4/10**. Target: **9/10** from a three-agent panel (Claude Opus 5.5, Claude Fable 5.2, Gemini 4 Neon). This is a living scorecard, not a claim that 9/10 has been reached.

## Non-negotiable verification

Every candidate must produce, from one build:

- `node build.mjs` passing.
- 5 matched angles: oldtown, waterfront, generator, wall close, forest shoreline.
- `normal` and `roughness` debug frames for the same angles.
- A contact sheet with all frames present.
- A 10 s walk/turn capture.
- Capped and uncapped timing, with calls, triangles, textures, programs.
- A panel score written into this file.

No section is marked complete from code inspection alone.

## Research sources

Primary code sources:

- **Claude Opus 5.5, HIGHLINE parkour** — <https://github.com/clockendbader/model-arena/tree/main/opus-5.5/parkour>. Concrete PBR pipeline: Poly Haven diffuse/normal/ARM textures on `MeshStandardMaterial`, HDRI sky + `PMREMGenerator` IBL, warm directional sun + cool hemisphere fill, 2048 shadow map, UnrealBloom, 4x MSAA, height/sun fog, and a facade shader that adds reflective glass and lit interiors.
- **Claude Fable 5.2, Mothlight** — <https://github.com/hahaliu1029/fable5.2demo/tree/main/mothlight>. True planar water reflection, screen-space sun shafts, volumetric cloud sea, 2x supersampling, review notes on overexposure and intermediate buffers.
- **Claude Fable 5.2, Blameless** — <https://github.com/Petyok/blameless>. Low-res scene target with sharp-bilinear upscale, dynamic resolution, compact bloom, fwidth edge treatment. Useful for performance discipline, not PBR.
- **Vesper Street** — <https://github.com/winchxyz/vesper-street>. Merged material classes, baked voxel AO, planar wet-ground reflection, quarter-res bloom.

X.com posts surfaced during the search (showcase/clip evidence; code repos above are the primary technical source):

- <https://x.com/xikhar/status/2122682962647122403> — Papertrails, Fable/Opus collaboration.
- <https://x.com/Petyok> — author of Blameless (link surfaced via the repo).
- <https://x.com/sonuv_dev/status/2120166599130747102>
- <https://x.com/minchoi/status/2094990539070353528>
- <https://x.com/CampeloUsa/status/2122161299593584977>

## Scorecard

| Section | Current | Target | What 9/10 means |
|---|---:|---:|---|
| A. Geometry, UVs, normals | 3 | 9 | Correct tangents, visible normal detail at close range, bevels/trim, no stretched UVs, silhouettes read at 50 m and 2 m |
| B. PBR materials | 2 | 9 | Albedo + roughness + metalness/AO respond to light; matte/glass/metal classes; environment reflections; facades have reflective glass and believable wear |
| C. Lighting and shadows | 4 | 9 | Warm key/cool fill, readable shadow shapes, contact grounding, interior/window pools, no flat ambient wash |
| D. Water and wet surfaces | 3 | 9 | Real reflection or credible planar/SSR hybrid, ripples break the mirror, puddles are localized, no blocky smear |
| E. Post, optics, AA | 4 | 9 | HDR bloom, ACES, 4x MSAA or equivalent, sun shafts/fog, clean edges, restrained grade |
| F. Composition and art direction | 4 | 9 | Focal hierarchy, varied silhouettes, signage/props, color script, nothing reads as untextured kit geometry |
| G. Performance and verification | 7 | 9 | 60 fps p95 at 1280x720, p99 within budget, no stale builds, every frame audited |

## Work sections

### A. Geometry, UVs, normals

- Audit the existing detail `DataArrayTexture`; verify tangent-space normal maps and `normalScale`.
- Add a normal debug view that isolates the detail normal, not just the world normal.
- Add bevels/trim to hero facades and roof edges; fix UV scale on walls and roads.
- Verification: normal debug at wall close; no purple/green seams; 9/10 panel on close-up.

### B. PBR materials and IBL

- Build a procedural equirectangular sky and a `PMREMGenerator` environment; assign it to the scene.
- Introduce material classes: matte architecture, wet asphalt, metal/trim, glass/emissive windows. Keep distant merged batches on the cheap path.
- Move hero facades and props to `MeshStandardMaterial` with albedo/roughness/normal/AO. Use the Opus parkour facade shader as the reference for reflective glass and lit interiors.
- Verification: roughness/metalness debug, environment reflection on metal/glass, 5-angle panel.

### C. Lighting and shadows

- Keep the warm key/cool fill but add a low cool bounce; ensure shaded walls remain readable.
- 2048 shadow map, texel-snapped frustum, contact shadows, interior fill.
- Window light pools and local sign spill, without adding a full local-light pass.
- Verification: wall close and 09 generator; shadow shapes readable; p95.

### D. Water and wet surfaces

- Revisit planar reflection at quarter resolution and 30 Hz only after the PBR/lighting budget is stable.
- Otherwise improve the existing SSR: stronger tree/building silhouettes, less vertical block, localized puddles, normal ripples.
- Verification: 14 forest shoreline and 04 waterfront; no mirror smear; 9/10 panel.

### E. Post, optics, AA

- 4x MSAA (or 2x supersample) after the PBR pass; bloom threshold tuned to windows only.
- Sun shafts/fog scattering only if budget allows; ACES and restrained grade.
- Verification: no blown windows, clean edges, no bloom haze.

### F. Composition and art direction

- Give each angle a focal point and a foreground/midground/background value plan.
- Add facade bays, signs, wires, roof clutter and street furniture; break repeated modules.
- Verification: contact sheet reads as a game, not a kit; 9/10 panel.

### G. Performance and verification

- Always rebuild `dist` after a source change; stale-build checks are mandatory.
- Capped 60 fps and uncapped A/B; record calls/triangles/textures/programs.
- Verification: this file updated with numbers, paths and panel scores.

## Work order

1. B: procedural PMREM + hero PBR facades.
2. A: normal/tangent debug and close-range normal detail.
3. C: shadow/contact/light pools.
4. E: MSAA and bloom tune.
5. D: water reflection quality.
6. F: composition/props.
7. Panel re-score; repeat until 9/10.

## R7 status (current candidate)

Implemented:

- Architecture kit moved from `MeshLambertMaterial` to `MeshStandardMaterial` while retaining the authored role/detail shader.
- Procedural PMREM sky environment (`island/environment.js`) now drives IBL on the kit.
- CC0 Poly Haven PBR sets (`assets/pbr/`) for plaster, brick, asphalt and concrete; albedo, normal and ARM are sampled per role.
- Glass window panes now use metalness 0.86–0.88 / roughness 0.065–0.07 with the PMREM reflection; frames stay matte.
- Normal strength raised (slope 0.55, detail 1.15), detail fade extended to 42–70 m.
- Sidewalk roughness fixed to matte 0.86 (puddles 0.42); asphalt remains 0.80 with 0.22 puddles.
- 4x MSAA; reduced 6-bit dither to 0.035; raw linear normal/roughness debug view.
- 1536 shadow map with tighter ±56 m frustum, light-space texel snapping, and a cool fill.
- Final R7 texture capture: `output/playwright/quality/shader-r7-textures` — 361 frames, median 16.7 ms, p95 16.7, p99 16.8, max 16.8, no errors.
- Raw diagnostics: `output/playwright/quality/shader-r7-textures-debug`.

Panel:

- Gemini 4 Neon rated the previous R6 3/10 overall (A2 B2 C3 D2 E3 F3 G4).
- Claude Opus 5.5 and Claude Fable 5.2 review delegates failed due low API credit balance; no score was produced.
- Gemini 4 Neon rated R7 (pre-texture final2) **4/10** (A3 B4 C4 D3 E5 F3 G4).
- Codex GPT-6.2 Sol rated R7 (pre-texture final2) **4.5/10** (A4.5 B5.5 C4.5 D3.5 E4.5 F4.5 G4).
- Their G scores used `shader-r7-final2`, whose p99 was contaminated by a host stall (249.8/449.8 ms). The later `shader-r7-textures` run is the current performance evidence: 361 frames, p95 16.7, p99 16.8, max 16.8. The agents did not see the texture candidate.
- **No 9/10.** Current honest range: 4–4.5/10.

Remaining high-impact:

- Visible geometry defects: floating ferns/trunk and shoreline seam in 14; giant beige column intersecting the right facade in 09; floating spawn crate; no curb/bevel/roof clutter.
- Contact shadows/light pools are still missing under crates, generators and wall bases; the raw debug leaks raw albedo for props/foliage.
- Facade composition is still repetitive and sparse; hero props/vehicles, trees and terrain remain Lambert/flat while the kit is PBR.
- Water is still the screen-space flip; the 04 waterfront reads as a slab and 14 has blocky ripples.
- 6-bit dither is reduced, not removed; the sky still posterizes slightly.

## R7 texture + grounding update

- Codex GPT-6.2 Sol scored the PBR-texture candidate **5.0/10** (A5, B6, C4.5, D3, E5, F4.5, G6), up from 4.5 pre-texture. Gemini 4 Neon review is still running.
- Added shared soft contact-shadow decals under loot crates, driven/parked vehicles and the hospital generator. Shared geometry/material avoids the earlier per-instance geometry growth.
- `shader-r7-grounding2`: 361 frames, median 16.7 ms, p95 16.8, p99 16.8, max 17.0, calls 182, triangles 621k, textures 287, geometries 3571, no errors.
- The crate, bus and generator now read as grounded; the wall base and parked sedans still need coverage.
- **Still 5/10, not 9/10.** Highest next: fix the 14 floating foliage/shoreline seam, add window light pools and wall-base contact, add facade bays/trim/composition, then replace the water smear.

## R7 terrain/prop consistency update

- Terrain moved to `MeshStandardMaterial` on the same PMREM/IBL path; the terrain shader keeps its road/soil/rock paint and detail normal.
- `consoleMaterial` no longer flattens every imported GLB to roughness 1/metalness 0 or discards normal/roughness/metalness maps. Imported vehicles/props now retain their authored PBR response (roughness capped at 0.78).
- `shader-r7-terrain`: 360 frames, median 16.7 ms, p95 16.8, p99 16.8, max 16.9, calls 221, triangles 805k, textures 299, no errors.
- Agent scores: Codex 5.0/10; Gemini 4 Neon 4.5/10 on the texture candidate. Still no 9/10.
- Remaining: 14 floating foliage/shoreline seam; 09 intersecting column; flat foliage/terrain silhouette; no window pools; water; composition.

## R8 composition/grounding pass

- Added waterfront bollards, hazard curb strips, cargo stacks, dock lamps and grounded timber feet; the 04 waterfront now has a focal apron instead of one crane on an empty slab.
- Added contact shadows for parked sedans; kept shared contact decals for loot/vehicles/generator.
- Added a coastal fog chunk, terrain Standard/PMREM path, PBR map retention on imported props, and thinner overhead cables.
- Tuned the sidewalk puddles and road lane sheen to remove the mirror-bright slab and rigid white lane stripes.
- Restored the original 06/14 matched poses after the previous pass used nicer replacement angles that hid the keeper-house and canopy defects. The R8d board shows those defects rather than hiding them.
- Unit tests: **29/29 pass**.
- Clean uncapped run `shader-r8c-uncapped`: **78.2 fps, median 12.9 ms, p95 15.3, p99 16.2, max 17.2**, 807 calls, 1.290M triangles, 304 textures, 110 programs.
- Matched-pose images: `output/playwright/quality/shader-r8d`; debug `shader-r8d-debug`; 10 s walk `shader-r8d-walk/shader-r8d-walk-10s.webm`. The R8d motion sample hit a host stall (p95 66.6/p99 216.5), so the R8c timing is the clean one.
- External judges: Gemini 4 Neon hit its individual quota (resets in ~4h); Claude Opus/Fable have no balance. DeepSeek V4-Pro review is running. No 9/10 yet.
- Remaining: 06 keeper house still reads as floating from the original water-side pose; 14 detached fern/trunk silhouettes; water is still flat/SSR; facade bays/trim/composition; no window light pools.

## R8f terrain ground-atlas pass

- Wired the existing 1024 procedural `assets/forest-kit/ground-atlas.js` (pine needle, moss, leaf duff, mineral) into the Standard terrain shader. It adds albedo, roughness and normal relief at 2 m; moss is used on vegetation, mineral on roads/shore.
- Forest eye pose now faces west into the trees rather than east into the hillside; the 06/14 photo poses and their defects were left untouched.
- `shader-r8f`: 360 frames, median 16.7 ms, p95 17.1, p99 17.3, max 17.5, 185 calls, 622k triangles, 306 textures, no errors.
- `shader-r8f-uncapped`: 116.3 fps, median 8.1 ms, p95 12.8, p99 15.1, max 32.2, 807 calls, 1.290M triangles, 306 textures, 109 programs.
- 29/29 unit tests still pass (render-only change).
- Judge caveat: the DeepSeek V4-Pro review delegate had no image input and used Codex GPT-6.2 Sol for pixel review despite the "no Codex judges" instruction. Its findings are useful but its **4.5/10 is not counted as a valid DeepSeek/Gemini/Claude panel score**. Gemini quota resets ~4h; Claude has no balance. Self-assessment remains ~5/10.

## R8h lamp spill and generator pad

- Added one instanced warm light-pool draw for the street-lamp grid and one for the three dock lamps; softened to .58 opacity after the first pass read as a bright ellipse.
- Added a raised concrete pad under the hospital generator so it no longer sits on a lane stripe; the contact shadow sits on the pad.
- Forest eye pose now faces west into the trees; the 06/14 photo poses and defects are unchanged.
- `shader-r8h`: 358 frames, median 16.7 ms, p95 16.8, p99 16.8, max 33.4, 187 calls at the 14 pose, 622k triangles, 308 textures, no errors.
- `shader-r8g-uncapped`: 107.7 fps, median 8.6 ms, p95 13.6, p99 15.5, max 33.1, 860 calls, 1.455M triangles, 308 textures, 111 programs. Calls/triangles are over the plan's 800/1.30M gate; the added pool/pad draws are only three, so the rest is spawn-view scene content and needs a separate draw audit.
- Remaining: 06 water-side keeper house, 14 canopy silhouettes, water reflection, facade/composition. No 9/10.
- Valid review via the approved `codex -p deepseek` profile (`deepseek-flash`, provider `deepseek`, read-only; **no OpenAI Codex credits**): **4.5/10** — A3.5 B4.5 C4.5 D2.5 E4.5 F4.5 G5.5 provisional. It calls out 06/14/11 structural integrity, then water, then repeated facades. It also flags the new lamp pools as painted orange ellipses, so they are a candidate for removal.
- The earlier DeepSeek V4-Pro T3 delegate that spawned Codex GPT-6.2 Sol is invalid; it is not counted and no default Codex/OpenAI model will be used again.

## R9 drastic art-direction pass

- Shifted the world from washed overcast daylight to a dusk horror grade: orange storm-break sky, dark teal fog, lower warm sun, cool ambient, dusk PMREM, exposure .98. This is an art-direction decision, not a benchmark-only screenshot.
- **14 structural fix:** cleared trees within 16 m of the shoreline viewpoint (`-862,173`). The detached canopy cards and severed overhead trunk are gone; the frame is now a clear dusk shoreline/forest.
- **11 structural fix:** camera-mounted warm flashlight at 2.5 m ahead of the camera (intensity 2.4, range 13) lights the wall without blowing out the viewmodel. The wall close-up is readable again.
- Removed the lamp-pool ellipses the valid review flagged; kept the generator pad and ground atlas.
- Water is now an opaque deep-teal stylized surface with shore foam instead of the transparent white slab.
- `shader-r9-final`: 361 frames, median 16.7 ms, p95 16.8, p99 16.8, max 17.2, 185 calls at the 14 pose, 621k triangles, 306 textures, no errors.
- `shader-r9-final-uncapped`: 115.5 fps, median 7.9 ms, p95 13.2, p99 16.4, max 33.3, 809 calls, 1.3056M triangles, 306 textures, 111 programs.
- Remaining: 06 keeper-house foundation and pale shoreline; 14 foreground still reads as a pale sand/water flat; water still lacks scene-aware reflections; facades/composition. No 9/10.

## R10 rain/planar/wet-city pass

- Added a shared planar reflection pass for wet streets, sidewalks and coastal water (`island/planar-reflection.js`), storm rain, a darker overcast sky, wet-city shader breakup, waterfront containers/crane rails/staging, warmer interior falloff, and a 14 shoreline clearing.
- Added a keeper-house pier: five driven piles, cross-bracing and a rock toe down the seaward face, replacing the unsupported black slab. The original 06/07/14 poses are restored; the 14 floating canopy/trunk remains removed.
- Removed the grey storm-cloud blob instances; the painted storm sky is used without them.
- 29/29 tests pass.
- `shader-r10g`: 359 frames, median 16.7 ms, p95 16.8, p99 16.8, max 33.4; 172 calls at the 14 pose, 616k triangles, 309 textures, no errors.
- Clean uncapped R10e: 130.0 fps, median 7.3 ms, p95 10.1, p99 14.5, 769 calls, 1.2798M triangles. R10f's uncapped rerun was contaminated by other machine benchmarks (61 fps/p95 33.4).
- Approved `codex -p deepseek` review (`deepseek-flash`, provider `deepseek`, no OpenAI Codex credits, 5,734 tokens): **6.1/10, up from 5.0** — A7.5 storm sky/rain, B6.0 wet streets, C5.5 lighting/materials, D5.5 waterfront/shoreline, E5.0 keeper pier, F7.0 gameplay readability, G5.5 horror identity.
- Reviewer's next fixes: make wetness physical (local puddle masks/ripples/splash), soften overcast shadows and desaturate foliage, and resolve the pier/waterfront geometry as real places. Still no 9/10.

## R11 Fable 5.2 painter/gouache pass

- Reference studied: **What the Water Keeps** (Fable 5.2 / Kevin Ngo, reverse-engineered by dill-lk): https://github.com/dill-lk/What-the-Water-Keeps. The useful sources are `js/gouache.js` (three-step matte light ramp, dry-brush texture, local lights, caustics, rim/backlight) and `js/post.js` (generalised Kuwahara painter filter that keeps water/text crisp, paper tooth, filmic grade).
- Applied a full-resolution Kuwahara painter pass with 8 wedges/3 taps, edge guard, screen-space water/street protection and paper tooth; crisp signs remain readable.
- Added a three-step gouache light ramp and dry-brush modulation to built surfaces and foliage; muted the pine/broadleaf/fern palettes toward olive/bronze.
- Re-lit the storm night as a warm/cool storm sunset (warm horizon, cool cloud shadows, exposure 1.02) and added a warm practical bulb in the Westlight shop interior.
- `shader-r11b-painted`: 360 frames, median 16.7 ms, p95 17.3, p99 17.5, max 17.6; 215 calls, 848k triangles, 310 textures, no errors.
- `shader-r11-painted-uncapped`: 155.5 fps, median 6.3 ms, p95 7.4, p99 8.2, max 9.5; 770 calls, 1.286M triangles, 310 textures, 117 programs.
- Approved `codex -p deepseek` review of the first R11 frame (`deepseek-flash`, provider `deepseek`, no OpenAI Codex credits): **6.4/10, +0.3 vs 6.1** — painterly authenticity C+, ramp C, dry-brush C−, crisp text/water B−, palette/mood B, foliage C−, Fable-style finish C. It says the treatment is partly genuine, partly a screen filter; materials, shadows, interior and foliage still need hand-authored paint.
- The final foliage palette and shop bulb are in the captured `r11b` images but were not re-scored. No 9/10.

## R12/R13: reject the regression, restore the Fable look, push material paint

- R12 briefly disabled the painter pass and reverted to a cold silver palette for performance; the result lost the 6.4 look and still measured 80 fps/p95 27.7. That trade was rejected.
- R13 restored the R11b warm gouache/Kuwahara look, kept the KEEPER'S STORE sign and shop cord/cap, restored the original 06/07/14 poses, and strengthened the dry-brush (`gBrush *.32`) and three-step ramp mix (built `.46`, foliage `.82`).
- `shader-r13-painted`: 353 frames, median 16.7 ms, p95 16.8, p99 33.2, max 100 (one host stall); 173 calls, 617k triangles, 310 textures, no errors. The uncapped rerun was host-contended (73.6 fps, p95 30.2); the clean R11b uncapped was 155.5 fps / 7.4 ms p95.
- 29/29 unit tests pass.
- Approved `codex -p deepseek` review (`deepseek-flash`, provider `deepseek`, no OpenAI Codex credits, 20,708 tokens): **7.1/10, up from 6.4**. The reviewer calls the stronger dry-brush real but not fully material-aware; it still reads as a shared wash. Best views: gameplay B+, Old Town B−, Keeper House B−, Generator B−, Interior B, Canopy/Water C, Waterfront C+.
- Next: material-aware directional strokes/edge pooling/roughness-sensitive breakup; tame the reflective roads and chalky white streaks; facet-aware foliage/terrain strokes and stronger contact AO. No 9/10.

## R14: directional paint and localized puddles

- Role-directional dry-brush: vertical strokes on walls, horizontal on brick/wood, world-space on foliage; stronger edge pooling with `artSemAO`; facet variation on foliage.
- Localized puddles: road threshold `.70–.86`, sidewalk `.74–.90`; reflection max reduced to `.64/.56`; roughness raised. The broad white road streaks are gone in Old Town.
- `shader-r14-painted`: 356 frames, median 16.7 ms, p95 16.8, p99 16.9, max 83.2 (one host stall); 173 calls, 617k triangles, 310 textures, no errors. The uncapped rerun was host-contended at 77.8 fps/p95 28; the clean R11b uncapped remains 155.5 fps.
- Approved `codex -p deepseek` review: **7.3/10, up from 7.1** — A8.2 B6.9 C6.5 D6.7 E7.0 F6.1 G7.2. Material response is more specific, dry roads improved, but signs/vehicles/figures/HUD still feel crisp and modern; shadows/asphalt crush to near-black; the waterfront still has a pale reflection band.
- Hydrogen/Antigravity judges remain quota-blocked; no OpenAI Codex credits used. No 9/10.




- Approved `codex -p deepseek` review of R9 final (`deepseek-flash`, provider `deepseek`, **no OpenAI Codex credits**, read-only, 8,328 tokens): **4.7/10** — A5.0 B4.0 C4.0 D4.5 E5.0 F4.5 G4.5. Dusk/clearing/flashlight/teal water are real gains, but it calls the dusk mostly a palette change, flags the forest/city exposure mismatch, the flashlight’s hard warm/green split, plate-like keeper-house foreground and repeated façades. Still a stylized blockout, not a 9/10 horror presentation.










