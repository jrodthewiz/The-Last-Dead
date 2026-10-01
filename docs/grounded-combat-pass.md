# Grounded combat iteration — 2026-09-29

The first-person pass gives Carrion a continuous receiver, stock and handguard, practical sights, dark steel and worn wood. The starting Ossuary now reads as a steel revolver with a centered cylinder, barrel shroud, top strap, hammer and wood/rubber grip. Its old bone ornament and glowing overlay are removed. The remaining weapons keep their established silhouettes.

`weapon-presentation.js` supplies distinct recoil/recovery and draw timing, turn inertia, acceleration/stopping drag, landing settle, aiming stabilization and reduced motion. Hands follow the held assembly; the trigger finger articulates without moving its grip socket. Existing weapon mechanisms and authoritative shooting remain in control of cadence and damage.

## Rapid review

Open <http://127.0.0.1:5200/combat-review.html>. Select any weapon, repeat firing/turning/walking/landing/aiming, slow time, pause, replay drawing, and compare bodycam/reduced motion. It uses the real renderer and firing path in a repeatable fixture. This development page is excluded from the production build. The existing game tab and server are preserved; refresh the game to load changes.

## Zombie motion

The shipped character uses `assets/models/afterlife-ash-witness-motion-v04.glb` (2,681,432 bytes, 27,512 triangles, 24 joints). Its mesh, textures, material data and inverse bind matrices are preserved byte-for-byte. Fresh source poses required world-space bind corrections of up to 120 degrees; copying named bone tracks directly would have distorted the character.

The runtime contains the existing idle plus captured walking, running, attack, hit reaction and backwards death. Measured stride lengths control foot cadence; attack contact remains at 0.375 seconds. The captured attack/death replace the old additional whole-body lunge/tip. Headless Blender produced a 16-frame proof sheet of the actual character, and skin bounds were measured during conversion.

Exactly **23 approved Meshy credits** were used: 5 for a replacement rig and 18 for six motions. Rig task `01a0ec1c-9581-709a-89c1-ee91a298163b`; animation task `01a0ec1d-f490-7469-a54c-ff73f6434d23`. The acquired mummy stagger and scream are archived for later encounter acting; they are not yet triggered in the game. The rig's included run is used for chasing. Source motions and billing journals are preserved under ignored `.art-source/enemy-motion-v04`; no service calls are made at runtime.

The workflow follows the [Meshy rigging API](https://docs.meshy.ai/en/api/rigging), [animation API](https://docs.meshy.ai/en/api/animation) and [animation catalog](https://docs.meshy.ai/en/api/animation-library). Offline authoring scripts are `scripts/meshy-zombie-motion.mjs`, `scripts/retarget-zombie-motion.mjs` and `scripts/review-zombie-motion.py`. The retarget tool accepts `GLTF_TRANSFORM_PATH` for a separately installed authoring toolchain. Runtime/build still need only Node and bundled assets.

## Validation

- 51 engine, enemy AI, firearm model/mechanism/batching and presentation checks passed. Presentation checks cover 30/60/120 Hz, switching, pause/teleport reset, repeat shots, landing, reduced motion and stable sockets.
- 21 focused enemy animation/contact/reaction checks passed, plus `scripts/afterlife-character-runtime-check.mjs`.
- `npm.cmd run build` passed.
- `tests/combat-motion-browser.mjs` passed: all eight weapons render, repeat firing drives the actual shot path, motion responses differ, desktop/390px portrait fit, bodycam toggle and reduced motion work, no browser errors.
- Production `tests/rifle-game.mjs` passed: four original slots switch/fire, automatic shots and three-round burst work, charge cancellation and charged fire work, casings/audio load, portrait layout fits, no browser errors. Its fixture now explicitly owns the weapons it tests.
- Production chase/contact checks passed for stalker, skitter and bloodhound, each at 0.375 seconds; bullet hits, settled blood and portrait rendering also passed. Its fixture now uses the current map spawn with a clear-path assertion rather than stale hardcoded coordinates behind revised walls. The 120-second playtest completed nine input cycles and returned to the menu successfully, with zero browser or HTTP errors. Evidence: `output/playwright/grounded-chase/qa-results.json` and screenshots.

Browser evidence: `output/playwright/combat-motion/` contains screenshots, a recording and `report.json`; `output/playwright/grounded-weapons/` contains production firing evidence. Zombie pose sheet: `.codex-temp/enemy-motion/review/contact-sheet.png`.

The scoped visual review accepts the improved silhouettes, material separation, attached grips and readable motion. This remains a procedural demo weapon set, with stylized hands and other occult weapons still present. No new reload system or animation was added. Browser draw-call/triangle counts include the room and transient effects, so they are not isolated weapon cost or a GPU frame-time benchmark.

## Skill reference ledger

All applicable references were loaded: gameplay workflows; graphics implementation blueprint, model/render recipes and visual scorecards; 3D API/integration notes; QA release checklist, visual verification, playtest and release checklists. Focused weapon art, handling and enemy pipeline work were delegated as directed by the game-director skill. Existing audio was retained. External asset sourcing was used for zombie motion; existing local material sources and authored geometry were used for the firearms. No new paid weapon mesh or texture generation was necessary.
