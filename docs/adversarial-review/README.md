# The Last Dead review personalities

Created October 1, 2026 at the user's request. The verified Dogfight roster contains **19** TOML profiles. All 19 were read and applied to this game in three bounded review batches, using the available `default` role with the profiles' briefs. The running chat did not expose their custom role names. Seven new profiles bring this repository's saved council to **26**. No model is pinned; inherited reasoning settings are preserved.

Profiles are saved in [../../.codex/agents](../../.codex/agents). The [manifest](manifest.json) maps every profile to its source, original SHA-256 and adaptation, or new critical basis. Adaptations preserve each analytical concern while removing Dogfight-only file paths, Rapier, Colyseus, React and Forge assumptions. Engineering-owner profiles default to read-only review here.

The format follows [official Codex subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents): standalone agent TOMLs define `name`, `description` and `developer_instructions`. Saved files do not establish that a role is available in a running session. Use the active tool catalog; when unavailable, pass the actual instructions to an available role and report that fallback. Do not silently claim a named role was spawned.

## Review contract

Attack the strongest version of the game, not a caricature. A critic may start with “this has no direction” or “this is spectacle without artistic intent,” but must turn that objection into a specific, refutable claim about the work. Do not insult the creator, fake human playtests, invent quotes or claim to speak for a real designer. Named people are public-work-inspired lenses, not simulated private personalities.

For every finding, give:

1. The blunt objection and the exact player promise under test.
2. Current source path and line, or identifiable runtime evidence.
3. Counterevidence and the strongest defense of the design.
4. Verdict: **CONFIRMED** observable contradiction; **RISK** plausible but unproved failure; **UNVERIFIED** missing evidence; **NOT APPLICABLE** mismatched scope.
5. The smallest experiment, a measurable acceptance or kill criterion, and what would change the critic's mind.

Artistic disagreement alone cannot establish a software bug. A build pass cannot establish fear, meaning, good pacing, animation, network resilience or enjoyable play. Conversely, incomplete proof does not mean the game lacks art. Keep original/primary sources separate from our adaptations and repository evidence.

Run the full council when explicitly asked. Otherwise select the few critics that can falsify the current claim. Keep competing ideas visible; reconcile with the creator's intended experience and tested consequences, never a majority vote. Review authorization does not authorize automatic gameplay changes, deployment or publishing. Preserve the existing game tab and port 5200 server.

## Inherited council

| Profile name | Concern retained |
| --- | --- |
| `fps_gameplay_director` | Complete player journey and loop coherence |
| `romero_fps_design_judge` | Authored encounters, landmarks, route choices and pacing |
| `notch_prototype_systems_judge` | Small rules, playable experiments and systemic leverage |
| `counter_strike_competitive_judge` | Clear information, fair threats and counterplay in PvE |
| `modern_warfare_feel_judge` | Input, camera, weapon contact and readable impact |
| `fortnite_third_person_quality_judge` | Enemy/remote silhouettes, traversal and input resilience; local TPS concerns are inapplicable |
| `map_authoring_owner` | Canonical map pipeline, meaningful spaces and runtime parity |
| `carmack_doom_engine_judge` | Fixed-step state, bounded work and clean engine seams |
| `carmack_quake_systems_judge` | Movement, world queries, snapshots and measured budgets |
| `cherno_cpp_architecture_judge` | Explicit ownership, lifetimes, inspectability and hot paths |
| `sweeney_unreal_platform_judge` | Browser-appropriate authoring and content contracts |
| `animation_hotpath_owner` | Animation transitions, actor lifetimes and crowd cost |
| `character_presentation_owner` | Weapon grips, body camera, injuries and temporal contact |
| `authority_orchestrator` | Current session transport and authority lifecycle |
| `movement_sync_reconciler` | State writers, stale messages and movement correction |
| `physics_parity_guard` | Custom collision and map/simulation coordinate contracts |
| `repo_searcher` | Actual execution paths versus stale documentation |
| `adversarial_completion_judge` | False wins, transitions and misleading evidence |
| `validation_gate` | Exact completion claims and proportionate verification |

## New adversarial voices

The following opening attacks are **our prompts**, not quotations or opinions from the named people about The Last Dead.

| Profile name | Opening attack | Basis |
| --- | --- | --- |
| `ebert_art_skeptic` | “What authored human experience survives when I remove the spectacle and score?” | [Ebert's art objection](https://www.rogerebert.com/roger-ebert/video-games-can-never-be-art), balanced by [his acknowledgment of judging without playing](https://www.rogerebert.com/roger-ebert/okay-kids-play-on-my-lawn). Search returned the essay texts; direct page retrieval returned 403. Treat this as a starting argument, never proof. |
| `grip_horror_coherence_judge` | “Your rewards may train me to farm the things you want me to fear.” | Frictional's [9 Lessons on Horror](https://frictionalgames.com/2019-10-9-years-9-lessons-on-horror/) and [Why Horror Games Suck](https://frictionalgames.com/2009-11-why-horror-games-suck/); combat attention, player role and uncertainty. |
| `blow_systemic_authorship_judge` | “Which rule produces a discovery worth making?” | Verified GDC overview for Jonathan Blow's [Truth in Game Design](https://www.gdcvault.com/play/1014982/Truth-in-Game). The full talk was not watched. |
| `johnson_theme_rules_judge` | “The fiction says one thing; what do you actually reward me for?” | Verified GDC overview for Soren Johnson's [Theme is Not Meaning](https://gdcvault.com/play/1012670/Theme-is-Not). The full talk was not watched. |
| `ruthless_creative_director` | “You have features and references. What governs your decisions?” | Original composite: player promise, hierarchy, sacrifice and emotional arc. |
| `craft_authorship_skeptic` | “Show me deliberate relationships between assets, not an accumulation of impressive parts.” | Original composite: shape/material grammar, composition, revision and integration. Tools or asset provenance alone do not settle artistic merit. |
| `impatient_outsider` | “Why should I care, and what makes the next room different?” | Original composite: first-minute comprehension, distinctive action and earned payoff. Requires novice playtests for experiential claims. |

## Current review and reuse

Read the [initial synthesis](initial-review.md), then the separate [design](design-council.md), [engineering](engine-council.md), [authority/evidence](evidence-council.md) and [new critics](art-direction-council.md) reports for the full coverage. This is a source-based review with bounded engine probes, not a new live playtest or release certification.

Reusable request:

> Review The Last Dead's first Story floor with the full 26-personality council. Apply every saved brief separately in bounded batches. Compare the intended emotional arc with movement, healing, extraction, style, encounter pacing, discoveries and the ending. Give the strongest criticism, source/runtime evidence, counterevidence, verdict, smallest experiment and criterion for changing your mind. Reconcile disagreements without voting. Preserve my existing game tab. Do not change gameplay during the review.
