# Dead Arrival QA ledger

## Required references

| Loaded | Reference | Use |
| --- | --- | --- |
| yes | `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/qa-release-checklists.md` | Browser QA matrix and evidence format |
| yes | `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/visual-verification.md` | Canvas pixels and active screenshot |
| yes | `C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/playtest-qa.md` | Two-minute main-loop journey, controls and retry |
| yes | `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/references/debug-profile-checklists.md` | Runtime and performance triage |
| yes | `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/references/checklists/scene-debugging.md` | WebGL, camera, asset and loop checks |
| yes | `C:/Users/wolfk/.codex/skills/threejs-debug-profiler/references/checklists/performance-profile.md` | Renderer and FPS sampling |
| no | prompt templates | Not requested |

## QA result

Pass with a combat-flow finding. The standalone harness [`tests/sustained-playtest.mjs`](../tests/sustained-playtest.mjs) ran against `http://127.0.0.1:5200/?debug=1` in installed Chrome, 1440x900, for 122,540 ms wall time. Target selection and mouse-look deltas were assisted from the debug state; all movement, aiming, firing, weapon changes, jumps, dash, slide, parry, grapple, and restart actions were real Playwright keyboard/mouse input. The harness did not mutate simulation state.

Evidence: [`qa-sustained.json`](qa-sustained.json), [`combat-gore.png`](combat-gore.png), and [`sustained-active-final.png`](sustained-active-final.png).

| Area | Result | Evidence |
| --- | --- | --- |
| Clean load / canvas | pass | WebGL true, renderer error null, active screenshots are nonblank and varied |
| Aim and movement | pass | Pointer lock true; mouse look, W/A/D, jump, dash and slide changed state |
| Combat / gore | pass | 6 kills; gore and blood pools observed; style total 2,008.5, rank B |
| Health feedback | pass | Damage reached 34.6 health; close-range heal was observed |
| Weapon inputs | pass | Coin alt created an active coin; shotgun core produced `coreProjectiles: 1`; weapon 3 fired |
| Sustained objective | incomplete | Wave 1 and wave 2 reached; 5 wave-2 targets remained at the 122.5-second end, so wave 3/exit is unproven |
| Death/retry | partial | Prior 121-second run proved enemy death and restart; this final renderer run stayed alive |
| Console/network | finding | One generic Chrome `Failed to load resource: the server responded with a status of 404 (Not Found)` console message; no page errors, failed requests, or Playwright bad responses |

## Pixel evidence

Sharp stats for `combat-gore.png` (1,063,542 bytes): opaque RGB; R 0–255, mean 60.548, stdev 60.569; G 2–255, mean 62.938, stdev 60.334; B 4–255, mean 77.127, stdev 64.759; entropy 6.647. The capture was taken during active shotgun combat with `gore=40`, `blood=5`, one active coin, and four projectiles.

## Renderer/performance evidence

Final active samples at DPR 1 measured 16,674 authored triangles, 21 instanced meshes, 42 materials, 381 geometries, 7 textures, and 102–140 render calls in later combat samples. Headless Chrome FPS ranged from 26.9 to 57.6 (median 32.0); peak sampled GPU triangles were 15,662. This is desktop/headless evidence and does not claim mobile performance. The final run loaded the built PMREM/IBL renderer from `deadarrival/dist`.

## Findings

### Wave clear / exit remains unproven

**Severity:** medium. Start a clean run and sustain real movement plus assisted target selection and shotgun fire for two minutes. The final run reached wave 2 after six kills but ended with five wave-2 targets alive and 34.6 health. Wave 3 and the exit marker were not reached. The likely owners are combat/AI tuning and navigation around cover; renderer diagnostics showed a live WebGL scene and no page exceptions.

### Generic 404 console message

**Severity:** low. A clean load logs one generic 404 resource message with no URL exposed by the console event. Confirm its URL with a headed network log; likely candidates are an unrequested browser asset such as a favicon or a static-server path.

## Residual risk

The sustained run used headless desktop Chrome. Mobile touch, low-end GPU, and cross-network peer-to-peer conditions remain outside this evidence. FPS varied materially under the final IBL plus active enemies/projectiles/gore and should be retested on target hardware.
