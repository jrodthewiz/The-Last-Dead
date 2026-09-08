# Build 07 / Foundry polish

This iteration improves The Last Dead's surfaces, architecture, sound mix and responsive interface. It remains a stylized development build, not AAA-certified or full ULTRAKILL parity.

## Changes

- Generated a new iron-and-stone wall material, integrated as a 250 KB WebP with restrained bump relief.
- Added vaulted ceiling bays, perimeter supports, clerestory details, drainage strips, and cover fittings derived from each sector's actual layout.
- Added aged bone, grime, cavities and worn metal to the Ossuary, Reliquary and Bellwraith. Shared texture ownership prevents one enemy's cleanup from invalidating another's maps.
- Batched static world geometry by material while preserving animated organs, gates and instanced effects. Sample draw calls fell from 253 to 152; active hardware frame rate remained around 35-41 FPS in the measured scenarios.
- Added bounded adaptive drawing resolution (75-100% scale) with hysteresis, while HTML HUD text stays sharp. Diagnostics now run twice per second instead of traversing the scene every frame.
- Refined HUD hierarchy and weapon state labels. Moved portrait mobile status readouts above the touch controls and reduced weapon obstruction.
- Added sound-specific filtering, group headroom, a master compressor, no-repeat sample selection, enemy-aware cooldowns and bounded sample voices. Fixed a missing sample-to-gain connection found during output testing. Mute now reaches zero even while audio is suspended.

## Audio evidence

All 25 bundled CC0 source files decode and all 35 manifest entries load. Ten independently rendered sound events produce finite, non-silent waveforms: shot, footstep, jump, land, enemy attack, death, explosion, slide, hook and sector transition. Isolated peaks range approximately 0.011-0.342. These measurements prove signal routing, not a subjective listening review. See [audio-signal.json](build07/audio-signal.json) and [source licenses](audio-sources.md).

Chrome verifies mute, pause, resume and exactly one ambience source after repeated start requests. Every sound remains local; no API key or generation service is needed to play.

## Verification

- Production build and explicit runtime-module serving checks pass.
- World batching checks preserve bounds, triangle counts, material roles, protected animation roots and instanced meshes across all three sectors.
- Engine, campaign, weapon and model regressions pass.
- Built-game desktop/mobile pass: pointer lock, real rocket firing and explosion shaders, audio decode/output/lifecycle, and all sector worlds. No page or console errors.
- A two-minute real keyboard/mouse journey recorded three kills and working pause/resume. The test did not complete the campaign; simulation campaign completion remains covered separately. The first-pass mute assertion failed and was fixed; its journey evidence is retained in build07/journey-first-pass.json.
- Final mobile fit evidence is in build07/mobile-fit.json. Screenshots include mobile-390-final.png and mobile-320-final.png.
- Hardware backend: Chrome ANGLE D3D11 on NVIDIA GeForce GTX 1650, 1280x800. Baseline 36.93 FPS, 253 calls. Initial batched scene 34.92 FPS, 152 calls. Final 30-second controlled run averaged 40.63 FPS (sampled 31-55); these scenarios differ in enemy state and are not a claim of a fixed percentage FPS gain.

## Skill-loading ledger

Loaded from C:/Users/wolfk/.codex/skills: threejs-game-director, threejs-gameplay-systems, threejs-aaa-graphics-builder, threejs-game-ui-designer, threejs-debug-profiler, threejs-qa-release, threejs-3d-generator, threejs-image-generator and threejs-audio-generator. The texture worker also loaded the built-in imagegen skill.

## Reference ledger

Graphics: visual-scorecard, implementation-blueprint, model-recipes, render-recipes, aaa-game-quality-gate and aaa-visual-scorecard loaded. Debug/profile: debug-profile-checklists and performance-profile loaded. QA/release: qa-release-checklists, visual-verification, playtest-qa and release loaded. UI: ui-patterns, game-ui-quality, hud-readability and responsive-ui-fit loaded by the UI worker. Audio: audio-workflows loaded by the audio worker. No physics/controller rewrite or provider 3D API operation was performed in this pass.

## External asset sourcing

Credential probe output from the packaged bash script on Windows was inconclusive (empty values):

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

This is recorded as a probe portability issue, not proof that credentials are unavailable. No new provider 3D or ElevenLabs request was needed for this iteration of existing assets.

- Hero/player: preserve the existing referenced survivor model and articulation.
- Enemies/weapons: hybrid generated concept references plus procedural animated factories; preserve imported assets/models/evil-warden.glb. Refine existing hero surfaces in this pass.
- Signature props/pickups: procedural kit and existing coin/exit effects.
- World/sky/background: authored enclosed vault and generated assets/textures/crypt-wall-albedo.webp; the existing generated menu plate remains.
- Materials/textures/decals: generated wall albedo plus deterministic floor/weapon wear and shared material roles.
- Logos/icons/GUI art: existing identity with code-authored brass/scarlet registration marks and responsive state layout.
- Chosen sources: hybrid image generator + authored geometry/materials. 3D generator and image generator skills loaded; no new 3D task submitted. New external visual output is documented in build07-texture.md.
- Audio generator skill loaded; chosen sources are existing licensed samples plus synthesized fallback and revised mixing. No new audio generation was submitted.

## Phase ledger

| Phase | Outcome |
| --- | --- |
| Gameplay systems | Existing movement/combat preserved; real-input and simulation regressions verified |
| AAA graphics direction | Materials and architectural detail improved; premium quality gate remains below threshold |
| UI | State labels and mobile overlap repaired; responsive evidence recorded |
| Debug/profile | Static batching, resource ownership, lower-frequency diagnostics and adaptive resolution implemented; D3D11 measured |
| Audio | Signal path, event matrix, mix headroom, voice limits and lifecycle verified |
| QA/release | Built-game browser checks, source tests, asset/source review and deployment checks |

## Visual scorecard

Scores use the skill's 0-3 rubric and active-play screenshots.

| Category | Before | After | Evidence / limit |
| --- | --- | --- | --- |
| Art direction | 1 | 2 | Bone, iron, stone and scarlet now span world, weapons and HUD |
| Hero/player | 1 | 2 | Authored first-person weapons with surface wear and animation |
| Obstacles/enemies | 2 | 2 | Existing enemy families, readable variants and textured Bellwraith |
| Rewards/interactables | 1 | 1 | Coin and exit still need a dedicated model/feedback refinement |
| World/environment | 1 | 2 | Layered vault/support/drain kit; arena massing remains repetitive |
| Materials/textures | 1 | 2 | Generated panel texture, relief, deterministic wear and shared maps |
| Lighting/render | 1 | 2 | Intentional exposure, practical signals, tighter shadows and depth |
| VFX/motion | 2 | 2 | Verified pooled rockets, fire, smoke, shockwaves, recoil and blood |
| UI/HUD | 1 | 2 | Consistent state hierarchy and separated mobile touch/status areas |
| Performance evidence | 2 | 3 | Hardware baseline/post counts and bounded adaptive resolution |

Average: 1.3 before / 2.0 after. Automatic failures remaining: repeated box-like arena cover still dominates portions of the active view; rewards lack the authored variety required by the premium gate. The all-categories-at-least-2 / average-2.3 premium threshold is not met. Next visual work should focus on sculpted cover silhouettes, more distinctive sector landmarks and the coin/exit interaction assets. No AAA completion claim is made.

Canvas screenshot pixel evidence: nonblank RGB ranges and variance are recorded in build07/pixel-evidence.json. Page error and console error arrays are empty in the final built-browser report. Real audio asset evidence includes assets/audio/ambience/ossuary-dungeon.ogg and assets/audio/sfx/cc0-gunshot.mp3, with independent signal RMS checks in build07/audio-signal.json. Final source regression suite: 29/29 passed.
