# Dread refinement — coordination and source record

The user rejected the earlier pass's primitive blood/decorations, uninteresting weapons and limited monster animation. This pass changes those surfaces materially. Work stays in The Last Dead; the original game/gallery tab and development server are preserved.

## Owners and budgets

| Owner | Scope | Constraint |
| --- | --- | --- |
| Parent | Blood surface/impact rendering, residue aging, renderer/build integration, ImageGen, final game QA | One browser at a time; one shared 1024px atlas; fewer impact instances |
| Weapon worker | Four weapon factories plus shared redesign helper | Replace old ornament; preserve sockets/fire contracts; no new lights |
| Decoration worker | world-horror, world-authored, world-setdressing | Replace conspicuous primitive props; preserve routes/collision; no added light |
| Animation worker | Ash Witness GLB, Blender v02, model runtime helper | Reuse 24-joint mesh; under3MB; one Blender process with two threads |
| Judge | Four visual acceptance gates and actual evidence review | Read-only; no browser/render process |

Other concurrent menu/UI edits are outside this pass and must not be reverted. Build integration preserves them.

## Skill and phase ledger

Director and skill router are loaded. The existing gameplay, graphics, UI, debug/profile, QA, image and 3D sourcing workflows from the previous pass remain applicable. Owners read the specialist references for their phase. Parent additionally loaded imagegen, procedural VFX, procedural materials, their system references, and the QA visual/playtest requirements. UI and audio design are outside this refinement's ownership.

External source decision: reuse the original Meshy Ash Witness mesh and rig, then author the new clips in Blender. Do not request another high-poly enemy. Weapons and repeated environment fixtures use compact authored code-native geometry and existing shared finishes. Blood gains an original ImageGen texture because shape/material repetition is the visible defect. No movie frames, creatures, or audio are copied.

## ImageGen asset

Tool: built-in ImageGen. Runtime: `assets/textures/blood-residue-atlas-v2.webp`, 1024×1024 RGBA, 258,854 bytes. Source: `.art-source/dread-refinement/blood-atlas-original.png`. Alpha was verified as `srgba`; conversion only resizes and compresses while preserving alpha. The four tiles provide pooled residue, directional splash, drag smear and small gravity drops. Runtime shading attenuates pale baked detail and supplies light response from the game.

Prompt:

> Use case: photorealistic-natural. Asset type: original horror videogame blood residue decal atlas, square 1024x1024 RGBA image with genuine transparent alpha background. Four separate top-down blood stain variants in a precise 2 by 2 grid, each centered inside its own equal quadrant with at least 48px completely transparent padding on every cell edge. Top left: asymmetrical shallow dark-red blood pool with torn capillary edge, subtle coagulated center and small trailing drops. Top right: directional thin splash with fine radial streaks and many tiny satellite droplets, mostly negative space. Bottom left: irregular shoe-drag blood smear, broken dry edges and streaked translucency. Bottom right: small scattered gravity-drip cluster with different droplet diameters, no circular central blob. This is liquid/residue only: no body parts, injury, person, anatomy, scene, floor or objects. Realistic deep oxblood and brown-maroon pigment variation, dried outer edges and subtly richer fresh center. Flat technical albedo, uniformly diffuse, no painted white highlights, no glow, no outlines, no cast shadows, no perspective, no vignette, no text, no gridlines. Avoid cartoon starbursts, repeated smooth circles and symmetrical flowers. Background must be truly transparent, not a visible checkerboard.

## Additional generated references

`weapon-design-reference.png` is an original ImageGen concept sheet, not a runtime screenshot. It guided the second weapon rebuild after the first rebuild failed visual review. Prompt:

> Use case: stylized-concept. Create a coherent 2x2 industrial horror videogame weapon design reference sheet, all four weapons shown from the PLAYER'S FIRST PERSON view over the rear receiver toward the muzzle, muzzle pointing toward upper left of its quadrant, the whole mechanical silhouette readable, no hands and no scene. Each isolated on neutral dark gray, neutral strong studio soft lighting, no text. High quality realistic detailed manufactured surfaces and simple plausible moving mechanics. Top left: compact heavy captive-bolt revolver, strongly visible offset five-chamber cylinder, long tapered octagonal barrel, scalloped sliding carriage, aged ivory side inset and worn walnut grip, steel ratchet claw; top right: broad twin-barrel break-action pressure shotgun, two dark circular bores, opened slanted breech surfaces, brass extractor, knurled valves and ribbed wood foregrip; bottom left: long narrow asymmetric electrical lance with forked forward electrodes, one off-axis porcelain insulator stack, exposed tightly wound copper coil in a sculpted open steel channel, small cyan charge chamber; bottom right: heavy squat relic launcher with a large octagonal chamber and recessed orange aperture visible through three mechanical shutter leaves, ribbed tapered pressure casing, chunky carry bail and red fabric safety tag. Muted oxidized steel, dirty brass, ivory ceramic, worn walnut and a very tiny warning signal. Realistic bevels catching light, panel seams and fasteners have purpose, broad contrasting material blocks and meaningful negative spaces. Ominous believable tools repurposed for a supernatural institution. No literal skulls, ribs, bones, alien flesh, neon strips, spikes, toy blocks, fantasy gemstones. The models should be feasible to reconstruct in 6000-12000 triangles each. One integrated square sheet with four clear distinct silhouettes, 1536px.

`assets/textures/dread-worn-steel-v1.webp` is the original ImageGen steel albedo, resized to 512×512 and compressed to 89,076 bytes. The original is preserved in `.art-source/dread-refinement/worn-steel-original.png`. Prompt:

> Use case: photorealistic-natural. Technical PBR albedo image for worn machined steel, square seamless texture, flat orthographic scan with neutral diffuse illumination. Mid-light desaturated gray gunmetal with fine lengthwise brushing, a few rubbed silver machining scratches, sparse dark oxide pitting and tiny brown corrosion freckles, barely visible residual industrial grease. Medium contrast grain, realistic tool finish, no large patches, no objects, no labels, no bolts or panel borders, no perspective, no vignette, no white specular reflection or baked shadow. Seamlessly tiling neutral material useful on both old horror-game weapons and abandoned institutional metal fixtures. 1024x1024 image, uniform material scale.

## Verification evidence

Matched before captures are saved as `*-before.png`, including seeded residue positions for a reproducible material comparison. Final acceptance requires both those matched views and live action evidence: real weapon shots, hit/death effects, gait/attack phases, no loader/shader errors, budget diagnostics, and the independent judge's review. Build and topology tests remain required. No long-session or low-end performance claim follows from a short frame sample.
