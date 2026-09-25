# The Last Dead

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

Solo play starts in the five-floor Story descent, with connected rooms, side routes, keys, and exits. You begin with the Ossuary and build an eight-weapon arsenal by exploring side rooms. Unclaimed weapons glow in the world, show their rarity, and equip when picked up; finds stay with you as you descend. Each floor key reveals another part of the facility's story. Nine optional records in side rooms and sealed caches add the voices of people who lived through it; pause to review everything you have recovered. Use `?dungeon=0` through `?dungeon=4` to start a specific floor, or `?campaign=1` to play the three-sector arena sequence. Co-op uses the arena sequence and starts with all eight weapons.

## Controls

| Input | Action |
| --- | --- |
| WASD / mouse | Move / look freely |
| Space | Jump; jump beside a wall again to wall-jump |
| Shift | Directional dash, including in the air |
| Ctrl | Slide; in the air, ground slam |
| Left mouse | Fire / swing bat / hold to rev and cut with chainsaw |
| Right mouse | Toss coin; eject shotgun core; airburst a rocket; rifle burst / hold to charge; heavy bat strike / chainsaw shove |
| F | Punch / timed projectile parry |
| E | Tether: pull light enemies close, pull yourself to heavy enemies |
| 1–8 or wheel | Select or cycle weapons you have found in Story: Ossuary / shotgun / arc lance / Reliquary / Carrion / Mourning / Wake Bat / Ripper Chainsaw |
| R / Esc | Restart / pause |

Shoot airborne coins for ricochets. Shoot cores to detonate them; the arc lance amplifies the blast. Damage enemies up close to restore health. Mix attacks to increase your style rank. Clear encounters, find the floor key, and reach the lift to descend. The fifth floor ends the Story descent. Settings include look sensitivity, separate master, effects, enemy voice, music, ambience, and interface volumes, reduced motion, gore, and optional auto-run. Audio levels update live and persist on this device. Touch controls and drag-to-look are included.

**Carrion (5)** is an automatic rifle: hold fire to suppress, or tap alternate fire for a tight three-round burst. Heat widens sustained fire and cools automatically; bursts remain precise. **Mourning (6)** fires heavy single shots. Hold alternate fire for 0.55 seconds to charge a shot that pierces up to three enemies; releasing early cancels it. Both rifles have unlimited ammunition, distinct mechanical animations and sampled reports. The touch weapon button cycles weapons you own.

**Wake Bat (7)** cleaves up to two nearby enemies with a committed swing. Alternate fire delivers a slower, harder single-target strike. **Ripper Chainsaw (8)** spins up while fire is held and cuts continuously at close range; alternate fire shoves an enemy back. Both use sampled swings, impacts and motor sounds, directional knockback, blood contact effects and loose-limb reactions on the Ash Witness. Melee is blocked by walls, and switching or pausing cancels pending attacks. See [melee controls and verification](docs/melee-pass/README.md).

## Two-player co-op

Both players open their own copy of the same build (localhost or an HTTPS host):

1. Host clicks **Create offer** and gives the offer code to their partner.
2. Partner pastes it into **Join a breach**, clicks **Make answer**, and returns the answer code.
3. Host pastes the answer into **Host: paste answer here** and clicks **Accept**.
4. Both enter the same arena. Enemies, damage and waves are controlled by the host. A downed player revives if the partner survives.

The codes establish a real WebRTC data channel. There is no account, matchmaking service, or hosted relay. Some firewalls/NATs require a TURN relay; the transport supports one through its constructor configuration, but none is provisioned in this build. Local two-browser verification does not prove every internet route. Host departure ends the guest session; there is no host migration. Co-op stays live while a player's menu is open.

## Build and checks

- **npm.cmd run build** creates a standalone static **dist/** folder.
- **npm.cmd run preview** serves the built game.
- **npm.cmd run test:engine** runs movement and combat regressions.
- **npm.cmd run test:network** checks WebRTC using installed Chrome and Playwright (see docs/network.md for paths).
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

This build contains a five-floor Story descent plus three arena sectors for co-op and optional solo play, four enemy families with difficulty variants, and eight weapons with combo mechanics. Boss encounters, full advanced combat-tech parity, matchmaking and broad device/network certification remain future work. It is an original playable foundation, not full ULTRAKILL feature parity.

The original Findle game remains separate. No generation credentials are included. Sampled sound effects, ambience, and music ship locally; variants are level-matched by event pool and a master limiter controls peaks. The pause-screen settings let players adjust master, effects, enemy voices, music, ambience, and interface levels live; preferences save in local storage. Sources and CC0 licensing are recorded in [audio sources](docs/audio-sources.md). New enemy and weapon concepts and procedural reconstruction evidence are in docs/build08-art and docs/build08-enemy-art.

## Railway

Use the repository root, build command **npm run build**, start command **npm start**, and **PORT=8080** when the domain target port is 8080. With PORT set, the server binds to **0.0.0.0**; local development defaults to **127.0.0.1:5200**. HOST can explicitly override the bind address. The platform PORT takes precedence over the legacy local port setting.
