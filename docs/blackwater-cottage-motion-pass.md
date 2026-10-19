# Household scavenging and first-person contact

October 19, 2026. This pass builds on the hosted body, input, picture and
home/armory changes already reconciled into the canonical checkout.

Eighteen village cottages now have an entry bench with household-specific
unopened supplies. Preserving jars, folded linen, a medical tin or a hung
repair hammer explain the stash. The boatwright and orchard workshop keep
their tool/fuel identities. The bench has a matching movement solid; the small
props use the existing instanced kit. Doorways, terrain and central aisles
retain their previous ownership. Container IDs remain stable, and previously
searched or partly emptied saved inventories retain their exact leftovers.

Searching now reaches the actual container in world space. Flat palms approach
the near lid edge, the latch gives one sound cue, and the lid opens near the end
of the search. Moving away, looking away, losing reach or taking damage cancels
without discovering the contents. The weapon returns through its existing draw
before it can fire. Location titles fade out during foreground actions so they
do not cover searching, strikes or reloads. Backpack transfers and take-all keep
their existing persistent partial-inventory behavior.

Punches alternate hands. One fist drives through the contact frame while the
other stays in guard. Closed finger poses are solved from actual joint lengths
with fingertip targets near the palm, then cached as local bone rotations;
thumbs oppose outside the folded fingers. The existing skinned arms, arm seating
and fixed segment lengths remain in use. Punch damage still lands at .19 seconds.

The expedition bat's impact cap now crosses the aiming line at its .25-second
damage event. Its contact pose derives from the actual held position and scale,
including the inward shift in portrait views. Turning secondary motion off
retains this contact path. The shared legacy bat keeps its default pose through
optional presentation parameters. Wind-up, impact pause and recovery remain
separate phases, and a miss still cannot create a blood contact.

The representative Breach gains broad worn-steel colour areas, quieter panels,
restrained recoil/settle and a canted draw. Its hinge, shells, reload sockets and
two-handed rig remain intact. This finish has not been propagated across every
weapon. No new downloaded assets were needed.

## Verification

- 80 Blackwater tests, including semantic supplies, saved leftovers, supported
  benches, search facing, punch contact and the actual bat cap projected through
  wide/narrow views with both secondary-motion settings.
- 21 shared melee/model/mechanism checks. One stale Breach assertion assumed a
  resting scale of 1 although the unchanged authored model rests at .65; it now
  compares expansion against the measured resting scale.
- Gameplay input and body checks: eight release paths, multitouch ownership,
  look-jump guards, 600 reload frames and eight body camera views.
- Owned-browser cohesion: all 45 exterior-to-stash routes, access paths,
  persistent partial transfers and touch scavenging presentation pass.
- Built-game motion run: real shot/reload, both punch sides, delayed bat damage
  (65), delayed fist damage (35), successful search/take-all, and look-away,
  movement and damage cancellation. No JavaScript or HTTP errors. Per-frame
  samples and videos are retained in `output/cottage-motion-pass/final/`.
  Exact rendered bat before/event/after images accompany the authoritative health
  change; event cap projection is within .02 NDC of the aiming line.
- Built-game handling: all seven world weapon recoveries, all eight firearm/fuel
  reloads, spare-ammo limits, held-trigger release, committed strikes, empty-ammo
  hints and landscape-touch trigger behavior pass without runtime/HTTP errors.

## Focused judge review

The actual spawned role was `adversarial_completion_judge`, applying the saved
modern-warfare-feel, character-presentation and craft/authorship briefs and the
repository review contract. This was a focused review, not a full council.

The judge rejected the initial cupped fists and requested an event-frame bat
test. Those experiments were replaced: neutral top/side and ordinary gameplay
views resolve the hanging-digit blocker, and the exact event test exposed and
corrected the bat's early visual crossing. The quieter Breach finish separates
receiver, barrel and stock more clearly. Search palms no longer visibly penetrate
the lid in the sampled views. Category cues are tested at ordinary pickup distance.

Sampled-pose acceptance does not establish continuous animation artistry or
professional parity. Remaining craft risks include the flat glove/knuckle
silhouette and repeated household bench staging; broad empty rooms were not
claimed to be solved. Continuous feel, novice recognition and worst-case
performance require their own evidence. The user retains visual acceptance.

The final judge found no confirmed mechanical blocker in the bounded evidence
and accepted the representative finish and revised sampled poses as credible
improvements within the N64 direction. It did not play the continuous video;
normal-speed animation feel remains unverified by that review.
