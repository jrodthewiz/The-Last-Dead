# Audio sources and runtime matrix

The Last Dead ships a compact sample-backed audio layer in assets/audio.js. The source recordings below are imported from OpenGameArt pages that identify the files as CC0 (Creative Commons Zero / public domain dedication). The URLs are retained for provenance and license review.

## Sources

| Source page | Imported files | License / credit |
| --- | --- | --- |
| https://opengameart.org/content/basic-sound-effects | gunshot_0.mp3, explosion_0.mp3, explosion_distant_0.mp3, button_0.mp3, coin1_0.mp3, coin2_0.mp3 | CC0, author n4; no attribution required |
| https://opengameart.org/content/loopable-dungeon-ambience | dungeon_ambient_1_0.ogg | CC0, author JaggedStone; no attribution required |
| https://opengameart.org/content/footsteps-0 | 01-footstep_0.ogg and 02-footstep.ogg through 06-footstep.ogg | CC0, author GboxMikeFozzy; no attribution required |
| https://opengameart.org/content/jump-landing-sound | jumpland44100.mp3 | CC0, author MentalSanityOff / qubodup submission; no attribution required |
| https://opengameart.org/content/various-sound-effects-0 | snd_gunshot1.wav, snd_bulletcrackle.wav, snd_bullethit.wav, snd_splathit.wav, dull_explosion.wav, snd_enemyjump.wav, snd_enemyland.wav, snd_enemyscream.wav, snd_death1.wav, snd_death2.wav, moan.wav | CC0, author Spring Spring / Julie Damsgaard; page requests optional credit but does not require it |

The project keeps renamed copies so gameplay code does not depend on upstream filenames. Source pages were checked on 2026-09-08. We do not ship any API keys or provider credentials.

## Runtime matrix

| Event | Runtime key | Sample variants | Group | Fallback |
| --- | --- | --- | --- | --- |
| Revolver / weapon 0 fire | shot, weapon 0 | CC0 gunshot + heavy shot | sfx | layered transient/noise |
| Shotgun / weapon 1 fire | shot, weapon 1 | heavy shot + CC0 explosion | sfx | low boom + report |
| Arc lance / weapon 2 fire | shot, weapon 2 | bullet crackle + gunshot | sfx | rising saw/noise |
| Rocket / blast | rocket or explosion | distant explosion + dull explosion | sfx | sub boom + lowpass noise |
| Bullet / flesh impact | hit, blood | bullet hit + splat | sfx | square transient/noise |
| Movement | footstep | six footstep variants | sfx | low thump/noise |
| Jump / landing | jump, land | jump-land + enemy land | sfx | rising tone / low impact |
| Dash / slide | dash | procedural | sfx | filtered burst |
| Enemy attack / movement | enemyattack, enemyjump, enemyland, moan | scream, moan, jump, land samples | sfx | distorted tonal growl |
| Enemy death | enemydeath (aliases kill, dead) | two death variants | sfx | descending growl/noise |
| Coin / UI | coin, ui, confirm, cancel, fail | CC0 UI / coin samples | ui | short synthesized signal |
| Arena ambience | ambience | loopable dungeon ambience | ambience | generated lowpass noise + transformer hum |

## Integration notes

- AudioSystem.unlock() is called from the existing pointer/key gesture when a run begins. It creates master, sfx, ui, ambience, voice, and music groups.
- play(type, weapon, event) remains compatible with the old two-argument calls. The optional event object accepts position, volume, group, variant, rate, detune, cooldown, loop, refDistance, maxDistance, and rolloffFactor.
- play('shot', weapon) chooses from the weapon-specific sample pool. play('kill') aliases to enemydeath; play('fire') aliases to shot; play('slam') aliases to land.
- updateListener({x, y, z, forwardX, forwardY, forwardZ, upX, upY, upZ}) updates the Web Audio listener for optional HRTF spatial event playback.
- play('ambience') is idempotent and starts one loop. stopAmbience() stops it cleanly. Pause/resume suspends and resumes the context without stacking sources.
- If any file is missing or cannot decode, the same event uses the built-in procedural synthesizer, so offline local testing remains functional.
- The runtime uses per-event variant selection, minor sample-rate variation, master/group gain controls, browser gesture unlock, and source disposal.
