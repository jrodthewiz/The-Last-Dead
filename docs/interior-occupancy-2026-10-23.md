# Occupied interiors — 23 October 2026

Street-level businesses now have connected working areas and overhead structures: a lower bank staff ceiling with a rear workstation, roofed radio control/booth areas, a framed press workline, a timber drafting gallery, rack-supported freight rails and a screened records consultation area. Café preparation includes bread, pantry storage and a supported drying rack; the ferry office has a stock hutch and short room returns. These additions cover the existing 114 business plans without changing their central travel spine or supply anchors.

The 64 residential plans receive activity-specific table settings and seating. Breakfast, mending, saved seeds and a garden journal replace generic desk dressing. The photographer's album, hanging prints and bedside coastline repeat the same personal subject. The shared angular kit, muted palette and existing N64 rendering remain in use; no assets, dependencies or test files were added. Existing test files, Unity and unrelated output deletions were left untouched.

New low overheads use the same solid writer as their visible geometry. Rising player heads now sweep against those undersides, including jumps from furniture. This closes a gap previously covered only by the outer building ceiling.

## Verification

- Local and hosted framework builds completed. All four changed runtime modules match local dist, Sites public and the built client output (12 comparisons).
- Inline geometry checks passed 5,208 entrance samples and 534 work/rear/supply approach targets across 114 business plans, including the new bank workstation aisle. Residential checks passed 512 table front/side/rear approaches across 64 plans. These use a 0.25m flood grid and the player's 0.42m radius; they are geometry checks, not playtests of every generated room.
- An isolated gameplay session reached all 60 connected within-room waypoints across eight business types and three homes. Feet remained at 14.2, without furniture climbing or captured page errors. Its 7,860 frame samples measured median 16.7ms, p95 16.8ms and maximum 66.6ms, with no frames above 100ms. Final support, plate-rack and seating corrections received fresh gameplay captures.
- Four inline table-jump cases met the new bank, radio, press and studio overheads and landed on their starting support. Existing movement/cottage/scavenging/craft checks passed 28 of 29. The single reduced-motion weapon-position assertion also fails against the unchanged HEAD presentation code (baseline Y=0.0100683); it is not reported as passing or changed to fit this pass.
- Read-only craft and map reviewers were given current gameplay evidence. The craft review led to ceiling ties that meet the shell, supported and separated café plates, freight rails supported by rack uprights, and matching seating for both breakfasts. It found no remaining concrete blocker in this bounded pass.
- The map reviewer accepted the sampled circulation, supported object relationships and narrow rising-head correction. It found no confirmed new geometry regression; diagonal airborne entry and vaulting are not certified by these checks.

The large shared shells still leave generous open floor area. Occupations and personal activities read more clearly, but whole-map intimacy, upper tower floors, unfamiliar-player interpretation, combat stress and other hardware remain outside this verification. Evidence is retained under `output/interior-occupancy-2026-10-23/`, bounded to 40MiB / 96 files. The user's original game tab and owned server were retained.

## Publication

Published to the existing public Blackwater Site as version 39, source `b038e2a2afc98983b1ff538a081437ba83e5deaf`, deployment `appgdep_6adbc9fa9d30819182925a64dd9dac6c` (succeeded). Play at https://jrod.download/blackwater/ or https://the-last-dead-blackwater.jrodonthebeat.chatgpt.site/.

A fresh public gameplay session reached 21/21 bank, freight, café and home waypoints, with no furniture climbing or captured page errors. The initial bank automation aimed through the new desk and correctly stopped; the final run follows the staff aisle. Both reports are retained. All four deployed modules matched canonical source. The 2,811-frame final sample measured median 16.7ms, p95 16.9ms and maximum 33.4ms, with no frames above 100ms. The public waiting-room endpoint `/api/blackwater/rooms` returned HTTP 200 and zero rooms at the time of checking; this does not certify multi-peer play.

The existing `Start Blackwater Browser.cmd -NoBrowser` launcher reported the current local build and http://127.0.0.1:5200/. The same repository-owned server was retained without opening or replacing the user's game tab.
