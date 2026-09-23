# Lightweight afterlife iteration

Started 2026-09-23. The user requested coordinated parallel agents for map composition, weapons, Meshy/Blender, audio, generated textures, two img2threejs loops, and an independent judge.

## Ownership and limits

| Owner | Files / work | Budget |
| --- | --- | --- |
| Parent | renderer integration, room-materials, lighting, build, generated references and floor texture, browser QA | One Chrome QA process; no new post-processing passes |
| map_iteration | world-afterlife-design.js, map composition evidence | Up to 15 added draws and 25k triangles/course; preserve traversability |
| weapon_iteration | Four weapon modules, optional shared mechanism helper | Up to 6 draws and 5k triangles/weapon; no new lights or frame allocations |
| meshy_blender | New afterlife GLB, source Blender file, character scripts | One remote generation; one headless Blender process with two threads; target <=5 MB runtime |
| audio_iteration | audio.js, asset audio registries, assets/audio/afterlife | <=2 MB compressed; <=4 extra voices; one FFmpeg process/thread |
| model_loops | afterlife-props.js and two img2threejs evidence loops | <=3k triangles and 5 material batches per object; parent renders previews |
| reference_judge | reference-judge.md, independent final evidence review | Read-only code review, official movie sources, actual screenshots |

The parent alone runs browser validation. The Blender owner announces its processing window so the browser can wait. Source images and .blend files stay outside runtime asset directories. All generation is original; film imagery informs composition and lighting rather than becoming a game asset.

## Skill routing

The existing game director workflow and its gameplay, graphics, UI, profiling, QA and generator guidance remain active. This pass adds the img2threejs object workflow and audio-generation workflow. Specialized agents read their owned workflow instructions. The parent uses the built-in ImageGen tool for raster references and textures.

## Reference and sourcing decisions

- The official Insidious stills and synopsis were rechecked by the reference judge. Findings and links are in reference-judge.md.
- Wheelchair and mourning cabinet references are original ImageGen outputs in references/. These feed small procedural models rather than adding heavyweight mesh assets.
- A generated institutional floor tile replaces the broad repetitive metal-deck texture. Shared roughness maps leave most floor pixels dry and reserve smoother response for three sparse patches.
- The new character uses the user's requested Dogfight/Meshy workflow and a new local Blender source file; the character owner records actual availability and provenance.
- New audio is generated or derived from authorized local material, never from a movie soundtrack.

## Verification plan

Review original generated reference images; inspect both procedural objects in a shared preview; integrate bounded map props and weapon motion; then test all five story maps and three campaign maps in one browser. Record draw calls, triangles, median/p95 frame timing, memory diagnostics, asset bytes, gameplay controls and console/network errors. Give the independent judge matched actual screenshots and measured results for a bounded revision.

Current baseline: the previous Catacombs capture reported 232 calls, 396,252 rendered triangles, and 16.7 ms median / 16.8 ms p95 for a short 180-frame sample. Its longer run was variable, so this is not a guaranteed 60 FPS claim.

## Completed integrated pass

The bounded owners completed their changes and stopped generation after the judge's revisions. The full eight-map browser run passed, with a matched comparison of 239 calls and 328,776 GPU triangles, 16.7 ms median / 16.8 ms p95 over 180 frames, and 130 MiB used JavaScript heap. The final placement/audio check follows the full sweep without repeating every unaffected test. Final scope, assets, review corrections and limitations are recorded in [implementation-report.md](implementation-report.md).
