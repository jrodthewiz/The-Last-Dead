# Blackwater — Three.js rewrite

The root `index.html` now launches a separate, cohesive single-player horror-survival game. Its runtime lives in `island/`; it does not import the old arena engine or its overlapping HUD layers. The previous browser entry remains at `/legacy.html`, and its source files, saves, tools, co-op and uncommitted changes are retained. This change does not touch the Unity project.

## The playable journey

Start at Mariner’s Rest with a field carbine, limited ammunition and two dressings. Explore Alder Village, the orchard ruins, Westlight Cape and Signal Hill. Find the keeper’s fuse to repair Westlight, climb the physical survey staircase to the hill transmitter, and start the hospital generator while remaining in its courtyard for 18 seconds. Restore all three stations in any order, then signal the ferry at East Docks. Generator noise draws nearby infected; leaving its courtyard cancels startup. Infected hear nearby shots, acquire visible players, navigate around obstacles with a bounded local path search, wind up before striking, recoil and collapse. Walls obstruct shots and movement. Health, ammunition, pickups and checkpoint recovery are real simulation state. The carbine has a separate trigger index and a support-hand magazine/bolt sequence, head-height hit damage, bounded impact particles and ejected cases. Trucks have engine audio, terrain pitch, steering lean, impact damage, noise attraction and an obstruction-aware chase camera.

The island is connected to Saint Orin by a 300-metre suspension bridge. Both on-foot and truck movement use the same deck height. The mainland has Old Town, the downtown skyline, Civic Square, Northpoint and East Docks. The deterministic world contains 248 buildings, 45 enterable furnished ground floors, more than 1,600 generated and planted trees, 90 supply caches, 30 infected, two drivable utility trucks, 32 parked cars and six abandoned cars along the bridge approach/span. Upper storeys are scenery. Parked cars, bridge wrecks, evacuation barricades, cargo, the generator, building shells, trees and bridge railings have collision. Small decorative furniture and low planting details do not have individual collision bodies. Survey stairs and wharf decks share their rendered support heights with movement.

The field map reads the actual terrain, building plans and road data. Click to place a waypoint. Rest at either camp to heal and save. Stations and a 45-second timer also save. The new save key is `last-dead-blackwater-64-v1`, independent of all legacy saves. Saves include mission progress, collected items, killed enemies and driven truck positions. Defeat returns the player to their shelter with recovered health and a small minimum supply allowance. The ferry ending allows continued exploration.

## Controls

| Input | Action |
| --- | --- |
| WASD / mouse | Move / look |
| Shift / Space | Sprint / jump |
| Left / right mouse | Fire / aim down sights |
| R / F / H | Reload / punch / use a dressing (or an available remedy) |
| B | Field pack: supplies, weapons, crafting and reinforcement |
| V | Crimson Punch: close, recently staggered and wounded infected |
| E | Search containers, collect, speak, restore, rest, enter or leave truck |
| M | Field map and journal; pauses the simulation |
| Esc | Pause / resume |
| F2 / F8 | Developer flight / run its performance survey |
| Truck: W/S, A/D, Space | Throttle/reverse, steering, brake |

Touch uses a left movement stick, right drag-to-look area, action buttons, map and pause. Phone browser emulation is covered by the smoke test; physical phones and controllers are not certified.

## Visual and interface direction

The player fantasy is a quiet, beautiful coast made unsettling by abandonment. Chunky silhouettes, restrained pixel textures, moss and chalk walls, oxidized green roofs, warm lamps and sea haze establish a late-1990s console interpretation. It is an art direction, not an exact N64 hardware emulator.

The landscape owns the screen. The title uses a large book-cover serif and a small coastal survey motif; the HUD reduces this to a compass, fine bars and contextual prompts. Cream means readable information, amber means navigation or interaction, and rust means danger. The map is a survey sheet with the same typographic language. No dashboard cards, fake telemetry or debug controls appear in ordinary play. Settings expose sensitivity, audio, 360p / 600p / native internal picture resolution and reduced camera motion. A single tone-map stage is followed by restrained RGB555 dithering; UI renders at display resolution. Local directional shadows and depth-dependent shoreline foam provide contact and scale. Menus and the map stop combat, release pointer capture and clear held inputs.

Road colour is applied to the ground’s own triangles from the shared road segments, avoiding intersecting draped meshes. Collision samples that same triangle grid. Architecture is planned as serializable mass tiers before compilation; façade windows, sills, shops, cornices and crowns use dimensional bay and floor rules. Material/geometry batches are divided into spatial tiles. Terrain, trees, buildings and support props are deliberate procedural artwork. Camera depth uses a logarithmic buffer to reduce distant façade shimmer.

## Reused assets and animation

- `assets/models/afterlife-ash-witness-motion-v07.glb`: the existing project-owned Meshy Ash Witness, with the ten preserved idle, shuffle, chase, run, crawl, crawl-idle, contort, attack, recoil and collapse clips. Relevant clips run through `AnimationMixer` and `SkeletonUtils.clone`; models are only animated near the player. Provenance is retained in the adjacent manifest.
- `assets/harbor/truck-flat.glb` and `sedan.glb`: bundled Kenney Car Kit models. Their CC0 license remains beside the files. No network requests, credentials or paid generation are needed to play.
- Bundled carbine report, metal reload, footsteps, enemy and pickup samples. Existing audio source documentation remains in `docs/audio-sources.md`.
- New terrain, architectural kit, plants, bridge, ferry, first-person carbine, textures and interface are procedural/local source. No newly downloaded or AI-generated assets are claimed.

## Runtime ownership

- `island/data.js`: seed, roads, terrain, building plans, content and spatial collision index.
- `island/world.js`: terrain and road shaders, architectural compilation, vegetation, bridge, landmarks, atmosphere and contact shadows.
- `island/simulation.js`: movement, save validation, objectives and ray/wall tests.
- `island/actors.js`: GLB loading, animation, enemy state, trucks and audio.
- `island/carbine.js`: shaped weapon, articulated grips, magazine/bolt choreography.
- `island/presentation.js` and `island/feedback.js`: final picture and bounded impact/casing pool.
- `island/authored-details.js`: district frontages, bridge threshold, evacuation route, survey platform and wharves.
- `island/navigation.js`: bounded local pathfinding and walkable segment checks.
- `island/game.js`: frame loop, input, UI state, interactions, combat, driving, settings and saves.
- `island/map.js` and `island/style.css`: survey map and interface.

`?debug` exposes a scoped `window.__BLACKWATER__` inspection API for automated checks and controlled camera poses. It is absent from normal play. This is a new solo campaign; co-op and the old dungeon systems remain available through the legacy entry.

## Verification

`npm run test:blackwater` checks deterministic content, architectural tiers, unblocked enemy spawns and station controls, all island road centre lines, a complete simulated bridge crossing, door access, wall/bullet obstruction, corrupt saves and mission state. `npm run test:blackwater:browser` uses an owned headless Chromium and an ephemeral project server; it does not touch the user's game tab.

The browser check exercises keyboard movement, pickups, healing, ammunition/reload, truck entry/driving/exit, walking on the bridge, animated enemy damage/death, station activation, the ferry ending, persisted progress, retry, and desktop/touch layouts. Controlled teleports isolate encounters and outcomes; this is not an uninterrupted end-to-end human playthrough. Screenshots and measured frame/draw data go to ignored `output/playwright/blackwater-rewrite/`. Timing during initial shader/asset preparation is reported separately from warmed frames. Browser emulation is not physical-phone performance evidence.

Run `npm run build` for a self-contained `dist/` including both entries. Test the packaged files with `BLACKWATER_QA_ROOT=dist` and the normal browser command. Existing `PLAYWRIGHT_PATH` and `CHROME_PATH` overrides are supported.

### Initial rewrite verification — superseded by the quality pass below

The packaged `dist/` passed the browser journey above with zero JavaScript errors and zero failed HTTP requests. The final warmed frame sample had a 16.7 ms median and 17.3 ms p95; the final street view rendered 261 calls and approximately 1.41 million triangles. These are local headless Chromium measurements, not a physical-phone benchmark. Initial shader preparation caused a visible loading-time stall and is excluded from the warmed claim.

All seven rewrite unit tests passed, along with the 36 existing engine/enemy-AI regressions. The mobile check also activated healing and pause through touch buttons. Vehicle position and mission progress survived reload, and opening title-screen settings did not overwrite a saved journey. Both `/` and `/legacy.html` returned HTTP 200 on the verified project-owned local server at port 5200. The browser panel was requested without navigating or closing the user's existing game tab.

## Second quality iteration — 15 October 2026

An independent `ruthless_creative_director` judge reviewed the original captures, the first revised build, and neutral weapon / reload / final-versus-no-post evidence. The governing promise is **cross a beautiful abandoned coast by choosing when to expose yourself for the signal home**. The review log is [blackwater-quality-iteration.md](blackwater-quality-iteration.md).

The final packaged journey passed with zero JavaScript or HTTP errors, including the fuse gate, physical stairs, generator startup/cancellation, shooting/reload, driving/exit, all stations, ferry, save/reload, retry and actual emulated touch dragging/healing/pause. The generator outcome check disables nearby enemies to isolate the timer; it does not certify encounter balance. Nine rewrite unit tests plus 36 legacy engine/AI regressions passed. Final warmed street sample: 16.7 ms median, 17.0 ms p95, 324 calls and 1.55 million triangles. Initial shader/asset preparation recorded a 1.45-second p95 sample; that startup cost is not included in the warmed claim.

Evidence is in ignored `output/playwright/blackwater-iteration/`: preserved baseline, pass-1, final packaged browser checks, and review views / neutral materials / reload samples / continuous capture video. `tests/blackwater-visual-review.mjs` reproduces the fixed-time views and records the real reload. These checks establish scoped behavior and visible improvement, not a complete uninterrupted playthrough, balanced open-world pacing, controller support or physical-phone performance.


## Scavenging and close combat — October 16 pass

There are now 61 persistent searchable containers in addition to the existing supply boxes and seven displayed weapon cases. All 45 furnished ground floors have a container, with further finds along the named exploration routes and parked vehicles. Four exploration containers provide alternative weapon finds. The six content themes include ammunition, fuel, bandages, stout, cloth, antiseptic and weapon fittings. Search takes 1.15 seconds and interrupts on damage or moving away. Opening a searched container or the field pack pauses the game; unclaimed quantities stay in that container.

The illustrated field pack has a 24-item supply pouch, a separate medical belt for the old field dressings, and an arsenal with individual weapon silhouettes. Two cloth and one antiseptic make a bandage. Eight fittings reinforce one owned weapon for 20% additional damage, including melee, the saw and launched rockets. Supplies can be discarded one at a time to free space. Spare weapons yield ammunition once. Ammo found before its weapon stays in reserve. All quantities, upgrades and remaining container contents persist; old saves receive an empty pouch without losing their existing equipment.

Bandages restore up to 35 health, stout 15 and belt dressings 45. Applying a dressing takes 1.4 seconds; stout takes 1.05 seconds. Consumption occurs at completion, so an interruption preserves the item. Two cloned articulated FPS hands perform the actions. The stout is fitted inside the bent finger contact arc. Revolver loading now swings out its existing cylinder with a support hand and speedloader; Arc reload lifts and reseats its capacitor; Ripper refuelling opens its cap and presents a fuel flask. The established carbine, shotgun, launcher and rifle reloads remain.

F is a timed visible punch with a delayed contact trace. Wake bat also checks contact at its impact phase; saw contact feedback follows actual hits. Wounding an infected opens a 1.25-second Crimson opportunity: at 45 health or less, within 2.05 metres, facing and with clear line of sight, V spends 15 stamina. The action reuses the original body-spear anatomy and chest fitting against the actual posed skin. Contact, extraction, release and recovery are once-only timed events; moving out of reach releases the action even after contact. The chest opening follows the victim's skeleton, the hands respect world depth, and the equipped weapon returns after recovery. Other enemies remain active. Death and menu changes clear action ownership.

Blood particles, ground stains, shells and trails use bounded pools. Blood direction follows the hit; stronger close impacts emit more fragments. The saw's motor and contact sounds are distinct and rate-limited; playback is capped at 32 concurrent voices. All art and sound in this pass come from the repository's existing assets or authored code. No new third-party download is required.

This pass adapts the named scavenging and combat features into Blackwater's single-player loop. Legacy co-op, its full dismemberment/ragdoll simulation, alternate-fire/attachment catalogue and other campaign systems still belong to the preserved original runtime; they are not claimed as migrated here.

## Mobility and first-person refinement — October 16 pass

Q performs a nonlethal shove: 24 stamina, a 1.05-second cooldown, and a single facing target within 1.75 metres with clear line of sight. Contact cancels an incoming attack, briefly staggers the infected and pushes it against the same world collision. A shove does not create a Crimson opening. F and the bat retain their damaging contact and Crimson opportunities, with collision-limited impact recoil.

Hold forward and press Space near a low obstacle to vault. The route validates the full body, overhead clearance and landing before commitment; tall, deep or obstructed routes fall back to the ordinary jump. The hands plant at world depth, the camera crouches through the crossing, and the weapon returns on landing. Jump buffering and a short ledge grace period make ordinary movement more forgiving. Pausing freezes a committed vault; retry and teleport discard its runtime state. This is low-obstacle traversal, not wall running or a general climbing system.

All equipped weapons share restrained sprint lowering, look sway, landing settle and wall clearance. Reduced motion suppresses decorative movement while retaining functional clearance and the vault crouch. The bat uses flat ash-wood facets, restrained iron and linen. Blood now reaches the ground through actual particles; nearby walls receive bounded face-aligned stains, and missed bullets leave surface chips. These pools stay bounded and clear with the run.

The pack remembers separate equipment and supply selections, shows pouch occupancy and remaining ammunition, returns to the current container, and reports exact partial-loot quantities. All of this uses bundled assets and authored code, with no new services or downloads. The original engine informed attack cancellation and knockback; the preserved legacy systems listed above are still outside this migration.

## Motion and rendering continuity (16 October)

The first-person pass adds short acceleration/braking, distance-driven weapon/camera stride, collision-aware footsteps and sprint presentation, and softened small upward camera steps. Bat contact timing, shove withdrawal and returning to the same weapon after an action now remain coherent. Static transforms and hidden render branches avoid unnecessary matrix work; startup prepares colour/shadow programs and effect-pool layouts before play. N64 image settings and world content are preserved.

All 41 world/gameplay checks and packaged motion, nine-weapon combat, mobility, desktop/touch mission and sixteen-view survey pass. Detailed measurements, review limits and retained evidence are in [blackwater-quality-iteration.md](blackwater-quality-iteration.md). The survey reaches 16.6–16.7 ms medians at 384×240 on the local GTX 1650, while retaining a 66.7 ms bookshop outlier; this is not a universal locked-frame-rate claim. Use `npm run test:blackwater:fluidity` for action interruptions and `npm run test:blackwater:profile` for the instrumented rendering route.
