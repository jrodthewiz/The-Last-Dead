# Build 10 ? Iron and Ash

A focused quality pass on first-person models, weapons, impact effects and audio.

## Changes

- Four weapon material/mechanism refinements: extractor claws, sliding breech, charge slider and pressure shutters. Existing alignment and socket contracts remain intact.
- Generated worn oxblood leather albedo on first-person gloves and sleeves; source prompt and original path in `build10/leather-source.md`.
- Replaced the generic solid muzzle flash with a textured pressure flare, scaled by weapon.
- Added surface-aware impacts: normal-directed sparks, short dust envelopes and fading scars. Open-air endpoints do not emit wall impacts. Marks and dust each have a fixed 96-slot pool; reduced motion suppresses dust.
- Added an instanced finned iron/bone rocket body and directional exhaust, aligned to authoritative projectile coordinates.
- Added six processed CC0-derived sound stems, distinct weapon accents, creature-kind signatures and non-repeating sample selection. See `build10-audio/README.md` and processing ledger.

## Asset sourcing and scope

Built-in image generation produced `assets/textures/worn-oxblood-leather-v1.png`, used directly in the runtime. Existing image-guided weapons and imported Warden assets remain the model foundation. Supporting repeated rocket/effect geometry is procedural and bounded. The audio worker's safe probe reported TRIPO_API_KEY=MISSING, GEMINI_API_KEY=MISSING, ELEVENLABS_API_KEY=MISSING; processed audio uses the project's documented CC0 sources. No new provider 3D or sound generation was claimed.

This remains a stylized indie game. The weapon mechanisms/materials, effects and sound mix are improved; this pass does not certify AAA quality or Ultrakill parity. Scars are analytic temporary decals; dust is a small transparent pool, not volumetric simulation.

## Reference ledger

Loaded the game director and its gameplay, graphics, UI, debug, QA, 3D/image/audio generator siblings. Applied graphics implementation-blueprint, render-recipes, model-recipes, visual-scorecard and procedural-model/material-lighting/performance-safe-detail checklists; procedural-vfx-system; QA release matrix, visual-verification, playtest-qa and release. Audio worker applied audio-workflows. Built-in imagegen SKILL controlled the new raster asset. No gameplay mechanic or UI-layout redesign was part of this pass.

## Verification

Evidence is collected in `build10/`, `build10-audio/`, and the Build 10 tests. Final build, browser and deployment results are checked before release. Inspection screenshots use controlled targets; sustained keyboard/mouse combat is recorded separately. Frame-rate evidence is machine-specific and not a worst-case performance guarantee.

Verified so far: production build, 39 deterministic regression cases (38-case full suite plus the missing-material regression), final desktop/mobile model and effect inspection, six pitch/weapon projection checks, and 37/37 audio entries decoded. Four weapon and three creature-kind accent families produced finite non-silent signals; maximum isolated tested peak was .333, below full scale. No focused audio or visual browser errors. The Ossuary white patch was an undefined boneDark material and now has an authored material plus a regression.

Final integrated journey: 120 seconds, one death/restart and one peak kill, zero page/console/request errors. Audio mute, pause, resume and exactly one ambience source passed. The journey ended dead, so its final Escape check is not a UI-pause pass. The 30-second reference sample averaged 23.39 FPS while a separate Dogfight Vite build was running; a same-load effects-off/on/off comparison returned 20.49 / 22.81 / 21.76 FPS. This does not establish a new 60-FPS guarantee or implicate the new effects as the bottleneck. Final combat scene: 684 calls, 392,756 triangles on GTX 1650/D3D11. Final visual inspection confirms the repaired Ossuary skull material.
