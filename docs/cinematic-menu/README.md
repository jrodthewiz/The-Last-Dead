# The watching ward — cinematic home screen

The home screen now renders a live Three.js ward using the game's Ash Witness model, institutional surfaces, wheelchair, and mourning cabinet. Three figures hold eye contact with the camera; their independently animated heads respond gently to pointer movement. The close figure has directional face lighting, while two more figures recede into cold and red light. The typography and navigation occupy the dark left side on desktop and recompose below the face on phones.

## Goal and visual acceptance

- **In-game rendering:** real geometry, game textures, and three instances of the shipped animated character; no replacement background illustration or video.
- **Cinematic horror:** slow camera drift and breathing, layered silhouettes, restrained suspended dust, shadowed faces, and a distant red practical light. No strobing or sudden jump cuts.
- **Direct gaze:** all three head orientations track the camera with a small pointer offset. Browser checks measure alignment above 0.99 and confirm the pose responds to pointer motion.
- **Usable home screen:** start, co-op, settings, and controls remain accessible. Both the in-game and operating-system reduced-motion preferences freeze camera and figure movement.

Visual review covered `desktop.png`, `laptop.png`, `tablet.png`, `mobile.png`, `small-phone.png`, `landscape.png`, and `gaze-right.png`. `before.png` preserves the former static title screen. The home scene's materials, camera, animation mixers, and geometry belong to the menu and do not change the playable world.

## Verification

Run `npm run build`, then `node tests/cinematic-menu.mjs` with `PLAYWRIGHT_PATH` and `CHROME_PATH` set when needed. The test serves the production build on an ephemeral local port, opens an independent browser, and writes `qa-results.json`. Set `MENU_SUSTAINED_SECONDS=120` for the sustained gameplay and return-to-title check.

The browser checks cover six viewport sizes (1536×864, 1366×768, 768×1024, 390×844, 320×640, and 844×390), text fit, 44px controls, pointer tracking, settings and co-op panels, reduced motion, canvas pixel range, entering the game, movement, firing, and returning to the same three title figures. Console and asset errors are captured. The scene uses approximately 155 draw calls and 86,000 triangles on desktop, with a single 1024px shadow map. Mobile checks are Chrome emulation, not measurements on a physical phone.

## Reference ledger

All references loaded successfully from the local Codex skills:

- `threejs-game-ui-designer/references/ui-patterns.md`
- `threejs-game-ui-designer/references/checklists/{game-ui-quality,hud-readability,responsive-ui-fit,mobile-input}.md`
- `threejs-qa-release/references/qa-release-checklists.md`
- `threejs-qa-release/references/checklists/{visual-verification,playtest-qa,release}.md`
- `threejs-aaa-graphics-builder/references/checklists/{material-lighting-quality,performance-safe-visual-detail}.md`

Existing game assets were reused. No new generation request, external texture, or audio asset was needed. The user's original game tab and port 5200 server were left running.
