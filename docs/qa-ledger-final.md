# Dead Arrival QA ledger

## Reference ledger

| Loaded | Reference | Use |
| --- | --- | --- |
| yes | `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/qa-release-checklists.md` | Browser QA matrix, evidence and bug format |
| yes | `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/visual-verification.md` | Canvas pixels and active screenshot verification |
| yes | `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/playtest-qa.md` | Two-minute main-loop journey and retry checks |
| yes | `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/references/debug-profile-checklists.md` | Runtime triage and performance evidence |
| yes | `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/references/checklists/scene-debugging.md` | WebGL/camera/asset checks |
| yes | `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/references/checklists/performance-profile.md` | Renderer and FPS sampling |
| no | prompt templates | Not requested |

## Sustained run

The standalone Playwright harness in [`tests/sustained-playtest.mjs`](../tests/sustained-playtest.mjs) ran against `http://127.0.0.1:5200/?debug=1` in installed Chrome at a 1440x900 viewport. The 121,015 ms wall-clock journey used real keyboard and mouse movement, attacks, weapon swaps, coin alt fire, jump, dash, slide, parry, grapple input, and restart. Target selection and mouse-look deltas were assisted from the exposed debug state and are labeled in the JSON; simulation state was never mutated by the harness.

Evidence is in [`qa-sustained.json`](qa-sustained.json) and [`combat-gore.png`](combat-gore.png). The canvas is nonblank and visually varied: the captured combat PNG is 718,148 bytes with wide RGB ranges (R 0..255, G 0..228, B 0..222). The screenshot was captured while the arena contained gore and blood pools (`gore=10`, `blood=3`).

## Result

| Area | Result | Evidence |
| --- | --- | --- |
| Clean load and WebGL | pass | No page errors or failed requests; `webgl: true`, renderer error `null` |
| Pointer lock and aiming | pass | `pointerLock: true`; mouse-look deltas and arrow-key fallback exercised |
| Movement | pass | Real W/A/D, jump, dash, slide input changed position/energy/vertical state |
| Combat and gore | pass | Shotgun produced 4 kills, gore/blood pools, style points and combat screenshot |
| Health feedback | pass | Enemy damage and close-range blood heal observed |
| Death and retry | pass | Enemy pressure reached death; restart returned health to 100 and wave 0 |
| Weapons | pass with evidence caveat | Coin alt created a coin; shotgun and arc-lance inputs fired. Short-lived projectiles/tracers were sampled after their effects decayed. |
| Wave/objective/exit | incomplete | Wave 1 was reached twice, but bot died with one target remaining; waves 2–3 and exit are unproven |
| Console/network | finding | Chrome reported one generic `Failed to load resource: the server responded with a status of 404 (Not Found)` console error; no page errors/request failures were seen. The URL was not exposed by the console message. |

## Renderer/performance evidence

The run measured the optimized renderer in active combat. Samples reported 12,508 authored triangles, 21 instanced meshes, 34 materials, 260 geometries, 4 textures, and 46–216 render calls. Headless Chrome FPS ranged from 20.8 to 70.7 (median 56.8) at DPR 1; this is a desktop/headless measurement and is not a mobile claim. Peak GPU triangles were 16,926. Gore and projectile counts rose during combat and were bounded by the runtime pools.

## Reproducible issues

### Sustained wave clear is not yet demonstrated

**Severity:** medium (QA coverage / combat-flow risk)

**Reproduction:** Start a clean run, keep moving and fire the shotgun while assisted-aiming at the nearest live target for two minutes. The run reached wave 1 and recorded four kills, then enemy pressure killed the player. After restart, the second attempt again remained in wave 1 with a live target at the end of the journey.

**Expected:** A competent movement-and-aim loop should be able to clear wave 1 and progress through the three-wave objective within the sustained journey.

**Actual:** Wave 1 was not cleared in this run; three-wave progression and the exit marker remain unverified.

**Likely owner:** engine combat/AI encounter tuning or target navigation around cover; the renderer is not implicated by the observed state.

**Suggested next check:** Add a deterministic combat bot or temporary debug target markers to verify line-of-sight and enemy steering around the four cover blocks. Review ranged projectile pressure and close-enemy attack cadence after the first kill.

### Generic 404 console message

**Severity:** low

**Reproduction:** Open `http://127.0.0.1:5200/?debug=1` in Chrome and inspect console output.

**Expected:** No resource errors on a clean load.

**Actual:** Chrome logged `Failed to load resource: the server responded with a status of 404 (Not Found)` without a URL. No page exception or Playwright request failure occurred.

**Likely owner:** static server or an unrequested browser asset such as a favicon; confirm the URL in a headed browser/network log.

## Residual risk

The run was headless desktop Chrome, so mobile touch, low-end GPU, and real network peer-to-peer conditions remain outside this subtask. The renderer diagnostics were captured after the optimized renderer was loaded; frame-time variance under full gore/projectile pressure should be retested on target hardware.
