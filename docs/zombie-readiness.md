# Zombie readiness — 2026-09-30

The Ash Witness v05 rig already supplies six usable body clips and weighted
jaw/grip controls. This pass fixes their handoffs and adds bounded procedural
life; it does not need a new Blender export.

## Behavior and pose ownership

| State | Body motion and transition |
| --- | --- |
| Dormant / paused wander | Independent idle clip, breathing, uneven shoulder tension, listening/head drift |
| Wander / investigate / ingress | Distance-driven shuffle, head tracking/search and bounded diagonal pelvis swivel |
| Stalk / flank / chase | Phase-aligned shuffle/chase blend driven by measured world speed |
| Stationary turn | Small shuffle driven by the distance swept through the turn; no simulation translation |
| Attack windup / contact | Simulation windup/strike samples the authored swipe; contact remains at 0.375 clip seconds |
| Recovery | Feet remain planted until strike ends; actual retreat reverses gait, and the full-body swipe fades over 160 ms as movement resumes |
| Hit / stagger | Existing recoil and melee impulse ownership; secondary motion fades with actual recoil weight |
| Grab / held / terminal bite | Existing player-injury reach and jaw/grip controls own the grapple; ambient offsets yield |
| Death | Existing authored collapse and corpse physics ownership; ambient movement stops |

The wander timeout now measures the current destination instead of the entire
time spent wandering. Ranged enemies decide a strafe reversal once per beat,
rather than toggling direction every frame of that beat. Attack slots,
perception, collision rules and damage timing retain their existing contracts.

## Verification

150 targeted Node tests pass, including actual imported-skin tests, engine,
AI, ingress on all five floors, melee, grabs, counters and death. New regressions
cover contact foot plants, recovery blends, reverse gait, stationary turning,
continued wandering, stable strafing, paused-time poses and continuous quiet
states. Diagonal swivels are checked around world vertical with the original
inverted pelvis axis at three actor headings. Relevant timing tests exercise
30/60/120 Hz. A sixteen-actor CPU sample measured 1.078 ms per animation
update; this is not a GPU/frame-rate benchmark.

The separate Chrome game fixture runs each zombie variant for 12 simulated
seconds. The real simulation and enemy pose pass run at 60 Hz. In the latest
source check:

| Variant | Moving contact frames, before → after | Moving with >90% swipe weight, before → after |
| --- | ---: | ---: |
| Stalker | 112 → 0 | 156 → 16 |
| Skitter | 154 → 0 | 239 → 22 |
| Bloodhound | 98 → 0 | 147 → 14 |

The remaining high-weight recovery samples are the first two frames of the
intentional blend, not a held pose. Every damage contact samples the same
authored 0.375-second pose; all action weights stay normalized. All six clips
load, the 1280×720 canvas is nonblank, and the source check has no page,
console, HTTP or failed-request errors.

Source screenshots/samples/report: `output/playwright/zombie-readiness/after/`.
Packaged-build evidence: `output/playwright/zombie-readiness/production/`.
The packaged-build check also passes with the same contact/recovery counts
and zero browser/network errors. The baseline replays the previous contact
and recovery rules against the same rig and map.
`node build.mjs` succeeds. The three changed runtime modules are hash-matched
between source and `dist`. The existing port-5200 process serves this canonical
repository directly; served bytes also match source. Its process and the
user's tab were preserved.

The grab regression passes 31 rendered views, covering both actual gripping
hands, mouth preparation, terminal release, restart, all eight weapons,
portrait layout, reduced motion, gore settings and peer presentation. Two real
F presses release the natural grab at 100 health. Natural fatality still comes
from the engine's bite damage. Its natural-phase checks now advance the real
main loop deliberately so automation latency cannot consume the escape
window; the later 12-second live input run uses the native loop and verifies
movement, firing, pause/resume and menu return. Evidence:
`output/playwright/zombie-readiness/grab-regression/`.

## Reference ledger

Read: `threejs-debug-profiler/references/debug-profile-checklists.md`,
`threejs-debug-profiler/references/checklists/scene-debugging.md`, and
`threejs-procedural-animation/references/procedural-motion-and-docking-systems.md`.
Applied the animation, delta-time, clip/mixer, collision, resource-loading,
canvas, console/network, deterministic phase and transform-ownership checks.
No asset generation or GPU optimization was required.
