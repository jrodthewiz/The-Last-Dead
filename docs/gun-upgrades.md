# Gun Upgrades — Judged Build Spec (v1)

Judge pass for the four drafted upgrades: Reliquary Wager (Ossuary), Pressure Cooker (Breach),
Choir of Nails (Arc Lance), Tear Surfing (Reliquary). This file is the build contract.
Implementers do not re-litigate verdicts. `engine.js` is owned by the engine agent; this doc
specifies hooks only, and the engine owner lands all four in ONE consolidated pass.

## 0. Ground truth (verified in repo)

- Base stats (engine.js:19-22): Ossuary 2 dmg / .22s / 20m hitscan; Breach 1.2 x 9 pellets / .72s /
  7m; Arc Lance 12 dmg / 5s / 24m pierce; Reliquary 24 dmg rocket / 1.1s / radius 1.6.
- Alt-fires already exist (engine.js:249-259): coin toss (4 charges, 2s regen), rocket in-flight
  detonation, Breach core ejection. Shooting your own core explodes it; Arc+nuke does 22 in 2.3m
  with +350 style. Coin ricochet: 9 dmg nearest enemy, +180 style (engine.js:264-265).
- `explode()` (engine.js:513): rocket 24 dmg/1.65m; core 9/1.1; nuke 22/2.3. Rocket self-boost
  exists; **player self-damage does not** — `hurt()` is called only by enemy sources (336/461/492).
- Blood healing (engine.js:115): damage dealt within 1.25m heals 3x. Style: decay 35/s; ranks at
  120/300/550/800/1100/1400 (engine.js:499, 510). Get-close aggression is the core identity.
- Net: `playerFields` (main.js:11), snapshot arrays (main.js:13), apply-copy list (main.js:40).
  Coins and projectiles are already synced whole; new world arrays must join all three lists.
- Renderer already instances coins (renderer.js:391, cap 64) and projectiles (351-359).

## 1. Scoreboard

Legend: Fun/Readability higher is better; Cost 10 = cheapest to build; Balance 10 = lowest risk.

| Gun | Idea | Verdict | Fun | Read | Cost | Balance |
| --- | --- | --- | --- | --- | --- | --- |
| Ossuary | Reliquary Wager -> **Coin Caller** | approve, amended | 8 | 7 | 6 | 7 |
| Breach | **Pressure Cooker** | approve, amended | 8 | 8 | 8 | 6 |
| Arc Lance | Choir of Nails -> **Choir of Nails (lean)** | approve, amended | 9 | 6 | 4 | 6 |
| Reliquary | Tear Surfing -> **Tear Surfing (airburst)** | approve, amended | 9 | 8 | 7 | 6 |

## 2. Verdicts and final specs

### 2.1 OSSUARY — "COIN CALLER"

**Verdict: approve with amendments.** The coin bank is the most identity-native pitch (the coin is
already the gun's alt-fire), but the ricochet stack needs a per-bullet bounce field that rewrites
hitscan resolution, and the heal-per-bounce is invisible spam.

Cut: per-bullet `ricochetBounces`, 1 HP per-bounce heal, S+ twin coin (rank-gated = unreadable).
Keep: toss, bank, cash-out, bank cap, coin win condition.

**Final mechanics**

1. Alt toss unchanged: 1 of 4 charges, 2s regen; coin arcs with gravity, 3s life.
2. First bullet contact **banks**: velocity zeroed, coin spins in place, `bankedT=2.5`. Max 3
   banked; a 4th bank fizzles the oldest. First contact deals no damage.
3. Second bullet contact **cashes out**: 1.6m bone shrapnel, damage `7 + 2 x (other live banked
   coins)`, cap 11 at 3 banks, +150 style, gore via existing `burst()`. Banked coins glow and their
   cash hitbox widens to .11 (from .085) so the two-tap is fair.
4. Expiry at 2.5s = quiet fizzle: no damage, no style penalty. The wasted charge is the cost.
5. Shrapnel kills within 1.25m feed the standard blood heal (engine.js:115). No new heal path.

**Edge cases:** burst damage and shrapnel kills are `castRay`-gated; coin state rides the existing
synced `coins` array (no new net fields); banked coin under an enemy is legal; max 6 coins live.

**Files/hook:** engine coin branch gains `hits`/`bankedT` fields plus bank/cash split and a
`coin-bank` / `coin-burst` / `coin-fizzle` event. renderer.js coin instancing gets spin + glow.
weapon-ossuary.js owns kick feedback and card pips; weapon-batching.js instances shards.

**HUD/audio:** 3 pips on the weapon card (visible only when a coin is banked); chime steps up per
bank; bone-crack on cash; dry fizzle on expiry.

**Acceptance:** scripted toss -> shoot -> coin hovers spinning with event; second shot damages a
stalker at 1.2m for 7 (9 with two banks); expiry at 2.5s does zero damage; 20/20 engine tests and
two-run fingerprint equal.

### 2.2 BREACH SHOTGUN — "PRESSURE COOKER"

**Verdict: approve with amendments.** Best fit-to-existing-code of the four (core ejection is
already shipped), but the pitch's "missing the window leaves plain self-damage" is fictional —
self-damage does not exist — and an uncapped 18-heal on a .95s cycle would make Breach the tank.

**Final mechanics**

1. GRILL meter 0-100, pips on the receiver. Each **enemy** pellet hit at <=3m: +12. Decay 20/s
   after 1.0s with no close hit. (Coin/core/floor hits never charge it.)
2. At 100: `r.corePrimed=true`, then GRILL resets to 0 when that core is ejected. Primed core glows
   molten, vents steam.
3. Primed core blast: radius 1.6 (from 1.1), damage 14 (from 9), enemy knockback +25%.
4. **MEAL**: detonating a primed core within 2m while `dashTime>0` and `mealCooldown<=0` heals
   `14 + 3 per enemy killed by that blast` (cap 23), +200 style "+ FAMILY MEAL", refunds the reload
   (`cooldowns[1]=0`), and sets `mealCooldown=4`.
5. Arc firing a **primed** core keeps the nuke: clamp radius 2.6, damage 26, one stack only —
   prime and nuke never multiply.
6. Whiff = wasted core, 0.95s cooldown, GRILL back to 0. No self-damage threat.

**Edge cases:** dash window is evaluated at the instant the core explodes; i-frames unchanged;
guest predicts pips/steam only, health stays host.

**Files/hook:** engine adds `grill`, `corePrimed`, `mealCooldown` player fields (newRun + net), grill
charge in the pellet loop, decay in tickPlayer, primed branch in `explode()`, MEAL at core
detonation. weapon-breach.js draws pips/steam/heat; weapon-materials.js tint if needed.

**HUD/audio:** kettle hiss rising with GRILL, hard "thunk" on prime, wet squelch-pop on MEAL;
one small meter on the weapon card, no new HUD rows.

**Acceptance:** point-blank fill to 100 in <=3s; primed blast at 1.3m applies 14-based falloff (not
9); MEAL heals 14/17/23 by kill count, refuses without dash, locks 4s; Arc clamp verified; 20/20.

### 2.3 ARC LANCE — "CHOIR OF NAILS" (lean)

**Verdict: approve with amendments; scope cut ~40%.** Highest ceiling of the four, but
explosion-amplification bookkeeping and the 40-damage group detonation are where engine cost and
co-op chaos explode. The core loop — nail a line, fire down it twice — stays intact.

Cut: +25% explosion amplification stacking, all-stakes group detonation, 3-hop chains.
Keep: stakes, stake re-emission, hop feel, death pops.

**Final mechanics**

1. Arc hits stake each pierced enemy (life 8s, max 4, oldest replaced; brass nail visible in torso).
2. Re-firing into a staked enemy consumes that stake and re-emits a secondary rail from the stake
   along the trigger pull's exact angle: 6.6 damage (55% of 12), range 12, resolves one target,
   +1 style tick ("+ CHOIR").
3. Chain cap: max 2 re-emissions per trigger pull; the 3rd staked target stops the chain.
4. Staked enemy dies: its nail pops for 5 damage in 1.8m and +40 style.
5. Arc's 5s cooldown is unchanged. The 8s stake life gives exactly one follow-up shot inside the
   window — that tension is the design, do not extend it.

**Edge cases:** stake order deterministic (`along`, then enemy id); stakes on corpses clear; stake
stays world-anchored at the hit point even if the enemy staggers; stakes `castRay`-gated; host owns
resolution, guests render snapshot stakes.

**Files/hook:** engine gains `world.stakes[]` (id, enemyId, x/y/z, dirX/dirY, life), ordered pierce
list for weapon 2, internal `stakeRay(origin, angle, damage, range)` with depth <=2, and
`stake-set` / `stake-hop` / `stake-pop` events. renderer.js gets instanced nails (MAX 16);
weapon-arc.js draws stake-fed rails and the hum; combat-vfx.js pop rings.

**HUD/audio:** no HUD. On hop, a 0.25s faint line back along the original ray so the player sees the
corridor they built. Brass "k-chunk", rising choir hum per hop, pop on death.

**Acceptance:** two enemies in line: first shot sets 2 stakes; second shot re-emits from stake 1
into stake 2 and stops; chain blocked at 2; 8s expiry clears; death pop 5 in 1.8m; two-run
fingerprint equal.

### 2.4 RELIQUARY — "TEAR SURFING" (airburst)

**Verdict: approve with amendments.** Best fun-per-cost idea and it literally matches the gun's
alias (RIFT BAZOOKA), but it was written to *replace* the airburst detonation, which is the
Reliquary's existing skill move. Keep the input, keep the detonation, leave the tear behind.

**Final mechanics**

1. Alt fire keeps its current job: detonate the live rocket. The blast leaves a rift tear when the
   blast point has >=0.6m clearance on all four compass `castRay`s; otherwise it fizzles.
2. Tear: 2.2m mouth aligned to rocket travel, 6s life, max 3 (oldest collapses with a visible
   shrink). Airburst in open space = trampoline; airburst against a wall = no exploit.
3. Entering (player center within 1.1m, moving into the mouth): launch 10.5 u/s along the tear
   direction, gravity x0.5 for 1.4s, launch velocity decays after 0.35s, per-player re-trigger lock
   0.75s. Tears are reusable for their life.
4. Enemies in the mouth are pulled 1.5m (castRay-gated) and staggered 0.35s. Cut the 3m drag.
5. Total boost clamps at 11.5 u/s and stacks with rocket-jump only up to that clamp; never launches
   through geometry.
6. Cut "1.9s of no self-damage" — no self-damage exists to disable.

**Edge cases:** corridor airburst (any ray <0.6m) spawns nothing; downward floor tear is harmless;
dashing into a tear preserves the dash; host spawns tears, guests receive ids via snapshot; kill
within 2s of a launch: +150 style "+ TEAR RIDER".

**Files/hook:** engine spawns `world.tears[]` in the rocket-detonate branch (clearance check), and
tickPlayer gains the entry test, 1.4s gravity multiplier and launch decay. New module
`rift-tear.js` owns the pooled seam mesh/light (reuse explosion-vfx pooling patterns).
weapon-reliquary.js owns launch feedback. main.js adds `tears` to snapshot/sane/apply.

**HUD/audio:** no HUD — the tear is its own read. Wet membrane rip on spawn, static hum, rising
whoosh while riding, whip-crack on launch.

**Acceptance:** mid-room airburst spawns a tear; walking through launches >=8 u/s measurably along
its direction with 0.5 gravity for 1.4s; wall-adjacent airburst spawns none; 3-tear cap holds;
100 scripted airbursts produce zero geometry escapes; 20/20.

## 3. Cross-gun synergy and the loadout rule

Synergies that are allowed:

- Primed core + Arc nuke: clamp 26 dmg / 2.6m (2.2.5). The best cross-weapon moment in the set.
- Stake death pops are triggered by any weapon, so Arc sets up kills for Breach/Reliquary.
- Tear launches stack with rocket-jump under the 11.5 u/s clamp.
- Coin shrapnel does **not** detonate cores — chain systems stay single-step.

**Loadout rule (dominance guard):** one heal (Breach), one traversal tool (Reliquary), one chain
(Arc), one banked burst (Ossuary). No upgrade may add a second tool of another gun's category to
its own gun, and no upgrade may raise another gun's ceiling. Category caps are global, not per-gun.

**Tuning stop rule:** if any gun exceeds 35% of total damage in the 60s scripted arena sim, tune
that gun's numbers before shipping. Target shape: Arc = highest single-target burst, lowest
sustained; Ossuary/Breach = sustained and AoE; Reliquary = displacement and crowd opener.

## 4. Top three risks

1. **Engine hook contention.** Four modules want four different engine changes, and engine.js is
   single-owner. Mitigation: freeze the field/event names in this doc; engine owner lands one
   consolidated hook commit (newRun fields, coin branch, grill loop, stakes, tears, net arrays)
   with 20/20 green before any module polish; implementers code against the frozen names only.
2. **Readability overload.** Four stacked invisible states (bank, grill, stakes, tears) can turn a
   60fps fight into noise. Mitigation: each state gets exactly one world-space read and one audio
   layer, weapon-card only (no new HUD rows), and a QA check that a tester can name each active
   state after a 30s session; verify at 1280x720 with reduced-motion on.
3. **Co-op state authority drift.** New state can land in the wrong owner and desync. Mitigation:
   world state (coins/bank, stakes, tears) is host-simulated and snapshot-synced with <=64 caps;
   player state (grill, corePrimed, mealCooldown) joins `playerFields`; guests predict visuals only;
   each landing runs a 2-client soak (host + guest) with no desync and idempotent events.

## 5. Classification and build order

- **Best overall: Tear Surfing** — a genuinely new verb, readable at a glance, moderate cost,
  clamps keep it from breaking the map.
- **Safest strong build: Pressure Cooker** — mostly reuses shipped core-ejection code.
- **Highest ceiling: Choir of Nails** — best group moment if the lean scope is respected.
- **Most identity-native: Coin Caller** — the coin was already this gun's signature.

Build order:

1. Engine hook pass (engine owner, one commit, all four interfaces + net lists). Tests green.
2. Pressure Cooker — proves the shared patterns (player meter, primed projectile, conditional heal).
3. Tear Surfing — independent world entity; can run parallel with step 2 after hooks land.
4. Coin Caller — coin state machine on the existing coin path.
5. Choir of Nails — last, so it reuses nail instancing and feedback plumbing from 2-4.

Each implementer runs `npm.cmd run test:engine`, their gun's acceptance script, and the two-run
determinism check before reporting. No implementer edits engine.js; hook gaps come back to the
engine owner as a named field/event request.
