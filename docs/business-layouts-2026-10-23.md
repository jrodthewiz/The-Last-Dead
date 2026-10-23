# Business layouts — 23 October 2026

Eight business plans replace the shared desk-pod/long-runner arrangement: bank teller/public/staff zones; radio control/listening/booth areas; a newspaper production workline and dispatch counter; a visitor-facing architecture model with window drafting; parcel receiving/racks/sorting; archive aisles and consultation; café service/window dining; and ferry ticketing/waiting. These plans cover 114 generated street-level interiors. Brand boards move away from the lift axis, and local work mats replace the universal long runner. The angular geometry, grain, muted palette and instanced kit remain consistent with Blackwater's N64 presentation.

Visible furniture and collision volumes use the same writer. The front crossover, central travel spine and existing supply-bench anchors are preserved. No external asset files, dependencies or test files were added; no existing test files were edited. Unity and unrelated existing output deletions are outside this change.

## Verification

- Local build and existing hosted framework build completed.
- All 11 existing scavenging/craft checks passed.
- Inline checks covered 5,208 entrance samples, 114 plan bounds and 512 work/rear/stash approach targets using a 0.25m flood grid. No failures remained. This is source geometry evidence, not a playtest of every generated room.
- A guarded isolated game session completed 45 connected within-room keyboard walking legs across all eight types. Feet remained at 14.2 throughout, with no furniture climbing and no captured page errors. Entry, work-area and reverse views were inspected. Its 6,621 sampled frames measured median 16.7 ms, p95 16.8 ms and maximum 66.7 ms, with no frames above 100 ms. This is not a whole-map, combat or multi-peer stress benchmark.
- Two read-only craft/map reviewers inspected fresh gameplay frames, then revisions. Their findings led to a persistent L-shaped bank staff boundary, a forward studio model/drawing pair with an unobstructed approach, and archive/parcel layouts distributed through their working depth. Both accepted this bounded structural/circulation improvement.

The shared large shells still leave generous central floor area and sparse staff bays. Travel depends most on its timetable for specific occupation recognition; café seating retains a repeated rhythm. Unfamiliar-player comprehension, combat use and full-floor visual polish remain unverified. Upper tower floors are unchanged.

Evidence is retained under `output/business-layouts-2026-10-23/`, budget 32 MiB / 96 files. No browser or native input was taken from the user's existing game tab.

## Publication

Published to the existing public Blackwater Site as version 38, source `cc3b947719ed092c7ae2372b16aeabddd54c6380`, deployment `appgdep_6adbc27c0f8c8191a31e0f2e77819882` (succeeded). The launch link https://jrod.download/blackwater/ resolves to https://the-last-dead-blackwater.jrodonthebeat.chatgpt.site/.

A fresh isolated public session completed 18/18 sampled bank, archive and café walking legs, without furniture climbing or captured page errors. All five deployed business modules matched canonical source; the same modules match local dist, Sites public and built client outputs (15 local comparisons). The public waiting-room endpoint `/api/blackwater/rooms` returned HTTP 200 and zero rooms at the time of the check. The 2,964-frame public sample measured median 16.7 ms, p95 16.9 ms and maximum 83.1 ms, with no frames above 100 ms. This is not a new multiplayer soak or whole-map benchmark. The existing local launcher reported the current build and http://127.0.0.1:5200/ while retaining the same owned server.
