# Western trails and lived-in rooms — 23 October 2026

The western routes retain their existing pale ground strip and terrain. Twenty-one faded-blue blaze posts, three double-sided destination boards and a physical ranger map establish a shared wayfinding language. The map shows a connected schematic route and a contrasting location marker. The same placement plan supplies visible props and conservative collision bounds.

Radio, newspaper and architecture businesses gain larger activity silhouettes: an open-door broadcast booth and microphone; proofing sheets, drying rack and exposed press mechanism; an upright crossing drawing behind its physical bridge model. Gardener and photographer residences replace one generic sofa with a potting station or enlarger, trays and hanging prints. These changes appear in 75 generated street-level plans under the canonical seed. This does not furnish upper tower floors. Geometry and materials use the existing instanced N64 kit; no external assets or dependencies were added.

## Verification

- `node build.mjs` and the existing Sites framework build completed.
- All 11 existing scavenging/craft checks passed. No test files were added or edited.
- Inline clearance checks covered 5,208 entrance samples across 248 enterable buildings. No blocked entrance samples or invalid feature bounds were found. All 1,590 sampled western-route centreline points remain clear of the new wayfinding solids.
- An isolated background gameplay session walked seven connected western-route/loop legs successfully. Follow-up keyboard walks reached the radio booth through its real doorway, the press approach and both residential work areas. Captured page errors were empty. Native pointer lock was guarded, preserving the user's existing game tab.
- The mixed 105-second walking/capture run measured median 16.7 ms, p95 16.8 ms and one 116.6 ms frame. A 22-second final room follow-up measured p95 16.8 ms and maximum 33.7 ms. These are sampled observations, not a zero-hitch or whole-map performance certification.
- Five runtime modules match canonical source across local dist, Sites public and built client outputs: 15 normalized-text comparisons.

Read-only map-authoring and craft reviewers inspected actual gameplay-sized route, reverse-approach and room frames, then reviewed revisions. They accepted this bounded wayfinding/activity-corner pass. Their critique led to the front-facing studio drawing, removal of the press's oversized placard, a connected ranger-map route and tapered nursery plants. Remaining limits: businesses still share their large lobby shells; the radio placard still competes with equipment; the nursery plants read as small conifers. Unfamiliar-player comprehension, full-floor visual polish and other hardware remain unverified.

Evidence is retained locally under `output/map-personality-2026-10-23/` within a 48 MiB / 100-file capture budget. Existing unrelated output deletions are not part of this change. Unity is untouched.

## Publication

Published as version 37 of the existing public Blackwater Site, source `8db664fa0b3df76aaa147b5789e04ce3c9d9b8ec`, deployment `appgdep_6adbb9508bac8191a643aebae9cb5fcc` (succeeded). The JRod launch link remains https://jrod.download/blackwater/ and resolves to https://the-last-dead-blackwater.jrodonthebeat.chatgpt.site/.

A fresh isolated public session reached all seven sampled fork, studio and gardener approach targets, with no captured page errors. The five deployed runtime modules matched canonical source. `/api/blackwater/rooms` returned HTTP 200 with zero waiting rooms at the time of the check. The 1,346-frame gameplay/capture sample measured median 16.7 ms, p95 16.8 ms and maximum 33.4 ms. This is not a new multi-peer soak or a whole-map benchmark. The existing `Start Blackwater Browser.cmd -NoBrowser` launcher reported the current build and local URL http://127.0.0.1:5200/ without restarting the owned server.
