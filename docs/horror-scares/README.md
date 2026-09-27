# Horror encounters — playground and game integration

Open [the standalone playground](../../horror-scares-playground.html) from the repository server at `http://127.0.0.1:5200/horror-scares-playground.html`. It uses the existing Ash Witness GLB, bundled Three.js, and game textures. The approved beats are also integrated into the main game by `horror-scares-game.js`.

## Three beats

| Beat | What the trigger tests | Current visual result |
| --- | --- | --- |
| Ceiling drop | Door-open and level-advance cues, a 0.72 s fall into a neck rope, damped swing, limb/head struggle, spatial scream | Readable player-scale drop. The noose, shadow, and panic motion are still blockout quality. |
| Piano vigil | A small chapel room with organ pipes, candles, side altars, benches, a console piano, and a suspended Ash Witness | The landmark is distinct from the corridor kit, but the piano case and body hoist need a sculpt and contact pass. |
| Window screamer | Hidden figure rises behind a barred opening, reaches both hands toward the bars, and yells at player distance | The reach and reveal read. A tapered mouth cavity and separate lower jaw now open with the recorded voice. |

Controls: select a beat, trigger, adjust player distance, reset, or mute. Keys `1`–`3`, `Space`, and `R` are shortcuts. The ceiling-drop cue selector checks the two requested trigger origins independently.

## Audio provenance

The active game and playground screams derive from [Female Scream 1](https://opengameart.org/content/female-scream-1), a CC0 voice actor recording by Nocturnal_Vanguard/AuraVoice. The untouched source is preserved in ignored `.art-source/audio-incoming/screamer-retune/`. The source has 0.44 s of leading silence and 0.44 s of trailing silence; the active edits trim both so the voice starts with the pop-out. Both deliveries are mono 32 kHz Vorbis with a gentle bandpass and fades. The window scream is slowed to 82% tempo without lowering its pitch and raised about 4 dB; the ceiling version is lowered 10% in pitch and speed. The prior bit-crushed Vinrax edits are retired from the active event map and remain in `assets/audio/playground/` for comparison.

| File | Length | Measured mean / peak |
| --- | ---: | ---: |
| `assets/audio/sourced/horror/ceiling-screamer-human.ogg` | 1.20 s | −17.7 / −7.6 dB |
| `assets/audio/sourced/horror/window-screamer-human.ogg` | 1.30 s | −12.9 / −2.9 dB |

The playground unlocks Web Audio on a click, decodes each clip once, applies a positional panner with distance rolloff, and stops the active source on reset or scene change. Its analyser drives the window mouth aperture from the actual clip energy. The Sound enabled switch controls a master gain. The audio context suspends when the tab is hidden.

## Game integration

**Status: integrated after user approval.** The live browser review confirmed the drop, piano, and scream views and tested both ceiling-drop cue options. The window mouth reached full aperture while its sound played. Active playground render snapshots were 35 calls / 28,224 triangles for the drop, 99 / 29,348 for the piano, and 29 / 28,512 for the window. These are isolated scene figures, not in-game performance claims.

The live game uses `dungeon-doors-open`, `room-transition`, and `sector-transition` to queue bounded ceiling drops. The first entry room of each Story floor gets a barred window screamer, triggered by player proximity after audio is ready. Floor 2's intake room gets the piano vigil and side altars. Both processed CC0 human screams use the game's positional voice bus. The window mouth samples RMS levels from the decoded scream to move a tapered cavity and lower jaw every frame. The effects use the existing Ash Witness model and do not change collision or enemy combat rules. Door-driven world rebuilds preserve active scare state.

Further art polish can use these player-camera checks:

1. The hanging figure’s neck connection stays clear through the entire fall and its struggle reads as distress rather than ordinary idle motion.
2. The piano body is visibly supported by its hoist and belongs to the piano room at near and far distances. The console needs an authored silhouette and material pass; use an image-to-Three.js sculpt workflow once a reference image is chosen.
3. The screamer’s mouth stays within the actual face across head motion. Its hands meet the bars without clipping into the player lane. A future facial morph or skinned jaw would improve the close-up anatomy further.
4. The three beats remain readable with the real game camera, lantern, weapon, HUD, audio mix, and enemy count, with a bounded event frequency so repeated doors do not spam a scream.

The original playground remains available for further art direction without changing the main game.

External asset credential check on this Windows host: `TRIPO_API_KEY=MISSING`, `GEMINI_API_KEY=MISSING`, `ELEVENLABS_API_KEY=MISSING` in the available PowerShell environment. The director’s Bash probe could not start because the Windows Bash service returned access denied. No provider call was made; the model and audio source were already present locally.
