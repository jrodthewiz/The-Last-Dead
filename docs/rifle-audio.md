# Rifle audio pass

## September 23 additions

Carrion and Mourning each gained two CC0 field-recorded report takes beside the processed report listed below. Their action tails now use short CC0 airsoft recordings, delayed 55 ms and 95 ms after the shot. The Breach shotgun has a 130 ms delayed pump. See [the current audio source ledger](audio-sources.md#september-23-weapon-and-horror-expansion) for source pages, filenames, processing, and license evidence. The original pass details below remain as the history of the first rifle mix.

This pass gives the two rifle slots their own report pools and restrained
mechanical tails. It reuses the bundled CC0-labelled source stems already used
by the project's audio pass; no external download or ElevenLabs generation was
needed.

The ElevenLabs credential probe was `ELEVENLABS_API_KEY=MISSING`, so the safe
fallback was deliberate local processing of the existing source assets. The
audio workflow reference used for this integration is
`C:/Users/wolfk/.codex/skills/threejs-audio-generator/references/audio-workflows.md`.

| Slot | Runtime identity | Report | Source / processing | Tail | Voice guard |
| --- | --- | --- | --- | --- | --- |
| 5 / JSON 4 | CARRION automatic rifle | `assets/audio/sfx/processed/carrion-auto-rifle.wav` | `cc0-gunshot.mp3`; 0.22s mono WAV, high-pass 92Hz, low-pass 9.8kHz, compression, fade, 0.78 gain | `afterlife/weapon-latch-metal.ogg` | four shot voices, 55ms event cooldown, three mechanism voices |
| 6 / JSON 5 | MOURNING marksman rifle | `assets/audio/sfx/processed/mourning-marksman.wav` | `cc0-gunshot-heavy.wav`; 0.48s mono WAV, high-pass 36Hz, low-pass 6.7kHz, compression, fade, 0.82 gain | `afterlife/weapon-latch-bone.ogg` | two shot voices, 110ms event cooldown, two mechanism voices |

The manifest keeps the rifle reports in their own weapon-indexed pools, so an
unavailable rifle asset cannot silently fall back to the Ossuary pistol report.
`AudioSystem.play('shot', weapon, { mode })` applies the Carrion burst trim and
the Mourning charged-shot lift while preserving the shared master, SFX group,
mute, user-gesture unlock, page-visibility pause, and restart lifecycle.

The root combat loop owns the state and sends `mode: 'auto' | 'burst' |
'snap' | 'charged'` on shot events. Carrion's held primary is protected by the
four-voice cap and short cooldown; Mourning's charged shot remains a single
heavy voice with a lower two-voice ceiling. The existing latch layer is played
once per real shot and is capped independently, so a held trigger cannot spawn
a per-frame synth or an unbounded tail stack.

Mourning's `rifle-charge` event maps to the one-shot bundled bone latch at
`assets/audio/afterlife/weapon-latch-bone.ogg`; it is capped at one voice and
never becomes a continuous loop.

## Verification

- Both processed files exist and are non-empty WAV assets under
  `assets/audio/sfx/processed/`.
- `assets/audio-manifest.js` declares six shot pools and six mechanism pools.
- The browser audio loader decodes the two new reports through the existing
  manifest path; no fallback pool is used for slots 4 or 5.
- The project keeps its current audio controls: master/SFX volume, mute,
  user-gesture unlock, pause/resume, visibility handling, and disposal.

The exact ffmpeg transforms used to make the files were:

```text
carrion-auto-rifle.wav: highpass=92, lowpass=9800, compressor(threshold=-18dB, ratio=3, attack=3ms, release=45ms), volume=.78, fade-out 0.15s/0.07s, trim .22s, mono 44.1kHz PCM16
mourning-marksman.wav: highpass=36, lowpass=6700, compressor(threshold=-20dB, ratio=3, attack=4ms, release=70ms), volume=.82, fade-out 0.31s/0.16s, trim .48s, mono 44.1kHz PCM16
```
