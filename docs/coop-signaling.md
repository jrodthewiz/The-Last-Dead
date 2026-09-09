# Co-op joining

The menu now uses a six-character room code. The host creates a code, sends it
to the other player, and the guest enters it once. `PeerJsSession` gives that
code to the public PeerJS cloud broker, which exchanges the WebRTC handshake;
gameplay snapshots and inputs continue over the ordered peer-to-peer data
channel.

The browser bundle is pinned in `vendor/peerjs.min.js` and is loaded lazily
only when Host or Join is pressed. Solo play does not contact the signaling
service. The default broker is `0.peerjs.com:443`, as documented by PeerJS.
Deployments that need their own broker can set
`window.__DEAD_ARRIVAL_PEER_CONFIG__` before `main.js` loads, for example:

```html
<script>
  window.__DEAD_ARRIVAL_PEER_CONFIG__ = {
    host: 'signal.example.com',
    port: 443,
    path: '/peerjs',
    secure: true,
  };
</script>
```

PeerJS is a signaling broker; it does not carry the game's data after the
connection is established. The public service and the short code are not an
account system or a secret. Restrictive NATs may still need a separately
configured TURN service through `config.iceServers`; free PeerJS TURN is not
assumed by this client.

For fully self-hosted deployments, `server.mjs` also exposes a short-lived
HTTP room broker at `/__dead_arrival/signal`. It exchanges the same SDP offer
and answer for the legacy `PeerSession` transport and is covered by
`tests/signaling-server.test.mjs`; the default game flow uses PeerJS so two
machines can join through the public broker without sharing local launcher
URLs.
