# Melee impact reaction

`melee-reaction.js` is a small post-animation reaction layer for the imported
survivor rig. It gives the bat a readable upper-body whip and head lag, keeps
the chainsaw's contact response tight with a restrained wrist chatter, and
leaves a deterministic asymmetric settled pose when a hit kills an enemy.

The layer is intentionally not a physics engine. The simulation still owns
enemy collision, translation, damage, and death. The animation mixer remains
the pose authority. Reactions are local quaternion offsets that are removed at
the start of the next frame, so they cannot accumulate or fight the mixer.

## Integration order

Create one state when the enemy visual is created:

```js
const reaction = createMeleeReaction(actor);
```

For every visual frame, use this order:

```js
restoreMeleeReaction(reaction);   // before mixer / authored animation
mixer.update(dt);
updateMeleeReaction(reaction, enemy, dt, rootYaw);
```

`enemy` may provide:

```js
{
  meleeHitId,       // increment only for a real contact
  meleeHitAngle,    // world horizontal angle in radians
  meleePower,       // bat ≈ 1, chainsaw ≈ .25, heavy ≈ 1.5
  meleeKind,        // "bat", "chainsaw", or "heavy"
  meleeActive,      // true while a chainsaw is held against a target
  dead,
}
```

`getMeleeReactionDiagnostics(state)` exposes `boneCount`, `hitCount`,
`maxOffset`, `active`, `dead`, and `finite` for renderer diagnostics. Call
`resetMeleeReaction(state)` when reusing a defeated enemy visual.

The state uses bounded springs with a maximum four substeps for a frame hitch.
The dead pose is additive and stays below the limb-safe clamp. It creates no
dynamic bodies, colliders, or geometry; the hot path reuses its reaction
entries and scratch quaternions.
