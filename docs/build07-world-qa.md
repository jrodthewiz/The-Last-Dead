# Build 07 world polish QA

Date: 2026-09-08

Scope: world-polish.js cathedral kit construction and static-world batching.

The isolated regression covers all three authored campaign sectors:

- Bloodworks: 322 source meshes, 4,744 source triangles, 322 removed, 6
  batches.
- Ossuary: 344 source meshes, 5,104 source triangles, 344 removed, 6 batches.
- Choir of Teeth: 366 source meshes, 5,464 source triangles, 366 removed, 6
  batches.

Every source and batched mesh has finite position, normal, and UV attributes.
The regression compares exact transformed vertex bounds before and after
batching, so rotated geometry is checked by its actual vertices rather than an
axis-aligned source-box approximation. Triangle totals and the stone/brass
material roles are preserved for every sector.

The focused batch contract also uses a transformed architecture group and
verifies that:

- static geometry is removed only after it is merged into world-space batches;
- protected animated groups retain their parent, geometry identity, and bounds;
- InstancedMesh objects retain their instance count and geometry identity;
- transparent geometry is retained and is not merged.

## Automated evidence

- node --test tests/world-polish.test.mjs: 2/2 passed.
- node --test engine.test.mjs tests/build06-integration.test.mjs tests/build06-models.test.mjs: 25/25 passed.
- The combined engine/integration run includes deterministic campaign director
  checks, all nine authored waves through actual ticks and shots, bazooka
  splash/alternate-fire ownership, final victory, bounded snapshots, and
  P2P guest style credit.
- Model smoke checks also pass: Bellwraith 34 meshes / 13,770 triangles and
  Reliquary 38 meshes / 18,868 triangles, with finite bounds and repeated
  animation/muzzle-pulse checks.

The existing Chrome co-op gate remains recorded in docs/build06-qa.md; this
world-polish slice used Node-only checks and did not take browser ownership.
No engine or renderer files were changed by this QA pass.

## QA references

- threejs-qa-release/SKILL.md
- references/qa-release-checklists.md
- references/checklists/playtest-qa.md
- references/checklists/release.md
- references/checklists/visual-verification.md
