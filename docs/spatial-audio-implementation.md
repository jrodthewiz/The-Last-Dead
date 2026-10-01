# Proximity audio and quiet room atmosphere

Implemented September 30, 2026 in the standalone The Last Dead checkout. The player's existing port 5200 tab and server were left intact. Changes are additive to the other chats' bodycam, anatomy, combat and horror work.

## What changes in play

World sounds use retained Web Audio HRTF panners. Turning changes their apparent direction; walking changes distance falloff and wall muffling. Living enemy vocalizations and a remote player's charging rifle follow their source until it ends or the actor disappears, retaining the cue’s authored mouth/eye offset above its body. Reports, impacts, explosions and deaths retain their original world anchor. The player's own firearm and mechanism stay head-relative.

The listener uses the game's eye height, including the 0.88 m full slide, with camera-matched yaw/pitch and orthogonal up direction. Simulation coordinates are cells: `(x,y,z height)` becomes audio `(4x,4z,4y)` in metres. A received snapshot refreshes the listener before admitting sounds. Host and peer firearm events carry their shooter identity; a guest rejects echoes of its predicted report while hearing the host's world report. Cooldowns use shooter identity rather than merging simultaneous shooters.

Walls are sampled with the existing map ray from the current listener, refreshed at most every 50 ms for live world voices. The filter removes high frequencies and reduces gain when blocked; distance also limits high-frequency detail. This is a bounded map approximation, without simulated room propagation or reflection geometry. Existing sampled room return and global background beds remain in their mixer.

## Source-bound atmosphere

`room-atmosphere-audio.js` derives fixed emitters from compiled vents, pressure machinery, real pipe organs, flesh conduits and mouth altars. The actual rendered barred recess supplies another air source. Rustles require an instantiated set-dressing prop with a named cloth mesh. The builder preserves its real geometry centre before static material batching removes the original mesh, then audio applies the retained group world transform. A floor change rebinds the sources; cloth anchors refresh when the renderer builds its new set dressing.

The inspected dungeon has no actual foliage. Its environmental rustle comes from linen, tarps and cloth. Plant sounds should be added with real plants when a suitable outdoor or overgrown space is authored.

| Layer | Sample source | Group | Source volume / range | Schedule and bound |
| --- | --- | --- | --- | --- |
| Local air/draft | Existing `ambience` variant 1, ward wind | ambience | .065, reference 2.8 m, maximum 28 m | Two closest sources within 22 m; existing sources may remain to 26 m; smooth start/stop |
| Secret whisper | Three separate edited human voice recordings | ambience | .15, reference 2.6 m, maximum 24 m | First opportunity at 32–48 simulation seconds; subsequent opportunities 42–66 seconds apart; source within 18 m |
| Cloth rustle | Three edited fabric recordings | ambience | .12, reference 2 m, maximum 24 m | First opportunity at 8–15 seconds, then 17–29 seconds apart; actual cloth source within 18 m |

Quiet details share one short-source slot. Whispers require the existing horror budget to allow playback, then reserve four seconds; learned recognition callbacks retain priority. A whisper does not cancel itself when its own reservation begins. Combat, low health, injury/hand actions, nearby threats, directed horror scenes and recovery suppress or cancel details. Air drops to .022 during those intervals. No whisper originates in a recovery room. A missing nearby source produces silence; opportunities do not invent a source beside the player. Paused simulation time does not accumulate overdue cues.

Each air anchor starts at its own deterministic phase of the sampled loop, so two nearby outlets do not lock to an identical waveform when admitted together.

All layers follow existing ambience and master settings, including mute. Enemy voices continue to follow the voice setting. No new settings UI or runtime dependency is required.

## Ownership and lifecycle

`AudioSystem.startSpatialEmitter(id,cue,details)` owns one sampled source per key; repeated starts update the same source. `updateSpatialEmitter` changes its panner, low-pass filter and gain with short smoothing constants. `stopSpatialEmitter` releases it with a short fade or immediately. The manager admits at most four keyed emitters; this director uses two beds and one detail.

Ordinary `play` calls can carry an actor `trackKey`. `updateTrackedSources` resolves current actor poses or cancels a missing/dead actor. The real `ended` event clears keyed ownership, source/voice tracking and private filter/panner connections. Fade sources remain in the voice ledger until they end, so an intervening pause can cancel them. Unchanged gain targets preserve the initial entrance fade during position updates. Duration-bound one-shot fades survive spatial gain updates, and an occluded zero-volume source stays silent. Pause, death, menu, restart, course changes and disposal clear owned room sources; resume creates only the nearest eligible sources.

The explicit production whitelist includes `spatial-audio.js` and `room-atmosphere-audio.js`; six delivered OGGs are included through the existing assets directory. Originals and processing scripts stay in ignored `.art-source`, with no runtime archive access. The [source ledger](spatial-audio-sources.md) records CC0 provenance, filtering, decoded measurements and hashes.

## Verification and listening boundary

The focused simulation, snapshot and routing suite passed 38 tests. These include all five Story floors, real cloth requirements, map-wall rays, source caps, loop reuse, quiet spacing, interruption/cleanup, camera axes/slide height, host/peer forwarding and prediction echo rejection. The existing injury lifecycle and horror presence checks also pass after their VM fixtures gained the new audio dependencies.

The [browser QA receipt](spatial-audio-qa.md) records actual Chromium Web Audio and source/production journeys. It distinguishes waveform evidence from human perception. No human headphone or speaker audition was performed; perceived whisper intelligibility, subtlety and scariness remain listening judgments. No claim of unprecedented fear, universal front/back perception or hardware audio certification is made.
