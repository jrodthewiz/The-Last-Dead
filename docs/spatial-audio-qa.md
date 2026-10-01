# Spatial atmosphere audio QA

Final production verification passed: 12 checks, 12 diagnostic samples, two inspected gameplay frames, and zero page, console, HTTP or failed-request errors. The runtime owner separately reports 38 focused tests passing. This document covers measured spatial routing and lifecycle behavior, not human localization, listening quality, fear, or premium-audio certification.

## Reference ledger

| Reference | Read | Purpose |
| --- | --- | --- |
| `threejs-audio-generator/SKILL.md` and `references/audio-workflows.md` | Yes | Groups, gesture unlock, pause/restart, loops and evidence boundaries |
| `threejs-qa-release` QA/playtest/visual/release checklists | Yes, during the preceding horror integration QA | Real Start/input flow, production verification and isolated browsers |
| `threejs-debug-profiler` scene/performance checklists | Yes, during the preceding horror integration QA | Measured diagnostics and resource ownership |
| `tests/audio-v2-mix.mjs` | Yes | Real Chromium offline decode/render and mix controls |
| `tests/brutal-audio.test.mjs` | Yes | Stereo energy, distance, occlusion and source cleanup |

No provider request or generated game asset is part of this QA task. Existing bundled audio remains the runtime input.

## Measured audio fixtures

The harness renders a deterministic mono calibration buffer through the real AudioSystem graph in Chromium's `OfflineAudioContext` at 44.1 kHz stereo. This isolates routing from random sample variants. It decoded 136 bundled buffers with no errors. Listener turning and an emitter crossing the listener both reversed channel emphasis. Front/back waveform evidence does not establish that every player can distinguish front from back.

| Fixture | Measured result |
| --- | --- |
| Left source RMS, left/right channels | 0.010849 / 0.002908 |
| Right source RMS, left/right channels | 0.002896 / 0.010895 |
| Near 2 m / far 14 m RMS | 0.017557 / 0.002053 |
| Occluded 14 m RMS | 0.000926 |
| Occluded / clear first-difference energy ratio | 0.0220 / 0.2173 |
| Equal-distance front/back normalized waveform difference | 0.7036 |
| Mute / pause rendered peak | 0 / 0 |
| Explicit volume zero with occlusion, rendered peak | 0.0000001603 |
| Unchanged spatial update vs original fade waveform difference | 0 |
| Tracked actor after moving body to Y=0.25 m | Authored 1.4 m offset retained at Y=1.65 m; same panner |

Actual wind, whisper and cloth-rustle samples separately decoded, were admitted, and produced finite waveform energy with measured peaks below 0.007 in the calibration graph. These restrained fixtures do not measure perceived audibility in the final game mix. Immediate stop and disposal cleared emitter ownership and output; seven keyed admission attempts retained at most four sources. Full measurements are in `output/playwright/spatial-atmosphere/built/offline.json`.

## In-game and production evidence

The first source journey entered real play, unlocked loaded audio, and passed natural wind/rare whisper and authored wind/whisper checks with no errors. It then rejected the build because the source catalogue contained zero cloth emitters: static batching/pruning removed the discoverable cloth mesh names. The rejected report, failure frame and passing offline receipt are retained in `output/playwright/spatial-atmosphere/source-rejected-1/`. Runtime now records actual cloth geometry centres before batching and transforms those retained anchors into world coordinates. Rustle belongs to existing cloth/tarp surfaces; no plant emitter is claimed.

The final production journey exercised actual Start/play with 180-second bounds, natural room wind and a rare whisper, each authored emitter kind, listener turning, actual Escape/resume and master-volume settings, six repeated lifecycle cycles, normal death and actual retry. All living samples retained 100 health. The corrected catalogue contained 14 real sources; the accepted rustle was `atmosphere:cloth-gurney-0:rustle` at the preserved cloth geometry centre. The two nearby wind loops used distinct 11.29 s and 14.32 s offsets within their 16 s buffer. Pausing and dying removed keyed/tracked emitters; every repeated resume retained one unique bed/source, and retry started a fresh room with no old whisper/rustle count. No ownership growth or duplicated loop was observed in this bounded journey.

The two saved frames were opened and visually inspected: `built/natural-room.png` shows the actual room and intact HUD; `built/authored-rustle.png` shows the gurney cloth at the selected source. They establish real rendered locations, not listening quality. The natural-room frame's HUD displayed 18 FPS and the close gurney frame 28 FPS on this shared automation host; no device performance certification follows from those snapshots.

Cold readiness remained slow: 56.0 seconds from document-loaded to hooks-ready and 61.4 seconds from actual Start click to play. Both stayed within the 180-second bounds and generated no errors. Browser contexts and ephemeral servers were closed after exit 0. The user's existing tab and port 5200 were preserved.

Production is a 394-file, 181,827,936-byte explicit `build.mjs` runtime whitelist copied into `output/playwright/spatial-atmosphere/production/`, using independent files and bounded copying. The six new whisper/rustle samples total 133,571 bytes. This is not a read of concurrently mutable `dist`. Docs, tests, preservation archives and nested QA folders are excluded. `production-manifest.json` records byte counts, integration and sample hashes, and exact differences from the earlier source journey: wind loop offsets, retained cloth anchors, presence admission, tracked actor height, unchanged gain fade and zero-volume fixes. The final journey's six runtime hashes matched at start and finish. The initial source journey remains a partial rejection; no full source pass is claimed.

## Accepted integration hashes

These SHA-256 values bind the production browser receipt. The manifest also includes the six sample hashes.

| File | SHA-256 |
| --- | --- |
| `main.js` | `0768ed5b50195ec4b534bf19a8526fd214c78575ea5490477fd1ad44e054f2f4` |
| `assets/audio.js` | `ce85d0d6780a4323372ad691d266e947d8fa7537b6bfa78622271b5dc117ccdf` |
| `assets/audio-manifest.js` | `e0b6b3b8b7982fc0e72f02bd27f64a762be27d3c0a4437c700beef0b38020c49` |
| `spatial-audio.js` | `a1cd70ee7455e20507acd8f68c102fca2eff1266d29fb4d44cfee122937c6669` |
| `room-atmosphere-audio.js` | `c917f0e9078920c032260232b44e0ef80c5e6baf87ba3cf7fa0d6e88fa0399e2` |
| `world-setdressing.js` | `dcb747e5e4fc9547dab8750e3cfa368175b26f59449a00684c1f52aef7248685` |

## Receipts and reproduction

`tests/spatial-atmosphere-browser.mjs` runs the measured fixtures and bounded game journey. `output/playwright/spatial-atmosphere/built/report.json`, `built/offline.json`, `production-manifest.json` and `summary.json` are the accepted receipts. `source-rejected-1/` retains the original integration failure. The frozen payload reflects the final fixes even while other authorized chats continue editing unrelated source files.

Set `PLAYWRIGHT_PATH` and `CHROME_PATH` to the bundled Playwright installation and Chrome executable. `SPATIAL_QA_ROOTS` defaults to `source`; set it to the absolute frozen production directory to test those exact bytes, and set `SPATIAL_QA_OFFLINE_ALL=1` to include the final offline refinement fixtures in a production run. Run `node tests/spatial-atmosphere-browser.mjs` from this repository. No user browser attachment or shared-server restart is needed.
