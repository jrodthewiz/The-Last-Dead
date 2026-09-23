# Psychological Horror Research Report — The Last Dead

**Prepared:** September 23, 2026  
**Purpose:** Translate published psychology, psychoacoustics, horror-game experiments, and film-sound analysis into specific, testable design work for this game.

## Executive read

The most defensible route to more psychological horror is to make the player infer a threat from a changing environment, then let their own movement and choices put them in contact with it. Horror is not a matter of turning every sound up or adding an allegedly magic frequency. The useful pattern is **context → partial cue → anticipation → reveal or meaningful absence → relief**. Player-controlled participation can produce stronger physiological arousal than watching the same horror gameplay; experiments with horror-game event sequences also find that ordering matters and that sound events often rank highly. Individual responses vary, so these are design hypotheses to test in The Last Dead, not guarantees for every player.

For audio specifically, the clearest frequency-related evidence is about **audible temporal roughness**: rapidly changing amplitude or repeated transients in roughly the 30–150 Hz modulation range can be unusually salient and aversive, with some experiments finding a peak around 40 Hz. That is a modulation/pulse rate, not a secret 40 Hz pitch or a reliable fear tone. The famous “play 17/19 Hz and people feel haunted” claim is weak, and the available 2003 concert experiment was described by its organizer as tentative and inconclusive. The project should prototype audible rough textures and low harmonics, then A/B them against matched controls; it should not promise an inaudible fear signal.

## What the evidence says

| Mechanism | Finding and evidence strength | What it suggests for this game |
|---|---|---|
| **Agency makes threat personal** | In a controlled horror-game comparison, people who played showed greater changes in electrodermal activity, breathing rate, and heart rate than people who watched a recording; self-reported fear did not differ significantly. This supports a physiological effect of participation, while also showing that arousal and reported fear are not interchangeable. **Moderate, direct game evidence.** [Madsen, 2016](https://doi.org/10.1016/j.chb.2015.11.041) | Keep the movement kit and make danger respond to the player: shots, dashes, footsteps, and route choices can draw attention. Let the player feel they caused the threat to find them. Do not take control away to manufacture helplessness. |
| **Uncertain context sustains anxiety; clear cues create short fear** | Human threat research distinguishes cue-linked, phasic fear from longer anticipatory anxiety around uncertain danger. Unpredictable threat can sustain a broader anxious state because the person cannot settle on a clear safe period. **Strong general psychology; indirect game application.** [Grillon, 2002](https://doi.org/10.1016/S0006-3223(02)01665-7) | Make the player uncertain about *where or when* a non-damaging presence will appear. Keep damaging attacks fair: retain a reliable warning channel and adequate reaction time. Uncertainty belongs in the room and pacing, not in hit detection. |
| **Approaching sounds attract attention** | Behavioral and EEG work found an “auditory looming bias”: sounds perceived as approaching are evaluated more rapidly/saliently than receding ones, including when motion is conveyed with spectral cues instead of simple volume ramps. **Strong psychoacoustic evidence; not itself a horror-game trial.** [Baumgartner et al., 2017](https://doi.org/10.1073/pnas.1703247114) | Let a chain drag, breath, scrape, or creature call approach through space before its source is visible. Slowly change level and filtering, and use spatial direction. A cue that grows naturally can make the player turn before they see why. |
| **Roughness is a salient warning quality** | In psychoacoustic experiments, aversion to repetitive transients was nonlinear and strongest in the roughness range; the paper discusses fast, perceptible amplitude variation around 30–150 Hz and identifies especially strong responses around 40–80 Hz (a peak near 40 Hz in one task). A separate behavioral experiment found that rough sounds changed defensive audio-tactile responses at farther perceived distances. **Strong evidence for salience/aversion, indirect for fear or horror-game enjoyment.** [Arnal et al., 2019](https://doi.org/10.1038/s41467-019-11626-7), [Taffou et al., 2021](https://doi.org/10.1038/s41598-020-79767-0) | Use brief, rough, irregular textures in a creature onset or a pipe/bell motif. Compare 30, 40, and 80 Hz pulse/modulation treatments at matched loudness. Reserve this timbre for meaningful moments; a constant rough drone becomes irritating background. |
| **Order changes the effect of sounds and silence** | A PC horror-game study with 24 participants compared two event progressions and collected GSR and tension annotations. Sound events often scored highly; the same cue's response varied by sequence. Silence following an intense event could also register strongly. The study had only two sequences and 32 usable runs from 48, so it is suggestive rather than a universal recipe. **Moderate, direct game evidence with limitations.** [Graja, Lopes & Chanel, 2020/2021](https://doi.org/10.1109/TG.2020.3006053) | Build beats as sequences. A sound can be more powerful after the room has taught the player what “normal” sounds like. Let a distinctive cue be followed by a real quiet interval. Do not run every layer at once. |
| **Horror-film sound uses noisy/nonlinear timbres** | A content analysis of film soundtracks found nonlinear acoustic features—noise, abrupt amplitude fluctuation, non-harmonic sidebands, and noisy screams—were distributed differently across genres, with some features more common in horror. This is evidence of a convention and correlation, not proof that any one feature causes fear. **Useful film evidence, correlational.** [Blumstein, Davitian & Kaye, 2010](https://doi.org/10.1098/rsbl.2010.0333) | Build monstrous sounds from real material—metal tension, breath, animal-like calls—then add controlled noise, unstable partials, or rough modulation. Let the environment’s sound carry threat before a visual reveal. |
| **Very low/infrasonic tones** | The 2003 “Infrasonic” concert used two counterbalanced performances with a 17 Hz component. Its organizer called the result tentative and inconclusive, and noted priming and methodological issues. It does not establish a reliable hidden-frequency fear effect or validate the popular 19 Hz haunted-room claim. **Weak evidence for a game-design claim.** [Angliss’s account](https://www.sarahangliss.com/infrasonic/) | Do not build around 17–19 Hz. Most headphones/laptop speakers will not reproduce it reliably; at sufficient acoustic level it is no longer an inaudible trick. Use audible bass and harmonics if a room needs weight, and judge the result on the actual range of devices. |

### Important audio distinction: pitch versus pulse rate

“40 Hz” can describe a tone whose pitch is 40 cycles per second, or a faster amplitude pulse/modulation applied to an audible carrier. The roughness research concerns temporal structure—rapid modulation/repetitive transients—not a universal low bass note that switches on fear. For a game asset, the useful test is a quiet, band-limited audible carrier (for example, a breath, metal resonance, or filtered room tone) with a subtle rough pulse texture, compared with an equal-loudness smooth version. Keep the modulation sample-authored and bounded; do not turn it into a continuous alarm.

## Film and game lessons that transfer

Film can control every cut and can hide the source outside the frame; a game must also let the player act. The portable film lesson is therefore **sound can introduce an event before its image explains it**. Use source ambiguity and partial disclosure: a pipe answers a footstep, a bell rings from the wrong direction, or a voice continues after its visible source is gone. The room’s established sound makes the deviation legible. The player’s own action then gives the sound personal stakes.

The horror-game sequence study used an adapted P.T.-style environment and found order/context effects, including strong responses to a woman’s scream-cry and to silence in some sequence positions. That does not mean we should copy those exact sounds. It means the event’s identity, timing, and placement in a build-up matter more than choosing a generic “scary sound” in isolation. For The Last Dead, the sound should belong to the foundry, ossuary, ward, or choir spaces already authored in the game.

## What is already in The Last Dead

- [`assets/audio.js`](../assets/audio.js) is a sampled-audio Web Audio system. It has separate `sfx`, `voice`, `music`, `ambience`, and `ui` groups, per-event filters/caps/cooldowns, a master compressor, scene music crossfades, a listener update, and HRTF spatial panning when an event supplies a position. It deliberately has no generated-oscillator fallback.
- Spatial panning currently sets a sound's position when the one-shot begins; it is not a continuously moving source or dynamic room-occlusion/reverb system. Event filters are configurable, but the engine does not yet simulate a source moving toward the listener through the level.
- [`assets/audio-manifest.js`](../assets/audio-manifest.js) maps bundled loops and sampled event pools. The game currently has two ambience loops and a single gameplay music bed.
- The current ambience profile high-passes at **38 Hz**; the music path high-passes at **28 Hz**. So a 17–19 Hz design will be removed or poorly reproduced through parts of the current chain and typical speakers. These cutoffs are implementation facts, not psychoacoustic recommendations.
- [`main.js`](../main.js) updates the 3D listener and plays footsteps, low-health heartbeat, and engine events. [`engine.js`](../engine.js) has intermission/combat/exit director states and emits game events.
- [`playground/map/dungeon-data.js`](../playground/map/dungeon-data.js) contains authored scream, lights-out, watcher, hunt, collapse, swarm, and mimic beats. [`playground/map/dungeon-course.js`](../playground/map/dungeon-course.js) exposes them on dungeon courses. The audio director now consumes room-scoped scream and watcher entries once per run in cleared rooms. Lights-out, collapse, hunt, swarm, and mimic entries still need their corresponding visual or gameplay event consumers.
- Existing project work already calls out fairness and audio pacing in [`psych-horror-plan.md`](psych-horror-plan.md). This report adds outside evidence and corrects the “specific frequencies” question with stronger distinctions between evidence and lore.

## Recommended work, in priority order

### 1. Sound-before-sight approach cue

**Player experience:** From beyond a corner or in fog, hear a cue that becomes more spatially specific as the creature closes. A deliberate pause or a change in the cue lets the player infer that it has stopped when they stop moving.

**Technical path:** Add a small set of authored, licensed/cleared clips to the manifest (breath/drag/chain or a per-family equivalent). Trigger from the spawn/search/wind-up event path with source position, family, and a real cooldown. Reuse `AudioSystem.play()`’s position → HRTF panner and listener update. For a moving approach, either send a few carefully timed, non-repeating cues from successive positions, or extend the audio system with a tracked voice whose gain, panner position, and low-pass cutoff update over time. Distant/occluded sources should be quieter and duller; approaching sources can gradually recover high-frequency detail and level. Start the approach 0.5–1.2 seconds before visual contact, but never use this as the only telegraph for a damaging move.

**Why it should work:** It uses the experimentally observed approach-sound bias, and the player must turn/choose instead of simply receiving a visual announcement. It also fits the project’s existing fog and authored off-screen threat ideas.

**Guardrails:** Limit simultaneous approach cues (one per family or one global voice), avoid repetition while the threat is already in combat, and never occlude a cue that is needed to dodge. In co-op, send the cue as a host-authored event with the same source position so both players receive the same meaning.

### 2. A threat layer with real dynamic range

**Player experience:** Combat is loud and readable. During a safe intermission, the room settles. On one authored beat, music and ambience briefly recede; a localized environmental cue remains, then ordinary room tone returns.

**Technical path:** Keep weapon, footstep, damage, and enemy-attack feedback on `sfx`/`voice`; only duck the atmospheric bed. `setGroupVolume()` currently changes gain with a 15 ms target time, which is too abrupt for a designed 1–3 second transition. Add a scheduled gain ramp for atmosphere or give a dedicated dread stem its own gain node. A dedicated stem is preferable to muting the whole ambience group if the room should retain, for example, one pipe creak. Trigger from the director/intermission and authored beat state, with a cooldown/quiet-after-peak rule. Do not put a hard mute inside an airborne attack or a damaging projectile’s hit window.

**Why it should work:** Game-sequence experiments support arrangement and contrast. The quiet interval resets attention and makes the following meaningful event distinct. This is a pacing strategy, not a claim that literal silence is intrinsically scary.

**Guardrails:** Preserve mechanical audio cues, avoid the same hush every wave, and always bring the bed back. The current compressor and fixed group gain are useful, but measure the mix so a new bass stem does not mask combat or trigger aggressive pumping.

### 3. Zone-specific low bed and rough transient test

**Player experience:** Each biome has a low, almost bodily identity—the foundry pumps, ossuary stone/bone resonance, ward ventilation, or choir-like room modes. The bed changes subtly before a rare event; it does not run at maximum intensity continuously.

**Technical path:** Author several loopable stems offline from real recordings and tonal/noise layers, then add them as bundled audio assets. Keep useful harmonics above the engine’s 38 Hz ambience cutoff; retain enough midrange harmonic content that the cue still reads on laptop speakers. Make a controlled test set of (A) smooth tone/rumble, (B) irregular noisy texture, (C) rough transient or amplitude-modulated texture around 30/40/80 Hz, with integrated loudness matched. The studies support testing roughness/aversion; they do not dictate a magic asset or modulation depth.

**Why it should work:** Low harmonics add audible/tactile weight when playback supports them; rough temporal modulation has better evidence as an attention/aversion quality than inaudible sub-bass. The zone-specific source keeps the sound meaningful rather than generic.

**Guardrails:** Keep the bass modest and broadband enough to translate across devices. Do not add 17–19 Hz as a hidden trigger. Include an ambience-level setting and avoid steady low-frequency overload.

### 4. Call-and-response with the player’s behavior

**Player experience:** The room occasionally echoes a player noise, but with one detail wrong. A distant metal scrape follows a dash; a pipe repeats a gunshot after an implausible delay; a Warden’s footfall stops when the player stops.

**Technical path:** Use existing movement, shot, and event hooks to notify a lightweight audio director. Rate-limit replies, vary the delay and source position, and choose a room-appropriate sample. Keep the response non-damaging and do not make it an exact action telegraph. For a first version, do not add a new networked horror entity; an authored/local sound event avoids desync risk.

**Why it should work:** The player has agency and can form an expectation, then hear a controlled mismatch. This combines agency and uncertainty without changing movement or combat rules.

### 5. Choreograph sound with light and sightlines

**Player experience:** A room's usual light and room tone become familiar. One bank gutters out, or a distant sound seems to come from the space just lost to darkness. The player can still read the route and any combat warning.

**Technical path:** The horror-game sequence study also found that its lights-off event received many high tension rankings (71%); that is a result from one small, context-specific experiment, not a guarantee. Use local lights and authored cues together: fade a light group over a short interval, leave a silhouette or edge light at the far side of the fog, then make the sound resolve to a location only if the player chooses to look or move. The current project already has per-sector fog/light palettes and authored lights, but a cinematic local-light event needs a runtime trigger. Keep whole-screen flicker brief or offer a non-flicker accessibility equivalent; do not use a blackout to conceal a damaging spawn.

**Why it should work:** Contrast changes what information is available, and the player's own search behavior supplies the next beat. Film can hold a shot; the game can make the player decide where to look. Treat the study's event ranking as a reason to prototype the combination, not evidence that “lights off” works on its own.

### 6. Give authored scare data an audio grammar

Use the existing dungeon beats as room-specific sequences: establish a normal room sound; remove or alter exactly one layer; cue from a hidden location; make the player turn or cross a threshold; reveal the source, reveal nothing, or let it answer from a new position; allow a quiet recovery. An example for `f1-watcher-crane`: retain foundry machinery, add one distant gantry creak while the watcher is out of view, let it stop when the player looks toward it, and never attach damage to the watcher beat. An example for `f3-scream-apse`: one bell rings out of order with a rough, short tail; leave a short quiet interval before the next combat cue.

The scream and watcher audio beats now have a runtime consumer and one-shot state. The other authored beats need their corresponding visual or gameplay consumers before they can be evaluated. Keep any future damaging spawn host-authoritative in co-op, preserve fair combat tells, and do not repeat the same room beat on every revisit.

## Implemented in this game

- **Hidden threat cue:** At a low rate, the local audio director checks nearby living enemies. If the closest threat is within roughly 2.7–8.2 map units and outside the player's view or behind cover, it plays a quiet, positional cue from the already licensed zombie-moans pack. The cue is slightly detuned and filtered more heavily when a wall blocks the direct path. A global cooldown prevents a crowd of enemies from turning it into continuous noise. It is non-damaging and does not replace attack telegraphs.
- **Film-style roughness on a sampled voice:** The hidden cue uses 40 Hz amplitude modulation at 14% depth, a subtle downward detune, distance attenuation, and a low-pass filter. The 40 Hz value is the pulse rate of the audible sound, not an inaudible tone. The gain LFO is an effect on top of a licensed sample; it produces no separate tone.
- **One cleared-sector stinger:** A processed Ogg/Vorbis cue derived from Vinrax's CC0 scream recording is bundled in `assets/audio/sourced/horror/`; the downloaded MP3 and intermediate WAV are kept in the ignored preservation archive. The cue is band-limited, slowed slightly, given a restrained 40 Hz pulse and a short quiet echo. The game plays it once in a campaign run, 2.8 seconds after all enemies are cleared and the exit phase begins, from a point outside the player's view when possible.
- **Atmosphere duck and recovery:** Both cues lower only the music and room-tone buses over a short fade, hold the reduction briefly, then restore them automatically. Combat sounds and enemy calls remain on their normal buses. This creates a deliberate quiet pocket without removing gameplay warning sounds.
- **Sector room-tone identity:** The existing bundled room loops get three gain-adjusted treatments for the campaign's foundry, ward, and ossuary sectors. Each uses a distinct playback rate and high/low-pass shape; a sector change crossfades the bed. This adds environmental identity while retaining enough midrange content to work on ordinary speakers.
- **Co-op behavior:** These are non-gameplay, listener-relative cues, so each player hears them based on their own view and position. The host does not add them to replicated combat events; actual attacks and visible spawn warnings keep their existing authoritative cues.
- **Dungeon scare cues:** Room-scoped scream and watcher entries in the existing dungeon data now play once when the player enters a cleared room. The cue uses the authored position. Other scare kinds remain data until their lighting, geometry, or encounter behavior is implemented.

These are implementation hypotheses based on the evidence above. The 40 Hz effect is intentionally restrained; the cited roughness work supports testing pulse-rate and transient treatments, not assuming this exact mix is universally frightening. The sourced scream is processed for an original film-like texture; no copyrighted movie audio is used.

## How to test whether it actually gets scarier

Run a small randomized crossover playtest with the same short room/combat sequence and two audio versions: baseline versus one treatment at a time. Keep event timing, level, enemies, and master loudness otherwise matched. Test distinct questions separately: approach cue, dynamic hush/return, and roughness variant. Have players rate tension at room end and name when/where they thought a threat was present. Also log turns toward the cue, time until first look, route changes, dash/fire reactions, deaths, and whether players mistook the cue for a combat telegraph.

If available, record EDA or heart rate as secondary measures, but do not label elevated arousal “fear” without player report. Randomize order, provide equal audio levels, and recruit both experienced and new players: small prior game experiments note player familiarity/confidence can affect intensity and task performance. A small internal sample is useful for eliminating bad mixes; it is not proof. Promote a treatment only when it raises reported tension or threat inference without increasing unfair hits, confusion, or annoyance.

## References

1. Madsen, K. E. (2016). “The differential effects of agency on fear induction using a horror-themed video game.” *Computers in Human Behavior*, 56, 142–146. [DOI](https://doi.org/10.1016/j.chb.2015.11.041).
2. Grillon, C. (2002). “Startle reactivity and anxiety disorders: aversive conditioning, context, and neurobiology.” *Biological Psychiatry*, 52(10), 958–975. [DOI](https://doi.org/10.1016/S0006-3223(02)01665-7).
3. Baumgartner, R. et al. (2017). “Asymmetries in behavioral and neural responses to spectral cues demonstrate the generality of auditory looming bias.” *PNAS*, 114(36), 9743–9748. [DOI](https://doi.org/10.1073/pnas.1703247114).
4. Arnal, L. H. et al. (2019). “The rough sound of salience enhances aversion through neural synchronisation.” *Nature Communications*, 10, 3671. [DOI](https://doi.org/10.1038/s41467-019-11626-7).
5. Taffou, M., Suied, C. & Viaud-Delmon, I. (2021). “Auditory roughness elicits defense reactions.” *Scientific Reports*, 11, 956. [DOI](https://doi.org/10.1038/s41598-020-79767-0).
6. Graja, S., Lopes, P. & Chanel, G. (2020; issue published 2021). “Impact of Visual and Sound Orchestration on Physiological Arousal and Tension in a Horror Game.” *IEEE Transactions on Games*, 13(3), 287–299. [DOI](https://doi.org/10.1109/TG.2020.3006053).
7. Blumstein, D. T., Davitian, R. & Kaye, P. D. (2010). “Do film soundtracks contain nonlinear analogues to influence emotion?” *Biology Letters*, 6(6), 751–754. [DOI](https://doi.org/10.1098/rsbl.2010.0333).
8. Garner, T. A., Grimshaw, M. N. & Abdel Nabi, D. (2010). “A preliminary experiment to assess the fear value of preselected sound parameters in a survival horror game.” *Audio Mostly 2010*. [DOI](https://doi.org/10.1145/1859799.1859809); [open author-hosted preprint](https://vbn.aau.dk/files/61575828/a_preliminary_experiment_MG.pdf). This small experiment (12 participants) did **not** find statistically significant effects for its pitch, loudness, or 3D-panning treatments; source-sound identity varied more, and the authors explicitly called for more focused tests.
9. Angliss, S. “Infrasonic — haunted music?” Organizer’s account of the two counterbalanced 2003 concerts. [Experiment and limitations](https://www.sarahangliss.com/infrasonic/). This is not a peer-reviewed demonstration of a repeatable fear-inducing frequency.
