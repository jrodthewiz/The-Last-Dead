# Spatial atmosphere source and processing ledger

Prepared September 30, 2026. These six files contain edited recordings, with no generated tones, synthetic speech, pitch alteration or fabricated foliage sounds. The game's existing ward-wind recordings remain the wind source.

## Sources and licence verification

| Collection | Author | Primary source | Verified licence | Untouched attachment |
| --- | --- | --- | --- | --- |
| Voices of Madness | eugeneloza | [OpenGameArt source page](https://opengameart.org/content/voices-of-madness) | CC0; the author states that credit is welcome but not required | [sounds-of-madness-ogg.zip](https://opengameart.org/sites/default/files/sounds-of-madness-ogg.zip), 28,155,065 bytes |
| Fabric Rustling | Iochi Glaucus | [OpenGameArt source page](https://opengameart.org/content/fabric-rustling) | CC0 | [rustling.ogg](https://opengameart.org/sites/default/files/rustling.ogg), 337,262 bytes |

Both primary pages were opened and their attachment links followed before downloading. The voice author describes personal Lorem Ipsum readings and tags the collection as whispering/ambience. The fabric author describes rustling a leg warmer, recorded with an AT2020 and edited in Audacity. The pages identify [CC0](https://creativecommons.org/publicdomain/zero/1.0/) as their licence.

The voice page mentions eleven tracks; the downloaded OGG ZIP actually contains ten: `a2-scared`, `a3-menacing`, `a4-scared`, `a5-menacing`, `b1-menacing`, `b2-large`, `b3-excited`, `b4-scared`, `b5-excited`, and `b6-excited`. Only three separate `menacing` takes were used. The large, excited and scared takes were excluded.

Untouched downloads and all ten untouched extracted voice files are preserved in `.art-source/audio-incoming/spatial-atmosphere/`. This directory is an ignored preservation archive and is not runtime input.

## Selection and verification limits

The whisper candidates were selected from three distinct real voice recordings. After the same gentle high/low-pass screening used for delivery, active 3.2-second windows were ranked by restrained RMS, zero-crossing activity and low periodic autocorrelation. Selected voiced-frame fractions were 0.125, 0 and 0 respectively. Fabric windows were chosen by filtered activity, with more than three seconds between starts, avoiding the recording's low-frequency handling bumps and quiet gaps.

**Audition status:** source metadata and decoded signals were checked; no human listening was performed. An attempt to pass a preview to the available audio-input interface returned that audio input was unsupported. The signal screen supports a whisper/breath-like selection, but it is not a listening test and does not establish perceived scariness, speech intelligibility, or freedom from every unwanted vocal inflection. Headphone and ordinary-speaker audition remains necessary during the game's audio QA. These assets should not be described as human-approved.

The engine has no real plants in the inspected runtime world factories or five Story floors. Fabric rustle belongs to actual gurney linen, tarps, altar cloth and clothing; it should not be presented as a nearby forest or moving leaves.

## Delivered files

All files live in `assets/audio/atmosphere/`, use mono Vorbis at 32,000 Hz with FFmpeg `libvorbis -q:a 3`, and total 133,571 bytes. Durations below are measured decoded sample counts divided by 32,000; they include ordinary Vorbis trimming/padding variation from the requested duration. Peak and RMS are decoded sample measurements in dBFS, not LUFS or perceived loudness.

| Output | Original source / start | Requested duration | Decoded duration | Peak dBFS | RMS dBFS | Bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `secret-whisper-01.ogg` | `a3-menacing.ogg` / 32.5 s | 3.2 s | 3.222 s | -8.985 | -30.005 | 29,722 |
| `secret-whisper-02.ogg` | `a5-menacing.ogg` / 29 s | 3.2 s | 3.194 s | -9.714 | -29.985 | 29,704 |
| `secret-whisper-03.ogg` | `b1-menacing.ogg` / 32 s | 3.2 s | 3.202 s | -8.856 | -30.461 | 28,730 |
| `cloth-rustle-01.ogg` | `rustling.ogg` / 2.4 s | 1.6 s | 1.614 s | -15.907 | -28.996 | 15,202 |
| `cloth-rustle-02.ogg` | `rustling.ogg` / 16.6 s | 1.6 s | 1.618 s | -8.744 | -29.329 | 15,007 |
| `cloth-rustle-03.ogg` | `rustling.ogg` / 5.6 s | 1.6 s | 1.626 s | -8.565 | -29.029 | 15,206 |

All six files decode successfully. There are no NaN/Inf samples in the FFmpeg astats logs and no decoded sample clipping. Signal measurements do not establish headphone/speaker audibility after the game's mixer, occlusion filters and distance attenuation.

## Processing and exact settings

Existing installed tool: `C:/Program Files/ImageMagick-7.1.0-Q16-HDRI/ffmpeg.exe`, FFmpeg 4.2.3, with `libvorbis`. No paid service, generation API, new dependency or runtime downloader was used.

Preserved reproducible scripts:

- `.art-source/audio-incoming/spatial-atmosphere/prepare-spatial-atmosphere.ps1`
- `.art-source/audio-incoming/spatial-atmosphere/analyze-spatial-atmosphere.mjs`
- `selection-candidates.json`, `processing-jobs.json`, `output-measurements.json`
- `analysis/*.input-window-astats.txt` and `analysis/*.ogg.astats.txt`

Rebuild from the preserved originals:

```powershell
& '.art-source/audio-incoming/spatial-atmosphere/prepare-spatial-atmosphere.ps1'
```

Each output uses this command form, with the exact per-file values in the following table:

```text
ffmpeg -nostdin -y -hide_banner -loglevel error -i INPUT -map_metadata -1 -af "atrim=start=START:duration=DURATION,asetpts=PTS-STARTPTS,highpass=f=HP,lowpass=f=LP,afade=t=in:st=0:d=FADE_IN,afade=t=out:st=FADE_START:d=FADE_OUT,volume=GAINdB" -ac 1 -ar 32000 -c:a libvorbis -q:a 3 OUTPUT
```

| Output | HP / LP Hz | Fade in | Fade out start / duration | Final gain |
| --- | ---: | ---: | ---: | ---: |
| `secret-whisper-01.ogg` | 120 / 7600 | 0.14 s | 2.88 / 0.32 s | +2.8609 dB |
| `secret-whisper-02.ogg` | 120 / 7600 | 0.14 s | 2.88 / 0.32 s | +5.9391 dB |
| `secret-whisper-03.ogg` | 120 / 7600 | 0.14 s | 2.88 / 0.32 s | -3.2594 dB |
| `cloth-rustle-01.ogg` | 100 / 6800 | 0.055 s | 1.42 / 0.18 s | -0.2065 dB |
| `cloth-rustle-02.ogg` | 100 / 6800 | 0.055 s | 1.42 / 0.18 s | +0.6168 dB |
| `cloth-rustle-03.ogg` | 100 / 6800 | 0.055 s | 1.42 / 0.18 s | +3.1931 dB |

Gain matching uses decoded mono measurements, targeting approximately -30 dBFS RMS for whispers and -29 dBFS RMS for cloth while bounding sample peaks. No compression, limiting, pitch shift, reverb or replacement waveform is applied. OGG file hashes can change when rebuilt because container serial numbers are not fixed; the exact sources, trim/filter/gain settings and decoded signal measurements remain the reproduction contract.

## SHA-256 ledger

### Untouched input bytes

| Input | SHA-256 |
| --- | --- |
| `sounds-of-madness-ogg.zip` | `9B06B7581608DA15EC635AB4C83F4D3C110027C3BB8DB43F0BE3259B23856C27` |
| `rustling.ogg` | `897C0937041AFDF3581427B80A7546F99D219D0008E12FF5500C2AFDFA4B7A1E` |
| `original-voices/a3-menacing.ogg` | `90348597BCF3239CC176871EB150ECCFEA7587F3DD1FAB9B58C286133D7D890F` |
| `original-voices/a5-menacing.ogg` | `F2FE12D0D0A266809BB7BF9466C3D3FEEDA3D0CC3305F591BA41540E99F5E157` |
| `original-voices/b1-menacing.ogg` | `7582D9E0E362193842EC4AFFFC9D419D54B079595B92108700DC094790202461` |

### Delivered runtime bytes

| Output | SHA-256 |
| --- | --- |
| `secret-whisper-01.ogg` | `B8D54D4D61450389CB9B7E650F0855784B6514CAFC1D697B6CB259B62C811BFE` |
| `secret-whisper-02.ogg` | `E78804685776A70898D3969783D9EBB43B4AD411CBB855E361EF8586AEF0B7A8` |
| `secret-whisper-03.ogg` | `DB6DE81B852462C7F0C36C2A9A3E3B298DAAF1D22860411B308B53A1E94BFA0B` |
| `cloth-rustle-01.ogg` | `1F1B89D9AF3A40083E04C6F09CBC21B1A690A4772D90FDF3951917F131B67B6B` |
| `cloth-rustle-02.ogg` | `E2D0A0831653ADDD8148E76B84126151F47C50E8CBA0994074D826254E20BA34` |
| `cloth-rustle-03.ogg` | `FFD02A2956DB92A6E445FEBC3D57B83368D166B62668DCCA9C09D7357F62FDE1` |

Runtime integration, emitter placement and manifest changes are owned by the coordinating thread. This preparation pass changed only the preservation archive, the six atmosphere assets and this source ledger.
