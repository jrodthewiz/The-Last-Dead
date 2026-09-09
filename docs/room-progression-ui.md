# Room progression HUD

The combat HUD now exposes the authored room route as a compact upper-left objective cluster. It keeps the existing survival, weapon, and reticle zones in place while adding the information needed to read a small-room campaign at a glance:

- sector and room number (`ROOM 01 / 06`)
- room name
- current wave objective
- threat count, including queued incoming threats
- a stable wave progress bar and segmented room route rail
- explicit exit, intermission, and clear copy when the director supplies it

## State contract

`UI.hud(run)` reads the live `run.roomProgression` contract first. `run.room_progression` is accepted only for transitional snapshots. Room names are resolved from the authoritative `sequence` IDs through `getRoom()` and `getRoomSequence()`; the UI does not guess a name from a sector. If an active ID and indexed ID disagree, it shows `ROOM SYNCING` until the snapshot is coherent.

```js
run.roomProgression = {
  version: 2,
  sectorIndex: 0,
  sectorId: 'bloodworks',
  sequence: ['bloodworks-act-i-entry', 'bloodworks-act-i-gallery', 'bloodworks-act-i-court', 'bloodworks-act-i-objective'],
  currentIndex: 0,
  activeRoomId: 'bloodworks-act-i-entry',
  entered: 'bloodworks-act-i-entry',
  completed: [],
  phase: 'combat',
  objective: 'Clear Intake Bay',
};

// The HUD continues to read combat pressure from the run/director state:
run.wave = 1;
run.waveCount = 3;
run.director = { pending: 1 };
// Remaining/total are counted from run.course.enemies by the HUD fallback.
```

The UI treats this object as read-only. It does not advance rooms, infer unlocks, or mutate director state. Existing sector/director fields remain a display fallback for older runs and pre-progression snapshots. Optional `roomName`, `roomCount`, `progress`, `subtitle`, and `threat` values are accepted when a future snapshot supplies them, but they never override a coherent room ID from the live sequence.

## Review evidence

Reference ledger:

| Reference | Status | Use |
| --- | --- | --- |
| `threejs-game-ui-designer/references/ui-patterns.md` | loaded | Gameplay hierarchy, compact meters, state wiring, safe zones |
| `references/checklists/game-ui-quality.md` | loaded | Genre fit, stable values, state-driven HUD, desktop/mobile fit |
| `references/checklists/hud-readability.md` | loaded | Objective contrast, threat-lane clearance, fixed counters |
| `references/checklists/responsive-ui-fit.md` | loaded | Mobile width budget, safe-area inherited from the base HUD, overflow limits |

The route rail is deliberately small and lives in the existing objective zone. Desktop width is capped at 340px; mobile width leaves room for the rank and pause controls. Long room names ellipsize, counters use fixed-width numeric styling, and the route uses color plus labels so progress remains readable without relying on color alone.

The runtime browser pass should capture gameplay at desktop and mobile sizes after the room director exposes `run.room_progression`. Verify that the objective cluster does not overlap the rank/pause cluster, touch controls remain below the HUD safe area, and the following state transitions update without layout shift: combat, intermission, room clear/exit live, and next room.

Files: `ui.js`, `horror-ui.css`.
