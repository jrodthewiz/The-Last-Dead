# Shooting stalls — 2026-09-08

Reproduced in a separate browser QA tab at http://127.0.0.1:5200/?debug=1, 1280x720, DPR 1, default adaptive quality. Existing user tab preserved. No server restart.

100 forced shots across all four weapons, including alternate fire every fifth shot, while the real simulation spawns enemies. Measured CPU wall time around Renderer.render; these are not GPU frame-time measurements. Audio fully decoded with no errors.

Before: maximum render call 1568.7 ms; another 1227.3 ms stall on Arc Lance. New Warden skinned MeshPhysicalMaterial programs compiled at first spawn and first transmission render. Empty-arena weapon warmup omitted the asynchronously loaded Warden. Enemy creation also cost 69–73 ms and first render 42–45 ms due to skinned vertex bounds calculations.

After: maximum 46.7 ms, p95 23.4 ms over 662 frames. Warden creation 1.9–2.8 ms. Four enemies plus gore, rockets, impacts and explosions active. Zero page errors. One additional program appeared on an 18.1 ms frame; no repeat of the long shader stalls. Browser/driver caches and adaptive resolution affect comparisons; final renderScale was .9. This fixes the observed freeze, not a guarantee of constant 60 FPS on every GPU.

Fix: renderer waits for model loading as part of existing start preparation; retains a hidden representative Warden to prepare screen/transmission shaders and first-render resources. Clones cache initial-pose normalization and skinned bounds, retaining independent materials, skeletons and animation. Animated Warden frustum culling was already disabled; cached sphere supports render sorting.

Reference ledger (all read):
- yes: threejs-debug-profiler/references/debug-profile-checklists.md
- yes: threejs-debug-profiler/references/checklists/scene-debugging.md
- yes: threejs-debug-profiler/references/checklists/performance-profile.md

Checks used: local reproduction, load ordering, shader program deltas, simulation vs render timing, audio decoding, canvas dimensions, draw/geometry/texture diagnostics, repeated spawn costs, actual combat replay. Mobile-specific checklist not applicable to desktop report.
