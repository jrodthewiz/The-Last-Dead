# Dedicated salvage-tool motion and framing

This pass gives the boarding sword, framing hammer and utility pipe their own
first-person attacks in Blackwater. It preserves their damage, reach, contact
time, stamina and inventory ownership. The existing N64 geometry, palette and
first-person skin remain the foundation.

## Implementation

- Sword: a loaded diagonal draw-cut, low follow-through and controlled return.
- Hammer: a high load, downward face strike and slower recovery.
- Pipe: a compact lateral coupling strike with a quick retract.

`island/salvage-motion.js` authors the working-surface path and orientation for
each tool. A continuous cubic path carries velocity through contact. The blade
edge, hammer's outward striking face and pipe coupling wall have actual geometry
anchors; their leading surface crosses the aiming line when damage lands.
This is a first-person presentation contract, not physical collision of the
rendered viewmodel with every world-space target surface.

The three new tools use their own grip trajectories and calibrated grasp turns.
They no longer combine those paths with the inherited bat's strike clip, which
had driven a sleeve across the action. `fps-arms.js` opts only these rigs into
grip-driven approach directions; existing weapon rigs retain their solver path.
Both hand wraps remain on their real sockets through the attack and return.
Reduced motion retains the essential tool action while suppressing secondary
camera motion.

Narrow-view holds keep the hammer head and Ripper guide bar/casing in frame.
The Ripper's rear handle, throttle guard and hand socket move as one control kit,
with a cast lug and lower stay attached to the motor. The operating hand now
reads beneath the casing. The fuel cap, chain and refuelling mechanism remain
functional. No external assets or textures were added.

The final touch HUD uses one portrait edge column for primary actions, a utility
row above the weapon, and a shallow ammunition strip in short landscape views.
This addresses actual DOM overlays that covered sights and lower grips. The
field-kit colours and typography continue from `docs/ui-direction.md`.

## Verification and rendered evidence

- `npm run test:blackwater`: 98 passing, including real GLB arm rigs at
  30/60/120Hz, three aspect ratios, leading-surface direction, continuous return,
  actual geometry anchors, mounted Ripper controls and batching.
- Existing FPS-arm regression: 21 passing. Shared melee/model/mechanism tests:
  21 passing. Gameplay input verification passes its release and reload checks.
- `output/weapon-motion-pass/motion/report.json`: 36 ready views and 27 actual
  attacks, covering all three tools at desktop, true touch portrait and true
  touch landscape, hits, misses and reduced motion. Hits deal 55/90/45 once;
  misses deal zero. Maximum measured hand/socket gap: 5.362e-8 metres. No
  JavaScript or HTTP errors.
- `output/weapon-motion-pass/arsenal/`: all twelve weapons, seven firearm aiming
  views, reload/return samples, neutral material views, Ripper sustained cutting
  and empty-fuel/refuel behavior. No JavaScript or HTTP errors.
- `framing-final/`: final all-twelve portrait and landscape ready images with
  actual touch HUD. `touch-controls/report.json` verifies the final built game:
  touch controls fit the viewport, do not overlap, are at least 44px, and enabled
  action centres are reachable. No JavaScript or HTTP errors.

Contact sheets are ordered raw canvas frames labelled with actual shot age;
they omit the DOM HUD. Ready screenshots include the HUD. These capture-heavy
runs do not establish performance or continuous subjective animation feel.

## Independent focused vision review

Two read-only agents used the available `character_presentation_owner` and
`modern_warfare_feel_judge` roles, with the saved review briefs and project review
contract. They separately inspected ordered attacks, normal game-sized views,
neutral construction views, true touch layouts and telemetry.

Both found the new attacks recognisably distinct, the giant sleeve obstruction
resolved, and the narrow tool framing improved. The character reviewer confirmed
the Ripper's rear hand visibly wraps a mounted control rather than disappearing
behind the casing. The framing reviewer identified touch UI overdraw, leading
to the final compact layouts above. Review is evidence-based, not a vote or a
claim of professional parity.

Remaining artistic risk: the hammer is heavily foreshortened at exact contact;
its identity reads strongest during windup and return. A future small lateral
tilt should be retained only if it improves face readability without losing the
downward working normal, aiming-line agreement or clear sleeves. Continuous
normal-speed subjective feel and physical-device touch acceptance remain
unverified by these still-image reviewers. User visual acceptance is decisive.
