# Audio v2 — combat weight and readable threats

The existing 128 decoded samples remain bundled. This revision corrects source
level mismatches, gives firearms more transient body, and leaves space for a
nearby attack. No generated audio, paid calls, new licensing, or runtime network
dependency was introduced. User master and group preferences remain unchanged.

## Measured problem and result

Carrion source files peaked at only −21.9 to −19.1 dBFS. Most pistol and shotgun
sources peaked around −2 dBFS. The old sample × group × master gains then
attenuated those already quiet automatic reports again. Their rendered 50ms
body energy was below both music and nearby zombie voices.

Measurements use Chromium's actual `OfflineAudioContext`, original decoded
buffers, runtime filters, real compressors, and a deterministic sample variant.
Numbers below are strongest 50ms RMS windows, in dBFS, at master 1.0. They are
signal measurements, not LUFS loudness claims or subjective listening scores.

| Event | Before | v2 | Difference |
| --- | ---: | ---: | ---: |
| Ossuary shot | −33.9 | −25.6 | +8.2 |
| Breach shot | −30.6 | −22.5 | +8.2 |
| Arc shot | −33.3 | −29.4 | +4.0 |
| Reliquary launch | −28.9 | −13.9 | +15.0 |
| Carrion shot | −43.4 | −17.8 | +25.6 |
| Mourning shot | −33.9 | −16.7 | +17.3 |
| Nearby attack | −20.2 | −15.4 | +4.8 |
| Attack at 12m | −35.6 | −29.7 | +5.9 |
| Room bed, first 4 seconds | −41.9 | −39.1 | +2.8 |
| Music, first 4 seconds | −35.0 | −37.1 | −2.1 |

The expanded overlapping combat fixture peaks at **−2.77 dBFS** (0.727), with
RMS **−19.70 dBFS** and 16.93dB crest factor. There are no clipped samples.
The game's default master setting of 0.5 is another **−6.02dB**, placing this
fixture's peak near **−8.79dBFS**. The compressor precedes user volume, so the
slider scales the finished mix without changing its compression behavior.

## Mix and event matrix

| Role | Runtime events / sources | Treatment |
| --- | --- | --- |
| Weapons | Six shot pools, mechanisms, rockets, saw | Dedicated weapon bus; modest 180Hz body shelf; source-specific calibration |
| Threats | Attack, death, moan, existing scream pools | Voice group, positional HRTF, distance filtering, nearby attack priority |
| Movement / impact | Steps, jumps, landing, melee and hits | Foley bus; short voice limits; brief threat ducking |
| Room | Three existing ambient beds with five presets | Continuous shared room tone; brief gunshot duck; two quiet early reflection taps for impacts |
| Music | Existing menu/play scores | Lower base level; combat and threat ducking |
| UI | Existing physical clicks, toggles, equip | Separate group, available during pause |

Graph: weapon/foley buses → user group gains → music/room duck gains → mix
compressor → 0.86 output headroom → user master gain → destination.

The compressor uses a −5dB threshold, 3dB knee, 16:1 ratio, 1ms attack and
120ms release. It controls overlapping peaks; it is not claimed as a strict
true-peak brickwall limiter. Two 37/79ms non-feedback reflections, lowpassed
at 3.4kHz, give weapon/metal reports a common room. They route through SFX
volume, so muting SFX also mutes its reflections.

Explicit sample trims are listed in `AUDIO_ASSET_TRIMS_DB`: +13/+16dB for the
three quiet Carrion files, +5/+7dB for Mourning, and +6dB for the launcher.
These change playback gain only; source files are preserved. Within a shot,
mechanism, attack, death, moan or footstep pool, variant matching is limited
to ±3dB using 50ms energy. Long ambience/music and unrelated event categories
are never normalized together. The old blanket tail-length RMS normalization
was removed.

A shot briefly lowers music to 0.58 and ambience to 0.78. A nearby attack
lowers weapons to 0.76, foley to 0.58 and music to 0.48. Automation uses the
audio clock and recovers automatically; pause resets it. At most three attack
voices compete. A far attack cannot replace nearer voices, and idle moans
yield during active attacks. Sources beyond their useful range are discarded.
Occluded and distant cues lose high frequencies without moving their position.

## Verification and iteration

`node tests/audio-v2-mix.mjs` decodes every manifest entry, renders each weapon,
checks distance contrast, renders a dense combat mix, tests real duck/release
curves, rejects low-priority voice admission, and measures master/SFX/voice
mute silence including room return. It uses a separate ephemeral server and
headless browser. Set `PLAYWRIGHT_PATH` and `CHROME_PATH` for local installations.

The checked-in baseline is `scripts/audio-v2-baseline.json`. Local before/after
reports and stereo 44.1kHz/16-bit PCM audition files are written under
`.codex-temp/audio-v2/`. The `--before` mode is for the locally preserved
pre-change runtime snapshot, not a fresh-checkout prerequisite. The two
existing `tests/melee-audio.test.mjs` lifecycle tests also pass.

`audio.mixDiagnostics()` (also `audio.debugInfo.mix`) exposes bus levels,
compressor reduction, source counts, rejected/stolen voices, duck events,
calibrated source count, and room tap count for browser QA.

Reference ledger: `threejs-audio-generator/SKILL.md` and its required
`references/audio-workflows.md` were read. No credential probe was needed:
this pass intentionally reuses the licensed, bundled library and makes no
provider request. New generated vocals/music are not part of this delivery.
