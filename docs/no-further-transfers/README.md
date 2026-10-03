# No Further Transfers

The Last Dead now follows the distress signal for Truck Six's eighteen missing evacuees through the existing five-floor facility. Receiving, isolation, burial, containment bells and the transfer engine form a journey with brief playable chapter mechanisms, persistent aftermath and an explicit final shutdown followed by departure.

| Chapter | Action and observable consequence |
| --- | --- |
| Intake Foundry — The Shift That Never Ended | Prime the cargo pump; the flywheel cycles and pressure rises. |
| Graft Galleries — Everyone Comes Back | Close two isolation circuits; their shutters close and remain isolated. |
| Catacombs — The Names They Kept | Recover the name casket and return it to the court; the casket moves between those places. |
| Resonance — A Choir With No Audience | Sound the nave, tower and chancel chimes in order; the bells respond and establish the containment chord. |
| Last Descent — No Further Transfers | Earn clearance, pull the emergency brake, watch the drum wind down, then leave through the final threshold. |

Hold **Q**, **View/Select** on a standard controller, or the contextual **OPERATE** touch button. Existing inputs retain their bindings. Transmissions persist on the HUD and in the pause archive alongside recovered evidence. Evidence remains optional.

## Preservation contract

The existing authored maps, walls, room encounters, weapons, keys, loot, records and supplies remain. Automated comparisons verify their conservation. Dash, slide, wall jumping, tether, coins, core attacks, parry, blood healing, extraction scoring, committed finishers, wounds, vermin, bodycam, gore and reduced-motion settings remain available. No mandatory corpse harvesting or score-economy change was added.

Existing arena co-op retains its entry and transport. Story co-op is future work: chapter state is serializable and the engine supports shared authoritative actions and safe peer relocation, but the live Story snapshot/loading protocol has not been released. Revival also clears stale movement/action state.

The default game entry enables the journey. `makeDungeonCourse(index)` continues to expose the existing raw floor contract for map tools and legacy fixtures; `makeDungeonCourse(index,{journey:true})` enables chapter progression. Floor transitions retain that choice.

## Verification and scope

See `qa/browser-report.json`, `qa/touch/report.json`, `qa/crypt-placement/browser-report.json`, and `../adversarial-review/implementation-tests.txt` for successful chapter/input results. Browser fixtures deliberately resolve combat or place the player near stations to isolate input and rendering. Engine tests cover real collision-aware movement across all five signature routes, and first-floor authored encounter queues/gates with automated enemy defeats. These are not a human playthrough or a final difficulty/pacing verdict.

Arena checks are recorded separately: `qa/arena-coop/qa-results.json` preserves public-broker timeout attempts; `qa/arena-coop-local/qa-results.json` records the successful signaling-fixture run with real PeerJS clients and RTCDataChannels. Chunked snapshots, bat attacks, coalesced trigger/switch inputs, saw release, pause and disconnect passed with zero browser errors. The extended soak was skipped. The existing direct WebRTC two-context test also passed (1 ms host RTT). A local signaling fixture does not establish availability of the public PeerJS service.

This implements the complete chapter loop using the existing world and combat presentation. Larger environmental setpieces, bespoke character performances and shared Story campaign transport remain further development. The added assemblies are operational supporting props, not replacements for the existing heroes or effects. See `implementation-ledger.md` for skills, assets and adversarial decisions.
