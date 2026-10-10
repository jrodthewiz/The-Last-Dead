# Blackwater inspection 15: riverbank and woodland surface polish

The existing cartoon horror map now separates pale angular shale, damp brown bank soil, leaf litter and worn walking paths. Original tree footings gain short branching roots. This is a terrain-detail pass; it does not alter buildings, riverbed heights, bridge ramps or combat population.

## Field and ownership contract

- World XZ in metres owns the shared surface field. The exact existing triangulated ground supplies height and one-metre slope estimates; river distance and water level supply bank exposure and wetness. One seeded twelve-metre soil field supplies broad soil patches. No new displacement authority.
- Those causes drive ground vertex colours, grounded bank-detail tint and existing fern/grass habitat selection. All named fields expose measured ranges in the terrain diagnostics. Detail is larger than terrain sampling scale; no new high-frequency normal map or post effect.
- Angular shale shelves and root ribbons have vertices 0.9–3.4 cm above the physical ground, clear both bridge approaches and public forest paths, and act as surface detail. Large collision-free boulders are not introduced.
- Detail shares the existing terrain material, adds zero textures or shadow maps, receives existing light/shadows, and groups into 32 m chunks with a 110 m distance cutoff. Owned geometry releases once; the terrain owns its shared material.
- Existing 2,433 plant roots and four zone quotas remain; damp banks have more compound ferns.
- Latest arm integration is captured from current source, with no hold, hand, animation or skeleton edits in this pass.

## Verification

39 focused checks passed across surface fields, finite/grounded detail, path/bridge clearance, culling and disposal, exact terrain/feet/ray/combat height authority, existing forest LOD/provenance, shadow coverage and the previous building entrance/address iteration. Git diff whitespace check passed.

Measured detail: 250 shale shelves, 410 branching root ribbons, 12,560 triangles in 30 spatial batches. A 50,240-sample interior triangle audit found relief from 4.54 mm to 3.56 cm; the details conform between vertices as well as at their corners. Final actual native WebGPU capture passed against verified-dist-v2 with seven game views. Actual W input crossed both bridge ramps and continued to the north forest path through seven waypoints; no coordinate writes occurred during walking. The enemy cohort was omitted only for that bounded route check. Fixed followup views retained the actual world, lighting, shadows and foliage.

The final owned browser used four previously documented startup warmup omissions and full-quality rendering at 960 x 600. This does not establish full startup readiness, continuous combat FPS or phone hardware performance. It loaded in 65.4 seconds under shared machine load. No runtime or HTTP errors occurred; Chrome emitted the existing Windows powerPreference notice and a zero-vertex draw notice. No pointer, keyboard or fullscreen locks were attempted. The owned browser and ephemeral test server closed.

Shared queue attempts could not finish admission while long-lived preview/export helpers occupied its test slots. A separate supervisor admitted one owned capture with a 1 GiB estimate plus 0.75 GiB spare headroom, sampled GPU/commit telemetry, and could terminate only its own process tree. The restricted-network attempt was preserved as native-v2-sandbox-failure; the permitted loopback retry passed. The GPU's minimum sampled global free memory was 1,238 MiB. Renderer-tracked allocations rose from about 335 MiB to 373 MiB across the views; those counters exclude driver and other application allocations. No other chat process or user tab was stopped.

The capture includes the latest 41a7a22880c9cc6d8cd516b693874f775f2679af531734878b3d0692d0b38c3d arm export. This map pass does not claim acceptance of every weapon hold or motion.

The live-delivery-binding.json receipt binds all 31 checked game dependencies to the unchanged port-5200 server (PID 24220), and delivery copies only the five owned map runtime files. Existing building geometry and the arm runtime are preserved. The build whitelist contains the new field module.

Actual game images: [river overview](blackwater-15-river.jpg), [chipped shale bank](blackwater-15-shale.jpg), [tree roots](blackwater-15-roots.jpg), [forest path](blackwater-15-forest.jpg). Full native inputs, screenshots, source hashes, terrain metrics, and cleanup/memory receipts are under output/playwright/blackwater-15.

