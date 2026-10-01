# Authored layout iteration

This pass adds combat choices without increasing the shortest main descent route.

- Old Intake now returns to the southeast flank of Foundry Hall through a narrow service passage. The equipment room has two entrances instead of a dead-end retrace. The return joins the hall before the existing pump gate; it adds no pump entrance or new encounter.
- Pulse Court grows from a 9×5-cell footprint to 11×6. Its two flank cover blocks and machinery remain in place; a wide southern apron and lateral movement space let the fight spread around the pulse engine.
- Surgery Theater grows one cell south, creating a staging shelf before committing to its flank lanes. The operating-table anchor, key, descent gate and room identity stay fixed.
- F3–F5 were inspected and retained. F3 already has 320 m of authored corridor centerlines; adding more traversal would work against pacing.

## Measured change

Measurements use the compiler's fully-open floor topology. A cell is 4 m square. The shortest entry-to-exit metric does not represent the full required encounter route.

| Measure | Before | After |
| --- | ---: | ---: |
| F1 Pulse Court walkable room cells | 39 | 59 |
| F1 total walkable cells | 362 | 387 |
| F1 authored openings | 26 | 28 |
| F1 shortest entry-to-exit distance | 148 m | 148 m |
| F1 shortest-route turns | 15 | 13 |
| F1 room-graph cycle metric | 8 | 11 |
| F1 wall segments | 315 | 329 |
| Old Intake → eastern hall shortest distance | 56 m | 56 m |
| F2 Theater walkable room cells | 35 | 46 |
| F2 total walkable cells | 302 | 311 |
| F2 shortest entry-to-exit distance | 124 m | 124 m |
| F2 wall segments | 330 | 332 |

The service return is an alternative approach and escape route, not a distance shortcut. The graph-cycle metric also reflects widened arena connections; the pass authors one new circulation loop.

## Verification

Focused tests cover every floor's reachability, key-before-gate progression, exact ingress portals, no isolated room floor, door wall-slot/collision agreement, all-floor encounter completion and descent, and live-input routes. New checks block the original equipment-room return to prove the flank works independently, close existing pump entrances to prove there is no bypass, test lateral arena clearance, and verify eleven entrance-to-landmark/next-door sightlines.

Browser QA inspected the enlarged Pulse Court and Surgery Theater. Both reveal their hero machinery and retain side cover. The first return capture found a dark bend and a display cabinet intruding into the new doorway despite an open grid path. A warm fixture and a visible “← HALL” plaque now mark the bend; the cabinet and nearby crate cluster sit away from the entrance. The final eye-level doorway capture in `output/playwright/dungeon-v4-doorway-clear/` shows a continuous visible passage. Gameplay collision and wall rendering consume the same compiled data; hero positions were not moved. No new paid assets or dependencies were used.

References loaded: `threejs-gameplay-systems/SKILL.md`, `references/gameplay-workflows.md`, and `references/physics-engine-selection.md`. The existing custom grid collision remains appropriate for this authored arcade FPS layout pass.
