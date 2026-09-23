# Build 11 map slice: Intake Maintenance Spine

This pass is intentionally small: it upgrades the first Bloodworks sector without
changing the collision proxy or the four-room campaign contract.

## Theme and progression

The player enters a condemned biological recovery plant, clears Intake Bay, and
chooses whether to read the west service branch before crossing the Graft Galleries.
The repeated overhead ribs point toward the Pulse Court; the collapsed branch and
sealed `SERVICE 04` bulkhead explain why the route pinches and why the Furnace Spine
is the only viable exit. Room gates still unlock only after each authored encounter,
so the visual route and the gameplay route agree.

## Procedural setpiece contract

- Macro: one maintenance tunnel spine, one spawn-facing pressure lock, one low
  collapse, and one sealed service bulkhead.
- Meso: repeated dark-steel arch ribs, grounded jambs, overhead conduits, hazard
  stripes, cable junctions, segmented shutter ribs, alternating signal lamps, and
  one anchored quarantine-service manifold at the lock threshold. Intake's right
  wall uses only two deterministic degradation bays and one continuous utility run
  toward the maintenance spine.
- Micro: asymmetric rubble silhouettes, warning lamp pulses, fabricated lock
  fasteners, beveled wheel and conduit separation, a stained drain seam, routed
  hose junctions, and one damaged inspection canister that makes the recovery
  plant's former job legible without prop scatter.
- Materials: dark steel and rusted conduits with a red emergency signal in
  Bloodworks. The same factory can take violet or orange accents for later sectors.
- Runtime: all pieces are visual only and live in `layout.setpieces`; collision,
  enemy navigation, room gates, and progression remain owned by `campaign.js`,
  `engine.js`, and `room-progression.js`.

The setpiece is authored as a staged procedural reconstruction: silhouette first
(arch cadence), structure second (conduit and bulkhead attachments), then material,
light pulse, and static-batching metadata. This follows the `img2threejs` discipline
without pretending that a gameplay screenshot provides hidden-side geometry or exact
PBR evidence.
