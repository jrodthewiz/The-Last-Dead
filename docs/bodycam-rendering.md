# Bodycam rendering verification

The bodycam lens is enabled by default and can be disabled in Settings. Reduced motion disables the chest-mount movement, rotation blur, rolling shutter, movement-driven FOV changes, and blinking REC indicator. The menu retains its own cinematic renderer.

The scene renders into a multisampled, mipmapped RGBA16F target. Two 1×1 RGBA16F targets adapt sensor gain. The final shader owns tone mapping and output color conversion, with curved lens sampling, chromatic fringing, highlight bleed, edge enhancement, grain, and a cool grade. The existing first-person depth boundary and transmission materials remain in the scene draw.

Completion fixes include overscan to remove black frame wedges, reduced-motion wiring, resource disposal, reset on floor changes and re-enabling, restoring render state on failure, and counting scene draws as well as post draws. Static frames avoid the extra rotation-blur samples.

## Bodycam shooter reference pass — September 30, 2026

Reference: [Bodycam's official camera presentation](https://www.playbodycam.com/en-US). This pass targets its wide lens and physical recording feel within the existing Three.js world; it does not reproduce Unreal's lighting or scanned environments.

- A 110-degree source lens supplies overscan for corner-normalized radial curvature. Portrait and ultrawide use the same normalized distortion strength, with 2.4% border overscan.
- `BodycamMotion` lowers the mount 14 cm, drives stride from actual travel distance, and adds bounded turn/strafe roll, acceleration pitch, breathing, and a landing response. Aim steadies secondary movement. No timer-driven whole-frame sway remains.
- Gameplay aim is unchanged. Visual pitch remains bounded to 0.035 radians and roll to 0.04. History resets on new runs, floors, teleports, large turns and pause gaps; free flight restores its camera position.
- Row readout shear follows measured turn velocity and vanishes at rest. Fringing increases toward the lens perimeter; weaker highlight bleed and sharpening preserve surfaces. The grade retains warm lights, and sensor noise is applied after output conversion.
- `BODYCAM_LOOK` groups lens and sensor controls. Existing no-post, lens-field and contribution diagnostics remain available, with mount pose and lens/sensor values in renderer diagnostics.

Verification uses `node --test --test-isolation=none tests/bodycam-motion.test.mjs` for motion at 30/60/144 Hz, settling, landing/cut resets and reduced motion. `npm run test:bodycam` also tests fast-turn neutral corners at portrait, desktop and ultrawide aspects. Source captures and the original baseline are preserved in `output/playwright/bodycam/` and `output/playwright/bodycam-before/`.

Final verification: production build passed; all 16 mount, weapon-handling, first-person-body and free-flight checks passed. Browser QA passed against `/dist/`, with zero browser/HTTP errors, all eight weapons, persisted settings, accessibility resets and filled fast-turn corners. The production fixed-view render counted 418 scene draws / 420 with the resolve. Warmed completion-synchronized wall times were 15.0 ms direct / 10.8 ms bodycam median and 18.7 / 15.1 ms p95; these scheduling-sensitive samples are not isolated GPU timings. Source and production were tested in separate headless browser contexts without changing the user's game tab or restarting the server.

## Visual contract and evidence

The subsequent horror-recording iteration is documented in [bodycam-vhs-review.md](bodycam-vhs-review.md), including rejected drafts, matched runtime comparisons, independent judge scores and final production verification. Current defaults use curvature 0.48, 3.2% overscan, 540-line signal bandwidth, lower horizontal chroma bandwidth, shadow-weighted encoded noise and softened clipped highlights. The earlier values and verification above describe the first reference pass.

- Fill the frame at portrait, desktop, and ultrawide sizes without exposed lens borders.
- Preserve weapon silhouettes, hands, world occlusion, and a readable center aim point.
- Keep dark areas dark while limiting sensor gain to approximately 0.8–2.1.
- Freeze shader time and exposure for same-camera source, lens-field, contribution, and final captures.
- Restore zero blur when turning stops; respect reduced motion.

Run `npm run test:bodycam` with a local Playwright installation or `PLAYWRIGHT_PATH`, and optionally `CHROME_PATH`. Set `DEAD_ARRIVAL_URL` to test a production preview. The completed production run used `http://127.0.0.1:5200/dist/` without changing the user's game tab or restarting the existing server.

Local artifacts are under `output/playwright/bodycam/` (ignored by Git): `report.json` contains the course/seed, exact camera and projection matrices, fixed shader time, dimensions, errors, target inventory, and timings. PNGs include final, no-post, displacement field, contribution, weapons, and 390×844 / 1280×720 / 1920×810 views.

## Original verification results

- Production build and whitespace/syntax checks passed.
- 29 gameplay/AI tests passed; WebRTC two-context test passed.
- Browser test passed: persisted lens preference, movement, firing, pause/resume, REC visibility, reduced motion, all eight weapons, target resizing, zero browser/HTTP errors.
- Shaded neutral test: direct output and no-effect resolve both `[127,127,127,255]`, confirming one tone-map/output conversion.
- Neutral corner samples remained nonblack; exposure settled at 2.082 in darkness and 0.800 under bright light.
- Turning produced bounded blur and settled back to zero. Disposal reduced the fixture's allocated textures from 3 to 0.
- Production fixed-view draw counts: 370 direct / 372 with bodycam. At 1280×720, one 4-sample mipmapped HDR scene target plus two 1×1 exposure targets are allocated.
- Warmed, GPU-completion-synchronized wall-time medians were 13.1 ms direct / 8.0 ms bodycam; p95 was 17.5 / 12.6 ms. These short local samples include CPU/GPU scheduling and are **not isolated GPU timings or evidence that post-processing is faster**. An earlier source run measured approximately 12 ms in both modes. No 144 FPS guarantee is made.

The full-resolution multisampled HDR target adds GPU memory, especially at high DPR. Mip-based highlight bleed and averaged-luminance exposure are deliberately inexpensive approximations. Mobile verification covers responsive rendering in desktop Chrome, not sustained performance on a physical phone. Temporal checks sample motion state and exposure response; they do not establish artifact-free behavior for every level or lighting condition.

## Reference ledger

Read and applied: `threejs-debug-profiler/references/debug-profile-checklists.md`, `checklists/scene-debugging.md`, `checklists/performance-profile.md`, and `threejs-visual-validation/references/graphics-validation-protocol.md`. Checks focused on shader/output ownership, target dimensions, runtime errors, weapon visibility, motion response, resource cleanup, fixed-camera comparisons, and measured render counts/times.
