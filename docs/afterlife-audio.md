# Afterlife audio pass

This pass tightens the small sampled layer for the cold, human, uneasy afterlife direction. It keeps the existing afterlife air/creak samples and adds three compact variants. The set stays under the runtime budget and uses the existing `AudioSystem` groups, unlock path, pause cleanup, spatial panners, and voice caps.

The required audio reference was loaded before implementation: [`threejs-audio-generator/references/audio-workflows.md`](C:/Users/wolfk/.codex/skills/threejs-audio-generator/references/audio-workflows.md). The ElevenLabs credential probe returned `ELEVENLABS_API_KEY=MISSING`, so no external generation call was attempted. No movie or soundtrack audio was copied. The new files are local deterministic renders or derivatives of already-audited repo stems.

| Runtime event | Asset | Length | Loop | Treatment |
| --- | --- | ---: | --- | --- |
| `play` ambience pool | `assets/audio/afterlife/air-corridor-loop.ogg` | 12.00s | yes | Existing pink/brown air bed, two low room modes, fade edges, restrained limiter |
| `spawn-telegraph` → `moan` | `assets/audio/afterlife/room-creak.ogg` | 2.40s | no | Existing brown air, descending room creak, low structural resonance |
| `enemy-attack` → `enemyattack` | `assets/audio/afterlife/enemy-onset.ogg` | 0.44s | no | Added variant derived from the existing generated lunge cue, slowed, filtered, compressed, and given a short room return |
| `shot` layer, weapons 1/3 | `assets/audio/afterlife/weapon-latch-metal.ogg` | 0.25s | no | Added variant derived from the audited CC0 light-metal impact, filtered to a quiet latch tail |
| `shot` layer, weapons 2/4 | `assets/audio/afterlife/weapon-latch-bone.ogg` | 0.16s | no | Added variant derived from the audited CC0 interface scrape, pitched up and shortened into a dry bone/mechanical tick |

The manifest keeps weapon reports in their existing pools. `AudioSystem.play('shot')` and the Reliquary's `rocket` event now add one low-level mechanism buffer from the weapon-indexed `mechanism` pool, reusing the event's spatial position. The layer is capped at four voices and uses a short high-pass/low-pass band, so it does not add event traffic or a real-time synthesizer. Existing mute, group volume, user gesture unlock, page visibility pause, retry, and dispose paths remain in control of both the main report and its mechanism tail.

The deterministic renders were made with the bundled ImageMagick FFmpeg 4.2.3 build, `-threads 1`, and Vorbis `-q:a 4`. The air and creak files use FFmpeg `lavfi` noise/sine sources and have no external source license. `enemy-onset.ogg` derives from `assets/audio/baseline/zombie-fastzombie1.ogg`, a generated stem documented in `.codex-temp/audio-synth.mjs`. The two latch files derive from `assets/audio/baseline/impact-impactMetal_light_000.ogg` and `assets/audio/baseline/interface-scratch_001.ogg`; their original CC0 records are in `assets/audio/baseline/impact-LICENSE.txt` and `assets/audio/baseline/interface-LICENSE.txt`.

The five-file afterlife set totals about 125 KiB, below the 2 MiB runtime budget; this pass adds about 18 KiB of new bytes because the air and room files were already tracked. Run the focused check with:

```powershell
node scripts/verify-afterlife-audio.mjs --ffmpeg "C:\Program Files\ImageMagick-7.1.0-Q16-HDRI\ffmpeg.exe"
```

The check imports the live manifest, verifies every afterlife reference, decodes each file one at a time, checks the expected duration band, and enforces the size budget. Browser playtest evidence should verify that the air loop starts once on a user gesture, pauses cleanly, and that weapon and enemy layers remain readable under the existing music/ambience mix.
