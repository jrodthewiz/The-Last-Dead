# Dead Arrival UI v2

Build 02 visual pass for the Bloodworks menu and combat HUD.

- Menu art: `assets/images/menu-bloodworks-v2.png`, layered under a black and blood red veil so the art reads as atmosphere while controls retain contrast.
- Visual language: condemned medical foundry, ivory type, black steel surfaces, blood red alert lines, and small amber/cyan signal accents.
- HUD changes: flattened edge clusters, tighter typography, reduced nested-card treatment, and stable mobile placement.
- Menu changes: live `BUILD 02 / BLOODWORKS` revision marker, responsive title fit, exposed artwork, and a collapsed co-op disclosure that preserves the existing fields when opened.
- Input contract remains unchanged: all existing `data-action` controls, co-op fields, settings callbacks, and UI methods are preserved.

Validation: `node --check ui.js`, `node --check main.js`, and the Dead Arrival build pass.