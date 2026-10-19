# Salvage impact and recovery pass

The sword, hammer and pipe retain their existing damage, reach and legal attack
cadence. Their first-person presentation now distinguishes cutting through a
target from stopping and rebounding against one, using the existing N64 models,
materials and blood effects.

## Contact, momentum and return

`island/salvage-response.js` defines short hit resistance: sword 22ms, hammer
56ms and pipe 30ms; hard surfaces add 25%. Air swings have no contact resistance.
The sword continues a shortened draw-cut, the hammer checks and lifts, and the
pipe recoils laterally. No movement, aim, simulation or attack cooldown is
paused. Contact response is repaid inside the original animation interval.

Previously, a shared 45ms viewmodel pause accumulated behind the still-running
combat cooldown. An early legal repeat could interrupt recovery. The three tools
now keep continuous action age, return to their hold 45ms before the interval
ends, and clear contact state when hidden or restarted. Their inherited 2cm
firearm kick at input was also removed. A deliberate load and firm contact lead
into continuous translation and spherical-cubic rotation through follow-through
and extraction, avoiding a stop at every recovery pose.

The hammer shaft has a small lateral bias at impact, preserving the actual
downward leading face and its aiming-line anchor. Both wrapped hands follow the
real grip sockets. Primary tool actions and contact remain in reduced-motion
mode; no new camera shake, glow, trail, textures or assets were added.

## Sound timing

Input gives a quiet cloth cue. A delayed, pitched swish peaks during the final
approach, rather than during the hammer's initial load. Actual body contact emits
an immediate wet layer and blade, heavy-punch or metal material cue. These reuse
checked-in samples and retained provenance. The old blood-spit sample had a long
lead-in; only these three tools suppress that layer. Hard-surface contacts ring
without a wet body cue; air misses produce neither impact layer.

## Evidence and limits

- `npm run test:blackwater`: 100 passing. Actual GLB hand rigs cover body, wall
  and miss paths at 30/60/120Hz across three aspect ratios. Tests check wrist
  limits, attached palms, contact anchors and return before repeat cadence.
- Gameplay input/body verification passes its release, multitouch, reload,
  camera and animated-frame checks.
- `output/impact-weight-pass/recorded/report.json`: 33 cases / 45 swings, including
  normal/reduced-motion hits, misses and minimum-cadence repeated hits/misses.
  Desktop, emulated-touch portrait and landscape are covered. All damage counts
  match existing profiles; 27 actual damage events, no extra damage on misses.
  Three real temporary-collider wall checks, three pack cancellations and six
  real touch-button firing checks also pass. JavaScript/HTTP error arrays empty.
- The source run records uninterrupted full-page video at the recorder's 25fps.
  A test-only colour marker aligns each case to decoded video PTS; the in-frame
  label includes actual action age, pose age and phase. Every encoded frame is
  extracted into ordered sheets. Telemetry is collected on every rendered frame.
  Recordings retain the HUD. They contain no audio; sound event timing and sample
  envelopes are separate evidence, not a claim of listening to the final mix.
- `final-repeat/` repeats all six desktop hit/miss chains after removing the
  inherited firearm kick, with a stricter 5mm working-point transition limit.
- `contact-detail/` holds full-resolution actual-contact views from the initial
  source trial. They establish pose/hand detail only; its synchronous PNG read
  caused a capture stall and is not used as animation-timing evidence.

Two independent read-only vision agents apply the saved character-presentation
and weapon-feel briefs and the project review contract. Their review uses decoded
moving sequences and telemetry, with source and counterevidence; it does not
substitute for a normal-speed human playtest or listening session. The user
retains visual acceptance. Capture runs establish neither performance nor
physical-device touch acceptance.

Both reviewers found no remaining confirmed blocker within this pass. The
character reviewer inspected all 34 final-repeat sheets, portrait hit/recovery
sequences and contact detail; the feel reviewer separately inspected desktop,
touch and repeat transitions plus sound envelopes. Both found distinct hit/miss
responses and completed returns. Final repeat working-point displacement is at
most 3.553e-15m; maximum measured hand/socket gap is approximately 6.143e-8m.

Remaining artistic risks are explicit: the sword's resistance can feel sticky,
and the hammer's foreshortened contact can resemble a prolonged haft-first pose.
The short real-hit response, clean misses, readable overhead load and deliberate
recoil are counterevidence. A future normal-speed A/B should shorten resistance
only if viewers read the action more clearly while contact, cadence, grips and
hit/miss distinction remain intact. These are hypotheses for human review,
not confirmed failures or reasons to silently slow combat.
