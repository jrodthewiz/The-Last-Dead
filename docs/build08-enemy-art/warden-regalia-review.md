# Warden authored regalia review

The Warden enemy keeps the imported Evil Warden animation and skeleton as its base, then adds a named procedural regalia layer under the animated pivot. The layer was built through the img2threejs intake and reconstruction workflow as an authored Three.js reconstruction: silhouette and material decisions are explicit in code, every attachment has a stable name, and the runtime contract is measured in the review harness.

## Readable silhouettes

- Kind 0, stalker: compact .94 regalia scale with chest signal, shoulder caps, torn mantle, harness, and chain pendants.
- Kind 1, caster: 1.03 regalia scale plus a violet halo and longer warning read.
- Kind 2, brute: 1.12 regalia scale plus a heavy back plate and larger signal.

All variants retain the skull, horns, hands, and animated locomotion from the authored GLB. The seven top-level regalia groups are chest-plate, shoulder-plates, collar, waist-harness, torn-mantle, ritual-chain, and back-spine.

## Materials and authored evidence

The regalia uses shared procedural 64x64 albedo, roughness, and bump DataTextures with separate material channels. The signal and trim use per-kind emissive accents: ember red for the stalker, spectral violet for the caster, and furnace orange for the brute. The shared maps are marked as shared assets so cloned Warden instances do not duplicate GPU textures.

Review captures:

- [warden-variants.png](../warden-variants.png) shows the three variant silhouettes side by side.
- [warden-regalia-front-v3.png](../warden-regalia-front-v3.png) shows the front rig read.
- [warden-regalia-side-v3.png](../warden-regalia-side-v3.png) shows mantle depth and back spine.

## Measurements

The standalone hardware review reports 38 draw calls and 33,722 triangles for one Warden instance. Three variants report 123 calls and 103,198 triangles before world rendering. The natural campaign visibility run reports 35 to 39 visible meshes per Warden, depending on kind. These figures are evidence for the current pass and should be rechecked if the imported GLB or world batching changes.

The visual pass is an authored procedural enhancement rather than a claim of final AAA asset quality. The current gate is readability, transform correctness, finite geometry, animation response, and bounded model cost.
