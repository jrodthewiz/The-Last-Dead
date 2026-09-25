# Story evidence iteration

The descent now has nine optional records in side rooms and sealed caches. They trace Foreman Inez's missing evacuation truck, Nurse Sera's repeated patients and trip below the wards, the burial keepers' three-bell warning, and the warden's final gate. The five mandatory key clues join the same archive. A player can miss a side record without blocking progression, then review every discovery from **Pause → Records**.

| Floor | Side-room record | Hidden record |
| --- | --- | --- |
| Intake Foundry | The Empty Truck, Old Intake | Maintenance Circuit, Maintenance Nook |
| Graft Galleries | Night Chart, Ward D | Drawer Twelve, Morgue Drawer |
| Catacombs | Sera's Route, Drowned Ossuary | Keeper's Warning, Hidden Tomb |
| Resonance | The Missing Singers, Abandoned Vestry | Sera's Last Instruction, Reliquary Niche |
| Last Descent | — | Inside the Gate, Reliquary Cache |

Records use a small physical document display with a floor signal, a label that faces the approach, and distinct paper proportions for punchcards, charts, notes, scores, tags, and seals. They have their own reachable cells separate from keys, weapon finds, cover, and enemy spawn anchors. The map playground marks them with document icons and shows each record's text on inspection. The archive persists within a Story run and includes the floor and source of each clue.

## Verification

- `npm.cmd run test:map` checks reachability, exclusive pickup cells, one-time collection, archiving, floor persistence, and playground markers alongside the existing route tests.
- `npm.cmd run build` includes `dungeon-evidence.js` in the standalone runtime.
- `tests/story-evidence-qa.mjs` captures live first-person discovery and the desktop/mobile archive in a separate headless browser. See [the browser report](final/report.json) and [the first Foundry record](final/f1-shift-card-world.png).

The record models and labels are made with local Three.js geometry and canvas textures, so the runtime needs no external asset service.
