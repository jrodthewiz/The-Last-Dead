# Dead Arrival UI reference ledger

The interface pass follows the required Three.js game UI guidance. The files below were read before implementation.

| Reference | Used | Path | Failure reason |
| --- | --- | --- | --- |
| Game UI patterns | yes | `C:/Users/wolfk/.codex/skills/threejs-game-ui-designer/references/ui-patterns.md` | -- |
| Game UI quality | yes | `C:/Users/wolfk/.codex/skills/threejs-game-ui-designer/references/checklists/game-ui-quality.md` | -- |
| HUD readability | yes | `C:/Users/wolfk/.codex/skills/threejs-game-ui-designer/references/checklists/hud-readability.md` | -- |
| Responsive UI fit | yes | `C:/Users/wolfk/.codex/skills/threejs-game-ui-designer/references/checklists/responsive-ui-fit.md` | -- |
| Mobile input | yes | `C:/Users/wolfk/.codex/skills/threejs-game-ui-designer/references/checklists/mobile-input.md` | -- |

## States covered

- Main menu with solo start, co-op host/join/accept code fields, control legend, and settings drawer.
- Gameplay HUD with life signal, energy, dash cells, weapon cooldown, style rank, wave objective, target count, crosshair hit marker, FPS/network readouts, and pause affordance.
- Pause overlay with resume, restart, settings, and menu actions.
- Run complete and run failed overlays with stable results fields and retry/menu actions.
- Touch controls with movement, dash, slide/slam, jump, fire, alternate fire, parry, and weapon actions. Buttons expose `data-action` for the root input layer and meet the 44px target floor.

## UI intent

Dead Arrival uses a restrained industrial signal language: black steel surfaces, paper white type, blood red impact accents, amber objectives, and cyan energy/network readouts. Gameplay panels stay at the edges; the crosshair is the only persistent center element. Menus are deliberately modal and compact so the arena remains visible behind them when the player returns to play.

## Public interface

`new UI({ root, onStart, onResume, onRestart, onMenu, onPause, onHost, onJoin, onAccept, onDisconnect, onSettings })`

Methods:

- `menu()`
- `play()` / `hide()` / `hit()`
- `pause()`
- `finish(run, win)`
- `hud(run, { network, fps })`
- `toast(text)`
- `networkStatus(text)`
- `setOffer(code)`
- `setAnswer(code)`

The UI owns only presentation state and local preferences (`dead-arrival-prefs-v1`). Gameplay and peer transport remain in `main.js`/the engine. `onJoin` receives the Join offer field and `onAccept` receives the separate Host answer field.

## Verification notes

- CSS uses safe-area insets, stable fixed-width numeric containers, responsive breakpoints, `touch-action: none` only on the game canvas/look surface and touch controls, and reduced-motion handling.
- Menu network fields are readonly only for generated offer/answer output; the join and accept fields stay editable.
- No UI asset generation was needed; icons and keycaps are authored with CSS/text so the interface remains local and deterministic.
