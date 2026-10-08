# Forest vegetation source and runtime contract

The forest uses Daniel Greenheck's MIT-licensed EZ-Tree 1.1.0, pinned to
`dcf309bd86bd521083d9c70f01f2de45fdc7c457` (2026-07-16). The exact source and
download hashes, local adaptations, licenses and texture roles are recorded in
`manifest.json`, `source-files.json`, `LICENSE.ez-tree.txt` and
`LICENSE.textures.md`. No reference-game code or assets are used.

Sources:

- https://github.com/dgreenheck/ez-tree
- https://www.eztree.dev
- https://ambientcg.com/view?id=Bark001
- https://docs.ambientcg.com/license/

`ez-tree/tree.js` retains the original seeded growth queue, continuation rules,
stratified branch/leaf placements, ring meshing, leaf cards and rounded canopy
normals. It removes the demo scene, materials, GLSL wind, preset JSON imports,
mesh creation, trellis rendering and export logic. It imports the game's
existing `vendor/three.module.js`, not another Three package. The only growth
data sets included are the exact upstream Ash Medium and Pine Medium presets.
An optional bark tile length makes V cumulative arc length and U integer
circumference repeats; defaults reproduce the upstream geometry contract.

The forest normalizes three seeded skeletons per species to a meter-height
template and instances them with authored placement heights/yaws. It adds a
small root flare and drops numerically collapsed pine-tip triangles. Three LODs
share each skeleton. Ash costs 9,304 / 4,750 / 2,796 triangles. Pine costs at most
9,086 / 4,299 / 2,223 triangles. No crown sphere or disk geometry is present.

Runtime integration (root owns placement exclusions and physics):

```js
const forest = createForestVegetation({
  placements: [{id:'park-ash-01',species:'deciduous',x:214,y:0,z:265,height:12,seed:10}],
  lightSources: [sun, skyFill],
  lodDistances: [0,35,80], cullDistance: 190,
});
scene.add(forest.root);
await forest.ready;
forest.update(camera, elapsedSeconds, true); // before compile/render
// each frame: forest.update(camera, elapsedSeconds);
// authority: use forest.trunkProxies; do not turn leaves into solid geometry.
// release: forest.dispose();
```

Placement y is the authoritative ground contact, with no terrain sampling in
the factory. Each `trunkProxies` record contains x/y/z, a narrow cylinder radius,
height and world bounds. Actual root flare radius is inside that proxy. Explicit
collision radii are .10–.55m; taller trees can narrow horizontally to fit. Heights
are 4–24m, and placement IDs must be unique. Canopies and branches are non-solid.
The complete crown bounds include the small leaf movement envelope.

The shader uses three owned native WebGPU Standard node materials with the
requested graphic palette and broad sampled leaf/bark luminance. Veins, needles
and bark relief remain visible. Leaves are opaque alpha-tested double cards,
with mipmaps, clamped edge filtering and rounded normals. No transparent blend
layers, whole-tree glow, raw GLSL or per-tree shader is used. Bark maps are sRGB
color and linear OpenGL normal, nominally .60m tiles at a twelve-meter reference
height. One source texture set is shared by both species. Height variation can
change apparent texture size; the three seeded templates stay within that
reference rather than allocating per-tree texture copies.

Leaf-only native TSL wind runs after instance transforms, so movement is in world
meters: tips move at most ~4.7cm; UV.y=0 card roots do not move. Branches and tree
roots are static. Shadows are restricted to near pools. A near pool containing
a caster inside `shadowDistance` also casts its other near trees (up to the near
LOD boundary plus 6% hysteresis). This keeps the draw budget measurable.

There are at most six templates / 36 geometries / three materials / four textures
and 36 primary scene draws for all 512 supported placements, plus up to 12 near
shadow draws. Trees are selected per-camera into fixed instance buffers; far
off-screen crowns and crowns wholly beyond the cull distance are omitted. No
resource is allocated in the update loop. `diagnostics()` reports actual active
counts, per-tree LOD cost, CPU buffer bytes, source status and construction time.

The four bundled image files load from local relative URLs. A deterministic
cutout/bark fallback is available in Node and while browser loading completes.
`ready` reports loaded/fallback/error records and never swaps the Texture object.
Source errors retain the fallback and must be reported by browser QA rather
than treated as a successful source-image capture.

The factory owns its created geometry, native materials, instance resources and
textures. Disposal is idempotent, detaches the root and frees each owned resource
once. Supplied material colors are copied; supplied bark maps are borrowed and
are neither modified nor disposed. No global cache or physics state is changed.
