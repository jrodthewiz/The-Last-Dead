# Room progression gameplay

The campaign is a deterministic authored room graph built on the existing 12 x 12 cell proxy. Each act uses four disjoint north-to-south room bands:

1. An entry room teaches the current enemy family.
2. A crossfire gallery adds two side lanes and a readable rotation route.
3. A focal court concentrates the harder composition around the act landmark.
4. An objective vestibule provides a short non-combat exit read.

This uses the useful Doom and Quake rhythm of compact sectors, visible threshold doors, side loops, sightline breaks, and a gated landmark room. The layout is authored and deterministic so multiplayer snapshots and browser iteration do not depend on runtime generation.

## Contract

createCampaignCourse exposes rooms and roomProgressionVersion. Each room has:

- id, sectorId, index, sequence, name, role, and theme
- bounds (minX, minZ, maxX, maxZ) in gameplay cells; current rooms span x=0..12
- entry and exit anchors
- spawnPoints for strict room-local encounter spawning
- landmarks
- portals[]
- encounter (tier, budget, maxAlive, waves, composition, tactic)
- visibility (radius, keepPortals, preload)

A portal is: { id, kind, axis, at, span: [lo, hi], from, to, lockedBy, barrierId }.

Door and lift portals use two-cell integer openings. Current threshold openings are [1,3] and [9,11]; the objective vestibule uses [5,7] and [8,10]. The portal spans are the shared input for the room kit, culling, HUD objective, and collision tests.

## Runtime state

createRoomProgression(course, sectorIndex, { requireEntry }) returns:

- currentIndex and activeRoomId
- pendingIndex when a clear has opened the next threshold but the player has not crossed it
- completed[]
- phase (combat, unlocked, or exit)
- objective
- gates{} and barriers{}
- collisionRevision
- requireEntry

roomProgressionSnapshot serializes the state above, including every gate and barrier. The host owns this state. After applying a host snapshot, call syncRoomGateCells(course, progression).

The engine uses newRun(course, { requireEntry: true }) for the live campaign. A room clear opens its paired threshold and sets pendingIndex; the next wave remains in intermission until roomContains(nextRoom, player.x, player.y) is true. This preserves the older automatic progression behavior when the option is omitted for legacy smoke tests.

## Collision ownership

course.renderCells is the fixed authored grid for the renderer. It contains the room boundary walls and exact door openings. course.cells is the current authoritative gameplay grid derived from renderCells:

- closed barriers add a full wall across the threshold
- open barriers restore only the declared cell openings
- syncRoomGateCells updates the grid after clear, sector transition, or a network snapshot

Player movement, enemy canStand, enemy grid routing, visibility rays, hitscan, splash line-of-sight, grapples, and projectile stepping all consume course.cells. This keeps an enemy or shot from slipping through a closed portal while the renderer continues to build stable geometry from course.renderCells.

## Difficulty curve

Every combat room owns one wave. The objective vestibule owns no wave.

| Act | Entry | Gallery | Court | Live cap |
| --- | ---: | ---: | ---: | ---: |
| Bloodworks | budget 5 | 9 | 14 | 4 / 5 / 6 |
| Ossuary | 9 | 13 | 18 | 5 / 6 / 6 |
| Choir | 12 | 18 | 27 | 6 / 7 / 8 |

Threats progress from rushers and a caster, through skitter and bloodhound rotation pressure, to brutes, hexers, wardens, bellwraiths, and mire singers. The cap never exceeds eight simultaneous enemies. Delayed deterministic queues keep spawn telegraphs readable and avoid a burst of allocation work in one frame.

## Performance intent

The fixed room graph avoids runtime BSP or mesh generation during combat. Four small rooms, an active room plus one portal neighbor for visual retention, and the eight-enemy cap give the renderer a bounded working set. The visual agent should use course.renderCells for stable walls and room.visibility for room-kit retention. Gameplay state remains a small serializable object suitable for the existing fixed-step simulation and multiplayer host snapshot.

## Verification

- node --test engine.test.mjs tests/room-progression.test.mjs
- Current result: 24 passing tests.
- Coverage includes disjoint bounds, exact full-width barriers, far-side gate rejection, body-radius movement at jambs, closed/open ray checks, deterministic room clears, and strict physical entry.

References used: C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/SKILL.md, references/gameplay-workflows.md, and references/physics-engine-selection.md.
