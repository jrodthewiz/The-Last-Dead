# Blackwater public co-op release — October 17, 2026

Public game: https://the-last-dead-blackwater.jrodonthebeat.chatgpt.site

The canonical source is published to `jrodthewiz/The-Last-Dead` on `main`.
Sites version 1 uses source commit
`8971d943c4c12746ad8a99558ae83d9b2732c737`, packaged by the official Sites
workflow and deployed successfully. The Worker owns the HTTPS room API and
uses its D1 binding; the island and all runtime assets are bundled static files.

## Verified before public deployment

- 85 Node checks passed: world, terrain/house collision, mission, inventory,
  movement/navigation, arms/recovery, public room protocol and lifecycle.
- Two independent real browser contexts passed the complete co-op journey
  against the built Vinext Worker and actual local D1 binding, once with direct
  WebRTC and once with WebRTC disabled to require HTTPS relay.
- Discovery hides full/started rooms. Solo departure is blocked. Host and guest
  start together and actual keyboard movement reaches the animated partner.
- Guest shooting is acknowledged once. Guest shove interrupts the host's
  infected attack; punch→Crimson holds, kills and releases the authoritative
  infected. Missed shots behind cover still produce shared enemy awareness.
- Guest fuse collection reaches shared mission state. Simultaneous truck entry
  yields one driver, and guest-driven vehicle poses reach the host.
- Inspection animations advance during co-op. Death from each live ancillary
  screen closes that screen and exposes Retry. Host disconnect returns the
  guest to an unobstructed title even with delayed DELETE cleanup.
- Existing host and guest solo save bytes remain unchanged through these runs.
- The original two-context PeerSession network test passes independently.
- No unexpected HTTP or page/console errors in either built D1 run. Neither
  renderer lost its WebGL context. The final D1 direct run needed no texture
  fallback; startup safely preserves authored colours if a texture cannot decode.

The focused judge identified and then cleared participant replacement,
delayed-HTTP status reversal and covered recovery screens. Regression tests
exercise replacement between polls and late waiting replies after direct start.

## Public deployment verification

The same two-context journey passed against the actual public HTTPS URL after
deployment. Its report has no unexpected HTTP/JavaScript errors or missing-texture
fallbacks. Direct gameplay worked, then deliberately closing the data channel
switched both clients to HTTPS relay and continued synchronized movement and
live-menu damage/recovery. Narrow 390×844 radio UI remained readable without
horizontal overflow; its Return control is reachable by scrolling the sheet.
The final judge accepted this scoped release with no confirmed blocker.

Local evidence is under `output/playwright/blackwater-coop/`: `d1-direct`,
`d1-relay`, and `public-direct`. The generated reports and finite captures are
ignored scratch, not dependencies of the published game.

## Practical scope

This release provides two-player cooperative expeditions, shared enemies,
objectives and vehicles, with personal supplies. Expeditions are session based;
there is no host migration, co-op save/resume or competitive anti-cheat claim.
WebRTC uses the original PeerSession transport; HTTPS remains available when
the network blocks direct connections. Relay action latency is greater, and the
fallback defensive test uses a longer visible attack windup. These are functional
journey checks, not an adverse-network or long-duration performance certification.
Physical phones, varied NAT/mobile networks, full co-op mission completion and
continuous remote-animation quality still need broader playtesting.

The player's existing local port 5200 tab/server was preserved throughout.
The public deployment contains the current co-op build; a local server started
before these changes loads the new API after its next deliberate restart.
