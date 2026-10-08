# Island basement, building depth, and woodland

The default island connects to the existing authored dungeon through the Customs
service stair. The surface interaction is at (42, 28) metres; its field-map route
ends on the clear street approach at (45, 28). Press E or Q, controller View, or
the touch STAIRS control. The lit ladder at each dungeon floor's entry returns
to the island. A loading transition separates the enclosed dungeon and surface.

Area simulations are cached separately for the current solo session. Health,
equipment, inventory, injuries, cooldowns, and statistics travel with the player;
island mission progress and dungeon enemies/doors retain their own state.
Finishing the last basement floor leaves island exploration available. Existing
safehouse saves keep their established mission/inventory scope; dungeon combat
state is not saved across a page reload. Co-op retains its existing arena flow.

Buildings now express their uses through geometry: warehouses have sawtooth
clerestories, workshops have pitched roofs and raised monitors, apartments have
projecting balconies and rooftop terraces or setback pavilions, and clinics have
service pavilions and different upper-wall materials. Wider structural window
bays replace repetitive shop ornament away from Main Street. The 94 existing
entrances, interiors, furniture, and collision plans remain usable. Shared
building batching continues to meet the existing geometry/draw budgets.

The woodland has 452 cape trees plus 60 town trees. Irregular groves mix young
edges, mature crowns, and 20–24 metre emergents, with a meadow, riverbanks and
clear footpaths. Trees use the shared terrain ground. Distant foliage uses seeded
clusters that retain overhead coverage, within the existing pooled meshes,
materials and 2,800-triangle far-tree limit. Decorative bank roots retain their
14,000-triangle limit. Foliage updates use the final player or inspection camera;
high-altitude inspection haze expands to keep the cape legible.

## Verification

Basement/campaign, coastal route and collision, terrain/foliage, building anatomy,
all-interior, and batching checks passed. The production build completed.

The native WebGPU browser round trip is recorded in
`output/playwright/island-world-final/report.json`: real E input entered the
existing dungeon and returned to the island with health retained, with no runtime
or HTTP errors. This controlled run skips four existing unused startup warmups;
it establishes the area transition and rendered views, not full startup time,
combat performance, phone hardware performance, or co-op basement support.

The revised canopy is checked separately against the built `dist` files by
`tests/island-world-browser.mjs` with `ISLAND_QA_VISUALS_ONLY=1`. Configure the
existing local `PLAYWRIGHT_PATH` and `CHROME_PATH`, set `STREET_QA_SCOPED=1`, and
choose `STREET_QA_OUTPUT` for an owned capture directory. Omitting
`ISLAND_QA_VISUALS_ONLY` also exercises the full E round trip. QA uses its own
temporary server and headless browser; the user's game tab and server stay intact.

The final built-canopy run passed in
`output/playwright/island-world-release/report.json`, with no runtime or HTTP
errors and all 512 trees visible in the aerial view using 12 forest draw pools.
Both owned browser/server runs completed cleanup. Captures include the full
island, industrial rooflines, residential facade depth, woodland and service door.

## Second visual pass

The initial independent craft review scored the release overview 4.5/10. Its
main objections were the rectangular land-water edge, repeated building skyline,
and woodland reading as a perimeter hedge. The next pass addresses these at world
scale: a stratified rocky coastal shelf and two sea stacks outside gameplay
bounds, a civic clock tower and slate spire at the Evacuation Office, mansards
with dormers, oxide merchant roofs and zinc industrial rooflines. Shared maritime
colors and finer ink replace the dominant mustard/teal contrast.

The cape now has three tree groves with meadow gaps and root-centered fern/grass
communities. Ground color follows tree cover, and inspection views receive broad
cached shadows; ordinary gameplay restores the existing local shadow footprint.
The same shadow maps are reused. Buildings retain their entrances and collision
plans, and shoreline additions do not expand playable collision bounds.

`ISLAND_QA_ART_REVIEW=1` adds ordinary street and woodland gameplay captures,
including a woodland view with the first-person post effect disabled. These
images allow a separate artistic verdict; test and build success are not an art
quality score.

The first revised overview scored 5.25/10; enclosed woodland was approximately
6.25/10. The reviewer still rejected the island's overall composition. A further
pass expands the natural shoreline to 52.86 m at its broadest point, with upper
headland shelves, recessed coves and two taller stacks (6,324 triangles, two
draws). East Works 55 now has a 22 m gantry, furnace house and asymmetric flues
reaching 33.5 m. The civic clock tower reaches 35.4 m. All 94 interior checks and
building batching checks passed again without relaxing the geometry budget.

Painted materials receive more indirect fill to retain detail in shadow. Distant
water normals fade when their wavelengths cannot be resolved, and the existing
320-segment water mesh extends to 16 km with a horizon-colored haze rather than
ending in a visible nearby rectangle. Forest-floor albedo also follows grove
margins; ground and collision authority remain shared and unchanged.

The final pass also corrects the natural shoreline mask beyond the original
128 by 120 m port, adds three groups of jointed rock outcrops, and replaces the
small roof monitors on warehouses 49, 58 and 67 with full-width closed hangar
lofts. Their heights are 15.84, 17.84 and 24.38 m. Final shoreline geometry is
6,994 triangles in two draws, with a 16.05 m peak. All 94 interior/geometry
checks, batching checks and five district anatomy checks passed.

The final production build completed. The immutable built native WebGPU capture
passed in `output/playwright/island-art-final/report.json`, including ten views,
no runtime or HTTP errors, background-input guards and completed browser/server
cleanup. The preceding canonical-source attempt timed out at its default
30-second page navigation; its owned browser/server were closed. The rerun used
a bounded 120-second DOM navigation allowance and retained actual game readiness,
dependency waits and error assertions. These scoped views do not establish full
startup performance, combat or phone performance.

The same read-only craft/vision reviewer scored the final fixed overview 6.25/10
against 4.5/10 initially, with woodland around 6.5/10. It confirmed material
visual improvement. Remaining confirmed limitations are repeated urban massing
and window rhythms, and coarse shoreline material/formation detail at eye level.
The foundry's relationship to its supporting facade remains an artistic risk.
These scores are independent artistic judgments, not mechanical acceptance or
professional quality certification.

### Further visual iteration

Warehouses 49, 55, 58 and 67 now use complete industrial hall facades with broad
glazing, service louvers, bearing piers and continuous beams. The foundry gantry
is supported by matching brickwork and concrete piers. Fourteen anatomy,
interior and batching checks passed, retaining all 94 enterable buildings.

The coast now integrates three geological formations into one continuous
height mesh rather than intersecting separate outcrops. World-space mineral
grain, broken inclined bedding and a wet base add detail without textures or
extra submissions. Surf contact follows this actual mesh and uses fragmented,
scalloped geometry with transparent edges and a maximum opacity of 0.26.
The final shore mesh contains 17,922 triangles in two submissions; the seaward
boundary, winding, budget and disposal checks pass.

Actual game captures exposed a production paving material graph failure:
the normal albedo path included diagnostic mask selection. Production albedo
and the explicitly requested diagnostic graph now have separate ownership.
Paving has visible gray-green body color, restrained joints and lighting again.
The native WebGPU fixture checks rendered paving pixels both initially and
after switching through diagnostic channels back to normal shading. It passes
without browser or HTTP errors in
`output/playwright/blackwater-12/shader-isolation/report.json`.

The eastern city/woodland verge now has eight broken salt-meadow communities.
They reuse 153 plants from existing cohorts; total vegetation remains 2,433
understory plants and 512 trees. Ground tint follows the same winding band
across flat town ground and triangulated cape terrain. Door approaches, roads,
paths, river clearances and shared physical ground pass 25 relevant checks.
Ordinary player vegetation culling remains 90 m; high inspection cameras can
see the existing clumps across the island.

The fixed v6 overview received an independent 6.75/10, improving from the
preceding 6.25/10. That review confirmed the paving correction and identified
the empty inland lawn and rectangular surf edges as the next improvements.
These prompted the subsequent meadow and surf pass.

The built v7 native capture passes all ten views with no runtime or HTTP errors
and complete owned browser/server cleanup. Its independent overview score
remained 6.75/10: the surf correction succeeded, but the initial meadow missed
the conspicuous empty residential lawn. Camera projection located that lawn at
x384–448, z0–120. The following revision targets it with four broad scrub lobes,
stronger dry ground coloration and two groups of relocated young trees. It
retains the existing total tree and understory population rather than adding
uniform vegetation across the island.

The corrected residential meadow uses centers (412,20), (424,45), (407,76)
and (429,101). It reallocates 160 plants and 32 young trees into four scrub
lobes and two independently rotated, irregular sapling groups. Shared tree
records also move their collision trunks. Total tree and plant counts remain
unchanged; the focused ground, spacing, road-end and meadow checks pass after
the final planting pattern revision.

The production build and immutable built v8 native WebGPU capture pass in
`output/playwright/island-art-v8/report.json`: ten fixed and ordinary gameplay
views, zero runtime/HTTP errors, intact background-input guards and complete
owned browser/server cleanup. Revised art runtime hashes also match the
canonical source. The existing user's tab and local server were preserved.
This is scoped visual verification, not a new combat or device performance
acceptance run.

The same independent reviewer holds v8 at 6.75/10. Corrected sapling placement
and dry patches are visibly present, but read as sparse park clumps rather
than a continuous coastal ecological belt. The local surf failure is resolved.
The primary remaining artistic ceiling is repeated urban massing: a carpet
of similar rectangular midrise buildings. Its strongest defense is the now
coherent planned port-city layout and functional district contrast. The next
substantial experiment should test a complete landmark silhouette and adjacent
roof-height hierarchy on existing footprints, judged at a 320-pixel overview
without depending on readable signs or facade details.

### Civic hierarchy and measured performance iteration

The Evacuation Office now has a complete stepped civic tower reaching 50.03 m,
with a broad limestone bearing tier, setback belfry, slate crown and attached
roof wings. Adjacent cafe and hardware roofs form lower 14.14 m and 18.94 m
silhouettes. Ground entrances, collider plans and sealed ceilings are preserved.
Architecture loses 9,811 triangles. Source draws remain 1,283; 32/48/64 m
spatial batching remains 791/513/375 draws. No batching budget was relaxed.
All 94 interior checks and focused anatomy/batching checks pass.

Two separate implementation agents addressed performance without lowering
visual settings. Forest pools retain immutable instance identities and dirty
their buffers only when slot membership changes. Twenty forced stationary
refreshes of the actual 512 placements previously scheduled 1,556,480 bytes
in the overview and 4,669,440 bytes in woodland; both now schedule zero bytes.
Active matrices, colors, counts, shadows, draw counts and triangles match.
Nine forest regression checks cover movement, LOD compaction and hide/show.
Evidence: `output/playwright/island-scene-performance/report.json`.

The authoritative 120 Hz world tick also avoids a second enemy-ground
synchronization already performed before player movement. Across 120 ticks,
12 live enemies use 2,880 support queries instead of 4,320; 40 coastal corpses
use 4,800 instead of 9,600. Standalone prediction and dead-host/co-op cases
retain their necessary synchronization. Five before/after tests compare full
dynamic state and enemy authority every tick; 54 existing engine, AI, terrain
and structure checks pass. These reductions establish work eliminated, not FPS.
React Doctor was inapplicable to this plain ES-module Three.js repository.

The initial v9 run completed the actual basement round trip but failed its
immutable-file check because a concurrent weapon asset changed in `dist`.
Its report is not a passing final QA report. Final v10 uses a private copy of
the built runtime at `output/qa-runtime/island-art-v10`. Revised runtime hashes
were checked against source before launch. Its report at
`output/playwright/island-art-v10/report.json` passes twelve views, native
WebGPU, zero runtime/HTTP errors, guarded background input, the real E stair
round trip with health retained, immutable inputs and owned-process cleanup.

The optional native measurement loop records twenty warmed stationary full
renders per view, paused simulation, CPU submission and queue-fenced wall time.
On the reported NVIDIA Turing adapter, median fenced times were:

| Fixed view | v8 baseline | v10 final | Forest dirty-attribute increments |
| --- | ---: | ---: | ---: |
| Overview | 113.6 ms | 55.6 ms | 240 to 0 |
| Works | 57.2 ms | 31.6 ms | 240 to 0 |
| Street | 51.7 ms | 40.5 ms | 192 to 0 |
| Woodland | 30.5 ms | 26.0 ms | 288 to 0 |

These are headless stationary samples, not gameplay FPS or GPU timestamp
durations. Concurrent host load and separate weapon updates prevent attributing
the entire timing difference to this patch; controlled instance and simulation
work counts provide the stronger causal evidence. Complete combat and phone
performance remain outside this scoped acceptance.

The independent final overview verdict is 7/10, up from v8's 6.75/10. The civic
landmark now organizes its district; repeated central-town footprints, height
bands and clean window/facade treatment remain confirmed artistic limitations.
Civic close construction quality is unverified without a dedicated close view.
This is a visual improvement, not an 8–9/10 or professional-parity certification.


## Island environment and maritime pass

This pass strengthens a wind-scoured fishing/quarantine island: pine duff and
sheltered birch litter, moss and mineral ground, moored working vessels, and
parked estate cars/delivery vans across the harbor and outer districts.
The existing truck remains the drivable vehicle. The three boats and eight
new cars are stationary scenery; parked cars have authoritative collision.
Boat hulls remain seaward of the quay, with sagged lines terminating at actual
bollards. Layout screening preserves building approaches, pickups and roads.
The first integrated route test exposed a van narrowing the broad truck route;
its placement moved from (122,52) to (122,48) metres and the route passes.

The eleven props share nine merged material submissions, nine owned materials
and 18,134 triangles, with no textures, added shadow maps or frame updates.
Disposal tests prove each owned geometry and material releases exactly once.
Trees remain at 512 and understory at 2,433. Forest detail stays within the
existing 14,000-triangle / 40-tile allowance, rather than adding a new pass.
Final detail is 13,944 triangles: 250 bank plates, 343 root ribbons, 1,156
duff fragments and eight forked windfall ribbons. Broad wind-stretched
duff/moss beds follow actual tree canopies; uniform needle dashes were removed.
The vehicle revision adds shaped raked glazing, tapered hoods, real wheel
openings and recessed wheels while retaining the shared material batches.

The performance worker compared real v10 overview/woodland placements with
this forest implementation. Sixty stationary refresh opportunities formerly
scanned 30,720 trees; now they scan zero. Camera world/projection changes,
forced refresh and visibility changes invalidate the cache, while wind time
continues updating. Instance data, shadows, draw counts and triangle counts
match. Evidence: `output/playwright/island-environment-performance/report.json`.
This is eliminated CPU work, not a gameplay FPS claim.

The first native v11 inspection passed 17 views, immutable inputs, zero runtime
and HTTP errors, owned cleanup, and the real E basement round trip with health
retained. Its works-van camera was inside a building and cannot substantiate
vehicle appearance; final inspection uses a corrected road camera. Forest
floor pixels still appeared too smooth, prompting a further bounded art pass.


Final v12 uses `output/qa-runtime/island-environment-v12`; revised runtime
hashes match source before launch. `output/playwright/island-art-v12/report.json`
passes all 17 native WebGPU views, 45 immutable input hashes, zero runtime/HTTP
errors, guarded background input and owned browser/server cleanup. Actual E
travel downstairs and back preserves health at 100. All 43 relevant Node tests
pass, including the broad truck route, terrain authority, parked-car bounds,
resource disposal and basement state; `node build.mjs` succeeds.

Twenty warmed stationary samples per view recorded median queue-fenced wall
times of 41.8 ms overview, 23.4 ms works, 28.2 ms street and 18.5 ms woodland.
Forest dirty-attribute increments remain zero in each view. These headless
paused samples describe this run; host load prevents attributing timing changes
to this patch, and they do not establish gameplay FPS or mobile acceptance.


Independent v12 pixel review keeps the fixed overview at 7/10. Local estate/van
craft improved to about 7/10 within the stylized grammar, with actual cabin/hood
continuity and wheel openings; boat craft is about 6.5/10. Woodland is about
6.5/10, with the close ground itself only 5.5–6/10: broader brown duff is more
coherent, but smooth shaded surfaces still outweigh visible accumulation and
material relief. The outer clearing remains sparsely planted lawn beside a
straight engineered stream/walk edge; dense canopy and clear routes provide
counterevidence. This pass achieves local gains, not an 8/10 certification.
A further ecological art pass should test one representative ground patch
with clear moss/needle/path relationships and root/windfall accumulation from
the same eye-level camera plus an unshadowed material view.
