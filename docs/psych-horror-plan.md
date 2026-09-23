# Psychological Horror Plan — The Last Dead

Scope: a research-backed upgrade path that makes The Last Dead scarier *psychologically* — visuals, models, audio and pacing —
without weakening its aggressive-movement identity.

This document is a plan, not an implementation. Nothing outside this file was changed.

## Research basis (read this first, it has an honesty caveat)

In-repo research was done directly and is cited throughout as `file:line`. I read renderer, UI, audio, world, enemy factories, the
director, the build ledgers and the authored scare data.

Web access was **not** available: an outbound HTTPS probe returned `NO_NETWORK` from the sandbox. So the player-psychology claims
below are not fresh citations. They are well-established published design principles applied to this codebase: fear of the unknown
outranks fear of the visible; contrast (relief against pressure) is what keeps a threat legible; alarm value decays with repetition
(habituation); the uncanny comes from *mismatched* motion, not from ugliness; and unpredictability must stay inside a predictable
grammar or it reads as unfairness. Treat §2 as design hypotheses and §6 as the test that decides whether each one actually landed.

## 1. What already exists and already works — do not rebuild these

### 1.1 Sight is already limited

- `renderer.js:119` starts the scene at `Fog(0x101817, 32, 100)`.
- `world-horror.js:4-8` gives each sector its own background/fog/key/rim/accent palette; `renderer.js:635-640` applies them per
sector. Fog far is 88–100 m, near 24–32 m — enemies genuinely emerge from murk.
- `renderer.js:270-308` runs one hemisphere fill, a shadowed key, a cool fill, a red rim and four coloured pooling lights. Mood
lighting is already authored, not missing.
- `world-horror.js:40-52` already scatters 22 instanced contact stains; `world-authored.js:515-539` already animates authored zone
lights with a slow intensity breathe.

### 1.2 Threat readability is already strong (and that is the problem to solve)

- Every Warden gets a windup ground ring: `npc-warden.js:36`, shown only while attacking at `npc-warden.js:57`.
- Procedural enemies get an attack telegraph ring at `renderer.js:1060-1065`, driven at `renderer.js:1114-1119`.
- Melee enemies commit a real windup, then a hit-tested arc (`engine.js:399-415`); ranged enemies lob a gravity-driven wobbling glob
(`engine.js:313-338`, `engine.js:420-461`).
- The spawn director telegraphs every spawn 0.55 s early (`engine.js:186-201`) and the wave toast announces the wave (`main.js:53`).
- Enemy variants are colour-coded per family (`enemy-variation.js:14-73`; applied via `enemy-variation.js:128-146`).

Net: the player is never allowed to be unsure. That is excellent for fairness and fatal for dread. Most of this plan is
*re-allocating* information, not adding more of it.

### 1.3 Consequence is already visceral

- Damage shake and FOV language exist: `renderer.js:1365-1371` (shake from `damage`/`punch`; FOV 92 → +12 dashing, −14 aiming,
+2 at speed).
- Blood veil vignette decays over 650 ms at `ui.js:557`, styled at `horror-ui.css:115-117`; a critical state already exists at
`horror-ui.css:95-97`.
- Gore, blood and dismemberment are bounded instanced pools: `renderer.js:27-29` (260 gore, 128 blood, 64 limbs), built at
`renderer.js:316-349`, fed at `renderer.js:1195-1251`; simulation side at `engine.js:70-104`. Blood creeps outward over time
(`engine.js:498`).
- Enemy globs leave damaging pools and stains (`engine.js:324-338`, `engine.js:479-495`).
- `hurt()` at `engine.js:69` grants dash i-frames; close-range kills heal `n*3` (`engine.js:115`); parry heals 15 and pays 200 style
(`engine.js:438`). **Healing is already earned by contact.** That is the resource economy to build dread on.

### 1.4 Audio plumbing is ready

- Mix profiles, per-type voice caps and cooldowns: `assets/audio.js:15-44`. Music scenes: `assets/audio.js:45-50`, lifecycle at
`assets/audio.js:232-250`, crossfade at `assets/audio.js:643`.
- Ambience loops and synthesises a fallback at `assets/audio.js:583-591`; per-kind creature accents at `assets/audio.js:369-401`;
heartbeat/footstep synths at `assets/audio.js:744-747`.
- Footsteps fire every 0.4 m of travel; the heartbeat fires on a fixed 0.8 s cadence below 35 health (`main.js:53`). A 3D listener
is already updated at `main.js:53`.
- Provenance and licence constraints are documented at `docs/audio-sources.md:5-22` and `:26-37`; builds already verify decoded,
finite, non-silent output (`docs/BUILD-10.md`, `tests/build10-audio.mjs`).

### 1.5 Enemy identity and rigs already exist

- Eight Warden material families and four Bellwraith families: `enemy-variation.js:14-86`.
- Bellwraith is a bespoke procedural rig with skull face, eye embers, chains, torn membranes and a hover sigil
(`npc-bellwraith.js:398-399`, `:483-508`), rendered at 1.1 scale (`npc-bellwraith.js:516`) with measured bounds (documented in
`docs/build08-enemy-visibility-qa.md`).
- Warden animation already distinguishes windup depth per kind (`npc-warden.js:57-84`) and scales its mixer speed by measured ground
motion (`npc-warden.js:68-75`).
- Both families are always turned to face the player every frame (`renderer.js:1084`, `renderer.js:1088`).

### 1.6 Pacing machinery already exists

- `engine.js:163-210` is a real director: budget, alive cap, per-item due times, spawn order, intermissions and an `exit` state.
`engine.js:207` is the only genuine downtime in the game.
- `engine.js:234-237` gates the sector exit on proximity; `main.js:53` converts director events into toasts.
- Room progression already drives objective/room/threat text (`ui.js:592-598`, `horror-ui.css:162-177`).

### 1.7 Horror content is already authored, but not wired

`playground/map/dungeon-data.js` contains per-floor `dread`, `signature`, `wallpaper` and **30 authored scare beats**: F1
`:196-202`, F2 `:378-384`, F3 `:565-571`, F4 `:744-750`, F5 `:902-908`. The beat kinds are `scream`, `lights-out`, `swarm`,
`collapse`, `watcher`, `hunt` and `mimic` — including "Something stands under the gantry and never moves while you look at it"
(`:201`), "a face in the drawer that stays exactly where it is" (`:383`) and mimic surgery (`:380`). None of this is playable yet;
the story dungeon is design-only. **This is the single richest vein to mine — most of §3 is wiring what already exists rather
than inventing new content.**

Setpiece builders for collapse, bulkhead and pressure-door beats also already exist: `world-authored.js:108-133`, `:135-163`,
`:164-286`.

### 1.8 Prop kits already exist

`world-polish.js:617-627` defines barrels, tipped barrels, oil, blood, congealed gore, body piles, bone piles, bone stacks, ribs,
skulls, skull clusters, shelves, eyes, limbs, hooks, cages, hanging corpses and bone chimes; sector dressing runs at `:659-686`
(bloodworks), `:700-715` (ossuary), `:741-745` (choir). All are merged/instanced. Visual content is **not** the gap.

### 1.9 The real gaps

1. Nothing is ever hidden. Every threat announces itself through at least two channels.
2. There is no silence: ambience, music, moans, footsteps and heartbeat all run continuously.
3. There is no threat that *isn't* a target. Everything in the game can be shot and killed.
4. Downtime has no fiction, so there is no safety to violate.
5. Fear content is authored (1.7) but the director has no notion of pacing beyond spawn budget.
6. Co-op is not part of the horror: `main.js:14` does not snapshot `run.pools`, and `main.js:39` does not validate them, so guests
already miss glob pools — any new dread entity needs a snapshot decision.

## 2. The levers, judged

Each lever: mechanism → why it works → exact hook → cost → the way it turns into annoyance. Ranked verdicts are in §3; this
section is the menu.

**L1. Sound before sight.** Cue the *approach* (wet drag, chain slack, breath, grit) 0.4–1.2 s before the silhouette enters the
fog, with distance encoded in level and filtering. Why: partial information forces the player to build the threat, and the imagined
version is always worse. Hook: `assets/audio.js:369-401` (creature accents) plus `MIX_PROFILES` (`:15-44`); emit from
`engine.js:141-152`/`:186-201`; the listener already exists (`main.js:53`). Cost: low–medium. Annoyance risk: cue spam — if
every enemy cues on every tick, the brain filters it out fast. Gate on off-screen only, one voice per family, real cooldowns.

**L2. “It knows where I am.”** Let a threat *find* the player before it engages: a searching phase, a shared call-and-answer,
head/gaze tracking that starts a beat before movement. Why: being located is more frightening than being attacked; it converts open
space into an audience. Hook: `npc-warden.js:57-84` (head pose already writes each frame) and `npc-bellwraith.js:588-635` (face
embers already animate); the renderer already faces enemies at the player (`renderer.js:1084`, `:1088`). Cost: low. Annoyance risk:
omniscience feels like cheating — detection must be caused by something (sound, line of sight, your own gunfire), not by an aura.

**L3. Safe-room violation.** Make one intermission per sector *feel* settled — lights steady, music returns, HUD relaxes — then
break it once, with a tell that is not a spawn ring. Why: relief is what makes the next pressure land; a game that is loud forever
has no dynamic range. Hooks: `engine.js:177-182` and `:207` (intermission state), `assets/audio.js:232-250` (scene/music),
`main.js:53` (toasts). Cost: medium. Annoyance risk: breaking rest *every* time turns downtime into a trap and the player stops
resting at all. Cap: one violation per sector, never within 30 s of the previous scare, never while the player is at critical
health.

**L4. Resource dread.** The resource is distance, not ammo: healing is contact-gated (`engine.js:115`, `:438`) and dashing is
invulnerability (`engine.js:69`). Make low health *perceptually* leaky so retreating to safety feels worse than pushing. Hooks:
heartbeat cadence (`main.js:53`), the unused `heal` field (`main.js:11`), vitals HUD (`ui.js:541-560`). Cost: low–medium.
Annoyance risk: if fleeing is punished mechanically, low-skill players get trapped; keep every movement option intact and only
change feedback.

**L5. Pacing / silence vs noise.** Current mix density: ambience always on (`main.js:16`, `:27`), music bed at .12
(`assets/audio.js:47`), `moan` at .5 s cooldown with 2 voices (`assets/audio.js:33`), heartbeat every .8 s low, footsteps every .4
m. Silence is a resource that is never spent. Why: habituation — constant sound becomes wallpaper. Hooks: audio groups/filters and
`_fadeMusic` (`assets/audio.js:643-660`), driven from director state (`engine.js:171-210`). Cost: medium. Annoyance risk: silence
during combat reads as a broken mixer, and never duck weapon feedback.

**L6. Low-information enemies.** Strip one information channel per family so players must learn two tells instead of reading one
ring (stalker keeps visual + audio; hexer loses the ring, keeps audio; watcher has neither). Why: mastery is comfort; provisional
knowledge keeps attention up. Hooks: `npc-warden.js:57` ring visibility and `renderer.js:1114-1119`. Cost: low. Annoyance risk:
unreadable is not scary, it is unfair. Hard rule: every damaging attack keeps at least one reliable channel, ≥0.25 s before
damage.

**L7. Camera / FOV language.** The camera already speaks damage and speed. Give it a third register: slow horizon drift, micro-roll,
a degree or two of narrowing that appears near thresholds and watchers, with no effect on input. Why: players read camera motion as
their own body, so small incongruities create unease with no event attached. Hook: `_updateCamera` (`renderer.js:1356-1371`),
already gated by `settings.reducedMotion` (`renderer.js:1434-1437`). Cost: low. Annoyance risk: motion sickness and ruined aim.
Respect reduced motion, never apply while airborne or aiming, cap amplitude hard.

**L8. HUD degradation.** Corrupt *narrative* chrome (objective, room threat, style label) under pressure; never combat-critical
readouts. Why: the HUD is the player's certainty, and a stuttering HUD reads as a stuttering body. Hook: `ui.hud` (`ui.js:528-602`),
`_setHud` (`:604-609`), `.is-critical` and the veil (`horror-ui.css:95-97`, `:115-117`). Cost: low. Annoyance risk: if
health/dash/ammo become unreadable it is immediately infuriating. Freeze list: vitals, dash pips, weapon name/ammo, crosshair,
progress bar.

**L9. False safety signals.** Let one signal lie per sector: a gate-open sound before the gate opens, a 100% clear tick a beat
early, a `sector-transition` sting with no transition. Why: one trustworthy lie recasts every other signal as provisional. Hooks:
`ui.js:592-598` progress, `engine.js:234-237` exit check, `main.js:53` toasts. Cost: low. Annoyance risk: lying about *mechanical*
state is a bug report, not horror. Lies may only live in ceremony and anticipation, never in collision, objectives, or health.

**L10. Uncanny animation.** Mismatched motion: a Warden stopping mid-stride while its head keeps turning; a Bellwraith perfectly
still while chains and membranes keep drifting. Why: the uncanny is a violation of expected motion, and our rigs already have
independently animated parts. Hooks: `npc-warden.js:68-75` (mixer speed is already driven by `motion`) and
`npc-bellwraith.js:620-634`. Cost: low. Annoyance risk: if it looks like a dropped frame, fear becomes frustration — the pause
needs a readable pose and a purpose.

**L11. The watcher that never attacks.** One entity, zero attacks, unkillable, standing at a fixed point, always oriented at the
player, despawning when line of sight breaks or after ~40 s; at most one alive and at most once per room per run. Why: the threat
that does nothing is the one players write stories about, and it gives rooms memory. Hooks: a dedicated `run.watchers` list
simulated near `engine.js:129`/`:171`, rendered beside `renderer.js:1085-1090`; use the authored `watcher` beats from
`dungeon-data.js:201`, `:383`. Cost: medium. Annoyance risk: players shoot it and nothing happens → “broken”. Give it
deliberate non-target feedback (impact with a wrong, muffled sound; no blood, no flinch) and exclude it from `aliveEnemies` so it
cannot affect wave completion.

**L12. Mirroring the player's own movement.** A mimic that replays the last 2–3 s of your strafing and dashing; in co-op, a horror
beat where the partner avatar appears a beat behind. Why: seeing your own behaviour performed by something else attacks the
self/other boundary. Hooks: `_updatePeer` (`renderer.js:1137-1170`) already renders a second humanoid on the sim transform;
determinism seeded by `limbRoll` (`engine.js:73`). Cost: high (input ring buffer, ghosts, co-op authority). Annoyance risk: in co-op
it is indistinguishable from lag/desync, so ship it solo-first or host-authoritative with an unmistakable tell.

**L13. Loss of agency without loss of control.** The room removes options (door seals, light dies, route collapses) but never the
movement kit. Why: helplessness in the *environment* is horror; helplessness in the *controls* is bad design. Hooks: existing
setpieces (`world-authored.js:108-133`, `:135-163`, `:164-286`) and the authored collapse/lights-out beats
(`dungeon-data.js:199-202`, `:568-570`, `:747-750`). Cost: medium. Annoyance risk: sealing a low-health player, or sealing the only
route while a glob pool blocks it, feels like a cheap shot. Telegraph the seal and never seal the only exit.

## 3. Ranked recommendations

Ranked by impact-per-hour inside each bucket. The five to do first are called out in the handoff summary.

### (a) Quick wins — each under an hour

**R1. Windup audio before the arc lands.** *(rank 1)* Hook: when `e.attacking=true` is set at `engine.js:399`, also push a
lightweight `enemy-windup` event carrying `enemyKind`, `variant`, `windupTime` and distance. Add an alias + profile in
`assets/audio.js` near `:81-94` and `:15-44`; reuse `_synthCreatureAccent` (`:369-401`) with a shorter, higher, quieter shape than
the strike sound. Player experience: a wet inhale/drag precedes every slash, so the swing is answerable by parry or dash
(`engine.js:247`) instead of being a surprise. Verify: engine test asserts a windup event ≥0.25 s before any damaging
`enemy-attack` event; audio check confirms finite, non-silent output per kind (pattern: `tests/build10-audio.mjs`). Risk: doubles
the audio churn around a wave; keep one voice per enemy with the existing cooldowns.

**R2. Low-health hearing dies before vision does.** *(rank 2)* Hook: in `main.js:53` replace the fixed `health<35` / 0.8 s heartbeat
with an interpolated cadence (≈1.1 s at 40 HP → ≈0.45 s at 1 HP), and ramp a lowpass + gain duck on the `ambience` and `music`
groups (group plumbing at `assets/audio.js:655-660`) as health falls. Leave `sfx` untouched. Player experience: the world goes
muffled and your own pulse gets closer; a danger you can hear but not hear *over*. Verify: offline render or analyser test proving
≥6 dB of ambience attenuation at 20 HP while weapon and creature cues are unaffected; a manual run confirming weapon audio stays
crisp. Risk: players who play muted lose nothing (acceptable) — never let it hide an incoming attack.

**R3. Stop announcing every wave.** *(rank 3)* Hook: `main.js:53` fires `ui.toast('WAVE n / 3 — INCOMING')` on every wave. Keep
the toast for the first wave and for `sector-transition`; let later waves be carried by a single diegetic sting (`assets/audio.js`
`wave` profile, `:42`) and the director's own telegraphs. Player experience: waves stop feeling like UI events and start feeling
like the building noticing you. Verify: count toasts in a scripted 3-wave run (extend `tests/sustained-playtest.mjs`); expect
exactly one wave toast per sector. Risk: first-time players may miss that a wave started — keep the wave sting loud and
directional.

**R4. Degrade only the narrative HUD at critical.** *(rank 4)* Hook: extend the existing `.is-critical` state (`ui.js:557`,
`horror-ui.css:95-97`) so objective text, room threat and the style label flicker/substitute glyphs. Add `data-threat` on the HUD
root so the intensity can come from a future director phase. Player experience: the mission text stops being trustworthy exactly
when the body does. Verify: screenshot/visual contract at critical health (pattern: `tests/room-visual-contract.mjs`), plus an
assertion that vitals, dash pips, weapon name, crosshair and progress bar are untouched. Risk: readability — anything that gates
survival stays frozen.

**R5. Hush on sector entry.** *(rank 5)* Hook: on the first intermission of a sector (`engine.js:207`, `:222-224`), hold 2.5–3 s
with ambience and music ducked near silence, then bring the room back. No new systems: drive it from the existing scene and
`waveDelay`. Player experience: stepping into a new wing has a held breath before the first cue. Verify: log a timestamped
measurement that ambience/music fall ≥6 dB for ≥2.5 s at sector start without delaying the first spawn beyond the existing
intermission. Risk: drag if it repeats on every wave — sector entry only, hard cap 3 s.

### (b) Medium

**R6. Per-family threat audio identity (off-screen only).** *(rank 6)* Hook: extend `_synthCreatureAccent`
(`assets/audio.js:369-401`) so each campaign identity (`skitter`, `bloodhound`, `caster`, `hexer`, `mireSinger`, `brute`, `warden`)
has a distinguishable approach cue, and emit it from the director/spawn path (`engine.js:141-152`, `:186-201`) only when a `castRay`
check confirms no line of sight. Player experience: you learn the roster by ear, and can name what is coming before it rounds the
corner. Verify: blind identification harness — 8 trials per family across four families, ≥80% correct (new
`tests/psych-audio.mjs`, modelled on `tests/build10-audio.mjs`). Risk: seven identities is a lot to learn; keep the families to four
clusters and put the fine distinction in weighting, not melody.

**R7. The watcher that never attacks.** *(rank 7)* Hook: add `run.watchers` alongside `spawnTelegraphs` (`engine.js:54`), excluded
from `aliveEnemies` (`engine.js:129`, `:175`) and from `damageEnemy`; render via the Bellwraith path at `renderer.js:1085-1090` for
silhouette reuse. Source positions from the authored watcher beats (`dungeon-data.js:201`, `:383`, `:570`, `:749`, `:907`). Despawn
on line-of-sight break or 40 s; one alive. Player experience: a shape that is always facing you and is gone the instant you look
away — the room has an occupant. Verify: engine test — watcher never damages, never blocks movement, never counts toward wave
completion; max 1 concurrent, ≤1 per room per run; a screenshot showing the silhouette at fog distance. Risk: it must read as
deliberate. Add non-target feedback (muffled impact, no blood, no flinch) or players will file it as a bug.

**R8. Director tempo: quiet → stalk → peak → relief.** *(rank 8)* Hook: extend `run.director` (`engine.js:167`) with a `phase`
and a `dread` ledger `{phase, intensity, lastScareAt, lastScareRoom, cuesThisMinute}`, advanced inside `updateCampaignDirector`
(`engine.js:171-210`). Rules: no scare twice in the same room within 30 s; never peak while the player is at critical health; at
least one quiet phase between peaks. Surface `phase` to audio (R2/R5 ducks) and HUD (`data-threat`, R4). Player experience: the
arena breathes — pressure, release, pressure — instead of running at one volume. Verify: bot run of ≥3 minutes asserts the
ledger rules and that every `scream`/`hunt`/`swarm` event carries a room id and timestamp; log review
(`tests/sustained-playtest.mjs`). Risk: a visible pulse can feel mechanical; the phase must never surface as a number or bar to the
player.

**R9. The room remembers.** *(rank 9)* Hook: blood already persists and creeps (`engine.js:498`) while sector advance clears pools
and projectiles (`engine.js:224`). Make that deliberate: on each new wave, convert the previous wave's `r.blood`/`r.gore`/`r.limbs`
into a small set of authored dressing marks (reuse the `blood`/`congealed`/ `limbs` kinds from `world-polish.js:617-627`) and let
one corpse from the last wave spawn as a landmark. Player experience: wave 3 is fought in the remains of waves 1 and 2 — the room
accumulates your history. Verify: after a scripted two-wave run, assert the second wave contains ≥N prior-debris marks and that
instanced pool counts stay within `MAX_BLOOD`/`MAX_GORE` (`renderer.js:27-29`). Risk: clutter and perf; cap and recycle rather than
accumulate forever.

**R10. Co-op as a dread source, not just a second gun.** *(rank 10)* Hook: the guest already renders the host avatar
(`renderer.js:1137-1170`). Add delayed, filtered partner footsteps and a partner silhouette that lingers in fog a beat after the
partner leaves; ensure any new dread entity is snapshot-safe — note `main.js:14` omits `run.pools` and `main.js:39` does not
validate it, so pools (and any watcher list) need explicit snapshot decisions. Player experience: your partner's presence is
comforting and then, once, ambiguous. Verify: two-client co-op run asserts watcher/pool parity or an explicit host-authoritative
ownership note; no desync regression in `tests/coop-game.test.mjs`. Risk: ambiguous partner reads as lag. The ambiguous beat must be
a bounded, authored moment, not default behaviour.

### (c) Needs new systems

**R11. Mimic entity with an input ring buffer.** *(rank 11)* Hook: record the player's last ~3 s of `{x,y,angle,dashTime,slide}`
inside the 120 Hz step (`main.js:54`), then have a mimic replay it on a loop, visible at the edge of fog. Solo-first; if shipped to
co-op it must be host-authoritative and replay the *host's* record only. Player experience: you watch something walk your exact
line, badly. Verify: engine-level determinism test — replay is byte-identical for a fixed seed and input script; visual capture of
the mimic mid-replay; co-op test asserting it cannot drift guest state. Risk: high — movement bugs here are the worst kind; keep
it out of the damage path entirely at first.

**R12. Silence bus with measurable pressure.** *(rank 12)* Hook: add a `pressure` control in `assets/audio.js` that scales
`ambience`, `music` and `moan` group gains from the director phase, with an authored 0.3–0.8 s hard mute reserved for scare beats.
Weapons, footsteps, damage and enemy attack cues are exempt. Player experience: the room holds its breath before it bites. Verify:
analyser/offline measurement that the pressure bus moves ≥6 dB and that a hard mute never affects `sfx`; assert no mute occurs
while a damaging attack is airborne. Risk: a mixer that drops out reads as a bug — mutes must coincide with a visible authored
beat (lights, door, intake) so the cause is legible.

**R13. “Wrong room” run memory.** *(rank 13)* Hook: persist a run-scoped record of where the player took damage and where they
died (`r.health` transitions, `engine.js:69`; respawn at `engine.js:507`), then let the next entry into that room author a callback:
your own blood, a Warden standing where you fell, the same light out. Player experience: the arena remembers you specifically, not
just that a fight happened. Verify: scripted die→revive→re-enter test asserts the callback marker appears in the correct room
and nowhere else; persists across sector advance (`engine.js:219-232`) but resets in `newRun` (`engine.js:49-55`). Risk: can read as
a bug if the callback is ambiguous — one marker, clearly placed.

**R14. Co-op shared-hallucination beat.** *(rank 14)* Hook: a host-authoritative `perception` flag on a single event: one client
sees a watcher/ember lit, the other sees nothing, agreeing only on a shared sound. Uses the same entity plumbing as R7 plus the
snapshot path in `main.js:14`/`main.js:39`. Player experience: the two of you genuinely disagree about what you saw, and the game
never resolves it. Verify: two-client test asserting the event is host-authoritative, deterministic in replay, and never affects
damage or wave state. Risk: if it happens often it becomes a known trick; once per run, no more.

## 4. Do not do this

- **Never take the movement kit.** No forced slow walks, no scripted limp, no stolen dash/slide/grapple, no control inversion. This
game's fear must come from the room, not from losing the floor.
- **No untelegraphed jumpscares.** A loud sting + face with no anticipation is the cheapest scare available and it habituates in one
run. Every damaging attack keeps a channel ≥0.25 s ahead of damage.
- **No scare twice in the same room within 30 s**, and no loud scare while the player is at critical health or mid-respawn (already
`mode!=='play'` dead-states, `engine.js:270`, `engine.js:507`).
- **No lying about mechanical state.** Gates, objectives, health, ammo and collision must never lie (L9).
- **No HUD obfuscation of combat-critical info.** Vitals, dash, weapon/ammo, crosshair and progress freeze.
- **No clichés**: mirror jumpscares, little-girl laughter, static bursts, abandoned photo of a family, "the real monster was you",
sanity meters drawn as a bar. They read as theme-park, not dread.
- **No gore escalation as a substitute for design.** `world-polish.js` and the gore pools already cover the body horror; more
corpses is noise and fill-rate, not fear.
- **No spawning in view.** `safeSpawnPoint` (`engine.js:190-199`) is what makes the arena's space legible; never break it for a
cheap ambush, even for a scare.
- **No audio stacking.** Do not run drone + whispers + heartbeat + music simultaneously; the mix's alarm value depends on contrast
(L5).
- **No horror that only exists in the HUD.** If a beat is invisible with the HUD hidden, it is not horror, it is chrome.
- **No punishing retreat.** Healing is contact-gated (`engine.js:115`, `:438`); that already creates risk. Adding a mechanical
penalty for disengaging breaks the movement identity and punishes new players.

## 5. Psychological horror for the models and creatures

The rigs are already good enough; the work is *performance and reading distance*, not more detail.

- **Silhouette.** At 88–100 m fog far (`world-horror.js:4-8`), only the dominant shape reads. Each family needs one silhouette
idea that survives fog: Bellwraith = hanging bell/cage mass; brute = high shoulders and back plate (`renderer.js:1050-1059`); caster
= halo ring (`renderer.js:1043-1048`). Variant work today changes colour only (`enemy-variation.js:14-86`) — add one silhouette
difference per family (shoulder asymmetry, head offset, arm length) so identity is body-shaped, not just hue.
- **Motion.** Stillness is the strongest free tool. `animateWarden` already scales mixer speed from measured motion
(`npc-warden.js:68-75`), so a `stillness` state that drives motion to ~0 for 0.3–0.9 s and holds a deliberate pose is nearly free.
A thing that stops is uncannier than a thing that lunges.
- **Eye contact.** Bellwraith has eye embers that already scale on attack (`npc-bellwraith.js:398-399`, `:633-634`). Give the Warden
one asymmetric eye/visor emissive whose intensity follows the dot product between its facing and the direction to the player — it
brightens when watched, dims when you look away — so "it was watching you the whole time" becomes literally true. Reuse the
per-instance material clones that already isolate hit flashes (`npc-warden.js:36-39`).
- **Asymmetry.** One shoulder higher, one arm dragging, one chain longer, one eye lit. Symmetry reads as design; asymmetry reads as
*wrong*. Keep it subtle and consistent per individual so the player can learn a creature's tic.
- **Scale.** Bellwraith already renders at 1.1 with measured bounds (`npc-bellwraith.js:516`; bounds in
`docs/build08-enemy-visibility-qa.md`). Rarity gives scale meaning: if one hulking variant exists, the normal ones should feel
smaller. Do not inflate everything.
- **The uncanny checklist per creature.** Warden: head turns before the body; a stopped stride; a limb that lags; a pause that ends
when the player looks at it. Bellwraith: hover perfectly still while chains keep drifting; embers track the player; the mouth-chain
rattle answers the player's footsteps. Both: never flinch from a hit in a way that reads as pain — flinch is humanising, and these
are not.
- **Performance guardrails.** Warden geometry and maps are shared between instances (`docs/enemy-variations.md`); Bellwraith
templates are cached per family with four entries (`npc-bellwraith.js:194-237`). Any new part must be merged into the existing
template or instanced. A new draw call per watcher is acceptable; a new draw call per watcher *part* is not.

## 6. QA acceptance list

Each line is checkable by an automated harness or a recorded playtest. Existing harness patterns: `tests/build10-audio.mjs`,
`tests/sustained-playtest.mjs`, `tests/frame-budget.mjs`, `tests/room-visual-contract.mjs`, `tests/map-playground.test.mjs`.

1. **Threat ID by ear.** With the screen black, ≥80% correct family identification over 8 trials × 4 families (R6 harness).
2. **No repeat scare.** No `scream`/`hunt`/`swarm`/`collapse` event fires twice in the same room within 30 s, and never within 30 s
of another scare in that room; asserted from the `run.dread` ledger (R8).
3. **Telegraph floor.** Every damaging enemy attack has at least one observable channel ≥0.25 s before the damage tick; engine
test over a ≥2-minute scripted fight, logging windup→strike deltas.
4. **HUD-hidden run.** All three sectors are completable with objective/room/narrative text hidden — proves horror chrome is not
load-bearing.
5. **Low-health audio.** Crossing 35 HP changes ambience/music within one frame; ≥6 dB attenuation at 20 HP with `sfx` unchanged
(R2).
6. **Watcher contract.** Never damages, never blocks movement, never counts toward wave completion, ≤1 alive, ≤1 per room per
run, despawns within 45 s (R7).
7. **Reduced motion.** With `reducedMotion` on (`ui.js:6-11`, `renderer.js:1434-1437`), no new camera effect exceeds the current
damage-shake baseline (`renderer.js:1365-1366`).
8. **Gore off.** With the gore preference off, no new blood/gore/debris is emitted; dressing marks already in the world may remain
(the renderer already carries `data-gore`, `horror-ui.css:117`).
9. **Budget.** The new content adds ≤12 draw calls and ≤40k triangles on the reference scene, measured by
`tests/frame-budget.mjs`; no new per-frame allocations in `animateWarden`/`animateBellwraith`/audio.
10. **Silence is measurable.** Quiet phases duck ambience + music ≥6 dB without touching `sfx`; no hard mute occurs while a
damaging projectile is airborne (R12).
11. **One loud event per 8 s.** Across all scare sources, no two loud beats land within 8 s; asserted from event logs in a scripted
run.
12. **Accessibility parity.** Every new beat has a reduced-motion path and a gore-off path, and no beat depends on audio *or* vision
alone to be survivable.
13. **Co-op integrity.** Any new entity is either in the snapshot with validation (`main.js:14`, `main.js:39`) or explicitly
render-local; `tests/coop-game.test.mjs` must pass with no new desync and no guest/host disagreement on damage or wave state.
14. **Blind playtest verbatims.** ≥5 of 8 testers name an unseen threat or a specific creature by sound before naming any visual
effect; recorded and attached to the pass.
15. **No regression.** `npm run test:engine` (20), map tests (4) and the build suites still pass, and the browser smoke run reports
zero console errors.
