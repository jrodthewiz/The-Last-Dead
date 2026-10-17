# Blackwater co-op and public hosting

The title's **Play together** radio supports two survivors. Enter a callsign,
host an expedition, and share its six-character channel, or join a waiting
expedition under **Open frequencies**. The list refreshes every five seconds.
Only fresh, waiting rooms with a free seat appear. The host departs after the
second survivor connects; simultaneous join attempts cannot occupy one seat.

The host simulates infected and owns the shared emergency-network objectives.
Both survivors can shoot, punch, shove, perform Crimson, make noise, collect
the keeper fuse and drive trucks. A truck has one driver. Remote survivors use
the bundled animated rig, field clothing and the currently equipped weapon.
Each player has personal ammunition, healing items, backpack and weapon finds.
Menus remain live: infected can hurt a survivor reading a map or opening a pack.
Death closes those screens so Retry remains reachable.

Expeditions are session based. Solo saves remain untouched, including during
disconnect and delayed cleanup. There is no host migration or co-op resume;
closing the host ends the expedition. Developer flight remains a solo tool.
This is cooperative play with host authority, not a competitive anti-cheat system.

## Connections

The same-origin HTTPS room API discovers players, exchanges WebRTC offers and
answers, and provides a gameplay relay when a direct connection is unavailable.
Direct gameplay reuses the original `PeerSession` data channel in `peer.js`.
No listening gameplay port, manual SDP copy/paste or router port forwarding is
required. Networks that block WebRTC use HTTPS with greater action latency.
The game shows **DIRECT** or **RELAY** and the measured round-trip time.
No microphone or camera permission is requested.

Guest seat claims and departure use compare-and-set updates. Room credentials
remain in browser memory and never appear in URLs or public discovery.
Public seat incarnations fence replacement players from stale packets/peers;
ordered sequence numbers fence delayed relay snapshots from current direct data.
Hosts expire after 30 seconds without contact; guest seats expire after 18 seconds.
Public lobby names/callsigns are visible to other visitors, so use a nickname.

Local `server.mjs` uses the same protocol with an in-memory room store. Browsers
must connect to the same server to discover each other; separate localhost
servers do not share rooms. Sites uses its durable D1 binding for the shared
room directory and relay snapshots.

## Rebuilding the Sites deployment

`npm.cmd run build:site` prepares `sites/blackwater/public` and the generated
HTML/API modules from the canonical root sources. It uses only the dedicated
`dist/sites-stage` subfolder and leaves the running local game's main dist intact.
The Sites wrapper is a Vinext Worker with an ASSETS binding and D1 `DB`.
Install/build and publication use the Sites plugin's official helpers.

The local legacy game remains bundled in the ordinary root build. The hosted
Blackwater build omits the legacy entry and its optional 34 MB boss model to
respect the platform's per-file asset limit. Blackwater's island, weapons,
survivor, infected, textures and sounds remain locally bundled in the deployment.

`npm.cmd run test:blackwater:coop` launches two isolated browser contexts and
checks discovery, departure, actual movement, shared combat/mission/vehicles,
live-menu recovery, solo-save isolation and host disconnect. `PLAYWRIGHT_PATH`
and `CHROME_PATH` select the local QA tools. `BLACKWATER_QA_URL` targets a built
preview or deployed game; `BLACKWATER_FORCE_RELAY=1` tests without WebRTC;
`BLACKWATER_EXPECT_DIRECT=1` requires a direct connection.
