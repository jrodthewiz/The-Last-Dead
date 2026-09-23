# Story descent map quality pass

The five-floor Story descent now pairs distinct floor identities with resolved wave staging, readable intermission directions, collision-checked landmark geometry, and engine-driven route QA. The floor art contract lives in `dungeon-art-direction.js`; bespoke Three.js structures are assembled in `dungeon-architecture.js` and feed the existing static-world batching path.

## Direction and references

The art direction draws on the official *Dead Space* art-development material: build horror through immersion, evidence of prior inhabitants, and deliberate light and shadow. The series' *Intensity Director* also treats lighting as a gameplay layer. Each floor therefore has a different fog range, key and rim colors, wall palette, practical-light reach, and environmental phrase. [Motive art-development livestream](https://www.ea.com/ea-studios/motive/news/art-developer-livestream) · [Motive on the Intensity Director](https://www.ea.com/technology/news/inside-dead-space-4-the-intensity-director)

`assets/concepts/pulse-crucible-concept-v02.png` is the Intake Foundry reference: a heavy pressure press, open chamber, restrained rust and copper, warm core, and readable gauges and hoses. `assets/concepts/black-gullet-concept-v01.png` develops the final altar into a walk-through bone-and-basalt arch with an open throat, outer teeth, and tendons. The [Black Gullet prompt](./black-gullet-prompt.md) records the brief. These are concept images, not runtime textures or claimed 3D scans.

## Floor models

- Intake Foundry: pressure crucible, piston boiler, nine-rib iris, pump bank, chain lift, crane gantry, and living conduit.
- Graft Galleries: suspended surgical table, porcelain work surfaces, restraint rings, paired specimen benches, and a new overhead extraction gantry. Its asymmetrical arms, umbilicals, and bone needles frame the table while staying above the walk lane; the small hardware does not cast or receive shadows.
- Catacombs: open pointed-bone reliquary, load-bearing rib stacks, lathed bells, tooth rack, and overhead chain lifts.
- Resonance Nave: asymmetric jaw gates, open throat altar, suspended bells, pipe-organ facade, and brass-and-stone lighting.
- Last Descent: a route-scale Black Gullet throat repeats the final bone-and-basalt altar language inside the first tunnel span, replacing the thin floating hoop. Its segmented arch, paired load ribs, recessed web, deterministic rubble skirt, and small shoulder embers form a walk-through focal point sized for the actual spawn offset. The wider hero altar now exposes its basalt courses beneath two tapered procedural bone ribs, with fractured outer buttresses, an open oxblood vault, a center crown fang, and rooted lower fangs. Tunnel ribs reuse a subdued basalt material, and the unsupported overhead conduit is removed from the F5 throat runs.
- Graft Galleries now uses a brighter, longer practical-light pool and floor-specific exposure to separate the sterile intake, floor lanes, and surgery-theatre silhouette while keeping the teal low-light palette.

Landmarks are visual-only and cannot edit collision blocks. Ray tests check the actual generated meshes across each room's center lane and mouth openings at player heights. Static detail is eligible for material batching; animated pieces remain separate.

## Playability and staging

The runtime course now reserves key tiles while resolving wave spawns, and three late-wave targets were moved off key cells. The map playground draws resolved runtime spawn positions, so its markers no longer disagree with the live floor. Between waves, the HUD shows a countdown and the next threat rooms. Key gates still require their own pickup; encounter gates remain tied to their scheduled wave.

The map suite starts each authored wave through the real `tick` loop, verifies its resolved enemy variants and cells, then clears the spawned enemies deterministically so normal progression opens encounter gates. It then follows cell paths with turn/forward input through `tick`, collects every key by proximity, reaches each lift, descends all five floors, and wins on Floor 5. This validates route and progression behavior without claiming combat-balance coverage. Story art tests check named landmark construction, the theatre light's actual intensity/range, non-shadowing gantry hardware, batching, and floor-topology preservation.

## Asset workflow and limits

The Black Gullet concept is a design reference, not a 3D scan or runtime texture. `img2threejs` supplied the reference analysis, sculpt spec, and isolated front, three-quarter, side, and map-stripped review views; the scene geometry is authored in Three.js in `dungeon-architecture.js`. DeepSeek and Muse reviewed earlier entry captures. Their critiques led to a forward landmark, a wider actual-spawn aperture, removal of the free-ended approach conduit, clearer floor contact, and a shared F5 mouth palette. The latest hero iterations replaced the continuous ivory arch with tapered, irregular 3D ribs, broke up the outer basalt profile, added a walk-through oxblood vault, and grew larger teeth into the crown and floor. The recorded Tier 1 comparison remains below its gate (silhouette IoU 0.535 vs. 0.85; aspect-ratio delta 0.134 vs. 0.05; scale delta 0.218 vs. 0.08), so the sculpt pipeline remains at blockout. The reference mask includes its entire dark background and floor, making those raw pixel-aligned values a poor measure of the model alone. The new hero passes the standalone multi-angle collapse check: three-quarter/front and side/front silhouette-area ratios are 1.03 and 0.79 against the 0.15 threshold. This confirms real depth, but not concept fidelity. The self-review still finds a crown that is too even, sparse inner anatomy, and a simpler right shoulder. Treat the result as a stylized, playable procedural implementation rather than a validated reconstruction. One-view comparison cannot verify hidden-side fidelity or in-game lighting. No external model-generation job ran and no new GLB or texture is claimed; runtime geometry and surface maps ship with the bundled Three.js code.

## Verification

Passed on the previous F5 pass; not rerun after the latest visual iteration:

- `npm.cmd run test:map` — 11 tests.
- `npm.cmd run test:story-art` — 5 tests.
- `npm.cmd run test:engine` — 20 tests.
- `npm.cmd run build`.

The isolated Floor 2 playtest at `http://127.0.0.1:5200/index.html?dungeon=1&debug=1` showed clearer wall and floor lanes plus the theatre fixture/table silhouette after the lighting pass. HUD samples ranged from 17–20 FPS over the short visible run; a later debug sample fell to 10 FPS as enemies entered, with 348,990 drawn triangles, 218 calls, 612 geometries, 336 materials, 61 textures, and DPR 1.25. Treat this as unstable evidence, not a sustained benchmark. The visual judge raised the score from 14/30 to 16/30, with material finish and environmental richness still the main gaps; no pixel-based or combat stress benchmark was run.
