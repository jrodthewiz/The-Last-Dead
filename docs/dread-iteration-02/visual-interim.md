# Dread iteration 02 interim image review

Date: 2026-09-23  
Scope: image-only comparison against the prior visual baseline

## Visible wins

- [`attack-commit.png`](material-check/attack-commit.png) has a small but real readability gain over the baseline: the pants and lower limbs fall into darker values, the face has more shadow, and the outline separates from the corridor. The actor is still pale overall, but it is less uniformly clipped than the earlier all-white read.
- [`blood-residue.png`](material-check/blood-residue.png) and [`collapse-transfer.png`](material-check/collapse-transfer.png) retain a strong floor trail. The collapse-transfer frame also adds individually readable red motes, so the aftermath has more energy than the original residue frame.
- [`weapon-4-action.png`](material-check/weapon-4-action.png) has the clearest firing event in this set: the orange circular muzzle event and warm top highlights separate from the idle silhouette. This is a useful visual win, although it still reads more like an overlay than a confirmed mechanical movement.

## Open regressions / remaining gaps

- The actor is still too pale in the torso, hands, and upper limbs in both [`attack-commit.png`](material-check/attack-commit.png) and [`collapse-transfer.png`](material-check/collapse-transfer.png). The face has more structure, but the full-body white response still makes the enemy read as a lit mannequin before it reads as a threatening body.
- [`blood-hit.png`](material-check/blood-hit.png) still does not show a convincing contact event. The aim line and broad red floor lighting are visible, while the actual blood is a faint patch at the feet with no clear wound or splash at the struck body point. The residue is readable later, so the cause/effect chain remains delayed.
- The attack pose remains mostly upright, with the ring doing much of the timing work. This review cannot establish motion from stills; the visible commit frame still lacks a strong forward weight shift or reaching silhouette.
- Weapon 1 remains effectively the same silhouette between [`weapon-1-idle.png`](material-check/weapon-1-idle.png) and [`weapon-1-action.png`](material-check/weapon-1-action.png); the red tracer/lighting changes, but no part movement is visually verifiable. Weapon 4 is clearer because of the muzzle disc, not because a moving sub-part is obvious.

## One next intervention per priority

### Enemy: one tonal/material pass on the actor

Lower the actor's global white response and preserve only a controlled edge or face catch, keeping dark clothing seams and limb planes visible. This targets the remaining pale-mannequin problem without changing the model or animation.

Pass condition: in the attack-commit and collapse-transfer captures, the torso and limbs retain at least two clear value bands and readable clothing/face planes; the body remains visible against the corridor without becoming a flat white cutout. The red attack ring may reinforce timing, but it should not be the dominant evidence that the actor is attacking.

### Blood: one body-anchored contact cue

Add a compact, high-contrast dark-red splash or wound cue at the actual struck body point and let the broad floor wash recede behind it. The cue should be attached to the hit location, rather than relying on extra free-floating motes or a brighter global red pulse.

Pass condition: the `blood-hit` capture shows the hit on the enemy without reading the HUD, tracer, or floor light; the following residue capture still shows the trail beginning at the victim/contact area. A faint floor patch alone does not satisfy the pass.
