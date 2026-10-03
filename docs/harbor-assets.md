# Harbor asset pipeline and first playable exterior

The harbor uses Kenney's official [Car Kit](https://kenney.nl/assets/car-kit) and [City Kit (Industrial)](https://kenney.nl/assets/city-kit-industrial), both CC0. Source pack license files ship alongside runtime GLBs. Both complete packs are retained in the ignored `.art-source/harbor` archive; only ten selected models ship. Runtime needs no API or build-time download.

Reproduce acquisition from this repository:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fetch-harbor-assets.ps1
```

The script downloads the exact official release ZIP URLs, expands them into the preservation archive, then runs `node scripts/prepare-harbor-assets.mjs`. Preparation embeds each pack's external PNG palette into its GLB so two same-named `Textures/colormap.png` files cannot collide. No decoder extensions or new vendor dependencies are required. Nine assets are currently displayed; the sedan is a spare. The full source kits give us more variants for subsequent passes without downloading at runtime.

This follows a CLI acquisition → source archive → normalized runtime GLB pattern. Dogfight's `scripts/glb-shrink-assets.mjs` is the next compression stage if budgets require it; this pass preserves these already-small meshes without introducing a decoder dependency. The user later clarified that the intended Dogfight workflow was **Vibe3D + Thai Kit**, now recovered and documented in [the Thai Kit workflow](thai-kit-asset-workflow.md). Prefer that installed source library for subsequent street-detail sourcing.

## Implemented scope

- A 128 × 120 metre bounded harbor with six named building lots, two north/south streets, a central dock road, and waterfront promenade.
- Collision comes from the existing four-metre cell authority. Imported buildings sit within closed, visibly bordered lots. The prototype does not promise enterable interiors.
- A sourced truck with a 5.2 × 2.4 metre maximum visual envelope. Its orientation is +X at engine angle zero.
- Six weapon placements including bat and chainsaw, four scrap cases, and four authored infected positions. All are reachable from the spawn through engine collision checks.
- Three analytic waves share geometry displacement and normal derivatives. Water begins outside the shore at z=120m and stays below the quay. Fresnel uses analytic sky reflection and a deep-water body-color approximation; there is no scene refraction, swimming or physical water interaction yet.

## Skill and sourcing decisions

Loaded director, AAA graphics builder, water optics, 3D generator and image generator skills; graphics implementation/model/render references and analytic water reference informed this focused phase. This is a playable prototype, with no premium/AAA completion claim. Existing image-generated district textures remain available elsewhere. Official reusable CC0 packs were chosen for this user-requested CLI asset pass; no paid generation was attempted or claimed blocked. Procedural geometry is limited to roads, pavement, physical lot borders, bollards, signs and analytic water.

## Verification

`node --test --test-isolation=none tests/harbor-course.test.mjs` verifies every pickup, spawn, truck and exit is reachable; all six lots block movement; the shore cannot be crossed; the drive lane has clearance; and every runtime GLB is self-contained.

`node tests/harbor-visuals-smoke.mjs` loads an isolated browser scene using the current server without touching the user's game tab. It checks asset/shader errors and captures street/water/truck views under `output/playwright/harbor`. Use `PLAYWRIGHT_PATH` and `CHROME_PATH` overrides on other machines. This is asset/water QA; full gameplay integration is verified separately.

Next small pass: populate each lot with a distinct service-yard frontage, choose one enterable warehouse with aligned door/collision authority, add parked-car collision proxies, and add contextual water/vehicle audio. Keep the straight drive lane and promenade readable while adding cover. Open-world streaming, interiors, suspension, buoyancy and physically based refraction remain future work.

### Current map source
The harbor now uses Vibe3D Thai Kit buildings and set dressing. See [Thai Kit map design](thai-kit-map-design.md) and [reproducible import](thai-kit-import.md). Earlier Kenney building counts describe the prior iteration; only its drivable truck remains active in this scene.
