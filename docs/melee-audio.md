# Melee audio pass

The bat and chainsaw use sampled assets under `assets/audio/melee/`. The
runtime keeps the impact cues event driven and gives the chainsaw exactly one
engine loop plus one optional cutting loop, so a held trigger cannot create a
new audio source every frame.

## Audio matrix

| Event | Runtime pool | Duration | Loop | Use |
| --- | --- | ---: | --- | --- |
| `bat-swing` | `bat-swing-01.ogg`, `bat-swing-02.ogg` | 0.19 / 0.20 s | no | Bat wind-up and follow-through variants |
| `melee-hit` | bundled Kenney/CC0 heavy punch plus CC0 splat | 0.10–0.42 s | no | Bat flesh impact |
| `melee-wall` | bundled Kenney/CC0 medium metal impacts | 0.10–0.30 s | no | Bat wall or weapon collision |
| chainsaw start | `chainsaw-start.ogg` | 1.50 s | no | Concise sampled pull/start burst |
| chainsaw motor | `chainsaw-idle.ogg` | 7.00 s | yes | One engine bed; playback rate follows `rev` |
| chainsaw contact | `chainsaw-contact.ogg` | 4.50 s | yes | One optional cutting layer while `contact` is true |
| `chainsaw-hit` | `chainsaw-hit.ogg` | 0.42 s | no | Repeated flesh contact, cooldown protected |
| chainsaw wall | bundled Kenney/CC0 metal impacts | 0.10–0.30 s | no | Wall contact routed from `melee-wall` for weapon 7 |
| chainsaw stop | `chainsaw-stop.ogg` | 1.80 s | no | Sampled engine decay on release or weapon switch |

All runtime files are Vorbis OGG, mono for chainsaw layers and stereo for bat
swings. Existing audio group levels, master mute, pause, and page gesture
unlock continue to control these cues through the normal `sfx` group.

## Runtime contract

`AudioSystem.updateMelee({ weapon, active, rev, contact, playing })` is called
from the gameplay frame. `weapon === 7` owns the sustained layers. `rev` is a
0–1 value and controls engine playback rate and gain; `contact` starts and
stops only the single contact loop. The short pull-start source is tracked
separately and is cancelled if a player releases or switches away before it
finishes. Pause, death, menu, weapon switch, and dispose fade and stop the
motor/contact sources; pause, death, and dispose also suppress any pending
shutdown tail. A release plays one sampled shutdown tail while the context is
live. Bat audio remains one-shot through `play()`:

```js
audio.play('bat-swing', 6, event);
audio.play('melee-hit', 6, event);
audio.play('melee-wall', 6, event);
audio.play('chainsaw-hit', 7, event);
```

The existing `position` field is passed through the Web Audio panner when an
event is spatialized. `chainsaw-hit` uses a short dedicated contact file and
does not reuse the long motor recording.

## Provenance and processing

The ElevenLabs credential probe was run for this task and returned
`ELEVENLABS_API_KEY=MISSING` in the shell and Windows user environment, so no
generated audio was claimed or used. The actual sources are licensed CC0
recordings:

- Chainsaw start: Joseph Sardin, BigSoundBank sound 0982,
  <https://bigsoundbank.com/chainsaw-starting-s0982.html>.
- Chainsaw using/contact: Joseph Sardin, BigSoundBank sound 0983,
  <https://bigsoundbank.com/chainsaw-using-s0983.html>.
- Chainsaw stop: Joseph Sardin, BigSoundBank sound 0707,
  <https://bigsoundbank.com/chainsaw-2-s0707.html>.
- Bat swing variants: `Swishes Sound Pack` by artisticdude, OpenGameArt,
  CC0, <https://opengameart.org/content/swishes-sound-pack>.
- Bat/wall impact layers reuse the checked-in Kenney CC0 impact pack;
  license text is in `assets/audio/baseline/impact-LICENSE.txt`.

The original downloads are preserved in the ignored `.art-source/audio-incoming/melee/`
folder. FFmpeg trimmed the source recordings, converted them to game-ready
48 kHz/44.1 kHz Vorbis, applied short fades to avoid clicks, and normalized
the one-shot layers before import. No runtime oscillator or gunshot fallback
is used for the bat or chainsaw.

## Verification

- All seven new files exist under `assets/audio/melee/` and decode as Vorbis.
- The manifest has dedicated pools for bat swing, bat impact, chainsaw start,
  motor, contact, hit, wall, and stop.
- `updateMelee()` guards persistent source creation, crossfades gain on state
  changes, tracks startup/shutdown transients, and clears all melee sources on
  pause/dispose.
- Existing six weapon pools remain in the manifest; chainsaw index 7 cannot
  fall through to a rifle or pistol sample.
- Browser-level trigger and loop verification is owned by the parent gameplay
  pass after the melee render integration lands.
