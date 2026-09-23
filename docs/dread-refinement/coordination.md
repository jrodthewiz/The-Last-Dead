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

## Verification

Matched before captures are saved as `*-before.png`, including seeded residue positions for a reproducible material comparison. Final acceptance requires both those matched views and live action evidence: real weapon shots, hit/death effects, gait/attack phases, no loader/shader errors, budget diagnostics, and the independent judge's review. Build and topology tests remain required. No long-session or low-end performance claim follows from a short frame sample.
