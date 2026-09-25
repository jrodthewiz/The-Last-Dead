# Story map iteration — lived-in routes

This pass treats the five floors as parts of a facility with different former uses. The route, collision, hero landmarks, props, and lighting still come from the authored Story courses.

| Floor | Route and spatial intent | Measured shortest entry-to-exit route |
| --- | --- | ---: |
| Intake Foundry | Arrival now enters through the southwest receiving dock, sluice, and graft ward before the central hall. The former intake is a reachable loading bay. The furnace key, pulse court, and cargo lift still anchor the route. | 156 m |
| Graft Galleries | Arrival moved into Ward A. Cross the recovery galleries before the surgery theater and east scrub key. Sterile ward lighting gives way to the theater's red. | 124 m |
| Catacombs | Arrival moved into southeast charnel stores. Follow the lower burial lane to the colonnade, travel west for the vault key, then return to the court. | 180 m |
| Resonance | Arrival now enters from the southeast bell service door and climbs the east aisle. Two lateral transepts connect the side aisles to the nave; the old entrance is an abandoned vestry. The bell key still pulls the player to the west tower. All three choir court entrances release with its encounter. | 136 m |
| Last Descent | Narrow throat sequence remains the finale; dark rock and bone cover replace the generic cubes. | 96 m |

The roof now follows reachable cells instead of spanning the entire map rectangle. Encounter courts stay open above, so they feel larger than the approach rooms. Room wall details and overhead beams follow compiled walls and room bounds; the arena's perimeter kit no longer bleeds into Story floors. Hero-scale props are placed in Story mode with collision clearance. Story cover has floor-specific silhouettes and is drawn with a few instanced meshes.

The second iteration gives Floors 1 and 4 a spatial beginning distinct from their main halls. Each uses an edge approach, a former entrance that remains explorable, and a cross route that supports combat movement. The measured shortest paths are 64 m and 48 m longer respectively. These remain compact FPS floors; the work establishes a stronger route grammar for later expansion.

## Verification

- `npm.cmd run test:map` — 14 tests, including live movement through all five floors, entry-to-hub route lengths on Floors 1–4, choir court gate behavior, and ceiling placement.
- `node --test tests/dungeon-art.test.mjs tests/afterlife-atmosphere.test.mjs` — 8 tests.
- `npm.cmd run build` — runtime includes the new cover and place kits.
- `tests/map-look-qa.mjs` — all five floors captured in a separate headless browser in the first pass. Floors 1 and 4 were recaptured after this iteration with no page or HTTP errors. See [first-pass screenshots](review/) and [second-pass screenshots](iteration-2/).
