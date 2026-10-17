# The Last Dead interface direction

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
