# Guns, menu, music and co-op upgrade

Four separate weapon passes retain the existing gameplay sockets and animate pooled effects without allocating geometry or materials on each shot.

- Ossuary: layered receiver, bone/brass hardware, moving bolt and trigger, hot muzzle core and smoke.
- Breach: receiver rail, shells and primers, bone spine, instanced hardware, flash petals and barrel heat.
- Arc: reactor baffles, rails and emitter detail, layered discharge; static surface merging reduces review draw calls from 130 to 68.
- Reliquary: receiver armor, barrel ribs and vents, bundled gunmetal/leather maps, muzzle and heat effects. Its texture readiness is included in renderer warmup.

The main menu is reduced to Play, Co-op, Settings and Controls. Settings keep labels, values and accessibility controls. The co-op panel uses one six-character host code and one join field, with Host, Join, Copy and Cancel.

Music uses two bundled CC0 tracks with scene-aware crossfades. Exact sources and license information are in audio-sources.md and assets/audio/music/LICENSE.txt. The local audio-review.html page auditions the scenes and sound pools.

## Verification

- Final combined engine, enemy-spawn and signaling suite: 27 tests passed.
- All 71 audio manifest entries decoded without errors; menu/play/pause/play/dead/win/menu scene routing passed.
- All four upgraded models visually reviewed in weapon-review.html; desktop menu/settings and 390 x 844 menu reviewed without horizontal overflow.
- First-shot integration check with spawned enemies: 19.1 / 23.5 / 22.1 / 12.5 ms for Ossuary/Breach/Arc/Reliquary; zero new shader programs. These are observations from this machine, not a universal frame-time guarantee.
- Public PeerJS broker: two browser pages connected using a six-character code and exchanged app messages in both directions.
- Actual Host/Join controls: both pages automatically entered play, guest received the shared peer state, and gameplay music scene was active.
- Signaling tests cover HTTP exchange/poll cancellation, immediate public peer allocation cancellation, and handshake timeout cleanup.
- Final production build passed; the built copy loaded and completed weapon warmup with no page errors or failed asset requests.

The public service handles rendezvous; gameplay travels over WebRTC. Separate physical networks were not available for this test. Restrictive NAT/firewall combinations can still require a configured TURN service. Solo play uses local bundled runtime assets.

Visual evidence is saved under .logs/*-upgrade-final.png, .logs/menu-mobile-final.png and .logs/guns-game-final.png. The existing user game tab was preserved.
