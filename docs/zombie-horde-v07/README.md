# Zombie motion and horde iteration — October 4, 2026

The coastal population and campaign zombies now use three distinct movement
families on the existing Ash Witness character. Headless Blender 2.93 authors
four new full-body loops; the simulation owns perception, movement and damage.

| Family | Motion and behavior |
| --- | --- |
| Stalker / shambler | Existing uneven shuffle, independent idle phase, listening, searching and local crowd separation. |
| Bloodhound / runner | New forward-leaning run, 0.28-second coil, short rush, recovery, and limited interception from directly observed velocity. |
| Skitter / crawler | New low articulated crawl and idle, slower pursuit, a brief surge, and seeded crooked listening with neck/shoulder/hand motion. |

Nearby zombies relay an observed position after a 0.28–0.66-second delay. The
relay requires a clear lane between neighbors, expires, and travels at most two
hops. The six nearest neighbors provide bounded separation and mild cohesion
when they share a recent destination. Losing sight preserves the last observed
position; hidden live player coordinates no longer overwrite pursuit or gaze.
Sight range and field of view still apply in the large open coastal map.
Original attack slots, windups, contact damage, pathfinding, noise reactions,
injury crawl, grabs and reanimation remain part of the existing state machine.

Default harbor residents contain all three families. Explicitly authored
variants still take precedence. Natural crawlers have low collision proxies;
the existing renderer supplies rig-derived capsules through their rise into a
swipe. Rifle authority and coarse projectile height account for the low body.

## Blender authoring

Source: `assets/models/afterlife-ash-witness-motion-v06.glb`.
Delivery: `assets/models/afterlife-ash-witness-motion-v07.glb`.
The delivered file is 4,193,928 bytes, adding 467,800 bytes. Original geometry,
skin weights, bind matrices, packed textures, and all six original clips remain
byte exact. The additional loops have 72 channels each, sampled at 60 Hz:

| Clip | Duration | Gait distance |
| --- | ---: | ---: |
| AshWitness_Run | 0.9 s | 1.8 m |
| AshWitness_Crawl | 1.4 s | 0.72 m |
| AshWitness_CrawlIdle | 2.4 s | Stationary |
| AshWitness_Contort | 1.8 s | Stationary |

`scripts/author-zombie-motion-v07.py` uses world-space two-bone IK and explicit
support/swing phases, then bakes local glTF tracks. Only authored pelvis sway
remains in place; actual travel comes from the simulation. The runtime advances
gait phase from measured distance, with reverse gait for retreat. Every action
weight stays normalized. Equal presentation time freezes the entire pose.

The runner supports each foot for 42% of its cycle, leaving two brief flight
intervals. The imported weighted feet clear the floor together by about 2 cm;
this is verified from the actual skin rather than inferred from ankle height.
The [neutral Blender motion reel](motion-reel.mp4) shows the final runner,
crawler and crooked-listening loops. Its gray review material exposes the pose;
the game retains the original packed character textures.

The editable master is `.art-source/zombie-horde-v07/zombie-motion-v07.blend`.
It retains all ten actions and a neutral review scene. Blender is an offline
authoring dependency; runtime/build still need only Node and bundled assets.
Reproduce the bake with:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --python scripts/author-zombie-motion-v07.py
```

The first skin sweep exposed fingertips below the floor. Correcting the baked
wrist orientation fixed the raw loops. Low-to-upright rotation blends also
needed support: the runtime caches extreme skin vertices once per geometry and
samples them only during a crawler transition, applying a bounded visual lift.
The simulation root stays authoritative. At full swipe contact the support
correction yields completely, retaining the exact original 0.375-second pose
for shamblers, runners and crawlers. Recovery settles back into the low stance.

## Sources and choices

The existing Meshy character and v05 weighted jaw/grip rig are retained. New
motion is authored locally, so no third-party motion is redistributed.
Free sources checked for future retargeting:

- [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html): CC0, with locomotion and crawling advertised by the creator.
- [Quaternius Animated Zombie Pack](https://quaternius.com/packs/animatedzombie.html): CC0 zombie animation pack.
- [Rokoko zombie motion recordings](https://www.rokoko.com/resources/rokoko-mocap-12-free-zombie-animations): the creator offers 12 FBX/Mixamo-skeleton recordings for personal/commercial use; download flow includes registration/marketing consent.

The existing rig and timed attacks make tailored Blender motion the useful
choice for this iteration. No new model, texture, audio or paid API generation
was used. Character/material/environment redesign is outside this pass.

## Verification

The final focused Node batch passes **137/137 tests**. It covers engine/AI,
social relay barriers and delay, hidden target memory, runner interception,
host snapshot continuation, crawler rifle hits, harbor obstacles, real imported
skin and clips, 30/60/120 Hz distance cadence, paused time, exact contact, grabs,
death/reuse, and full weighted-skin floor samples. The production build passes.
Commands and diagnostics: `output/zombie-v07-final-tests.log` and
`output/zombie-v07-build.log`.

All vertices are sampled at 25 phases for each new loop. Minimum skin heights
are -0.01488 m for Run (toe, within the 0.035 m floor tolerance), +0.01552 m for
Crawl, and +0.01582 m for both CrawlIdle and Contort. Runtime transition samples
remain above the floor; full contact keeps its +0.02562 m original skin minimum.
`validation.json` records Blender version, asset hashes, clip sizes and renders.

Browser receipts and screenshots live under `output/playwright/zombie-horde/`.
The isolated fixture runs actual simulation and imported animation for twelve
seconds per variant. It checks normalized weights, zero moving strike frames,
the 0.375-second damage pose, visible pose differences and nonblank pixels.
Separate installed Chrome checks load the real coastal game, including its
natural mixed population and desktop/portrait presentation. These are owned
ephemeral servers and browsers; the user's game tab and port 5200 are preserved.

The final packaged receipt is
`output/playwright/zombie-horde/final-production/report.json`: PASS for both
the fixture and the native WebGPU coastal game, with zero page, console, HTTP
or request failures. It hashes the exact GLB bytes parsed by the browser:
`8bd6bfed843879ae190fa8da3e69466998289a727634cdfdfe1d708f5e30b4e0`.
Each family completes 8/11/6 attacks respectively in twelve simulated seconds;
all contact poses match and all contact frames stay planted. Eight natural
coastal residents include two runners and two crawlers. The earlier source-game
receipt is `output/playwright/zombie-horde/game/report.json`, also PASS.
Intermediate failed production attempts remain in `production/` for diagnosis;
the final receipt supersedes them after a fresh successful launch.

The live server at `http://127.0.0.1:5200/` was then verified directly, rather
than through an ephemeral copy. `output/playwright/zombie-horde/live-5200/report.json`
records PASS, the same final asset digest, native WebGPU play, all three natural
movement families, and zero browser/resource failures. The server remains
running after QA. `ZOMBIE_QA_URL=http://127.0.0.1:5200` selects this check without
closing the existing server or the player's tab. Refresh an already-open game
tab to load the new code and start a fresh run for the new population mix.

The final packaged 24-actor sample includes 757 crawler transition updates
over 240 frames: mean animation update 3.695 ms, 95th percentile 7.2 ms, maximum
9.7 ms on this machine. Studio rendering uses 75 calls and 766,002 triangles.
The crowd measurement is animation CPU cost only. Studio draw/triangle counts
and portrait captures do not establish total gameplay FPS or phone performance.
Scary movement and encounter balance still benefit from human playtesting.
Contortion reads as crooked listening and neck motion, rather than extreme
possession. The pass adds no wall climbing, full ragdoll solver, or general
terrain foot IK.

## Workflow ledger

Read and applied the Three.js game director's narrow-task route, gameplay
systems, procedural animation, debug profiler, QA/release, and 3D-generator
integration guidance. Required references read: gameplay workflows, physics
engine selection, procedural motion systems, debug checklist/scene debugging,
QA/release, visual verification, playtest QA and release checklists. Existing
custom deterministic collision remains the physics choice.

The director's phase delegation instruction was applied to AI, animation
runtime and browser QA; the parent authored/revised Blender assets, preserved
the package's explicit runtime list, and verified integration. New asset
generation, UI redesign, world graphics, audio generation and deployment were
not part of this character/behavior pass. This receipt certifies the bounded
animation/AI checks, not whole-game AAA quality or a completed campaign run.
