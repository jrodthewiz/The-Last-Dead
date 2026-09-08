# Build 05 — Ossuary

The starter revolver is now an original bone-forged death gun reconstructed in Three.js from generated concept art using the img2threejs intake/spec workflow. It retains the revolver's accurate hitscan and coin ricochet mechanics.

## Changes

- Skull muzzle, fangs, vertebral rail, rib cage around six luminous chambers, ridged horn, wrapped grip and an FPS-facing death mask. Chamber rotates on firing; recoil moves the weapon back without moving aim.
- Bone, leather and metal have independent relief/roughness data. The roughness map uses RGBA so the shader reads its green channel correctly. Static surfaces are batched within semantic parts, retaining independent chamber animation.
- Crimson revolver tracers, amber shotgun trails, cyan rail beams and gold ricochets have bright cores and short fades. Tracer endpoints are still authoritative simulation hits.
- Muzzle embers, bounded impact sparks, blood velocity streaks, and blood spray at the actual bullet-hit height. Ordinary hits now show a hit marker. Gore-off also hides the new blood streaks.
- Ossuary HUD name and portrait framing adjustment.

## Verification

16 engine tests passed, including hit-height blood, tracer identity and effect expiration. A separate headless browser test used real mouse firing against a controlled target: 100 to 97 HP, 12 blood particles, an enemy-hit crimson tracer, no page errors. Screenshots freeze combat immediately after the hit to inspect transient effects. Two-browser co-op passed. The full combat simulation still cleared all 18 enemies across three waves with 85 health.

The reference and reconstruction review are in [ossuary/](ossuary/reconstruction-review.md). The model is a stylized interpretation, not an exact mesh extraction or certified pixel match; fine bone engraving remains approximate. [Gameplay evidence](ossuary/game-results.json).
