# Pinned Vibe3D Thai Kit import

The source is the user's existing Vibe3D installation in `Desktop/Dogfight/src/models`, pinned by `models.lock.json` to `@thai-kit/props` **0.3.4**. No npm package is added to the game runtime.

```powershell
node scripts/import-thai-kit.mjs --verify
```

`THAI_KIT_SOURCE` may point to another checkout with the same pinned installation and esbuild/Playwright development tools. `BASE_URL` may override the existing local source server. Verification creates and closes its own headless Chromium instance; it never navigates the user's tab or restarts their server.

The importer archives the original TypeScript factories, entry points, metadata, collision compounds and relevant lock entries under `.art-source/thai-kit`. It compiles selected source with esbuild, preserving the factory API `createModel(options)` and rewriting the single Three import to the game's `vendor/three.module.js`. Source hashes, declared budgets, actual bounds, triangle/material/texture counts and browser draw calls are in `assets/thai-kit/manifest.json`.

18 selected assets total **760,838 bytes** of factory code: five generic building models, three vehicles, three market carts, a canopy, streetlight, barrel, bin, barrier, fence and park table. Some models ignore `textureSize`; their actual texture dimensions are recorded. Construct each prototype once and share geometry/materials across placements. Textures are generated canvases or embedded data URIs; none require external hosting. The ghost tower was rejected because this installed model is a flat skyline billboard whose separate image was not present, not a usable full building.

The factories declare Three >=185 upstream. Each selected factory was instantiated, shader-compiled and rendered against the game's **r184** in Chromium with software WebGL, with nonzero draw calls. A first hardware-context attempt lost its WebGL context and was rejected rather than treated as a render pass. This verifies the selected snapshot, not compatibility of future package versions. The scene integrator still owns final camera composition, collision alignment and complete-map performance.

MIT license is copied verbatim from Dogfight's asset archive and compared with the [upstream LICENSE](https://raw.githubusercontent.com/keysforthewin/thaikit/main/LICENSE): `Copyright (c) 2026 thaikit contributors`. Runtime `assets/thai-kit/LICENSE.txt` accompanies the redistributed code. The [official npm documentation](https://www.npmjs.com/package/@thai-kit/props) describes `npx vibe3d add @thai-kit/props` and per-item installation. This import intentionally reuses the existing pinned install rather than fetching a changing latest version.

Reference ledger: read Three.js AAA Graphics Builder skill, its model recipes and performance-safe-detail checklist, and Three.js 3D Generator skill. Provider generation is not needed for this requested source-library import; no API credentials or generated-model claims are involved.
