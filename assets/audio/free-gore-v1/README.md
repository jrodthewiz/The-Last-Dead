# Free gore and vermin demo audio

Downloaded and prepared on 2026-09-30. Cost: $0. Eight Freesound sources, each advertised as CC0 1.0, provide seventeen short WAV clips. CC0 permits use and adaptation in commercial projects as well as this demo. Source authors are recorded voluntarily for provenance.

These assets are **ready to wire, not currently wired into gameplay**. This isolated delivery changes no existing audio manifest, mixer, controls, server or game tab. The suggested gameplay mapping below is a sound-design recommendation, not a claim of verified in-game synchronization.

## Quality and preservation

The downloaded inputs are the **public high-quality MP3 previews** advertised in each sound page's share metadata. They are compressed previews, not the uploader's original lossless WAV/AIFF files. Preparing WAV derivatives does not restore the original recording's fidelity. Original downloads require a Freesound login; no login restriction was bypassed.

Downloaded previews, captured license pages and their hashes are preserved under `.art-source/free-gore-v1/`. That ignored archive is never required by the game. The runtime clips in this folder are mono 44.1 kHz PCM16 WAV, selected from distinct source intervals, with gentle high/low-pass filters, 8 ms fades, bounded gain of at most +6 dB, and peaks at or below -4 dBFS. No generated voice or paid provider was used. Waveform checks do not replace a human listening and in-game mix review.

## Sources and proposed mapping

| Source | Author / license page | Prepared files | Proposed use |
| --- | --- | --- | --- |
| Real cockroach swarm | [szczur_banshee / CC0](https://freesound.org/people/szczur_banshee/sounds/380769/) | roach-swarm-01/02.wav | vermin-swarm-warning, vermin-swarm |
| Real cockroach scurrying | [ThabzMalik / CC0](https://freesound.org/people/ThabzMalik/sounds/767054/) | roach-scrabble-01/02/03.wav | vermin-crawl, quiet pickup rustle |
| Rat eating and breathing | [lucaslara / CC0](https://freesound.org/people/lucaslara/sounds/154477/) | rat-chew-01/02/03.wav | vermin-bite, infestation texture |
| Processed rodent squeak | [egomassive / CC0](https://freesound.org/people/egomassive/sounds/536753/) | rat-squeak-01.wav | pickup or bite accent |
| Wet squishing foley | [editor_adp / CC0](https://freesound.org/people/editor_adp/sounds/269482/) | flesh-squish-01.wav | contact and organ handling |
| Liquid spitting foley | [squareal / CC0](https://freesound.org/people/squareal/sounds/237386/) | blood-spit-01/02/03.wav | neck bite, wet contact, release |
| Macaroni crush foley | [getwecked / CC0](https://freesound.org/people/getwecked/sounds/765085/) | bone-crunch-01.wav | dry fracture layer for chops/crushes |
| Mud/puddle gurgling | [newlocknew / CC0](https://freesound.org/people/newlocknew/sounds/784955/) | gut-gurgle-01/02/03.wav | extraction and viscera movement |

The squeak uploader identifies its original as "Mouse Squeaks" by Shyguy014, also CC0. It is a processed rodent sound, not a newly recorded aggressive rat. The liquid and dry gore layers are foley recordings; their names describe the intended game use rather than literal injury recordings.

## Wiring notes

`manifest.json` contains `pools` whose URLs already resolve relative to `assets/audio.js`, for example `./audio/free-gore-v1/rat-chew-01.wav`. Pool names start with `free-` to avoid collisions. Adding the selected pools to `AUDIO_ASSET_MANIFEST` and assigning them to existing event cue layers can use the current Web Audio loader, group volumes, shared voice limits, pause lifecycle and canonical event deduplication.

Suggested initial layers, to audition and tune against live weapon and zombie sounds:

- Rat bite: one rat-chew variant, with a quiet, occasional squeak. Do not play the entire sound on every frame.
- Crawling: a short roach-scrabble variant with a shared voice budget; keep it beneath attack warnings.
- Swarm: a brief roach-swarm recording. No endless loop is supplied or implied.
- Flesh impact: bone-crunch briefly at contact, flesh-squish about 20 ms later, and a quieter blood-spit tail about 45 ms later.
- Organ extraction: a quieter gut-gurgle texture with flesh-squish at the pull boundary.

Use the existing `sfx` group and foley/injury buses as appropriate. Preserve mute, volume and pause behavior. Main-thread integration and mix QA are intentionally left untouched here to avoid conflicts with active work.

## Reproducibility and reference ledger

Run `scripts/prepare-free-gore-v1.py` from this checkout with the bundled Python and local FFmpeg. It checks the source license link before downloading the advertised public preview, preserves the inputs and emits file hashes, source offsets and waveform measurements in `manifest.json`.

Applied guidance: `C:/Users/wolfk/.codex/skills/threejs-audio-generator/SKILL.md` and its full `references/audio-workflows.md`. Provider generation and credential probing are out of scope: this user explicitly requested free downloadable recordings. PC browser audio is the target; no mobile support was added.
