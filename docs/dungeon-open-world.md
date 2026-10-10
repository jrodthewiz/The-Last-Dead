# Underground campaign entry

Play Campaign starts in the original extended dungeon's first floor. The customs
service stairs at its entry lead to the Blackwater coast; E or Q travels in either
direction. The coast keeps its Low Tide chapter, vehicles and safehouse.

Each dungeon floor retains its own live simulation during a session. Cleared
rooms, open doors, collected keys, equipment finds and chapter machinery are kept
when leaving. Completing a floor unlocks its descent lift; E or Q at that lift
enters the next floor. The entry lift on deeper floors returns to the previous
floor's exit. From the first floor, the entry stairs return to the island. Clearing
the fifth floor leaves the world playable.

Health, equipment, backpack, injuries and combat totals travel with the player.
Surface mission progress remains with the island. Existing Netmakers checkpoints
restore equipment and mission state without trapping the customs arrival in the
safehouse interior. Dungeon floor state is retained in memory for the current
session; restarting or reloading creates fresh underground rooms. Netmakers
continues to save its existing mission/equipment checkpoint.

## Level decisions

The player can explore the threatening dungeon for weapons and records, or take
the clearly marked entry stairs into the coast and return better equipped. Existing
encounter pressure, recovery rooms, machinery objectives and rewards remain the
underground progression. Completed floors become return routes. Deeper lifts need
an explicit interaction so backtracking does not immediately trigger descent.

## Surface detail

The world adds spatially batched benches and refuse stations beyond road verges,
shoreline rescue rings and rope lockers, and flush gutter grilles. Placement checks
exclude carriageways, building approaches, service routes, existing obstacles,
the helipad and steep terrain. Rendering and solid collision share one plan.

The six harbor service interiors receive wall-side supply shelving, archive boxes,
parts trays, work coats and wrapped stores. Shelving has collision while the entry
aisle, searchable caches, electrical meters and exits remain usable. New decoration
adds no lights.

Area cleanup preserves geometry attributes borrowed by actors in the active scene.
This prevents revisiting the coast from destroying buffers still used by the player;
resources owned only by the outgoing area are released normally.

## Verification

- `npm.cmd run build`
- `node --test tests/island-basement.test.mjs tests/coastal-world-polish.test.mjs tests/harbor-interiors.test.mjs tests/campaign-entry.test.mjs tests/campaign-start.test.mjs tests/dungeon-flow.test.mjs tests/dungeon-extension.test.mjs tests/low-tide.test.mjs`
- `node --test tests/runtime-clone.test.mjs tests/world-static.test.mjs tests/coastal-city-resource-guard.test.mjs tests/world-transition-resources.test.mjs`
- `tests/dungeon-open-world-browser.mjs` checks the built game's actual campaign
  start, E stair travel, floor backtracking, Q interior entry/search routes, and
  rendered views. Poses and a completed-floor flag are controlled for the route
  check; it does not claim a complete combat playthrough.

The focused browser run (`DUNGEON_SHORT_ROUTE=1`) passed the fresh underground
start, coast round trip, same-floor state retention, repeated coast visit, interior
entry/exit, and five captured views with no console or HTTP errors. The earlier full
route also verified the deeper lift and upper-floor return; its second coast load
exceeded a four-minute QA timeout. The repeatable script now permits eight minutes
per load and reports preparation stages. These loads remain slow on this workstation.

The explicit `?world=island` and `?world=harbor` links remain surface development
entries; `?dungeon=0` through `?dungeon=4` retain standalone dungeon fixtures.
Co-op retains its existing arena route.
