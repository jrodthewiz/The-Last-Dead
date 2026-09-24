# Melee implementation verification — September 23, 2026

This pass uses isolated Chrome contexts against the production build at
`http://127.0.0.1:5200/dist/`. The user's open game tab and server are preserved.

**Result: PASS.** Production build succeeds; 73/73 focused regressions pass.
The final touch and co-op run completed 100 alternating attacks over 120.393
seconds, with zero page, console, HTTP, or transport errors. The guest received
2,173 messages, including the 49,184-character probe. Sampled renderer counts
stayed at 909 geometries and 100 textures. All four melee audio-source counts
were zero after final cleanup, and disconnect returned the host to solo play.

## Issues found and fixed

- A stopped chainsaw's chain still advanced slowly. The chain now initializes
  once and advances only while the motor is active or winding down. The unit
  and touch-browser checks cover the idle and released states.
- PeerJS's JSON serializer rejected messages at 16 KiB, eventually freezing
  the guest's world as combat residue accumulated. The connection now uses
  the bundled BinaryPack serializer, which chunks and reassembles messages.
  The existing 128 KiB application limit and backpressure guard remain in use.
- A quick guest trigger press could be replaced by its release before the
  host's next simulation step. Discrete trigger edges now survive until that
  step. Weapon changes cancel them; chainsaw primary remains held input.
- Active dungeon-room detection now checks authored room footprints as well
  as bounds, keeping clipped room corners outside room progression. Rooms
  without footprints retain their existing bounds behavior.

## Evidence

- `unit-results.txt`: focused engine, rifle, melee, animation, audio, VFX,
  batching, signaling, and room-footprint regressions.
- `desktop/qa-results.json`: real keyboard/mouse attack timing, heavy strike,
  corpse settling, saw cadence/release/shove, wheel wrap, restart, pause,
  death, disposal, rendered pixel checks, and all 126 audio entries decoded.
  Thirteen adjacent PNGs capture bat and chainsaw poses and impacts.
- `final/qa-results.json`: real touch events in portrait and landscape,
  cancellation, stopped-chain behavior, and two separate browser contexts
  joined through the game's room-code UI and real WebRTC data connection.
  Co-op checks include a 49 KiB delivery probe, authoritative hits and impact
  sounds, bat tap delivery, cancellation after switching, saw release, pause,
  two minutes of alternating attacks, audio-source cleanup, and disconnect.
- `coop-diagnostic/qa-results.json`: retained reproduction of the original
  16 KiB failure, including the transport's "Message too big for JSON channel"
  errors. Earlier `input-coop/` and `coop/` runs are diagnostic attempts, not
  the final acceptance report.

The desktop contact, chainsaw contact, and settled-corpse screenshots were
visually inspected. Grips stay connected, the bat crosses the reticle, the saw
retains a readable forward blade, and melee contact does not emit gun beams.
The reaction is an additive skeletal and collision-proxy effect; it is not a
full rigid-body ragdoll simulation.

## Repeat the lightweight checks

Set `PLAYWRIGHT_PATH` and `CHROME_PATH` to local installations if they are not
available through defaults. No browser install or server restart is needed.

```powershell
node build.mjs
node --test engine.test.mjs tests/rifle-combat.test.mjs tests/melee-combat.test.mjs tests/melee-reaction.test.mjs tests/afterlife-hit-contract.test.mjs tests/melee-model.test.mjs tests/melee-audio.test.mjs tests/build10-vfx.test.mjs tests/weapon-batching.test.mjs tests/signaling.test.mjs tests/dungeon-footprint.test.mjs
$env:DEAD_ARRIVAL_URL='http://127.0.0.1:5200/dist/'
$env:MELEE_QA_OUTPUT='docs/melee-pass/verification/desktop'
node tests/melee-game.mjs --audio
$env:MELEE_QA_OUTPUT='docs/melee-pass/verification/final'
node tests/melee-input-coop.mjs
```

`--mobile-only`, `--coop-only`, and `--skip-soak` narrow the second browser
script when investigating a particular failure. The full invocation is the
acceptance run. Fixed encounter placement is used to make hit checks repeatable.
Touch is Chrome emulation, and the WebRTC peers run on this computer; this is
not a physical-phone or wide-area-network performance certification.

## QA guidance ledger

Applied `threejs-qa-release` and `threejs-debug-profiler`, including their
playtest, production-build, visual-verification, scene-debugging, and mobile
input checklists. No new graphics assets were sourced in this verification
pass; model and sound provenance remain in the parent melee documentation.
