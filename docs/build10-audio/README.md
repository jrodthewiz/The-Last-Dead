# Build 10 audio pass

This handoff tightens the sampled and procedural mix without changing the game's audio lifecycle. The runtime still unlocks on a user gesture, keeps separate `sfx`, `ui`, `ambience`, `voice`, and `music` groups, pauses/resumes the AudioContext with the game, limits active voices, and stops the single ambience source on cleanup.

## Workflow ledger

- Loaded `C:/Users/wolfk/.codex/skills/threejs-audio-generator/SKILL.md`.
- Loaded `C:/Users/wolfk/.codex/skills/threejs-audio-generator/references/audio-workflows.md`.
- Safe credential probe: `TRIPO_API_KEY=MISSING`, `GEMINI_API_KEY=MISSING`, `ELEVENLABS_API_KEY=MISSING`.
- No provider generation was attempted. The new stems are local trims, filters, fades, and level changes derived from the project's documented CC0 sources in [audio-sources.md](../audio-sources.md).

## Mix changes

| Event | Runtime source | Identity layer |
| --- | --- | --- |
| Ossuary fire | `processed/ossuary-shot.wav` plus CC0 fallback | short dry mechanical click and bright crack |
| Breach fire | `processed/breach-shot.wav` plus CC0 fallback | controlled sub body and filtered report |
| Arc Lance fire | `processed/arc-lance.wav` plus CC0 fallback | electrical sweep, high shimmer, narrow noise |
| Reliquary launch | `processed/reliquary-launch.wav` plus CC0 fallback | low launch body and restrained exhaust |
| Hit / blood | `processed/impact-metal-flesh.wav`, `processed/blood-burst.wav` | enemy-kind-specific metal, wet, or heavy impact accent |
| Explosion | existing CC0 blast pool | low sub drop and bounded debris tail |
| Creature attack / death | existing enemy samples | stalker, caster, and brute frequency signatures |

The processed stems are deliberately short (0.17–0.54 seconds), mono 48 kHz PCM WAV files. Their filters and fades keep rapid weapon attacks from carrying the previous long tails into the next shot. The procedural accents are low-level layers, so the existing limiter and group headroom remain the final mix owners.

## Verification

- `tests/build10-audio.mjs` checks all six processed files, browser decode, manifest count, load errors, and finite non-silent procedural output for all four weapons plus three creature kinds.
- `docs/build10-audio/audio-runtime.json` is the browser evidence file when the test is run against the latest `dist` build.
- Historical Build 07 audio evidence remains in `docs/build07/audio-signal.json`; the new measurement is kept separately.
- A full built-game smoke remains the release owner's final check for real combat timing and browser lifecycle behavior.

This pass improves source identity and mix readability. It does not claim AAA audio certification or exact parity with another game.