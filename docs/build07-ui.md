# Build07 UI pass

Build07 tightens the interface around the **THE LAST DEAD** identity while keeping the combat view open and readable.

## Reference ledger

| Reference | Applied |
|---|---|
| threejs-game-ui-designer/SKILL.md | Yes: state driven overlays, safe areas, touch targets, menu hierarchy, and readability checks guided this pass. |
| references/ui-patterns.md | Yes: compact edge anchored HUD clusters, one primary menu action, and progressive co op disclosure. |
| references/checklists/game-ui-quality.md | Yes: preserved selector contracts, keyboard paths, focus states, and menu/HUD state boundaries. |
| references/checklists/hud-readability.md | Yes: kept labels short, reserved the center for aiming, and retained high contrast vital, dash, objective, and weapon signals. |
| references/checklists/responsive-ui-fit.md | Yes: retained the existing mobile breakpoints, safe area padding, 44px touch targets, and compact campaign route. |

## Build07 changes

- Replaced the duplicated fourth weapon ALT AIRBURST wording with FUSE CONTROL and BURST READY, so the Reliquary rocket alt is represented once in the weapon HUD.
- Updated the visible menu stamp, page title, and revision marker to BUILD 07 / THE LAST DEAD.
- Added a restrained bone, brass, and scarlet accent pass across the title, course metadata, co op disclosure, campaign route, and edge anchored HUD plates.
- Added small brass registration marks and low contrast inner rules to the HUD plates. The treatment stays at the perimeter and does not add a center panel over gameplay.
- Kept all existing menu callbacks, data-action selectors, four weapon slots, campaign route state, co op offer/join fields, settings, pause, finish, touch controls, and responsive rules intact.

## State coverage

The existing UI implementation still covers menu/campaign, solo start, co op disclosure and connection fields, settings, gameplay HUD, pause, finish/dead, network status, toasts, hit feedback, and mobile touch controls.

## Validation

- node --check ui.js
- node --check main.js
- node build.mjs

Browser screenshots remain with the root agent so this pass does not interrupt the active profiling session.