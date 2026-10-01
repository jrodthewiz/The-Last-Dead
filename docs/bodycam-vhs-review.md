# Recorded camera iteration

User direction: the prior bodycam was attractive but too clean. Target an Outlast-like horror recording character combined with Bodycam's wide lens and physical camera feel.

## Observable contract

- Recording texture is visible in ordinary lit scenes and rises in shadows.
- Chroma has lower horizontal bandwidth than the luma silhouette.
- Bright cores clip and desaturate without blooming every reflective surface.
- Scan modulation and line instability are subtle, correlated signal effects; they do not replace physical camera motion.
- The central aim point, hands, enemy silhouettes and world occlusion stay readable.
- Lens sampling fills portrait and widescreen borders; reduced motion removes animated line instability and freezes noise cadence.
- Existing world assets and lighting remain the comparison source. This is a camera presentation pass, not a claim of matching Unreal's scanned environments.

## Independent judge

The separate read-only visual judge evaluated the prior runtime capture with these scores:

| Criterion | Baseline, out of 5 |
| --- | ---: |
| Recorded-footage identity | 2 |
| Lens character | 3 |
| Low-light sensor response | 2 |
| Highlight handling | 2 |
| Gameplay readability | 5 |
| Restrained artifact coherence | 3 |

Critique: fabric and metal retain pristine edges, shadow detail is clean and full-color, grain/compression are barely visible, and bright surfaces lack a sensor-specific response. The judge requested selective edge softness, reduced horizontal chroma bandwidth, gain-dependent shadow noise and controlled highlight cores/halos. A large overlay would not solve these signal issues.

First revision (pass-1b): recorded identity 3, lens 3, low-light 3, highlights 2, readability 4, coherence 3. **Rejected by the judge**: the intake reads as a cheap sensor, but hall/court remain noisy FPS images. Coarse colored grain covers lit midtones, and practical-light cores remain clean. Requested changes were lower midtone chroma noise, selective bright-edge color bleed, modest peripheral softness, distinct core clipping and local halos, and dark/practical/movement stress captures.

Second revision targets those findings with display-luminance-weighted noise, smaller chroma-noise amplitudes, peripheral luma bandwidth, selective bright-edge chroma reconstruction, clipped practical-light cores and small horizontal highlight bleed. The judge rated recorded identity 3.5, lens 3, low-light 3.5, highlights 3, readability 4 and coherence 4, and accepted the static direction. Remaining blocky world geometry is outside this camera pass.

The first motion evidence was rejected as insufficient: changing the body lamp did not raise measured luminance, and extra redraws erased early turn blur. The corrected pass-3 captures the actual caged amber practical from close range, with exactly one draw per frame. After four seconds of settling, an eight-second sequence turns toward the lamp, holds, turns away, and holds. Spare exposure-target channels record the actual metered luminance and target gain; the game consumes only the red gain channel. The away view contains other practical lights and is not described as an unlit room. Checkpoint images and telemetry establish sampled motion/exposure behavior; still-image review does not establish artifact-free video playback.

Final judge verdict: **approve this camera iteration**. Identity 3.5/5, lens 3/5, low-light 3.5/5, highlights 3.5/5, readability 4/5, coherence 4/5. The judge reviewed actual screenshots and JSON, not MP4 playback. Actual-scene turn blur peaked at 0.02974 UV-vector length and settled below the shader's 0.0001 sampling threshold. The lamp sequence did **not** establish a gain transition: metered luminance was approximately 0.033 away versus 0.0245 facing the bulb, with both targets at 2.1. The judge accepted separate controlled-luminance verification and advised against forcing gain pumping around isolated bulbs.

## Final verification

- Production build passed; nine focused mount, weapon-mechanism, first-person-body and free-flight tests passed.
- Production browser QA at `http://127.0.0.1:5200/dist/` passed with zero browser/HTTP errors, all eight weapons, persisted settings, reduced motion, resource disposal and target resize.
- Neutral direct/no-effect resolve matched exactly at `[127,127,127,255]`; portrait/desktop/ultrawide fast-turn corners stayed filled.
- Controlled dark/bright geometry produced gain 2.082 / 0.7998, encoded noise variance 617.32 / 1.77, and exact zero blur after a turn stopped. These establish pipeline behavior separately from the real-scene gain limitation.
- Comparison report recorded zero runtime errors. Source and production shader files match. The user's existing game tab and server process were left intact.

Evidence: `output/playwright/bodycam-vhs/pass-3-*-comparison.png`, `pass-3-motion-checkpoints.png`, `pass-3-report.json` and `output/playwright/bodycam/report.json`. Existing output artifacts are ignored by Git.

## Comparison procedure

`tests/bodycam-review.mjs` runs an isolated headless browser without changing the user's game tab. Before editing, preserve the previous `bodycam-pass.js` as `output/playwright/bodycam-vhs/previous-bodycam-pass.js`, with its vendor import resolved to `../../../vendor/three.module.js`.

Write a request such as `{"id":"pass-3","motion":true}` to `output/playwright/bodycam-vhs/request.json`. Optional `profile` overrides lens/sensor/recording controls. The harness loads the revised shader in its existing browser, warms gain for 90 frames, then freezes signal time. It captures previous/candidate pairs from the same intake, hall, court, close practical and darker-hall cameras. World camera/projection matrices, atmosphere seed and runtime errors are recorded per pass. Gameplay HUD is hidden in these pairs so overlay styling cannot bias the image-treatment verdict.

Comparison PNGs are composed from actual game screenshots, with labelled columns. They are not generated concept art. A stop request is `{"id":"stop","stop":true}`.

## Signal ownership

The HDR scene target, mip highlight bleed and exposure targets remain shared. The shader maps/encodes each sampled signal once, reconstructs lower-bandwidth chroma in display space, then adds encoded sensor noise and scan modulation. Debug modes: 1 source, 2 lens displacement, 3 HDR contribution, 4 encoded sensor noise. Lens/sensor/recording parameters are exposed together through `setLook()` and diagnostics.

Skill sources: Three.js camera direction, image pipeline, exposure/color grading, bloom and visual validation. The metering and mip bleed retain the existing inexpensive approximations rather than adding histogram readbacks or a separate bloom pyramid.
