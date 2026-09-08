# The Last Dead campaign director

The campaign is a deterministic three-sector run. Each sector keeps the
existing 12x12 arena bounds so peer validation and the renderer can continue to
use the same coordinate contract. A sector contains three authored waves, a
spawn budget, an alive cap, and a list of delayed spawn entries.

The loop is:

1. Spawn telegraphs appear at a safe anchor at least 3.5 metres from every
   living player.
2. The telegraph resolves into an enemy when its authored delay arrives and
   the sector alive cap has room.
3. The director waits for all queued entries and living enemies to clear before
   starting the next wave intermission.
4. After the final wave, the exit becomes active. Reaching it loads the next
   sector; reaching the exit in The Choir of Teeth ends the campaign in victory.

## Sectors

| Sector | Waves | Introduced pressure |
| --- | ---: | --- |
| The Bloodworks | 3 | stalkers, skitters, casters, bloodhounds, brutes, hexers |
| The Ossuary | 3 | wardens and the first Bellwraith procession |
| The Choir of Teeth | 3 | mire singers, Bellwraiths, and Bellwraith echoes |

Enemy `kind` values are stable for rendering and snapshots: `0` is a rushing
body, `1` is a ranged caster, `2` is an anchor brute, and `3` is a Bellwraith.
The `variant` field selects a profile from `ENEMY_PROFILES`, so new balance
variants can be authored without changing the network identity.

## Run state contract

`newRun(makeCourse(index, { campaign: true }))` exposes:

```js
{
  campaign: true,
  sectorIndex: 0,
  sectorCount: 3,
  sectorId: 'bloodworks',
  sectorName: 'The Bloodworks',
  wave: 0,
  waveCount: 3,
  waveDelay: 2.2,
  director: {
    state: 'intermission', // spawning | combat | exit
    budget: 0,
    spent: 0,
    remainingBudget: 0,
    aliveCap: 0,
    active: 0,
    pending: 0,
    queue: [],
    elapsed: 0,
    seed: 1,
  },
  spawnTelegraphs: [],
  explosions: [],
  campaignComplete: false,
}
```

The authoritative host should include the scalar campaign fields, enemy array,
`spawnTelegraphs`, `projectiles`, `explosions`, and combat effects in snapshots.
The guest can use `makeCourse(sectorIndex, { campaign: true })` when it needs to
rebuild a sector locally. The public coordinate bounds remain `0..12` for both
players.

## Weapons and effects

Weapon index `3` is the `RIFT BAZOOKA`. Its projectile has
`kind: 'rocket'`, `weapon: 3`, `ownerId`, `radius`, `damage`, `knockback`, and
`selfBoost: true`. Rockets use fixed movement substeps to avoid tunnelling,
detonate at walls or enemies, apply line-of-sight splash falloff, and emit an
`explosion` record for the renderer. A nearby owner receives a vertical and
radial impulse and a `rocket-jump` event instead of self damage.

The engine emits spatial events with `x`, `y`, and `z` when relevant. The audio
and renderer layers can key off `spawn-telegraph`, `spawn`, `enemy-attack`,
`rocket`, `rocket-detonate`, `explosion`, `rocket-jump`, `hit`, `kill`, `jump`, `land`, `slide`,
`sector-transition`, and `win` without reaching into simulation internals.

## Authoring a wave

Add a sector entry or edit a wave in `campaign.js`. Each entry is:

```js
{ kind: 3, variant: 'bellwraith', spawn: 2, delay: 1.2, cost: 4, role: 'teleport' }
```

`delay` is measured from the start of the wave. `spawn` selects an authored
anchor and is only a preference; the director chooses the farthest legal anchor
when that preference is too close to the player. `cost` contributes to the
wave budget, while `aliveCap` controls simultaneous pressure. Keep a new wave's
total entry cost at or below its budget so the HUD can explain the full recipe.

