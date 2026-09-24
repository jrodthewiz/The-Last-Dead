# Dread iteration 02 visual baseline

Date: 2026-09-23  
Judge: independent image review  
Capture size: 1536 x 864

This is an independent read of the supplied captures. The review uses the visible result only; implementation details and triangle counts are not evidence of visual success.

## Score key

0 = absent or unreadable  
1 = weak or ambiguous  
2 = readable and functional, with visible defects  
3 = clear, strong, and consistent

| Area | Score | Image evidence |
| --- | ---: | --- |
| Blood impact readability | **1/3** | [`blood-hit.png`](../dread-refinement/blood-hit.png) has a readable red beam/crosshair and broad red floor wash, but no unmistakable localized wound or spray at the contact point. [`blood-residue.png`](../dread-refinement/blood-residue.png) finally communicates blood through a strong floor trail, so the aftermath reads better than the impact. |
| Weapon material/mechanism readability | **1/3** | [`weapon-1-idle.png`](../dread-refinement/weapon-1-idle.png) and [`weapon-4-idle.png`](../dread-refinement/weapon-4-idle.png) have distinct silhouettes and red/brass accents, but the casing, front aperture, hand, and wrap collapse into near-black. The action frames add color and light (`weapon-1-action.png`, `weapon-4-action.png`) without showing a clear mechanical state change. |
| Enemy close-range appearance/motion | **1/3** | In [`attack-commit.png`](../dread-refinement/attack-commit.png), the enemy is recognizable but the face and torso clip toward a flat white shape. The attack ring is the clearest commitment cue; the upright body and small arm extension do not yet sell a physical lunge. [`blood-residue.png`](../dread-refinement/blood-residue.png) has the same overexposed, low-detail body read. |
| Overall atmosphere | **2/3** | [`scene-after.png`](../dread-refinement/scene-after.png) establishes a coherent dark catacomb palette with red/cyan accents, an arch, tiled floor, and distant figures. Black crush, repeated empty bays, and the large HUD/weapon footprint make the space feel closer to a sparse test arena than a specific mortuary. [`mortuary-console.png`](../dread-refinement/mortuary-console.png) supports the mood but the console is too dark to function as a focal story prop. |

## Next bounded pass: player-visible priorities

### 1. Make the hit read at the moment of contact

The current hit image communicates that an attack happened through the beam, crosshair, and red lighting, while the actual blood event is delayed until the residue capture. That weakens the cause-and-effect feeling of shooting a body.

Pass criteria:

- The hit capture contains one compact, localized blood/wound/spray cue anchored to the enemy contact point. It must remain legible without reading the HUD or the weapon readout.
- The localized cue is visually separate from the red muzzle/tracer line and the broad floor lighting pulse; a red wash by itself does not count as the hit.
- The next residue capture shows the blood trail or decal originating from the victim/contact area, with a direction and scale that are easy to connect to the hit.

### 2. Make the close enemy dimensional and physically threatening

The attack-commit frame currently asks the red ground ring to carry the threat. The enemy's high exposure removes facial, clothing, and body-plane information, while the pose stays nearly upright.

Pass criteria:

- Face, clothing, and torso retain visible light/dark separation instead of a near-white silhouette; the silhouette should still read against the dark corridor.
- The commit pose shows a clear forward weight shift, reach, tilt, or raised limb that reads as an attack before the ring is noticed.
- A before/commit pair shows a visible pose or position change. The ring can reinforce timing, but it cannot be the only evidence of the attack.

### 3. Give the weapon a readable material hierarchy and one readable mechanism event

Both weapons have useful silhouettes, but most of the player-visible surface is an uninformative dark mass. In the action frames, red/orange emission tells the eye that something happened while the chamber, aperture, or top assembly appears unchanged.

Pass criteria:

- In idle, the main casing, metal/brass hardware, and wrapped hand/cloth read as separate material zones under the existing scene light. The front aperture has visible depth instead of reading as a flat black hole.
- In action, one specific part visibly changes state (for example, a chamber, bolt, top plate, or muzzle assembly). The flash should accent that motion rather than replace it.
- The weapon keeps its distinctive silhouette and does not obscure the enemy's center mass during the brief action cue.

## Atmosphere hold note

The atmosphere already reaches a usable 2/3. A small value correction can be folded into the bounded pass if cheap: preserve the dark perimeter while lifting the console or floor focal plane enough to reveal shape. Broad environment dressing should wait until impact, enemy, and weapon cause-and-effect are readable in the same capture set.

## Recheck set

Repeat the same nine captures after the pass: `scene-after`, `blood-hit`, `blood-residue`, `attack-commit`, both idle/action pairs for weapon 1 and weapon 4, and `mortuary-console`. The pass succeeds when the three priority criteria are visible in stills without relying on implementation notes.
