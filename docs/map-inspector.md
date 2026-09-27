# Developer map inspector

On localhost, choose **Map Inspector** from the main menu, or press **F2**
during solo play. For a hosted development build, add `?dev=1` to enable it.
Use `?dev=1&dungeon=0` through `dungeon=4` to select a Story floor at startup.

| Input | Action |
| --- | --- |
| WASD | Fly forward/backward and sideways, through walls |
| Mouse / arrow keys | Look around |
| Space or E | Rise |
| Ctrl or Q | Descend |
| Shift | Triple movement speed |
| Mouse wheel | Adjust base speed from 1–96 m/s |
| R | Reset camera to inspection entry point |
| Esc | Release mouse and pause; resume inspection normally |
| F2 | Return to the original player position |

This is a desktop keyboard/mouse tool. A compact panel shows world coordinates,
speed, and controls; its layout also fits narrow windows. Co-op sessions cannot
enter inspection. The simulation, pickups, and combat are suspended while the
inspection camera is active. The camera has its own pose in world metres
(Y up); the player's simulation position, health, and inventory are unchanged.
Weapons, local body, and gameplay HUD are hidden for a clear inspection view.
Viewmodel lights remain registered to avoid shader churn.

Implementation: `dev-flight.js` owns flight motion, `main.js` owns input and
mode transitions, and `renderer.js` projects the inspection pose and hides
first-person meshes only for the inspection render. Returning to the menu or
restarting clears the camera override.

Verification: `node --test tests/dev-flight.test.mjs` and
`node tests/dev-flight-browser.mjs` (with `PLAYWRIGHT_PATH` / `CHROME_PATH` when
needed). Browser evidence is saved under `.logs/dev-flight/`. Checks cover
movement, speed bounds, look, reset, frozen player/pickups, pause/resume,
return to gameplay, and a narrow viewport. `node build.mjs` includes the new
runtime module. Existing game tabs and the server are left untouched.

Interaction references read successfully:
`threejs-interaction-systems/references/interaction-patterns.md` and
`mint-threejs-skills/references/spatial-contracts.md` under the installed
skills directory. Camera ownership, explicit reset/exit, semantic controls,
and the simulation/render coordinate boundary follow those references.
