# Dead Arrival verification

Latest iteration: [Build 03 — The Warden](BUILD-03.md). The baseline evidence below predates the generated NPC and UI refinement.

## Delivery
Standalone original arena foundation at C:/Users/wolfk/Desktop/deadarrival. Source and static dist are included. Original Findle remains separate. This is not full ULTRAKILL parity or a certified production release.

## Checks
- 11 engine regressions passed: movement, collision, aerial mobility, aiming, occlusion, cooldowns, blood healing, coins, parry, core blasts, peer authority, wave/exit/death/retry, tether.
- Real Chrome desktop 1440x900 and touch emulation 390x844: aiming, movement, jump, dash, slam, weapons, pause/resume/retry, mobile movement and layout passed; no page/console errors in browser-results.json.
- Real WebRTC two-context transport: ordered messages, RTT, malformed payload rejection, disconnect passed.
- Full co-op UI: natural offer/join/accept startup, guest keyboard movement, guest shot resolved on host, shared terminal state and disconnect passed. Test targets/positions are deterministic debug fixtures; input uses real keyboard and mouse.
- Sustained input journey: 122.5 seconds, wave 2, six kills, blood heal/gore and B rank. Prior run demonstrated death/retry. Wave 3 and exit were not cleared by the browser bot; engine regressions cover their transitions.
- Build passed. Browser suites require separately installed Playwright/Chrome; runtime has no package installation requirement.

## Performance and visual evidence
Final desktop input capture: 279 meshes, 21 instanced meshes, 273 geometries, 36 materials, 13,290 authored triangles, 239 render calls, seven textures at DPR 1. Sustained combat median sampled FPS 32.0 (26.9–57.6), up to 381 geometries with transient combat visuals. Measurements were headless Chrome under concurrent test load; they do not certify target devices. Earlier renderer had about 852 calls; floor/wall batching reduced the comparable view to roughly 239. See browser-results.json, visual-metrics.json, qa-sustained.json and active screenshots.

## Visual scorecard
Scale 0 placeholder, 1 basic styled, 2 premium stylized, 3 showcase. Original Findle baseline was a different renderer and was not scored comparably.

| Category | Before | After | Evidence |
|---|---|---|---|
| Art direction | not scored | 2 | Industrial horror palette, materials, UI and blood feedback |
| Hero/player | not scored | 1 | Three procedural weapon silhouettes; still visibly primitive construction |
| Obstacles/enemies | not scored | 2 | Three articulated variants and attack cues |
| Rewards/interactables | not scored | 1 | Coins, cores and exit are readable but simple |
| World/environment | not scored | 1 | Wide arena, cover, panels and pipes; repeated box architecture |
| Materials/textures | not scored | 2 | Generated wall texture, panel wear, labels, shared material roles |
| Lighting/render | not scored | 2 | Tone mapping, environment reflections, key/fill and readable scene |
| VFX/motion | not scored | 2 | Event-driven blood, gibs, tracers, core blasts, recoil and tether |
| UI/HUD | not scored | 2 | Responsive genre HUD, menus, weapon/status and touch controls |
| Performance evidence | not scored | 2 | Browser captures and measured counts; device certification pending |

Average 1.7/3. Premium/showcase gate NOT passed: primitive weapon construction and repeated arena architecture remain. Next art pass needs authored weapon/enemy meshes, richer multi-level environment kit, stronger contact lighting and target-device performance tuning. Do not label this AAA or full parity.

## Skill/reference and phase ledger
Director and gameplay skills drove scope and simulation. Loaded gameplay-workflows, physics-engine-selection and new-game checklist. Graphics, UI, asset, debug and QA skills were read; visual-scorecard, QA release/visual/playtest and debug/scene/performance references supplied the checks. Local-dev-instances skill governed verified server ownership and hidden launch. Agents split renderer, UI, assets, transport and sustained QA under the director's delegation instruction. Details and exact paths are retained in assets.md, renderer-ledger.md, ui-ledger.md and qa-ledger.md.

Phase status: separate project and launch complete; movement/combat foundation complete; local P2P complete; responsive UI and asset fallback complete; engine/browser/build checks complete; premium art gate, campaign/boss/complete weapon-tech parity, full browser victory journey, cross-internet NAT and physical mobile certification remain open.

## Asset provenance and limits
Bundled Three.js license in vendor/THREE-LICENSE.txt. Local procedural geometry and synthesis require no runtime services. Tripo, Gemini and ElevenLabs attempts were blocked by missing provider keys; built-in image generation supplied the wall texture. Prompts/probes/fallbacks are in assets.md. No provider credentials ship.

P2P is manual two-player WebRTC, host authoritative. Internet routes may need TURN, which is supported by the transport but not provisioned. No public matchmaking, host migration or anti-cheat certification is included.
