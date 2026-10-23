# Household and business layouts — 23 October 2026

The residential kit now has three household floorplan recipes. Family flats gather a window-wall sofa around dining and an inward-facing front kitchen. Gardeners have a longer window-side potting run, a low return cabinet and a journal desk facing the resulting alcove. Photographers have a screened print workspace reached around its open inner side, a real viewing slit and a separate album table. Bedroom cross-partitions have actual doors and preserve the shared hall portals. Each wing receives its complete household arrangement.

Cafés combine two window banquettes, a communal table with facing benches, a reading corner and an L-shaped preparation/service area. Ferry offices have a side-facing timetable/counter, waiting benches across the public spine, and a working clerk's bay behind the counter. The existing terminal, stock hutch, paperwork and chair move into that bay; the smallest office still has a walkable approach behind the chair.

A shared exact right-angle placement adapter moves geometry, solids, supported props and directional surfaces together. Front kitchens face inward; household towels, drawer fronts, pots, photographs and folded clothing follow their furniture. Office paperwork and the passenger's case follow the new counter and waiting bench. The café return ends meet its two worktops, and the gardener's watering-can handle has supporting uprights.

The existing angular instanced kit, muted palette, grain and lighting remain. No dependencies, external assets or test files were added. No existing test files or Unity files were edited. Layouts vary by household/business identity; addresses with the same identity still share a recipe, with existing seeded finishes and personal details.

## Verification

- All 11 targeted existing scavenging/craft checks passed. This is not a full-suite claim; the previously documented reduced-motion weapon-position assertion is outside this pass.
- Inline final geometry/clearance checks passed 5,208 entrance samples, 678 zone approaches across 114 businesses, and 1,068 approaches across 64 residential plans. These use a 0.25m grid and 0.42m body radius. All 25,698 wall-lining pieces and 256 mounted household panels passed their opening/contact checks across 178 plans. These are geometry checks rather than individual playthroughs of every generated room.
- An isolated background game session completed 78/78 connected walk legs across three home types, café and ferry office with constant 14.2 foot height and no captured page errors. Its 7,452 frame samples measured median 16.7ms, p95 16.9ms and maximum 50ms, with no frames above 100ms. Final café/handle refinements were followed by another 6/6-leg walk. The final ferry workstation was then walked in ordinary and narrowest offices: 18/18 legs, feet 14.2, no captured page errors; 1,458 frame samples, median 16.7ms, p95 16.8ms, maximum 33.4ms and no frames above 100ms.
- Two read-only vision reviewers inspected fresh before/after and final gameplay sequences. They confirmed distinct room roles and routes, inward-facing kitchens, coherent café seating and the corrected ferry workstation. No concrete construction/navigation blocker remained in the sampled final evidence. Long shared shells still limit distinction at residential entrances. Unfamiliar players may mistake the photographer's viewing slit for an entrance or miss the office's side entrance; unguided interpretation remains unverified. The tiny watering-can handle has source-confirmed contact but is too small in the wide image for a close visual verdict.

Fresh before/after and final ordinary gameplay views and route evidence are retained under `output/room-layouts-2026-10-23/`, budget 40MiB / 96 files. The original game tab and repository-owned port 5200 server are preserved. This bounded pass does not establish whole-map combat performance, upper-floor completeness, or unfamiliar-player comprehension of screened workspaces.

## Publication

Local and hosted framework builds completed. All eight changed runtime modules match local dist, Sites public and the built client (24 comparisons).

Published to the existing public Blackwater Site as version 41, source `16cedb107326bb1f1a730666472ae261bde698a3`, deployment `appgdep_6adbdfc153148191b8e997e09a690c2b` (succeeded). Play at https://jrod.download/blackwater/ or https://the-last-dead-blackwater.jrodonthebeat.chatgpt.site/.

A fresh public game session through the JRod alias completed 78/78 connected walk legs across all five changed room identities, including the corrected clerk's bay. Feet stayed at 14.2; no page errors were captured. All eight deployed modules matched canonical source. The public `/api/blackwater/rooms` endpoint returned HTTP 200 with zero waiting rooms at check time; this is not multi-peer certification. Its 7,618 frame samples measured median 16.7ms and p95 16.8ms, with five frames above 100ms and a maximum of 416.4ms. The causes of those hosted spikes were not isolated; smooth full-world performance is not established by this pass.

The existing `Start Blackwater Browser.cmd -NoBrowser` reported the current local build at http://127.0.0.1:5200/. Repository-owned server PID 24192 was retained; the user's original game tab was not replaced or refreshed.
