# Harbor weapon inventory

The harbor uses the same eight weapon definitions and melee combat as Story. `run.ownedWeapons` remains the single ownership authority. World pickups add ownership without replacing or automatically equipping the held weapon. Eight weapon slots are separate from the twelve-scrap fitting pouch.

`weapon-inventory.js` exports `WEAPON_CAPACITY`, `WEAPON_PICKUP_RADIUS`, `collectWeaponPickup(run, itemOrId, {castRay})` and `tickWeaponInventory(run, {castRay})`. The tick is gated on `course.scavenging`. Pickups come from `course.weaponPickups`; a caller cannot grant an arbitrary object. Validation requires a living grounded player in play, distance at most 0.65 gameplay cells, a valid weapon index, and a clear engine ray. An absent or invalid ray result fails closed. `backpack.weaponPickups` remembers consumed IDs, while `weapon-stashed` events carry ID, weapon index, position and whether the player already owned that weapon. Duplicate ownership is never added. Shared local-world ownership synchronizes to a peer.

The backpack UI presents authored weapon silhouettes, melee/firearm families, eight occupied/empty slots, an independent selected item, an IN HAND marker, the equipped state, damage detail from supplied weapon definitions, and explicit Equip / Fit actions. Selection cannot equip by accident. `onEquip(index)` delegates to the engine; the panel stays open and the caller retains pause/resume ownership. No claim of persistent save storage is made: this is run-scoped ownership, preserved by normal floor transitions.

## Verification

- `node --test --test-isolation=none tests/weapon-inventory.test.mjs`: pickup, duplicate, invalid ID/index, range, wall/absent ray, dead/air/paused, shared world tests.
- `PLAYWRIGHT_PATH=C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright node tests/scavenger-pack-ui-smoke.mjs`: independent browser contexts at 1280×720, 390×844, 844×390 and 320×640; real selection, fitting, equipping, keyboard close/focus wrap, empty slots, no horizontal overflow, all buttons at least 44px, zero unchanged-frame DOM mutations, no page errors.
- Screenshots: `output/playwright/scavenger-pack/`. Desktop shows the whole rack and fitting action at 720px height. Narrow/landscape panels scroll; browser checks reach and click actions after scrolling. Physical mobile hardware was not tested.

UI reference ledger: read `threejs-game-ui-designer/references/ui-patterns.md` and `checklists/game-ui-quality.md`, `hud-readability.md`, `responsive-ui-fit.md`, `mobile-input.md`. States covered: launcher, paused inventory, owned/empty slots, selected/equipped, standard/fitted, insufficient scrap, keyboard focus, narrow portrait and landscape. Existing fail/win/settings flows are unchanged.
