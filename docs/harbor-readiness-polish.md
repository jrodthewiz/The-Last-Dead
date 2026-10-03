# Harbor readiness polish — 2026-10-02

This pass adds framed entrances to all six room transitions, with rain hoods, handles, illuminated trim and readable action plaques. Power Control's entrance faces its west approach. Field maps show the doors and update when room supplies change.

Room caches retain any supplies that do not fit in the backpack. A full backpack consumes nothing; repeated searching cannot duplicate salvage. Legacy searched flags remain supported.

Fence instances are partitioned into 32-metre spatial batches, preserving all 308 detailed panels while allowing frustum culling. In the same isolated 1280×800 street camera, submitted triangles fell from 757,454 to 342,014 (55%); draws increased from 247 to 272. This is geometry submission evidence, not a target-device FPS claim.

Validation: 59 focused gameplay, navigation, collision, interior, inventory and vehicle tests passed. Every room entrance has a collision-clear route from the dock spawn. The isolated rendered-map suite passed with no console errors. The production build passed. Full-game browser results are recorded separately in output/playwright/harbor-polish/browser-report.json.

Remaining scope: room entry is a Q transition, not a seamless open doorway; this pass does not certify performance on target hardware or replace a combat balance playtest. Cold startup remains slow in the full browser fixture.

Full-game integration attempt: assets loaded with zero page, console or HTTP errors; startup took 268,053 ms. Q successfully entered Customs Records, but the following W movement assertion exceeded its 30-second timeout. The suite therefore did not reach inventory, driving or extraction checks in this run. This is not a full end-to-end pass. Failure screenshot and state are retained with the browser report.
