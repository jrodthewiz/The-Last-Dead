# Room progression browser QA

This check covers the compact campaign route through the player-facing game at `http://127.0.0.1:5200/`. It uses a disposable headless Edge page with `?debug=1`; the existing game tab remains untouched.

Run it after the local server is serving the current build:

```powershell
$env:PLAYWRIGHT_PATH='C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'
$env:CHROME_PATH='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node tests/room-campaign-browser.mjs
```

Set `GAME_URL` when checking another local preview. Set `ROOM_QA_DIR` to keep evidence in a different directory.

The harness verifies:

- the three authored sectors load and expose three encounters each, with increasing wave budgets and late enemy variants;
- the start path, forward movement, weapon switching, and mobile touch surface work;
- the real browser engine director creates each wave, keeps every forward door locked until its room is clear, advances `roomProgression.currentIndex` only after the player physically crosses an opened doorway, and reaches the final win state only after the three sector exits are traversed;
- active desktop captures for all three sectors, a dead-state capture, a restart capture, and a narrow mobile capture are nonblank;
- forcing death reaches the actual finish screen and its restart action returns to Bloodworks with full health;
- page errors, failed network requests, renderer calls/triangles/memory, canvas dimensions, HUD room state, and touch target counts are recorded.

The deterministic fixture only shortens the combat portion by marking each spawned threat defeated after the director has scheduled it. Wave creation, intermissions, director state transitions, and exit gates still run through the browser's `engine.tick` path. A separate hands-on playtest should still fire, dodge, and clear a full wave with real input before release.

Evidence is written to `docs/room-progression-qa/room-campaign-browser.json` and the adjacent PNG captures. A passing run requires no page errors or failed requests, a nonblank canvas in every capture, all three exit gates, final `win`, and a clean death/restart cycle.

Final run: passed nine physical encounter gates, three sector exits, victory, restart, keyboard movement/weapon switching and mobile framing. Zero page errors and zero failed requests. See room-progression-qa/room-campaign-browser.json.
