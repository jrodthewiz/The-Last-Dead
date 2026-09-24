# Dread refinement — implementation and verification

This pass replaces the most conspicuous toy-like blood and weapon shapes, gives the Ash Witness a complete five-action set, and revises the Catacombs dressing. [Open the visual comparison](index.html) for actual game captures, weapon cycles, and monster movement. Generated concepts and Blender review renders are labeled separately.

## Blood

One original 1024px RGBA atlas supplies irregular pools, directional splatter, dragged residue, and small drips. The lit material uses restrained specular response, darker coagulation, and increasing roughness as a mark ages. Small drops no longer expand into large identical pools. The old detached primitive limbs, eyes, and skull proxies are removed; the animated body and small grounded clots carry the aftermath.

The implementation retains bounded instancing: 128 residue instances, 32 short-lived splash instances, and 160 fine airborne drops. Drops expire at the floor. No light or material is allocated per stain. Actual hit, lethal hit, and settled-residue captures exercise real damage events; the separate seeded comparison isolates the material change.

## Weapons

All four weapons have new manufactured silhouettes, shared worn steel and wood finishes, and a visible mechanism tied to the real firing state. A restrained material-local fill keeps their surfaces readable in the lantern view without adding a light or draw call. The gameplay sockets and damage behavior remain compatible with the existing weapon system.

| Weapon | Mechanism | Existing trace field | Factory triangles |
| --- | --- | --- | ---: |
| Ossuary | Indexed cylinder and recoiling captive-bolt carriage | `jawTension` | 11,982 |
| Breach | Twin-barrel breech, extractor, and pressure valves | `pressurePulse` | 9,414 |
| Arc Lance | Open electrode frame and moving capacitor cage | `cagePulse` | 10,914 |
| Reliquary | Pressure chamber and opening aperture shutters | `ritualPulse` | 10,506 |

The trace field names are retained for compatibility; they do not describe the old geometry. The action test fires every weapon through `engine.shoot`, records a nonzero mechanism peak, and verifies its return to rest. These are code-built game models guided by a generated reference, not photorealistic reproductions of that reference.

## Decoration

The Catacombs entry's bare rib-tree is now a grounded mortuary console with chamfered drawer fronts, attached pulls, and a projecting middle tray. It uses 672 triangles per instance, replacing the original 1,712-triangle fixture, in the same single instanced draw. The tunnel uses beveled structural bands, and the entry's diagonal overhead conduit is removed.

Runtime raycasting identified a second skull source in the renderer's wall-relief kit, separate from the landmark and horror-detail factories. That source now builds recessed mortuary hatches with chamfered lips, pulls, and small label plates. The four existing instance pools are retained. The gallery includes close gameplay views as well as the original camera comparison. Routes, collision, and lighting are unchanged.

The final matched two-enemy Catacombs frame measures **242 calls, 248,172 GPU triangles, and 67 renderer textures**, versus **239 calls, 328,776 GPU triangles, and 76 textures** before this pass. That is three more calls, about 24.5% fewer rendered triangles, and nine fewer textures for this view. These are scene measurements, not a universal performance guarantee.

## Creature animation

The existing Meshy character and 24-joint rig were reused. Blender authored a contact/transfer shuffle, attack lunge, and hit recoil alongside idle and collapse. Runtime state fixes prevent a ready attack cooldown from incorrectly triggering the attack clip; short blends connect the actions. Gait playback follows movement speed. A restrained close-light response preserves more jacket detail under the lantern.

The packaged GLB contains five clips, 27,512 triangles, one 512px WebP, and one skin, at 2,440,044 bytes. It requires no runtime mesh decoder. The editable Blender file is preserved in `.art-source/afterlife-iteration/Ash_Witness_Dread_v02.blend`; runtime does not depend on that archive.

Meshy documents monster and zombie presets and FBX/GLB animation output. This pass uses custom Blender choreography on the existing rig. The contact sheets show animation frames for review; the game retains a lit 3D character. No skeleton-frame sprite-sheet export is documented in the API inspected. See the [official-source research and clip notes](meshy-animation-research.md).

## Verification

- Production build passed.
- Focused blood, weapon, VFX, enemy-state, map, prop, lighting, and visual-contract checks passed: 25 tests. The engine suite also passed: 20 tests.
- Packaged GLB validation and runtime animation checks passed.
- Production browser playtest passed all five dungeon floors and three campaign maps, with no browser, shader, or asset-loading errors. It exercised movement, all four weapons, pause/resume, audio, restart, and a 390 × 844 resize.
- Audio decoded all 105 bundled entries; each weapon's mechanism layer fired, voice count remained capped at four, pause suspended the context, and mute set gain to zero. This pass did not generate new audio.
- An isolated action run captured real hits and kills, four mechanism cycles, four gait phases, and attack windup/commit/recovery. It reported no browser or HTTP errors.

The final 180-frame production sample measured 16.7ms median and 16.8ms p95 (about 60 FPS). JavaScript heap used was 97MB after the multi-map run; this is not total application or GPU memory. This short sample does not establish long-session or low-end hardware performance.

Evidence: [production QA](qa-results.json), [action state traces](actions-qa.json), [matched scene diagnostics](capture-after.json), [independent review](reference-judge.md), and [asset provenance](coordination.md).

## Remaining visual limits

The weapons are deliberately stylized and still use compact procedural geometry. Ossuary and Reliquary have subtler dark-on-dark movement than Breach and Arc. The enemy attack remains somewhat arm-led, and gait has no inverse-kinematic foot locking. Blood contact at the wound is subtler than the settled residue. These limits are visible in the supplied captures rather than hidden by the concept images.
