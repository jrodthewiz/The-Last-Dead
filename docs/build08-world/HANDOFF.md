# World handoff to root

The authored world API is stable:

```js
const horror = buildHorrorDetails(worldRoot, materials, course);
horror.authored.animate(nowSeconds);
horror.authored.moving // dynamic meshes; renderer protects these from batching
horror.authored.motion  // { object, mode, phase } descriptors
horror.authored.lights  // authored point-light cues
```

`course.layout` is the source of truth for zone rectangles, route points, landmark anchors, machinery anchors, and light cues. `course.cells` remains the collision/network proxy. `world-polish.js` excludes both `mesh.userData.noBatch` and any ancestor marked `noBatch` from static baking.

The root renderer now calls the explicit `horror.authored.animate(nowSeconds)` hook and protects authored moving meshes. The fallback `onBeforeRender` ticker was removed to avoid duplicate animation.

Validation completed:

- authored map import: 3 maps, 3 layouts, 144 cells per course;
- every authored map has a reachable exit, spawn points, and landmark anchors;
- `node --test tests/world-polish.test.mjs`: 2/2;
- `node --test engine.test.mjs tests/build06-integration.test.mjs`: 23/23;
- syntax checks pass for `campaign.js`, `world-authored.js`, `world-horror.js`, and `world-polish.js`.

Build manifest integration is owned by root and is already complete in the current branch.
## Visual review update

The first hardware screenshot exposed a player-facing gate tooth row at the south anchor, which sat in front of the spawn camera. The gate is now offset 1.35 cells behind the player, and the cones were replaced with a recessed ribbed threshold. The focal organ now uses a physical dark burgundy skin, metallic cage ribs, segmented front plates, a spine/backplate, vascular conduits, and a small emissive heart. The actual review artifact is `docs/build08/weapon-0.png`; it has no foreground obstruction and the ribcage reads from the spawn sightline. Weapon screenshot harness completed with zero page errors.