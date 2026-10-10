# Map loading and development inspection — October 10, 2026

Dev Mode exposes two explicit destinations: Blackwater Island / Open World and The Last Dead / connected dungeon. Both open in free camera. Island inspection includes **Full Map / M**, which fits the complete world extent to the viewport; **Reset View / R** restores the entry pose.

The connected campaign retains its service-stair route. A built-game Chrome test used actual E/Q interactions to travel dungeon → island → the same first floor → island again. Dungeon progress and shared equipment survived the journey. Interior entry/exit also passed.

Loading now compiles the actual output target before its first draw, prepares current dungeon equipment, bounds native compiler concurrency to two jobs, and applies capacity-independent instance attributes to late interaction pools. Unversioned production scripts, styles and JSON revalidate on reload. Previously cached clients may need one hard refresh after this release.

High inspection cameras select distant forest crowns according to height above the canopy. Ground-level tree detail and existing woodland visibility boundaries are preserved.

## Evidence

Owned Chrome, native WebGPU, 1280 × 800, DPR 1. Default adaptive exposure; no rendering subsystem skipped. Frame measurements use 120 frames following 20 settling frames. Flight measurements include camera movement.

| View | Median frame | 95th percentile |
| --- | ---: | ---: |
| Island entry | 20.9 ms | 34.7 ms |
| Full island overview | 27.8 ms | 34.8 ms |
| Aerial flight | 34.6 ms | 41.7 ms |
| Dungeon inspection | 7.1 ms | 14.0 ms |

Cold loading took approximately 59 seconds for island inspection and 41 seconds for dungeon inspection on this desktop. These are measured desktop results, not a mobile or universal FPS guarantee.

57 targeted loading, input, camera, vegetation and lifecycle checks passed. Core engine/AI checks, WebRTC, production serving, cache policy and signaling checks also passed. Browser journeys reported no JavaScript or HTTP errors.

Reproduce using local Playwright or the explicit project-supported `PLAYWRIGHT_PATH` and `CHROME_PATH` overrides:

```powershell
node build.mjs
node tests/dev-maps-browser.mjs
$env:DUNGEON_SHORT_ROUTE='1'
node tests/dungeon-open-world-browser.mjs
```

The browser harnesses accept `DEV_MAP_URL` / `DUNGEON_URL` for the deployed custom domain. Generated screenshots and reports remain under ignored `output/playwright/`.

The older `coastal-polish13.test.mjs` regression did not complete in a separate broader check: its large comparison exhausted Node memory, and its original eight-resident assertion predates the current 56-resident city population. No full-suite pass is claimed.
