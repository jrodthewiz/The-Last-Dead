# Build 08 interface

Replaced the panel-heavy menu/HUD with open typography, dirty ivory/scarlet accents, an artwork-led title, a four-weapon SVG rack, large blood vitals, dash charges, and responsive style feedback. Pause/death screens retain the frozen world with stronger hierarchy. Existing generated Bloodworks menu art remains the source; the icons and edge damage treatment are authored SVG.

Reference direction: the user-specified Doom/Ultrakill movement FPS hierarchy (readable edge HUD, central aim clearance, immediate combat feedback), adapted into original The Last Dead typography and art rather than copied screen assets.

## Behavioral changes

- Hit/kill/parry markers update immediately and expire independently of the drained gameplay event queue.
- Health loss has a delayed trail and brief edge splatter; low health exposes FEED OR DIE. Gore and reduced-motion preferences are respected.
- Weapon slots 1–4 show their active state; keyboard shortcuts remain intact.
- Pause no longer duplicates settings drawers; Escape closes options even from focused input.
- Saved preferences now configure audio/input/rendering on initial load.
- Mobile fire/jump use explicit rows, preventing landscape overlap.

## Verification

`tests/build08-ui.mjs`: isolated installed Chrome/D3D11 at 1280×800, 390×844, 320×844, and 844×390. No page errors, document overflow, HUD/control overlap, or pairwise control overlap. All touch targets at least 44×44. Results: `fit.json`; menu, pause and gameplay screenshots in this directory.

`tests/build08-ui-interactions.mjs`: options Escape from slider, field guide, all four weapon hotkeys, critical health, parry marker, gore/reduced-motion preferences, pause/resume, death/restart, and single settings drawer passed. `interactions.json`. Critical-health and terminal screenshots are controlled state fixtures, not proof of combat balance.

Visual inspection: title, desktop/portrait/landscape HUD, pause and death captured and reviewed. World/weapon pixels in early UI captures predate the Build08 asset integration; final release evidence should use the completed world and arsenal.
