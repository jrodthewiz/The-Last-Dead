# Dead Arrival renderer reference and asset ledger

This ledger records the graphics guidance loaded for the renderer pass and the
asset sourcing decision behind the current procedural implementation.

## Required reference ledger

| Loaded | Reference |
| --- | --- |
| yes | C:/Users/wolfk/.codex/skills/threejs-aaa-graphics-builder/SKILL.md |
| yes | references/visual-scorecard.md |
| yes | references/implementation-blueprint.md |
| yes | references/model-recipes.md |
| yes | references/render-recipes.md |
| yes | references/checklists/aaa-game-quality-gate.md |
| yes | references/checklists/aaa-visual-scorecard.md |
| yes | references/checklists/procedural-model-quality.md |
| yes | references/checklists/material-lighting-quality.md |
| yes | references/checklists/performance-safe-visual-detail.md |
| yes | C:/Users/wolfk/.codex/skills/threejs-3d-generator/SKILL.md |
| yes | C:/Users/wolfk/.codex/skills/threejs-image-generator/SKILL.md |
| no | references/prompt-templates.md: no reusable prompt was requested |

## Credential probe

The managed Windows environment reports:

    TRIPO_API_KEY=MISSING
    GEMINI_API_KEY=MISSING
    ELEVENLABS_API_KEY=MISSING

The probe script is Bash-oriented and returned no text through the managed
shell wrapper; the literal SET/MISSING values above were confirmed from the
same process environment before selecting the offline procedural fallback.

## External asset sourcing

| Surface | Choice | Output or reason |
| --- | --- | --- |
| FPS hero / weapons | procedural Three.js | Three distinct camera weapons with authored forms, trims, muzzle sockets, recoil, and material roles in renderer.js; external Tripo generation was blocked by TRIPO_API_KEY=MISSING. |
| enemies | procedural Three.js fallback | Three articulated horned armored silhouettes with unique body language and attack telegraphs; external generation was blocked by the missing Tripo credential. |
| world / architecture | procedural Three.js | Layered industrial gothic bloodworks kit: panelled walls, cover blocks, cathedral ribs, ceiling gantries, pipes, grates, placards, exit gate, and contact materials. |
| materials / decals | procedural plus supplied reference | Shared PBR roles and the supplied assets/textures/dead-arrival-industrial-flesh-metal.png wall/cover albedo; Gemini texture generation was blocked by GEMINI_API_KEY=MISSING. |
| VFX | procedural pooled runtime | Instanced gore chunks, blood pools, coins, hostile/core/reflected projectiles, tracers, grapple tether, muzzle flash, and telegraph rings. |

The procedural choice is scoped to the renderer fallback. The renderer keeps
the scene hierarchy and material roles stable so a later GLB or image-generator
asset pass can replace individual hero or enemy groups without changing engine
coordinates or pooled VFX.

## Renderer contract

Renderer(canvas) exposes resize(), render(run, nowMs),
setSettings({ reducedMotion, gore }), diagnostics(), and dispose(). It consumes
the engine 4 m/cell x/y/z coordinates, run.peer, run.coins, run.projectiles
including core, run.gore, run.blood, run.tracers, and grapple fields
hookTime and hookTarget.

## Renderer handoff evidence

- node --check renderer.js: passed.
- node build.mjs: passed; dist/assets/textures/dead-arrival-industrial-flesh-metal.png is included.
- Headless full-world smoke: 177 meshes, 21 instanced meshes, 9,584 triangles, 24 shared materials.
- All 11 engine regressions pass, including coin ricochet, core projectile explosion, peer combat, and grapple tether behavior.
- A fresh browser screenshot and diagnostics capture is required after this batching pass; the prior 852-call / near-black capture predates the changes recorded above.
