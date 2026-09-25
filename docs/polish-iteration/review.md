# Light and HUD polish review

The new atmosphere layer uses one `THREE.Points` draw for fixture-bound glow and motes. It reuses course light anchors, adds no dynamic lights or texture upload, caps motes at 48 desktop / 18 mobile, and freezes them under reduced motion. Hanging entry cues without physical fixtures are excluded after a close screenshot exposed a floating glow.

The HUD now shows `run.kills` during play, shortens weapon and objective copy, and adds a low-opacity play-only scanline/vignette treatment. No full-screen postprocessing pass or render target was added.

Matched entry captures: [before F1](before/floor-1-entry.png), [after F1](final-map/floor-1-entry.png), [before F5](before/floor-5-entry.png), [after F5](final-map/floor-5-entry.png). Close checks: [F1 lamp](final/floor-1-fixture.png), [F5 ember](final/floor-5-fixture.png).

Measured entry draw calls: F1 183 → 184; F5 193 → 194. Triangle counts were unchanged in those matched views. The independent judge rated horror atmosphere 2/3, HUD clarity 3/3, restraint 3/3, cost 3/3; its caveat was that the particle and bodycam treatment are intentionally subtle in stills.

Verification: `node --test tests/afterlife-atmosphere.test.mjs`, `npm run build`, `node tests/map-look-qa.mjs` for F1/F5, and `node tests/polish-look-qa.mjs` for fixture screenshots and `KILLS 07` state all passed, with no page or HTTP errors. The older `tests/build08-ui-interactions.mjs` stops at its field-guide visibility assertion before its HUD checks; that menu behavior is outside this pass.
