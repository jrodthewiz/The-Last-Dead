# Design and encounter council

Reviewed 2026-10-01. These seven reviews apply the actual profile briefs in `C:/Users/wolfk/Desktop/dogfight/.codex/agents/`. The profiles are inspired analytical lenses, not statements by their named creators or representatives of commercial games. No game files, servers, or browser sessions were changed. This report is code inspection and examination of existing evidence, not a new playtest.

The references demanded by the imported profiles were read from Dogfight's `duals-reference-research` and `duals-map-authoring` skills, including their source registry, quality lenses, map flow, prototype lineage, combat-space checklist, and editor/runtime contract. Duals-specific team fairness and Forge obligations were adapted to The Last Dead's actual modes. Solo Story is a five-floor descent; co-op starts the separate arena campaign with all weapons (`README.md:22`, `main.js:77`). No finding assumes Story co-op exists.

Status meanings: **CONFIRMED** is a source or documented-evidence fact; **RISK** is a plausible adverse player experience requiring a test; **UNVERIFIED** is a claim the inspected evidence cannot establish; **NOT APPLICABLE** is a lens requirement outside this game's mode or perspective. Proposed thresholds below are experiment targets, not existing measurements.

## 1. fps-gameplay-director — competing instructions in the reward loop

**Journey:** find the next room → enter → aim/fire → stagger/kill → take a recovery reward → move deeper. Success means the player's safest useful decision and the game's feedback reinforce a recognizable identity. Relevant cross-checks are the Romero space lens, Notch systems lens, and Modern Warfare contact lens; none takes priority by vote.

**Blunt criticism:** The game tells me to keep pushing, but its visible mastery reward tells me to stop and perform surgery on a corpse. Until the game establishes why that contradiction matters, it can feel like two genres sharing a HUD.

**Evidence:** `docs/direction-v2.md:3` and `:5` prioritize a fast descent and forward momentum. `engine.js:195–208` banks combat claims into visible style only after extraction; `:322` defines a nominal 2.38-second three-stage ritual, with seeded rate variation. `:424–443` requires held input and cancels for movement, firing, substantial turn, displacement, or damage. `ui.js:756` foregrounds STYLE, and `:899–910` distinguishes UNBANKED points and the extraction prompt. `engine.js:1755` decays banked style continuously. The earliest contract conflict is after a successful kill, at the decision to move forward or bank it, rather than at the firing controls.

**Counterevidence:** v3 explicitly revised combat toward holding a room and moving between fights (`docs/dungeon-v3.md:11`). Recovery windows are authored and health-sensitive (`dungeon-encounter-design.js:145–152`; `engine.js:835–836`). Extraction is cancellable and optional. It may deliberately make greed, desecration, and danger interact; no source proves that players experience it as busywork. Close-range hits already restore health (`engine.js:496–497`).

**Verdict:** **CONFIRMED** reward and interruption rules; **RISK** conflicting momentum/mastery incentives. The whole journey is **UNJUDGEABLE from this review alone**, not a certified FAIL.

**Smallest experiment:** gameplay/economy owner runs one unchanged opening route with six first-time players, without explaining extraction. Log extraction attempts, cancels, time stopped, room arrival, and stated reason for harvesting. Then compare a temporary version that presents the ritual as an explicit optional greed challenge rather than the default mastery instruction.

**Accept/kill:** retain the present presentation if at least four players understand the tradeoff and deliberately vary harvesting with threat/recovery state. Reject that presentation if at least four think harvesting every corpse is required or call repeated safe harvesting obligatory cleanup. This tests framing before changing a substantial system.

## 2. romero-fps-design-judge — room names may outrun encounter differences

**Reference basis:** Romero's [Reflections on DOOM's Development](https://rome.ro/news/2018/12/10/reflections-on-dooms-development), accessed 2026-10-01, describes the interplay of weapons, enemies, level design, and fast action, and recounts removing score/lives. That is a reason to question coherence, not a rule requiring this game to remove its score.

**Blunt criticism:** Calling a room “crossfire,” “pursuit,” or “flank” does not make the player experience those decisions. If every chamber ultimately asks me to hold until the queue is dead, the descent is a sequence of arenas wearing different costumes.

**Evidence:** `playground/map/dungeon-data.js:42–76` repeatedly assigns arrival, crossing, key retrieval, and holdout beats across floors. `dungeon-encounter-design.js:104–140` translates these beats chiefly into stage labels, population shares, lead times, spacing, and rests. `engine.js:728–733` gives Hold/Return guidance for every active encounter. `docs/dungeon-v3.md:17` reports 6–7 required combat stops per floor, and `:21` reports larger populations with staged pressure. These establish a repeated framework; they do not establish boredom.

**Counterevidence:** the framework sits in authored routes, not interchangeable rectangles (`playground/map/dungeon-data.js:35–40`). The Old Intake has a two-door recovery/pursuit loop (`:194–196`); Foundry Hall has an exposed long crossing and flank cover (`:198–204`); Pulse Court provides a southern circulation apron and multiple machinery sightlines (`:215–226`). Role mixes and late guards vary (`dungeon-encounter-design.js:17–81`). Named-room repetition is therefore not proof of identical fights.

**Verdict:** **RISK**, not CONFIRMED monotony. “No direction” is contradicted by the authored route and room identity contracts.

**Smallest experiment:** map/encounter owner tests the unchanged Ward → Vault → Hall → Pump opening. After each room, players sketch their useful positions, threat arrival directions, and meaningful choice. If the rooms blur together, prototype one crossing that ends through a spatial commitment rather than another full kill queue.

**Accept/kill:** keep a room's current encounter if four of six players identify a different tactical decision without being shown its beat label. Reject the proposed crossing variant if its decision is not understood, bypassing is trivial, or threat arrival becomes unfair. Do not change all five floors before this result.

## 3. notch-prototype-systems-judge — the signature ritual may have little systemic leverage

**Reference basis and limit:** the imported brief asks for a rapid-playability and small-rule lens. [Mojang's Brigadier README](https://github.com/Mojang/brigadier), accessed 2026-10-01, was consulted as the registry's public source, but a command-parser library does not establish Markus Persson's design philosophy. This finding is the local profile's analytical question, not a claim about his intent or Minecraft internals.

**Blunt criticism:** You built an elaborate heart-removal ceremony, but ordinary close-range damage already pays the survival reward. If extracting the heart only banks a score, the most distinctive action can become optional trophy processing rather than a rule that changes how I play.

**Evidence:** `engine.js:396–418` completes corpse extraction by recording extraction state, banking style, and issuing points/events; that function does not restore health or energy. `:496–497` restores health from close-range damage, and `:1499` regenerates energy at 22 units/second. `dungeon-landmarks.js:38–54` makes machinery react visually to encounter state; it does not give the player control of machinery. The ritual and machinery are real implemented systems, but their presence alone does not demonstrate rich interactions.

**Counterevidence:** style incentives already encourage varied attacks (`engine.js:1489`), and the committed extraction gate has genuine exposure and interruption rules (`:424–443`). Health from aggressive close combat can itself be the clear core rule. The tissue/counter system may intentionally exist for expressive horror and spectacle rather than survival optimization; artistic expression need not be reduced to a resource utility.

**Verdict:** **CONFIRMED** reward separation; **RISK** insufficient player-facing importance of the ritual. No claim that “simpler” is automatically better.

**Smallest experiment:** gameplay owner temporarily links one heart decision to one existing encounter consequence, such as trading a banked ritual reward for an earlier safe release. Use the existing room and assets. Compare with unchanged scoring; ask players what changed in their decisions, not whether the animation looked better.

**Accept/kill:** retain a prototype only if players can predict the rule after one demonstration and it creates at least two defensible choices in the same room. Kill it if it mandates extracting every body, reduces choices to farming, obscures existing recovery rules, or does not change behavior. A negative result supports keeping extraction as explicitly optional expression.

## 4. counter-strike-competitive-judge — darkness must preserve counterplay

**Scope:** team spawn equity, competitive rotations, utility economy, matchmaking, and spectator fairness are **NOT APPLICABLE** to solo Story. Transfer threat recognition, information cost, sightline commitment, and avoidable damage to player-versus-AI combat.

**Blunt criticism:** If I cannot identify the threat before it commits, darkness is taking away a decision rather than creating tension. A technically safe spawn is not enough.

**Evidence:** `docs/dungeon-v3.md:43` explicitly reports distant creatures remaining silhouettes; `:66` admits repeated creature silhouettes. `campaign.js:25–27` already gives different rush types different speeds, health, windup, and damage. These rules demand information that players may not distinguish under the final image treatment. This is a readability hypothesis, not an observed unfair death.

**Counterevidence:** real doorway approaches, shared visibility checks, collision, and arrival direction are documented at `docs/dungeon-v3.md:20–21`; phase/entrance cues exist at `:22`. Role-mixed staging is explicit (`dungeon-encounter-design.js:17–81`); material variants exist (`enemy-variation.js:115–136`). Atmosphere and surprise have a legitimate place in horror. Not every distant figure needs immediate exact identification.

**Verdict:** **RISK** for threat counterplay; actual recognition time and avoidable-damage rate are **UNVERIFIED**. The [CS2 Workshop Tools page](https://developer.valvesoftware.com/wiki/Counter-Strike_2_Workshop_Tools) returned 403 during this review. [Valve's Source SDK README](https://github.com/ValveSoftware/source-sdk-2013) was accessible, but covers HL2/HL2:DM/TF2, not private CS2 rules. No hidden CS tuning or franchise-equivalence claim is made.

**Smallest experiment:** encounter/readability owner records ordinary approach encounters at the intended engagement distances, with sound both on and off. Ask players to identify rush/ranged/anchor role before first damaging commitment; log recognition time and why a hit occurred.

**Accept/kill:** target 80% correct broad-role recognition before the action requiring its counter. Keep distant ambiguity if the needed information arrives in time through posture, motion, sound, or light. Reject a silhouette adjustment if it washes out the horror image without improving decisions. Do not judge fairness with a screenshot alone.

## 5. modern-warfare-feel-judge — the reticle and ballistic ray need a measured contract

**Reference basis:** Activision's [Movement Basics](https://blog.activision.com/call-of-duty/2019-10/The-Basics-of-Call-of-Duty-Modern-Warfare-Movement), accessed 2026-10-01, describes player-facing movement tradeoffs involving accuracy, audio, and weapon readiness. It supports testing coordinated responses; it does not require The Last Dead to copy its stances, ammo/reload rules, or proprietary implementation.

**Blunt criticism:** More camera contact is not better contact if the center mark is telling me a different story from the shot. Prove that your bodycam identity still lets me trust a precision aim.

**Evidence:** `renderer.js:2022–2028` explicitly adds visual-only view punch without changing authoritative `run.pitch`. `bodycam-motion.js:55–58` adds lateral/vertical mount position, pitch, and roll; `renderer.js:2001–2028` applies them. `engine.js:1483–1487` computes hitscan from simulation angle, pitch, and eye position. `styles.css:890–896` fixes the crosshair at screen center, and `ui.js:838–841` changes its state classes rather than projecting the simulation ray. Consequently the rendered camera ray and the authoritative shot ray can differ.

**Counterevidence:** preserving simulation aim from cosmetic recoil can intentionally prevent motion-induced accuracy penalties. `bodycam-motion.js:23` disables motion for reduced-motion settings, and `:36` steadies movement during aim. Rifle tests and hit/casing/pose evidence exist in `docs/combat-feel-pass/README.md`; they support implemented feedback and rig integrity. They do not measure every moving precision-shot projection.

**Verdict:** **CONFIRMED** separation of visual and ballistic transforms; **RISK** reticle ambiguity. Visible misses, their magnitude, and player frustration are **UNVERIFIED**. This review does not prove a player-aim defect merely by finding different rays.

**Action timeline/capture:** input → 120 Hz simulation (`main.js:302`) → shot event/hit → viewmodel/muzzle/bodycam presentation → hitmarker/audio. No fresh input-to-photon timing was measured.

**Smallest experiment:** camera/weapon owner overlays the projected authoritative shot ray in an independent development capture. Sweep walking, reversal, landing, normal/reduced motion, close cover, and successive marksman shots against a narrow target. Compare intended reticle, ray projection, actual trace, and target reaction frame by frame.

**Accept/kill:** target reticle error within one quarter of the intended precision target's projected width during actionable fire; if exceeded, test projecting the real ray or damping cosmetic pitch while aiming. Kill a proposed fix if it destroys the bodycam feel or increases input delay without improving aim prediction. Set the pixel tolerance from the target and viewport, not an arbitrary universal number.

## 6. fortnite-third-person-quality-judge — test transferable resilience, reject perspective mismatch

**Scope and reference:** Epic's [Third Person Template documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/third-person-template-in-unreal-engine), accessed 2026-10-01, covers a third-person foundation. The Last Dead's own camera is first-person (`renderer.js:1988–2028`). Shoulder composition, shoulder swapping, and third-person camera wall occlusion are **NOT APPLICABLE**; converting this game to third person is not a quality fix.

**Blunt criticism:** A portrait screenshot proves that the HUD fits; it does not prove I can survive with my thumbs. Do not mistake presentation resilience for control resilience.

**Evidence:** `ui.js:766` provides directional, dash, slam, weapon, hook, alt, parry, fire, jump, and contextual extraction touch controls. `docs/dungeon-v3.md:66` explicitly says mobile touch play is not certified. This is a documented gap in player-journey evidence, not proof that controls fail.

**Counterevidence:** touch actions and canvas drag-to-look are implemented (`main.js:170–174`), and portrait screenshots/overflow checks are documented (`docs/dungeon-v3.md:40–41`). Input reset and gamepad suppression exist (`main.js:62`). First/remote-person parity should be judged in the arena co-op mode, not inferred from single-player Story. The simple legacy peer-avatar helper is overridden by survivor rendering (`assets/survivor/survivor-runtime.js:13–18`); it must not be presented as the normal final peer model.

**Verdict:** third-person camera criteria **NOT APPLICABLE**; portrait combat/input recovery **UNVERIFIED**.

**Smallest experiment:** input/UI owner runs one ordinary portrait encounter on a real touch device, then tests cancel/lost pointer capture, app focus loss, pause/resume, simultaneous look/fire/move, and contextual extraction. Separately capture arena co-op counterpart stance and action if parity is claimed.

**Accept/kill:** pass when no action sticks after interruption, all required primary actions remain reachable while moving/looking, and one full encounter/retry completes without debug automation. Reject a control rearrangement if it merely fits the screen while reducing simultaneous action access. This test needs no third-person feature work.

## 7. map-authoring-owner — reachability does not certify encounter pace

**Mode/ownership:** solo Story, existing eight-weapon progression and dash/slide/grapple movement. Canonical authoring is `playground/map/dungeon-data.js`; compiler output feeds `playground/map/dungeon-course.js`, which exposes rooms, route, ingress, collision/topology, keys, loot, and flow to the runtime. Forge publishing and a multiplayer Story launch are **NOT APPLICABLE** here. Map playground retune/paste workflows are documented at `README.md:72`.

**Blunt criticism:** Your route contract is stronger than your evidence that the route is worth playing. A green traversal test can certify that every room is reachable while saying almost nothing about whether crossing the floor is memorable, exhausting, or tedious.

**Evidence:** `playground/map/dungeon-course.js:102–141` turns authored route and compiled room data into runtime flow and identity. `playground/map/dungeon-compiler.js:440–462` reports geometry/topology metrics and enemy budget, not observed human engagement. `docs/story-progression-performance.md:90–91` states that some full-descent fixtures mark enemies defeated to isolate reachability; `docs/dungeon-v3.md:39` reports a three-minute run using debug aim reaching four rooms, and `:66` explicitly leaves a full human campaign uncertified. The testing limits are disclosed correctly; the criticism applies if those checks are used to claim pacing completion.

**Counterevidence:** render and collision come from one edited source (`docs/dungeon-v3.md:19`), sightlines and route gates have focused tests (`:18–20`, `:30–33`), and independent live arrivals exist (`:39`, `:43`). Those are substantial evidence of a functioning authored map. No actual editor/runtime divergence, topology softlock, or unfair spawn was established by this review.

**Verdict:** topology and authored-direction implementation have supporting documented evidence; complete human pacing, tactical verticality, recovery-route usefulness, and session completion remain **UNVERIFIED**, not failed.

**Smallest experiment:** map/encounter owner observes one whole unchanged Floor 1 run by six first-time players, without debug aim, relocation, kill clearing, or route coaching. Record first contact, per-room threat/idle/travel time, deaths, wrong turns, side-route choices, and whether players can identify landmarks before reading labels.

**Accept/kill:** target five of six players reaching the lift or a clearly understood retry without unexplained stalls; flag any mandatory segment with over ten seconds of player-reported purposeless waiting, and any repeatedly unused recovery route. Retune only the worst demonstrated room first. Reject a population increase if it adds time without adding a distinguishable decision. These targets do not constitute a current measured pass.

## What this council can and cannot conclude

The evidence does not support “there is no direction”: bodycam presentation, industrial/ritual spaces, authored floor routes, room identities, close-combat recovery, and narrative records are explicit. It supports the harsher and more useful challenge: **the systems must prove that they produce one recognizable player experience rather than merely coexist.** None of these profiles can establish that the game is or is not “real art” from a source scan.

The most concrete investigation is camera/reticle/shot-ray alignment. The most important design experiments concern the relationship between momentum, extraction, and repeated Hold/Return encounters. Existing older screenshots were inspected only as historical artifacts; they were not treated as current gameplay observations. No new tests or human playthroughs were run for this report.
