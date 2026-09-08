# The Last Dead

An original, fast 3D arena shooter: industrial horror, aggressive movement, blood healing, weapon combinations, and two-player peer-to-peer co-op.

## Standalone project

Canonical folder: **Desktop/thelastdead**. Repository: **https://github.com/jrodthewiz/The-Last-Dead**. This project owns its source, assets, bundled Three.js runtime, build and launcher. Findle remains a separate miniature-world hidden-object game; do not develop The Last Dead inside Findle.

## Current build

**BUILD 09 / STEADY HANDS** refines first-person gripping hands, sleeve materials, barrel cant and weapon-specific recoil. It fixes pitched tracer endpoints, moving tracer origins, co-op FX ownership, muzzle flash transforms and projectile launch/trail alignment. See [Build 09 verification](docs/BUILD-09.md). Refresh the existing local or Railway link to play.

## Play

Requires Node.js 18 or newer. No package installation or API keys are needed.

- Double-click **Start The Last Dead.cmd**, or
- Run **npm.cmd run dev** from this folder, then open **http://127.0.0.1:5200/**.

The launcher reuses this project's existing server and refuses to replace another app using the port.

## Controls

| Input | Action |
| --- | --- |
| WASD / mouse | Move / look freely |
| Space | Jump; jump beside a wall again to wall-jump |
| Shift | Directional dash, including in the air |
| Ctrl | Slide; in the air, ground slam |
| Left mouse | Fire |
| Right mouse | Toss coin; eject shotgun core; airburst a Reliquary rocket |
| F | Punch / timed projectile parry |
| E | Tether: pull light enemies close, pull yourself to heavy enemies |
| 1 / 2 / 3 / 4 or wheel | Ossuary / shotgun / arc lance / Reliquary |
| R / Esc | Restart / pause |

Shoot airborne coins for ricochets. Shoot cores to detonate them; the arc lance amplifies the blast. Damage enemies up close to restore health. Mix attacks to increase your style rank. Clear each sector and reach its illuminated exit to descend. The final sector ends the campaign. Settings include sensitivity, volume, reduced motion, gore, and optional automatic forward running. Touch controls and drag-to-look are included.

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

Gameplay: engine.js. Rendering: renderer.js. Inputs/co-op authority: main.js. UI: ui.js, styles.css and horror-ui.css. Transport: peer.js. Audio: assets/audio.js. The bundled Three.js runtime retains its license in vendor/THREE-LICENSE.txt.

## Current scope

This build contains three authored arena sectors, nine paced waves, four enemy families with difficulty variants, and four weapons with combo mechanics. Boss encounters, full advanced combat-tech parity, larger traversal maps, matchmaking and broad device/network certification remain future work. It is an original playable foundation, not full ULTRAKILL feature parity.

The original Findle game remains separate. No generation credentials are included. Sampled sound effects and ambience ship locally with procedural fallback layers; source and CC0 licensing are recorded in [audio sources](docs/audio-sources.md). New enemy and weapon concepts and procedural reconstruction evidence are in docs/build08-art and docs/build08-enemy-art.

## Railway

Use the repository root, build command **npm run build**, start command **npm start**, and **PORT=8080** when the domain target port is 8080. With PORT set, the server binds to **0.0.0.0**; local development defaults to **127.0.0.1:5200**. HOST can explicitly override the bind address. The platform PORT takes precedence over the legacy local port setting.
