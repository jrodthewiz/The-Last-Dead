# Cape Lodge 75: bounded upstairs implementation

This began as a read-only evidence plan in inspection08. The bounded Cape75 implementation is verified in [inspection09](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-inspection-09.md): real player/NPC ascent and descent, shared finite supports/solids, slab impacts and cosmetic bodies. [Inspection10](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-inspection-10.md) adds constructed open rails, framed upper windows and an authored listening/evacuation bedroom, with a final native free-cursor actual-W journey. Other buildings' upper floors remain pending. The original investigation below records the starting boundary. [Inspection11](C:/Users/wolfk/Desktop/thelastdead/docs/blackwater-inspection-11.md) adds a height-aware, explicit-Q portable forest route, a full-pack field-map workflow and a focused pillow/printed-map refinement. Native street-to-desk traversal and 390px portrait HUD evidence are recorded in that report; its current visual gates are stated separately from the full-world target.

The house `coast-lot-4-0-0-0` is at world158/248 m, yawπ,12 ×16 m, height6.4 m. Its visible lower floor top is0.20 m and sealed intermediate slab top2.6475 m. Terrain height is0 m. The current plan has two lower room bands and no stair or upper-room definition.

## Shared authority

Opt only this house into serializable finite solids and actor supports. Retain groundAt as terrain authority. One building plan should define walls, slab pieces around a genuine stair opening, stair treads/landing and upper furniture. Rendered meshes, body collision, shots and Cannon statics should consume those same records. Preserve both lower portals and the useful discovery.

Potential right-side central stair placement is an inference requiring clearance probes: it uses part of the currently reserved four-metre passage. Do not silently sacrifice the through-route to fit art.

## Implementation ownership

- Structure: architecture.js, furniture.js and coastal-world-layout.js. Current course generation drops furniture vertical bounds; preserve finite bounds for this opted-in house. Grid lower door openings must not become upper-wall holes.
- Movement: engine.js plus a shared support/height helper. Select reachable support using current absolute feet, prior support and bounded step height. Stairs must ascend continuously. Walking off an edge preserves absolute height; landing selects the first crossed surface. Include finite body collision and ceiling contact.
- Presentation/combat: renderer.js, engine eye/enemy bases and peer height presentation. Rays/projectile segments intersect finite walls/slabs; lower furniture stops blocking upstairs. Upstairs enemies need navigation links and a support-aware refresh.
- Cosmetic physics: corpse-physics.js consumes identical floor/stair/furniture boxes. Swept support/correction uses previous position and the crossed floor, preserving bodies below upper slabs. Blood, tissue and drops use the same support.

Root owns integration. Do not overlap another worker's geometry or renderer edits. Existing terrain, bridges and unopted buildings retain current behavior.

## Acceptance evidence

1. Actual ticked forward input enters, climbs, crosses upstairs, descends and exits. No coordinate teleport; activeInterior stays null.
2. Actors at identical X/Z stay on different floors. Jumping below the slab hits its underside; falling through the opening reaches the lower floor.
3. Maximum-speed and diagonal stair approaches, landing rails and ceiling clearance remain stable.
4. Rifle/shotgun shots and rockets hit separating slabs but pass through the stair opening. Enemy bases and bite obstruction agree.
5. Actual ragdolls, drops and tissue settle upstairs, fall through openings and remain below slabs when created below them.
6. All94 lower routes/187 apertures, terrain/bridge combat, discovery, physics rebuild and disposal regressions pass. Record native ascent/descent.

## Starting source evidence from inspection08

- architecture.js builds two visual storeys and seals their slab.
- coastal-terrain.js groundAt supplies one terrain/deck height.
- engine.js canStand/castRay ignore height; tickPlayer treats z as terrain-relative jump.
- coastal-world-layout.js strips furniture Y bounds into horizontal obstacles.
- blackwater-district-layout.js reconstructs grid doorways without floor limits.
- corpse-physics.js currently creates terrain, bridge decks and coarse grid walls.
- harbor-interiors.js entry uses teleport/activeInterior; it is unsuitable for continuous house traversal.

Gameplay skill, gameplay-workflows.md and physics-engine-selection.md were read under C:/Users/wolfk/.codex/skills/threejs-gameplay-systems. These findings identify the next implementation boundary; they do not verify it.
