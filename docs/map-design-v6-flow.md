# Map design v6: Bell Nave flow

The Bell Nave's four cover columns now sit at `(14,14)`, `(19,14)`, `(14,17)` and `(19,17)`. The previous generic colonnade placed its eastern pair at X17, directly across the central processional aisle. Moving that pair to X19 opens the court approach and keeps the same four cover blocks, room shell, encounters and side-aisle connections.

Three authored views identify the court doorstep from the south and the central junction from each side arrival. The court view ends before the closed encounter door, so it remains valid with that door sealed. The gameplay loop remains: move through readable thresholds, survive the room encounters, retrieve the Bell Key, then descend after required combat is complete.

## Measured layout

The baseline reconstructs the previous colonnade on the current authored floor. One grid cell is four metres. The processional comparison uses `(17.5,19.5)` in the vestry throat to `(17.5,12.5)` at the court doorstep; the lateral comparison uses `(13.5,16.5)` to `(20.5,16.5)` inside the nave.

| Measure | Previous colonnade | Flank columns |
| --- | ---: | ---: |
| Vestry throat → court doorstep, sealed or open | 36 m / 4 turns | 28 m / 0 turns |
| West → east nave arrival | 28 m / 0 turns | 28 m / 0 turns |
| Whole-floor shortest entry → exit, open | 152 m / 15 turns | 152 m / 15 turns |
| Walkable / solid cells | 333 / 585 | 333 / 585 |
| Nave / floor cover cells | 4 / 37 | 4 / 37 |
| Compiler boundary wall segments | 370 | 370 |
| Rooms / corridors / openings | 11 / 9 / 24 | 11 / 9 / 24 |
| Locked openings / keys / secrets | 7 / 1 / 1 | 7 / 1 / 1 |
| Authored enemy budget | 92 | 92 |
| Room graph loops / edges / nodes | 4 / 20 / 17 | 4 / 20 / 17 |

All-open and sealed connected reach counts are unchanged. The grid-level `deadEnds` diagnostic rises from 29 to 33 with the cover relocation. It counts cells with at most one traversable neighbour, rather than room branches: the authored room graph and its four loops remain unchanged.

## Verification

`tests/map-design-v6.test.mjs` samples the centre aisle and lateral crossing every `.125` cell using a `.32`-cell collision radius in sealed, initial and fully open states. It checks all three arrival rays, the open court threshold, refuge access, exact route changes, and unchanged floor, wall, cover, room, opening, presentation and encounter budgets. The closed court door still blocks the body. Runtime checks confirm that reaching the descent or collecting the Bell Key cannot finish unplayed required encounters.

```powershell
node --test --test-isolation=none tests/map-design-v6.test.mjs tests/dungeon-route-topology.test.mjs tests/dungeon-ingress.test.mjs tests/dungeon-flow.test.mjs tests/dungeon-encounter-progression.test.mjs
```

All 26 tests passed, including the five-floor encounter, gate, key, descent and restart journey.

Integrated build and browser verification belongs to the parent task. These measurements cover grid collision and topology; they do not measure GPU frame time or decorative mesh clearance.

An existing F4 topology limitation is preserved: opening every non-key door also opens the `f4-o-exit-s` arch that shares the chancel key-gate threshold, allowing a grid route to the exit while `f4-o-chancel-n` reports closed. The runtime descent check still requires the key and mandatory encounters. This bounded nave change does not alter either opening.

## Reference ledger

| Required reference | Loaded | Path | Failure reason |
| --- | --- | --- | --- |
| Gameplay systems skill | Yes | `C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/SKILL.md` | None |
| Gameplay workflows | Yes | `C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/references/gameplay-workflows.md` | None |
| Physics engine selection | Yes | `C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/references/physics-engine-selection.md` | None |

The existing deterministic grid collision remains appropriate for this static authored layout. No physics package, engine, timestep, runtime loop or collider type is added. This subtask owns only the F4 nave declaration, the regression file and this report; existing checkout changes are preserved.
