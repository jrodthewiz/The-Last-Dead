# Pickup UI and world cohesion

The pickup HUD now separates the object name, action and storage hint in a
compact field label. Search/treatment progress uses that same label, replacing
the overlapping progress messages. Item receipts sit above the health display,
aggregate repeated pickups, show real quantities, and expire after a short stay.
They do not replace mission messages.

Searching opens a smaller, translucent container sheet. Material pouch capacity
and independent ammunition storage are explicit; blocked rows explain why they
cannot be taken. **E** takes what fits and returns to the world; buttons still
support individual collection and Take all without closing. Anything left stays
in the container. Duplicate weapons report the actual recovered ammunition.
Loose dressings and ammunition remain in the world if their storage is full.
Pickup targets must be in front of the player, with no solid cover blocking reach.

## World changes and checks

The 20 village/landmark homes have ground-following footpaths to nearby roads.
Paths avoid houses, existing yards and the sides of entrance stairs. Tree,
rock, grass, fern and scenery placement leaves those routes clear; boundary
fences/walls leave gaps where a path passes. Twenty smaller orchard trees form
regular planting rows beside the orchard house, distinguishing cultivated land
from the surrounding forest.

Path surfaces are clipped to the exact terrain triangles. They follow changes
in elevation without a strip floating over or cutting through a ridge. One
shared mesh/material renders the complete network. The canonical layout is
prepared offline and validated on loading; `scripts/bake-access-paths.mjs`
regenerates it. Changes to the world signature reroute rather than silently
using an obsolete layout. No route finding runs during gameplay.

Source checks cover all 248 building footprints, every furnished primitive's
wall/ceiling clearance, all 20 road-to-entrance paths and their rendered ground
heights. Runtime checks include the actual scenery/loot colliders and confirm
outdoor-approach-to-container access for all 45 enterable ground floors.
The landing house, boatwright home, keeper workshop, clinic and bookshop were
also captured from inside. Village, orchard, Old Town and headland views were
inspected for how the buildings, vegetation and roads fit together.

The 45 ground-floor interiors remain the playable interior set; city upper
storeys and other buildings remain scenery. This pass does not claim every
floor in the city is playable. Headland and forest clearings retain breathing
room rather than being filled uniformly with props.

`npm.cmd run test:blackwater` includes the layout/targeting/storage checks.
`npm.cmd run test:blackwater:cohesion` runs the owned-browser review with real
colliders, collection flows and finite captures. The existing scavenging suite
also checks healing, last-row focus, mobile input and persistent contents.
Evidence lives under ignored `output/pickup-cohesion/` and is not a game input.

## Verification record

70 Node checks pass. The existing owned-browser scavenging suite passes on
desktop and touch, and the two-player regression passes including direct-to-relay
fallback, combat, vehicles, live-menu recovery and solo-save protection.

The Sites build was published from source commit
`10de796cae0107aa03fa30332125446836934c3b` as version 3. The local server now
serves the same frontend on port 5200; its existing game tab was never reloaded.
Portrait/landscape review includes simultaneous collection receipts and active
rummaging, with bounds checks against the joystick and action buttons.
The final public-URL run passes all 45 interior approaches, all 20 outdoor paths,
quick collection, storage-full preservation and touch prompt/receipt/search
clearance. It records no unexpected HTTP or JavaScript errors.
