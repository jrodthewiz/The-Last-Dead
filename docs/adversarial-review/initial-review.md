# Initial full-council review

October 1, 2026. All 19 inherited briefs and seven new critics were applied. Three `default` subagents carried the actual inherited briefs in separate groups of 7, 6 and 6; the primary agent applied the seven new art/direction briefs. Custom profile names were not available in this running session. This is source inspection, two bounded engine probes, and inspection of historical screenshots. It is not a new live playtest, artistic verdict or release acceptance.

The working tree was already dirty at the start, based on `91d08ca2c3613edf6b6d12b9795febe2a7685e6f`, with lighting, corpse physics, cut preview, renderer, loading and performance work. That work was preserved. This task adds review profiles, provenance, reports and routing instructions. The existing game tab and server were kept intact.

## The strongest challenge

**The game has direction on paper. Its governing relationship between momentum, power, body horror and harvesting is not yet demonstrated to players.**

The dismissive critic's version is: “You have built a machine for making impressive violence. You have not yet shown why that violence belongs to this place, or what it makes the player feel beyond accomplishment.” This is our adversarial formulation, not a quotation or a conclusion that the work is not art.

The strongest defense is already in the game. You heal by getting close to bodies; visible score is banked by committing to extraction; the place industrializes human remains. Those rules could give the game a specific artistic identity. Human records, floor functions and the containment thread also contradict the claim that the creator has no direction.

The next creative decision is a hierarchy: is this primarily exuberant combat in a horror world, oppressive horror punctuated by combat, or body horror in which the player's survival makes them complicit? These are viable choices. The current review cannot choose the creator's intention by committee.

## What the review actually established

| Finding | Verdict and limits | Evidence |
| --- | --- | --- |
| Direction asks for forward momentum; visible style rewards a stationary extraction commitment | **CONFIRMED** tension; whether it strengthens or harms pacing is **RISK** | `docs/direction-v2.md:5`; `engine.js:196`, `:322`, `:413`, `:431`, `:441` |
| Written combat/style promise and controls omit the current banking bargain | **CONFIRMED** documentation drift; in-game contextual teaching is counterevidence | `README.md:40`; `main.js:96`; `ui.js:907` |
| Story says containment occurred, while cited completion path is encounter/key readiness plus exit proximity | **RISK** of an unearned or unclear ending; symbolic action may suffice | `playground/map/dungeon-data.js:935`; `engine.js:1763`; `ui.js:729` |
| Guest position smoothing can interpolate between two legal positions into an illegal corner pose | **CONFIRMED** geometric breach in an engine probe; live player-visible severity **UNVERIFIED** | `main.js:90`; `engine.js:1097`; [probe report](evidence-council.md) |
| Revival retains frozen velocity, dash timer and pressed edges from death | **CONFIRMED** retained state in an engine probe; gameplay consequence **RISK** | `engine.js:1491`, `:1770`; [probe report](evidence-council.md) |
| HUD FPS uses elapsed time after a 100 ms cap | **CONFIRMED** undercounting of long-frame time; current performance **UNVERIFIED** | `main.js:302`; [engineering report](engine-council.md) |
| README and advertised networking tests describe a legacy flow | **CONFIRMED** drift; current PeerJS path has historical coverage | `README.md:49`; `main.js:13`, `:88`; `tests/network.test.mjs:51`; `tests/melee-input-coop.mjs:71` |
| Body-camera/view-punch presentation can differ from the simulation's firing ray | **CONFIRMED** different transform inputs; misleading aim severity **RISK** | `renderer.js:2022`; `bodycam-motion.js:55`; `engine.js:1483`; [design report](design-council.md) |
| Ordinary remote survivor animation does not integrate received weapon state | **CONFIRMED** in the cited animation path; rendered severity **UNVERIFIED** | `main.js:53`; `assets/survivor/meshy-survivor.js:55`; [engineering report](engine-council.md) |

These findings do not authorize automatic gameplay changes. They give the team concrete choices and narrow falsification tests.

## A proposed direction to test

**Candidate player promise:** “Fight deeper into a facility that turns bodies into resources; survive by adopting its practices, then confront what your survival has cost.”

This is a proposal inferred from existing mechanics, not an approved rewrite of the premise. It would make the extraction stop intentional rather than an exception to the movement pitch.

If selected, three pillars could govern the next slice:

1. **Violence is useful and intimate.** Close fighting and harvesting earn survival while making bodily exploitation unmistakable.
2. **Momentum meets commitment.** Traversal empowers; choosing when and where to stop creates a dangerous bargain. Interruptions serve that rhythm rather than randomly obstructing it.
3. **The place explains the consequence.** Room function, human records and the final action expose what the facility does and what the player has repeated or ended.

For this experiment, postpone new weapons, additional effect families and cosmetic room expansion. That is a proposed scope discipline, not a claim those features are bad or an instruction to remove them. Use the existing first floor to test the relationship between combat, harvesting, a human discovery and moving onward. Preserve the current mechanics until the intended hierarchy and test results justify changes.

## The smallest useful next review

Give five fresh players the first Story floor without a developer narration. Record their first minute, first varied combat, first extraction, one optional record and exit. Ask them afterward what they were trying to achieve, why they approached bodies, whether stopping felt tactical/compulsory/unnerving, and what the place meant. Proposed targets: four identify the immediate destination and healing rule; three explain pending versus banked style and describe a specific action-to-setting relationship.

The experiment must be able to fail. If players only see a score farm, either commit openly to that action-horror identity or make the harvesting consequence perceptible. If they recognize the intended bargain and want to continue, the harshest art/direction critics have evidence against their opening attacks. The creator's intended experience governs which response to pursue.

For engineering, the minimal follow-ups are collision-safe guest correction and a defined revive reset contract, followed by current-route co-op checks tied to an exact source/build. Separate uncapped frame telemetry from capped simulation catch-up. The review has not implemented these proposals.

## Complete coverage

- [Seven inherited design and gameplay lenses](design-council.md).
- [Six inherited engine and presentation lenses](engine-council.md).
- [Six inherited authority, physics and evidence lenses, including executed probes](evidence-council.md).
- [Seven new art, direction and newcomer critics](art-direction-council.md).
- [Roster, source basis and reusable review request](README.md).
- [Original profile hashes and adaptation manifest](manifest.json).

Setup validation passed: all 26 installed TOMLs parse, have unique names matching the manifest, retain read-only scope and omit model pins. All 19 original source hashes match, and all six review documents exist. The AGENTS.md diff passed whitespace validation. Loading named roles in a future session depends on that session's actual catalog; this review used explicit briefs with available roles.
