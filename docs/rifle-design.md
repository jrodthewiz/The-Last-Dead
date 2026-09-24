# Rifle design pass

This pass adds two authored first-person rifle viewmodels to the occult-industrial weapon family. The factories are intentionally standalone so the existing four slots can remain stable while the renderer decides when to register slots 4 and 5.

## Variations

`CARRION` is the compact automatic. Its stamped receiver, skeletal rear brace, curved magazine, vented short shroud, and brass bolt handle form a forward-heavy silhouette. A reciprocating bolt carrier and magazine follower give every automatic shot a visible mechanical cycle.

`MOURNING` is the heavy marksman rifle. It uses a long wood-and-black-steel chassis, raised cheek rest, long sleeved barrel, box magazine, open optic, exposed bolt handle, and a small charge indicator. The slower action has a longer rearward bolt travel and can accept a gameplay charge value without turning the body into an emissive prop.

Both variants use +Y up and -Z fire direction, the existing worn steel and cabinet wood maps, shared material roles, and the existing first-person arm sockets:

```js
const rifle = createRifle({ variant: 'carrion' });
animateRifle(rifle, shot, elapsedSeconds, deltaSeconds, {
  heat: 0.35,
  charge: 0,
  shotSequence: run.shotSequence,
});
```

Every root exposes `muzzle`, `projectileOrigin`, `grip`, `supportGrip`, and `resourcesReady`. Dynamic parts are listed under `root.userData.rifleMechanisms` and tagged with `userData.weaponMechanism`, so the existing static batching pass can merge safe surfaces while preserving animated pivots. Diagnostics are available at `root.userData.diagnostics` and include mesh count, triangles, materials, sockets, mechanisms, and the 12,000 triangle target.

## Feel hooks

Carrion’s cycle responds to every live shot sequence and cools quickly enough for rapid fire. Mourning’s bolt has a deeper rearward motion and its charge bar follows the supplied `charge` value. Both models add bounded recoil, heat response, trigger motion, and no per-frame object allocations. `shotSequence` is only consumed while `shot > 0`, which keeps hidden weapons inert when another slot fires.

## Asset sourcing

The high-value surface uses the project’s authored procedural geometry plus the existing worn steel and wood textures. The external asset credential probe reported `TRIPO_API_KEY=MISSING`, `GEMINI_API_KEY=MISSING`, and `ELEVENLABS_API_KEY=MISSING`, so no client-side generation or network dependency was introduced. A concept sheet can be added later under `assets/concepts/rifles/` if credentials become available; runtime code does not depend on it.

## Bounded model check

The focused test in `tests/rifle-model.test.mjs` checks sockets, metadata, pivot protection, live-shot gating, charge response, bolt return, and the triangle budget. Current procedural totals are approximately 5,096 triangles for Carrion and 4,164 for Mourning before renderer-side static batching.

## Runtime readability correction

The first runtime captures showed both rifles collapsing into the room's near-black value range, with the rear receiver and stock reading as broad slabs. The correction keeps the same mesh and triangle counts while raising the panel roles, leaving edge and brass surfaces un-mapped for value separation, and adding a restrained material-owned diffuse bounce toward the camera. Carrion's receiver is narrowed to `.88/.92` camera-side scale; Mourning's chassis is `.90/.92` and its stock is `.86/.84`, preserving the cheek rest and hand sockets. The body remains non-emissive. Fresh runtime capture should be checked with the parent renderer's modest rifle-only fill before any further geometry changes.
