# Dread iteration 02 final visual gate

Date: 2026-09-23  
Scope: strict image-only review of the final production captures against the baseline and material-check set

The final set contains meaningful player-visible gains. The evaluation below is based on the rendered captures, not on implementation claims or runtime batching details.

## Scores and target status

Score key: 0 = absent/unreadable, 1 = weak/ambiguous, 2 = readable with defects, 3 = clear and consistent.

| Area | Score | Target status | Final evidence |
| --- | ---: | --- | --- |
| Blood impact readability | **2/3** | **Partial** | [`blood-hit.png`](final/blood-hit.png) now shows a small red contact cue at the enemy's lower torso/leg and red at the feet. [`blood-residue.png`](final/blood-residue.png) and [`corpse-side.png`](final/corpse-side.png) show the blood trail/pool tracking the body after it reaches the ground. The immediate cue is still small and competes with the red floor wash, so the hit is readable but not yet unmistakable at this distance. |
| Weapon material/mechanism readability | **2/3** | **Partial** | [`weapon-1-idle.png`](final/weapon-1-idle.png) and [`weapon-4-idle.png`](final/weapon-4-idle.png) now show a usable material hierarchy: rough dark casing, brass/metal rings, pale top modules, red accents, and the wrapped hand/sleeve separate from each other. [`weapon-4-action.png`](final/weapon-4-action.png) has a clear orange firing event, but [`weapon-1-action.png`](final/weapon-1-action.png) remains close to [`weapon-1-rest.png`](final/weapon-1-rest.png), with light/tracer changes carrying the state rather than a visibly moving mechanism. |
| Enemy close-range appearance/motion | **2/3** | **Partial** | [`scene-after.png`](final/scene-after.png) is a clear improvement over the earlier pale distant figures: the enemies now read as dark bodies with small face highlights. [`attack-windup.png`](final/attack-windup.png), [`attack-commit.png`](final/attack-commit.png), and [`attack-recover.png`](final/attack-recover.png) show a tilted head and pose changes, but the torso and upper limbs remain strongly pale and the body stays mostly upright. The groundfall target is met: [`blood-residue.png`](final/blood-residue.png) and [`corpse-side.png`](final/corpse-side.png) show the corpse fully contacting the floor rather than merely bending while standing. |
| Overall atmosphere | **2/3** | **Partial** | The darker enemy treatment, grounded corpse, and persistent blood make [`scene-after.png`](final/scene-after.png) and [`corpse-side.png`](final/corpse-side.png) feel more authored and consequential. The catacomb still has crushed blacks, repeated empty bays, a large lower-right weapon, and a heavy HUD footprint; the space remains moody but not yet richly specific as a mortuary. |

## What genuinely landed

- Body-following blood is visually credible enough to pass as a causal chain: contact appears on the target, then the residue and pool remain where the body ends up.
- The corpse is now visibly grounded. In `corpse-side`, the body lies on the floor with the blood concentrated around it; this fixes the prior standing/bowed corpse read.
- The enemy silhouettes in the wide scene have moved away from the uniformly white mannequin read. Dark clothing and face highlights survive at range.
- Weapon materials are easier to parse in idle, and weapon 4 has a strong, immediately visible action event.

## Remaining visible deficits

- The close enemy remains overexposed through the torso and upper limbs. The head tilt communicates a beat, but the pale body still loses clothing and anatomical planes in the windup/commit/recover sequence.
- The blood-hit contact cue is present but undersized and low contrast against the floor wash. It reads after inspection; it does not yet win the eye instantly at the target distance.
- Weapon 1 still has no clearly verifiable mechanical state change between idle, action, and rest. Weapon 4's orange disc is a good event cue, but it also reads primarily as an effect overlay.
- Black crush and sparse repeated architecture continue to cap atmosphere at 2/3. A future visual pass can lift focal planes or give the console/room one stronger readable anchor, but this review does not call for a new environment scope.

These are bounded polish deficits. They do not invalidate the landed blood-follow, groundfall, or enemy silhouette improvements, and they should remain recorded as follow-up polish rather than trigger a new mass asset pass.
