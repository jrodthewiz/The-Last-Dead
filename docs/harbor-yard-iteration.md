# Netmakers yard iteration

The southwest Netmakers block now has an accessible service yard. Its rear
store keeps two blocked rows; the front four rows open into a fenced yard
with an eight-metre gate facing the waterfront. Gate posts, lamps, direction
stripes and signs make the entrance visible. The imported building is fitted
to the rear store instead of occupying the whole lot.

The yard contains four scrap and the marksman rifle. Both use the existing
authoritative pickup and backpack systems. This gives the block a reason to
visit without adding another inventory currency or interaction key.

Collision remains the existing deterministic grid system. Both sides of each
wall edge are set together. The renderer uses the same yard rectangle and
gate metadata. Separate wall and paint heights avoid coplanar surfaces; this
does not establish whole-world freedom from temporal flicker. The rear store
is closed; this pass adds an accessible yard, not a building interior.

## Verification

- 13 focused harbor/inventory/vehicle tests pass, including movement through
  the gate to collect scrap, closed gate-wing and side-wall collision,
  rear-store blocking, map reachability and unchanged truck clearance.
- 45 engine, infected AI and scavenger-pack regression tests pass.
- Production build and whitespace checks pass.
- Extended browser harness: `HARBOR_QA_YARD=1 HARBOR_QA_EXTRACTION=1` with
  `tests/harbor-browser.mjs`. It sets the approach outside the yard, uses real
  movement through the gate to collect scrap, then checks the yard rifle,
  usual weapon pickup/equip, truck and extraction/restart flows.
- Browser evidence is saved under `output/playwright/harbor-yard/`. As with
  earlier passes, enemies are removed for deterministic traversal and the
  extraction distance threshold uses an explicit fixture after real driving.
  This is not an unassisted encounter-balance test.

Final browser result: **PASS**. Real input traversed the gate and collected
four scrap. The yard rifle and three other weapon finds were retained;
backpack equip, driving/braking/safe exit, animated water, three responsive
inventory sizes, fixture-assisted extraction and clean restart all passed.
Page, console and HTTP errors were empty. Gate and collected-cache screenshots
were inspected. Cold headless startup measured 139.6 seconds; ordinary hardware
FPS was not measured. Runtime source/build hashes match.

References used: Three.js gameplay systems, `references/gameplay-workflows.md`
and `references/physics-engine-selection.md` (both read), plus the existing
QA and visual-verification workflow. Custom collision remains appropriate for
this flat-road, static-wall slice; no rigid-body package is added.
