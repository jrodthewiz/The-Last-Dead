# Dungeon map and enemy behavior iteration

This pass makes the map more useful during combat and makes backup creatures keep pressure when their teammates already hold the attack slots. The earlier route, bodycam, weapon, audio and grounded doorway systems remain the foundation.

## Applied changes

- Old Intake is an optional equipment room with a narrow return to the southeast side of Foundry Hall. It creates an escape and re-entry loop during the hall fight. The return joins before the Pump gate and cannot bypass it. A warm fixture and “← HALL” plaque mark the bend. Its cabinet and crates were moved clear of the actual camera path after browser inspection exposed a visual obstruction that grid-collision tests could not catch.
- Pulse Court expands from 39 to 59 walkable cells and Surgery Theater from 35 to 46. The pulse engine and operating table keep their anchors; added southern staging and side room support circling and cover choice.
- The shortest first-floor entry-to-exit path remains 148 m. The new passage adds choice without increasing required backtracking. The five-floor key and descent route still completes in simulation.
- Waiting melee creatures now close toward an attack ring while other creatures occupy the melee slots. The previous ring sign sent them away. In a deterministic six-second scenario, distance from the player goes from 4 cells to 2.12 rather than 5.77. The attack slot limit and windup still gate damage.
- Hunters unable to reach a flank through a wall try the opposite shoulder, then press forward through the open lane.
- Encounter phases open with a pair at a readable entrance, then favor another safe available doorway. The spawn still needs a real open route and stays unseen by both players at warning and commitment. Each new approach gets its own directional cue. Single-door rooms continue using their one entrance.

## Verification and limits

- 51 integrated map, route, door, spawn, engine and AI tests pass. They cover five-floor progression, portal crossing, both-player spawn safety, map render/collision agreement, multi-door contact, narrow corridors, attack-slot fairness, and 30/60/120 Hz motion.
- Production build and 51 integrated gameplay/map/AI tests pass. Four focused map-design checks also pass after moving the cabinet, including clearance from the new return opening.
- Desktop and portrait composition captures pass without page, console or request failures. Inspected Pulse Court's southern apron, Surgery Theater's staging shelf, and the final Old Intake eye-level doorway/sign in `output/playwright/dungeon-v4-lit/`, `dungeon-v4-bend-sign/`, and `dungeon-v4-doorway-clear/`.
- A 120-second production browser run with real movement/fire input and debug aim passed: 47 kills, 47 doorway spawns, four cleared rooms (three required and optional Sluice), 10 encounter phases, 18 entrance cues, no deaths, and no browser/network errors. Captured combat around 59–60 FPS with 303–384 draw calls; portrait around 55 FPS with 269 calls on this test machine. These measurements do not guarantee other devices.
- The standard web-game input client also completed two iterations and produced screenshots/state records in `output/playwright/dungeon-v4-skill-client/`. Its short blind input sequence is a control smoke test; combat/progression evidence comes from the separate 120-second run.
- The layout measurements and independent map checks are in [map-layout-iteration.md](map-layout-iteration.md). Measurements use the compiler's fully open topology; the shortest path is not the full encounter route.
- Enlarged arenas still reuse modular architecture, and the enemy roster retains its existing silhouette family. This is another demo iteration, not a premium visual claim.

## Workflow ledger

The Three.js game director workflow continued from v3. Map and AI phase workers loaded the gameplay systems skill, its gameplay workflow reference and physics selection reference, then used the existing custom grid collision. The parent integrated encounter selection and browser QA. Existing bundled models, textures and audio were reused; no new paid or generated assets were required for these layout and behavior changes. The asset sourcing and earlier graphics/QA reference ledger remain in [v2 implementation report](v2-implementation-report.md) and [v3 direction](dungeon-v3.md).

### Skill-loading ledger and external asset sourcing

The previously loaded director workflow includes gameplay systems, AAA graphics, game UI, debug/profile and QA/release. Its 3D generator, image generator and audio generator sourcing skills were evaluated in v2; this pass improves existing low-value support geometry and enemy logic, so no new model, texture or sound was generated. Chosen sources: hero/player, enemies and weapons are the bundled modeled assets; world/sky/background uses the authored dungeon kit; materials/textures/decals reuse the bundled packs and generated enamel atlas. The prior credential probe output recorded in v3 was:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

### Phase ledger

Gameplay systems: room circulation, phase ingress and enemy movement. Physics engine: the existing fixed timestep and grid collider; no new dependency. AAA graphics: reused hero geometry and added one bounded, readable plaque; no premium claim. Game UI: each new door cue uses the existing entrance UI. Debug/profile: inspected camera occlusion at the new doorway, measured renderer draws and FPS. QA/release: production build, actual input browser run, page error/HTTP error checks, desktop and mobile portrait screenshots, canvas composition and scene pixel visibility. Mobile touch play and a full human campaign are outside this automated verification.

Conservative 0–3 visual scorecard: art direction 2, hero/player 2, obstacles/enemies 2, rewards/interactables 2, world/environment 2, materials/textures 2, lighting/render 2, VFX/motion 2, UI/HUD 2, performance evidence 2; average 2.0. Automatic failures/limits: modular architecture repeats, the enemy silhouette family is still narrow, and the long-range threat remains intentionally dark. No premium or AAA status claimed.
