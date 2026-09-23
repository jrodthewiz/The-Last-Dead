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

## Prop preview review

The first prop preview was checked against the supplied [wheelchair reference](references/wheelchair.png) and [mourning cabinet reference](references/mourning-cabinet.png), rather than judged from the reference descriptions. The wheelchair silhouette is clear from the front and side, and its 2,004 triangles / five materials are appropriate for a static prop. The reference's rusted tubular metal, maroon seat and back, spoke contrast, and footrests collapse almost entirely into black in the runtime-like preview. Preserve the dark palette but lift only edge and material separation on the metal and fabric so the object remains readable in a cold pool of light.

The wheelchair preview reports 42 meshes and 67 total preview calls for the prop scene. Since these objects are static, group or batch by material before world integration; the triangle budget is healthy, while raw component count is the lightweight risk. A target of roughly five calls for the wheelchair and four for the cabinet after static batching is reasonable.

The cabinet reference has upper glazed door panels close to half the door height, lower wood panels, recessed frames, a heavy cap/plaque/base, and short vertical brass pulls. In the closest current render, the upper panels remain too short, the lower panels are oversized, the pulls read horizontal, and the front/back angles can collapse into an empty black slab. Add those high-value front-facing cues within the existing low triangle budget. A neutral preview light should be used to judge geometry; the final asset should then be checked again under the afterlife light without globally brightening it.

## Judge verdict

The implemented direction is a meaningful first translation of the reference, and the current performance evidence is good enough to continue iterating. The next highest-return work is a single map sightline pass plus selective wetness and two or three dormant human poses. New detailed models, full Blender animation sets, and a large audio layer should wait until those changes make a matched screenshot feel closer to the concept. The acceptance bar is a frightening composition that remains legible in combat, with evidence for both visual improvement and bounded runtime cost.

## First integrated map and floor capture

The [first integrated scene capture](scene-first-pass.png) is a real spatial/material improvement over the earlier afterlife frame. The floor now reads as worn institutional tile instead of a mirror-like arena, the red reflections are less dominant, and the three sightline-break / upper-silhouette diagnostics are active. The measured change is bounded: 245 calls and 396,892 rendered triangles versus 232 calls and 396,252 in the comparison capture, while the map design reports five draws and 288 triangles. This is within the lightweight gate.

The spatial gain is currently modest in the actual camera. The three breaks mostly read as one long, floating overhead bar cutting across the main arch; both enemies and the full central lane remain visible, so the frame still behaves like an open firing gallery. The attached cabinet and wheelchair are present in diagnostics but disappear into the dark composition and do not yet provide a readable ordinary-place anchor.

The next bounded map fix should reuse the existing three break slots: move one piece to an offset eye-height divider roughly one short room ahead so it hides one enemy or part of the next arch, and keep the other upper piece high and lateral as a ceiling silhouette. Do not add more geometry or lights; add only enough cold edge response for the divider to read. After AshWitness is integrated, judge the second fix from the same camera: place one corrected prop inside the first cold pool and ensure its silhouette/material separation survives without raising global exposure. Both changes can keep the reported five map draws and existing atmosphere budget.

## Isolated prop and Ash Witness acceptance

The corrected [prop preview](props-front.png) now matches the supplied cabinet reference at the important silhouette level: the glazed upper panels are close to half the door height, the lower wood panels and casing read, the pulls are short and vertical, and the small generated wood texture adds restrained grain. The plaque and recessed trim are simplified, which is acceptable for this low-poly static pass. The wheelchair remains a lower-contrast read under the dark preview light; verify one instance in the first cold pool before duplicating it through the map.

The [Ash Witness idle](ash-witness-idle.png) reads as an almost-human pale adult in worn dark clothing with a useful head tilt. The [collapse pose](ash-witness-collapse.png) communicates a clear death/fall cue. The supplied [shuffle preview](ash-witness-shuffle.png) still shows an arms-out, T-pose-like frame, so it is not evidence of a convincing shuffle by itself. Sample the clip across time; if the arms remain extended, revise them toward a relaxed near-body swing before calling the locomotion pass complete.

The asset budget is 2.39 MB, 27,512 triangles, one shared 512 map, and three clips. That is a reasonable bounded enemy family for one or two visible instances. It should not be multiplied across every wave without checking the actual in-level GPU triangle and draw-call totals; the isolated preview does not prove the runtime budget.

## Final integrated acceptance gate

The later evidence supersedes two earlier findings. The map is now `afterlife-map-design-v2` with a grounded divider and no floating-lintel artifact, and the fresh [Ash Witness shuffle preview](ash-witness-shuffle.png) has relaxed arms after the duplicate upper-arm curves were removed. The isolated locomotion concern is cleared. The [final Catacombs capture](catacombs-afterlife.png) shows two readable pale human figures, the corrected cabinet as a visible environmental anchor, the matte worn floor, and the cold local lighting. The four [weapon captures](weapon-1.png), [weapon-2.png](weapon-2.png), [weapon-3.png](weapon-3.png), and [weapon-4.png](weapon-4.png) remain visibly distinct in model, hand pose, slot label, and feedback treatment.

The exact final combat comparison in `qa-results.json` is 239 render calls, 328,776 GPU triangles, and 676,908 reported scene triangles, with three map-design draws and 36 map triangles, two Ash Witness instances, six practical lights, two atmosphere draws, and a 512px lantern shadow. The eight-map sweep ranges from 226–377 calls and 204,363–293,475 GPU triangles. The 180-frame sample is 16.7 ms median / 16.8 ms p95; heap usage is 130 MB, all 105 declared audio files decode, all four weapon mechanisms fired, and the run reports zero errors. This passes the lightweight performance and integration gate for the current scope.

The earlier visual hold was [wheelchair-in-game.png](wheelchair-in-game.png) being overlapped by a white pillar. That finding is superseded by the corrected capture below. The final Catacombs framing also keeps both witnesses fully exposed, so the afterlife stillness is strongest in the character silhouette and lighting rather than partial concealment. That is a future polish opportunity, not a reason to expand this pass while QA is clean.

The wheelchair hold is now resolved in the refreshed [in-game capture](wheelchair-in-game.png). Its moved position clears the bone-gate pillar, and the chair, wheels, seat, and footrests remain readable inside the cold pool without changing the final 239-call / 328,776-GPU-triangle comparison. The final Catacombs frame also confirms both Ash Witness instances, the grounded map-v2 composition, and the corrected environmental prop placement. The final spot check reports 105/105 compressed assets decoded, zero errors, and a two-voice ambience crossfade that retires the old source after the overlap. The current afterlife pass therefore passes the visual, integration, audio-lifecycle, and lightweight-budget gates; future work can target more partial concealment and encounter staging without reopening this pass.
