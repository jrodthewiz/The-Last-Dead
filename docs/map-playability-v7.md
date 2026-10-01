# Map playability pass

This pass makes the five Story floors play according to their authored themes, routes and room budgets. It retains the existing art, weapons, player movement and combat mechanics. The work was split between topology, encounter design and arrival safety, with integration and browser QA handled centrally.

## Flow and progression

| Key return | Previous path | Repaired path | Saved |
| --- | --- | --- | --- |
| Surgical Scrub Vault to Theater | 180 m / 18 turns | 52 m / 3 turns | 128 m |
| Bell Tower to Court | 148 m / 11 turns | 76 m / 5 turns | 72 m |

The Scrub threshold previously missed its room; the north transept also missed its aisle and cut a court corner. Both connections now belong to their real room footprint, with continuous player clearance. The key positions and hero landmarks stay fixed. The deliberate reliquary and final vault return journeys remain.

The opposite sides of the F4 and F5 exit thresholds were always-open arches. They reopened the collision edge of the keyed gate. Both sides now share the key requirement and unlock together. Every floor keeps its key reachable before its physical descent opens; required fights still control descent readiness.

Guidance uses authored room objectives. It leads players to reachable, uncollected main-route equipment before the next required fight: the Foundry shotgun and Surgical automatic rifle. Combat holds take priority, and collecting equipment resumes the forward route. Optional off-route equipment stays a player choice.

## Pressure and theme

The engine previously padded most rooms with generic enemies and inflated their simultaneous population by floor depth. Room budgets, enemy composition and maximum active counts now control the real queue. The composition weights become deterministic populations; fast, ranged and anchor roles interleave, with stronger guards reserved for the last key/climax phase.

| Floor | Previous total queue | Authored total now | Required now | Experience |
| --- | ---: | ---: | ---: | --- |
| Intake Foundry | 119 | 62 | 58 | Tight ward contact, pump pressure and a three-part engine holdout |
| Graft Galleries | 126 | 66 | 52 | Isolation fights, equipment release, a short key return and theater ambush |
| Catacombs | 153 | 84 | 61 | Deliberate sentries, crypt pursuit, Bone Court climax and guarded reliquary |
| Resonance | 167 | 92 | 81 | Choir enemy roles, a readable nave crossing, tower return and Mouth Altar holdout |
| Last Descent | 136 | 85 | 85 | Compressed arrival cadence, guarded vault, organ pressure and a three-part last stand |
| Total | 701 | 389 | 337 | Required queue was 634 |

These totals count authored encounter queues. The optional patrol director can add separate packs, so 389 is not a hard maximum for a complete run.

Arrival and close/pursuit encounters have one phase. Crossings, pressure lanes and key rooms have two. Holdouts and the finale have three, with authored breathing intervals between approaches. Room-clear recovery is longer after key retrieval and climaxes, with additional relief for a wounded living player.

Defended equipment rooms advertise combat and become recovery spaces after clearing. Quiet caches remain protected from optional patrols, including when a co-op partner occupies one. Secret rewards now match implemented health/energy contents rather than promising armor, ammo or permanent maximum-health upgrades. The final energy reserve restores up to 100 energy; full-health/full-energy players do not waste the pickup.

## Arrivals and readability

Safe spawn pads now rank by estimated walking time for the actual enemy role. Ranged and anchor enemies walk purposefully to the entrance, then return to their normal combat gait. The F2 entry caster's measured ingress dropped from 21.1 seconds to 10.6 seconds. All arrivals retain real doorway paths, offscreen checks for every living player, minimum distance, pad reservations and safety revalidation. Optional patrols now receive the same full half-second warning as required arrivals; unsafe commitments cancel.

The touch HUD has a dedicated status row above the two action rows. Health, dash status and weapon resources remain readable in narrow portrait and coarse-pointer landscape layouts, with safe-area spacing and at least 44-pixel action targets.

## Verification

The consolidated simulation suite passed **126/126** tests. It covers engine/AI behavior, all-five-floor entry/key/descent journeys, physical and rendered gate updates, 30/60/120 Hz warning timing, co-op reservation/cancellation/recovery, authored populations and phase composition, pickups, route topology, the v6 nave/vault invariants, and HUD state. Log: `output/playwright/map-playability-v7/simulation-tests.txt`.

`node build.mjs` passed and includes the new policy module. An isolated copy at `output/playwright/map-v7-runtime` passed syntax checks for every non-vendor runtime JavaScript module; engine, policy and HUD hashes match the current source. Initial QA against a concurrently updated `dist` saw a transient duplicate identifier in a rendering dependency; the stable snapshot removes that interference.

Browser world checks passed: all five rendered floor arrivals matched their authored budgets, and ordinary forward input traversed the repaired surgical and bell return passages. The later touch spacing assertion found insufficient separation; a targeted rerun after the CSS correction passed at 390×844, 350×740 with critical health, and 844×390 with Chromium coarse-pointer emulation. Status-to-control clearance was 20, 30 and 5 pixels respectively; every action target is at least 44 pixels, with no horizontal overflow. Pause/resume/restart passed. The targeted run recorded no page, console, asset or request errors. A second-context preload initially hit the machine's socket-buffer limit; the successful rerun reused the already-loaded page.

The 180-second rendered combat run passed with **four rooms cleared, 23 sampled kills, 31 grounded doorway arrivals, zero deaths and zero runtime errors**. It exercised the shotgun equipment route, guarded key retrieval, the second key phase, and hall crossfire. Movement and firing were ordinary browser inputs with scripted aiming/navigation; this is automated playtesting. All ten world/touch screenshots passed center-scene pixel checks (means 19–41, 197–247 distinct byte levels).

Combined evidence: `output/playwright/map-playability-v7/validation-summary.json`. Original world/route evidence: `output/playwright/map-playability-v7/report.json` (preserves the subsequently corrected touch assertion). Final touch evidence: `output/playwright/map-playability-v7-touch/report.json`. Combat evidence: `output/playwright/map-playability-v7-live/report.json`. Scene-pixel checks: `output/playwright/map-playability-v7/pixel-checks.json`.

Representative screenshots: `surgical-key-return.png` and `bell-tower-return.png` in the world evidence directory; `portrait-350.png` and `touch-landscape.png` in the touch directory; `reinforcement-approach.png` and `sustained-combat.png` in the live directory.

Headless combat samples were approximately 20 FPS during the key phase and 10 FPS in sustained combat, with 356–381 calls and 1.30–1.46 million triangles. These shared-machine measurements show no established performance improvement. Rendering/anatomy/corpse cost needs separate profiling; reduced queues do not establish a frame-rate fix.

## Skill-loading ledger

Loaded guidance: `threejs-game-director`, gameplay systems, AAA graphics, game UI, debug/profile and QA/release. The gameplay, UI and QA phases were executed; the earlier v6 architecture remains. AAA graphics guidance was reviewed for integration constraints; new asset generation, audio generation, physics replacement and deployment are outside this playability pass. Existing bundled art and sounds are reused.

Paths in these ledgers are relative to `C:/Users/wolfk/.codex/skills/`.

| Skill source | Loaded | Failure |
| --- | --- | --- |
| `threejs-game-director/SKILL.md` | Yes | None |
| `threejs-gameplay-systems/SKILL.md` | Yes | None |
| `threejs-aaa-graphics-builder/SKILL.md` | Yes | None |
| `threejs-game-ui-designer/SKILL.md` | Yes | None |
| `threejs-debug-profiler/SKILL.md` | Yes | None |
| `threejs-qa-release/SKILL.md` | Yes | None |

## Reference ledger

Loaded gameplay workflows and physics-engine selection; UI patterns and the HUD readability, game UI quality, mobile input and responsive fit checklists; debug/profile checklists and performance profile; QA/release checklists, visual verification, playtest QA and release guidance. Existing graphics references from v6 cover the implementation blueprint, procedural models, materials/lighting, render recipes, visual scorecard and performance checks. No claim of a new premium graphics or performance pass is made.

| Active reference source | Loaded | Failure |
| --- | --- | --- |
| `threejs-gameplay-systems/references/gameplay-workflows.md` | Yes | None |
| `threejs-gameplay-systems/references/physics-engine-selection.md` | Yes | None |
| `threejs-game-ui-designer/references/ui-patterns.md` | Yes | None |
| `threejs-game-ui-designer/references/checklists/game-ui-quality.md` | Yes | None |
| `threejs-game-ui-designer/references/checklists/hud-readability.md` | Yes | None |
| `threejs-game-ui-designer/references/checklists/mobile-input.md` | Yes | None |
| `threejs-game-ui-designer/references/checklists/responsive-ui-fit.md` | Yes | None |
| `threejs-debug-profiler/references/debug-profile-checklists.md` | Yes | None |
| `threejs-debug-profiler/references/checklists/performance-profile.md` | Yes | None |
| `threejs-qa-release/references/qa-release-checklists.md` | Yes | None |
| `threejs-qa-release/references/checklists/visual-verification.md` | Yes | None |
| `threejs-qa-release/references/checklists/playtest-qa.md` | Yes | None |
| `threejs-qa-release/references/checklists/release.md` | Yes | None |

## Phase ledger

| Phase | Result / evidence |
| --- | --- |
| Gameplay systems | Authored room queues, pacing, route repairs, equipment guidance, key barriers and recovery; deterministic regressions and all-floor engine journeys |
| AAA graphics | Existing art/lighting retained; route changes reuse the architectural kit and preserve the v6 clear nave lanes |
| UI | Responsive health and touch-action separation; browser geometry checks and screenshots |
| Debug/profile | Role ingress timings measured; existing combat rendering remains a separate performance concern |
| QA/release | Production build, isolated browser movement and views, live combat, pause/resume/restart, page/console/network error checks; no publication |

## Scope and risks

These are automated movement/combat and progression checks, not a human balance playtest of the full campaign. The smaller authored populations and specialized enemy mixes change difficulty and campaign duration intentionally. Sustained combat performance was already weak in the v6 measurement; this pass does not claim to resolve the anatomy/corpse rendering cost. The existing game tab and server are preserved. Refresh at a suitable stopping point to load the changes.
