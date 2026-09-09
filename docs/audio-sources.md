# Audio baseline � September 8, 2026

The active event-to-file map is `assets/audio-manifest.js`. Change a pool there to replace a sound without changing gameplay. The runtime resolves paths relative to `assets/audio.js`. All files are bundled; runtime playback needs no external service.

52 new Ogg samples were imported unchanged from these CC0 packs:

| Pack | Author | Source |
| --- | --- | --- |
| Impact Sounds | Kenney | https://kenney.nl/assets/impact-sounds |
| Interface Sounds | Kenney | https://kenney.nl/assets/interface-sounds |
| Sci-fi Sounds | Kenney | https://kenney.nl/assets/sci-fi-sounds |
| Zombie noises and moans | ianzazz | https://opengameart.org/content/zombie-noises-and-moans |

The exact original filenames are in `assets/audio/baseline/provenance.json`; the three Kenney license files ship beside the samples. Zombie files are CC0 per the linked author page. Source archives are preserved in ignored `.art-source/audio-baseline/`, which is not needed at runtime. No YouTube excerpts were used.

The pistol, shotgun, dungeon ambience, enemy death/jump and bullet-crackle recordings retain their existing sources documented below. Weapon pools now have consistent identities; the previous processed/unprocessed random alternation and synthesized accents are removed. Missing/undecodable samples retain procedural fallback.

Movement, punch, damage, parry, gore, spawn, wave, low health, death, victory, coin and menus all have sample pools. Some intentionally share recordings as placeholders (jump/footsteps, player damage/punch, enemy land/heavy impact, heartbeat/soft impact). Final bespoke sound design and listening approval remain future work.

Menus have click, back, confirmation, hover/focus and setting-change cues. Hover starts only after an audio-unlocking gesture. Pause stops world voices and ambience while allowing menu cues; resume starts ambience through the existing game hook. Muting uses the existing master volume.

Browser verification: all 71 manifest entries decoded without errors; paused gameplay playback rejected; paused UI accepted; resumed gameplay accepted. Build passed. Open `/audio-review.html` locally to audition every pool and weapon with the actual game mix.

---

## Background music

The background beds are bundled loops under `assets/audio/music/` and are selected by `assets/audio-manifest.js`:

| Runtime key | Bundled file | Source / author | License | Use |
| --- | --- | --- | --- | --- |
| `music-menu` | `insistent-menu.ogg` | [Insistent: background loop](https://opengameart.org/content/insistent-background-loop), yd | CC0 | Restrained dark menu bed |
| `music-play` | `abandoned-passages.ogg` | [Abandoned passages (horror ambience loop)](https://opengameart.org/content/abandoned-passages-horror-ambience-loop), congusbongus | CC0 | Low, unsettling gameplay bed |

The source files were downloaded from OpenGameArt on 2026-09-09 and renamed only for the local runtime. CC0 permits commercial use and does not require attribution; the source pages are retained here for provenance. No YouTube excerpts or third-party API credentials are used.

`AudioSystem.setScene('menu'|'play'|'pause'|'dead'|'win')` owns the music lifecycle. The call is safe before unlock, remembers the requested scene, and starts after the next user gesture. Scene changes crossfade one loop at a time. `play` also starts the existing dungeon ambience; `menu`, `dead`, and `win` stop it. `pause` fades music to silence while keeping its source resumable, and `resume()` restores the previous scene without stacking another loop.

---

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
- play('ambience') is idempotent and starts one loop. stopAmbience() stops it cleanly. Pause stops world voices; UI remains available.
- setScene('menu'|'play'|'pause'|'dead'|'win') crossfades one music loop, starts gameplay ambience for `play`, and keeps pause/resume from stacking sources.
- If any file is missing or cannot decode, the same event uses the built-in procedural synthesizer, so offline local testing remains functional.
- The runtime uses per-event variant selection, minor sample-rate variation, master/group gain controls, browser gesture unlock, and source disposal.
