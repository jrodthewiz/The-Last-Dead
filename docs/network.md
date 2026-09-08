# Dead Arrival peer transport

`peer.js` provides a small host authoritative WebRTC transport. It does not
own player state, simulation, interpolation, or a room directory. The host is
the authority by convention: the game can send input messages from the guest
and snapshots/events from the host over the same ordered, reliable channel.

## Manual signalling

No signalling server is required for the initial two player flow.

1. Create a host session and copy the string returned by `await host()`.
2. Paste that string into the guest and call `await guest.join(offer)`.
3. Copy the returned answer back to the host and call `await host.accept(answer)`.
4. Wait for `onConnect` on both peers, then call `send(object)`.

The offer and answer are compact JSON envelopes containing protocol version,
SDP type, and SDP text. `join()` and `accept()` also accept the corresponding
raw `v=0` SDP text for integrations that already have a signalling form.
ICE candidates are gathered before each string is returned (up to eight
seconds by default). If gathering times out, a bounded `ice-timeout` status is
reported and the gathered description is returned so a local candidate can
still connect.

## API

```js
import { PeerSession } from './peer.js';

const session = new PeerSession({
  onStatus: (state, event) => console.log(state),
  onMessage: object => receive(object),
  onConnect: session => startOrResume(session.role),
  onDisconnect: event => stopRemote(event.reason),
  // Optional production relay configuration:
  // stunUrls: ['stun:stun.example.invalid:3478'],
  // turn: { urls: 'turn:relay.example.invalid:3478', username, credential },
});

const offer = await session.host();       // host only
const answer = await session.join(offer); // guest only
await session.accept(answer);             // host only

session.send({ t: 'input', i: { forward: 1 } });
console.log(session.role, session.connected, session.rtt);
session.close();
```

`PeerSession` uses an ordered, reliable DataChannel named
`dead-arrival-v1`. `send()` accepts a JSON-safe plain object and returns
`false` when disconnected, malformed, oversized, or over the backpressure
limit. The default complete message limit is 128 KiB (configurable between
4 KiB and 512 KiB). The transport does not interpret `t`, so input, events,
and snapshots can use the same API. Keep snapshots bounded and send only the
latest useful state when `send()` reports backpressure.

The internal handshake validates protocol version 1 before `onConnect` fires.
Ping/pong messages update the `rtt` property in milliseconds. Application
messages never expose internal handshake messages to `onMessage`.

TURN credentials may be passed through `turnUrl`, `turnUsername`,
`turnCredential`, or a `turn` object. They are used to construct the browser's
`RTCPeerConnection` and are not retained in the session object, written into
the SDP envelope, or persisted by this package. The default STUN server is
Google's public `stun:stun.l.google.com:19302`; pass `stunUrls: []` for a LAN
only test.

## NAT and relay limitation

This is a real peer-to-peer connection, so restrictive or symmetric NAT,
firewalls, and networks that block UDP may prevent a direct connection. The
transport does not silently fall back to a game server. Configure a reachable
TURN relay for those networks, and use HTTPS or localhost when a browser's
secure-context policy requires it. The local test only proves two Chromium
contexts on the same machine; it does not prove a cross-internet route.

## Static server and build

From this directory:

```powershell
npm run build
npm run serve                 # 127.0.0.1:5200 by default
node server.mjs --port 5201 --dist .\dist
```

`server.mjs` serves only files inside the resolved `--dist` root, rejects
encoded traversal and NUL paths, sets explicit MIME types, and uses no-cache
for HTML plus a one-hour cache for other assets. `build.mjs` copies only the
listed runtime files and `vendor`, `assets`, and `public` directories into its
own `dist` folder.

## Browser test

The test starts an ephemeral loopback server, launches the installed Chrome
executable in two isolated contexts, performs offer/answer copy/paste in
memory, sends an event and five snapshots, checks order and RTT, rejects an
invalid top-level payload, and observes disconnect:

```powershell
$env:FINDLE_PLAYWRIGHT_PATH = 'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright'
npm run test:network
```

The test requires Chrome at the standard Program Files location or an
explicit `CHROME_PATH`. It is intentionally not run as part of the static
build.
