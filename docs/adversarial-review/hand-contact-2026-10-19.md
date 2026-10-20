# Hand contact and impact birth pass — 2026-10-19

## Observed defects and correction

Full-resolution ordinary and neutral side views resolved ambiguities left by
small motion sheets. Carrion presented an open palm beside its charging knob;
Mourning's wrist/palm overlapped the receiver. Both were actual contact defects.
The Ripper's forearm masked its pouring action. The Carbine's static, unrotated
wrist offset could not follow the support hand through its charging rotation.
The large octagonal end seen in the Carbine neutral side view was an exposed
elbow/root cap, not evidence of an ordinary gameplay wrist gap.

`island/rifle-reload.js` now owns the two rifle reloads. Each hand follows a
contact anchor parented to its actual moving knob. The measured finger/palm
basis supplies an overhand hook; articulated fingers close and the thumb
opposes before the existing arm solver seats the wrist. Finger posing occurs
after authored clip sampling and before grip solving, without feeding solved
poses back into the animation transition cache. No extra hand mesh or alternate
skeleton is introduced.

The hook closes by reload0.77, before the bolt pulls at0.78-0.83. The bolt returns
at0.85-0.90; fingers release at0.90-0.935 while the hand stays at the control;
then the hand returns to the foregrip at0.935-1. Existing reload duration and
ammunition completion remain authoritative. The end pose matches the original
foregrip rather than returning briefly toward the magazine and snapping home.

The Carbine derives both sleeve/wrist endpoints from the actual hand-local
joint, transformed by the hand pose. A tapered sleeve, small rolled seam and
faceted rounded wrist transition replace the abrupt cylindrical join. The
original matte wood, metal, cloth and skin palette is retained.

Ripper's fuel cap now sits on a supported top filler neck, with a visible dark
mouth. The old cap was inside the casing envelope. A sideways unscrew/lift and
flask tilt place its outlet at the opening; the pouring hand approaches from
the side while the rear hand holds its existing throttle. This makes the
operation readable without replacing the N64 model or its continuous motor grip.

## Contact feedback

New impact births previously changed pool colours immediately but waited for
the next physics update to replace instance transforms. This could delay the
contact burst and briefly recolour an old location when a live slot was reused.
Particles, fans, cases and surface marks now commit birth transforms immediately;
physics still advances once. The asymmetric fan starts small but visible, then
expands and expires at its existing short lifetime. Fast droplets stretch along
their velocity for their first140ms and become coarse falling facets. Existing
pool capacities, palettes and shader-colour preparation remain unchanged.

## Verification and evidence

- 105 Blackwater checks pass, including real GLB hand rigs at30/60/120Hz for
  calibrated finger-contact/control alignment, anatomical wrist limits, release ordering,
  return to the foregrip and cancellation. Pool tests verify immediate visible
  birth, reuse at the new location and no unintended physics advance.
- Gameplay input and first-person verification pass their release, multitouch,
  reload completion, camera/animation and floor support checks.
- Full-resolution before/after fixtures: `output/hand-contact-pass/baseline/`
  and `final-poses/`, with normal and neutral views at selected reload phases.
- `output/hand-contact-pass/motion/`:28 recorded actions for Carbine, Carrion,
  Mourning, bat and Ripper across desktop, portrait and landscape. Includes
  actual hits, three-hit/three-miss bat repeats, sustained fire, ADS, reloads,
  reduced-motion examples and actual touch fire buttons; no JS/HTTP errors.
- `final-reloads/` records the final separate close/pull/release/return order
  for both rifles in the three aspect ratios, with live control-gap telemetry.
  All six pass with no JS/HTTP errors; maximum locked calibrated contact-point
  gap is0.062mm. This is a rig-point measurement, not a skin-surface tolerance.

All recordings use owned background-input-guarded headless contexts, with
uninterrupted full-page25fps video and per-frame telemetry. Timestamped sheets
are extracted after recording. Static inspection and decoded40ms frames do not
establish native-speed human playback, audio mix quality, physical-device touch
or performance. The user's port5200 server and existing tab remain intact.
Scratch is bounded to320MiB/240files; rejected intermediate pose trials were
retired after the final poses were verified.

## Independent review

The existing `character_presentation_owner` and `modern_warfare_feel_judge`
agents reviewed read-only, with focused construction, contact, motion and
feedback briefs. They confirmed the baseline defects from full-resolution
views; final sequence conclusions follow below. This is a focused review,
not a full-council or blanket artistic approval of the complete game.


### First-person feel / framing lens

The reviewer found no remaining confirmed blocker in the focused changes after
source, full-resolution pose pairs and recorded-frame review. The old palm-up
charging gesture is replaced by curled control contact; the Ripper's spout and
housing are visibly separate from the pouring forearm. Bat and sustained saw
hits remain localized, with an asymmetric birth fan and falling facets. The
new birth helpers resolve the stale/delayed pool-transform path.

Remaining artistic risks are foreground sleeve bulk, touch controls obscuring
some narrow-view charging detail, and late blood facets reading like small
red chips. The strongest defenses are the readable ordinary desktop action,
stable aim, short contact fan and deliberately coarse palette. These did not
establish a mechanical defect. A native-speed portrait reload and close-combat
session would change the verdict if actions or threats become hard to identify.

### Character / hand-motion lens

The second reviewer independently confirmed that full-resolution83% poses fix
the open-palm and receiver-intersection contradictions. The small-control grasp
reads as a two-finger hook, with the wrist outside the receiver. Carbine's
ordinary wrist join is connected; the neutral-view elbow/root cap is not an
ordinary wrist fault. Ripper's supported filler neck and separate spout resolve
the previously hidden pour action. Its rear hand stays on the throttle.

Final ordered rifle frames show continuous hook, pull and foregrip return,
without a confirmed contact blocker. A pronounced sleeve/elbow bend and large
pouring forearm remain stylistic construction risks. These reviews do not
certify the entire arsenal or professional parity.

Encoded sheet PTS labels are not the simulation clock. Use JSON telemetry and
unit checks for release ordering, ammunition completion and contact-point
measurements; use the decoded frames for visible transitions. Late sheet panels
still show00/999 despite completion in the live telemetry, so they cannot be
used to assert the refill event time. Neither reviewer claims native playback,
audio quality, subjective input feel or performance approval.
