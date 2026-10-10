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


## Controls field manual — October 7, 2026

The main-menu guide uses the current olive and worn-gold interface tokens, a ruled three-column field manual on desktop, and a single column on phones. Movement/weapons, close combat/extraction, and standard controller bindings stay together. Every existing binding and qualifier is retained; two malformed separators become readable middle dots.

The guide owns bounded viewport scrolling. Its heading remains visible, and the original Controls toggle becomes Close controls at the same fixed header edge. This preserves the existing callback, focus, controller confirm/cancel, and ancestor-scroll path without changing input behavior. The guide is an optional sheet, not an aria-modal dialog. Short screens scroll the same contents rather than shrinking text. This pass owns only main-menu guide markup and its scoped styles.

## Supply pouch readability - October 7, 2026

The existing materials ledger and workshop actions retain their olive field-kit structure. Recipe and life/treatment text use 12px supporting type; action names use 14px and pouch explanations 13px. Unavailable actions keep muted ink and borders without fading their requirements. Spare-material discard targets are 44px tall. This is a readability pass with more vertical scrolling where needed; it changes no quantities, requirements, callbacks or availability rules.
