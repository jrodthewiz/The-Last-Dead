 Build 10 sampled audio refresh

This refresh replaces the in-repo synthetic combat and creature clips with bundled samples from CC0 libraries. The existing Web Audio lifecycle, event groups, spatial panning, voice limits, mute/volume controls, and music/ambience loops remain in place. Missing or undecodable samples now remain silent instead of producing generated oscillator or noise effects.

## Workflow ledger

- Loaded `threejs-audio-generator/SKILL.md` and its `references/audio-workflows.md`.
- Sourced firearm reports from the CC0 Free Firearm Sound Library, electrical discharges from BMacZero's CC0 Tesla-generator recordings, and creature variants from artisticdude's CC0 Zombies Sound Pack.
- Kept existing CC0/Kenney impact, gore, interface, music, and ambience assets.
- Used local FFmpeg resampling, trimming, fading, and level adjustment only. No provider generation, paid assets, API credentials, or new synthetic audio were used.
- Full source pages, license notes, and runtime mapping are in [audio-sources.md](../audio-sources.md).

## Mix changes

| Event | Active assets | Change |
| --- | --- | --- |
| Ossuary fire | P226 report takes | Replaced the synthetic shot with three sampled variants |
| Breach fire | Benelli Nova report takes | Replaced the synthetic shot with two sampled variants |
| Arc Lance fire | Tesla discharge plus two existing CC0 sci-fi effects | Replaced the generated stem with a recorded electrical arc and retained compatible sampled alternatives |
| Reliquary / rocket | Trimmed Kenney thruster samples | Removed the generated stem and overlong raw variants from gameplay |
| Hit / blood | Kenney impact/slime and CC0 bullet/splat samples | Restored sampled transients and split dry impacts from wet gore |
| Enemy attack / moan | 24 CC0 zombie one-shots | Replaced the small, quiet pool with varied sampled clips |
| UI | Kenney interface samples | Restored the original sourced click and hover files |

The processed files are short, local one-shots. Firearm WAVs are 48 kHz PCM, alternate takes and creature variants use Vorbis Ogg, and the Reliquary trims fade at the end. The zombie pack does not label attack versus moan; we map its first 12 ordered one-shots to attacks and the next 12 to moans.

## Runtime behavior

`assets/audio-manifest.js` owns all event pools. `assets/audio.js` keeps the existing browser gesture unlock, separate `sfx`, `ui`, `ambience`, `voice`, and `music` groups, voice limits, optional 3D positioning, pause/resume, and scene crossfades. Sample variants are RMS leveled toward the median for their event pool within a +/-6 dB limit; the master compressor catches mix peaks. The pause-screen settings expose live master and group levels, saved in local storage. Loader failures remain visible through `AudioSystem.debugInfo.errors`.

Open `/audio-review.html` on the local game server to audition the event pools and music/ambience scenes.

## Verification status

The focused browser check ran in a separate tab against the local game server. It decoded all 97/97 manifest entries with no audio load errors, matched 64 samples across 23 variant pools, and found no generated synth fallback methods. An enemy attack one-shot played through the `voice` group.

All six audio mix sliders were changed from the pause settings drawer. The live master and group values updated immediately, and a page reload restored the saved preferences and reapplied them to the audio runtime. Test preferences were removed afterward. `audio-runtime.json` records the results. `node --check` passed for `assets/audio.js`, `ui.js`, and `main.js`; `node build.mjs` completed successfully.
