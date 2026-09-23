# Dead Arrival asset ledger

This staging folder owns the first visual and audio handoff for the industrial gothic arena FPS. The game runs offline from bundled assets. Its current audio runtime loads local samples after an interaction gesture and stays silent if a file is missing or cannot decode; it no longer synthesizes combat-event fallbacks.

## Skill and reference ledger

Loaded before this phase:

| Item | Status | Path |
| --- | --- | --- |
| Game director | loaded | `C:/Users/wolfk/.codex/skills/threejs-game-director/SKILL.md` |
| 3D generator | loaded | `C:/Users/wolfk/.codex/skills/threejs-3d-generator/SKILL.md` |
| Image generator | loaded | `C:/Users/wolfk/.codex/skills/threejs-image-generator/SKILL.md` |
| Audio generator | loaded | `C:/Users/wolfk/.codex/skills/threejs-audio-generator/SKILL.md` |
| Tripo API notes | loaded | `C:/Users/wolfk/.codex/skills/threejs-3d-generator/references/api-notes.md` |
| Three.js integration | loaded | `C:/Users/wolfk/.codex/skills/threejs-3d-generator/references/threejs-integration.md` |
| Image pairing workflows | loaded | `C:/Users/wolfk/.codex/skills/threejs-3d-generator/references/image-generator-workflows.md` |
| Audio workflows | loaded | `C:/Users/wolfk/.codex/skills/threejs-audio-generator/references/audio-workflows.md` |

The director credential probe was run through Git Bash. It prints no secrets; the literal shell output was:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

Those empty markers mean all three provider credentials are missing in the sourced profile. The audio script's own safe probe reported `ELEVENLABS_API_KEY=MISSING`.

## External generation attempts and blockers

The required provider attempts were made from `deadarrival/`:

```text
uv run .../threejs-image-generator/scripts/generate_image.py ... --filename assets/textures/dead-arrival-industrial-flesh-metal.png --resolution 2K
Error: No API key provided. Provide --api-key or set GEMINI_API_KEY.

python .../threejs-3d-generator/scripts/threejs_3d_asset.py text ... --out-dir assets/models/revenant
threejs_3d_asset.py: Missing API key. Set TRIPO_API_KEY or pass --api-key.

python .../threejs-audio-generator/scripts/threejs_audio_asset.py probe
ELEVENLABS_API_KEY=MISSING

python .../threejs-audio-generator/scripts/threejs_audio_asset.py sfx ... weapon-hand-cannon.mp3
threejs_audio_asset.py: Missing API key. Set ELEVENLABS_API_KEY or pass --api-key.

python .../threejs-audio-generator/scripts/threejs_audio_asset.py sfx ... --loop ... bloodworks-loop.mp3
threejs_audio_asset.py: Missing API key. Set ELEVENLABS_API_KEY or pass --api-key.
```

Because the Gemini attempt was blocked by its missing key, the built-in image generation tool was used as the permitted fallback. It produced a square, high-detail material image which was copied into the project. No provider key or client secret is stored in this repository.

## Visual asset

| Asset | Source | Use |
| --- | --- | --- |
| [`assets/textures/dead-arrival-industrial-flesh-metal.png`](../assets/textures/dead-arrival-industrial-flesh-metal.png) | Built-in image generation fallback after Gemini blocker | Wall/cover/weapon-surface albedo reference: oxidized gunmetal, blackened steel, torn sinew, wet crimson smears, rivets and surgical scoring |

Generation prompt:

> Seamless tileable game material reference for an industrial gothic horror FPS bloodworks: worn oxidized gunmetal, blackened steel, torn dark sinew and wet crimson blood smears, rivets and surgical scoring, PBR-friendly albedo, roughness variation, orthographic top-down, no perspective, no text, no logos, no strong baked shadows, moody charcoal and deep red palette, high-detail 2K texture sheet.

Renderer handoff: treat the image as an sRGB albedo reference or direct albedo map. Keep the repeated wall material around `metalness 0.55–0.75` and `roughness 0.68–0.9`; derive a subtle procedural normal and blood wetness mask from the same UVs so the material remains readable under the renderer's red practical lights. The image is intentionally free of text and logos and can be tiled on the wide hallway modules.

The Tripo hero enemy attempt was blocked before a task ID could be issued. The intended future prompt is a fused rusted-plate and exposed-sinew revenant with a readable silhouette and PBR materials; keep the collision proxy separate from the detailed model when a key is available.

## Audio matrix

| Event | Current bundled sample | Group |
| --- | --- | --- |
| Weapon shots | Weapon-specific pools in `assets/audio-manifest.js` | `sfx` |
| Hit / enemy impact | Kenney impact recordings plus CC0 bullet-hit sample | `sfx` |
| Blood / gore | Kenney slime sample plus CC0 splat sample | `sfx` |
| Creature attack / moan | 24 CC0 zombie one-shots | `sfx` |
| Movement / parry / UI | Bundled CC0 and Kenney sample pools | `sfx` / `ui` |
| Arena ambience / music | Bundled CC0 loops | `ambience` / `music` |

`assets/audio.js` exports `AudioSystem` and `AUDIO_ASSET_MANIFEST`. It implements the required `async unlock()`, `setVolume(v)`, `setMuted(bool)`, `pause()`, `resume()`, `play(type, weapon = 0)`, and `dispose()` methods. The constructor does not resume audio or start ambience. Call `unlock()` from the title-screen pointer/key gesture, then start ambience explicitly:

```js
import { AudioSystem } from './assets/audio.js';

const audio = new AudioSystem({ volume: 0.8 });
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
// after the player enters the arena:
await audio.unlock();
audio.play('ambience');

// Engine event mapping:
// shot -> audio.play('shot', run.weapon)
// hit / kill / damage / parry / dash / jump / slam / coin -> matching names
```

Loads are best effort and caught individually, so a missing file never blocks scene startup. Web Audio pause/resume is wired to the game pause state; `setMuted` and `setVolume` affect all groups through the master gain. Missing or undecodable samples are reported through `debugInfo.errors` and remain silent.

## Remaining asset work

The next visual pass should derive normal/roughness/height variants from the material image or replace it with a provider-produced PBR set, then add the Tripo revenant GLB and inspect its bounds, triangle count, material count and pivot before shipping. Audio source and license details live in [audio-sources.md](audio-sources.md).
