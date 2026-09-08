# THE LAST DEAD UI pass

Build 04 rebrand and horror interface pass for the Bloodworks arena.

- Visible game identity is now THE LAST DEAD in the document title, menu wordmark, accessibility labels, pause signal, and revision marker.
- The generated foundry artwork remains the menu background, with an open two-zone composition: title and solo launch on the left, exposed art on the right.
- Co-op remains a compact `data-action="coop-toggle"` disclosure. The existing offer, join, answer, accept, copy, disconnect, and clear controls are unchanged inside `#coop-form`.
- Typography uses a condensed ivory wordmark with an amber subject tag and blood-red impact accents. The HUD remains edge-bound with life, energy, dash, weapon, objective, rank, network, and reticle feedback.
- Mobile breakpoints reduce the wordmark and keep settings, build status, solo launch, and the co-op disclosure reachable without forcing the first screen into a large panel.

Validation: `node --check ui.js`, `node --check main.js`, and the Dead Arrival build. No renderer, engine, or main loop files were changed.