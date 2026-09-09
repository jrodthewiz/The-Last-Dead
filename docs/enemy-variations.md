# Enemy variation pass

The imported Warden GLB remains the shared character surface for the three
humanoid families. `enemy-variation.js` resolves the campaign identity to one
of eight fixed material profiles:

| Kind | Campaign identities | Visual treatment |
| --- | --- | --- |
| rush | `stalker`, `skitter`, `bloodhound` | ash, violet-brown, and sanguine surface tints with progressively lower roughness and warmer signal colors |
| ranged | `caster`, `hexer`, `mireSinger` | pallid, violet-sealed, and mire-oxide surface responses with cool/warm emissive signals |
| anchor | `brute`, `warden` | iron-hide and marrow-brass metal/roughness responses with amber threat signals |

Bellwraith has four bounded surface families: `bellwraith`,
`bellwraithEcho`, `rustBell`, and `ivoryBell`. Each uses a shared 64px surface
map generated once per profile seed, then reuses that map for the bell, bone,
membrane, and chain materials. The material palette separates the silhouettes
and gameplay identities while retaining the authored model details.

`npc-bellwraith.js` keeps one immutable Object3D template per family. Its
merged BufferGeometries are marked as shared assets, so every live actor made
from the same family reuses the prewarmed GPU buffers. Instance transforms and
materials are still separate, which keeps hit flashes, attack rings, and death
poses independent. `warmBellwraithVariants()` builds all four templates up
front and `getBellwraithCacheStats()` reports the bounded cache.

Warden profile changes reuse the GLB geometry and its embedded realistic map.
The existing per-instance material clone is retained for hit flash isolation;
the variation profile only sets uniforms once at spawn or when a networked
identity changes. Bellwraith maps are cached in a four-entry map cache. No
variant creates resources inside the animation loop, and no new shader feature
is introduced, keeping the pass within the 144 FPS render budget.

`createWarden(template, clips, kind, variant, seed)` accepts the identity
directly. The current renderer remains backward compatible because
`animateWarden` also resolves `enemy.variant` the first time a live network
snapshot reaches the instance. Passing `enemy.variant` to the factory is
recommended when the renderer creates an enemy so the first visible frame is
already in its authored palette.

Both factories expose reset helpers for actor pooling. `resetWarden` clears
the pivot, bone pose, mixer time, death timer, motion, and ring state;
`resetBellwraith` clears the root and part transforms, float phase, death
timer, attack ring, hover rotation, and emissive pulse. Geometry and surface
maps stay alive in their caches for the next spawn.

Evidence:

- [enemy-variations.png](./enemy-variations.png) shows three imported Warden
  variants under the review lighting.
- [enemy-variations.json](./enemy-variations.json) records the eight Warden
  keys, four Bellwraith keys, distinct palette values, four surface seeds, and
  the shared Warden geometry assertion.
- `tests/enemy-variations.test.mjs` is the repeatable browser smoke check.
