# Zombie recognition, hearing and attention — October 4, 2026

This pass is implemented in the game simulation and all four animated bodies:
Ash Witness, Drowned Dockworker, Fever Runner and Crooked Crawler. It builds on
the ten-clip Blender motion delivery and the three integrated Meshy variations.
No models were regenerated, no clips were rebaked and no credits were consumed
in this pass.

## Decisions the player can read

The deterministic mind uses the following priorities:

1. Injury, emergence and committed attack contact retain their authority.
2. Actual sight requires range, the body/head view cone and the shared world
   visibility query. An alerted zombie cannot see behind itself. In co-op a
   nearer hidden player cannot conceal a farther visible player.
3. An unfamiliar distant player produces `notice`: stop, turn the head first,
   then slowly turn the body. No attack token or runner burst starts during
   this stillness. Confirmation requires sustained visible evidence.
4. Confirmed pursuit uses visible observations, limited runner interception,
   collision-safe lanes and attack slots. After losing sight, it follows the
   last observation rather than the hidden player's current position.
5. Unseen sound produces investigation of the audible location. A loud fresh
   sound can redirect a hunter that has lost sight; visible prey keeps priority.
6. At an investigation destination the zombie stops, listens and sweeps its
   head/body. A completed search clears stale certainty before wandering.

The minimum recognition hold is 0.48–1.03 seconds for runners, 1.00–1.55 for
crawlers and 1.15–1.70 for shamblers. Awareness must also reach the confirmation
threshold, so distant stationary observations can take longer. The body starts
turning after 0.28 seconds. A brief visual interruption retains the watch; more
than 0.6 seconds without sight changes it to a search of the observed location.
Close contact, injury and strong visible provocation shorten the distant watch.

Host and guest action sounds share the same collection path. Quiet walking
produces local footfalls at a 0.52-second cadence; faster movement produces
stronger footfalls at 0.32 seconds. Airborne actors do not emit ground steps.
The cursor detects event-array clear/refill even when its length is unchanged.
Walls and floor slabs attenuate sounds through the shared spatial query.

Uncertain glimpses do not broadcast a horde alarm. Confirmed observations relay
locally with the existing bounded delay, six-neighbor limit, two-hop maximum
and expiration. A relay carries the observed position and support floor. It
never grants live access to the player's hidden location.

## Actual animated attention

`npc-afterlife-model.js` applies the simulated look to the imported `neck` and
`Head` bones, distributed 35%/65%. The weighted face turns toward the target;
watching adds a restrained seeded head tilt and jaw/grip tension. The layer is
smoothed and bounded, works across differing bind poses, and restores its
previous overlay before the mixer runs again. Shared source rigs stay immutable.
Equal presentation time freezes the complete pose.

Windup, strike, stagger, death and grabs suppress the attention overlay. The
authored 0.375-second strike contact therefore retains its exact head, jaw,
hands, hips and feet. Crawlers retain the low crawl/contortion family and the
existing grounded rise into contact and low recovery.

## Space and movement ownership

Simulation X/Y is horizontal, Z is height above the support plane; one cell is
four metres. Rendering converts this to Three.js X/Z horizontal and Y up at the
existing actor wrapper. Attention is a visual bone offset. Simulation owns
position, body facing, perception and damage.

Observed locations now preserve `supportZ` and `structureId`. The shared
`coastal-structures.js` stair query supplies local waypoints to ordinary mind
navigation. Minded zombies keep advancing perception, state clocks and motion
intent while climbing; their stair movement no longer bypasses the decision
tree. Visibility, sound barriers and floor-relative head pitch use the same
world authority. Horde perception reads a frame-start snapshot; movement
commits in stable simulation order with local separation.

## Verification

The final focused batch passes **117/117 tests**, covering engine integration,
recognition, hearing, distraction priorities, co-op target selection, local
horde relays, memory, stairs, collision-safe pressure, host snapshots at
30/60/120 Hz, all four actual imported rigs, complete weighted crawler skin,
retargeted clips and exact attack contact. Texture decoding is stubbed in the
Node rig checks; skeletal geometry and animation data are imported from the
delivered GLBs.

- `output/zombie-senses-final-tests.log`
- `output/zombie-senses-build.log`
- `docs/zombie-senses/checks.json`

The build passes. The receipt verifies that packaged modules match source and
that all four packaged character GLBs retain their previous delivery digests.
Earlier Meshy delivery browser receipts remain in `docs/zombie-variants`; they
cover that earlier delivery, not the new sensory/attention code.

Extended browser QA was not run for this pass. The applied
[QA skill](C:/Users/wolfk/.agents/skills/mint-threejs-skills/skills/threejs-qa-release/SKILL.md)
requires: “Do not start browser, Playwright, canvas, screenshot, diagnostics,
release-preview, or mobile work without approval for that scope.” A focused
desktop follow-up would exercise distant recognition, a real shot/footstep
investigation and stair pursuit, and check blocking console/page errors and a
nonblank canvas at one viewport. Mobile and profiling are separate scopes.

Refresh the existing game tab and start a fresh run to load the new modules.
The standalone launcher resolves this checkout and bundled runtime assets.
