# Focused map and weapon pass — 2026-09-23

Three runtime files changed for this pass; existing unrelated work was preserved.

- `world-authored.js`: floor-specific tunnel signals; foundry and surgical frame finishes; recessed rib joints; flush threshold edge strips; attached lamp housings. Existing light count, collision, progression, and static batching are retained.
- `weapon-materials.js`: clearer material separation, restrained reflections, and broad position-based vertex wear across the four existing weapons.
- `weapon-detail-pass.js`: fine-detail reflection and clearcoat response matches the main weapon surfaces. No added weapon meshes, textures, or animation changes.

Verification uses the existing checks and an isolated headless browser. The user's existing game tab and source server were kept intact.

- `npm.cmd run build`: passed.
- `node --test tests/dungeon-art.test.mjs tests/world-static.test.mjs`: 7 passed, including layout preservation on all five Story floors and static batching.
- `node --test tests/build08-weapons.test.mjs tests/weapon-batching.test.mjs`: 5 passed, including all four factories, finite animation transforms, and geometry budgets.
- `git diff --check -- weapon-detail-pass.js weapon-materials.js world-authored.js`: passed.
- Browser: all four weapons switched and fired via keyboard/mouse input. Final desktop and narrow viewport screenshots inspected. No page/HTTP errors; sampled canvas pixels are nonblank.
- First-floor fixed view: 200 → 203 draw calls, 299,008 → 299,184 triangles, 61 → 61 textures. These are renderer counts, not a sustained frame-rate benchmark.
- All five Story entry views captured. The fifth-floor startup exceeded the initial 60-second timeout in the sequential run, then passed in a fresh browser with no page/HTTP errors and nonblank canvas evidence. No game change was needed for that retry.

Evidence: [map smoke report](../.codex-temp/coherence-qa/after-report.json), [fifth-floor retry](../.codex-temp/coherence-qa/fifth-report.json), [final weapon smoke report](../.codex-temp/coherence-qa/weapons-report.json), [foundry before](../.codex-temp/coherence-qa/before-floor-0.png), [foundry after](../.codex-temp/coherence-qa/weapons-floor-0.png), [weapon view](../.codex-temp/coherence-qa/weapon-3.png), [narrow viewport](../.codex-temp/coherence-qa/after-mobile.png).

Skills/references: Game Director and its core sibling skills loaded; graphics model/render recipes, implementation blueprint, visual scorecard, material/model/performance checklists, and QA/visual verification references used. Execution was limited to existing map/weapon visuals and focused QA, as requested. Existing assets were reused; no new generation or gameplay systems were introduced. This is not a full campaign playthrough or performance soak.
