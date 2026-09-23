# Forsaken Afterlife — implemented art direction

The game now uses localized cold light, damp neutral surfaces, low ankle mist, and pale human enemies. This is an in-engine art iteration using the approved concept; the concept paintover itself is not used as a screenshot of the result.

## Changed behavior

- `renderer.js` integrates all four afterlife systems, neutral light balance, asset warmup, diagnostics, and disposal. Existing user work in this file was preserved.
- `afterlife-lighting.js` replaces the global colored wash with a cold portable light and six recycled practical lights. Only the lantern's 512px shadow updates during play; the directional shadow remains cached. Light count stays bounded as levels grow.
- `afterlife-surfaces.js` and `room-materials.js` apply worn neutral surfaces once before batching, retain objective cues, soften the red floor grid, and vary damp roughness. Per-world material clones preserve shared textures and source material ownership.
- `afterlife-atmosphere.js` uses deterministic room placement, sparse camera-facing ankle wisps, and small dust specks. Two pooled draws; no fullscreen fog overlay or hard triangular light cones. Reduced-motion and mobile budgets are supported.
- `npc-afterlife.js` reuses the existing survivor GLB for small melee/caster enemies: desaturated pale faces, black sockets, dark clothes, leaning posture, different caster silhouette, and the existing attack/death lifecycle. Larger enemy families keep their identities.
- `assets/textures/afterlife-plaster-v1.png` is a new built-in ImageGen material used by the world wall loader. Its prompt is recorded in `imagegen-prompt.txt`.
- `build.mjs` packages the new runtime modules. Game rules, collision, and map layouts were not edited for this iteration.

## Skill-loading ledger

Loaded guidance: `threejs-game-director`, gameplay systems, AAA graphics builder, UI designer, debug/profile, QA/release, 3D generator, image generator, and built-in `imagegen`. The director's delegation instruction was followed for surfaces, enemies, and atmosphere; integration, lighting, and browser QA were handled in the main task. These were loaded skill files, not slash-command invocations.

## Reference ledger

- Graphics: implementation blueprint, render recipes, model recipes, visual scorecard, material/lighting quality, performance-safe visual detail.
- QA/release: QA release checklists, visual verification, playtest QA, release checklist.
- Debug/profile: debug/profile checklists.
- Source direction: `../artstyle-experiments-2026-09-23/afterlife-references.md`, the inspected Sony stills, and `07-forsaken-afterlife.png`.
- No new external 3D provider request, audio generation, UI redesign, physics change, or deployment was needed. Their provider-specific references were not treated as executed phases.

## External asset sourcing

Chosen sources: hybrid reuse and one generated runtime material. The imported survivor rig at `assets/survivor/tld-survivor-v02.glb` supplies the high-value human silhouette and animations. Existing authored weapon models, floor kits, and PBR textures remain in use. Built-in ImageGen generated the plaster scan (`exec-586c0a97-00cc-40a2-a406-9e3b8f1f3ebc.png`), copied into the repo at `assets/textures/afterlife-plaster-v1.png`. The selected visual concept was also generated with built-in ImageGen in the previous art experiment pass.

No new Tripo/Gemini API operation was attempted, and no credential availability claim is made. A new 3D enemy generation was unnecessary for this iteration because the repository already contains a compatible authored human rig with walking/running clips. Existing sound design is retained; no audio quality upgrade is claimed.

## Phase ledger

| Phase | Result |
|---|---|
| Art direction | Selected Forsaken Afterlife reference translated into real rendering changes |
| Gameplay systems | Existing mechanics retained; movement, firing, telegraphs and pause/resume checked |
| AAA graphics guidance | Applied to material, lighting, asset reuse and bounded effects; no AAA fidelity claim |
| UI | HUD retained and inspected at desktop/mobile widths |
| Debug/profile | Console, assets, canvas pixels, renderer counts and frame samples recorded |
| QA/release | Unit/engine regressions and separate browser gameplay passes; local production build checked |

## Verification evidence

- `node --test engine.test.mjs tests/dungeon-art.test.mjs tests/world-static.test.mjs tests/afterlife-atmosphere.test.mjs tests/afterlife-surfaces.test.mjs`: 31 passing checks at the first integration gate.
- `node --test tests/afterlife-lighting.test.mjs tests/afterlife-enemy.test.mjs tests/afterlife-surfaces.test.mjs tests/afterlife-atmosphere.test.mjs`: 6 passing checks, including bounded light replacement, shared material exclusions, and correct attack countdowns.
- `node build.mjs`: successful. New modules and bundled texture included.
- `tests/afterlife-game.mjs`: separate headless Chrome, through the repository's local Playwright QA workflow. Covers all five dungeon floors and all three campaign areas, movement, all four guns, pause/resume, restart, natural human-enemy spawns, canvas pixel variance, and mobile resize. Source URL: `http://127.0.0.1:5200/`. Production build URL: `http://127.0.0.1:5200/dist/`.
- Evidence: `qa-results.json`, `catacombs-afterlife.png`, all eight scene screenshots, `active-play.png`, and `mobile.png`. The comparison and floor overview screenshots use a paused simulation camera fixture; `active-play.png` is captured during the live loop.
- No original user game tab was navigated or closed. The existing port 5200 server was reused.

The final Catacombs comparison records 232 render calls, 396,252 rendered triangles, two human enemies, 21 mist wisps and two atmospheric draws at 1536×864/DPR 1. A 180-frame live sample measured 16.7 ms median / 16.8 ms p95. The existing sustained-play harness also ran for 120.3 seconds against the production build with real movement/attack input and assisted aiming. Its longer-run FPS median was 56.1 with a 15.9 minimum sample (other browser capture work overlapped part of the run); this is not a locked-60 claim. There were no console/page errors or failed HTTP requests. See `sustained/qa-sustained.json`.

The first attempt at that older harness timed out taking its menu screenshot during warmup. Waiting for renderer readiness resolved the capture failure. Its optional Sharp pixel-statistics helper also reported an unavailable statistic; canvas pixel variance was independently checked by the newer eight-scene harness, so no decoded-PNG statistics are claimed from the older harness.

## Visual assessment and limits

Art direction, materials/textures, lighting/render, obstacles/enemies and VFX/motion have a coherent afterlife treatment. Hero/player and UI/HUD keep the established game identity; rewards/interactables retain their gameplay signals. World/environment still uses the existing procedural building silhouettes. Those broad, simple architectural forms remain a visible fidelity limit, so this iteration is not presented as movie-level photorealism or an AAA replacement of every asset.

Internal visual scorecard (0–3): art direction 2, hero/player 2, obstacles/enemies 2, rewards/interactables 1, world/environment 1, materials/textures 2, lighting/render 2, VFX/motion 2, UI/HUD 2, performance evidence 2; average 1.8. Automatic failures remaining for a *premium/AAA* claim: broad primitive architecture and simple collectible silhouettes. The requested art-direction iteration is implemented; a full asset-fidelity rebuild was not part of this pass.

Performance evidence and final renderer counts are in `qa-results.json`. Desktop Chrome measurements are local evidence, not a guarantee for other GPUs. Mobile verification covers rendering/framing and resize; this art task did not add a complete touch-control QA pass. The study's sense of dread is translated through surfaces, silhouette and light; encounter pacing and audio were not rewritten.

Run the game at `http://127.0.0.1:5200/`, or go directly to `?dungeon=2` for the Catacombs. Controls remain WASD/mouse, Shift dash, Space jump, Ctrl slide, 1–4 weapons, F parry, E tether and Esc pause.
