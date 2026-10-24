# Lived-in rooms and rendering budgets — 23 October 2026

Household arrangements now use the existing independent seed hash and separate wing arrangements. Family flats alternate between lounge-led and dining-led plans; whole table/chair groups rotate together and bedroom doors alternate between inner and window-side approaches. Supported low tables give sofas a purpose: portable radio, an island/bridge/city board game, or reading. Breakfast and mending states retain their surfaces. Gardeners' developed, newly planted and partially empty pots correspond to journal planting marks. These are authored recipes, rather than unique architecture for every address.

One café arrangement places the communal group in a rear side bay and moves its reading bench/table ahead of service. Counter standing space is explicit; preparation and window banquettes retain their anchors. Ferry clerk desks vary between an active terminal, handover folio and closed equipment. Passenger cases occupy actual waiting benches. Office differences are activity states within the existing ticket-hall layout.

The angular instanced kit, restrained palette, grain and N64 presentation remain. No dependencies, downloaded assets, test files or Unity files were added or edited.

## Rendering changes

Static world/scenery roots bake their world matrices once. Moving actors, camera, boat, birds, coastal animation and lighthouse remain outside that ownership; explicit world-matrix queries remain available. Hidden survivor/viewmodel rigs skip automatic matrix walks but honour forced anatomy/pose queries. Enemy sleeping remains owned by actors.js.

Each building's complete interior belongs to one 90m room tile. Shapes and lettering in that tile share conservative bounds and a 96m visibility budget plus radius. Narrow FOV expands this up to 2.4×, preserving scoped detail. Exterior shells and collision stay on their existing paths. Whole enemy rigs now use a generous 5.5m frustum envelope; AI, attacks, co-op coordinates and animation still advance offscreen within their simulation range. The envelope also retains nearby shadow casters under the fixed sun direction.

The 2048px directional shadow map refreshes at about 30Hz, or immediately after more than 12m horizontal camera displacement. Colour rendering continues each frame. Three retains the cached texture with its matching shadow matrix between refreshes.

## Measured result and remaining spikes

Matched production views used isolated Chromium at 1280×720, DPR 1 and the existing balanced picture. Before values are v42 submissions per frame; final values average 240 frames, including both cached and refreshed shadows. Counts include submitted colour/shadow work, not unique geometry. Interior budgeting alone reduced triangles by about 16–22%; the final combined changes reduce average submissions by about 36–45%, with 7–14% fewer calls.

| View | Before triangles/frame | Final mean triangles/frame | Final mean calls | Final p95 ms |
| --- | ---: | ---: | ---: | ---: |
| city-crossroads | 3,344,302 | 2,079,559 | 522 | 16.8 |
| city-street | 2,672,927 | 1,460,160 | 355 | 16.8 |
| family-entry | 3,311,722 | 1,903,386 | 449 | 16.8 |
| cafe-entry | 877,880 | 561,418 | 145 | 16.8 |

The final ordinary automated route completed 87/87 targets with no page errors or CPU profiling/screenshots during timing: 8,753 frame samples, median 16.7ms, p95 16.9ms, maximum 483.2ms and five frames above 100ms. The preceding v43 ordinary route also passed 87/87, with p95 33.3ms, maximum 833ms and 20 frames above 100ms. These are observed run comparisons, not proof that a single change caused every timing difference.

**Frame spikes are improved, not eliminated.** The final five gaps cluster in one roughly six-second gardener passage/bedroom segment (about x633–637, z26–37). Long-animation-frame data records substantial game-frame duration there; its precise subsystem owner remains unresolved. Earlier profiled and quiet runs varied, and some early scripted doorway routes were invalidated by steering/braking margins. Do not infer universal smoothness, blame screenshot capture, or certify other devices from these runs. Raw v43 profiled evidence and the v43 ordinary summary are retained alongside the final ordinary receipt.

## Verification and visual review

- All 15 targeted existing scavenging, craft and field-batch checks passed. Inline actor-envelope checks covered forward, behind, near-edge, distance, close range, camera turns and narrow FOV. No test files were created or modified.
- Clearance checks passed 5,208 entrance samples, 702 approaches across 114 businesses and 1,112 approaches across 64 residential plans, at 0.25m grid spacing and 0.42m body radius. Wall/contact checks covered 25,698 lining pieces and 256 mounted panels across 178 plans. Final walking reached all 87 targets with feet remaining on the expected floor.
- The runtime motion gate passed visible chase bone/mixer changes, attack, offscreen mixer advancement, immediate visible turn/reentry, normal/aimed edge retention, hiding beyond 150m, forced hidden matrix refresh and local-body hide/show. Developer flight movement also passed. Six combat frames are visual samples, not continuous-motion certification.
- Two read-only visual reviewers found no concrete new blocker in the sampled rooms, combat frames and opening views. Sofa activities, correlated gardening marks, photographer work, café seating and their supports remain coherent. Gardener foliage still reads somewhat like miniature conifers. Long shell proportions and unreviewed room variants remain limitations.
- Continuous camera approaches sampled 60° and 28° FOV. Building-footprint ray checks found a clear 120m hospital-door approach and a clear 360m café approach at an oblique 75° angle. No orphaned sign or conspicuous missing support appears in the captured samples. The hospital does not cross the far cutoff; the oblique café reveals little interior depth. Unseen window angles and uninterrupted shadow cadence remain unverified. Two earlier occluded distant views are retained as counterevidence, not claimed as successful opening checks.
- Local and hosted builds completed; all 12 runtime modules match local dist, Sites public and the built client (36 comparisons), and all 12 public modules match source hashes. The lobby endpoint returned HTTP 200 with no waiting rooms. This does not certify a new multiplayer session.

An exploratory broad test glob also selected two archived browser launchers without their default Playwright resolution, plus unchanged fern/grass tests whose old batch/seed expectations fail. Those were outside this pass; the targeted current checks above pass. No unrelated foliage changes or test edits were made.

Evidence stays under output/lived-world-2026-10-23/, budget 100MiB / 96 files. The original user tab and repository-owned port 5200 server remain intact. The existing browser launcher uses the rebuilt local dist; no server restart was required.

## Publication

Published to the existing public Blackwater Site as version 44, source bfab1366ee063dfb2c6a016efd1a96c3c2f3019c, deployment appgdep_6adbf486cbb481918bc7cf267140e134 (succeeded). Play at https://jrod.download/blackwater/ or https://the-last-dead-blackwater.jrodonthebeat.chatgpt.site/.
