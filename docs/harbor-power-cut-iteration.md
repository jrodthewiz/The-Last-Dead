# Power Cut map-design iteration

Power Depot now has two store wings separated by an eight-metre-wide,
24-metre-long service passage. It connects Dock Road to the promenade through
both ends of the block. The outer streets remain available, so the player has
a route choice instead of another dead-end reward yard.

The existing industrial model is reused for both store wings. Visible inner
walls align with blocked cells; entrance frames, guide lights, a short canopy,
route paint and signs establish a different silhouette from Netmakers. The
canopy and lane signage sit above vehicle height. No external assets or new
dependencies were added.

One four-scrap cache moved into the passage, and one existing infected spawn
moved to its south end. This establishes a reward and potential threat on the
shortcut without increasing the district enemy count. Encounter difficulty
has not been balance-tested. Store wings remain closed; this is an outdoor
service passage, not enterable building interiors.

The field map derives its opening from the same collision cells. HUD location
reads **POWER CUT** inside the passage, and the existing navigation graph uses
the shorter route automatically. This is walking guidance, not steering
assistance for vehicle turns.

## Verification

- 16 focused map, navigation, vehicle and inventory tests pass.
- A new traversal test walks the full passage and collects its scrap. Both
  store wings reject movement; a truck-sized clearance probe passes along
  the centre; all original map pickups/spawns remain reachable.
- A route from the promenade back to the parked truck now goes through the
  opening. With identical start and truck positions, suggested route length
  drops from 82 to 58 metres compared with the closed-depot collision layout.
- Build, syntax and whitespace checks pass.
- `tests/harbor-power-cut-browser.mjs` uses an owned browser, starts Harbor
  through its menu, clears enemies as a traversal fixture, places the player
  at the north approach, then uses keyboard input to cross, collect, open the
  field map and return. It checks that the cache is not collected twice.
- Evidence: `output/playwright/harbor-power-cut/`. The user's game tab/server
  remain untouched. This does not verify combat balance or real-hardware FPS.

Final browser result: **PASS**. Keyboard input crossed north-to-south,
collected four scrap, opened the field map, resumed and returned south-to-north
without duplicating the cache. Nine assets loaded; page/console/HTTP errors
were empty. Both entrance screenshots and the field map were inspected.
The first attempt exceeded its 60-second traversal deadline after collecting
the cache; the successful rerun used 120 seconds for slow headless rendering.
The final JSON supersedes that initial timeout image. A nearby junction sign
was moved after screenshot review to keep the entrance sign clear. Source and
production runtime hashes match.

Existing Three.js gameplay/collision and QA skill references remain applicable:
the current reciprocal-wall authority owns this static, flat-ground layout.
This is a bounded authored change, not a procedural-building generator rewrite.
