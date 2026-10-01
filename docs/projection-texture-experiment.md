# Offline image projection texture experiment

The technique works on this repository's procedural meshes. Two actual map subjects now have generated surface art baked into ordinary 512×512 UV textures: the mourning cabinet from `afterlife-props.js` and the Recovery patch assembly from `room-kit.js`. No replacement model was invented. The default game does not load these full-model atlas prototypes. The later v5 pass described below reuses a projection-derived surface field in an existing production texture slot.

## Production continuation: shared wood surface v3

The next pass paints the registered native cabinet sheet with aged wood, then bakes only its flat rear CaseBody surface into a reusable wood tile. Existing high-frequency grain is retained offline so the narrow projection does not soften the shared material. `scripts/bake-shared-wood.py` exports `assets/textures/afterlife-cabinet-wood-projected-v3.webp`; `renderer.js` replaces the existing world wood map with it. No model assembly, UV, collider, animation pivot, material slot, shader, sampler, light or render pass changes. Object-specific cabinet hardware/enamel art stays in the isolated prototype rather than appearing on unrelated piano/drawer surfaces.

Both original and replacement are 512px, one existing shared color map, about 1.33 MiB RGBA8 with mipmaps. The compressed replacement is 36,884 bytes versus 40,548 bytes originally. Original artwork and lossless authoring inputs remain intact in `.art-source`; runtime generation/baking never occurs. The actual-scene review finds a modest near-view grain/wear improvement, not a dramatic upgrade at distance. Full map-flow, spawning, real-game visual/performance evidence and reproduction are tracked in [map-v5-iteration.md](map-v5-iteration.md).

Open `http://127.0.0.1:5200/projection-lab.html` in a separate tab. Compare **Untextured source**, **Imagegen bake**, **Source-color atlas**, and **Neutral geometry**, then inspect front, corner, rear, distance, warm and cool views. Drag/scroll orbit controls also work. This inspection stage uses simple neutral walls/floor; it is not a screenshot of the production dungeon. The untextured baseline is the factory's solid material colors. Production also supplies shared maps, including `afterlife-cabinet-wood-v1.webp`; this baseline must not be mistaken for a measurement of the complete current game.

## What was baked

1. Export the assembled meshes' exact positions, normals, indices and material values from the existing factories. Geometry made in JavaScript is still real mesh geometry and can be exported.
2. Blender 2.93 performs UV Smart Project, without remeshing, rendering or adding triangles. An editable `.blend` and the original data remain in the ignored preservation archive.
3. The CPU preparation script renders six orthographic clay projections with a depth buffer. Front/back/right/left/top/bottom use fixed registration on a 1536×1024 sheet. Depth-discontinuity outlines make the real plaque, trim, service patch and fasteners clear in the final painting reference.
4. Built-in Imagegen paints those sheets with restrained enamel wear, oxide, mineral streaks and grime. Each prompt requests unchanged framing/silhouette and diffuse surface art without directional illumination. An independent visual reviewer identified doubled cabinet trim and an understated service patch in v1. A second geometry-guided generation removes the invented vents, follows the actual plaque/meeting strip, restores the service patch's contrast and varies front/rear staining. The selected v2 images are copied into this repository's authoring archive; v1 and the original generated files remain intact.
5. The offline baker rasterizes the mesh's UVs, projects each texel to the best facing view, rejects occluded samples using reference depth, and dilates island gutters. A one-pixel reference neighborhood handles thin faces without abandoning depth rejection. Hidden faces keep their source color, with an explicit authored charcoal fallback for the Recovery rails to avoid an exposed orange edge. It produces indexed mesh JSON and a lossless WebP albedo. Generation and baking never run in the browser.
6. A single standard PBR material samples the color atlas. Source roughness and metalness are retained as constant-per-part vertex values through a small standard-shader hook. There are no extra normal/ORM maps, displacement, projection shaders, extra rendering passes or added lights.

| Subject | Source → baked triangles | Source → baked vertices | Material draws, batched source → atlas | Atlas estimate, RGBA8 with mipmaps |
|---|---:|---:|---:|---:|
| Cabinet | 352 → 352 | 660 → 764 | 4 → 1 | 1.33 MiB |
| Recovery patch | 72 → 72 | 144 → 144 | 3 → 1 | 1.33 MiB |

The cabinet needs 104 additional UV seam vertices, not additional triangles. Both atlases have zero detected interior UV overlaps. The six external views paint 39.9% of occupied cabinet texels and 75.9% of patch texels: the assembled parts contain many permanently occluded faces. This percentage is an atlas coverage diagnostic, not a visible-screen coverage guarantee. Hidden and thin occluded sides retain source material colors except for the documented rail palette override.

Only one atlas is needed per selected baked subject, shared by repeated copies. The inspection page intentionally caches both the source-color and painted atlas for each visited subject, so its total residency is higher than a single selected runtime asset. These unreferenced experiment files are included by the build's existing `assets` copy, but are never requested by the default game.

## Performance decision

**No automatic full-atlas map rollout from v2.** Adding a texture to an untextured mesh is not free. Fewer draws lowered CPU submission time, but the measured GPU work increased against the solid-color factory baseline. The user's zero-performance-impact condition therefore did not pass for blanket conversion of untextured map parts. That experiment left the live map, server and existing game tab unchanged. The v5 continuation replaces an existing production texture instead of adding these atlases.

The useful result is that **changing the artwork within an already allocated atlas has essentially identical measured rendering cost**. The source-color atlas and Imagegen atlas have identical dimensions, topology, material/shader, sampler count and draw count. Replacing an existing albedo within the same map/UV/resolution budget is the promising route for map quality; adding a unique atlas to every plain surface is not.

Final v2 evidence is recorded in `output/playwright/projection-texture-v2-final/report.json` and `visual-review.json`. Earlier complete passes remain in `output/playwright/projection-texture-reviewed/report.json` and `output/playwright/projection-texture-final/report.json`. The final complete 64-copy stress pass, at a 1150×914 canvas, measured:

| Subject / 64 copies | Untextured source GPU | Source-color atlas GPU | Imagegen atlas GPU | Source → imagegen CPU submit |
|---|---:|---:|---:|---:|
| Cabinet | 0.434 ms | 0.613 ms | 0.614 ms | 0.30 → 0.20 ms |
| Recovery patch | 0.362 ms | 0.475 ms | 0.475 ms | 0.20 → 0.10 ms |

The benchmark uses the same camera, triangles, lights and viewport; native source geometry is already grouped by material rather than an artificially expensive 24-object baseline. Repeated copies are instanced in all variants. Each mode gets 25 warmup frames, 60 samples, and counterbalanced order `native/baseline/painted/painted/baseline/native`. WebGL disjoint timer queries measure GPU time; `performance.now()` measures CPU submission only. Unsupported/disjoint GPU timing is reported as unavailable. Values are local headless-Chrome evidence on a GeForce GTX 1650 through ANGLE/D3D11, not a whole-game FPS prediction or certification for mobile hardware. The final report identifies Chrome's renderer. Instanced buffers are disposed between stress variants; shared geometry/materials/textures remain cached until preview shutdown.

## Quality and applicability

Surface history is substantially more readable than the plain factory colors. Existing silhouettes, insets, real handles and bolts remain intact, and the baked textures respond to neutral/warm/cool lighting. These are useful **prototype candidates**, not a certified final art replacement: 512px atlases soften at inspection distance, Imagegen can invent painted construction cues or slight shading, and cross-view wear/seams require an artist's inspection. The independent reviewer confirms **prototype visual PASS** on six final views: construction/readability concerns corrected, no conspicuous seam or registration blocker, no further art changes needed for this bounded experiment. Resolution, shader and geometry budgets remain unchanged.

Use this workflow for modular panels, static cabinets, walls and repeated props, preferably with one shared atlas per kit and replacement of existing maps. Export static architectural assemblies with coherent UV islands and consistent texel density. View-dependent paint must be registered and rejected when it changes framing; an attractive generated scene is not automatically a usable texture.

For moving doors, destruction groups or articulated props, preserve part boundaries/pivots and apply atlas UVs back to each part. The current proof flattens a static inspection copy only; do not substitute that copy for the gameplay hierarchy or its sockets/colliders. For skinned meshes, preserve bind poses, weights and animations and bake in a fixed neutral pose. Large floors/walls need shared tileable materials or trim atlases rather than a separate high-resolution screenshot bake for every room. Projection cannot replace missing geometric silhouette or create physically accurate normals from color alone.

Before adopting a kit in the live map: inspect close/design/far views with the actual lighting and post stack, retain collision/animation identity, keep the existing texture memory and sampler budget, compare the actual current textured materials, then measure whole-scene CPU/GPU times and frame-time tails on target hardware. This experiment does not authorize a costly map-wide conversion.

## Files and reproduction

Runtime candidates: `assets/projection-texture/{cabinet,recovery}/{albedo.webp,mesh.json,manifest.json}`. The `native.json` and `baseline.webp` files support the inspection baseline. Preview: `projection-lab.html`, `projection-lab.js`, `projection-texture-material.js`.

Authoring sources: `.art-source/projection-texture/{cabinet,recovery}/` contains `source.json`, `unwrapped.json`, `authoring.blend`, `clay-projections.png`, `painted-projections-v1.png`, selected `painted-projections-v2.png`, the exact `prompt.txt` and `prompt-v2.txt`, `projection-manifest.json`, `baked-atlas.png`, `projection-coverage.png`, `material-values.png` and `bake-report.json`. Recovery's `fallback-colors.json` is the explicit authored rail-color correction. These are preservation assets, not runtime inputs.

```powershell
node scripts/export-projection-subject.mjs cabinet
node scripts/export-projection-subject.mjs recovery
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --threads 2 --python scripts/unwrap-projection-subject.py -- .art-source/projection-texture/cabinet
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --threads 2 --python scripts/unwrap-projection-subject.py -- .art-source/projection-texture/recovery
# Set $bakePython to a Python interpreter with numpy and Pillow.
& $bakePython scripts/bake-projection-texture.py prepare cabinet
& $bakePython scripts/bake-projection-texture.py prepare recovery
# Paint the local sheets using built-in Imagegen and the archived prompts.
& $bakePython scripts/bake-projection-texture.py bake cabinet .art-source/projection-texture/cabinet/painted-projections-v2.png
& $bakePython scripts/bake-projection-texture.py bake recovery .art-source/projection-texture/recovery/painted-projections-v2.png
node --test --test-isolation=none tests/projection-texture.test.mjs
# Set PLAYWRIGHT_PATH and CHROME_PATH if Playwright/Chrome are not on defaults.
node tests/projection-texture-browser.mjs
node build.mjs
```

Three geometry/material/isolation checks pass. Browser QA captures both subjects, four material variants, front/corner/back/distance views, warm/cool light and portrait layout; it tests orbit controls, no horizontal portrait overflow, equal benchmark triangle counts, one baked draw and zero browser/resource errors. Screenshots are inspected on actual meshes, not only as generated sheets.

Technical references: [Blender render baking and UV requirements](https://docs.blender.org/manual/en/latest/render/cycles/baking.html), [Blender UV projection](https://docs.blender.org/manual/id/dev/modeling/modifiers/modify/uv_project.html), and [Three.js texture memory](https://threejs.org/manual/pages/textures.html). Small compressed image files do not eliminate GPU texture residency.
