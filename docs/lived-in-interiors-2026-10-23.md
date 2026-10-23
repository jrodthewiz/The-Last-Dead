# Lived-in homes and businesses — 23 October 2026

The 178 street-level business/residential plans now have independently seeded interior finishes. Thin inward-facing linings follow actual shell segments, including upper clerestories, instead of painting across windows or doors. Three restrained plaster/timber/fabric combinations occur within every occupation and household identity. The existing world RNG, building IDs, seeds, shell collision and supply anchors are unchanged. Side-wall dado now stops below the window sill.

Generic domestic pictures that intersected window openings have been removed. New displays and peg rails meet known solid divider segments. A family's ferry/beacon drawing, adult and child raincoats, saved breakfast portion, runner and repaired blanket form one connected preparation scene. Gardeners have botanical studies and work aprons; photographers have a coastal contact sheet, camera bag and darkroom apron. Cabinet fronts, pulls and used towels finish the existing kitchen footprints.

Radio's tall freestanding equipment placard is replaced by a smaller storage/rundown composition against the acoustic wall. A missing tape case, its marked slot and the selected recording at the deck describe a working sequence. Supported headphones remain at the console. Other businesses gain appropriate signs of use on existing furniture: a printer's apron and edition bundles, survey satchel, active teller paperwork/stamp, packing equipment, a consultation application, café service towel and ferry passenger's case/ticket pair.

The additions use the existing instanced angular kit, grain, lighting and muted N64 palette. No external assets, dependencies or test files were added; no existing test files or Unity files were edited. Unrelated output deletions remain outside the change.

## Verification

- All 11 targeted existing scavenging/craft checks passed. This is not a full-suite result; the previously documented reduced-motion weapon-position assertion is outside this change.
- Inline shared-plan checks passed 5,208 entrance samples and 534 work/rear/supply approaches across 114 businesses, plus 512 table approaches across 64 residential plans, using a 0.25m grid and 0.42m body radius.
- Finite geometry, all 25,698 lining pieces against window/door openings, and contact/coverage of 256 household picture/peg-rail panels were checked across the 178 plans. No failures remained. All 11 affected identities have all three finish variants. These are source geometry checks, not playtests of every generated interior.
- A guarded isolated game session reached 71/71 connected within-room waypoints across eight business types, three home types and two additional identity/finish comparisons. Feet remained at 14.2 with no climbing or captured page errors. Its 9,033 frame samples measured median 16.7ms, p95 16.8ms and maximum 50ms, with zero frames above 100ms. This main sample preceded final artwork/contact refinements; a fresh selected final session passed 14/14 legs, followed by a 4/4-leg closer kitchen approach.
- Two read-only vision reviewers inspected before/after and final ordinary gameplay views. Their findings led to correctly layered household artwork, distinct hung/folded coat states, a passenger case on its actual bench, and compact supported radio monitors that expose the tape rack. Both found no remaining concrete construction or navigation blocker in the sampled final scenes. Folded clothing still reads primarily as folded textile; interpreting it as the missing coat depends on matching colour/band cues. Both sampled radios have the same empty left slot, so they establish composition and finish differences rather than every selection state.
- Local and hosted framework builds completed. All five changed runtime modules match local dist, Sites public and the built client (15 comparisons).

Fresh before/after gameplay views and bounded navigation evidence are retained under `output/lived-in-interiors-2026-10-23/`, budget 40MiB / 96 files. The user's original game tab and repository-owned port 5200 server are preserved. Generous shared room dimensions remain; this pass does not certify all upper floors, whole-map combat performance or unfamiliar-player interpretation of the scenes.

## Publication

Published to the existing public Blackwater Site as version 40, source `51d55442c9982ffe41a741d5214270833f2d7cec`, deployment `appgdep_6adbd5fca580819184a7aa1d639e8860` (succeeded). Play at https://jrod.download/blackwater/ or https://the-last-dead-blackwater.jrodonthebeat.chatgpt.site/.

A fresh public session through the JRod alias reached 16/16 radio, family and ticket-office waypoints, with feet at 14.2 and no captured page errors. All five deployed modules matched canonical source. Its 1,730 sampled frames measured median 16.7ms, p95 16.8ms and maximum 33.4ms, with no frames above 100ms. The public `/api/blackwater/rooms` endpoint returned HTTP 200 and zero waiting rooms at check time; this is not multi-peer certification.

The existing `Start Blackwater Browser.cmd -NoBrowser` reported the current local build at http://127.0.0.1:5200/. Repository-owned server PID 24192 was retained; the user's original game tab was not replaced or refreshed.
