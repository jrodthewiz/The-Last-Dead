# The Last Dead

An original, fast 3D arena shooter: industrial horror, aggressive movement, blood healing, weapon combinations, and two-player peer-to-peer co-op.

## Current build

**BUILD 05 / OSSUARY** adds a bone-forged death revolver, animated chamber, colored bullet trails, muzzle embers, impact sparks and hit-position blood spray. See [Build 05 evidence](docs/BUILD-05.md). Refresh the open local game to see updates; the development server sends no-store responses.

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
| Right mouse | Toss coin with revolver; eject explosive core with shotgun |
| F | Punch / timed projectile parry |
| E | Tether: pull light enemies close, pull yourself to heavy enemies |
| 1 / 2 / 3 or wheel | Revolver / shotgun / arc lance |
| R / Esc | Restart / pause |

Shoot airborne coins for ricochets. Shoot cores to detonate them; the arc lance amplifies the blast. Damage enemies up close to restore health. Mix attacks to increase your style rank. Clear three waves and reach the illuminated exit. Settings include sensitivity, volume, reduced motion, gore, and optional automatic forward running. Touch controls and drag-to-look are included.

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
- **node browser-check.mjs** checks desktop and mobile inputs when Playwright is configured.

Gameplay: engine.js. Rendering: renderer.js. Inputs/co-op authority: main.js. UI: ui.js and styles.css. Transport: peer.js. Audio: assets/audio.js. The bundled Three.js runtime retains its license in vendor/THREE-LICENSE.txt.

## Current scope

This is a playable combat-arena foundation, not full ULTRAKILL feature parity. It has one original arena, three enemy classes, three waves and three weapons with combo mechanics. A campaign, bosses, every weapon variant, full advanced combat-tech parity, multi-level traversal maps, matchmaking and broad device/network certification remain future work. See docs/COMBAT-FOUNDATION.md and the verification reports for exact implementation and testing evidence.

The original Findle game remains separate. No generation credentials are included. The material image was generated; audio uses local synthesis because the external generation providers were unavailable. Details: docs/assets.md.
