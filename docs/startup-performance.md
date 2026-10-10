# Launcher startup performance

Target: a fresh browser reaches actual coastal gameplay in 10–20 seconds.
Timing starts before navigation, includes the title screen and Start, and ends
when the game enters `play`. Startup keeps the complete exterior, interaction
effects, three inhabitant profiles and six interiors prepared before control.

## Changes

- Native GPU pipeline creation overlaps at most eight submissions. Node graph
  construction remains serial because it shares renderer state. Validation
  scopes pop in submission order; failures drain outstanding jobs and reject
  loading. The final progress update waits for every GPU request to finish.
- Named matrix/color attributes let world and non-morphing effect pools share
  shaders across different instance capacities. Custom GLSL ports and vertex
  deformation hooks use the same matrix path. Morphing pools retain their
  original bindings. Matrix updates continue to upload live buffers.
- Runtime hierarchy/material clones avoid JSON-exporting live scene nodes and
  textures from `userData`. The CPU profile showed repeated canvas-to-PNG
  encoding in Thai template, arm and wound clones. Clones now share GPU
  resources, remap owned node references and isolate mutable records.
- The 32 MB Bloodworks warden loads before entering a mode that uses it, rather
  than during coastal startup. Coastal inhabitants still load their own models.
- The title animation pauses during Start preparation, leaving the loading UI
  free to paint.

## Measurements

Local Windows machine, Chrome, native NVIDIA Turing WebGPU, 1280×800, DPR 1.
Each journey launches and closes its own fresh Chrome process. Existing user
tabs and the launcher server remain intact. These tests do not clear the
driver's shader cache and cannot promise the same time on every machine.

| Iteration | Navigation to gameplay |
| --- | ---: |
| User's preceding launcher test | about 129 s |
| Instrumented baseline at the beginning of this pass | 71.3 s |
| Eight concurrent native pipeline jobs | 31.6 s |
| Runtime clones, newer Blackwater scene | 38.3 s |
| Shared effect-pool matrix shaders | 24.3 s |
| Wound material runtime clones, source | **18.1 s** |
| Final production build, trial 1 | **18.9 s** |
| Final production build, trial 2 | **19.2 s** |

Scene work changed during early trials as the existing Blackwater iteration
continued. Early rows are diagnostic experiments, not a controlled universal
speedup ratio. The final source/production trials retain the same completed
world and preparation journey. Sixteen pipeline jobs and a 32 ms compiler
slice performed worse in exploratory trials; defaults remain eight jobs and
an 8 ms slice.

Reports and screenshots are under `output/playwright/launcher-loading/`.
`wound-cache`, `production-final-1`, and `production-final-2` are the final
journeys. The sum of individual pipeline durations includes overlapping work;
use `readyMs` and compilation stage wall times for load comparisons.

## Research and decisions

[MDN's native asynchronous pipeline API](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createRenderPipelineAsync)
resolves when a pipeline is ready without stalling GPU operation execution.
This supported overlapping native requests while keeping CPU node building
serial. The cap of eight comes from local measurements, not an API guarantee.

[Three.js renderer documentation](https://threejs.org/docs/pages/Renderer.html#compileAsync)
explains material warmup and the need to configure lighting/environment first.
Warmup therefore keeps the game's real output target and complete relevant
lighting. Changing the loading label or simply omitting warmup would not remove
the first-use cost.

The pinned [Object3D source](https://github.com/mrdoob/three.js/blob/r184/src/core/Object3D.js)
and [Material source](https://github.com/mrdoob/three.js/blob/r184/src/materials/Material.js)
confirm JSON cloning of `userData`. The profile connected that serialization
to live texture image export in this game's metadata. The fix is scoped to
runtime clones; the bundled Three.js JSON export contract stays unchanged.

[MDN's scheduler yield documentation](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)
supports yielding long CPU work so the browser can process other tasks. The
existing elapsed-time budget is retained instead of a scheduler trip per cached
object. Work remains bounded while the loading overlay updates.

## Verification and reproduction

Use bundled/local Playwright and Chrome through `PLAYWRIGHT_PATH` and
`CHROME_PATH`. No npm install is needed for normal runtime/build.

```powershell
node build.mjs
$env:STARTUP_ROOT='dist'
$env:STARTUP_RUN='my-production-trial'
node tests/launcher-loading.mjs
```

Set `STARTUP_URL='http://127.0.0.1:5200/'` to test the actual launcher server
instead of the test-owned temporary server. `STARTUP_CPU=1` saves a Chrome CPU
profile; that diagnostic run should not be used as a timing acceptance gate.

Verification covers cancellation, failure draining, validation errors, genuine
GPU completion progress, dungeon asset gating, clone ownership, live matrices
and colors, custom shader/deformation bindings, movement, free-camera turning
and interior entry. Native pixel tests compare separate instance buffers and
the animated blood/wound material fixture.

All **71 focused regression tests pass**. Native buffer/custom shader pixel
tests pass. The animated effects comparison differs from the WebGL reference
by about 0.11% mean RGB. The packaged canvas inspector reports nonblank built
gameplay with 175 color buckets and no page/console errors. The combined QA
matrix, exact timings and skill reference ledger are saved in
`output/playwright/launcher-loading/verification.json`. Inspection uses the
bundled inspector with local Playwright/Chrome paths and a Start action adapter.

The existing injury lifecycle test fixtures were updated with their missing
backpack UI and course stubs so they can exercise the current browser frame
function. Injury and co-op assertions remain active.

The intentional vendor regeneration transform was checked in memory against
the checked-in renderer using normalized executable output. It preserves the
startup patches without changing the vendor during verification.

The 20-second target is reached in the final measured runs. Ten seconds remains
a future target; the next measured candidates are reducing genuinely distinct
shader variants and baking expensive procedural resources offline, while
preserving the current world and first-use behavior.
