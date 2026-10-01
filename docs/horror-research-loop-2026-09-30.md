# Fear, disgust and psychological horror research for The Last Dead

Research date: September 30, 2026. Status: source research and encounter specifications complete; prototypes and human playtests pending.

The proposed direction is **a place that gradually learns the player's body and behavior**. Its machinery repeats movement rhythms, its specimens appear to recognize the player, and its infestation moves from distant scenery into personal space. This gives the foundry, ward and ossuary a connected horror language while retaining the game's fast movement and combat.

The research supports distinguishing anticipated danger, contamination disgust, skin-crawling sensations, vicarious pain and uncanny perception. The particular encounters below are design hypotheses, not scientifically demonstrated effects in this game. A useful outcome is an encounter that players find frightening, understandable and worth continuing through.

This follows the [September 23 research report](psychological-horror-research-report.md) and [earlier horror plan](psych-horror-plan.md). The current source inspection takes priority over their historical implementation descriptions.

## Research loop completed in this pass

1. **Find mechanisms:** inspect primary experiments on threat uncertainty, parasite cues, injuries, audiovisual perception, sound and recreational horror.
2. **Challenge the first interpretation:** distinguish arousal from reported fear; distinguish contamination from injury empathy; check counterevidence to a universal uncanny valley; separate source findings from game applications.
3. **Translate and prioritize:** inspect the current game, check developer accounts of existing horror games, and specify controlled experiments with rejection criteria.

The next loop requires playable prototypes and player responses. No fear scores or playtest results were collected in this pass. This is a bounded research pass, not a scheduled monitor.

## What to target

These are design targets, rather than a proposed clinical classification.

| Target | The player interpretation to create | Candidate stimulus | Distinguishing measurement |
| --- | --- | --- | --- |
| Anticipatory dread | Something may happen; I cannot locate or time it yet | A meaningful sound behind cover, followed by a changed response | Expected-threat rating before the reveal |
| Immediate fear | Something is approaching or about to attack | Audible approach, clear source, committed attack | Reported fear plus dodge or retreat behavior |
| Contamination disgust | I do not want this touching me or my equipment | Residue crossing a boundary from specimen to handle or glove | Contact avoidance and disgust rating |
| Skin crawling | Something may be moving on my body | Small directed movements disappearing beneath a cuff | Skin-crawling rating, separate from nausea |
| Squeamishness | I can imagine how that would feel | A small strain or pressure deformation at a recognizable body part | Vicarious discomfort, separate from infectiousness |
| Uncanny unease | It resembles something familiar but behaves incorrectly | Mostly coherent human motion with one deliberate mismatch | Eeriness and animation-bug attribution |
| Psychological recognition | The place seems to remember what I did | A room-specific echo of an earlier movement rhythm | Perceived responsiveness and later recollection |

The candidate stimuli in this table are our hypotheses. The following evidence explains why they are worth testing and where the inference is weak.

## Evidence and limits

| Mechanism | Verified finding | Application and limitation |
| --- | --- | --- |
| Parasites versus pathogens | Across three studies in the US and China, 1,079 participants viewed relevant videos. Ectoparasite cues elicited more responses directed at guarding the skin; pathogen cues elicited more ingestion and contamination responses. [Kupfer et al., 2021](https://pubmed.ncbi.nlm.nih.gov/34315263/) | Good evidence for separating skin crawling from stomach-turning disgust. It does not establish that tiny animated insects in an FPS reproduce the effect. |
| Injuries versus infection | Four studies distinguished reported disgust at injuries from infection-related disgust. Injury responses were associated with empathy and vicarious pain; participants were more reluctant to touch dressings associated with infections than equally disgusting injuries. [Kupfer, 2018](https://pubmed.ncbi.nlm.nih.gov/29389204/) | A precise, legible strain or injury may serve a different purpose from slime and decay. The studies do not prescribe a gore amount or an optimal injury animation. |
| Clustered textures | Disease-relevant clusters produced aversion in both studied groups; harmless clusters produced aversion primarily in the trypophobic group. Responses were predominantly disgust, with some reports of skin sensations. [Kupfer and Le, 2018](https://pubmed.ncbi.nlm.nih.gov/28681640/) | Test clusters in a specific biological context. A repeated hole texture is not a universal fear switch. |
| Threat uncertainty | In a probabilistic shock-learning task, subjective stress, pupil diameter and skin conductance tracked changing uncertainty. [de Berker et al., 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4820542/) | Supports uncertain anticipation as a research direction. Shock stress is not recreational horror; it does not justify random damage or an optimal 50% scare probability. |
| Player agency | Horror-game players showed greater changes in heart rate, respiration and electrodermal activity than watchers. Self-reported fear did not significantly differ. [Madsen, 2016](https://www.sciencedirect.com/science/article/pii/S0747563215302569) | Preserve participation and meaningful choices. This study does not prove that action-responsive walls are scarier, or that physiological arousal equals fear. |
| Rough sound | Acoustic, behavioral and imaging experiments linked the alarm quality of screams to temporal roughness, including modulation around 30–150 Hz. [Arnal et al., 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4562283/) | Test short rough textures at matched perceived loudness. This range describes modulation, not a hidden bass pitch that guarantees fear. |
| Approaching sound | A study using individualized spectral cues found behavioral and EEG evidence of an approaching-sound bias while controlling overall loudness. [Baumgartner et al., 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5594652/) | Test perceived approach separately from volume escalation. Generic browser HRTF playback may not reproduce individualized laboratory cues. |
| Encounter sequence | A PC horror study tested two event sequences with 24 participants; 32 of 48 runs had usable physiological data. Event order affected responses and sound contributed to tension. [Graja, Lopes and Chanel, 2020/2021](https://phil-lopes.com/wp-content/uploads/2020/06/graja_lopes_chanel_impactvisual_2020.pdf) | Test setup, cue, reveal and recovery as a sequence. The small sample and data loss limit generalization; silence has no universal best duration. |
| Appearance and motion mismatch | An fMRI study compared a human, robot and human-looking android. Appearance–motion mismatch produced distinctive responses in the action-perception system. [Saygin et al., 2012](https://pubmed.ncbi.nlm.nih.gov/21515639/) | Supports a hypothesis about violating familiar movement expectations. The neural finding is not a measurement of game fear. |
| Counterevidence on motion | Parametric changes to walking-avatar motion produced monotonic changes in humanness, familiarity and eeriness ratings rather than an uncanny-valley curve. [Thompson, Trafton and McKnight, 2011](https://pubmed.ncbi.nlm.nih.gov/21936298/) | Do not assume increasingly broken animation becomes increasingly frightening. Deliberate motion still needs a coherent body and believable contact. |
| Morbid curiosity | Three studies found that people sometimes chose negative images. Social scenes involving harm were more frequently selected than decontextualized injury or natural-threat images. [Oosterwijk, 2017](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0178399) | Give disturbing details a question or consequence worth investigating. These image choices do not demonstrate retention in a horror game. |
| Fear and enjoyment | A haunted-attraction field study with 110 volunteers found an inverted-U relationship between reported fear and enjoyment. [Andersen et al., 2020](https://journals.sagepub.com/doi/pdf/10.1177/0956797620972116) | Measure enjoyment alongside fear. The observational finding does not specify a universal scare intensity or pacing curve. |

Access notes: publication metadata and author abstracts were checked for these papers. The Graja, Andersen and Oosterwijk full texts were also inspected. Some NCBI full-text opens returned a browser challenge; their accessible indexed author abstracts or PubMed records support the narrower claims above. No finding is treated as a replication in The Last Dead.

## Current game foundation

Source snapshot checked September 30; the checkout contains existing local implementation work. These are read-only observations, not changes made by this research pass.

| Existing component | Useful capability | Remaining work for these experiments |
| --- | --- | --- |
| [main.js](../main.js), `updateHorrorAudio` and `updateDungeonScareAudio` | Offscreen or occluded enemy cues, atmosphere ducking, an exit-phase scream, one-shot scream/watcher room entries | Coordinate those consumers with one shared event budget so a new sequence cannot overlap unrelated scares |
| [assets/audio.js](../assets/audio.js), `duckAtmosphere` and `_createSpatialNode` | Sample playback, separate groups, HRTF panning, filters, voice limits and gain automation | The examined panner setup fixes a one-shot source position at creation; moving audio requires successive positions or a tracked-source extension |
| [enemy-ai.js](../enemy-ai.js), `collectNoises`, `seenByPlayers`, `createPacing`, `updatePacing` | Player noise, visibility, and calm/build/peak/release pacing | Its `tension` value is a gameplay-pressure estimate, not a measured player emotion; do not describe it as mind-reading |
| [engine.js](../engine.js), dungeon pacing | Recovery-room gating and encounter/ambush state | Bind horror eligibility to progression and cancel cleanly on combat, death or transition |
| [horror-scares-game.js](../horror-scares-game.js) | Ceiling drop, window scream, piano vigil and reduced-motion handling | Current reactions can serve as the baseline; new learning sequences need persistent, bounded state |
| [vermin-system.js](../vermin-system.js) and [vermin-visuals.js](../vermin-visuals.js) | Authoritative vermin, scent behavior, sleeve/weapon crawling and bounded visual pools | Existing rats and roaches already cover surface crawling; the research opportunity is anticipation and boundary crossing, not simply more insects |
| [player-injury.md](player-injury.md), [blood-surface.js](../blood-surface.js) and [world-horror.js](../world-horror.js) | Close-contact injuries, blood presentation, flesh and anatomical set dressing | Audit interactions before adding any presentation over a wounded or absent arm |
| [dungeon-data.js](../playground/map/dungeon-data.js) | `f1-watcher-crane`, `f2-mimic-table`, `f3-scream-apse` | These offer authored locations and themes; the breathing-table entry needs its corresponding sequence, not just a data label |

## Signature encounter proposal

**The ward remembers a movement the player has just performed.** This is a design proposal, not a claim of unprecedented invention.

The player passes a surgical table under a sheet. Its machinery has an ordinary, recognizable rhythm. After the player stops, something inside the wall repeats the last few footfalls, including the same uneven pause. They can move again to test it. The response comes from a different recess; the sheet tightens around a small movement underneath. Later, the player recognizes the same rhythm in a specimen's fingers or a choir of pipes.

The implication grows from imitation to recognition: this place is learning how to inhabit a body. The reveal does not need a monster to leap at the camera. Let the player inspect, fire, leave, or return. Any actual attack keeps its existing mechanical tells.

Use game movement events and authored animation/foley as inputs. A copied heartbeat or breath refers only to the simulated character's audio/animation state. This concept needs no microphone, biometric sensor or personal-data inference.

The first prototype should implement only the answering wall. The sheet, body motion and later callback are follow-on experiments so we can establish which element carries the effect.

## Ranked encounter experiments

All timings and budgets below are starting design values to tune, not numbers established by the cited studies. Relative effort assumes reuse of the current assets and systems; asset quality can dominate the cost.

### E01 The answering wall

**Priority 1; medium effort; target: dread and perceived recognition.** In a cleared ward room, a brief pattern of player footsteps receives a muffled answer from an inaccessible recess. Establish the relationship twice, then allow an answered movement or a meaningful absence on the third opportunity. Use a material-specific accent so the answer can be distinguished from an enemy footstep.

**Control:** two versions have the same cue family, event count, locations and loudness. In the treatment, timing follows the player's actions; in the control, a yoked schedule from a previous run breaks that contingency. Log how well acoustic exposure actually matched, since player movement can change perceived distance. Begin with a simple one-reply version before testing escalation.

**Hooks and bounds:** movement/noise events, room scare data and the existing audio system. One sequence per room, a six-second response window and a proposed 90-second global cooldown. Do not make silence or retreat trigger damage. Shared environmental replies need one authoritative sequence ID in co-op; final panning remains listener-relative.

**Keep if:** players infer that the room responds to them, report more dread and still identify actual combat cues correctly. **Reject if:** it mainly sounds like duplicate footsteps, network echo or arbitrary ambient noise.

### E02 Something passes beneath the cuff

**Priority 2; medium to high effort; target: skin crawling.** Begin with one visible roach traversing an existing weapon or sleeve route. It disappears at the cuff; a small local fold travels beneath the sleeve, then settles. Use dry fabric friction and tiny taps rather than a scream. The damaging vermin mechanics remain a separate, explicitly cued system.

**Control:** a surface-crawl version versus a version that appears to cross beneath the cuff; match duration, count and sound exposure. Measure skin crawling separately from fear, disgust and nausea.

**Hooks and bounds:** `makeVerminCrawl`, existing sampled surface routes and the survivor arm presentation. The fold is new deformation work; clipping an insect through the sleeve is not an adequate implementation. Reuse the existing attachment budget, cancel for missing limbs or incompatible hand states, and keep movement and aim responsive. Reduced motion can show the disappearance and a static displaced fold.

**Keep if:** a small event creates stronger skin-crawling reports without requiring a swarm. **Reject if:** players see clipping, a control obstruction or a decorative bug overlay. No claim that visual stimuli produce actual tactile sensation in every player.

### E03 A coherent body with one wrong movement

**Priority 3; medium effort; target: uncanny unease.** A noncombat Ash Witness has grounded feet, plausible breathing and normal reach. During one turn, its torso begins to move while the head remains directed toward the player for a fraction of a second; the head then catches up. Another candidate is fingers continuing a learned rhythm after the body becomes still. Test these separately.

**Control:** the same pose, path and encounter timing with ordinary synchronized motion. Change only the local motion relationship; do not also change speed, lighting or audio.

**Hooks and bounds:** the current character articulation/rig and a nondamaging scare actor. Preserve bone lengths and contact. Do not edit combat windups to introduce visual ambiguity. A multiplayer actor needs shared transform and animation-phase timing.

**Keep if:** players describe intention or unnatural behavior. **Reject if:** they describe animation lag, a broken rig or foot sliding. This is especially important given the motion counterevidence above.

### E04 A clean object becomes contaminated

**Priority 4; medium effort; target: contact disgust.** Establish a clean enamel fixture next to the table. A visible filament transfers to its handle when the specimen touches it. Optional inspection reveals a slight tether or residue as it separates. The contact history supplies meaning; blood volume need not increase.

**Control:** identical materials with a pre-existing stain versus a visible transfer event. Keep item function, rewards and combat state equal.

**Hooks and bounds:** authored props and bounded residue presentation. Start with an optional inspection prop; do not add an unexplained damage penalty to required progression. This is new contact choreography, not a completed capability of the blood renderer. Gore-off can use oily residue and torn fibers.

**Keep if:** players notice the transfer and hesitate to touch or inspect while remaining curious. **Reject if:** it becomes an unreadable dark stain, an obstacle to necessary progress or just another blood decal. The transfer mechanic is our hypothesis, not a tested result from the injury paper.

### E05 A small strain that the player can imagine feeling

**Priority 5; medium to high effort; target: squeamishness.** A specimen presses one recognizable knuckle against glass. The local skin compresses, the hand tries to release, and a small movement suggests resistance. Hold enough context for the player to understand contact. Use one restrained material sound.

**Control:** contact with pressure deformation versus an ordinary touch, with the same shot length and audio exposure. Keep contamination cues out of this comparison.

**Hooks and bounds:** isolated rigged hand, contact target and local soft-tissue presentation. Art quality is the main risk. Avoid making the camera linger forcibly; the player can look away. Gore-off retains pressure and resistance without an open wound.

**Keep if:** vicarious discomfort rises independently of infectiousness ratings. **Reject if:** the result relies on louder crunches, more gore or visibly impossible anatomy.

### E06 The sound approaches, but its source stays hidden

**Priority 6; medium effort; target: immediate threat anticipation.** A scraping pulse moves through successive authored positions beyond cover, becoming less muffled as the apparent source nears an opening. It stops short of revealing a body. Begin with a nondamaging source so errors cannot conceal a hit.

**Control:** stationary versus approaching playback with comparable overall acoustic exposure. Compare rough versus smooth timbre in a separate experiment; do not change motion, roughness and level together.

**Hooks and bounds:** sampled audio, filters and spatial nodes. The current one-shot panner does not implement continuous source tracking. Use a bounded cue sequence initially or add a cancellable tracked voice. Test headphones, mono and ordinary speakers. Keep essential attack cues audible throughout.

**Keep if:** listeners correctly infer approach and report more anticipated danger. **Reject if:** the cue only wins because it is louder, masks attacks or collapses into nondirectional noise on common devices.

### E07 A later room repeats the player's earlier rhythm

**Priority 7; medium to high effort; target: psychological recognition and memory.** After a neutral recovery room, a choir pipe or specimen repeats the distinctive pause pattern heard in E01. It now belongs to a visible biological source. A nearby piece of story evidence makes the connection interpretable without explaining every detail.

**Control:** a repeated motif versus an equally salient new motif, with both groups receiving the same prior encounter. Ask what connection players made before explaining the intended one.

**Hooks and bounds:** retain a small in-run rhythm token, not an unbounded recording. Save or replicate the token explicitly if persistence or co-op requires it. Do not fabricate a human partner's voice, movement state or messages.

**Keep if:** players independently connect the events and remember the implication afterward. **Reject if:** it requires a long explanation, is mistaken for asset reuse, or only works for players who read every note.

### E08 Recovery makes the next change legible

**Priority 8; low to medium effort; target: sustainable dread and enjoyment.** Following a major beat, restore ordinary machinery and a genuinely quiet recovery interval. The next unusual response is small enough to invite attention. Test this before combining all the successful treatments.

**Control:** matched scare content and comparable total session duration, with clustered events versus separated events and neutral filler. Counterbalance presentation order; acknowledge that timing and placement are the intended manipulation.

**Hooks and bounds:** dungeon pacing plus a shared scare gate across audio, scare actors and vermin presentation. Proposed starting rule: one major beat followed by 30–60 seconds of recovery, extended when the player is hurt or in combat. Existing recovery rooms remain dependable. The pressure estimate cannot tell whether a player is frightened.

**Keep if:** enjoyment and willingness to continue improve while the next cue remains effective. **Reject if:** the interval feels like dead time or every safe room becomes a predictable prelude to punishment.

## Audio design experiments

Give each material a recognizable sound before its behavior changes: foundry metal tension, ward fabric and tubing, ossuary dry friction, choir breath and resonance. These are art-direction choices, not experimentally established fear sounds.

Use a small matrix of separately controlled comparisons:

| Question | A | B | Hold equal |
| --- | --- | --- | --- |
| Does roughness help this cue? | Smooth sampled texture | Brief rough treatment | Source, duration, perceived loudness, spatial path |
| Does approach help? | Stationary source | Approaching source | Timbre and comparable overall exposure |
| Does material identity help? | Generic scare cue | Room-specific material cue | Trigger, duration, perceived loudness and position |
| Does contrast help? | Cue over normal atmosphere | Same cue after atmosphere recedes | Cue level and mechanical warning audibility |

Waveform peak and integrated loudness checks are useful, but listening checks are still needed to match perceived loudness across timbres. The current ambience high-pass is 38 Hz and the music profile uses 28 Hz. Neither is a reason to pursue an infrasonic fear effect. Keep the useful identity in audible content that translates to ordinary playback devices.

## The next empirical research loop

**Start with E01, E02 and E03 individually.** Together they cover responsive dread, body-boundary invasion and unnatural intention. Hold E04–E07 until those prove legible; E08 is the pacing comparison to run before combining treatments.

1. Create a developer-only, seeded encounter route with a baseline toggle and deterministic triggering. Keep the existing main game tab intact and use a separate QA page when browser testing begins.
2. Pilot each treatment with 8–12 willing adult players across different horror experience levels. This is a practical screening sample, not a powered confirmation study. Record prior exposure to the encounter.
3. For first-exposure surprises, use independent baseline/treatment groups: replaying a revealed scare contaminates the comparison. For repeatable sound or motion comparisons, counterbalance A/B order using equivalent rooms; report order and carryover effects.
4. After each short encounter, ask for separate 0–10 ratings of fear, anticipation, disgust, skin crawling, eeriness, enjoyment and annoyance. These are a proposed internal rubric, not a validated diagnostic scale. Ask what caused the response in the player's own words.
5. Log event ID, seed, variant, actual onset time, audio device/settings, progression, position, view direction, exposure count and nearby threats. Derive first look, approach/retreat and firing behavior. Movement is a behavioral response, not proof of fear.
6. Review player-level differences and the direction of results. A provisional product threshold is a one-point improvement on the intended rating without a meaningful enjoyment loss, repeated bug reports or cue confusion. Do not treat this threshold as statistical significance; retain variation and order effects in the report.
7. Fix the dominant failure, retest one changed variable, then combine only successful treatments. Test the combined route with fresh players and an optional next-day question about what they remember. Include repeated-run players to assess habituation separately.

Physiology is optional secondary evidence. Heart rate or skin conductance cannot label a moment as fear by themselves. There is no need for a biometric system in the initial loop.

Implementation acceptance should cover clean cancellation on death/pause/restart/floor transition, bounded timers/actors/voices, frame-time impact, relevant gore/reduced-motion settings, cue audibility, and co-op event deduplication. New nondamaging sequences must not create hidden hits or change health, ammunition, collision, or objective truth.

## Where originality can come from

Existing games already cover several ingredients. Frictional's developer account describes noise attracting unwanted attention in [Amnesia: The Bunker](https://blog.playstation.com/2023/06/01/amnesia-the-bunker-launches-june-6/). Scorn's [publisher storefront description](https://www.xbox.com/en-US/games/store/scorn/9NM3TNRPQXLR) emphasizes a living environment and visible bodily interaction. Frictional describes [SOMA's horror](https://frictionalgames.com/2015-09-top-three-questions-about-soma/) as developing through the player's understanding of its subject matter.

Our proposed distinction is the connection between **the player's own action rhythm, a material response in the room, a bodily imitation, and a later narrative recognition**. That is a specific direction to author and evaluate, not proof that no game has done anything similar. This precedent check is selective, not an exhaustive novelty survey.

## Deliverable and next decision

The research adds twelve primary-paper checks, a current source map, eight controlled encounter specifications and an empirical evaluation plan. It recommends prototyping the answering wall first, then the cuff event and coherent wrong motion. Game code, assets, server processes and browser tabs were not modified by this pass.

Workflow reference: [Three.js gameplay workflows](C:/Users/wolfk/.codex/skills/threejs-gameplay-systems/references/gameplay-workflows.md) was loaded for encounter boundaries and verification planning. Gameplay implementation and release QA are pending; this document does not claim those phases passed.

Subsequent user authorization expanded this research-only pass into game integration. The implemented encounters, coordination notes, current verification and remaining human-study limits are recorded in [the implementation report](horror-presence-implementation.md) and [browser QA report](horror-presence-qa.md). The research protocol above remains the proposed player evaluation, rather than a completed fear study.
