# The Last Dead interface direction

## Blackwater playable interface — October 22, 2026

During play, the player needs to recognise a find, understand whether it can be taken, and return to the world quickly. The visual anchor is the same low-resolution island as the title screen. The interface borrows the cartridge title's chunky ivory lettering, cut amber cursor and short olive shadows. No downloaded font, soft glass, continuous motion or decorative telemetry is needed.

`island/console-ui.css` owns the current HUD and field-menu treatment above the existing layout foundations. It does not restyle the title screen. Action and equipment headings use heavy sans lettering; the shared body face carries descriptions. Amber indicates a usable action or selection; muted olive denotes unavailable equipment; rust remains damage, fullness and danger. Frames use lit upper edges and dark lower edges. Existing authored item silhouettes appear in the held-weapon plate, proximity prompt, pickup receipts and pack.

The health plate groups dressings and stout with the health they restore. The weapon plate shows the actual held weapon, ammunition and current operating state. The four quiet desktop reminders are map, pack, heal and pause; the full control guide remains in options. The objective uses open lettering with a hard shadow. Proximity prompts put the find first, the available action second, and only then the short explanation. A blocked prompt has a dash rather than an active E key, including during weapon reloading. Search and treatment keep their real progress, cancellation and damage states.

Scavenging opens a compact sheet at the left edge so the room and find stay visible. Stacks have larger silhouettes and quantities. The pouch uses 24 actual capacity divisions; its free count and transfer forecast describe real inventory. Clicking a stack takes that stack. Clicking **Take all & return** and pressing E now have the same result: collect what fits and return to play. A full pouch stays open, preserves unclaimed contents and directs the player to Supplies. Discarding a material immediately makes room. The pack uses a clear selected row, substantial item illustration, separate carried and undiscovered weapon states, and 44-pixel minimum controls. Portrait scrolls the contents rather than compressing targets; short landscape retains a two-column loot arrangement.

The next iteration makes equipment spatial: four columns of weapon silhouettes on the desktop, three on narrower layouts, with the actual equipped mark and a cut upper-left selection cursor. The supply pouch uses six larger icon slots and corner quantities. Unfound weapons remain muted, with an explicit disabled “Not yet found” action. Weapon finds show real magazine or melee reach/impact information before collection, and a larger five-second discovery receipt afterward. The next pack opening selects that recovered weapon. Opening the pack focuses the selected equipment; opening a container focuses the first transferable stack, or Supplies when nothing fits. Arrows choose, Enter takes the focused stack, and E retains the take-all-and-return action.

Healing and crafting value appear in scavenging rows. Bandage ingredients show actual cloth/antiseptic stock beside the craft action, including missing-material states. Reinforcement names the available fittings against the real cost. Essential actions stay visible while long equipment descriptions scroll. Empty consumables say “None carried.” These states describe real inventory; they do not add rarity, durability, weights or fabricated statistics.

Selected slots now confirm through Enter or E, using the same primary action as the visible button. Pointer clicks still select before acting. The active button carries a real E hint and the footer names Use, Equip, Craft or Reinforce; unavailable actions have no active key hint. Repeated keydown events cannot craft twice or use a newly selected remedy. Enter on another focused action retains that action's native button behavior. Healing previews show current health, the capped treatment result and an amber recovery segment. Owned firearms show the real loaded count, magazine capacity and reserve beside the action. These decision readouts remain fixed while descriptions scroll. Short landscape places the two equipment actions side by side while retaining 44-pixel targets.

A full pouch offers Make room in Supplies, selecting the largest spare stack for an explicit discard decision. It never discards automatically. Returning to Container preserves its contents and forecast. A partial collection says Take what fits & return; ammunition/duplicate equipment states identify full reserves or already-carried gear rather than directing the player to discard pouch materials. Empty containers use factual picked-clean copy. The latest captures and native-input evidence are in `output/playwright/inventory-response-2026-10-22/`.

The clean-up pass removes the repeated header emblem/kicker, idle storage paragraph and global crafting button. Crafting belongs to cloth, antiseptic and the empty bandage slot; a carried bandage offers another craft only when the ingredients exist. Empty stacks offer no discard action. Slot names and quantities remain, while repeated category/carried/undiscovered subtitles are removed; firearm slots retain their real ammunition figures and the equipped diamond. Unselected frames are quiet, selected frames retain the cut cursor, page labels are open, and item art has no inner panel. One cream action with dark ink establishes the next decision. Disabled actions are quiet text, not dark button-shaped plates.

The status footer appears only for a real result or instruction. The normal loot summary says All items fit, with detailed transfer and leftover lists reserved for partial hauls. The duplicate free-slot block is removed because capacity is already in the header. Pickups omit generic loaded/ready copy, duplicate finds omit acquisition stats, and discovery receipts retain just the find label, silhouette and name. Gain previews remain authoritative, so treatment amounts are not repeated in the eyebrow, description and button. These rules supersede earlier decorative frames, repeated subtitles and global crafting placement. Current evidence is in `output/playwright/ui-cleanup-2026-10-22/`.

Evidence is in `output/playwright/field-ui-2026-10-22/` and `output/playwright/console-inventory-2026-10-22/`: guarded real-game captures and native input flows, including world weapon pickups, full-pouch recovery, crafting, healing, keyboard selection and coarse-pointer layouts. These controlled review scenes disable enemies to isolate the interface. No test files are added or changed. This section supersedes earlier Blackwater HUD/pack typography and placement guidance; the title composition below remains unchanged.

## Blackwater title screen — October 22, 2026

The browser edition's title is a console game screen, with the live low-resolution island as its visual anchor. A centred, custom angular ivory wordmark uses short olive extrusion, hard edges and a few fixed cuts. It is an authored SVG asset, independent of installed fonts. Blackwater sits below it; a single quiet line carries the survival premise.

The menu is an open, compact vertical list. Warm ivory labels turn amber at selection, accompanied by a cut triangular cursor and a restrained dark strip. Mouse movement transfers actual focus so keyboard and pointer share the selected row. Native Enter, arrows and Tab retain their existing behavior. Continue appears only for a real local save; preparing and failed-load copy remain real runtime states. There are no decorative controller prompts.

Primary choices are journey, co-op, survivor equipment and options. The existing developer flight remains a smaller World survey / Extras entry; F2 still opens that tool. Portrait keeps one column; short landscape places the wordmark beside the choices. Targets stay at least 44 CSS pixels. Narrow screens may scroll vertically instead of compressing the actions. No continuous UI motion, new font download, or global HUD restyle is introduced.

`island/title-screen.css` owns this title-only treatment. The field-kit palette and meaning of amber focus carry into the existing options and in-game menus; those denser screens keep their quieter typography and frames. Evidence for this pass is in `output/playwright/title-screen-2026-10-22/`. This section supersedes earlier title composition guidance, without changing the combat HUD contract below.

The interface should feel authored for a horror FPS. The world remains the dominant image during play and inspection; screens that pause the game should make the next action immediately clear.

## Visual contract

- Use worn ivory for primary information, muted grey-green for supporting text, rust for navigation and paused states. Blood red belongs to danger and damage in the combat HUD.
- Use Georgia for narrative/title moments, Impact or Arial Narrow for action labels, Segoe UI or Arial for explanatory text, and Consolas for coordinates. Monospace is a detail role, not the entire interface.
- Anchor live information to the edges. Keep the centre available for aiming, threats, and the environment. Use local shadow/backing where contrast requires it.
- Prefer open action lists, short rules, meters, silhouettes, and restrained edge accents. Each modal gets one dominant action; secondary actions stay quieter.
- Give instructions when they are useful. Camera shortcuts live in an optional controls sheet, not a paragraph that permanently covers the world.
- Show the real state: frozen simulation, captured/released mouse, selected weapon, health, settings. Keep numeric widths stable. Do not animate or rewrite unchanged information each frame.
- Buttons need hover, focus, pressed, and disabled states. Keep keyboard navigation usable and action targets at least 44 CSS pixels tall. Key hints must match the active input device where supported.
- Developer controls remain gated by the existing localhost/dev switch and visibly identify themselves as tools.

## First iteration

Free-camera mode now has an upper-left status label and a lower control rail. H or Controls opens the guide; R resets the camera; Tab releases the mouse; F2 returns to the player. The mouse action changes with pointer-lock state. The title and pause action lists share the same typography, colour roles, and keycaps. Returning to Free Camera from its pause menu preserves inspection instead of toggling back to the player.

The survival HUD, inventory, settings layout, and end screens retain their existing structure in this pass. Future iterations should apply the same contract to those states, using screenshots in the live world to judge the result.

## Acceptance evidence

Run `node build.mjs`, then `node tests/game-interface-browser.mjs` with the repository's Playwright/Chrome overrides. It tests the built runtime in a disposable browser and server, preserving the user's launcher server and existing game tab.

The layout matrix covers 1440×900, 1280×720, 844×480, 390×844, 320×640, and 720×360 in camera, controls, pause, and title states. It checks large coordinate values, horizontal fit, and action targets. The live production check covers flight, reset, help, mouse capture/release, paused simulation, settings, and return to the player. Review screenshots as well: computed dimensions alone cannot prove visible labels or a convincing composition.

Camera movement currently uses keyboard/mouse. Narrow-screen checks prove layout and clickable actions, not a full touch flight controller.

## Supply pouch continuity — 2026-10-05

The equipment screen keeps its existing field-kit palette and scroll container. A quiet three-column materials ledger precedes the weapon rack: clean cloth, antiseptic and bandages, with a single pouch capacity count. Workshop actions name their real recipe/bench requirement; healing names its maximum effect. Disabled states reflect materials, health, station access and shared-session restrictions. Spare-material discard frees capacity without deleting an unopened case. Search prompts use Q; inventory actions use B. Field-map supply crosses and the nearest-workbench route use authoritative pickup/station records. Source/transaction checks pass; rendered acceptance is pending a separately approved desktop check.

The user approved the desktop follow-up. Actual captures revealed that the existing wide-screen grid placed these new panels in implicit rows below the rack. They now occupy explicit supply/station areas; the pouch is visible immediately at1280x800. Opening the kit and marking the nearest bench reset scroll so the ledger/map starts in view. A quiet life/treatment line updates after healing. Persistent world Q/B hints follow the usable object or station, hide while the kit is open, and disappear after collection or leaving reach. Rifle priority and one action per held press agree with the displayed hint.

Seventeen native-game screenshots and states were reviewed, including disabled/ready/crafted/used bandage actions, fitting and rifle inventory. The live recipe and health checks pass; evidence: output/playwright/coastal-scavenging/verified and desktop-review.jpg. Mobile and the larger layout matrix are not part of this bounded desktop follow-up.

## Blackwater console interface — October 16, 2026

The rewritten browser game's current UI lives in `index.html`, `island/style.css`, `island/ui-controls.js` and the bindings in `island/game.js`. This section supersedes the legacy typography rules above for these Blackwater screens only.

The player is a lone survivor: menus are calm planning moments, while combat needs immediate health, ammunition and interaction information. The visual promise is a late-1990s survival adventure. The island view owns the title background, the actual survivor owns equipment inspection, and the map owns the journal screen.

- Bold ivory serif titles have short hard shadows. Bold Trebuchet/Arial labels and stable tabular numerals handle actions and combat; prose stays readable at display resolution. No new font downloads are needed.
- The two shared motifs are an amber triangular focus cursor and a simple olive/ivory double-rule frame. Selection has a persistent amber edge, while keyboard focus has a cursor and outline. Locked items keep explicit labels. Red is reserved for danger and the medical cross.
- Menus use open vertical action lists. The title avoids technical edition labels, fabricated vintage dates and ornamental coordinates. Pause, options, dialogue, map and inspection share colours and hierarchy; the HUD uses much smaller backing plates around its edge-bound counters.
- Keyboard arrows move through visible enabled menu controls; Tab stays within the current screen. Native sliders and selects retain their own arrows. Enter activates the focused button, Escape follows the existing back/pause rules, and returning from options or inspection restores useful focus. There are no decorative gamepad prompts or claims of gamepad support.
- Narrow layouts scroll within their own screen or panel instead of shrinking all text. Actions remain at least 44 CSS pixels tall, except the native checkbox whose full label is clickable. Touch controls inherit solid edges, hide irrelevant keyboard hints, and show touch-specific instructions.
- The game world retains its 240p rendering. UI stays legible at screen resolution, with no blur, continuous glow, looping selection animation or new audio asset. Reduced-motion settings suppress UI transitions.

Rendered baseline and iteration evidence lives under `output/playwright/blackwater-ui/`. `tests/blackwater-ui-review.mjs` uses owned headless browser instances and the repository background-input guard. It exercises menu focus, settings, paused simulation, map, inspection, dialogue, retry and desktop/narrow/emulated-touch layouts. The user's existing game tab remains untouched.

The independent judge accepted the final console-inspired identity after concrete revisions. Initial touch action buttons overlapped the ammo panel; portrait actions now sit higher, while landscape ammo sits beside the action column. Touch hints now describe supported controls. Portrait and short-screen inspection calculate a clear model region from the header, equipment list or footer instead of allowing the heading or divider to cross the face. The narrow logo keeps its two-line form, short landscape menus have solid backing against bright sky, and slider handles share the square-edged control language. Narrow inspection shows fewer rows at once but preserves readable text in the scrollable list.

`final-fit/report.json` passes 23 screen/layout checks, including desktop 1440×900 and 1280×720, short 844×480, 800×600 inspection, narrow 320×640, and touch emulation at 390×844 and 844×390. Arrow navigation/repeat, hidden and locked control skipping, selected-weapon focus, options readouts/back focus, frozen pause state, map, dialogue, retry and save/continue all pass. JavaScript and HTTP error arrays are empty. The `pass-2/` capture stopped on an incorrect test expectation: the already-owned Wake bat correctly follows the newly collected shotgun, before the animation selector. The corrected assertion passes in subsequent captures.

All twenty world/gameplay Node checks passed. `mission/report.json` passes progression through the three relays and ferry ending, combat, driving, save/reload, death/retry and desktop/emulated-touch controls. The final inspection-framing-only correction followed that mission run and is covered by the final packaged UI checks. Seven changed runtime files match the final package by SHA-256. The repository-owned server remains at `http://127.0.0.1:5200/`, serving `dist`; no game tab or server restart was needed.

The judge's final verdict accepts this scoped UI pass with no confirmed blocker. This is not a claim of exact historical N64 reproduction, gamepad support, physical-phone validation, continuous animation quality or stall-free performance. Existing loading/transition hitches remain outside this UI pass.


## Controls field manual — October 7, 2026

The main-menu guide uses the current olive and worn-gold interface tokens, a ruled three-column field manual on desktop, and a single column on phones. Movement/weapons, close combat/extraction, and standard controller bindings stay together. Every existing binding and qualifier is retained; two malformed separators become readable middle dots.

The guide owns bounded viewport scrolling. Its heading remains visible, and the original Controls toggle becomes Close controls at the same fixed header edge. This preserves the existing callback, focus, controller confirm/cancel, and ancestor-scroll path without changing input behavior. The guide is an optional sheet, not an aria-modal dialog. Short screens scroll the same contents rather than shrinking text. This pass owns only main-menu guide markup and its scoped styles.

## Supply pouch readability - October 7, 2026

The existing materials ledger and workshop actions retain their olive field-kit structure. Recipe and life/treatment text use 12px supporting type; action names use 14px and pouch explanations 13px. Unavailable actions keep muted ink and borders without fading their requirements. Spare-material discard targets are 44px tall. This is a readability pass with more vertical scrolling where needed; it changes no quantities, requirements, callbacks or availability rules.

## Co-op field radio — October 17, 2026

Play together uses the same ivory, amber and olive console menu vocabulary.
Open frequencies show actual waiting rooms, host callsigns and one free seat;
the quiet-airwaves message is the real empty state. Six-character channels
support direct invitations. Loading, errors, roster and host departure controls
have distinct states. Keyboard focus stays inside the radio sheet and Escape
returns to title. The sheet stacks on narrow displays with bounded scrolling.
The compact gameplay status reports partner, DIRECT/RELAY and measured latency.

## Pickup and container clarity — October 17, 2026

The world and the held weapon remain the visual anchor during scavenging.
Proximity/search/treatment share a compact lower-centre field label: amber action,
ivory object name, quiet storage or interruption hint, and a single progress rule.
Acquisition receipts sit at the left edge above health, with the existing item
silhouettes and actual quantities. Three receipts at most, brisk entrance,
short lifetime and reduced-motion support keep repeated pickups quiet.

Container contents use a smaller translucent sheet and ruled rows. Full pouch
and full reserve states are explicit; ammunition storage stays distinct from
material slots. E collects what fits and returns; B/Return leaves the container.
Mouse/touch buttons retain individual collection and Take all. Touch hides the
keyboard-only shortcut hints. The inventory, title and combat HUD retain the
established ivory/amber/olive language.


## Coastal field kit continuity — October 19, 2026

This pass keeps the N64 survival-adventure identity while making the live HUD,
weapon rack and scavenging one interface. During play the held weapon, room and
threats own the image. Health and ammunition remain small ink-green plates at
opposite lower edges. A new find is a short receipt, never a full-screen reward.
Melee equipment uses a compact ready plate instead of a large empty ammunition
counter. The gameplay state owner applies that mode only outside a vehicle, so
the truck retains its speed readout.

Warm paper is primary information, grey-green is supporting state, amber means
selection/action/confirmation, and rust-red means damage or treatment. A single
amber diamond now carries menu focus, selected kit rows, equipped state and a
weapon discovery receipt. Display serif belongs to place and item names;
Trebuchet/Arial handles decisions, and changing values use tabular numerals.
No browser fonts, blur/glass panels, pill controls or looping ornament are added.

The pack is a ruled equipment rack and an item illustration. Rows retain the
same weight for all twelve weapons, with explicit carried, in-hand and
undiscovered states. Ammunition reads from current gameplay state, and melee
items say that they need no ammunition. Owned melee finds say already carried;
they never promise zero spare rounds. Empty material quantities remain readable.
Supplies use the same row grammar, actual counts, treatment effects and recipes.

Searching opens a smaller foldout at the left edge on wide screens, leaving
part of the actual room visible. The action label, progress rule, silhouette,
contents, pouch capacity and acquisition receipt share the same colours and
spacing. Ammunition reserve and pouch space stay distinct. Leftovers stay in
the real container; the UI does not regenerate them or claim they were taken.
E still takes what fits and returns. Take all and individual collection remain
visible click/touch actions, including when keyboard hints are suppressed.

The layout scrolls within its own kit body. Narrow screens retain readable
rows and a bounded weapon list, followed by item detail and real actions;
short landscape screens keep 44px minimum actions instead of shrinking them.
Arrow keys follow the rendered grid, Home/End reach its ends, left/right change
categories when a tab is focused, and Enter confirms. Tab still follows the
shared screen focus order. There are no decorative gamepad prompts.

The serialized source run's six UI captures under
`output/fundamentals-pass/arsenal/ui-*.png` were reviewed at 1280×800 and
390×844. They show the pickup/search progression, left supply foldout, edge
receipts and expanded weapon rack. This review found narrow objective-chip
drift clipping and the selected last-row tool below the initial viewport.
The narrow chip now stays under the compass and the rack reveals its selection,
including after resizing from a wide display. The follow-up cohesion run under
`output/fundamentals-pass/cohesion/` verifies the final pipe row is in view,
Home/End selection, all 45 building routes and both shop aisles. The six reviewed
wide, portrait and emulated-touch captures show readable rack actions, a clear
pickup/search label, quiet acquisition receipts and unobstructed touch targets.
Its JavaScript and HTTP error arrays are empty. A focused final check in
`cohesion/ui-fit-final.json` covers 390×844 and 844×390 emulated-touch layouts:
pickup, receipt, active search with receipts, and landscape prompt plus receipt.
The final four PNGs were visually inspected. All touch action buttons, Pack,
Map, Pause, joystick, health and weapon plates are separated; receipts clear
the objective and prompts clear the ammunition plate. Both target chips fit
the viewport and neither layout overflows horizontally. The short-landscape
grid now starts below Pause, with the receipt and prompt placed in separate
regions. Final JavaScript and HTTP error arrays are empty.
The held-tool action is called SWING; PUNCH explicitly means the secondary fist
action, with the pack note and actual touch buttons checked for matching copy.
These checks do not establish physical-device touch acceptance, gamepad support
or continuous animation quality.

The weapon-motion pass keeps the touch sight line clear: portrait utility actions
form a quiet row below the objective, while FIRE/USE/JUMP use one edge column.
Short landscape displays use a shallow two-line weapon/ammunition strip,
leaving the wrapped hands visible above it. These reuse the field-kit colours
and retain at least 44px action targets. The desktop layout is unchanged.

## Craft council continuity — October 19, 2026

The ten-agent craft pass preserves the field-kit identity and world-first
composition. Arc equipment teaches HOLD FIRE / CHARGE; touch failure messages
name PUNCH. Reinforced melee impact displays its effective value, and completed
reinforcement says Reinforced instead of offering an unavailable recipe.

Collection receipts age only during visible play. A multi-reserve pickup shows
the active weapon's actual gain and acknowledges other reserves in one quiet
plate. Immediate pickup refresh keeps the counter consistent with the receipt.
Dry-fire/reserve notices end when resupply or switching resolves that failure;
mission notices retain their own lifetime. Portrait touch location labels sit
below the utility row and yield to a notification.

Medical dialogue distinguishes a full belt from an already claimed gift. Medical
notes can be copied while full and keep their dressing for a later visit.
Container silhouettes, open contents and pack quantities share the same household
identities. Evidence: `docs/adversarial-review/craft-council-2026-10-19.md`.

## Component continuity — October 20, 2026

Gift and field-record dialogue separate copying a record from collecting its
supplies. Full belts/reserves leave unclaimable supplies at their source. Actual
receipts count only what fits; a collected ration never promises a second one.

Touch action ink follows the current hand action. Treatment prevents conflicting
combat/use actions; searching still permits deliberate punch, shove or treatment
interruptions. Held automatic fire survives its normal cadence and cooling.
An incoming touch notification hides the location label immediately rather than
cross-fading two messages in the same space.

Carrion's existing ammunition plate shows rust-coloured COOLING during its
lockout, with heat bounded to 100%. Exhausted swimming uses the health plate's
EXHAUSTED label and existing danger ink. Its one transition warning gives a
recovery action; resting clears the condition. Damage interrupts treatment
without consuming it, and contact sound retains its own debounce. Evidence and
limits: `docs/adversarial-review/component-craft-2026-10-20.md`.
