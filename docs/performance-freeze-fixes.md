# Loading, interaction stalls, and map inspection

October 3, 2026. Actual application tested with native WebGPU in disposable Chromium on an NVIDIA Turing adapter. The existing port 5200 server and user tab were preserved.

## Changes

- Reuse the prepared menu course when starting solo play. Previously starting the coast constructed new courses and discarded the prepared world.
- Pause the title rendering while a requested game start is preparing, and avoid drawing partially loaded world materials before preparation completes.
- After assets finish loading, run one visual update without drawing or advancing simulation. This binds replacement survivor sleeves and wound materials before compilation, preventing the first playable frame from invalidating prepared hand shaders.
- Include the local survivor body in preparation: the ready/menu state normally hides it, so compiling only visible objects skipped the body until the first playable frame.
- Correct the bundled WebGPU compiler's camera transforms, projection convention, and culling frustum. It previously reused the last rendered view, which could be the title camera.
- Keep the original sequential GPU compiler with yielding node construction. A parallel-compilation experiment caused device loss on the test machine and was reverted. The vendoring script preserves the camera correction; device loss now rejects preparation with a recovery message instead of leaving the loading promise pending.
- Prepare the exterior in all directions, all six enterable rooms with their actual lights, and normally hidden G interaction resources. Restore temporary camera, visibility, culling, render target, and pool counts even on failure or cancellation.
- Prepare and retain one real stalker, caster, and brute in the coastal actor pool. First appearance consumes those actors rather than constructing cold GPU resources during gameplay.
- Reuse one hemisphere/point-light pair across interiors and keep both it and the exterior sky fill in the light list. Switch intensities to zero where unused rather than changing light visibility; the original indoor/outdoor lighting is preserved without changing shader light identities at a doorway.
- Omit the six unused practical lights for courses with no authored practical cues. This is decided at course construction, never toggled as the player moves. Correct native draw-call diagnostics to use `info.render.drawCalls` instead of the cumulative render-pass count.
- Decode extraction tissue textures during loading and prepare the actual skinned wound material, not only static organs and tools.
- Reduce real imported skin splitting from 854 ms to approximately 100 ms by avoiding unused skin calculations, boxed copies of existing attributes, and per-triangle allocations. Every resulting attribute/index buffer matches the original SHA256 comparison.
- Translate legacy global shadow invalidation into native per-light invalidation once. Previously the global flag remained set and invalidated the lantern shadow on every frame. Moving the lantern no longer redraws the sun's shadow.
- Suppress shadow-map rendering only during asynchronous material compilation, then restore the original update flags and normal culling before drawing. Native compilation invokes shadow update nodes; allowing those draws while preparing all directions caused a startup regression, caught and corrected by the browser loop.

## Map inspection

Local development menus include **FLY THE OPEN WORLD** and the pause menu includes **FLY MODE**. F2 toggles inspection. The solo simulation freezes while inspecting.

WASD moves; E/Space rises; Q/Ctrl descends; Shift boosts; the wheel changes speed. Click **Capture Mouse** or the canvas to look freely; Tab releases the cursor. Arrow keys also turn the camera. **Reset View** returns to the entry pose; **Return to Player** or F2 exits inspection. Inspection is disabled during connected co-op.

## Evidence and limits

- `output/playwright/performance-freeze/baseline/report.json`: initial baseline became unresponsive after entering play and remained blocked beyond 320 seconds. It never reached a valid G scenario.
- `output/playwright/performance-freeze/post/report.json`: first repair reached play in 136 seconds; first corpse interaction still had a 2.59-second frame gap. Pause and title fly buttons worked.
- `output/playwright/performance-freeze/final/report.json`: intermediate build completed both corpse extractions with maximum measured action-frame intervals of 562.5 and 361.2 ms. A later street view still caused a cold rendering stall, motivating all-direction and interior preparation. Initial settling and interior testing did not pass in that build.
- `output/performance/harvest-split-after.json`: isolated skin geometry benchmark and exact buffer parity.
- `output/playwright/performance-freeze/final-npc-warmup/assessment.md`: final native WebGPU run reached play in 105.9 seconds, with no gameplay RAF gap over one second. First NPC insertion dropped from 2153 to 201 ms. Both corpse extractions completed (299/285 ms maximum sampled gaps), rat pickup/throw and all movement/fly assertions passed, and browser/HTTP errors were empty. Settled street median was 13.9 ms (~72 FPS); three enemies 20.8 ms (~48 FPS). Initial idle was slower (~29 FPS).
- The final room transition still took 639 ms. Its narrow scenario snapshot contained zero complete RAF intervals and therefore the scenario gate remained false; the full trace and successful subsequent room movement establish the bounded transition, not a perfectly smooth result. Cold loading still takes nearly two minutes on this test machine.
- Final focused Node suite: 57/57 passed, including launcher port exhaustion, loading, native camera compilation, G resources, interiors, shadows, and flight. `node build.mjs` passed.

The browser harness records startup separately from action intervals, actual extraction completion, input state, CPU method timings, long tasks, frame intervals, errors, and screenshots. Synthetic target corpses and bounded live enemies are test fixtures, not proof of all encounter configurations or all hardware. A remaining short hitch must not be described as zero stutter.

Relevant regressions: loading-preparation, webgpu-compile-camera, afterlife-lighting, harbor-interior-preparation, dev-flight, extraction surface/cutaway/VFX, vermin visuals/integration, and harbor interiors. Browser verification uses `tests/performance-freeze-browser.mjs` with `PLAYWRIGHT_PATH` and `CHROME_PATH` overrides when needed.

## Installed launcher repair

Both installed Wolf Games `Run-Game.ps1` copies (Launchers and Duals Playtest) now use the same current configuration and port-safe branches. The older copy still contained hard-coded occupied-port errors. Source is retained in `scripts/wolf-games-launcher.ps1`; backups were saved beside the installed files. The command-file launcher shares `scripts/start-menu-last-dead.ps1`, reuses an owned healthy server on any port, and reads the actual server URL. If all 21 preferred ports are busy, the local server asks the OS for an available port atomically. No unrelated process is stopped.

Both installed launchers passed `-Game 'The Last Dead' -Probe`, returning port 5200, HTTP readiness, and zero newly started processes. The actual command-file backend also reused 5200. PowerShell routing tests passed and a real Node test reserved all 21 preferred ports, verified fallback, and confirmed every original listener remained healthy. These probes skip browser creation; existing user tabs remain intact.

Reference ledger: debug-profile-checklists.md, scene-debugging.md, and performance-profile.md from the threejs-debug-profiler skill were read and applied to runtime ownership, shader compilation, frame timing, errors, resource cleanup, and visual checks. Mobile input testing was outside this desktop request.
