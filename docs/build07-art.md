# Build 07 surface polish

Date: 2026-09-08

Scope: weapon-reliquary.js, weapon-ossuary.js, npc-bellwraith.js.

Reference ledger:

- threejs-aaa-graphics-builder/SKILL.md: read.
- references/visual-scorecard.md: read.
- references/implementation-blueprint.md: read.
- references/model-recipes.md: read.
- references/render-recipes.md: read.
- references/checklists/aaa-game-quality-gate.md: read.
- references/checklists/aaa-visual-scorecard.md: read.
- references/checklists/procedural-model-quality.md: read.
- references/checklists/material-lighting-quality.md: read.
- references/checklists/performance-safe-visual-detail.md: read.
- threejs-3d-generator/SKILL.md: read.
- threejs-image-generator/SKILL.md: read.

External asset sourcing:

- Credential probe: TRIPO_API_KEY=MISSING, GEMINI_API_KEY=MISSING,
  ELEVENLABS_API_KEY=MISSING.
- Existing admitted concept references remain the visual source.
- Procedural texture/material path selected for this pass because the provider
  credentials are unavailable and the requested change is a deterministic
  surface polish on existing runtime factories.
- No browser-side generation calls were added.

Surface changes:

- Reliquary and Bellwraith now share deterministic 64x64 RGBA albedo,
  roughness, and bump DataTextures per factory. The maps use low-frequency
  grain, directional streaks, and sparse cavity pits, and are reused across
  material roles.
- Mapped materials receive deterministic per-vertex wear tint. Bone uses
  warm aged values with deeper cavities; metal and bronze use darker rough
  variation; leather and chain roles retain separate roughness responses.
- Bellwraith bands are seated against the lathe shell radii instead of floating
  outside it. The skull gains a nasal cavity and brow ridge while keeping its
  hanger, eye, hand, pulse, attack, hover, and death sockets.
- Ossuary retains its public factory and animation exports and now adds a
  shared wear albedo map to its existing bump/roughness/vertex-color path.

Validation:

- Canonical node syntax checks pass for all three factories.
- Constructor, animation, socket, mapped-mesh, and shared-resource smoke tests
  pass after copy into the canonical repo. Current metrics are Reliquary
  38 meshes / 18,868 triangles / 30 mapped meshes, Bellwraith 34 / 13,770 /
  22, and Ossuary 25 / 17,472 / 19. Texture identity is shared across two
  factory instances for each asset.
- Existing visual fixture remains the parent-owned render gate; no deployment
  or commit was performed by this pass.
