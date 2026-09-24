# Dread iteration 02 behavior baseline

Date: 2026-09-23  
Judge: independent read-only behavior audit  
Scope: real hit reaction, death/collapse transition, melee timing/contact, and flesh impact readability

This review uses the current working source, the existing `actions-qa.json` trace, and the supplied action/blood stills. No browser or Blender process was launched. The only runtime check was an engine-only Node reproduction against `makeCourse(0)`; it does not depend on renderer state.

The repository engine suite also passes (`npm run test:engine`: 20/20). That suite covers the intended telegraph/contact and blood contracts, but it does not assert the ordinary-hit-during-windup case described below.

## Findings

### 1. An ordinary hit does not interrupt a committed attack, so HitRecoil can hide live contact

`engine.js:120-139` (`damageEnemy`) records `flash` and increments `hits`, but it does not set `stagger` or clear `attacking`, `windup`, or `strike`. The attack path in `engine.js:546-564` can therefore release the same swing and call `hurt()` after the enemy has already been hit. In parallel, `npc-afterlife-model.js:233-255` sees the hit edge, stops the attack one-shot, and starts HitRecoil. The player can consequently see a recoil response while the simulation is still carrying out the old lunge.

The engine-only repro placed the player at `(6,5)` facing a stalker at `(6,4.35)`, started an attack with `attack:0`, fired Ossuary during the `.2633 s` windup, then advanced 24 frames at `1/60 s`. It produced:

```text
after shot: hits=1, enemy hp=97, attacking=true, windup=.2633
after 24 frames: enemyAttackEvents=1, strike=.1067, slashHit=true, player health=88
```

This confirms that the hit event is real and the melee contact is real, but their visible and authoritative states can disagree. The current `actions-qa.json` is a useful positive trace for an uninterrupted attack (`windup` → `strike` → `recover`); it does not cover a hit during windup or strike.

Acceptance for a follow-up: a shot during windup either visibly leaves the attack active through its contact window, or the real hit cancels the attack in both places. A focused trace should assert the pair together: `hitActive`/`attackActive` and the absence or presence of `enemy-attack`, `slashHit`, and player damage according to the chosen rule.

### 2. Flesh impact is visually subordinate to the red tracer

`engine.js:416` marks a hitscan tracer as `surface:'flesh'` when it reaches an enemy. `combat-vfx.js:19-28` still renders every tracer as a bright additive `ColoredBulletTracers` beam and white core; the first weapon color is `0xff3154`, with a `.018` local beam width. `impact-vfx.js:36-46` adds one short-lived flesh plane (`.19-.28 s`) and nine small drops. The event is present, but its visual hierarchy makes the beam the dominant hit cue.

The supplied [`blood-hit.png`](../dread-refinement/blood-hit.png) visibly shows a continuous red line from the weapon to the enemy chest, while no compact wound or spray can be identified at the contact point. The paired trace records `splashes: 1`, `drops: 9`, and `gore: 12`, so this is a presentation/readability limitation rather than a missing damage event. [`blood-kill.png`](../dread-refinement/blood-kill.png) improves the airborne debris and floor stain, but the bright line still owns the first read. [`blood-residue.png`](../dread-refinement/blood-residue.png) communicates aftermath more successfully than the hit moment.

Acceptance for a follow-up: the flesh cue must remain legible as a localized contact effect when the tracer is present, and it must be distinguishable from the red muzzle/tracer line. A matched `blood-hit` still should show the contact cue without relying on the HUD or the floor wash.

## Verified state and lifecycle notes

- `actions-qa.json` shows the authored attack one-shot active during windup and commit, then idle after recover. The same trace shows a real nonlethal hit with `hitActive:true`, hit weight `0.392...`, and the authored `AshWitness_HitRecoil` clip advancing.
- `engine.js:132` marks a lethal damage event `dead=true`; `npc-afterlife-model.js:240-247` starts `AshWitness_Collapse` once and gives it full collapse weight. The supplied `blood-residue.png` visibly shows the forward folded result, so the death trigger and collapse pose are present.
- The model death branch intentionally leaves the root visible at its final collapsed pose. `renderer.js:1438-1440` keeps dead IDs in the visual map, so corpses persist across the current wave and continue through the dead branch. That may be the intended arena aftermath; it is a lifecycle choice to confirm, not counted as a third finding here. If corpse persistence is retained, a later bounded-wave check should measure dead visual count and mixer/update cost.

## Follow-up contract verification

After the parent implementation kept committed attacks authoritative and visible, the focused [`afterlife-hit-contract.test.mjs`](../../tests/afterlife-hit-contract.test.mjs) passes 3/3 cases: a real shot during windup preserves `attackActive:true` and `hitActive:false` through the real slash contact; a real parry cancels contact and starts recoil; an idle real hit starts recoil; and a lethal real shot starts collapse. The existing `afterlife-character-runtime-check.mjs` and engine suite also pass. The parent VFX change shortens/fades ballistic tracers and enlarges the flesh splash, but that visual result still needs a fresh matched capture because this audit did not launch a browser.
