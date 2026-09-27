# Weapon pickup stall

Collecting a Story weapon hid a group containing both the weapon display and a
point light. Three.js uses the number of visible lights in its shader programs,
so each collection invalidated the warmed lighting configuration and compiled
new programs synchronously during play.

`dungeon-weapon-loot.js` now attaches each pickup light to the world alongside
the display. Collection hides the display and zeros the light intensity while
keeping the visible light count stable. The light retains its original world
position and is still owned by the floor's world root for cleanup.

## Verification

- Headless Edge, 800×600 isolated scene using the production pickup builder:
  first collection went from 952.7 ms / 7 new shader programs to 3.4 ms / 0;
  second collection went from 53 ms / 1 program to 0.8 ms / 0.
  These are local samples, not a general FPS benchmark.
- `node tests/weapon-pickup-performance.mjs` verifies successive collections,
  hidden displays, disabled illumination, stable shader programs, no browser
  errors, and no lost WebGL context.
- `node tests/weapon-pickup-game.mjs` exercises Story pickup through the normal
  game loop, including auto-equip, notification/audio, continued simulation,
  and firing afterward. Both the Breach Shotgun and Wake Bat passed with zero
  new programs, zero browser/HTTP errors, and a live WebGL context. Rendered
  screenshots were captured at 1280×720; the shotgun screenshot was visually
  inspected. Its report and screenshots go to `.logs/`.
- `node --test engine.test.mjs tests/dungeon-art.test.mjs tests/room-progression.test.mjs`:
  30 tests passed. `node build.mjs` passed.
- Browser scripts use `PLAYWRIGHT_PATH` and `CHROME_PATH` when local Playwright
  and its browser are not installed. They open separate browsers and preserve
  the existing game tab and server.

## Debug reference ledger

Read from `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/`:

| Reference | Read | Checks used |
| --- | --- | --- |
| `references/debug-profile-checklists.md` | Yes | Reproduce, served source, owning module, retest |
| `references/checklists/scene-debugging.md` | Yes | Browser errors, loop continuity, rendering, screenshot |
| `references/checklists/performance-profile.md` | Yes | Warmup, shader compilation, before/after timings |

No reference failures. The fix addresses pickup shader stalls; broader scene
performance and other pickup types are outside this change.
