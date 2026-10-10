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
materials and 2,800-triangle far-tree limit. Bank shelves, roots and litter
share the terrain material and follow its exact ground triangles. Foliage
updates use the final player or inspection camera;
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

## Continued fixed-view iterations (October 8)

The requested target is an honest independent 8.5/10. The review contract uses
four equally weighted dimensions (composition/geography, material/construction,
ecology/terrain, integration/identity), requires no fixed required view below
8/10, and does not award artistic points for tests, counts, or performance.
Original cameras remain fixed; new useful views supplement rather than replace
weak views. A second fresh reviewer will inspect any qualifying result.

v13 (`output/playwright/island-art-v13/report.json`) passes 18 native WebGPU
views and the real basement round trip, but receives 7/10 overall. Its exposed
stone mask incorrectly made wooded slopes pale; distant conifer crown lobes
looked detached. These are failed visual experiments, not quality acceptance.

v14 (`output/playwright/island-art-v14/report.json`) passes 18 native views,
69 scoped tests, and the real E basement round trip, with zero runtime/HTTP
errors. Its independent score is 7.1875/10, reported as 7.2. Connected crown
volumes, taller wooded ridges, mixed roof grammars and readable ground material
improve the work. Rectangular atlas seams, excessive foreground grit and a
new grove obscuring the fixed outer-coast camera remain confirmed blockers.
No 8.5 acceptance is claimed.

The atlas adds two shared owned textures: 8,388,608 source bytes and an estimated
11.2 MB mipmapped payload. Exact once-only disposal is checked; this budget
is not a measured GPU allocation. Corrected all-far tree geometry costs 0.82%
more triangles than controlled v12, while geometry buffers decrease 631,824
bytes. Counts and resource details are recorded in
`output/playwright/island-resource-v14/report.json`.

v14's 20 warmed paused stationary samples record median queue-fenced wall
times of 43.5 ms overview, 26.2 ms works, 30.6 ms street and 19.9 ms woodland.
Stationary forest attribute increments remain zero. Host load and differing
visible geometry prevent causal conclusions; these are not gameplay FPS.

v15 passes the same 18 native views and 69 scoped tests. The independent
four-dimension average is 7.3125/10 (reported 7.3). Atlas repeat seams are gone
and the unchanged coastal camera is readable again. Broad flat equal-setback
rock ledges resemble manufactured masonry; that experiment is rejected.

v16 passes the same 18 native views and 70 scoped tests. The independent
average is 7.4375/10 (reported 7.4). Broken cliff faces, slope communities and
two constructed storefront grammars improve the work. A radial cap starburst,
thin fern leaves and reduced vehicle fixture contrast remain blockers.
The actual named landmark heights are restored to 9/9/9/15 metres for
addresses 49/55/58/67; the prior zero-based lookup claimed preservation but
selected neighboring addresses. A real-course regression now checks this.

The atlas shader now skips eight texture fetches on zero-biome or fully faded
detail fragments, using one material and the same textures. Actual production
material native A/B readbacks in five cases match exactly, with derivatives
outside the conditional. Controlled timing does not establish a speed gain.
Evidence: `output/playwright/atlas-branch-probe/report.json`.

v17 passes 18 native views and receives an independent 7.5/10. Its fern craft uses 504 triangles
per instance, 575,064 across 1,141 ferns (327,467 more all-visible plant triangles
than v16). Two geometries/materials, 70 instanced bins, original culling and no
extra textures/shadow maps remain. The independent resource audit is in
`output/playwright/island-resource-v17/report.json`. All 71 coordinated Node
tests pass; geometry costs do not establish visual quality.

v18 passes 18 native views and 72 scoped tests, with zero runtime/HTTP errors.
Its independent average is 7.5625/10 (reported 7.6). Vehicle front lamps and
grilles now sit ahead of the beveled body; native pixels confirm their return.
Building glazing uses one shared native PBR material across 126 meshes, with
analytic coastal sky color and a dirt film, without additional textures.
The critic still identifies repetitive fern crowns, folded cliff panels and
the broad residential coastal lawn as visual limitations. The immediate
basement return also faces the service door; this presentation defect is
separate from the previously passing round-trip state-transfer checks.

v19 passes 19 native views but remains 7.6/10 in independent visual review.
It replaces separate cliff layers with
a continuous apron mesh and irregular inclined strata, revises fern growth
into six unequal fronds at the same triangle cost, and moves the basement
arrival just outside the stair walls facing along the harbor street. All 74
scoped tests pass, including actual forward movement after climbing. The
native fixture records an unsteered return and 15.98 metres of forward travel
in two seconds, retaining 100 health. The facing defect is resolved. The
headland is rejected at 6.25/10 because continuity became a smooth pale mound;
fern branching improves, but sparse foliage and sharp basal stalks remain.
No 8.5 score is claimed. The independent resource audit confirms exactly
1,700 additional shore triangles and 183,600 buffer bytes against v18, with
unchanged submissions, textures and zero stationary forest uploads. Timings
do not establish a causal performance change.

v20 passes 19 native views; the independent average is 7.625/10 (reported
7.6), with overview 7.75 and headland 6.75. Connected coastal traces and less
angular fern bases improve the images. The scarp still has a flat summit and
uniform pale facets. It is not accepted as finished geology. Coastal scrub
reuses 160 city-verge plants: total remains 2,433, actual woodland remains
1,003 plants and the fixed forest-floor region remains 268. Authoring zones
now count city 580, forest-floor 1,353 (including 320 coastal meadow), river
350 and eastern slope 150. Bank detail is 43,161 triangles across 43 bins.

v21 passes 20 native views and all 75 scoped tests. SALTWIND 32 receives five
real recessed loggia levels while preserving its ground entrances and mansard;
the extra oblique view supplements the unchanged residential camera. Native
painted-metal response is tested on boats and cars without extra material slots.
Independent artistic review gives 7.7/10 (average 7.6875), with the supplemental
loggia view 8/10 and the original residential view 7.75. The dark flat boat hull
earns no clear material-quality gain; wave phases and an opposite view are
required to distinguish lighting and contact. No 8.5 acceptance is claimed.

An independent native v20 draw trace disproves repeated stationary shadow
submissions as the measured bottleneck: overview has 1,592 main submissions
and three auxiliary submissions, including 505 building batches. All four
sampled views submit zero shadow draws. Command caching is only an experiment
proposal until exact pixels, visibility, lifecycle and timings are verified.

v22 passes 20 native views; independent review remains 7.7/10. Semantic cliff colors follow actual bearing
beds, fractures, talus and sheltered cap soil. Rock geometry retains its two
draws and 20,708 triangles. A noise API mistake biased seam masks away from
their thresholds; centered noise corrects those masks. UV-dependent cliff
normal mapping is removed because that mesh has no UV derivative basis.
The same confirmed noise-parameter mistake is corrected in selected building
wear/glass masks, maritime wear and authored sky shear. These are source fixes;
fresh rendered evidence still shows blurred bedding on broad facets. Headland
remains 7/10 and is not accepted as finished geology.

v23 passes 24 native views and 77 scoped tests; independent review remains
7.7/10. Three fixed wave phases and an opposite boat view reveal no decisive
floating gap, but boats are static and physical wave coupling is unverified.
The Customs entrance now has a pitched sheet roof, flashing, service drainage
and recessed masonry construction: 976 triangles and 13 isolated submissions,
compared with 298 triangles and eight submissions previously. Its visual score
is 7.5. Shrub leaf count earns no visual credit: the original forest views still
look sparse. Total plants remain 2,433, including 160 shrubs, with 76 plant bins,
three geometries and two materials. Native resource counts show no extra
textures or render targets and zero stationary forest attribute updates.

v24 passes 24 native views, zero runtime/HTTP errors and 81 scoped tests.
Broader shrub leaves use 246 triangles per instance, fewer than v23's 252;
one community moves to an actual tree root pocket. Damp road shoulders use
the same frozen road rectangles as the world layout. Their reflection is an
analytic sky tint, not scene reflection. Independent visual review remains
7.7/10: small twigs register, but the foreground is still sparse. Street and
vehicle materials improve modestly; the original forest views remain 7.25.

v25 passes 83 scoped tests and 24 native views; independent review is 7.75/10.
Street, residential and works reach 8/10, while forest floor remains 7.25 and
headland 7.0. Smaller masonry earns a real scale gain, but closed noise contours
on the cliff are rejected and the forest shoulder still looks like a planted
row of exposed stems. One low vegetation
community deliberately occupies unused trail shoulders while full plant crowns
and wind bounds retain a three-metre central route. All 1,508 obstacle records,
512 trees and 1,853 original non-city plants exactly match v24. Total plants,
74 bins, three geometries and two materials remain unchanged. Actual cliff bed
edges replace under-sampled ramps; weathering consumes the same four geometric
causes. Normalized byte packing bounds their error by 1/510 and saves 725,256
bytes against float attributes. Final cliff cost is 21,214 triangles and two
draws, with 296,400 additional attribute bytes against v24. Brick courses now
use 225-by-75 mm common-brick dimensions with lime mortar; normal-only ocean
ripples increase without changing shared displaced waves or resource counts.

The next candidate removes the cliff's closed noise contours and adds a depot
handling apron, drainage and service hoist plus a sheltered dispatch frontage.
The return camera faces those compounds; Customs is behind it. Added equipment
borrows the original box and four material slots, using 1,200 triangles and
11 bounded submissions. No new collision records, textures or lights occur.
Two scoped tests verify the original through-routes and borrowed ownership.
New native evidence is required before claiming a visual improvement.

v26 passes 85 scoped tests and 24 native views. Independent visual review is
7.8/10 (7.8125 mean), with forest-floor views at 7.5 and the return crossing at
7.25. The handling equipment and fuller shrub bases help, but broad uniform
ground remains a visible weakness. These scores do not satisfy the requested
8.5 acceptance threshold.

v27 couples all three rigid boat assemblies to the same analytic water field
and render time. Three native sampled phases verify immersion, transformed
normals, fixed quay anchors and unchanged geometry uploads. Continuous motion
quality and hydrodynamics are not established by those still frames. Focused
boat review reaches 7.75; the previous full-world verdict remains applicable.
Exact ink vertex indexing saves 25,970,076 attribute/index bytes while preserving
native pixels in ten gates. One construction sample costs roughly 810 ms more;
no frame-rate gain is claimed.

v28 passes 91 scoped tests and 24 native views. Folded cliff beds add actual
undercuts and fallen-foot slab relief. Bank and shore attributes grow by
538,080 bytes, with original placement/collision records preserved. Raw forest
views expose a rejected square-edged ground-bed treatment despite passing
mechanical tests. Its replacement must clip habitat boundaries and blend into
the exact underlying ground. The latest density request authorizes purposeful
new plant and town-detail communities; previous constant population totals were
implementation safeguards, not a requirement to keep the world sparse.
Independent v28 review confirms that regression: the equal-weight score drops
to 7.5, with forest floor 6.5 and its unshadowed diagnostic 6.25. Cliff shape
improves to 7.5, but the return crossing remains 7.25. The ground-bed repair is
required before any added density can earn visual credit.

The next density candidate adds twelve address-specific town communities:
raised gardens with trellises, timber stacks, cable reels, supported shop
displays and cafe seating. It uses 5,256 triangles across nineteen spatial
bins, two shared owned materials and two owned primitives, with no new maps
or lights. Twelve matching collision proxies are appended while all 1,508
previous obstacles remain unchanged. Original doorway, carriageway and
basement-return routes pass CPU checks. The dispatch awning is also corrected
to the uniformly fitted rendered facade rather than the larger collision lot.
These candidates still require fresh native visual evidence.

v29 CPU verification passes 96 coordinated checks plus nine checks covering
the changed earlier density suite. The build and fifty source/runtime hash
comparisons pass. Forest growth adds 569 low tufts and 112 shrubs across
thirteen habitats, retaining all 2,433 earlier plants and 512 trees. Actual
plant cost becomes 658,329 all-visible triangles across 76 bins, using the same
three geometries and two materials. Additional instance buffers cost 51,756
bytes. Repaired banks use 45,438 triangles and 8,178,840 attribute bytes,
12,060 bytes fewer than the rejected v28 beds. Native verification passes all
27 views with zero runtime/HTTP errors, unchanged frozen input and owned browser
and server cleanup. The original unsteered return walk covers 15.98 metres at
100 health. Added gardens are visibly too geometric and cable reels lack
construction detail; those are pending artistic revisions, not accepted craft.
Independent v29 review gives 7.75/10: forest plate repair is accepted, while
garden and reel supplements receive 6.25 and 6.75 respectively. Original return
walk remains 7.25. Population growth alone earns no map-wide quality claim.

v30 passes 109 coordinated checks, builds successfully and passes 29 native
views with 51 frozen runtime hashes and no runtime/HTTP errors. Gardens now
have stems and folded leaves; reels expose board flanges, hubs and wound cable.
Netmakers and Depot work areas append two collision proxies while all 1,520
earlier obstacle records remain unchanged. Fourteen town communities use
38,096 triangles and 28 bins. All 3,114 plants remain in place; folded grass
costs 801,132 all-visible triangles across the same 76 bins. Local cliff columns
and matching semantic bed-edge connections use 40,694 triangles and two draws.
Resource disposal and route gates pass. Stationary native timings are slower
than v29 despite modest draw/triangle increments and zero forest uploads;
paired measurement is required before attributing this to a particular change.
Independent v30 review gives 7.875/10 (7.9 rounded): composition 7.75,
construction 8.0, ecology 7.75 and island integration 8.0. Garden and reel
construction improve, but original forest-floor and headland views remain
7.5; the ordinary basement-return walk also remains 7.5. Broad rounded cliff
tiers, oversized gold needle litter and weak connections between the working
frontages and crossing still prevent the requested 8.5 acceptance.

v31 passes 127 coordinated checks and builds successfully. Cars gain tapered
bodies, actual wheel arches and independently constructed glazing; fishing
boats gain raked recessed cabin windows, shaped roofs, a bow windlass and
stern pots. Maritime geometry becomes 37,202 triangles across the same nine
material submissions, with no additional maps, uniforms or rendering passes.
The completed v31 native run passes 29 views and 53 frozen hashes, including
the basement round trip. Independent review gives 7.8125/10; the redesigned
car windshield is partly occluded by its opaque body shell and requires repair.

The completed coastal obstacle array is now explicitly registered and frozen
after the basement is attached. An 8-metre broadphase preserves exact circle
and obstacle authority, original obstacle order and all record identities.
Mutable legacy courses and replaced arrays retain the linear path. Default
measurement counters remain disabled. The index has 2,912 bucket slots,
1,910 references and 12,176 bytes of reusable query scratch. Actual walking
queries reduce narrow obstacle visits from 26,503,478 to 12,685 (99.95% fewer),
with full simulation-state parity over 240 moving and jumping ticks. The
coordinated CPU-only empty-enemy walking benchmark reports median tick cost
6.655 to 0.955 ms; concurrent CPU tests limit its timing interpretation. This
is not a renderer, GPU, combat, mobile or gameplay-FPS result and does not
explain the separate v30 paused-render slowdown.

Private native command-cache experiments are rejected for production. A cold
build into an alternate 384-by-256 render target changes 2,976 raw channels
(maximum delta 108), despite identical GPU submissions and triangle counts.
Earlier fixed-view agreement and a small stationary CPU benefit do not override
that correctness failure. Forced-shadow and disposal gates were not completed.
Existing forest caching and atlas sampling guards remain the verified changes.

v32 passes 116 coordinated tests, builds, and passes 30 native views with 53
frozen runtime hashes. The car windshield occlusion and oversized gold forest
litter are repaired. Maritime geometry uses 37,778 triangles and nine material
submissions. The new windward heath brings the retained plant population to
3,895, alongside 512 trees. Independent review gives 7.9375/10: composition
7.75, materials 8, ecology 8 and integration 8. Original required views average
7.875. The additional heath view scores 6.75 because its plant communities
sit on featureless flat ground. Central cliff shelves and diagrammatic cargo
wear remain unresolved. This is below the requested acceptance threshold.

The completed v29/v30 controlled comparison passes all 16 alternating blocks
with exact fixed camera signatures and zero forest uploads. Overview median
CPU submission cost rises from 23.7 to 25.6 ms and fenced wall time from 42.9
to 45.6 ms. The large earlier woodland slowdown does not reproduce: pooled
medians are 10.9/20.4 versus 10.8/20.9 ms. Different held-arm geometry and
program populations prevent a clean isolated map-cost conclusion for woodland.
Two resident worlds differ from ordinary single-world play. These results are
paused renderer measurements, not gameplay FPS or GPU timestamp measurements.
The owned browser and servers close successfully. Raw evidence and limitations
are preserved in output/island-paired-v29-v30-findings.md.

v33 is an unaccepted working pass. It adds authoritative coastal dune and peat
relief, a central cliff fracture, twelve addressed parked cars and rain-varied
cargo wear. All 52 coordinated checks pass and the build succeeds. The new
eight terrain chunks add 15,360 triangles while borrowing the same material
and two atlas maps. All 3,895 plant and 512 tree records remain identical apart
from authoritative ground Y; 23,989 inland height samples remain exact. The
actual fleet uses 77,458 triangles and nine draws/materials, with 7,668,588 bytes
of geometry buffers and no geometry uploads per update. Car clearance and
1,534-obstacle simulation parity pass. The cliff uses 41,180 triangles and two
draws. All 54 source/snapshot hashes match before and after native capture.
The completed native run passes all 30 views without runtime or HTTP failures,
including the real basement round trip and 15.978 metres of unsteered return
walking at 100 health. Its owned browser and server close. Independent review
gives 7.875/10: composition 7.5, materials/ecology/integration 8 each. The close
heath improves to 7.25, but a sharply rectangular front-terrain material seam
reduces the original overview to 7.5. Original required views average 7.8542.
Repeated central cliff ribs and even cargo-wear bands remain. Additional source
edits now belong to a separate v34 experiment and receive no credit for these
frozen v33 views.

v34 is a separate, unaccepted polish experiment. Root communities follow actual
footing slopes: uphill litter, root-aligned exposed mineral and sheltered lower
moss. Existing contour beds remain 45,438 triangles in 43 bins with no added
maps or geometry. Coastal mineral/heath tongues, one lee hauling cove and
two storm-wrack pockets follow existing shore stations. A grounded old cradle,
four split timbers and 37 rooted grass tufts add 1,104 triangles in three
bounded meshes borrowing the existing coastal material. Total shore geometry
is 42,284 triangles across five draws. Central bearing faces change dip and
width while preserving the accepted fracture planes. Front terrain now blends
atlas roles and turf across an uneven ecological edge, and returns to the
existing inland material at z120. Vehicle glazing uses a darker ground/sky
hemisphere and rougher salt-film response. Cargo deposits concentrate at real
turns and stops and wash out at the two constructed drains; route and wheel
authority remain intact. Those deposits add local fragment arithmetic inside
the existing port-only shader branch. Forty coordinated integration tests pass,
the build succeeds, and all 30 native views pass with 54 unchanged snapshot
hashes. Basement round-trip health and 15.978 metres of unsteered return walking
are retained; the owned browser/server close. Independent art review is pending.
Paused renderer medians are substantially slower than v33: overview CPU/wall
60.3/90.2 ms, works 32.3/52.1, street 31.9/51.5 and woodland 31.9/52.7.
Draw counts are 1,651/618/828/244 respectively, with zero forest uploads.
These unpaired results establish a slower capture, not its cause or live FPS.
The material revisions are not accepted as a performance improvement.
Complete inventories of both 607-file snapshots identify two additional changed
inputs outside the map hash manifest: the actively loaded fps-arms-v5.glb and
its manifest. The new asset contains 24,616 more triangles; its four embedded
PNG payloads remain identical. This establishes a content confound, while the
large realized texture/program-accounting reductions remain unexplained.
The v3 hash in the old fixture does not pin the actively loaded v5 asset.
New captures explicitly include the active loader, v5 asset and manifest.
No unrelated arms production source or asset is changed by this world task.

v35 is an unaccepted working pass aimed at stronger spatial relationships.
One existing industrial pair gains a low repair canopy, an open receiving court
with carried overhead truss and a higher hall loading threshold. Five focused
tests pass; the kit adds 780 triangles and one draw while retaining the original
14 community colliders, doors and routes. The eastern grove gains a sheltered
connection to the Cape Lodges backcourt. Twelve young trees and 308 low plants
are appended; exact prior authoring and collision/clearance checks are pending
completion. Ground roles and tint consume the same sheltered-habitat field,
leaving the adjacent exposed gap and actual road/walking centre clear. New
native supplements retain all original views. No visual credit is earned yet.

The completed v34 independent review is 7.9375/10; overview, original forest
floor, outer forest coast and headland remain below the original-view gate.
Vehicle glazing and broad cargo wear bands are accepted visual improvements.

The frozen v35 corridor retains the original 512 trees and 3,895 plants except
for explicitly tested local re-grounding at one existing root footing. Its
new shoulder rises 0.52 m and lee hollow falls 0.24 m; one tree and 48 plants
receive matching Y coordinates. IDs, XZ, species and scales are preserved.
The full three-metre trail and its mesh-support padding retain exact heights.
The footing adds no geometry, draws, materials or maps. The corridor appends
12 trees and 308 plants, using the existing templates and vegetation pools.
The headland repair now intersects the original camera's visible face with
unequal planar orientations. Shore geometry is 42,282 triangles across five
draws. Twenty-two coordinated integration checks pass, including terrain,
industrial court, shoreline geometry and collision simulation parity with
all 1,546 obstacles.

Frozen v35 native inspection passes all 32 views with 59 source hashes,
including the active arms loader/asset/manifest and new map modules. Hashes
remain unchanged after capture; runtime and HTTP errors are zero, and the
owned browser/server close. Actual terrain probes measure +0.52/-0.239623 m
with zero change along the protected path. The dungeon arrival, return and
return walk are retained. Independent visual acceptance remains pending.
Paused CPU/wall medians are overview 52.1/76.3 ms, works 14.1/27.1,
street 21.6/37.1 and woodland 10.8/21.0, with zero stationary forest uploads.
These are unpaired captures, not a proven performance improvement or live FPS.

Independent v35 review remains 7.9375/10. The original headland improves to
8.0; overview, forest floor and outer forest coast remain 7.75. The new court
supplement is obstructed by a workshop corner, so it earns no claimed benefit;
its next camera follows the actual open court axis. The grove supplement still
exposes a flat town slab beyond native terrain. A grounded extension is under
development, with no visual acceptance yet.

The private v33/v34 controlled comparison closes cleanly after rejecting its
untimed gate. A confirmed UUID-suffix naming flaw paired unrelated common
meshes; normalizing only those generated suffixes restores exact common mesh
and texture matching. An unexplained 12-stage program difference remains.
No timing blocks ran. Shader ownership needs attribution before timing.

The combined v36/v37 working pass is frozen for native review. A single
640-triangle native terrain chunk replaces the flat slab at the grove court;
its sheltered bank and negative hollow share the movement/ray height field.
Three court trees and 101 court plants are re-grounded; no original v34
placements are affected by this court relief. The original floor's existing
footing height stays exact, while its mineral role moves to a convex flank
visible ahead of the tree and damp moss extends around the existing hollow.
Terrain totals 63 chunks/106,112 triangles with the same material and atlas.

Two unequal coastal canopy cohorts append 30 trees and 200 low plants. Actual
overview forest cost rises 80,862 triangles with zero additional forest draws;
plants add 31,536 triangles within the existing 80 bins. Total population is
554 trees/4,403 plants. All prior authoring is preserved except the explicitly
verified ground Y adjustments. Existing paths, doors and exposed gaps remain.
Eight transect/regression checks pass. Court and footing checks pass, and
11 building/graphic integration checks pass. Native visual credit is pending.

Immutable merged building leaves now initialize their local matrices once.
Their parent/world propagation remains automatic. The lightweight comparison
removes 240 repeated compositions over 120 two-leaf frames while preserving
exact transforms, bounds, culling, shadows and disposal. No FPS gain is claimed;
the native whole-game work counter remains pending.

Frozen v37 native review passes 32 views and 62 manifest hashes; all 611
snapshot files rehash unchanged. Runtime/HTTP errors are zero, owned browser
and server close, and the basement round trip retains health 100 and the
15.977757 m return walk. The actual native batch counter finds 505 immutable
leaves: automatic mode recomposes 505 local matrices, optimized mode zero,
with exact world-matrix equality. This verifies removed work, not its timing
contribution. Paused CPU/wall medians are overview 31.2/52.6 ms, works
20.8/34.6, street 20.9/35.6 and woodland 11.1/20.9. Forest uploads stay zero.
Unpaired timings do not establish improvement. Independent art rating is pending.

Independent v37 review is 8.0/10: composition 7.75, materials 8.0,
ecology 8.25 and integration 8.0. The original forest floor reaches 8.0;
overview and outer coast remain 7.75. Grove relief and the unobstructed
industrial truss are verified gains. The 8.5 target is still unmet.

The untimed v33/v34 metadata diagnostic accounts the twelve additional stages
as retained actor/shadow shaders undrawn in the sampled woodland frame.
Current common submissions and textures match. Historical causal owner links
are insufficient, so the strict timing gate remains rejected; no timed blocks
or FPS claims follow from that diagnostic. Owned processes close cleanly.

The next unaccepted pass gives East Works 56 a supported cutting bench and
wall-carried canopy beside its existing stockpile. It adds 41 borrowed boxes,
492 triangles and one collider; total town detail remains within 40,000
triangles and 30 draws (39,612 triangles/29 draws). Original 534 parts and
14 colliders are preserved exactly. Nine focused geometry/collision/resource
checks pass; eight paving/wear checks pass. Contact pressure and a short broken
board-drag trace use the existing concrete graph, adding no maps or draws.
The frozen v38 ground pass partitions actual canopy shelter, damp hollows,
exposed heath and mineral soil using the existing terrain atlas. Three unequal
wash ribs follow the outer bank toward its toe. All 554 tree and 4,403 plant
records, including their ground heights, remain exact against v37. Terrain
geometry, materials, maps and vegetation pools are unchanged.

Frozen v38 native inspection passes all 32 views with 64 manifest hashes;
all 613 snapshot files rehash unchanged. Runtime/HTTP errors are zero and
owned browser/server cleanup succeeds. The basement round trip retains
health 100 and the 15.977757 m return walk. The building matrix probe again
verifies 505 automatic compositions versus zero with exact world matrices.
Town detail totals 575 parts, 39,612 triangles, 29 draws and 15 colliders.
Paused CPU/wall medians are overview 25.5/44.3 ms, works 14.0/26.4,
street 17.8/32.1 and woodland 10.1/19.9; stationary forest uploads remain
zero. These unpaired measurements establish neither an improvement nor live
FPS. Added material arithmetic has a real cost despite unchanged draw counts.
Independent v38 art review is 8.0625/10: composition 7.75, materials 8.0,
ecology 8.25 and integration 8.25. The timber operation visibly closes the
stockpile-only objection, and heath shelter/exposure improves locally.
Original overview and outer coast remain 7.75, below their minimum gate.
Precise pressure/drag wear is not separately verified at the fixed camera.
The 8.5 target remains unmet.

A subsequent construction-only cache reduces hierarchy height queries from
45,315 to 9,174 for the actual chunk traversal. Two bounded Float64 lattices
use 82,638 temporary bytes, released immediately after mesh authoring. All
114 generated mesh attribute/index streams and bounds match frozen v38
exactly; five focused checks pass. This removes repeated startup work without
establishing an elapsed-time or gameplay FPS improvement.

The frozen v39 experiment adds one low directional slate bearing plane in
the existing windward terrain, bounded to x430–447/z68–93. Added height is
at most 0.65 m, with its mineral role derived from the same landform. The
full bent 2.8 m access corridor and triangle support, town/inland boundaries,
shoreline contact and original camera ground remain exact. All 554 trees
remain exact. Only four existing windward-heath grass records receive small
support-Y changes; every placement ID, XZ, species, scale and ordering remains
exact. Two focused batches pass 16 checks, including complete historical
record digests restored only for those four named Y exceptions. Resources
remain unchanged. Frozen v39 native capture passes all 32 views, with 65
manifest hashes and all 614 runtime files verified unchanged after capture.
Runtime/HTTP errors are zero and owned browser/server cleanup succeeds.
Native added relief measures 0.631876 m; protected access/boundary deltas
are zero, and 2,808 affected mesh vertices match ground authority within
5.92e-8 m. Native cache diagnostics confirm 45,315 requests/9,174 queries
and zero retained bytes. Independent v39 review remains 8.0625/10: the
bench chiefly grays the foreground without establishing a distinct bearing
plane. The experiment is removed from active source; its immutable evidence
is retained. The proven construction cache remains. A proposed basement
drainage threshold also fails its preflight visibility gate and is not built.

The frozen v40 pass treats the existing north shelf crest with an irregular
mineral opening and darker inward turf. Only 378 existing shoreline color
vertices change; all geometry, protected colors, tide/foam, vegetation and
resources remain exact. The CPU scene gate supports the original outer-coast
view, but canopy hides almost all of it in the overview. This is explicitly
an outer-coast experiment and earns no overview claim.

A pallet-carried cable splice jig links the two existing repair reels through
supported leads into a compression sleeve. It adds 15 borrowed parts/208
triangles within the existing proxy; all previous 575 parts remain exact.
Town totals 590 parts, 39,820 triangles, 29 draws and 15 colliders. Thirteen
focused checks pass, including actual support, endpoints and door approaches.
Wood now uses each piece's actual dimensions and axis for filtered grain and
cut ends, coupling color and roughness without custom micro-normals. Six
focused checks pass. It adds 6,400 static attribute bytes, no maps or draws.

The Customs gallery carries a light roof from verified opaque fitted wall
members. Its 228 triangles form three merged borrowed-material meshes, with
one roof shadow caster. Four construction/lifecycle checks pass, including
the preserved entrance and clear return corridor. Immediate-return visibility
passes its CPU gate; the gallery is behind the return-walk camera and earns
no feature-visibility claim there. Native redundant-roof risk stays open.
Frozen v40 native inspection passes all 32 views with 67 manifest hashes;
all 616 runtime files rehash unchanged. Runtime/HTTP errors are zero and owned
browser/server cleanup succeeds. The actual wood graph retains all 283
instances/6,400 static bytes, with no attribute on the borrowed box. Gallery
diagnostics confirm three color submissions and one shadow caster. Town
remains 39,820 triangles/29 draws. Paused CPU/wall medians are overview
25.4/44.0 ms, works 13.3/26.1, street 18.1/31.9 and woodland 9.8/19.5;
stationary forest uploads remain zero. These unpaired measurements prove no
timing improvement or gameplay FPS. Independent v40 visual review scores
8.125/10: composition 8, construction 8, ecology 8.25, integration 8.25.
The original outer coast reaches 8 and the cable repair pocket reaches 8.
Immediate return improves to 7.75, while competing Customs shelters remain
unresolved. The original overview remains 7.75; the 8.5 target is unmet.

The v41 terrain pass adds one unequal coast-parallel bank and two lower lee
basins using the existing front mesh. Its added height ranges from -0.45 to
4.2 m, with a sampled maximum grade of 0.670. Exactly 56 trees and 1,075
plants receive explicitly listed support-Y updates; every other authoring
field and ordering matches frozen v40. Four ridge checks pass, including
the full bent access, actual ground/eye/ray authority and resource lifecycle.
Terrain remains 63 chunks/106,112 triangles, with the same materials, maps
and vegetation pools. CPU projection establishes some visible raised
samples in the original overview, without proving continuous visibility or
visual merit. Frozen v41 native passes 35 views (the unchanged original 32
plus three wood-distance supplements), with 68 manifest hashes and all 617
runtime files verified unchanged. Runtime/HTTP errors are zero and owned
browser/server cleanup succeeds. Actual shoulders reach 5.412 and 3.943 m,
lee basins -0.423 and -0.250 m, while the protected original heath access
stays exact. Draws/triangles match v40 in all four measured frames, with zero
stationary forest uploads. Unpaired paused CPU/wall medians are overview
25.1/43.2 ms, works 13.7/25.9, street 17.7/31.2 and woodland 10.1/20.3;
these establish no timing improvement or gameplay FPS. Independent visual
review remains at 8.125/10. Heath reaches 8 through a visibly higher planted
shoulder, but the original overview remains 7.75 and the 8.5 target is unmet.
Close wood detail still needs rendered evidence. The next selected ecological
pass joins low ridge growth, sheltered roots and exposed bearing into a
connected coastal habitat while protecting the worn crossings.

Frozen v42 appends 1,200 low wide tussocks and 142 sheltered shrubs, using
one shared habitat field for placement and the existing ground roles. All
4,403 original plants and 554 trees remain exact, including support heights.
The two unequal grass bodies retain connected interiors, irregular fringes,
exposed mineral bearing and full crown/wind clearance around the crossings.
Final population is 5,745 plants, with the same 80 bins, three geometries and
two materials. Added all-visible geometry is 164,532 triangles and instance
storage is 101,992 bytes; there are no new textures, lights, shadows or
colliders. Focused habitat, historical authority, route, lifecycle and cache
checks pass. The candidate loop avoids copying the full prior plant list on
each attempt; exact ordered-check record parity is verified before the
separate density refinement. Two performance reviewers confirm the resource
scope; native costs and visual merit remain pending.

The v42 Customs candidate shortens the wall-carried roof projection from
6.64 to 4.24 m and thins the fascia from 0.44 to 0.22 m, recalculating its
actual rafters and diagonal supports. The old stair hut and mobile striped
stall remain intact. Four construction/lifecycle checks pass, with the same
228 triangles, three color submissions and one roof shadow caster. Native
review must decide whether reduced roof competition outweighs reduced
immediate-return enclosure. The next capture also uses the existing wood
ring debug uniform once to diagnose faint grain, restoring the ordinary
material in finally; this earns no automatic material or motion credit.

The first v42 native run stops on an inspection-counter error: selecting the
generic habitat-expansion flag also includes older plants. Runtime and HTTP
errors are zero and owned cleanup completes. The counter is corrected to the
explicit ridge IDs. Fresh v43 uses the identical 618-file production
inventory and passes all 37 captures with 69 manifest hashes; every file
rehashes unchanged. The complete dungeon round trip and return walk remain
accepted. Native confirms 5,745 plants/1,342 additions/80 bins, zero plant
shadow casters and unchanged static matrix/color versions across views.
Overview adds exactly 164,532 submitted triangles with unchanged draws;
the other three original measured frames retain their draw/triangle counts.
Native tracked attribute bytes rise by 359,656, with unchanged program,
texture and index bytes; this tracked ledger is distinct from the 101,992
CPU instance-array increment. Paused timing medians are globally slower,
including unchanged-geometry views; attribution remains unresolved and
does not establish gameplay FPS or a habitat-caused slowdown. The filtered
wood debug visibly confirms per-piece bands/cut rings and all five actual
submitted bins retain zero attribute increments. Ordinary grain contrast
remains faint. Independent v43 stays 8.125/10: the crest fringe is locally
visible, but original overview remains 7.75. The short Customs gallery loses
the earlier immediate-return enclosure, lowering that view to 7.5. That
candidate is rejected; the wide v41 gallery and its focused test are restored
byte-for-byte, with all four construction checks passing. Canonical dist is
rebuilt with the restored wide gallery.

Frozen v44 tests a stronger shared-cause latewood finish while retaining the
same dimensions, axes, seed parameters, frequency and unconditional
derivatives. Narrow latewood bands fade to their independently verified
cycle mean; color and roughness share the cause, with zero added normal
perturbation or rendering resources. Four focused checks pass. Its 37-view
native pass is clean with 69 hashes/all 618 files unchanged, but still
contains the rejected short gallery: later restoration earns no v44 credit.
Independent v44 remains 8.125/10, with original overview 7.75. Broad darker
planter/end/foot values are visible locally, but ordinary grain and cut-end
hierarchy remain faint. No new binding bug or still-image aliasing regression
is established, and continuous-motion filtering remains unverified. Further
tiny wood iterations are held in favor of broader architecture/geography.

Output label v45 is one performance-only recheck of the unchanged immutable
v41 runtime, not a new map revision. It passes the same first 20 captures and
four ordered measured poses with all 68 source hashes exact and 617 files
unchanged. It reproduces slower paused medians on the old map: CPU
36/17.7/24.2/12.9 ms and fenced wall 60.2/36.9/40.9/24.3 ms. Draws/triangles
remain identical. This establishes a changed historical timing condition,
not zero cost for the new habitat, paired causal attribution or gameplay FPS.
The control is imperfect: it retains 12 additional native programs and
147,441 program bytes in each view despite identical source and poses.
Their identity/compilation provenance is unresolved; every other measured
memory field matches the historical baseline. Sole environment causality
is therefore not established, and no further benchmark loop is performed.
The tracked attribute-byte delta is also resolved: four native matrix-column
wrappers each report the same backing array, while the backend allocates one
shared matrix buffer. Unique added matrix/RGB payload is 101,992 bytes.

A further small coastal-toe proposal is killed before authoring. Its exact
frozen front/shore surfaces can touch only 1,402 overview pixels before any
occlusion, below the required 1,500 visible support-pixel gate. No field
enlargement, camera change, new planting or shoreline rewrite follows.

Frozen v46 adds three recessed harbor service bays in actual unused solid
frontage bands. Two Power Cut galleries meet the existing 5.200035 m stair
landings through carried L-shaped decks; the dispatch gallery meets the real
5.269474 m upper floor. One placement-owned balcony rail instance is removed
to create an actual opening. Its other 39 matrices and the original 40-rail
template remain exact. Upper windows, factory templates, ground shells,
stair voids, the eight-metre Power Cut passage and all coastal entrances stay
intact. No disconnected overhead bridge is added. These galleries are
rendered service architecture; new playable upper-floor traversal is not
established by unchanged sealed-lot collision authority.

Two focused checks pass, including actual opaque bearings, landing overlap,
opening/headroom, canonical routes and transformed-parent bounds. The pass
adds 100 borrowed box instances/1,200 triangles, three color submissions and
three shadow-casting meshes, with 8,192 matrix bytes and three owned geometry
views. It adds no primitive geometry, materials, maps or lights. The removed
rail instance submits 204 fewer triangles. Three static leaf matrices are
authored once; parent/world updates remain automatic. Fixed-view CPU point
gates indicate return-view support for the Power bays and overview support
for all three bays; the dispatch bay is not credited as a return-view gain.
Native rendering passes in capture v48 of the unchanged frozen v46 runtime:
37 views, no runtime/HTTP errors, health 100 through the basement round trip,
15.977757 m unsteered return walk, browser/server cleanup complete. All 619
runtime files rehash unchanged. The actual visible resource delta is three
draws and 996 triangles in overview, street and heath; works/woodland counts
stay exact. Paused CPU/queue timing is variable and does not establish FPS.
V46's return settle stalled; v47 exited with a V8 Zone memory failure.
Verified orphan QA process cleanup preceded the successful v48 repeat;
failure causes remain unresolved. See output/island-v46-native-recovery.md.
Independent review of all 37 v48 captures gives authored v46 8.1875/10:
composition 8, construction 8.25, ecology 8.25, integration 8.25. Depot
apron and both returns improve; the original overview stays 7.75 and the
other eleven originals stay 8. The requested 8.5 and original-view gate
remain unmet. See output/island-v46-art-review.md. The new southern
shoreline candidate was tested separately as v49 and rejected.

V49's geometry-only southern transect passed three construction tests and
37 native acceptance views with unchanged resource families/counts and
exact protected rim/high crest. The unchanged headland view nevertheless
read as one swollen green mound with a continuous pale band, rather than
the intended unequal cove/bearing/lee sequence. It receives no whole-map
score. Its footprint diagnosis is threshold-sensitive and wall-clock
phase parity is unverified; numeric footprint cannot rescue artistic
rejection. The shoreline source is restored byte-exact to frozen v46 and
the stable runtime rebuilt. Candidate tests/captures remain archived in
output; see island-v49-art-review.md and island-v49-native-pixelgate.md.

Replacement v50 used absolute subtractive sections, opening a sea-connected
notch below -1.4 m with unequal remaining shoulders. Three construction tests
and 37 native captures (v52) pass. It uses five draws/42,210 triangles and
removes three genuinely submerged decorative tufts. The unchanged-view form
test provisionally accepts the water negative space and unequal levels,
with a rigid finger-side risk. However, its predeclared broader footprint
gate fails at all tested RGB thresholds: 3/255 gives 5,456 supported changed
pixels and 3,454 outside the old crest; 5/255 gives 4,740/3,049. No whole-map
score is assigned. Fixed-time v51/v52 captures match camera quaternion/pose,
FOV and 5000 ms render phase, but actor/history determinism is not proved.
The candidate is removed and shoreline restored byte-exact to v46; tests
remain in output/island-v50-candidate-test.archive.mjs. This southern window
is abandoned as the next overview intervention. No enlargement/detail or
camera rescue follows. Accepted score remains 8.1875 from authored v46.

The first shared-daylight profile (authored v53, capture v54) passes native
QA but fails the unchanged street building-plane footprint requirement:
1,713 changed pixels against 3,000 required. Its whole-world score is not
updated. One corrective profile, v56, changes only the source direction to
[45,88,-45], separating adjoining visible planes in opposed required views.
The other 619 runtime files match v53. Seven focused checks pass.

Native v57 loses its WebGPU device on the basement return and remains a
failed run; cause is unresolved. Exact-snapshot repeat v58 passes all 37
views, basement down/up and return walk, with no console/HTTP errors.
Cleanup completes and all 620 frozen files rehash unchanged. All unchanged
daylight footprint, darkness and entry-contrast gates pass against v55.
Street building-plane support is 11,383 pixels; overview scene support is
57,355, including 7,394 forest/terrain pixels. These metrics do not assign
art points. Full art review is recorded separately in output.

Existing light maps retain their owners, dimensions and cached-update
guards. Native submissions match in 36/37 views; the street and journey
history differences are documented without causal or FPS claims. See
output/island-v56-native-validation.md and the performance guard.

The stable critic inspected all 37 final v58 images and accepts v56's
daylight correction. All 12 original views now reach at least 8.0; the
equal-four dimensions are 8.25 / 8.50 / 8.50 / 8.25, giving 8.375/10.
The 8.5 goal remains unmet. The original overview improves to 8.0 for mass
hierarchy, while settlement/coast composition, Customs cover hierarchy
and secondary ground contacts remain priorities. No new confirmed boat
or glazing regression is found. See output/island-v56-art-review.md.

The coarse v59 tidal repair yard is rejected before detail. Its original
overview reads as a bright rectangular platform with a small shed, adding
simple shapes rather than a convincing working coast. Native v60 stops
after that view because the new QA return fixture discards arrival support;
the corrected fixture carries the outward actor into its return. This does
not grant a native pass. All candidate hunks are removed, immutable v59 and
tests remain archived, and accepted v56 is rebuilt. No platform expansion,
taller roof, moved camera or ornament rescue follows. Score stays 8.375.

V61 lowers only the Customs market-canopy placement from 3.2 to 2.65 m.
Its existing uniform-fit loader retains the same model/resources/service
contents and conservative collision footprint. Wide gallery and portal are
unchanged. V62 fails with disk-full screenshot writing; verified snapshot
deduplication recovers capacity while preserving content and evidence.
Exact repeat v63 passes all 37 native views and the round trip. The critic
keeps the clearer secondary-stall/primary-stair hierarchy, entrance
7.50 to 7.75, and finds no new collateral regression. Equal-four whole-world
score remains 8.375; the original minimum still passes 12/12. See
output/island-v61-art-review.md and island-v61-native-validation.md.

V64 exposes the existing timber workstation's contact/handling field:
square foot-edge skirts and an interrupted stock-to-bench trace, restricted
to the actual horizontal paving heights. Geometry/collision and resource
ownership remain unchanged; the material graph adds bounded arithmetic.
Eight focused checks and full native v65 pass. The unchanged near/shift
gate records 12,873/13,423 eligible paving changes, with exact matching
poses and phase. The critic keeps the local grounding gain across all 37
reviewed views, retaining a crisp-border/stripe risk. Four timber
supplements improve to 8.25, but originals and the equal-four 8.375 score
remain unchanged. The 8.5 goal stays open. See output/island-v64-art-review.md
and island-v64-native-validation.md; pixel support is not art points.

V66 tested a creation-time taper of existing middle-crown conifer spray
widths. Three focused invariants and native v67's 37 views/round trip pass;
all submitted draw/triangle counts match v65. The stable critic rejects
the change because preserved shelter and subtle thinning do not produce
clearer close branch tiers. Active forest source is restored byte-exact
to v64; immutable v66 and its archived test preserve the experiment.
The existing general forest suite's stale 528-tree cap also fails against
frozen v64's already accepted 554-tree population; it was left unchanged.
See output/island-v66-art-review.md and island-v66-native-validation.md.

The four-lot eastern receiving-court proposal was closed before runtime
authoring. Its conservative projected overview ceiling left only 223
pixels above its necessary gate before occlusion or unchanged surfaces.
That is a practical visibility-risk decision, not proof of impossibility.
No trees, lots or terrain were moved for that proposal.

V68 keeps one roof construction finish correction. Existing zinc spans
now use their actual downhill sheet direction; residential hip/mansard
courses turn with each face, with restrained eave and monitor-seat
weathering. All old geometry, colliders, bounds and ink remain exact;
the 505 spatial building batches remain unchanged. Physical coordinates
add 939,312 retained source/merged/dressing bytes and shader work.
Thirty-six scoped checks and native v69's full 37-view round trip pass.
Read-only emitted WGSL confirms derivatives precede covering-type branches;
the independent guard makes no FPS claim. The stable critic keeps the
local gain: works rooflines and residential depth rise to 8.50. The
whole-world equal-four score remains 8.375; the requested 8.5 stays open.
See output/island-v68-art-review.md, island-v68-native-validation.md and
island-v68-roof-independent-guard.md.
