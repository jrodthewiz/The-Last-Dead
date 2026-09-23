# Afterlife iteration reference judge

Date: 2026-09-23

This is a bounded visual and design review for the next lightweight iteration of The Last Dead. It is a review of evidence and a set of acceptance tests, not a claim that every recommendation has already been implemented.

## Evidence reviewed

The current runtime evidence is in [the afterlife upgrade report](../afterlife-upgrade/implementation-report.md). I inspected the live capture at [catacombs-afterlife.png](../afterlife-upgrade/catacombs-afterlife.png), the active-loop capture at [active-play.png](../afterlife-upgrade/active-play.png), the other floor captures, and the original [Forsaken Afterlife concept](../artstyle-experiments-2026-09-23/07-forsaken-afterlife.png).

The current pass has a real visual direction: local cold light, dark neutral walls, damp floor response, low mist, pale human enemies, and a retained readable HUD. It also has useful performance evidence: the report records two atmospheric draws, 21 mist wisps, roughly 396k rendered triangles in the Catacombs capture, and a 16.7 ms median / 16.8 ms p95 180-frame sample. The sustained harness was lower and variable, so this should be treated as a budget to protect rather than a locked 60 FPS claim.

The visible gap is clear in the same captures. The architecture is still broad repeated boxes and freestanding arches. The wet floor is almost uniformly reflective, the red seams and red gun accents still compete with the cold pool, and the arch light reads as a repeated fixture instead of a threatening source. The two human enemies are recognizable but mostly read as black combat silhouettes with small lit faces; their pose and stillness do not yet carry the ordinary-human unease of the concept. The atmosphere is present, though subtle enough that several frames still read as a dark arena rather than a place where something is waiting.

## Primary reference evidence

[Sony's official film page](https://www.sonypictures.com/movies/insidiousoutofthefurther) describes The Further as a purgatorial realm of lost souls and says that what lives there can be brought back into the real world. [Sony Pictures Germany's official page](https://www.sonypictures.de/filme/insidious-out-of-the-further) exposes the official trailer links and a scene-image section.

I visually inspected the two official still URLs already recorded in [afterlife-references.md](../artstyle-experiments-2026-09-23/afterlife-references.md): the [corridor still](https://www.sonypictures.de/sites/germany/files/2026-07/DF-06647_r_xlarge_thumbnail.jpg) and the [stairwell still](https://www.sonypictures.de/sites/germany/files/2026-06/DF-02070_r.jpg). They show ordinary, constrained domestic or institutional space, a small cold portable light, quick falloff into black, and a distant warm/red contamination. The visual lesson is the relationship between a normal place and a very small revealed area, rather than a specific monster design. The official page and trailer metadata were verified; I did not watch the full trailer, so no frame-level claim below relies on trailer playback.

## Five changes with the best return per CPU and memory

### 1. Make the map reveal space in layers

The current camera sees the full arch lane and both enemies at once. Keep the existing cells and collision, but add one sightline break every few rooms: a staggered wall slab, a hanging cloth plane, a low rib divider, or a short offset passage. Use the existing room kit and pooled instances instead of a new architectural set. The player should see a cold pool of floor, one partial arch, and a possible figure at the edge of the next darkness. Only one deeper red source should mark the destination. A good test frame has an understandable path and one unanswered dark gap; it should not look like a centered firing gallery.

### 2. Make wetness selective and let the light do the work

The current floor treatment is attractive but too consistently glossy. Use the generated plaster texture and existing material channels to make wetness a few connected islands: dry matte edges, dirty satin traffic lanes, and two or three reflective puddle shapes under light sources. Reduce the red floor-seam emission to a structural cue, and keep red mostly at the far objective or an attack telegraph. The cold portable source should be the brightest environmental signal. This can stay lightweight with shared textures, per-room material parameters, and pooled point or spot lights; do not add a fullscreen fog pass or a second dynamic shadow map.

### 3. Give the dead figures an ordinary human read before they move

The existing survivor rig is the right base for this pass. Use a small number of authored T-pose-derived clips or Blender pose variants: an upright figure with a slight head tilt, a wall lean whose shoulders do not quite match the hips, and a figure whose lower body disappears behind mist or a divider. Keep clothing dark and faces pale but subdued. The silhouette must remain visible enough for hit and attack telegraphs. A dormant figure should hold its pose for a few seconds, then respond to line of sight or distance; once it attacks, retain the current readable warning and death behavior. New high-poly characters are lower priority than two convincing silhouettes built from the existing rig.

### 4. Add stillness before encounter motion

Current captures communicate wave state immediately, which is good for play, but every visible enemy looks ready to fight. Add a short observation beat in selected rooms: a distant figure remains inert, a cloth or hanging cable moves once, and the room gives the player time to decide whether to approach. Spawn or wake the combat actor only after a cheap trigger such as distance, line of sight, or the next cell crossing. Keep this bounded to one or two dormant actors and never hide an attack telegraph. The tension should come from the player noticing a person who has not noticed them.

### 5. Use sparse sound to imply more space than the map contains

The current report correctly says audio was retained; no audio upgrade should be claimed yet. A high-value next pass is three or four short generated or recorded assets: a low room tone with a distant pressure change, a cloth or shoe drag that appears behind the player, a very quiet breath near a dormant figure, and a metallic electrical tick near the red destination. Schedule them through the existing audio system with long randomized gaps, directional panning, and room-aware attenuation. Weapon feedback should stay distinct and brief: slot 1 gets a narrow cold muzzle flicker, slot 2 a dry impact and floor dust, slot 3 a short tether-like pull/reveal, and slot 4 a low heavy pulse with a small local light response. Avoid a constant horror drone, wide bloom, or screen-wide red flash.

## Lightweight iteration contract

Run the work as short passes with one owner per surface: map composition, human pose/entity variants, weapon feedback, texture/material variation, and audio. Each pass should produce one before/after screenshot from the same Catacombs camera and one live-combat screenshot. Generated assets need a prompt or source entry, a runtime path, and a size note. Meshy or Blender outputs should be kept to a few low-detail silhouettes and reused across variants; a new model is not justified when an existing rig and a changed pose answers the visual question.

The judge gate for each pass is:

- The screenshot reads as the same playable map while showing a new spatial or material decision.
- The player can still identify footing, enemies, objective direction, and the current weapon within one second.
- The four weapon slots remain visually distinct without turning the environment into a neon arena.
- Atmosphere stays pooled and sparse: no fullscreen veil, no per-frame world traversal, no extra shadow cascade, and no unbounded particle count.
- The pass does not increase the current scene budget by more than roughly 10% in triangles or draw calls without a measured reason. Re-run the existing browser capture and report median/p95 frame time after each integrated batch.
- No movie character, frame, creature, or audio is copied into the game. The film evidence is used for lighting, spatial restraint, and the contrast between ordinary space and impossible presence.

## Judge verdict

The implemented direction is a meaningful first translation of the reference, and the current performance evidence is good enough to continue iterating. The next highest-return work is a single map sightline pass plus selective wetness and two or three dormant human poses. New detailed models, full Blender animation sets, and a large audio layer should wait until those changes make a matched screenshot feel closer to the concept. The acceptance bar is a frightening composition that remains legible in combat, with evidence for both visual improvement and bounded runtime cost.
