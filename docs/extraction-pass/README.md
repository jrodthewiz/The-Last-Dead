# Corpse extraction pass

Hold **G** beside a dead enemy while facing it, or hold the on-screen **EXTRACT** button on touch devices. Combat builds an unbanked style claim. The syringe draw, chest incision, and heart removal must finish before points are awarded. Releasing the button, moving, turning away, firing, or taking damage cancels the attempt. Each corpse can be extracted once.

The simulation assigns each corpse a stable seed. That seed changes draw speed and sway, incision angle and depth, pull arc, pulse, droplets, blood residue, and the heart bonus. The visuals use pooled procedural geometry; the audio uses pitch-varied bundled mechanism, wet impact, blood, and heartbeat samples. External asset-generation credentials were unavailable for this pass.

## Verification

- `npm test` passed: 20 engine tests and the two-context WebRTC check.
- `node --test tests/extraction.test.mjs tests/extraction-vfx.test.mjs` passed: 12 extraction tests, including scoring, cancellation, one-use corpses, auto-run, guest prediction, variation, and bounded VFX.
- `npm run build` passed.
- `tests/extraction-game.mjs` passed against `/dist/` in Chrome: all three visual stages, no early points, 187 points on completion, all five stage audio events played, no browser errors. The headless harness skips the optional shader warmup gate before starting gameplay.

The browser captures are [blood draw](blood-draw.png), [incision](incision.png), [heart removal](heart-rip.png), and [banked result](extracted.png). Machine-readable observations are in [qa-results.json](qa-results.json).
