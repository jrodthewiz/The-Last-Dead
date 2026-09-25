# Bloodworks Warden motion pass

The shipped Warden uses six headless Blender clips: idle, walk, windup,
strike, hit, and collapse. The same rig serves the normal, Bulwark, and
Colossus Warden variants. The GLB has one skinned mesh, 24 joints, and no
runtime compression decoder requirement. The game still owns movement,
collision, damage timing, and the attack telegraph.

The [12 frame Blender sheet](warden-v02-sheet.png) shows the pose sequence.
Chrome captures from the actual runtime GLB are `warden-runtime-*.png`.
`warden-motion-validation.json` records measured rig movement, and
`warden-browser-check.json` records browser load and render checks.
`warden-in-game.json` verifies the production build's actual enemy renderer:
all three Warden variants select the Bloodworks GLB, and walk, windup,
strike, hit, and collapse give weight to the corresponding authored clip.

Authoring source: `../../art/meshy-menu-warden/TLD_Bloodworks_Warden_Animation_Source_v02.blend`.
Rebuild script: `../../scripts/warden-motion-blender.py`. Export to a temporary
GLB first, inspect the sheet, then replace `../../assets/models/bloodworks-warden.glb`.
Validate the source with `../../scripts/warden-motion-validate.py`. The Node
contract check is `../../tests/warden-motion.test.mjs`; the browser check is
`../../tests/warden-motion-browser.mjs` and accepts `PLAYWRIGHT_PATH`,
`CHROME_PATH`, and `GAME_URL` overrides. The browser check uses a separate
headless Chrome page and leaves the existing game tab and server intact.
`../../tests/warden-in-game.mjs` starts an isolated production preview and
uses a live campaign enemy record to exercise the Warden renderer branch.

This pass targets the Bloodworks Warden rig. Ash Witness already has a
six clip Blender animation set; the survivor based caster and procedural
Bellwraith have different animation systems.
