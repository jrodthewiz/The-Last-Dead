# Horror encounters — playground and game integration

Open [the standalone playground](../../horror-scares-playground.html) from the repository server at `http://127.0.0.1:5200/horror-scares-playground.html`. It uses the existing Ash Witness GLB, bundled Three.js, and game textures. The approved beats are also integrated into the main game by `horror-scares-game.js`.

## Three beats

| Beat | What the trigger tests | Current visual result |
| --- | --- | --- |
| Ceiling drop | Door-open and level-advance cues, a 0.72 s fall into a neck rope, damped swing, limb/head struggle, spatial scream | Readable player-scale drop. The noose, shadow, and panic motion are still blockout quality. |
| Piano vigil | A small chapel room with organ pipes, candles, side altars, benches, a console piano, and a suspended Ash Witness | The landmark is distinct from the corridor kit, but the piano case and body hoist need a sculpt and contact pass. |
| Window screamer | Hidden figure rises behind a barred opening, reaches both hands toward the bars, and yells at player distance | The reach and reveal read. The mouth is a sound-driven insert on the current fixed face; its alignment and anatomy need an authored jaw or facial morph. |

Controls: select a beat, trigger, adjust player distance, reset, or mute. Keys `1`–`3`, `Space`, and `R` are shortcuts. The ceiling-drop cue selector checks the two requested trigger origins independently.

## Audio provenance

Both playground Ogg files derive from Vinrax’s [Horror scream1](https://opengameart.org/content/horror-scream1), released under CC0. The original `scream_horror1.mp3` is already preserved in the ignored `.art-source/afterlife-iteration/audio/` archive. Each delivery is mono 24 kHz Vorbis with a bandpass, a low-mix bit crusher, restrained echo, and a fade:

| File | Length | Measured mean / peak |
| --- | ---: | ---: |
| `assets/audio/playground/ceiling-human-scream.ogg` | 3.60 s | −24.2 / −9.4 dB |
| `assets/audio/playground/window-human-scream.ogg` | 5.90 s | −24.5 / −10.4 dB |

The playground unlocks Web Audio on a click, decodes each clip once, applies a positional panner with distance rolloff, and stops the active source on reset or scene change. Its analyser drives the window mouth aperture from the actual clip energy. The Sound enabled switch controls a master gain. The audio context suspends when the tab is hidden.

## Game integration

**Status: integrated after user approval.** The live browser review confirmed the drop, piano, and scream views and tested both ceiling-drop cue options. The window mouth reached full aperture while its sound played. Active playground render snapshots were 35 calls / 28,224 triangles for the drop, 99 / 29,348 for the piano, and 29 / 28,512 for the window. These are isolated scene figures, not in-game performance claims.

The live game uses `dungeon-doors-open`, `room-transition`, and `sector-transition` to queue bounded ceiling drops. The first entry room of each Story floor gets a barred window screamer, triggered by player proximity. Floor 2's intake room gets the piano vigil and side altars. Both processed CC0 human screams use the game's positional voice bus. The window mouth samples RMS levels from the decoded scream and interpolates the aperture every frame. The effects use the existing Ash Witness model and do not change collision or enemy combat rules. Door-driven world rebuilds preserve active scare state.

Further art polish can use these player-camera checks:

1. The hanging figure’s neck connection stays clear through the entire fall and its struggle reads as distress rather than ordinary idle motion.
2. The piano body is visibly supported by its hoist and belongs to the piano room at near and far distances. The console needs an authored silhouette and material pass; use an image-to-Three.js sculpt workflow once a reference image is chosen.
3. The screamer’s mouth stays within the actual face across head motion. Its hands meet the bars without clipping into the player lane. An authored facial morph or skinned jaw should replace the insert for game use.
4. The three beats remain readable with the real game camera, lantern, weapon, HUD, audio mix, and enemy count, with a bounded event frequency so repeated doors do not spam a scream.

The original playground remains available for further art direction without changing the main game.

External asset credential check on this Windows host: `TRIPO_API_KEY=MISSING`, `GEMINI_API_KEY=MISSING`, `ELEVENLABS_API_KEY=MISSING` in the available PowerShell environment. The director’s Bash probe could not start because the Windows Bash service returned access denied. No provider call was made; the model and audio source were already present locally.
