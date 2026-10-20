# Remaining arsenal: response and impact pass — 2026-10-19

## Change

This pass covers Field carbine, Ossuary, Breach, Arc lance, Reliquary,
Carrion, Mourning, Wake bat and Ripper. Existing damage, ammunition, range,
charge, cooldown, enemy authority and save data remain authoritative.

Seven firearm profiles now have separate short drive, recoil travel, pitch,
small counter-settle and ADS disturbance, ending before their next legal shot.
The carbine observes actual shot edges instead of the shared recoil variable.
Carrion and Mourning receive the shot sequence for once-per-shot mechanisms.
Reload body motion has zero endpoint velocity. Bat contact resistance is repaid
inside its original action, leaving 45ms at the ready pose before a repeat;
air swings retain their timing. Ripper keeps continuous motor/hand motion and
a small load brace, without restarting a firearm root impulse on each fuel tick.

Bullet cases leave the carbine/rifle ejection socket. Ossuary keeps its fired
cases until the open-cylinder reload, extracting the spent count once. Breach
and Reliquary gain mid-reload cues; Breach insertion and Ossuary loader cues
follow their existing construction phases.

Body hits use the existing immediate wet sample. Bat gains a delayed swish and
heavy material contact cue, while walls ring without a wet layer. All samples
are already checked in with existing provenance. Hit confirmation uses four
small gapped ticks with a subdued rust kill colour, in the field-kit palette.

## Blood and contact

Directional faceted droplets, limited backspatter and an asymmetric short-lived
contact fan use matte red/ochre colours. The first fan trial was too much like
a regular red emblem; the final normal/heavy fans are 0.08/0.125m before strength
scaling and live 0.12/0.15s. Droplets carry the follow-through. Nearby supported
floor marks merge by area, with a capped radius. Surface marks still use actual
collider faces and edge clipping. Blast victims emit at their own body contact
positions; previously every victim emitted at the explosion origin.

Pools stay bounded: 96 particles, 40 floor stains, 32 surface marks, 24 cases,
12 trails, plus 12 short contact fans. No geometry, materials or scene nodes
are allocated per impact; colour variants are prepared before first use.
No new textures, bloom, full-screen blood filter or camera shake were added.

## Verification

- 103 Blackwater unit/integration checks pass, including profile timing, bat
  return, blood lifecycle/resource identity, supported stains and pool bounds.
- Gameplay input and first-person verification pass: release paths, multitouch
  ownership, reload completion, animated camera and floor support checks.
- `tests/blackwater-arsenal-response-motion.mjs`: 48 recorded action cases across
  desktop1280x800, portrait390x844 and landscape844x390. All nine firing actions,
  seven ADS sequences, eight reloads, sustained Carrion/Ripper, three bat hit
  repeats and three misses, reduced-motion examples and real touch fire buttons.
- Final desktop11-case rerun covers carbine, bat and Ripper after the last root
  response/fan adjustments. Damage, ammo, connected finite grips and relevant
  cylinder extraction checks pass; both recordings have zero JS/HTTP errors.
- `tests/blackwater-impact-contract.mjs`: actual Reliquary blast confirms two
  distinct victim-local blood origins; bat misses emit nothing, solid walls
  emit metal feedback with no organic fan.

Evidence: `output/arsenal-response-pass/motion/report.json`, `final-motion/report.json`,
`contracts/report.json`, matching ready images, full-page videos and decoded
25fps timestamped sheets. Captures use independent owned headless contexts,
with background input guards; the user's port5200 server and tab stay intact.
Continuous videos were recorded without synchronous PNG reads during actions;
reviewers inspect their ordered decoded frames. These checks do not establish
native-speed human playback, audio feel, physical-device touch or performance.
Scratch is bounded to 320MiB and 320 files (file allowance raised from240 for
48 complete sequences plus the final11-case revision).

## Independent review

Two existing read-only specialist agents review the recorded evidence with the
character presentation and first-person feel lenses. No full council requested.
Their final verdict and remaining risks follow below.

### First-person feel / framing reviewer

The `modern_warfare_feel_judge` agent inspected all nine desktop attack paths,
seven ADS paths (including later Arc discharge), eight reload middle/return
sequences, sustained Carrion and final bat/Ripper sequences. No confirmed
framing or animation blocker was found in the examined recorded frames.
Firearms recover their sights; reload operations remain readable. The smaller
asymmetric fan is accepted within the N64 visual grammar. The first regular
fan trial was revised after the independent critique.

Residual artistic risks: carbine reload exposes a flat cuff/wrist shape;
Ripper refuelling briefly masks its casing with the support forearm. Neither
was observed detached. These are construction/readability risks rather than
mechanical failures. The smallest further test is a closer ordinary/neutral
view at the implicated reload phase, followed by a continuous sequence to
confirm improved construction without losing grasp or target visibility.

### Character / hand-motion reviewer

The `character_presentation_owner` agent separately inspected Carrion/Mourning
reload control/return at1.44-2.36s; final bat hit/miss repeat tails/restarts at
0.48-0.92,1.44-1.88 and2.40-2.84s; and final Ripper cutting/release at0-1.40s.
No confirmed blocker in that bounded subset: bat settles before the next load
without the old hop; Ripper retains front-bar/rear-throttle grips through
continuous load/release; rifle support hands return receiver-to-foregrip
without a detached wrist or sleeve block. This is not an all-nine artistic
approval from this reviewer.

An artistic risk remains in rifle charging: the palm overlaps the receiver and
exact finger-to-bolt engagement is hard to read at sheet resolution. The
strongest defense is an intentionally brief charging/slap action with a seated
wrist. A full-resolution ordinary/neutral comparison at reload0.78-0.90 would
change the verdict if it demonstrated a floating palm. Avoid changing the hand
path just from a small-sheet ambiguity. Both reviews concern decoded40ms video
frames; neither claims native audio/playback or performance approval.
