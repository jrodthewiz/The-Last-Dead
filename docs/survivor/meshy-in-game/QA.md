# Meshy survivor with existing weapons

The new full-body character and textured sleeves are connected to the four current weapon groups. The existing weapon grip hands, muzzle sockets, primary/alternate attacks, damage, cooldowns, projectile logic, camera controls and simulation collision remain in use.

Implementation: `assets/survivor/meshy-survivor.js`, `assets/survivor/survivor-runtime.js`, and the renderer's resource preparation/disposal hooks. The runtime GLB lives in `assets/survivor/` so the standard build includes it. High-resolution art masters remain outside the build in `art/survivor-meshy/`.

The first-person instance hides the full model's head and arms. The remote instance keeps them. The body follows the simulation actor in metres (4 metres per simulation cell), retains independent yaw, strips horizontal root motion, blends idle/walk/run, adds jump/slide joint poses, and keeps soles grounded. The local upper jacket is shifted behind the eye for camera clearance. Textured view sleeves fit around the pre-existing posed hands; their hidden shoulder ends continue out of frame.

## Checks

- `tests/meshy-survivor-game.mjs`: isolated Chrome; real start, W movement, Space jump, Ctrl slide, weapon keys 1–4, mouse primary fire, arrow-key aiming, all four weapon and look-down views, slide and narrow-screen views, and 120 repeated paused pose updates without drift. Checks the new body source, all seven view sleeves, hidden duplicate arms/head, finite grip transforms and no page/HTTP errors.
- `tests/meshy-survivor.test.mjs`: root-motion removal preserves vertical bob and source clips; runtime sections, skinning, clips, non-emissive materials and size budget.
- Existing first-person fallback, weapon geometry/batching, hitscan/projectile/muzzle alignment, 20 engine tests and WebRTC two-context test.
- `npm run build`: succeeds and includes the runtime GLB and modules.

The standard `npm test` needs `PLAYWRIGHT_PATH` set to the installed package for the network test in this checkout. The network test passed with `C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright` and installed Chrome at `C:/Program Files (x86)/Google/Chrome/Application/chrome.exe`.

## Scope and remaining art work

This is playable with all existing weapons. Gripping hands use the established game hand poses; the generated model still has no independent finger or facial bones. A future bespoke hand rig would improve reload/finger animation, but is not required for the current weapon mechanics. The new character has no LOD chain yet. No paid generation or animation jobs were added during integration.

## Skill reference ledger

- Gameplay workflow: read `C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/references/gameplay-workflows.md`.
- Physics selection: read `C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/references/physics-engine-selection.md`; retained the existing FPS simulation/collision rather than adding a physics dependency.
- Local server workflow: read `C:/Users/wolfk/.codex/skills/local-dev-instances/SKILL.md`; verified port 5200 was stopped, started this checkout's server, and checked the local response. Existing tabs and both Blender projects were not changed during integration.
