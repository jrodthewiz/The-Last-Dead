# The Last Dead: Low Tide — first playable chapter

## Creative contract
Blackwater was the last evacuation point. The ferry never left. Its radio now asks for voice confirmation from people listed as dead. The player finds their own name beneath Mara Venn's on Manifest 06.

The dead retain fragments of work and habit. Neighborhood infrastructure can exploit those habits, but restoring it also changes the risks of returning home. The first implemented example is the dock shift bell: power brings back the radio and attracts infected to Power Cut.

Keep the mystery specific and evidenced. Names, locations and documents must agree. Do not explain the supernatural rules in a tutorial. Future chapters should let a useful world change reveal something disturbing, rather than adding unrelated scares.

## Implemented chapter
1. Claim Netmakers through its existing marked entrance. Its radio establishes the checkpoint and provides repeatable rest.
2. Read Manifest 06 at Customs House.
3. Identify Mara Venn's covered remains and work tag in Cold Storage.
4. Recover the starter battery at Ferry Workshop and sealed diesel at Dock Dispatch, in either order.
5. Restore the dock circuit at Power Control. The interaction explicitly warns of the shift bell before committing.
6. Leave the control room. Three bell strikes over 24 outdoor simulation seconds feed the existing hearing/investigation system; resident infected move toward the circuit.
7. Return to the Netmakers radio for Mara's contradictory transmission. The chapter completes while the harbor stays playable.

Q interacts; B opens Equipment, Field Map and Journal. Documents remain readable after their timed HUD transmission disappears. Mission supplies have their own pouch and cannot be lost to a full scrap backpack. Collected battery/fuel props disappear; the control and radio indicators change when powered. Existing Thai Kit interiors, vehicles and street assets remain the setting.

Netmakers' supply bin stores up to 99 scrap. With scrap carried, Q deposits as much as fits; with an empty backpack, Q withdraws up to its capacity. Prompts state which action will occur. Scrap is conserved.

## Persistence and recovery
Versioned, whitelisted local storage saves chapter facts, equipment, fittings, pickup history, room-cache consumption and stash. It does not serialize live scene graphs, combat/input state or arbitrary player coordinates. Retry/resume restores a healthy player inside Netmakers and resets the truck and exterior encounter. A session-memory fallback retains the checkpoint if browser storage is blocked; the journal reports save failure. Before claiming Netmakers, there is no checkpoint. The existing harbor salvage mode remains available with `?district=harbor&harborMode=salvage` for regression comparisons.

The radio reveal is currently a written transmission, using the journal and HUD. No generated voice recording is claimed. The bell reuses the bundled bell sample through the game's audio bus.

## Boundaries and next iterations
This is one complete mission in the existing district, not the full survival game. There is no simulated tide access, day/night schedule, food spoilage, recruitable survivor AI or streamed world yet. Indoor spaces use the existing Q transitions; exterior infected are suspended while the player is inside. Vehicles remain useful transport rather than a mandatory distance counter. Existing weapon fittings remain the customization baseline.

Next, extend one consequence at a time: alternate safehouse power allocations; a neighboring residential block with two authored landmarks; daytime work routines; a tide-gated service route. Reuse the Thai Kit for ordinary structures, but author objectives, access, collision and encounter routes. Each expansion needs a playable round trip with a persistent result before adding more acreage.

## Engineering and verification
- `low-tide.js`: pure mission state, prerequisites, interaction edge handling, objective and bell events.
- `low-tide-save.js`: bounded save schema and checkpoint restore.
- `low-tide-visuals.js`: compact mission props on existing Thai Kit tables, status indicators and bell.
- Existing engine owns movement and combat; existing hearing owns investigation; the UI, backpack and navigation consume mission state.
- No physics dependency or external runtime service was added. Existing four-metre cells and room furniture proxies remain authoritative.
- Gameplay skill references read: gameplay-workflows, physics-engine-selection, new-game-definition-of-done. Develop-web-game client used with Windows module/executable resolution, Q/W mapping and fixture-ready wait adaptations. Desktop/controller remains project scope; physical controller testing is not claimed.

Evidence and measured limitations are appended after the browser checks.

### Verified results
- 65 focused mission, save/recovery, collision, route, inventory, vehicle, engine and infected-AI tests pass after the final edits.
- Production entrypoint browser journey passed all seven chapter interactions using real Q/W input plus the debug fixed-step clock; position fixtures moved between tested sites. Enemies were retained. Two residents were observed investigating the bell location. Journal contained all seven records. Forced death/retry restored health 100 inside Netmakers with chapter completion retained. No page or console errors. Report: `output/playwright/low-tide/report.json`.
- Production cold startup was 199,504 ms under headless SwiftShader. The under-five-second first-play guideline is not met in this environment; target-hardware performance remains unverified. No release-ready or target-FPS claim.
- Subsequent visual corrections (approach-facing props, fabric bag, journal/pause layering, instant objective/room route invalidation) passed the isolated real renderer/mission fixture. Seven scene views and four journal sizes (1280, 844, 390 and 320 pixels) pass without overflow or console errors. Report: `output/playwright/low-tide-final/report.json`.
- Adapted develop-web-game client verified a real Q claim and movement in the isolated fixture. An initial fixture-only favicon 404 was corrected; the final client run has no error artifact. Its fixture and Windows adapter are test tooling, excluded from the runtime build.
- Production build passes; no server restart or existing game-tab navigation was performed.
