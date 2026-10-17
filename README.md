# The Last Dead

The browser edition has been rebuilt as **Blackwater**: a solo or two-player, N64-inspired horror-survival journey across a forested island, a 300-metre suspension bridge and the procedural city of Saint Orin.

## Play Blackwater

[**Play the public game**](https://the-last-dead-blackwater.jrodonthebeat.chatgpt.site) ·
[GitHub source](https://github.com/jrodthewiz/The-Last-Dead)

Run **npm.cmd run dev**, or use **Start The Last Dead.cmd**, then open **http://127.0.0.1:5200/**. The canonical checkout is **C:/Users/wolfk/Desktop/thelastdead**. Node.js 18+ and the bundled assets are sufficient; there are no runtime downloads or API keys.

Restore three emergency stations and reach the evacuation ferry. Explore 248 buildings and 45 furnished ground floors, scavenge ammunition and medical supplies, fight animated infected, drive utility trucks and save at shelters. Press **M** for the actual-world map and journal. Desktop and touch interfaces share the same mission and inventory state.

**WASD** move, **mouse** look, **Shift** sprint, **Space** jump, **left/right click** fire/aim, **E** interact/drive, **R** reload, **F** melee, **H** heal, **M** map, **Esc** pause, **I** survivor inspection and equipment, **1–9 / wheel** weapon selection, **F2** developer flight, **F8** flight performance survey.

Choose **Play together** to host a public waiting expedition or join an open frequency. The host chooses **Depart together** when both survivors are present. Infected, objectives and trucks are shared; inventories are personal. Co-op expeditions last for the session and never overwrite your solo journey. Closing the host ends the expedition. See [multiplayer and hosting](docs/blackwater-multiplayer.md).

City upper storeys remain scenery; the original dungeon and co-op implementation is preserved locally at **/legacy.html**. The Unity project is separate. Existing work and legacy saves have been retained.

See [world, art direction, asset provenance and scope](docs/blackwater-rewrite.md).

The second quality pass adds stronger console-era lighting and colour, distinct city districts, a shaped carbine with hand-operated reload, physical signal-tower stairs, keeper-fuse and generator objectives, collidable evacuation routes, and clearer touch controls. See the [independent judge's iteration record](docs/blackwater-quality-iteration.md).

The terrain and arsenal pass adds thousands of locally bundled camp, yard, storage and understorey props from 28 CC0 Kenney models; terrain-aware foundations and walkable entrances; corrected infected facing; a 240p console picture with low-resolution three-sample-filtered atlases; and the original animated survivor and eight weapon models alongside the expedition carbine. Rifle, revolver, shotgun, charged arc, rocket, marksman and melee behaviors have separate ammo/fuel and save state.

The next pass gives the coast five discoverable destinations and three marked walking loops, persistent field records, a radio operator whose dialogue and ration service respond to restored signals, and distinct keeper-workshop, clinic and evacuation-office interiors. Two infected roles now separate, investigate sound, respect facing/cover, and commit to dodgeable attacks. The shotgun has a readable two-shell break-action cycle; weapon HUDs show the correct heat, charge, fuel or melee state. Nineteen additional CC0 heritage models are bundled from [Kenney’s Graveyard Kit](https://kenney.nl/assets/graveyard-kit).

The atmosphere pass adds broad painted cloud banks, animated coastal wash and water colour, connected stone-and-grass slopes, and distinct plaster, slate, masonry and paving surfaces. Fern colonies, striped shop awnings, lanterns, rain pipes, window boxes and restrained ivy enrich the island and old town. Restoring Westlight now lights its optic and rotating coastal beam. The survivor inspection stage has softer lighting and grounded foot contact. All of this retains the 240p console presentation and uses locally bundled resources.

The character and motion pass refines the carbine's carved stock, gripping hands, folded sleeves and visible reload. Rifle reloads have timed mechanism sounds, and shots eject small tumbling brass cases or red shotgun shells. The survivor wears distinct field clothing, a fitted pack and attached equipment; animation changes blend, and running preserves its airborne stride. The bundled fever runner and drowned dockworker join the infected population. Elias visibly listens to a handheld radio, while foliage, rooftop signal cloth, hanging shop signs and channel buoys move gently through the coast and city. The small textures, restrained palette and 240p image remain consistent.

The settlement pass gives two neighboring village yards their own purpose: a supported dinghy repair station and a terraced kitchen garden with wind-stirred laundry and stacked fuel. One Old Town block now has an arched bookshop, a residential entrance and balcony, and a shuttered net-and-timber workshop. At the waterfront, walkable shore stairs lead to a timber landing, drying net and moored fishing launch. The boat rocks gently while its mooring lines remain attached. New construction shares its terrain heights and solid footprints with movement.

The console interface uses bold ivory titles, an amber selection cursor, olive framed menus and larger segmented health/ammo readouts. Title, pause, settings, map, dialogue and survivor equipment share this style. **Up/Down** selects menu controls, **Enter** confirms and **Esc** returns; native sliders and selects retain their arrow controls. Touch layouts keep action buttons clear of ammunition, use appropriate hints, and frame the survivor between the heading and equipment list. See the [UI direction and review evidence](docs/ui-direction.md).

The coastal craft pass gives the Arc lance a quieter enamel-and-iron body, fitted operating grip, and a charge carriage with three visible charge stages. Discharge animation follows actual firing. The survivor and Elias have clearer garment colours and equipment fitted to the posed body; imported walk/run clips remain intact. Seven small gulls inhabit the repair boat, bookshop cornice and tidal landing. They turn, leave in staggered flights when approached, stay away while the perch is occupied, and settle back after it clears. They share two instanced draws and use no downloaded runtime resources.

The refuge pass adds Mara, a boatwright at the Alder Village repair bench, and Iven, tending a bed in the Northpoint clinic. Their planted work/rest poses ease into listening when approached; **E** opens conversation and a one-time supply. Dialogue changes with existing mission progress. Nearby homes now distinguish boat repair from gardening, and Alder Books has a stocked browsing aisle. Ground-floor windows, ceilings and furniture share their layout with collision, including support when jumping onto beds or tables. The Reliquary gains a fitted grip, hinged breech and visible cartridge insertion; Mourning and the chainsaw use quieter console colours, and the saw's chain now responds to active cutting. These additions reuse the bundled character rig and preserve the classic interface.

[Open developer flight](http://127.0.0.1:5200/?dev=1) to tour sixteen viewpoints, including the working yards, shop block and tidal landing, fly freely, inspect frame time/draw counts, and export a measured survey. WASD moves in the look direction, Q/E descends/rises, Shift boosts, and the wheel changes speed. Flight pauses the journey and restores the survivor's position on exit. The performance report identifies hardware, resolution and measurement scope.

- **npm.cmd run build** — standalone `dist/`, including the legacy entry.
- **npm.cmd run test:blackwater** — world, movement, collision, mission and persistence checks.
- **npm.cmd run test:blackwater:browser** — owned-browser gameplay and visual checks; supports `PLAYWRIGHT_PATH`, `CHROME_PATH`, and `BLACKWATER_QA_ROOT=dist`.
- **npm.cmd run test:blackwater:coop** — two-client discovery, combat, vehicles, menu recovery and save isolation; also targets the built Sites preview or public URL.
- **npm.cmd run test:blackwater:ui** — menu navigation, focus, settings, UI flows and desktop/narrow/touch layout captures, with the same browser overrides.
- **npm.cmd run test:blackwater:refuges** — Reliquary loading/control views, coherent rooms, NPC work/rest/listening samples, foot/tool measurements and persistent supplies; supports the same browser overrides.
- **npm.cmd run test:blackwater:craft** — Arc charge/cancel checks, neutral hand views, survivor/Elias captures, and roost departure/return checks; use `BLACKWATER_QA_EXPECT_CRAFT=1` for the new material/charge assertions.

The pickup/cohesion pass adds compact scavenging prompts and receipts, a smaller container sheet with **E** to take what fits and return, and storage-full protection. Twenty terrain-following home-to-road paths and a planted orchard make the village land use clearer. All 45 playable ground-floor interiors retain reachable containers. See [the checks and scope](docs/blackwater-cohesion-pass.md).

## Legacy browser reference

<details>
<summary>Original campaign, co-op, development tools and historical build notes</summary>

An original, fast horror FPS: industrial horror, aggressive movement, blood healing, weapon combinations, and two-player peer-to-peer co-op.

## Standalone project

Canonical folder: **Desktop/thelastdead**. Repository: **https://github.com/jrodthewiz/The-Last-Dead**. This project owns its source, assets, bundled Three.js runtime, build and launcher. Findle remains a separate miniature-world hidden-object game; do not develop The Last Dead inside Findle.

## Current build

**BUILD 10 / IRON AND ASH** adds weapon mechanisms and richer materials, textured first-person leather, surface impact scars/dust, modeled rockets, softer muzzle flares, sampled weapon and impact audio, and varied zombie attack and moan clips. See [Build 10 evidence](docs/BUILD-10.md). Refresh the existing local or Railway link to play.

## Play

Requires Node.js 18 or newer. No package installation or API keys are needed.

- Double-click **Start The Last Dead.cmd**, or
- Run **npm.cmd run dev** from this folder, then open **http://127.0.0.1:5200/**.

The launcher reuses this project's existing server and refuses to replace another app using the port.

**Play Campaign** starts in the original dungeon beneath Blackwater. Use E or Q at the entry service stairs to reach the full open coast and return whenever needed. Cleared dungeon floors retain their state during the session, and their lifts support backtracking. The coast continues with the Low Tide chapter, connected neighborhoods, 94 furnished coastal ground floors plus the original harbor interiors, equipment exploration and a persistent Netmakers safehouse checkpoint. The northern/eastern cape adds walkable forest hills, a winding stream and two wooden crossings. See [the current graphic-horror inspection](docs/blackwater-inspection-06.md). This is the single public solo campaign entry. The older dungeon layouts remain available for development through `?dungeon=0` to `?dungeon=4`; `?campaign=1` selects the legacy arena test route. `?debug` alone uses the same open-world entry as ordinary play. Co-op still uses the arena sequence and starts with all eight weapons.

**Dev Mode** is directly beneath Play Campaign on localhost (or with `?dev=1` on the live site). Choose **Open World** to inspect Blackwater Island or **The Last Dead** to inspect the connected dungeon. Each choice loads directly into free camera; the camera panel also lets you switch maps. Direct links are `?dev=1&inspect=1&world=island` and `?dev=1&inspect=1`. **Current Map / F2** inspects the current campaign world with simulation frozen: WASD flies, E/Space rises, Q/Ctrl descends, Shift boosts, and the mouse wheel changes speed. Click the scene to capture mouse look; Tab releases it; F2 returns to the player. Free camera is also available from pause.

Use **Full Map / M** in island free camera for an overview of the entire coast, town, forest and river. **Reset View / R** returns to the entry view. Flight uses the world's existing instanced vegetation and distant crown meshes; high camera views select those distant crowns even when directly above a tree.

## Controls

| Input | Action |
| --- | --- |
| WASD / mouse | Move / look freely |
| Space | Jump; jump beside a wall again to wall-jump |
| Shift | Directional dash, including in the air |
| Ctrl | Slide; in the air, ground slam |
| Left mouse | Fire / swing bat / hold to rev and cut with chainsaw |
| Right mouse / LT | Aim or brace firearms; heavy bat strike / chainsaw shove |
| C / Middle mouse / LT + RB | Fire the Breach shotgun's fitted underbarrel grenade launcher |
| F | Punch / timed projectile parry |
| E | Tether: pull light enemies close, pull yourself to heavy enemies |
| 1–8 or wheel | Select or cycle weapons you have found in Story: Ossuary / shotgun / arc lance / Reliquary / Carrion / Mourning / Wake Bat / Ripper Chainsaw |
| R | Weapon status: weapons replenish automatically; no manual reload needed |
| Esc | Pause / resume; restart is available in the pause menu |
| Enter | Retry after death or a completed run |

Hold aim to line up firearm sights or brace unsighted guns. The Breach shotgun has a visible underbarrel launcher with independent recoil and cooldown; its grenades arc and detonate on contact or after their fuse. Damage enemies up close to restore health. Mix attacks to increase your style rank. Follow the Low Tide objectives, establish the Netmakers safehouse, and explore the connected coast for equipment and records. Hold Q at chapter machinery and use B for the field map and journal. Settings include look sensitivity, separate master, effects, enemy voice, music, ambience, and interface volumes, reduced motion, gore, and optional auto-run. Audio levels update live and persist on this device. Touch controls and drag-to-look are included.

**Carrion (5)** is an automatic rifle: hold fire to suppress and hold aim to line up its iron sights. Heat widens sustained fire and cools automatically. **Mourning (6)** fires heavy single shots and aims through its open sight. Both rifles have unlimited ammunition, distinct mechanical animations and sampled reports. The touch weapon button cycles weapons you own.

**Wake Bat (7)** cleaves up to two nearby enemies with a committed swing. Alternate fire delivers a slower, harder single-target strike. **Ripper Chainsaw (8)** spins up while fire is held and cuts continuously at close range; alternate fire shoves an enemy back. Both use sampled swings, impacts and motor sounds, directional knockback, blood contact effects and loose-limb reactions on the Ash Witness. Melee is blocked by walls, and switching or pausing cancels pending attacks. See [melee controls and verification](docs/melee-pass/README.md).

## Two-player co-op

Both players open their own copy of the same build (localhost or an HTTPS host):

1. The host opens **Co-op**, clicks **Host**, and shares the six-character room code.
2. The partner opens **Co-op**, enters that code, and clicks **Join**.
3. Both enter the same arena. Enemies, damage and waves are controlled by the host. A downed player revives if the partner survives.

The public PeerJS broker exchanges the WebRTC handshake; gameplay then uses a peer-to-peer data channel. There is no account, matchmaking, or hosted gameplay relay. Some firewalls and NATs require a TURN relay; none is provisioned in this build. Local two-browser verification does not prove every internet route. Host departure ends the guest session; there is no host migration. Co-op stays live while a player's menu is open. See [co-op signaling](docs/coop-signaling.md) for broker configuration.

## Build and checks

- **npm.cmd run build** creates a standalone static **dist/** folder.
- **npm.cmd run preview** serves the built game.
- **npm.cmd run test:engine** runs movement and combat regressions.
- **npm.cmd run test:network** checks WebRTC using installed Chrome and Playwright (see docs/network.md for paths).
- **npm.cmd run test:coop** checks the current room-code UI, two connected browsers, and host-authoritative combat against a local signaling fixture.
- **npm.cmd run test:bodycam** checks the live WebGPU image pass, saved preferences, resize, and reduced motion in desktop Chrome.
- **npm.cmd run test:performance** records live dungeon and island frame pacing, draw counts, and renderer memory in desktop Chrome.
- **node browser-check.mjs** checks desktop and mobile inputs when Playwright is configured. For browser QA, install Playwright locally with **npm.cmd install --no-save playwright**, then **npx.cmd playwright install chromium**. An explicit **PLAYWRIGHT_PATH** can select another installed package; the default resolves this project's own dependencies.

## Map playground

Open **http://127.0.0.1:5200/map-playground.html** while the local server is running. It draws the authored maps straight from `campaign.js`, `room-progression.js` and the story-mode dungeon data, so there is no second copy of the layout to drift:

- **Story descent · floor detail** — the five-floor story dungeon, drawn from `playground/map/dungeon-data.js` and compiled into the engine's cell format by `playground/map/dungeon-compiler.js`. Rooms, corridors, key gates, secret vents, scare beats, dressing, lights and the spawn route are all separate layers.
- **Story descent · all floors** — every floor side by side for pacing review.
- **Sector detail / Whole campaign** — the existing three-sector arena campaign, including the sealed-threshold view.

Drag to pan, wheel to zoom, click any marker for the authored data, `M` measures, `E` moves anchors and produces a retune patch you can paste back, `Ctrl+Z` undoes. `npm.cmd run test:map` guards the story dungeon: every floor must compile with reachable rooms, connected openings, a key that is not behind its own door, and an exit that is reachable once the keys are collected.

The Story render pass uses the compiled rooms and walls for its ceiling, functional wall details, and overhead structure. It uses floor-specific cover and set dressing so the Foundry, surgical wards, Catacombs, choir, and final throat read as different places. The playground marks weapon finds with colored W diamonds and evidence with document icons. See [the latest map iteration](docs/map-life-pass/README.md) for route changes, [the Story loot pass](docs/story-loot-pass/README.md) for weapons, and [the evidence pass](docs/story-evidence-pass/README.md) for optional discoveries.

Gameplay: engine.js. Rendering: renderer.js. Inputs/co-op authority: main.js. UI: ui.js, styles.css and horror-ui.css. Transport: peer.js. Audio: assets/audio.js. The bundled Three.js runtime retains its license in vendor/THREE-LICENSE.txt.

## Current scope

The main campaign is the Blackwater open coast: Low Tide mission progression, 94 furnished coastal ground floors plus the original harbor interiors, forest terrain, a stream, a drivable truck and safehouse saves. Upper storeys remain closed, and the new ground floors do not each have a bespoke encounter or narrative reward. The three-sector arena remains development/co-op content; the five dungeon floors now form the campaign starting area beneath the coast, linked through customs stairs and return lifts. Continued authored exploration, upper-storey access, matchmaking and broad device certification remain future work.

The original Findle game remains separate. No generation credentials are included. Sampled sound effects, ambience, and music ship locally; variants are level-matched by event pool and a master limiter controls peaks. The pause-screen settings let players adjust master, effects, enemy voices, music, ambience, and interface levels live; preferences save in local storage. Sources and CC0 licensing are recorded in [audio sources](docs/audio-sources.md). New enemy and weapon concepts and procedural reconstruction evidence are in docs/build08-art and docs/build08-enemy-art.

## Railway

Use the repository root, build command **npm run build**, start command **npm start**, and **PORT=8080** when the domain target port is 8080. With PORT set, the server binds to **0.0.0.0**; local development defaults to **127.0.0.1:5200**. HOST can explicitly override the bind address. The platform PORT takes precedence over the legacy local port setting.

### Blackwater Harbor playable slice

Choose **BLACKWATER HARBOR** from the title screen for the solo exterior expedition.
Walk over weapon finds to stash them; **B** opens the backpack to equip melee/firearms
and fit upgrades. At the truck: **Q** enter/exit, **W/S** drive, **A/D** steer,
**Space** brake. Recover three weapons, drive 32 metres and reach the ferry on foot.
A fresh run resets the pack. Water is currently scenery beyond the quay.

Use **B → FIELD MAP** for numbered landmarks, remaining weapon finds, the truck,
ferry and a suggested walking route. HUD guidance follows open streets and the
Netmakers gate; it changes as you complete the expedition objectives.

See [iteration scope and next steps](docs/harbor-iteration.md) and
[reproducible CC0 asset acquisition](docs/harbor-assets.md).
Run `npm run test:harbor` for mechanics and `npm run test:harbor:browser` for
an owned-browser smoke test (`PLAYWRIGHT_PATH`/`CHROME_PATH` overrides supported).

</details>
