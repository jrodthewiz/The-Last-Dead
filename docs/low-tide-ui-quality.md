# Low Tide UI quality pass - 2026-10-02

The interface now follows the chapter's survival/investigation tone: dark field-kit panels, restrained gold navigation accents, compact mission guidance and a checkpoint-focused recovery screen.

## Corrections

- Removed Low Tide's arcade death statistics in favor of return point, recovered records and a clear retry action. Pause copy now distinguishes an established checkpoint from the first dock arrival.
- Reduced repeated HUD objective/route text and duplicate record toasts. Longer records remain available in the journal.
- Gave equipment, map and journal distinct titles. Kept the close button, tabs and return hint fixed while content scrolls.
- Opened the newest journal record first, with keyboard-operable disclosure rows for older records. Moved instructions below the evidence.
- Added indoor objective markers and room-specific map legends, distances and guidance.
- Removed one unnecessary empty equipment row in Low Tide. Existing eight-weapon capacity is unchanged.
- Fixed repeated hidden-attribute writes caught by the existing backpack regression; unchanged frames now produce zero DOM mutations.

## Verification

- 42 focused mission, harbor, navigation, vehicle, inventory and scavenger tests passed.
- Existing backpack browser regression passed at 1280x720, 390x844, 844x390 and 320x640: equipment actions, keyboard close, focus trap, map and zero unchanged-frame mutations.
- Low Tide browser UI suite covers mission notice, equipment, seven-record journal, disclosure keyboard interaction, focus wrapping, indoor/outdoor maps, pause layering, recovery and retry callback.
- Journal fit checks cover 1440x900, 1280x720, 844x480, 390x844 and 320x640. No horizontal overflow; close remains reachable while content scrolls.
- Screenshots inspected for equipment, journal, HUD, indoor map and short recovery layout. Production build and syntax checks passed.

Evidence: `output/playwright/low-tide-ui-quality/` and `output/playwright/scavenger-pack/`; rule-test log: `output/ui-quality-regressions.txt`.

This pass uses actual UI and harbor modules in an isolated browser fixture. Completed mission flags are supplied for maximum-content layout coverage; it does not repeat the prior full production chapter playthrough. Narrow windows are layout checks, not mobile gameplay certification. Cold-start performance, voiced radio, controller-only menu navigation and a comprehensive accessibility audit remain outside this pass. The user's existing game tab/server was preserved.

## Implementation and reference ledger

Changed UI: `ui.js`, `horror-ui.css`, `scavenger-pack-ui.js`, `scavenger-pack.css`, `main.js`, `harbor-navigation.js`. Browser harness: `tests/low-tide-ui-quality.mjs`, `tests/fixtures/low-tide.html`.

Applied local skill `threejs-game-ui-designer`; reviewed `ui-patterns.md`, `checklists/game-ui-quality.md`, `checklists/hud-readability.md`, and `checklists/responsive-ui-fit.md`. Guidance applied to hierarchy, game-state wording, focus behavior, panel scrolling and responsive fit. No external reference images or new assets were required.

## Second polish pass

Equipment now previews damage before fitting, marks success/error feedback with text and accent borders, and gives empty inventories an appropriate next action. Rejected equip/fitting callbacks show feedback without spending scrap. The field kit has a consistent header and a visible description specific to the selected view (also used as the dialog's accessible description). Arrow keys and Home/End navigate view buttons; brief opening/press feedback respects reduced-motion preferences. Fixed render cache keys when switching between chapter and legacy equipment layouts.

Verification: 15 focused inventory/mission tests and production build passed. Both browser suites passed again; expanded backpack coverage includes empty inventory, rejected actions, unchanged scrap, arrow navigation, reduced motion and four window sizes. Low Tide journal/overlay fit still passes five sizes. Updated screenshots are in the same artifact folders; equipment view was visually inspected. Scope remains UI polish, not whole-game release certification. The same four skill references above were read for this pass. Changed files: scavenger-pack-ui.js, scavenger-pack.css, tests/scavenger-pack-ui-smoke.mjs.
