# Harbor map design and UI iteration

Open **B → FIELD MAP** to inspect the district; **EQUIPMENT** returns to the
weapon rack. Both views share the existing pause/resume and keyboard-focus
ownership. The map is informational and does not teleport or change inventory.

## Navigation design

- Numbered building landmarks, the open Netmakers yard/gate, remaining weapon
  finds, player facing, the live truck position and ferry marker share the
  authoritative course layout.
- A gold suggested walking route follows reciprocal cell walls. Scavenging
  selects the closest remaining find by reachable cell path; the next stages
  direct players to the truck and then the ferry. It does not plan a turning
  radius for the truck or account for moving enemies.
- HUD location names distinguish Dock Road, the service lanes, Netmakers,
  the promenade and ferry approach. On-foot guidance gives the next street
  direction and approximate route distance. Driving retains its controls.
- New junction signs, paired crosswalks and painted ferry extraction edges
  connect UI landmarks to the world. Paint heights are separated from the
  road/promenade, and signs above driving lanes leave vehicle clearance.

The route graph is cached per course, player cell and target set/position.
HUD navigation updates at four Hz. The field map only rebuilds when its
paused player/inventory/vehicle snapshot changes; it never modifies gameplay
state. No new external assets or runtime dependencies were added.

## UI and verification

UI states covered: equipment, field map, selected view, paused/resumed,
collected finds, changing objective, keyboard focus and responsive scrolling.
The map shares the olive/gold field-equipment palette and uses shapes plus a
legend rather than color alone. Portrait places the landmark list below the
map; desktop puts it beside the map. Existing controls retain 44-pixel targets.

- 15 harbor navigation/map/vehicle/inventory tests pass. Route segments are
  ray-checked against collision; the yard test requires a detour through its
  actual gate. Objective transitions and consumed marker removal are tested.
- 45 engine/AI/backpack regression tests pass.
- Isolated browser UI passes at 1280×720, 390×844, 844×390 and 320×640:
  equipment fitting/equip, field-map switching, six landmark labels, no
  horizontal overflow, focus on visible controls and zero DOM mutations over
  120 unchanged map frames. Desktop and portrait screenshots inspected.
- Build, syntax and whitespace checks pass. Integrated browser evidence is
  recorded under `output/playwright/harbor-map/`; fixture scope remains the
  same as earlier harbor checks (enemy-free traversal, nearby approach setup,
  explicit extraction travel fixture after an actual driving check).

Final integrated browser result: **PASS**, with zero page/console/HTTP errors.
Gate traversal, four weapon pickups, scrap, equip, driving/braking/safe exit,
three map/equipment viewport pairs, fixture-assisted extraction and actual
restart passed. Full-game desktop/portrait field maps and the active HUD were
visually inspected. The displayed route detours around Power Depot to the
parked truck; collected finds are absent. Runtime source/build hashes match.
Headless cold startup took 179.3 seconds; no ordinary-hardware FPS claim.

Reference ledger: Three.js UI skill and `references/ui-patterns.md`,
`checklists/game-ui-quality.md`, `hud-readability.md`, `responsive-ui-fit.md`
and `mobile-input.md` were read and applied. Existing gameplay/grid collision
and QA workflows remain in use. No procedural building generator was added.

Limitations: this is a bounded district with an informational field map, not
fog-of-war, custom waypoint placement, GPS driving assistance or a streamed
open world. Physical mobile hardware and encounter balance are unverified.
