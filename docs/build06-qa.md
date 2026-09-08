# Build 06 campaign and co-op QA

Final update: campaign and co-op gameplay checks pass after two runtime fixes.

## Automated checks

- Engine: 20/20 passed, including movement, wall occlusion, weapon combinations, bounded effects, campaign director and owner-only rocket airburst.
- Campaign integration: 3/3 passed. All nine waves complete through ticks and actual shots, with safe telegraphs, active caps, variant progression, sector transitions and final victory.
- Model checks: Bellwraith and Reliquary constructors, finite geometry, bounds, animation and repeated muzzle pulses pass. Final visual corrections have 13,378 and 18,868 triangles respectively.
- Survivor geometry and articulation checks pass.
- Production server: public PORT binding and required runtime HTTP routes pass.
- Real two-context WebRTC transport passes.

## Co-op browser regression

The isolated Chrome UI test reports: `Co-op UI test passed against http://127.0.0.1:5200.`

Coverage includes manual offer/answer connection, guest keyboard movement, remote direct fire, guest rocket splash ownership, synchronized explosion effects, both players entering the Ossuary, terminal state and disconnect.

The test exposed and resolved:

1. Guest rocket splash previously credited host style instead of the projectile owner. Owner-aware damage now preserves guest credit while keeping authoritative world effects.
2. Signaling text fields retained keyboard focus. `resetInput()` blurs form fields when entering gameplay.
3. Seven invalid world-builder calls froze rendering on the Ossuary transition. The calls now pass geometry/material arguments correctly.

The regression fixture also now uses the director's actual `exit` state when arranging its controlled sector-transition check.

## Visual and audio evidence

Nine standalone model views compile without failed shaders or page errors; see build06-reviews and build06-art/factory-visual-correction.md. Controlled gameplay captures and diagnostics are recorded in build06-game-* artifacts. These are controlled browser checks, not a complete human campaign playthrough.

All 25 sound files pass full decoding and all 35 manifest entries decode in Chrome. Audio provenance is in audio-sources.md.

## Limits

No broad internet NAT, device or stable frame-rate certification is claimed. WebRTC may require a TURN relay on restrictive networks; none is provisioned. The art is a stylized procedural reconstruction, with substantial room for further sculpt/material refinement.
