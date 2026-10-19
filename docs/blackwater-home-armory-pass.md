# Cottage interiors and weapon handling

Eighteen cottages now have fitted sink cabinets, working-height counters,
bedside cabinets and lamps, linen storage, window curtains and timber living
floors. Ordinary homes also have dining chairs and a short sleeping screen;
the boatwright and gardener retain their authored workshop partitions. The
keeper's workshop gains a narrow cot and linen bench. These use the existing
instanced primitive kit and console palette, without extra lights or downloads.

The interior plan still owns both rendering and substantial furniture collision.
The entry corridor, old loose supply positions and central movement route remain
clear. Cloth, tabletop objects and fine floor joints do not create oversized
movement proxies. House footprints, terrain, entrances and persistent loot IDs
are unchanged.

Loose weapon finds are now consumed by their own stable ID. A new find is loaded
and equipped; a weapon already recovered elsewhere yields up to one magazine of
spare ammunition/fuel. A full reserve leaves it in place. This is a one-time
recovery, including after save/load. Recovering a weapon during a reload waits
until that reload finishes, rather than silently recovering without equipping.

Carbine, revolver, shotgun, launcher and marksman shots require a fresh trigger
press. Carrion, Ripper and Arc retain their held-fire behavior. Reload and equip
release combat input, so a previous held trigger cannot fire the new weapon.
The existing draw animation has a 0.30-second firing guard. A pending melee
contact cannot be cancelled by swapping weapons. Reload percentage, dry-fire
feedback and weapon-specific empty-ammo/fuel hints use the existing HUD.

## Reconciled hosted work

Before publishing, the Sites source had advanced to
`d061f8350f1f8d7a5ca1bd32df000f6c792a9c9e`. Its visible survivor body,
distance-driven feet, input-release/camera-jump fixes and clearer retro film
rendering are preserved in the canonical repository. This prevents the local
build and Railway release from reverting the newer hosted work. The two
`scripts/verify-*.mjs` checks were brought over with canonical source paths.

## Verification

74 Node checks pass, including save/recovery transactions and substantial cottage
furniture/entrance checks. The recovered body/input checks also pass: eight body
views, 120 animation frames, release/cancellation/multitouch ownership and a
600-frame reload regression.

The owned-browser handling review recovers all seven world weapons with E,
checks all eight ammunition/fuel reloads, verifies spare-ammo receipts and melee
commitment, and exercises single versus held fire through the production fire
button. It captures five cottage interiors, finds and the break-action reload.
The cohesion review checks all 45 real exterior-to-container approaches and all
20 outdoor access paths with the loaded scenery and loot collision, plus desktop
and touch collection/full-storage layouts. Evidence is retained under
`output/home-armory-pass/`; it is not runtime input.

These are bounded interaction and visual checks, not an extended performance
soak or certification of every network/device combination.
