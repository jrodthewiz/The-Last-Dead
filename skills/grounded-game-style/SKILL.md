---
name: grounded-game-style
description: Study visual references and apply their art direction to an existing playable 3D game while preserving its layout, camera, traversal and established identity. Use for reference-led world or presentation passes, including Blackwater's N64 horror style.
---

# Grounded game style

Turn a reference into decisions that survive actual play. The useful sequence is
layout → matching views → a consistent style → implementation in the live world.
Read [the reference study](references/xikhar-study.md) when using the original
Shikhar clip or adapting these principles to The Last Dead.

## Study what is visible

Inspect the reference itself before describing its style. For motion, sample
distinct stages and record their times. Separate observations from interpretation.
If access fails, say what is missing; thumbnails and captions do not establish
animation, material response or runtime geometry.

Extract the relationships that matter: settlement hierarchy, terrain and street
connections, foreground/midground/background, silhouette families, material
regions, lighting, vegetation distribution, typography and motion emphasis.
Prefer a small set of coherent decisions over a catalog of decorative details.

Distinguish the reference's presentation graphics from the depicted world. Its
editorial slide design is not automatically an appropriate game HUD. Preserve
the user's genre and chosen visual identity unless they request a change.

## Ground the change in the game

Choose a representative playable place and record its camera, field of view,
world seed, time, render settings and gameplay state. Use an ordinary eye-level
view, an oblique spatial view and a close construction view where relevant.
Keep traversable widths, entrances, stairs, sightlines and landmark placement
fixed while comparing art direction. Change layout only for an identified
gameplay or spatial problem.

Write a compact visual contract before broad implementation: a palette by
material role, silhouette hierarchy, texture scale, lighting relationships and
which surfaces or interactions must remain readable. Tie clutter to use: paths
remain walkable, furniture serves a room, vegetation follows exposure and
maintenance, and loot sits where its owner could have left it.

Generated paintovers can help explore that contract. When image generation is
actually useful, supply the same scene view as the geometry reference and a
separate style reference; ask to preserve perspective, massing, terrain, openings
and object placement. Treat invented windows, doors, rooms or lighting in the
result as proposals requiring implementation. A generated image is never proof
that the game contains the depicted detail or that its collisions work.

Implement the chosen relationships in the existing geometry, materials,
lighting, animation and interface. Use shared material roles and deterministic
variants so added richness stays coherent and bounded. Do one representative
area or item well before propagating the pattern.

## Accept using the running game

Compare the same views after implementation. Inspect ordinary gameplay and a
neutral or reduced-effects view when lighting might hide construction defects.
For animations, include windup, contact, follow-through and return; identify
sampled frames separately from native continuous playback.

Walk the route, enter the room, acquire and use its item, and check input and
recovery states appropriate to the change. Follow the project's existing QA
authorization and test-file rules. Record concrete defects, artistic risks and
unverified claims separately. Revisit only the weakest demonstrated issue;
another layer of noise, fog, clutter or post-processing is not a substitute.

Keep local, built-preview and deployed evidence distinct. Confirm that the
published modules/assets match the source used for the build before claiming
production parity. A screenshot or a successful deployment alone does not
establish playable input, scavenging, combat, saving or multiplayer.
