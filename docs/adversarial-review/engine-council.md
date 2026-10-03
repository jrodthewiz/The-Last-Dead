# Engine and presentation council — October 1, 2026

## Review scope and provenance

This is a read-only review of the current The Last Dead checkout. One default-role review agent carried the actual six personality briefs independently; these were not six separately instantiated configured roles. All six profile files were read from `C:/Users/wolfk/Desktop/dogfight/.codex/agents/`:

- `carmack-doom-engine-judge.toml`
- `carmack-quake-systems-judge.toml`
- `cherno-cpp-architecture-judge.toml`
- `sweeney-unreal-platform-judge.toml`
- `animation-hotpath-owner.toml`
- `character-presentation-owner.toml`

These are adapted review lenses, not statements by the named real people. No claim of verified public-source lineage is made. Legacy Duals/Colyseus paths and architecture were adapted to this standalone Three.js game, its fixed simulation and WebRTC host authority; no other project's architecture was imported. The external research skills named by the original briefs were not invoked. Findings below are grounded in this checkout, not asserted equivalence to Doom, Quake, Hazel, or Unreal internals.

No game edits, browser actions, server changes, or runtime measurements were performed. Existing dirty performance work was preserved and is not treated as finished or independently verified. This document is the only write owned by this reviewer. Every experiment below is **proposed, not executed**. Exact line references describe the checkout inspected during this review and may shift with later edits.

Verdicts: **CONFIRMED** means the stated code mechanism is directly established; **RISK** means a plausible consequence requires an experiment; **UNVERIFIED** means the claimed runtime/visual outcome has not been measured; **NOT APPLICABLE** means the criticism does not fit the present product or evidence.

## 1. carmack-doom-engine-judge — bounded simulation, truthful instrumentation

> Your engine has a frame limit, but your FPS meter can conceal the stalls that damage the horror.

**Evidence:** [main.js:302](../../main.js#L302) clamps elapsed frame time to 100 ms before adding it to `fpsClock`. A 500 ms frame therefore contributes only 100 ms to the FPS denominator. The same line bounds the 120 Hz simulation accumulator. Canonical evidence path: `C:/Users/wolfk/Desktop/thelastdead/main.js:302`.

**Useful invariant:** Simulation catch-up remains bounded, while measurement records actual elapsed time. These clocks can have different policies without hiding stalls.

**Counterevidence:** The fixed step and capped catch-up prevent uncontrolled simulation work. `C:/Users/wolfk/Desktop/thelastdead/engine.js:18` explicitly separates gameplay from rendering. `C:/Users/wolfk/Desktop/thelastdead/docs/performance-audit.json:327` already acknowledges that its headless measurements cannot establish normal-play FPS.

**Verdict:** **CONFIRMED** inaccurate frame-rate accounting; actual playability consequences **UNVERIFIED**. The bounded simulation cap itself is not condemned.

**Smallest experiment — proposed, not executed:** Inject one 500 ms frame into an isolated test page and record raw frame duration, simulated duration, and reported FPS.

**Acceptance/kill criterion:** Keep bounded catch-up; telemetry must count the entire stall and report long-frame percentiles separately. Reject any smoothness claim based solely on the current HUD meter. No unbounded catch-up or engine replacement is needed.

## 2. carmack-quake-systems-judge — host authority and responsive movement

> The guest predicts movement, but correction is a positional compromise rather than a replay contract. Aggressive close combat is where that compromise will be exposed.

**Evidence:** `C:/Users/wolfk/Desktop/thelastdead/main.js:90` preserves 75% of the previous position for corrections below half a cell; larger corrections replace position outright. `C:/Users/wolfk/Desktop/thelastdead/main.js:302` sends snapshots/inputs at approximately 20 Hz while predicting guest movement at 120 Hz. These paths contain no acknowledged input history/replay.

**Useful invariant:** Host authority and local responsiveness should agree at collision and close-contact boundaries. The critique concerns that contract, not a requirement to reproduce any Quake version's architecture.

**Counterevidence:** Snapshot sequence rejection, retained local aiming, host damage authority, and bounded input freshness are explicit. This is a small WebRTC game, so Quake infrastructure should not be transplanted wholesale.

**Verdict:** **RISK**, not a demonstrated networking defect. Live correction severity is **UNVERIFIED**.

**Smallest experiment — proposed, not executed:** Two isolated peers, 100–150 ms RTT and jitter; repeatedly dash around cover, stop, and enter bite range. Measure correction distance and disagreement at contact.

**Acceptance/kill criterion:** Proposed gate: p95 corrections below 0.08 cell, no wall penetration, and no visible correction above 0.25 cell during ordinary movement. If it fails, test a minimal sequence/acknowledgment/replay path before adding more co-op contact mechanics. These numeric thresholds are proposed design gates, not existing verified requirements.

## 3. cherno-cpp-architecture-judge — ownership and inspectable failure

> A successful loading promise does not currently mean the intended character art loaded.

**Evidence:** `C:/Users/wolfk/Desktop/thelastdead/assets/survivor/meshy-survivor.js:116` catches asset failures and resolves with `status='fallback'`. `C:/Users/wolfk/Desktop/thelastdead/renderer.js:2189` awaits that promise alongside preparation resources, without requiring the intended survivor quality tier.

**Useful invariant:** Runtime resilience and art acceptance are separate outcomes. A fallback may satisfy playability while failing the intended presentation contract.

**Counterevidence:** Fallback preserves playable behavior; error strings remain available. `C:/Users/wolfk/Desktop/thelastdead/renderer.js:2490` exposes survivor status/source/error in diagnostics. This is resilience, not inherently bad architecture.

**Verdict:** **RISK** of QA accepting degraded presentation; no current asset failure is established. Current rendered quality is **UNVERIFIED**.

**Smallest experiment — proposed, not executed:** Block the survivor GLB in an isolated page and run the normal preparation/QA flow.

**Acceptance/kill criterion:** Runtime may remain playable, but the art acceptance check must fail visibly and identify the missing asset. Reject “ready” as proof of the intended presentation. This calls for an explicit acceptance condition, not an elaborate new abstraction or C++ lifetime model.

## 4. sweeney-unreal-platform-judge — stable authoring contracts

> Your export contract validates sections and clips, then trusts bone names that animation dereferences later. A small art revision can become a gameplay crash.

**Evidence:** `C:/Users/wolfk/Desktop/thelastdead/assets/survivor/meshy-survivor.js:24` validates visibility sections, and `:37` validates three clips. Animation later accesses `bones.Hips` at `:71`, leg bones at `:73`, and `bones.Spine02` at `:74` without corresponding intake validation.

**Useful invariant:** Assets admitted as ready contain every section, clip, and bone that runtime animation requires. The scale pressure is repeated art iteration, not hypothetical hundreds of maps or players.

**Counterevidence:** The bundled asset is fixed and versioned in its filename; required sections and clips already have explicit checks. There is no evidence the shipped asset lacks these bones.

**Verdict:** **RISK** at the authoring/runtime boundary. A current gameplay crash is **UNVERIFIED**.

**Smallest experiment — proposed, not executed:** Rename `LeftLeg` in a cloned test fixture and pass it through intake and slide playback.

**Acceptance/kill criterion:** Reject the fixture before gameplay, with the missing bone identified. A small required-bone list is sufficient and has low migration cost. Reject an Unreal-sized content framework unless actual scale demonstrates need.

## 5. animation-hotpath-owner — temporal consistency and contact

> The simulation and body mixer can advance by different amounts during a long frame. That threatens foot contact precisely when motion already feels unstable.

**Evidence:** `C:/Users/wolfk/Desktop/thelastdead/main.js:302` permits 100 ms of simulation catch-up. `C:/Users/wolfk/Desktop/thelastdead/renderer.js:2371` caps presentation dt at 50 ms; `C:/Users/wolfk/Desktop/thelastdead/assets/survivor/meshy-survivor.js:64` caps mixer advancement again. Locomotion rates use velocity at `:57–60`, rather than displacement accumulated over that frame.

**Useful invariant:** Translation and gait phase should remain credible together, even when presentation skips frames. Fix the measured boundary rather than taking ownership of unrelated startup or gameplay.

**Counterevidence:** Horizontal root motion is removed at `C:/Users/wolfk/Desktop/thelastdead/assets/survivor/meshy-survivor.js:11–16`, floor samples constrain feet at `:78–81`, and normal-rate animation is explicitly blended. Enemy Ash Witness gait separately uses real displacement in `C:/Users/wolfk/Desktop/thelastdead/npc-afterlife-model.js:287–327`.

**Verdict:** **RISK**; temporal and performance quality remain **UNVERIFIED**. Code inspection does not establish visible foot slipping or animation cost.

**Smallest experiment — proposed, not executed:** Record the same survivor movement at 60, 20, and 10 rendered frames per second; compare traveled distance against gait cycles and foot contact.

**Acceptance/kill criterion:** Proposed gate: visible foot slip below 0.15 m during ordinary walking, with no accumulating gait deficit after a stall. Change clock ownership only if this experiment demonstrates failure. The threshold is a proposed visual gate, not a measured result or a claim that 10 FPS is acceptable gameplay.

## 6. character-presentation-owner — authoritative state made readable

> The partner's body receives weapon state, but its ordinary pose does not express which weapon is being used. That weakens the credibility of co-op combat.

**Evidence:** `C:/Users/wolfk/Desktop/thelastdead/main.js:53–54` includes weapon and melee state in player snapshots. `C:/Users/wolfk/Desktop/thelastdead/assets/survivor/survivor-runtime.js:14` forwards peer state to `animateMeshySurvivor`; that animator at `C:/Users/wolfk/Desktop/thelastdead/assets/survivor/meshy-survivor.js:55–83` handles locomotion, slide, jump, and floor placement, without weapon-dependent pose or contact.

**Useful invariant:** Existing authoritative weapon and attack state should drive readable presentation. Do not invent parallel gameplay authority to solve a body-pose problem.

**Counterevidence:** Remote full-body rendering exists; the obsolete geometric placeholder is hidden in `C:/Users/wolfk/Desktop/thelastdead/assets/survivor/survivor-runtime.js:14`. Remote interaction layering exists in `C:/Users/wolfk/Desktop/thelastdead/brutal-combat-visuals.js:401` and `C:/Users/wolfk/Desktop/thelastdead/chest-finisher-visuals.js:98`. Local viewmodel handling is substantially richer.

**Verdict:** **CONFIRMED** missing ordinary weapon-pose integration in this path; rendered severity **UNVERIFIED**. This is not a claim that all remote interaction animation is absent.

**Smallest experiment — proposed, not executed:** Capture one peer standing, aiming, firing, and switching between shotgun, bat, and chainsaw, including temporal contact frames.

**Acceptance/kill criterion:** Weapon choice and committed melee state must be readable from the partner's body and held object, driven by existing authoritative state. Reject additional co-op presentation complexity until this basic parity passes. Require temporal evidence; still images alone cannot prove contact or transitions.

## Direction judgment

The engine does have direction: `C:/Users/wolfk/Desktop/thelastdead/README.md:3` states fast industrial horror with aggressive movement and co-op, and the simulation/presentation boundary supports that direction. These findings challenge whether the implementation delivers that promise consistently. They do not support declaring the game “not art.” A demand for replacing this engine with Doom, Quake, Hazel, Unreal, or Colyseus architecture is **NOT APPLICABLE** to the evidence and scope of this review.
