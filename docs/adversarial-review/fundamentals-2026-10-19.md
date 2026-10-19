# Blackwater fundamentals polish — October 19, 2026

This pass concentrates on walking into meaningful places, discovering equipment,
using it correctly in first person, and reading one consistent game interface.
It preserves the N64 coastal horror direction, existing saves and both public
hosting destinations. It does not claim every part of the game is finished.

## Playable changes

Three discoverable, independently saved weapons extend the existing nine:

| Find | Location | Damage | Contact / recovery interval | Reach |
| --- | --- | --- | --- | --- |
| Boarding sword | Old Town maritime stores | 55 | .22 / .62 seconds | 3 m |
| Dock hammer | Orchard cottage | 90 | .36 / .94 seconds | 2.5 m |
| Service pipe | Boatwright's workshop | 45 | .20 / .58 seconds | 2.6 m |

Their blade, cross-head and bent hollow pipe are authored low-poly geometry,
with two grip sockets and a working-end contact anchor. They reuse the existing
authored first-person arm rig and its sweep clip, remapped to each tool's
contact and recovery. Damage lands once at the committed contact, follows
visible reach/cover rules and cannot be escaped by swapping during wind-up.
Fire swings the held tool; F/Punch uses the separate fist attack. The wheel and
B weapon rack reach all twelve weapons; 1–9 retain their existing bindings.
Owned melee finds cannot be farmed for meaningless zero-ammunition receipts.

Six legacy aimed presentations previously zoomed without bringing their
physical sights onto the target. Model-space rear/front references now align
the rendered guns with the camera aiming line. Gameplay aim has its existing
owner. Reliquary sight feet seat into the resized steel body; the front foot
travels with its barrel. Ossuary/Carrion finishes use broad quiet steel instead
of high-frequency overlays. The carbine cuff is smaller and open-ended.
Hammer/Ripper framing adapts to narrow screens.

Ordinary cottages gain different household activities: sewing cloth and tools,
a care ledger and gauze, or a bread board and meal setting. Existing domestic
palettes, bed screens, sinks and work surfaces remain coherent. The Old Town
chandlery gains sailcloth, rope coils, manifest and compass, an entrance sail
display and a nearer packing table. Solid records and visible furnishings use
the same plan. Two routes around its display remain walkable.

A reviewer found an old scenery-only orchard tree grid growing through a
cottage ceiling. It has been removed. The canonical twenty planted orchard
trees, which reserve houses and paths, remain.

The live interface follows the coastal field-kit direction in
`docs/ui-direction.md`: ink green, paper text, amber diamond selection, item
silhouettes and ruled rows. A compact edge foldout shows searched containers
without covering the whole room. Receipts report actual quantities, capacity
states preserve leftovers, melee uses a small ready plate, and the twelve-item
rack includes explicit discovered/carried/equipped states. Keyboard navigation,
touch actions and portrait scrolling use the same visual language. Resizing
reveals the selected rack row instead of hiding the final tools below it.

## Evidence and review

The focused character presentation and map authoring reviewers inspected raw
gameplay images. A separate completion judge applied the saved adversarial
brief and review contract. These are analytical lenses, not endorsements or
human playtests. The UI implementer also inspected the final rendered states.

Local evidence is bounded under `output/fundamentals-pass/`:

- `arsenal/`: all twelve ordinary held views, actual ADS where applicable,
  isolated neutral front/side views, authoritative damage frames, reload
  thresholds/return and 390-pixel framing; transform and combat telemetry.
- `finish/`: targeted Reliquary construction repair in held, neutral, aimed,
  contact and reload views. This isolated rerun follows the complete arsenal
  run; it does not replace its all-twelve report.
- `traversal/`: actual keyboard entrance/exit walks for five representative
  buildings, all ten physical E recover/equip events, save/resume, full bridge
  and city street ground legs. Enemies are disabled for these route checks.
- `traversal-final/`: repaired orchard and shop, repeated five entrance walks,
  ten finds and persistence, then the corrected 60-second coast run.
- `cohesion/`: all 45 exterior-to-container routes, access paths, physical
  walking on both sides of the shop display, narrow rack selection and
  keyboard navigation, persistent leftovers/full storage and emulated touch
  pickup, receipt, rummage and landscape views.

The UI reviewer subsequently found short-landscape edges that the initial
prompt-versus-touch checks missed: a receipt touched the objective, the prompt
crossed the ammunition plate and Pause could touch the action grid. Scoped
spacing repairs were checked in four final captures and `ui-fit-final.json`.
The final separation assertions pass with empty JavaScript/HTTP error arrays.
PUNCH and contextual SWING/CUT/FIRE labels match their actual actions.

The first coast harness incorrectly marked a penultimate waypoint as complete.
Its completion condition was repaired. The final coast run walks 311.86 m in
60.01 seconds and honestly reports `completed:false`; it is a timed leg, not a
claim that the whole coast was completed. The bridge leg completes 402.86 m in
77.50 seconds; the city leg completes 278.81 m in 53.65 seconds. Median/p95
frame intervals are about 16.7/16.8 ms in these controlled local runs. Bridge,
city and corrected coast have no frame over 50 ms. This is quiet-world
headless evidence, not proof of combat performance on every player's device.

All 93 Blackwater unit checks pass, as do the input/body-source verification
and 21 shared melee/model/mechanism checks. The complete arsenal and final
world/cohesion browser reports have no JavaScript or HTTP errors. The browser
uses owned headless contexts with native pointer/fullscreen capture blocked;
the player's existing tab and port 5200 process remain intact.

## Individual first-person verdicts

| Weapon | Reviewed result |
| --- | --- |
| Field carbine | Held pose, sights, shot and magazine/bolt reload coherent in samples; small wrist termination remains an artistic risk. |
| Ossuary | One-handed firing and loading support hand coherent; corrected sights and quieter steel verified. |
| Breach | Connected grips, break-action hinge, shells and return; corrected aiming notch/bead verified. |
| Arc lance | Grips, charge lamps, reactor lift and discharge readable; actual 130-damage charge recorded. |
| Reliquary | Loading, closure, grips and corrected sights coherent; formerly floating sight hardware visibly seated. |
| Carrion | Aperture, grips and magazine return coherent; held fire actually consumes seven rounds. |
| Mourning | Corrected optic frames the target; support grip, deliberate shot and reload coherent. |
| Wake bat | Actual cap reaches target at contact; one 65-damage strike and seated grips recorded. |
| Ripper | Guide bar, control grip, refuel and cut coherent; four ticks deal 52 damage and reach NO FUEL. |
| Boarding sword | Distinct edge/guard and seated grips; visible cutting end at one 55-damage contact. |
| Dock hammer | Distinct cross-head/seated haft and grips; visible head at one later 90-damage contact. |
| Service pipe | Bent hollow coupling silhouette and grips; visible working end at one fast 45-damage contact. |

No unresolved confirmed first-person or map/interior blocker remains in the
reviewed samples. That is a bounded verdict, not professional-parity approval.
The strongest remaining risks are narrow cropping of outer hammer/Ripper
hardware, a small procedural carbine wrist cap, shared melee sweep choreography,
and the large chandlery still reading as a warehouse. A fresh player identifying
its former use and recognizing the three tools at normal speed would be more
useful than adding decorative clutter.

Continuous subjective animation quality, crowded combat performance, every
interior's artistic quality and the whole city's pacing remain unverified by
these stills, samples and quiet-world walks. Player visual acceptance remains
the final craft judgment.
