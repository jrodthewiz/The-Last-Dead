# Afterlife iteration — implemented and measured

2026-09-23 · [Visual review](index.html) · [Full browser evidence](qa-results.json) · [Final placement/audio check](final-spotcheck.json) · [Independent judge](reference-judge.md)

This pass extends the playable game with a more ordinary, unsettling institutional environment, a new animated human enemy, distinct weapon mechanisms, and sparse positional sound. It uses original generated assets and existing game systems. The gallery labels generated references separately from actual game captures.

## What changed

- **Map composition across all eight courses:** Story floors gain a grounded divider and high lateral silhouette; campaign areas receive bounded route framing. A wheelchair and mourning cabinet give the rooms recognizable human scale. This is a visual composition pass: cells, collision topology, gates, spawns and exits retain their existing behavior. The wheelchair was moved clear of the first Catacombs arch pillar after screenshot review.
- **Two img2threejs loops:** Original ImageGen references became a 2,004-triangle wheelchair and a 352-triangle cabinet. The cabinet received a second pass for taller glass panels, vertical pulls, and wood casing. Both integrate before static batching, rather than retaining the isolated preview's component draw count.
- **Ash Witness enemy:** One Dogfight/Meshy generation and rig, then a new Blender file with idle, shuffle and collapse clips. The runtime helper shares mesh and texture data, clones owned instance materials, blends movement from actual displacement, preserves attack cues, and releases mixer resources. Melee enemies use the new model; the existing other enemy families remain available.
- **Four weapon identities:** Ossuary jaw/rib flex, Breach pressure valves, Arc Lance cage opening, and Reliquary claw/vent motion. Idle emission is quieter; firing drives short peaks. Only the Breach adds geometry: four small valve meshes. The mechanisms reuse current shot/time state, with no new dynamic lights or textures.
- **Generated materials:** Worn 1024px institutional floor albedo and 512px cabinet wood. Floor roughness now favors dry matte surfaces with sparse smoother patches. The texture loads before room clones are made and is protected from the older procedural texture override.
- **Audio:** Three compact derived onset/latch samples, a processed CC0 distant scream, existing room tones with three treatments, hidden positional cues, and brief music/ambience ducking. The Reliquary's rocket event now triggers its mechanism layer. New weapon mechanism voices are capped at four. No ElevenLabs call was made because its credential was unavailable; the new sound files are local derivatives of documented sources.
- **Runtime economy:** Practical-light selection is reranked at 5 Hz instead of every frame. Atmosphere stays at two draws, practical lights stay pooled at six, and the lantern keeps its single 512px shadow. No new fullscreen post-processing pass was added.

## Measured budget

Matched Catacombs view at 1536 × 864, desktop Chrome, with two naturally spawned enemies:

| Measure | Previous pass | This pass |
| --- | ---: | ---: |
| Draw calls | 232 | 239 (+3.0%) |
| Rendered GPU triangles | 396,252 | 328,776 (−17.0%) |
| Short sample median | 16.7 ms | 16.7 ms |
| Short sample p95 | 16.8 ms | 16.8 ms |

The eight-map sweep recorded 226–377 calls and 204,363–293,475 rendered triangles in its fixed ready-state views. The map layer itself costs 3–5 instanced draws and 36–600 triangles before props. The final browser reported 130 MiB used JavaScript heap after cycling through the maps. This is JavaScript heap, not total browser or GPU memory. The frame timing sample contains 180 frames and does not establish sustained or mobile performance.

| Added asset | Runtime budget |
| --- | ---: |
| Ash Witness GLB | 2,387,428 bytes; 27,512 triangles; 24 joints; three clips |
| Shared character image | 512px WebP, embedded in the GLB |
| Institutional floor | 271,080 bytes; 1024 × 1024 WebP |
| Cabinet wood | 40,548 bytes; 512 × 512 WebP |
| Three onset/mechanism samples | About 18 KiB compressed |
| Processed distant scream | 99,118 bytes, mono Ogg/Vorbis |

The GLB needs no Draco or Meshopt decoder. Original images, provider intermediates and the 41 MB Blender source are preserved under ignored `.art-source/afterlife-iteration/`, outside the build's runtime assets. Archiving the scream's source MP3 and intermediate WAV and shipping only Ogg saves 1,122,425 runtime bytes. The generated source prompts are recorded in [generated-assets.json](generated-assets.json) and [generated-wood.json](generated-wood.json); the model manifest records provider provenance and SHA256.

## Validation and actual revision loops

The integrated browser run passed movement, four real weapon shots, pause/resume, restart, all five Story floors and three campaign courses, varied canvas pixels, and a 390 × 844 responsive camera check. It loaded both procedural props, the generated floor and two naturally spawned Ash Witness instances with all three clips. All 105 audio manifest entries decoded; every weapon triggered its mechanism pool, the extra pool stayed at four voices, mute reached zero gain and pause suspended the audio context. There were no captured page, console or HTTP errors.

Focused Node checks passed for map topology/budgets, prop geometry and disposal, weapon motion and return to idle, atmosphere, surface and lighting behavior, and existing weapon contracts. The character intake validator passed its hash, byte/triangle limits, skin/joint structure, clip names/durations and decoder checks. Production build and `git diff --check` passed.

The independent visual judge and parent captures drove concrete corrections: remove the floating lintels, reduce broad floor gloss and idle weapon emission, correct cabinet proportions, face the new character toward its travel direction, remove duplicate arm curves that caused a shuffle T-pose, and clear the wheelchair from the pillar. The final focused browser pass passed with all 105 entries decoded after scream compression, no captured errors, and unchanged matched-view draw/triangle counts. It verified two ambience voices during a transition and one after 700 ms, with the outgoing source retired. The corrected in-game wheelchair capture shows both wheels and footplates clear of the pillar.

Work was split into bounded owners for maps, weapons, Meshy/Blender, props, audio and reference review. Browser QA ran in one process at a time, with headless Blender restricted to two threads and audio conversion to one FFmpeg thread. Heavy generation happened remotely. The user's existing game tab and server were retained.

## References, source and limits

[Sony's official film page](https://www.sonypictures.com/movies/insidiousoutofthefurther) and [official German stills](https://www.sonypictures.de/filme/insidious-out-of-the-further) informed small cold light pools, quick falloff, ordinary institutional objects and pale human figures. The judge inspected the corridor and stairwell stills; full-trailer viewing is not claimed. Movie imagery and audio are not runtime assets. Audio sources and processing are documented in [audio-sources.md](../audio-sources.md) and [afterlife-audio.md](../afterlife-audio.md).

The architecture still exposes broad combat lanes, and this pass does not add a dormant-enemy behavior system or rebuild the collision layout. Both witnesses remain visible in the matched view. The props prioritize silhouette and cost over close-up sculpt detail. Automated audio checks establish loading and controls, not how frightening the mix feels to a listener. Those are specific limits of the current iteration, rather than unverified completion claims.

Blender source: `C:/Users/wolfk/Desktop/thelastdead/.art-source/afterlife-iteration/Ash_Witness_Afterlife_v01.blend`.

Runtime character: `assets/models/afterlife-ash-witness.glb`, SHA256 `d445478c7fbebae0530a859197a1c6fedd49af08b012eb9c7470362bb2002540`.
