# Story discoveries and weapon finds

The five-floor descent now has a connected trail of evidence. The Foundry record establishes that bodies were transferred while still alive. Surgery names those same patients again after their recorded deaths. Burial tags carry bell frequencies, the choir uses those bells to contain what came up from below, and the final warden sealed itself into the throat. The key on each floor reveals the next piece as the player pushes toward the lift.

The player starts Story with the Ossuary. Seven optional, reachable finds fill the rest of the eight-weapon arsenal. Pickups use the same authored models as equipped weapons, displayed above a metal cradle with a rarity-colored ring, rotating highlights, and a vertical beacon. Moving close collects and equips the weapon; ownership persists between floors. The HUD shows locked slots and the arsenal count. Wheel and touch cycling skip locked slots. Arena and co-op retain the full loadout.

| Floor | Exploration finds | Rarity | Story placement |
| --- | --- | --- | --- |
| Intake Foundry | Breach Shotgun; Wake Bat | Uncommon; rare | Pressure sluice and former loading bay |
| Graft Galleries | Carrion; Mourning | Rare; epic | Ward C and surgical scrub room |
| Catacombs | Arc Lance; Reliquary | Epic; legendary | West crypt and skull niche |
| Resonance | Ripper | Legendary | Organ loft |
| Last Descent | Full arsenal carried forward | — | Finale |

The map playground marks each find with a rarity-colored **W** diamond and exposes its authored note when clicked. Loot uses its own valid walkable cell and room identity, separate from keys, cover, and enemy spawn positions.

## Verification

- `npm.cmd run test:map` — 15 passing checks, including reachability, pickup, auto-equip, locked switching, and ownership across floor transitions.
- `node --test engine.test.mjs` — 20 passing checks in this pass.
- `npm.cmd run build` — complete standalone build.
- `tests/story-loot-qa.mjs` — separate headless Edge tab captured a visible weapon and the collected state on Floors 1–4. [Browser report](final/report.json) records no page or HTTP errors. [Shotgun](final/f1-breach-sluice-world.png), [Carrion](final/f2-carrion-ward-world.png), [Reliquary](final/f3-reliquary-niche-world.png), and [Ripper](final/f4-ripper-organ-world.png) first-person captures are available for review.

The weapon art is built from the repository's existing procedural models. External generation credentials were unavailable for this pass. This is an iteration on spatial storytelling and collectible presentation; further room detail and story scenes remain useful areas for future polish.
