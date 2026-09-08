# Build 09 ? Steady Hands

This pass refines the existing first-person weapons and fixes shot alignment. No new paid generation or reference reconstruction is claimed.

## Changes

- Hitscan endpoints follow the same pitched ray as damage. Downward rays intersect the floor; upward endpoints no longer snap to a fixed height.
- Tracers record shooter identity and capture their originating weapon's muzzle once. Movement, turning and switching weapons do not drag existing beams. Ricochet segments retain world origins.
- Guest identity is explicitly peer on snapshot application, keeping local/remote FX ownership correct.
- Rockets launch on the camera ray without a horizontal-only offset that could bypass close cover. Shotgun core horizontal velocity now accounts for pitch; its upward lob and gravity remain intentional.
- Projectile trails grow with projectile age, avoiding full-length tails behind the shooter at launch.
- Muzzle flash position and world orientation are sampled after weapon animation. Spinning the flash geometry no longer overwrites the socket orientation.
- Reduced barrel cant, weapon-specific recoil, steadier aimed posture, new gripping fingers/cuffs/forearm plates and rough leather/cloth materials. Arm ends extend below the first-person viewport. Removed the legacy survivor integration that silently replaced weapon-owned hands.

## Verification

- Production build and 34 Node tests passed: engine, campaign integration, model factories, four new alignment regressions, world batching and server behavior.
- `tests/build09-browser.mjs` uses the built runtime in isolated hardware Chrome. Six combinations of pitch and single-shot/rail weapons project authoritative endpoints to the crosshair with numerical error below 2e-15 NDC. Animated flash/socket separation is below 1e-13 world units.
- All four weapon views plus 390x844 framing captured in `build09/`. No page errors. Screenshots use a paused inspection fixture, not a full campaign playthrough.
- The existing real WebRTC test additionally asserts the guest's local shooter identity; it passed, including guest movement, gunfire, rocket kill credit, transitions and disconnect.
- Debug reference ledger: threejs-debug-profiler SKILL.md, references/debug-profile-checklists.md, references/checklists/scene-debugging.md. Checked shot coordinate ownership, update order, camera projection, asset/hand replacement, build output, console errors and viewport framing.

This is a targeted procedural first-person refinement. Shotgun spread and core gravity intentionally do not follow a single straight center ray. The first-person weapon remains a visual presentation; authoritative damage is camera-aimed.
