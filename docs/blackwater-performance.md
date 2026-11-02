# Blackwater rendering performance

November 1, 2026. Local Windows development; this is the standalone Three.js game.

## Change and ownership

The 32 parked sedans and six wrecks submitted their five rigid surfaces separately.
`island/parked-vehicle-batches.js` now merges the authored body and wheel surfaces
into 20 spatial/material batches. It retains UVs, the retro atlas, the original
intact/wreck material behavior, placement, tint, shadows and collision ownership.
`island/actors.js` uses this path only for stationary sedans. Both drivable trucks
keep their original models and updates. Incompatible future assets fall back to
the original rendering path.

The final implementation uses merged geometry. An earlier instanced experiment
reduced submissions but added shader variants and several seconds of preparation;
it was replaced before release. No render-resolution or quality setting is reduced.

## Controlled A/B evidence

Hardware: GTX 1650, i7-9750H, hardware D3D11 through ANGLE in Chromium 145.
Balanced quality, 1440 × 900 viewport and drawing buffer, DPR 1. Sequential fresh
contexts use the same fixed cameras and world time, with enemies moved away for
render isolation. Each view warms for 1.5 seconds and measures native RAF intervals
for five seconds. Screenshots occur outside measurement. A overrides only the
unchanged original `actors.js`; B uses the current build. Initial exploration also
used A/B/B/A ordering. These are hardware headless-browser measurements, not a
universal device or frame-rate guarantee.

Final matched views, median total draw submissions including the cached shadow pass:

| View | Original | Final | Reduction |
| --- | ---: | ---: | ---: |
| Island | 927 | 757 | 18.3% |
| Settlement yards | 761 | 627 | 17.6% |
| City | 379 | 285 | 24.8% |
| Parked-car close-up | 165 | 161 | 2.4% |
| Wreck close-up | 237 | 233 | 1.7% |

All 38 cars and 231,648 indexed triangle vertices were checked against the source
asset's original transforms. Maximum position difference is 0.0000109 metres;
UVs and material tint match exactly, and normal error is below 0.00000005.
Both trucks and static shadow flags remain present. Yard and city screenshots
match exactly; fewer than 0.0004% of pixels differ by over eight channel levels
in the other three views. Source geometry is not mutated. Captures are raw game
views, not mockups or isolated replacement scenes.

The final pair reached readiness in 17.8 seconds for A and 14.0 seconds for B.
Startup timing varies with driver/cache/system load; this single pair is not a
general loading-speed claim. The final batch does not add instancing programs.

## Traversal and limits

Paired final ground-route results (milliseconds):

| Route / duration | p95 before → after | Frames over 50 ms before → after | Maximum before → after |
| --- | ---: | ---: | ---: |
| Coast / 80 s | 33.4 → 16.8 | 34 → 2 | 516.5 → 116.6 |
| Bridge / 65 s | 16.9 → 16.8 | 13 → 7 | 149.9 → 99.9 |
| City / 80 s | 33.2 → 16.8 | 44 → 0 | 2415.6 → 33.3 |

Median render submission time falls from 14.5 → 10.8 ms on the coast,
11.8 → 9.0 ms on the bridge, and 9.7 → 6.2 ms in the city. Walking distances
are 405/416 m, 336/337 m and 255.5/255.5 m. Final browser/network errors are
empty and the WebGL context remains healthy. These are paired observations
under variable desktop load; the exact number of rare stalls is not guaranteed.
The baseline walks coast for 80 seconds, bridge for 65 seconds and city for
80 seconds using native keyboard input. The final implementation repeats these
same routes and durations with normal gameplay and weapon switching.

Long frame gaps remain in stress runs. Background load measured with the owned
QA browser closed included 80% GPU utilization, 3112/4096 MiB VRAM use and
1519 MiB available RAM. This is a confounder, not proof of the cause of each gap.
Do not describe this change as eliminating all hitches or guaranteeing 60 FPS.

The existing world/batching checks pass 12 of 13 assertions. The remaining
navigation fixture requests a non-enterable Old Town building, but the current
world has zero such buildings. It fails before navigation is called and does
not import the changed rendering helper. Test files are unchanged. Temporary
runtime pursuit setup uses an actual current enterable building; six infected
routed and attacked, and retry cleared the navigation queue. That extended run
used the intermediate rendering candidate; it supports unchanged gameplay-path
validation, not final rendering-performance claims.

Evidence: `output/performance-2026-11-01/merged/abba.json`,
`merged/visual-parity.json`, `comparison.json`, `soak-A/report.json`,
`soak-final/report.json`, and `checks.log`. The original actor source is retained
as one small allowlisted comparison file; there is no duplicate checkout.
No test files were added or edited. The user's game tab and local server are preserved.
