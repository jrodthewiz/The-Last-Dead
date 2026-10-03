# Blackwater Harbor — playable exterior iteration

Choose **BLACKWATER HARBOR** from the main menu at http://127.0.0.1:5200/.
The existing descent remains available. This is a bounded solo expedition;
it is not yet the streamed open world.

## Player loop

Walk over weapon displays to keep the weapons in an eight-slot backpack.
The first finds include the existing Wake Bat and shotgun; six placements
also include a chainsaw, automatic rifle, marksman rifle and launcher.
Pickup preserves the weapon currently in hand. Press **B** to inspect and
equip carried weapons, or spend eight scrap on the existing +25% fitting.
Scrap capacity and weapon slots are separate. Ownership lasts for this run;
a fresh expedition starts clean. There is no disk-save claim.

Approach the truck and press **Q**. **W/S** drives, **A/D** steers,
**Space** brakes, and **Q** exits once slow enough. A chase camera replaces
the viewmodel while driving. The truck footprint sweeps against the grid,
and dismount checks both side exits for clear standing space. Parked truck
geometry also blocks player movement. This is a flat-road arcade controller,
not suspension, rigid-body vehicle combat or zombie ramming.

Recover three weapons, drive 32 metres and reach the ferry marker on foot.
Four existing infected spawn in wandering states; combat systems and rigs
are reused. The automated traversal fixture removes these infected, so its
success does not establish encounter balance.

## World and asset decisions

The 128 × 120 metre district has six named lots, intersecting roads, a
promenade, signs, seawall and animated water. Closed lots have visible
borders aligned with collision. Imported geometry retains its proportions.
Road paint, pavement and water occupy separated heights; no whole-world
temporal-flicker guarantee is made from static screenshots.

Full official Kenney vehicle and industrial packs were acquired through
PowerShell and preserved in the ignored source archive. Ten self-contained
GLBs plus licenses cost 1,360,084 runtime bytes; nine models are displayed.
See [asset sources and reproducible commands](harbor-assets.md). Extra pack
variants remain available without inflating the runtime bundle. No third-party
project code, paid generator or unavailable model was needed for this pass.

The water uses shared analytic displacement and normals, restrained sky
reflection and a deep teal body color. First full-game evidence revealed
washed-out highlights; the second material pass reduced reflection and haze.
It is scenery beyond the seawall: no swimming, buoyancy or scene refraction.
The existing recorded audio library remains in use; surf and engine loops
are still a follow-up.

## Verification

- `npm run test:harbor`: map reachability, packaged assets, inventory ownership,
  pickup rejection, vehicle entry/exit, wall sweeping and extraction gate.
- Combined mechanics/map/inventory/AI regression: **61 passing tests**.
- Additional fitting/loading/presentation/map regression: **29 passing tests**.
- `node build.mjs`, syntax checks and `git diff --check` pass.
- First full-game owned Chromium run: real movement pickup, backpack equip,
  driving/braking/dismount, animated water and varied canvas pixels pass;
  zero page, console or HTTP errors. Three responsive backpack viewports pass.
  Audio reports 136 decoded entries and no errors.
- Evidence: `output/playwright/harbor/browser-report.json`. The final visual,
  extraction and restart pass also **passed**, recorded separately under
  `output/playwright/harbor-extraction/`. It collected three weapons via input,
  drove 6.27 metres, then used a travel-progress fixture to test the 32-metre
  extraction gate through real exit movement. Restart reset ownership, scrap,
  consumed finds and vehicle state. Nine assets loaded without errors; the
  corrected teal water and smaller pickup displays were visually inspected.
  Final headless startup was 142.3 seconds. See `harbor-browser-report.md` for
  the exact fixture limitations.

The first headless run took 179.7 seconds to prepare. Full-game diagnostics
at the waterfront reported 102 calls, 193,084 submitted GPU triangles and
1,312,196 scene-geometry triangles, with 112 renderer textures. Those counts
include existing equipment/presentation resources;
the isolated harbor was about 68 calls and 27,818 triangles before its contact
shadow adjustment. This is not an ordinary-hardware FPS claim. Startup and
equipment resource cost remain performance work.

## Art review and next small tests

The UI has clear weapon categories, silhouettes, equipped state, fitting cost
and responsive controls. The exterior is still sparse and its clean low-poly
building kit does not yet match the worn first-person weapons. It is a useful
playable prototype, not premium finished art. Visual scorecard, 0–3:
art direction 1; player 2; enemies unscored in traversal evidence; rewards 2;
world 1; materials 1; lighting 1; motion 2; UI 2; performance evidence 2.

1. Add one enterable service warehouse using the existing Blender house/proxy
   export pattern. Verify doorway clearance, roof seams and window collision.
2. Dress one block with sourced cars, fence openings and work props. Give each
   solid prop a collision proxy and preserve a readable truck route.
3. Add and audition licensed surf/engine loops with speed-driven mix and
   pause/restart cleanup checks.
4. Reuse the same district grammar for one adjacent neighborhood with a shared
   road connection. Test deterministic generation and chunk load/unload before
   multiplying the whole city.
5. Add backpack persistence only after defining save/retry semantics. Verify
   duplicate pickup prevention, upgrades and ownership across district travel.

Reference ledger: Three.js game director, gameplay systems/collision selection,
AAA graphics builder model/render blueprint and visual scorecard, water optics,
UI readability/responsive references and QA/release checklists informed this
bounded iteration. The director's broad-phase delegation instruction was used
for isolated world/assets and backpack/QA work; shared integration stayed local.
