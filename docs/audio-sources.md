 Audio sources and runtime

Updated September 20, 2026. The active event map is `assets/audio-manifest.js`; the runtime loads only bundled files from `assets/audio/`. The audio layer uses sampled assets throughout. Missing or undecodable files stay silent and appear in `AudioSystem.debugInfo.errors`; no oscillator or noise fallback is generated.

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

The [Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) is CC0 1.0. Its included report takes are recordings of a Walther PPQ 9 mm pistol and a Benelli Nova 12-gauge shotgun; the source project describes its excerpts and edits in its [audio README](https://github.com/yegors/hard-lines/blob/main/public/audio/README.md). The Arc Lance primary is from BMacZero's CC0 [Electricity Sound Effects](https://opengameart.org/content/electricity-sound-effects-0), recorded from a small Tesla generator. Creature clips are from artisticdude's CC0 [Zombies Sound Pack](https://opengameart.org/content/zombies-sound-pack). The pack does not label event semantics, so its first 12 ordered one-shots are assigned to attacks and the remaining 12 to moans in our manifest.

The six short WAV stems in `sfx/processed/` are derived from the sources named above or the already licensed Kenney library. Firearm recordings are resampled to 48 kHz PCM; the Kenney launch effects are trimmed to one-shot length and faded. Zombie variants are converted to Vorbis Ogg with a small safety attenuation. These are local edits of source recordings and sound effects, not generated synthesis. The source archives are kept in ignored `.art-source/audio-incoming/` for preservation and are not needed at runtime.

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
| Arena feedback | `spawn`, `wave`, `win`, `death`, `heartbeat`, `coin` | Existing bundled sample pools |
| Interface | `ui`, `hover`, `confirm`, `cancel`, `pause`, `fail`, `toggle`, `equip` | Kenney interface pack |
| Music / ambience | `music-menu`, `music-play`, `ambience` | Bundled loops; no network requests |

`AudioSystem.unlock()` is called from the existing user gesture. After decode, the runtime measures active RMS for each one-shot variant pool and trims or boosts variants toward their pool median, bounded to +/-6 dB. This keeps alternate shots, footsteps, creature clips, and interface cues consistent without flattening the separate music and ambience beds. A master compressor limits peaks after the group mix. The runtime keeps separate `sfx`, `ui`, `ambience`, `voice`, and `music` groups, applies event-specific filters and optional spatial panning, and manages pause/resume and music crossfades. `play('shot', weapon)` selects the matching weapon pool. Missing files do not block startup; their load errors are available for review.

The Settings drawer is available from the pause screen. Master, effects, enemy voices, music, ambience, and interface sliders update the live mixer immediately and persist in browser local storage. Existing saves keep their master `volume` setting; newly added group levels default to 100% of the game's existing balanced group mix.

Open `/audio-review.html` on the local game server to audition event pools and scene beds with the game audio system. No paid library, external audio API, generated audio provider, or provider credential was used for this refresh.
