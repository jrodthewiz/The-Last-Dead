# Blackwater component craft — October 20, 2026

Scope: current Three.js game, retaining the N64 scenery and field-kit UI.
Unity was not changed. This bounded pass follows the completed ten-person
October 19 council; it reuses two relevant native reviewer roles:
`ruthless_creative_director` (craft_ui) and `modern_warfare_feel_judge`
(craft_feedback). These are analytical lenses, not endorsements or impersonation.
No quality verdict is decided by vote.

## Changes and review findings

Mara's ammunition gift and Elias's ration previously consumed their claim when
all applicable storage was full. Copied ammunition notes also lost their supply.
Capacity checks now preserve wholly unclaimable gifts, and pending note supplies
survive save/load. Receipts report only actual capped gains for owned weapons.
Mixed rations collect the resources that fit. Older already-copied notes without
a pending marker remain claimed, avoiding duplicate historical rewards.

Touch action availability follows the game's existing gates. Treatment disables
conflicting actions. Search still permits intentional punch, shove and remedy
interruptions. Repeated USE does not reset an active search or station repair.
FIRE remains enabled through automatic cadence and cooling so a held input is
not lost. Reloading a weapon postpones container interaction with explicit copy.

Carrion's heat percentage is clamped for display; its existing lockout gains a
COOLING label in the ammunition plate. Heat decay and attack cadence are
unchanged. Exhaustion uses the central damage owner rather than mutating health
inside movement: harm interrupts treatment without consuming a dressing,
produces the existing vignette, and marks the health plate EXHAUSTED. One warning
explains that resting restores breath. The movement harm rate remains 5 health/s.

Review caught and corrected three small regressions:

- **CONFIRMED / resolved:** reopening Elias after collection with full storage
  said the ration remained. Claimed-state copy now takes priority in the source.
- **CONFIRMED / resolved:** continuous exhaustion maintained the visual damage
  timer, suppressing enemy-contact audio. An independent .45 s contact-cue gate
  now ticks/reset separately in the source. Runtime audio acceptance is pending.
- **CONFIRMED / resolved:** the incoming barrel warning briefly cross-faded over
  a touch location label. Obscured touch location labels now hide immediately.
  The regenerated portrait still shows no overlap. The normal area-arrival
  transition remains; continuous transition acceptance is pending.

Counterevidence kept the changes narrow: existing damage resolution, stronger
contact vignette and ordinary landscape layout already worked. The reviewers
accepted the corrected source and supplied raw views within this scope. They
did not certify the entire game, uninterrupted animation or listening quality.

## Verification correction and limits

The user rejected this pass's test files as incorrect and requested their removal.
The two added test files, their npm runner entry and the generated release-test
helper have been removed. The automated validation claims previously recorded
here are withdrawn; historical generated reports are not current acceptance.

Static captures remain in `output/component-craft-pass/final/`: full/recovered
gifts, cooling, exhaustion/recovery, treatment and portrait/landscape touch.
Reviewers used these ordinary in-game views and source inspection. They establish
only what those stills and source show; direct gameplay acceptance is pending.

No new asset, map geometry, animation envelope, performance optimization or
network transport is claimed by this pass. Still views do not establish motion
quality, audio balance or physical-phone usability. Cold public startup remains
a separate known limitation. The user retains artistic acceptance.

The existing port-5200 server/tab and pre-existing output deletions are preserved.
One owned browser/GPU job runs at a time. Scratch is bounded under
`output/component-craft-pass/` at 224 MiB / 180 files, including packaging.
