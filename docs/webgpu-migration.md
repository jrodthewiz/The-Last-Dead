# WebGPU migration

The game requires native WebGPU. The WebGL renderer path, backend selection and compatibility link have been removed. Old `renderer=webgl` URLs also launch WebGPU. Devices without WebGPU receive a startup error with browser/hardware-acceleration guidance.

Three.js r184 retains scene, animation, asset loading and renderer ownership. vgpu 0.5.0 supplies WGSL helpers through `vgpu/three` and TSL, including the harbor water port. This is a native WebGPU renderer migration, not a replacement of the game engine with vgpu.

## Runtime changes

- Bundled WebGPU, TSL, vgpu and the official Three GLSL transpiler. Normal runtime/build needs Node and bundled files; npm dependencies are only for intentional vendor regeneration.
- Native PMREM and standard materials; explicit ports for world-space harbor materials, water, bodycam, blood, tissue, anatomy masks, injury, impacts and atmosphere.
- Legacy authored shader arithmetic is adapted to TSL with live uniforms, color-aware uploads, shared varyings, sampler nodes and dynamic instance buffers. Existing material-hook stages are bridged explicitly.
- Atmosphere point sprites became bounded camera-facing quads on both backends.
- Bodycam retains ownership of final tone mapping, avoiding a second WebGPU screen tone-map. Foreground depth compression and material cache isolation retain the weapon's motion-blur exclusion.
- The pinned r184 morph patch selects the instanced morph path for zero/one active instances. `scripts/vendor-webgpu.mjs` verifies the patch target before regenerating.

## Verification

Owned headless Windows Chromium used native WebGPU with `--enable-unsafe-webgpu`, without forced Vulkan or SwiftShader. The user's running game tab and server were preserved.

| Check | Evidence | Result |
| --- | --- | --- |
| Production build WebGPU-only entry + unavailable-device error | `output/playwright/webgpu-default/report.json` | Native entry, obsolete renderer-query handling and absence of fallback checked |
| Harbor with full bodycam, room/street/water | `output/playwright/webgpu-ab/report.json` | Mean absolute normalized RGB difference 0.00866 / 0.00798 / 0.00815; no errors |
| Blood, tissue, cut mask, wound and animated impacts | `output/playwright/webgpu-effects/report.json` | Initial/animated A/B about 0.00115; live changes verified; no errors |
| Visible dungeon atmosphere in game-equivalent linear output | `output/playwright/webgpu-atmosphere/report.json` | Exact captured A/B match; positive visibility control; no errors |
| Actual firearm, 32 turn/recoil frames | `output/playwright/webgpu-viewmodel-motion/report.json` | Zero foreground blur error, world blur retained, grip gap below 4e-16; no errors |
| Low Tide chapter, six room system, journal, power/radio, death/checkpoint | `output/playwright/webgpu-migration/report.json` | Full journey passed; no errors |
| Default story entry, movement, aim/fire input, pause/resume | `output/playwright/webgpu-story/report.json` | Native WebGPU smoke passed; screenshot inspected; no errors |

The A/B captures below are historical migration evidence captured before removing WebGL support. Scripts are the matching `tests/webgpu-*.mjs` files. Run the atmosphere variant with `ATMOSPHERE=1` for `tests/webgpu-effects-ab.mjs`. The full chapter uses diagnostic player positioning near stations and real Q/W input, retaining enemies; it is not an unassisted navigation playthrough. Pixel averages are fixed-view regression evidence, not a perceptual quality score.

## Remaining limits

- Startup remains expensive: the recorded full native chapter took about 184 seconds in the test environment. No frame-rate or loading speedup is claimed; representative hardware performance profiling remains separate work.
- The shader adapter uses `Function` on bundled local shader source. A strict CSP forbidding runtime code generation would require build-time transpilation.
- Future shader hooks and Three upgrades need explicit port review. The adapter is not a general-purpose GLSL compatibility guarantee.
- This checkout exposes first-person gameplay; these checks do not certify a separate third-person camera mode or all GPU/browser/mobile combinations.
- The earlier community-building pilot is documented separately in `community-architecture-pilot.md`; it is not a migration requirement.
