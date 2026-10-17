# Release QA — 2026-10-10

## Status

The current build is a tested desktop release candidate. Public release still needs a target hardware budget and an internet co-op decision. This pass used local desktop Chrome with native WebGPU. The existing game tab and port 5200 server were left running.

## Repairs and polish

- Safehouse storage now transfers weapons with their fittings, supplies, and scrap through the field kit and persists them at Netmakers. The save and retry path was exercised in a real browser.
- Developer flight, landing, god mode, and the basement return route were exercised in the live campaign.
- The title no longer compiles a solo world behind the room-code menu. A selected mode prepares one world while its loading screen is visible.
- The bodycam pass releases its HDR source target before drawing to the screen or resizing, preventing the co-op WebGPU read/write validation error.
- The co-op, bodycam, and performance scripts now exercise the current room-code and WebGPU paths. The README describes the current co-op flow.
- A failed checkpoint write now retries on the next save call even when progression has not changed. A regression test covers a transient storage failure and a new-session reload.
- The release build omits six groups of superseded or reference-only art after checking runtime references. Source assets remain available in the repository.

## Verification

| Gate | Result |
| --- | --- |
| `npm.cmd run build` | Passed; 621 output files after trimming unused art. |
| `npm.cmd test` | 36 engine/AI tests passed; WebRTC two-context test passed. |
| `npm.cmd run test:open-world` | 19 passed. |
| `npm.cmd run test:harbor` | 18 passed. |
| Focused save, input, campaign, room, and gamepad tests | 50 passed. |
| `npm.cmd run test:story-art` | 5 passed. |
| Desktop campaign browser playtest | Passed movement, dev controls, dungeon-to-island travel, safehouse claim, storage, reload, and defeat/retry; no browser or HTTP errors. Report: `output/playwright/playtest-controls/report.json`. |
| `npm.cmd run test:coop` | Passed the current room-code, live WebRTC, melee, pause, and disconnect checks; no browser errors. Report: `output/playwright/release-coop-final/qa-results.json`. |
| Two-minute co-op soak | 91 live input cycles, stable renderer memory, no browser errors. Report: `output/playwright/release-coop-soak-final/qa-results.json`. |
| `npm.cmd run test:bodycam` | Passed five desktop WebGPU checks including target restoration and resize; no browser errors. Report: `output/playwright/bodycam/report.json`. |
| `npm.cmd run test:performance` | Passed desktop presentation and WebGPU checks in dungeon and island. Report: `output/playwright/performance/release-2026-10-10.json`. |
| Second-pass checkpoint regression | 6 focused tests passed, including retry after a failed storage write. |
| Second-pass browser gate on trimmed build | Passed in dungeon and island with native WebGPU, two play screens, and no browser or HTTP errors. Observed 80.2 and 23.6 FPS, respectively. Report: `output/playwright/performance/polish-trimmed-complete.json`. |

## Release risks to resolve

- The island measured 28.4 observed FPS at 1280×720 in the earlier headless Chrome run and 23.6 FPS in the final trimmed-build gate, with about 861 MB reported renderer memory and roughly 1,460 draw calls. Disabling the image pass and reducing internal resolution to 80% left the island near 28–29 FPS in the earlier diagnostics. Stage profiling attributes most measured island render time to scene submission and its image pass; world, enemy, and combat update costs were each under 1 ms on average. The scene needs deeper graphics work. These figures are one machine's samples, not minimum-spec certification.
- The built directory is 191,698,075 bytes (about 183 MiB) across 621 files before transfer compression, 82,401,378 bytes smaller than the previous build. Test download time and memory on the intended host and minimum hardware.
- Co-op was verified with a local signaling broker and two real WebRTC clients. Public internet/NAT routes are unverified; this build has no TURN relay.
- Mobile input and layout QA were outside this desktop pass. A full uninterrupted campaign completion was not played through in the browser; victory and progression are covered by automated simulation tests.

No release or deployment was performed.
