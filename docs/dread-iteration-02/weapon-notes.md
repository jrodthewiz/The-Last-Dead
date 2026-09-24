# Weapon readability pass

This bounded pass targets the 1/3 mechanism/material readability score in the
dread iteration 02 visual baseline. The supplied idle/action frames showed
distinct silhouettes, but the Ossuary jaw and Reliquary claws did not create a
visible physical opening when firing; the dark casing, bone, wood, and brass
roles also collapsed together.

## Implementation

- Ossuary keeps the existing jaw meshes and sockets. A shot opens the two jaw
  members with local side travel (`+/- 0.072`) and hinge rotation, then returns
  them to rest through the existing damped shot state.
- Reliquary keeps the existing claw meshes and hinge pins. A shot moves each
  side outward (`+/- 0.082`) with a small hinge rotation, exposing the existing
  muzzle aperture by silhouette. Hinge pins preserve their authored `+/- 0.16,
  0.2` base positions while adding shot travel.
- Mechanism meshes are explicitly marked dynamic and remain under their tagged
  mechanism pivots when the runtime static batch pass runs.
- Existing recoil, cylinder/core motion, muzzle flash, projectile origins,
  inspect/grip sockets, and public wrapper exports remain intact.
- No lights, textures, or meshes were added. Existing steel/wood maps remain
  shared, with their color-space arguments now explicitly set to
  `THREE.SRGBColorSpace`.
- Material response is lifted only for the targeted weapon roles: bone and
  wood receive modest camera-side fill, while the steel body remains restrained
  so the weapon does not wash out.

## Budget and validation

Triangle counts are unchanged because the pass only adds transforms and
material settings: Ossuary 11,982 triangles; Reliquary 10,506 triangles. Both
remain under the 12k weapon budget.

Focused validation:

```text
node --test tests/weapon-mechanism-motion.test.mjs
pass (2 tests, 0 failures)

node --test tests/weapon-batching.test.mjs
pass (4 tests, 0 failures)
```

The focused tests check the jaw and claw gaps, return-to-rest behavior, and
live child transforms after batching. Browser recapture remains with the
parent task.

## Asset sourcing ledger

This pass intentionally uses procedural existing geometry and the repository's
already-authored ImageGen steel/wood maps. No new external generation was
requested or introduced; there are no new image or 3D generator outputs to
integrate.
