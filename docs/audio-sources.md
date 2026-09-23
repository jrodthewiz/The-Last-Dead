 Audio sources and runtime

Updated September 23, 2026. The active event map is `assets/audio-manifest.js`; the runtime loads only bundled files from `assets/audio/`. Audio events use sampled assets; the game has no oscillator or noise fallback. A brief oscillator LFO controls the gain of a sampled hidden-threat voice to add a subtle rough pulse; it does not produce an audible standalone tone.

## Sampled audio refresh

This pass replaces the in-repo synthetic combat and creature clips with licensed sample-library material and removes the runtime synthesis paths.

| Use | Runtime pool | Source |
| --- | --- | --- |
| Ossuary pistol | `processed/ossuary-shot.wav`, `sourced/weapons/ossuary-02.ogg`, `sourced/weapons/ossuary-03.ogg` | Three P226 report takes from the Free Firearm Sound Library |
| Breach shotgun | `processed/breach-shot.wav`, `sourced/weapons/breach-02.ogg` | Two 12-gauge report takes from the same library |
| Arc Lance | `processed/arc-lance.wav`, two Kenney sci-fi laser samples | Tesla-generator discharge plus curated sci-fi samples |
| Reliquary / rocket | `processed/reliquary-launch.wav`, `sourced/weapons/reliquary-02.ogg` | Shortened Kenney thruster effects |
| Impact | `processed/impact-metal-flesh.wav`, `cc0-bullet-hit.wav`, and the Kenney medium-impact variants | CC0 bullet-hit effect and Kenney Impact Sounds |
| Blood | `processed/blood-burst.wav`, `cc0-splat-hit.wav` | Kenney slime sample and a CC0 splat effect |
| Zombie attack / moan | 12 attack and 12 moan variants in `sourced/enemies/` | Zombies Sound Pack |
| Hidden-threat cue | Existing CC0 zombie moan samples in `sourced/enemies/` | Zombies Sound Pack; spatialized, filtered, detuned 75 cents, and amplitude-modulated at 40 Hz with 14% depth |
| Cleared-sector scream | `sourced/horror/distant-scream-rough.ogg` | Vinrax's CC0 `Horror scream1` recording, processed locally |
| Sector room tone | Existing dungeon and corridor ambience loops | Three filtered, rate-shaped, gain-adjusted presets for foundry, ward, and ossuary spaces |

The [Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) is CC0 1.0. Its included report takes are recordings of a Walther PPQ 9 mm pistol and a Benelli Nova 12-gauge shotgun; the source project describes its excerpts and edits in its [audio README](https://github.com/yegors/hard-lines/blob/main/public/audio/README.md). The Arc Lance primary is from BMacZero's CC0 [Electricity Sound Effects](https://opengameart.org/content/electricity-sound-effects-0), recorded from a small Tesla generator. Creature clips are from artisticdude's CC0 [Zombies Sound Pack](https://opengameart.org/content/zombies-sound-pack). The pack does not label event semantics, so its first 12 ordered one-shots are assigned to attacks and the remaining 12 to moans in our manifest.

The six short WAV stems in `sfx/processed/` are derived from the sources named above or the already licensed Kenney library. Firearm recordings are resampled to 48 kHz PCM; the Kenney launch effects are trimmed to one-shot length and faded. Zombie variants are converted to Vorbis Ogg with a small safety attenuation. These are local edits of source recordings and sound effects, not generated synthesis. The source archives are kept in ignored `.art-source/audio-incoming/` for preservation and are not needed at runtime.

The hidden-threat cue reuses the already bundled CC0 zombie moan pool. The new distant scream is based on [Vinrax's `Horror scream1`](https://opengameart.org/content/horror-scream1), released under CC0; the untouched MP3 source and intermediate WAV are preserved under ignored `.art-source/afterlife-iteration/audio/`. The bundled mono Ogg/Vorbis file is slowed to 95% pitch/rate, band-limited to 70–3,800 Hz, given a restrained 40 Hz tremolo at 16% depth, and followed by a quiet 110 ms echo. This is an audible sampled cue and modulation texture, not an infrasonic carrier. The game plays it once per campaign run after a sector is cleared, from a point behind the player or outside their view. The campaign sector index selects one of three gain-adjusted room-tone treatments: foundry pressure (0.96 rate, 40–3,500 Hz), ward ventilation (1.02 rate, 62–4,700 Hz), and ossuary resonance (0.93 rate, 34–6,500 Hz). Transitions crossfade the current ambience loop and do not touch combat or voice levels.

## Existing bundled sources

| Source | Use | License |
| --- | --- | --- |
| [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) | Hits, movement, parries, and metallic events | CC0; license file ships with the pack |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | Menu clicks, hover, confirmation, and settings | CC0; license file ships with the pack |
| [Kenney Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | Weapons, explosions, spawn, and effects | CC0; license file ships with the pack |
| [Basic Sound Effects](https://opengameart.org/content/basic-sound-effects), n4 | Existing explosions, coin and button effects | CC0 |
| [Loopable Dungeon Ambience](https://opengameart.org/content/loopable-dungeon-ambience), JaggedStone | Existing dungeon room tone | CC0 |
| [Footsteps](https://opengameart.org/content/footsteps-0), GboxMikeFozzy | Concrete footsteps | CC0 |
| [Jump / Landing](https://opengameart.org/content/jump-landing-sound), MentalSanityOff / qubodup submission | Existing jump and landing sample | CC0 |
| [Various Sound Effects](https://opengameart.org/content/various-sound-effects-0), Spring Spring / Julie Damsgaard | Bullet crackle/hit, splat, enemy movement/death and related cues | CC0; the page invites optional credit |
| [Insistent: Background Loop](https://opengameart.org/content/insistent-background-loop), yd | Menu music | CC0 |
| [Abandoned Passages](https://opengameart.org/content/abandoned-passages-horror-ambience-loop), congusbongus | Gameplay music | CC0 |

Original imported filenames are recorded in `assets/audio/baseline/provenance.json`; source pages and the shipped license files provide the license record. The dungeon ambience, enemy death/jump and bullet-crackle recordings keep their existing sources.

## Runtime event map

| Event | Manifest pool | Notes |
| --- | --- | --- |
| Four weapon fires | `shot` with weapon indices 0-3 | Separate pools; the launch pool is reused for rocket launch |
| Explosions | `explosion` | Three short bundled effects |
| Hit / blood | `hit`, `blood` | Separate dry impact and wet splat pools |
| Movement / combat | `footstep`, `jump`, `land`, `dash`, `slide`, `hook`, `parry`, `punch`, `damage` | Existing bundled CC0/Kenney effects |
| Creatures | `enemyattack`, `moan`, `enemydeath`, `enemyjump`, `enemyland` | Attacks and moans use 24 fresh variants |
| Horror pacing | `horror-approach`, `distant-scream` | A local hidden-threat cue uses an existing CC0 moan; a single filtered CC0 scream can occur during the post-combat exit beat. Both duck only music and ambience briefly, then restore those groups automatically. |
| Arena feedback | `spawn`, `wave`, `win`, `death`, `heartbeat`, `coin` | Existing bundled sample pools |
| Interface | `ui`, `hover`, `confirm`, `cancel`, `pause`, `fail`, `toggle`, `equip` | Kenney interface pack |
| Music / ambience | `music-menu`, `music-play`, `ambience` | Bundled loops; no network requests |

`AudioSystem.unlock()` is called from the existing user gesture. After decode, the runtime measures active RMS for each one-shot variant pool and trims or boosts variants toward their pool median, bounded to +/-6 dB. This keeps alternate shots, footsteps, creature clips, and interface cues consistent without flattening the separate music and ambience beds. A master compressor limits peaks after the group mix. The runtime keeps separate `sfx`, `ui`, `ambience`, `voice`, and `music` groups, applies event-specific filters and optional spatial panning, and manages pause/resume and music crossfades. `play('shot', weapon)` selects the matching weapon pool. Missing files do not block startup; their load errors are available for review.

The Settings drawer is available from the pause screen. Master, effects, enemy voices, music, ambience, and interface sliders update the live mixer immediately and persist in browser local storage. Existing saves keep their master `volume` setting; newly added group levels default to 100% of the game's existing balanced group mix.

Open `/audio-review.html` on the local game server to audition event pools and scene beds with the game audio system. No paid library, external audio API, generated audio provider, or provider credential was used for this refresh.
