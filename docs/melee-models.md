# Melee weapon models

The melee kit adds two authored first-person weapons through `weapon-melee.js`:

- `bat`: a battered hardwood bat with a swollen impact head, three steel/brass
  bands, rivets, grip wraps, wood gouges, and a dark steel impact cap.
- `chainsaw`: a red industrial motor casing, venting, fuel cap, trigger guard,
  wrapped brace handle, steel guide bar, sprockets, blade markings, and a
  22-tooth loop that advances around the complete guide path while revved.

Both factories return a grip-centered `THREE.Group` in the shared viewmodel
frame (`+Y` up, `-Z` forward). `grip`, `supportGrip`, `impactTip`, and
`projectileOrigin` sockets are exposed on `root.userData`, with a
`resourcesReady` promise for the shared wood texture. The factories expose
`root.userData.melee`, `meleeMechanisms`, and `diagnostics` for renderer and
batching diagnostics.

The renderer gives the bat a diagonal upright hold pose (`x=.92, y=-.32,
z=-.22`) and turns the chainsaw toward a broadside guide-bar read
(`x=.32, y=.58, z=-.10`) before fitting the two viewmodel arms to the sockets.
During attacks the hands follow those moving grip poses while sleeves extend
from shoulder anchors below the camera. The hands retain their original scale;
the widest backswing cannot reveal a floating sleeve end.
These two dynamic arms retain the existing procedural cloth/wrist assembly;
the imported rifle sleeve replacement skips them so asynchronous asset loading
cannot overwrite the moving wrist fit.

## Animation contract

Call `animateMeleeWeapon(root, frame, time, dt)` every render frame. `frame`
uses the following values:

```text
progress:     0..1 attack timeline
active:       attack is in windup/strike/follow-through
heavy:        bat heavy-swing variation
contact:      0..1 impact pulse supplied by gameplay
sawRev:       0..1 chainsaw engine speed
sawActive:    chainsaw motor is running
sequence:     attack sequence number for event bookkeeping
reducedMotion: clamp swing/vibration for accessibility
```

The shared authored timeline is windup `0..0.24`, strike `0.24..0.48`,
contact at `0.40`, and follow-through/recovery `0.48..1`. Bat yaw moves from
a pulled-back `-.88` radians through `+1.60` radians at contact, with local
pitch lowered to `-.50` and a short lift that keeps the impact tip near the
reticle. The post-contact key reaches `+1.90` yaw and `-.70` pitch before
recovering to the authored hold, so the attack reads as a cross-screen,
weighted swing. Chainsaw yaw moves from
`-.48` through `+.46` with a bounded forward lunge of `-.095` local units.
Both poses ease back to their held frame. Chainsaw vibration is capped below
`0.02` local units and its chain phase wraps in `[0,1)`. Contact only raises a
small material response; the impact ring was intentionally omitted because
world blood and spark pools provide the hit feedback.

## Asset sourcing and quality ledger

```text
Reference ledger:
- visual-scorecard.md: read
- implementation-blueprint.md: read
- model-recipes.md: read
- render-recipes.md: read
- procedural-model-quality.md: read
- material-lighting-quality.md: read
- performance-safe-visual-detail.md: read
- threejs-3d-generator/SKILL.md: read
- threejs-image-generator/SKILL.md: read

External asset sourcing:
- Credential probe: TRIPO_API_KEY=MISSING, GEMINI_API_KEY=MISSING;
  ELEVENLABS_API_KEY=MISSING was also reported by the project pass.
- Bat: procedural authored geometry with shared existing wood texture. A
  generated model was blocked by the missing Tripo credential; procedural
  geometry is preferable for the deterministic attack pivot and hit socket.
- Chainsaw: procedural authored geometry with shared existing material roles.
  The moving chain is code-native so every tooth follows the guide path and
  can be tested without a runtime GLB animation mixer.
- Textures: existing `afterlife-cabinet-wood-v1.webp` when a browser texture
  loader is available; all other surface variation is shared PBR material
  roles and small authored trim geometry.
- Blender: not required for this pass; the deterministic code-native meshes
  meet the silhouette, pivot, and triangle budget without introducing an
  untracked binary asset.
```

Diagnostics at construction time: bat 28 meshes / 3,508 triangles; chainsaw
26 meshes / 2,292 triangles. The chainsaw uses two instanced meshes for its 22
teeth and 22 links, reducing the moving chain to two dynamic draw calls. Both
remain below the 12,000 triangle first-person target and protect animated
pivots and chain teeth from static batching.
