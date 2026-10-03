# The Last Dead: evidence council

Review snapshot: October 1, 2026, America/Los_Angeles. Read-only review of current source plus archived evidence, followed by creation of this report. No game code, configuration, browser tabs, or servers were changed. Source line references describe this snapshot and can drift after edits.

The six actual Dogfight TOML profiles were read from `C:/Users/wolfk/Desktop/dogfight/.codex/agents`, along with that directory's README. This council used the available **default-role fallback carrying the actual specialist briefs**. It did not load or impersonate the named custom roles. The directory contains 19 TOML personalities, not 20; README.md is not a twentieth personality.

Duals-specific React, Colyseus and Rapier paths are **NOT APPLICABLE**. Their underlying review principles were adapted to this repository's `main.js` host authority, `engine.js` custom movement/collision, `signaling.js` PeerJS/WebRTC session, authored dungeon data and bundled vendor files.

Verdicts: **CONFIRMED** means source or an executed probe establishes the specific finding; **RISK** means a plausible consequence needs validation; **UNVERIFIED** means necessary evidence is absent; **NOT APPLICABLE** means the inherited requirement does not fit this runtime. A confirmed mathematical/state finding is not automatically proof of an observed player-facing failure.

## Snapshot limitations

The initial status inspection showed modified `afterlife-lighting.js`, `corpse-physics.js`, `enemy-cut-preview.js`, `package.json`, `renderer.js`, `tests/afterlife-lighting.test.mjs`, `tests/corpse-physics.test.mjs`, and `tests/loading-preparation.test.mjs`. Untracked files included `docs/performance-audit.json`, `tests/combat-buffer-reuse.test.mjs`, `tests/corpse-sync-performance.mjs`, `tests/cut-preview-performance.mjs`, `tests/enemy-cut-preview.test.mjs`, and `tests/performance-matrix.mjs`. These edits were preserved. This snapshot does not attribute their authorship or certify their completion.

Executed checks were targeted file reads/searches, profile enumeration, initial `git status --short`, archived JSON inspection, and the two ephemeral Node probes recorded below. No build, full suite, current browser playtest, internet co-op test, or deployment verification was executed by this council. Historical evidence is identified separately from newly executed checks.

## authority-orchestrator — Tower / Anchor / Beacon

Actual brief: explicit lifecycle ownership, startup/connect/topology sequencing, reconnect correctness, and reset/respawn boundaries; avoid unrelated rendering and interpolation work.

**CONFIRMED: documented co-op instructions describe an obsolete connection flow.** `README.md:49–51` instructs offer/answer/accept signaling. Current `main.js:13` imports `PeerJsSession`, `main.js:88` uses six-character host/join codes, and its accept handler only displays an instruction. `ui.js:616` exposes `roomCode`. `signaling.js:214` defaults to `0.peerjs.com`. `docs/network.md:10–16` describes serverless manual signaling for the older transport.

Counterevidence: actual gameplay still uses a real P2P WebRTC channel. A signaling broker is not a hosted simulation or matchmaking service. `README.md:54` accurately discloses no host migration and limited NAT coverage. Historical current-flow acceptance exists below.

Proposed smallest experiment: follow README instructions in two fresh isolated clients. Acceptance: every documented field/button exists and the documented steps bring both players into the same arena.

**RISK: a transport-version handshake is not a game-compatibility handshake.** `signaling.js:419–445` validates envelope version 1 and hello/ack without build, authored-map or combat identity. Counterevidence: README asks both players to use the same build, and normal clients share engine code. No mixed-build failure was exercised.

Proposed smallest experiment: connect deliberately different game builds. Acceptance: incompatible builds are rejected before play, or a documented compatibility contract demonstrates they are safe.

## movement-sync-reconciler — VectorSync / Glide / Pulse

Actual brief: prediction/reconciliation correctness, stale rejection, deterministic reset boundaries, interpolation and single-writer motion ownership; avoid broad startup/rendering refactors.

**CONFIRMED geometric contract breach; player-visible impact UNVERIFIED: snapshot smoothing can create a collision-illegal guest position.** `main.js:90` blends guest positions by 25% for corrections shorter than `.5`, without validating the blended pose. Ordinary movement uses swept collision at `engine.js:1097`.

Executed pure-engine probe on actual `makeCampaignCourse(0)`: A `(2.89, .9)` and B `(3.1, 1.11)` are both legal at radius `.1`. Their distance is `.29698484809835`, within the smoothing threshold. The applied arithmetic produces Q `(2.9425, .9525)`, which `canStand` rejects.

Counterevidence: both peers share `tickPlayer`; snapshot sequences reject stale state; large corrections snap rather than blend. These protect other cases, not this corner arithmetic. The probe did not demonstrate that natural play produces this exact pair.

Proposed smallest experiment: apply an A-to-B snapshot correction at that corner and advance one guest tick. Acceptance: every corrected pose is collision-legal, and corrections do not cause penetration, sticking or repeated oscillation.

## physics-parity-guard — Parity / Lockstep / Grid

Actual brief: shared physics/config ownership, explicit runtime contracts and fail-closed invariant validation. Rapier client/server tooling is **NOT APPLICABLE**; legal custom-engine respawn/correction state is applicable.

**CONFIRMED retained state; intended gameplay consequence RISK: revival restores health while preserving active movement from death.** `engine.js:1770` relocates and revives a player at 65 HP, then calls `resetBite`; it does not reset velocity, dash timer or pressed movement edges. `engine.js:1491` skips dead-player motion updates, freezing those fields during the downed interval.

Executed probe: death with `vx=6`, `vz=2`, `dashTime=.18`, and pressed jump/dash revived after 361 ticks at `1/120` with all those fields unchanged.

Counterevidence: `engine.js:220` resets wounds, bite, vermin and brutal-action state. Revival is implemented; the concern is its incomplete or undocumented movement contract.

Proposed smallest experiment: die during dash/jump, release all input, revive, and advance one tick. Acceptance: a defined revive contract governs retained/reset state, with no spontaneous dash/jump, stale edge suppression or invalid placement.

## repo-searcher — JRodacus / Novva / Chippers

Actual brief: read-only execution-path mapping, ownership discovery, live verification of cached paths, and separation of runtime files from evidence/artifacts.

**CONFIRMED: advertised network execution roots point at a legacy implementation.** Actual flow is `main.js:13` → `signaling.js:245` `PeerJsSession` → bundled PeerJS/WebRTC. `README.md:76` identifies `peer.js` as transport. `tests/network.test.mjs:51` instantiates old `PeerSession`; `tests/coop-game.test.mjs:74–91` expects obsolete offer/answer fields and JSON envelopes. `package.json:20–21` advertises those network/co-op commands.

Counterevidence: `tests/melee-input-coop.mjs:71–98` follows the real room-code UI, RTC connection and chunked payload route. Current-route coverage exists; claiming none would be false.

Proposed smallest experiment: execute the advertised co-op command in isolated contexts and trace its runtime imports. Acceptance: the documented command tests the transport/UI imported by the current game.

Ownership map: `main.js:77` initializes/reset runs; `main.js:90` applies replicated state; `engine.js:1770` revives players; `signaling.js` owns transport lifecycle; `renderer.js` presents state. There is no separately hosted authoritative simulation server.

## adversarial-completion-judge — RedTeam / Break / Contradiction

Actual brief: falsify claimed completion through relevant owning contracts, interruptions, transitions and evidence; missing evidence is not automatically a product bug.

**CONFIRMED documentation contradiction; experiential direction RISK: the pitch says varied attacks increase rank, while score is banked through corpse extraction.** `README.md:40` promises “Mix attacks to increase your style rank.” `engine.js:196–205` accumulates bounded `stylePending`; `engine.js:413–415` banks points through extraction. The README controls omit `G` extraction and `V` chest action. Held harvest is `main.js:96`.

Blunt design challenge: “Are we rewarding fluid combat or stopping to harvest bodies? The pitch and scoring system answer differently.” This challenges coherence, not the user's worth or the game's right to be art.

Counterevidence: extraction is deliberately authored and explained by contextual UI at `ui.js:759` and `ui.js:907–910`. It could be a distinctive horror commitment mechanic. The mismatch does not establish that extraction is bad.

Proposed smallest experiment: have a fresh player perform varied combat and then one extraction; record rank/pending points and their explanation of scoring. Acceptance: the player understands the scoring bargain and the core-loop description matches it.

## validation-gate — Sentinel / Audit / Gauge

Actual brief: scoped diff/evidence integrity, strongest falsifier, minimal meaningful validation, and no substitution of compilation for visual/temporal/multiplayer proof. The user's all-personality request overrides the profile's normal selection limit for this council; findings are resolved through evidence, not vote.

**CONFIRMED evidence-scope limitation; current release acceptance UNVERIFIED: old transport tests and archived melee acceptance cannot certify today's complete dirty runtime.** `package.json:16` includes the older transport fixture. This council did not execute today's complete build/browser acceptance.

Strong historical counterevidence, inspected from `docs/melee-pass/verification/final/qa-results.json`: current room-code flow; chunked payload; trigger-tap and switch cancellation; guest saw release; co-op pause; 120.393 seconds and 100 alternating attacks; disconnect; zero recorded errors. Guest received 2,173 messages, maximum 49,184 characters. The accompanying `docs/melee-pass/verification/README.md` dates the acceptance September 23, 2026.

Artifact integrity matters: `docs/melee-pass/verification/README.md:44–47` explicitly labels earlier `input-coop` and `coop` directories as diagnostic attempts. Their retained failures are not final acceptance failures and must not be cherry-picked. The final acceptance report lacks source/build identity linking it to today's dirty runtime.

`docs/performance-audit.json:326–327` candidly disclaims normal-play FPS, a 144-FPS guarantee, physical-mobile and co-op frame-rate certification. Those limitations are not evidence of dishonesty.

Proposed smallest validation: identify source/build identity, repeat the existing current-flow co-op acceptance, and add the focused corner/revive probes. Acceptance: matched artifacts, successful actual runtime route, and explicit passing movement-transition contracts. A build alone does not establish that claim. Internet latency remains a separately **UNVERIFIED** scope.

## Executed ephemeral probes

These PowerShell commands run from `C:/Users/wolfk/Desktop/thelastdead`. They import current engine code, print JSON, and do not write files or open browsers.

### Revive-state probe

```powershell
node --input-type=module -e 'import {makeCourse,newRun,addPeer,tick} from "./engine.js"; const r=newRun(makeCourse()); r.mode="play"; r.waveDelay=999; r.course.enemies=[]; const p=addPeer(r); r.health=0; r.vx=6; r.vy=0; r.vz=2; r.dashTime=.18; r.pressed={jump:true,dash:true}; for(let n=0;n<361;n++)tick(r,1/120,{}); console.log(JSON.stringify({health:r.health,vx:r.vx,vy:r.vy,vz:r.vz,dashTime:r.dashTime,pressed:r.pressed,z:r.z,peerPosition:[p.x,p.y],revivePosition:[r.x,r.y]}));'
```

Observed result:

```json
{"health":65,"vx":6,"vy":0,"vz":2,"dashTime":0.18,"pressed":{"jump":true,"dash":true},"z":0,"peerPosition":[6.5,10.5],"revivePosition":[6.5,10.5]}
```

### Collision-illegal blend probe

```powershell
node --input-type=module -e 'import {makeCourse,makeCampaignCourse,canStand} from "./engine.js"; for(const [label,m] of [["sandbox",makeCourse()],["coop-sector-0",makeCampaignCourse(0)]]){let found=null; for(let y=1;y<m.h-1&&!found;y++)for(let x=1;x<m.w-1&&!found;x++)for(const sx of [-1,1])for(const sy of [-1,1]){const a={x:x-sx*.11,y:y+sy*.1},b={x:x+sx*.1,y:y-sy*.11},q={x:a.x+(b.x-a.x)*.25,y:a.y+(b.y-a.y)*.25};if(canStand(m,a.x,a.y,.1)&&canStand(m,b.x,b.y,.1)&&!canStand(m,q.x,q.y,.1)){found={a,b,q,distance:Math.hypot(a.x-b.x,a.y-b.y)};break;}} console.log(JSON.stringify({label,found}));}'
```

Observed results:

```json
{"label":"sandbox","found":{"a":{"x":2.89,"y":3.1},"b":{"x":3.1,"y":2.89},"q":{"x":2.9425,"y":3.0475000000000003},"distance":0.2969848480983499}}
{"label":"coop-sector-0","found":{"a":{"x":2.89,"y":0.9},"b":{"x":3.1,"y":1.11},"q":{"x":2.9425,"y":0.9525},"distance":0.29698484809835}}
```

This reproduces the smoothing arithmetic and collision legality, not the browser `applySnapshot` call or a naturally occurring network trace.

## Player promise, art direction and contradictions

Defensible current promise: descend through a body-processing facility, fight aggressively at close range to heal, explore for weapons and records, and commit to corpse extraction to bank combat claims. Solo's five-floor discovery campaign and co-op's fully equipped three-sector arena sequence are intentionally distinct (`README.md:22`, `main.js:77`). This distinction itself is not a bug.

The absolute accusation “there is no direction” is contradicted by authored evidence: floor signatures at `playground/map/dungeon-data.js:375`, `578`, `786`, `999`, `1162`; fraudulent transfers (`306`); repeating patients (`516`); bodies responding to bells (`719`); a containment score (`928`); Sera's instruction (`935`); the sealed warden gate (`1099–1102`). Close healing (`engine.js:497`), committed extraction (`413–415`) and bodily injuries support an intimate body-horror vocabulary.

The stronger adversarial question is: “Can players infer the containment story and cost of bodily power through play, or does it remain text beside an expanding effects collection?” Its answer is **UNVERIFIED**. Source authorship establishes intent, not successful player comprehension or an aesthetic verdict.

**RISK: the story promises a consequential action the ending contract does not visibly encode.** Sera instructs the player to seal the throat before stopping the bells (`dungeon-data.js:935`), while Story completion checks encounter/key readiness plus reaching the exit (`engine.js:1763–1766`). Counterevidence: progression and the final floor can represent containment abstractly; no fresh-player interpretation was collected. Proposed smallest experiment: ask a fresh player what their final action accomplished. Acceptance: a coherent relationship between the performed action and the story's promised consequence.

The co-op onboarding mismatch and rank/extraction mismatch are hard source/documentation contradictions. “This isn't real art” is not a falsifiable engineering verdict; a useful critic must identify an observable failure of meaning, composition, pacing or player experience instead.
