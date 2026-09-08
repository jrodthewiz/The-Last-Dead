# Build 08 — Flesh and Iron

The Last Dead remains the standalone repository at Desktop/thelastdead, deployed from jrodthewiz/The-Last-Dead. Findle is unchanged by this work.

## Player-visible changes

- Fixed the renderer loop that skipped enemy transforms. Standard enemy classes now use the authored Evil Warden model when ready, with a procedural fallback on load failure. Bellwraith has measured floor placement, facing, and a roughly 1.98 m visual height.
- Added differentiated stalker/caster/brute regalia and animation feedback. Shared GLB geometry/textures survive individual enemy cleanup.
- Rebuilt Breach and Arc Lance as socketed procedural weapons; refined Ossuary/Reliquary skull forms and ornament placement. All four use less obstructive camera framing, readable reflected lighting, and independent recoil/muzzle animation.
- Replaced arena layouts with connected zones/routes, internal walls, focal structures, animated machinery and lighting cues across all three sectors. Moving groups remain outside static geometry batching. Fixed a gate ornament that initially obstructed the spawn view.
- Replaced panel-heavy UI with an artwork-led title, open combat HUD, four weapon sigils, immediate hit/kill/parry feedback, delayed health-loss trail, critical-health edge effects, and typographic pause/death screens. Touch controls fit portrait and landscape viewports.
- Fixed guest weapon changes being overwritten by old host snapshots. Saved preferences now configure the game on initial load; Escape closes focused options and terminal states dismiss settings.

## Verification

| Check | Result / evidence |
| --- | --- |
| Production build | `npm.cmd run build` passed; explicit runtime manifest includes both new weapons and world-authored.js |
| Node suite | 30/30: engine, nine-wave campaign integration, model bounds/sockets/animation, world batching, server PORT/static hosting |
| UI layouts | 1280×800, 390×844, 320×844, 844×390: no overflow, HUD/control overlap or pairwise button overlap; 44px minimum touch targets. `build08-ui/fit.json` |
| UI behavior | Hotkeys for all four weapons, guide, options, reduced motion/gore, critical health/parry, pause/resume and death/restart passed. `build08-ui/interactions.json` |
| Real WebRTC co-op | UI signaling, guest movement, gunfire, bazooka explosion/kill credit, sector transition, terminal state and disconnect passed in two isolated Chrome contexts. `tests/build08-coop.mjs` |
| Sustained play | 120 seconds of actual keyboard/mouse movement/fire, peak six kills, one restart, pause/resume; no runtime errors. `build08/build08-game-results.json` |
| Audio | 35 manifest entries decoded; nonzero output for shot, footstep, jump, land, enemy attack, kill, explosion and slide. Mute/pause/resume passed with exactly one ambience source |
| Graphics | Installed Chrome/D3D11 on GTX 1650; controlled 30-second view averaged 60.06 FPS. This is a reference-view measurement, not a worst-case combat guarantee |
| Visual evidence | `build08/weapon-0.png` through `weapon-3.png`, sector screenshots, desktop/mobile combat fixtures; authored enemy evidence in build08-enemy-visibility-qa.md |

Controlled screenshots reposition cameras or inject a target to inspect geometry/effects. The sustained journey uses ordinary movement/fire and normal damage, and the separate enemy visibility harness uses campaign-spawned actors. The all-sector render fixture is not evidence of a human completing the campaign; deterministic gameplay integration covers all nine waves.

## Art review limits

This is an original stylized procedural art upgrade. Generated concepts guided the img2threejs analysis/spec/model corrections, with isolated and first-person screenshots and direct structural tests. Formal forge/Divine Eye and part-coverage gates are not all complete; see `build08-art/review.md`. These assets are not certified exact reconstructions or AAA/Ultrakill-parity art. Micro-surface detail, lighting consistency, larger traversal spaces, bosses and additional combat systems remain further work.

The broad visual pass was reviewed in the actual game: it caught proximal toy-mask silhouettes, obstructing gate teeth, flat emissive organ surfaces, and weapon shadow occlusion. The final corrections prioritize readable forms and clear play space.

## Reference ledger

Read/applied: threejs-game-director; threejs-game-ui-designer and its UI/HUD/responsive/mobile checklists; img2threejs and review/gates_reference; threejs-qa-release plus qa-release-checklists, visual-verification, playtest-qa and release; use-railway. Per-model evidence and formal-gate limitations are retained in build08-art and build08-enemy-art. No additional paid external mesh generation is required by these runtime assets.

## Release

Railway continues to build with npm run build and start with npm start on PORT 8080. Runtime dependencies and assets are bundled. Existing local and user browser sessions are preserved. Co-op still uses manual signaling and the existing STUN setup; internet NAT/relay limitations are unchanged. The deployment result is verified separately against the pushed commit.
