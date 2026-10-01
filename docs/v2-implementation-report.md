# Dungeon combat v2 implementation

The applied direction is [direction-v2.md](direction-v2.md). This is a demo-quality iteration of the existing game, not an AAA completion claim. Existing weapon art and captured Meshy clips remain in use. The user's open game tab and port 5200 server were preserved.

## Changes and phase ledger

- **Gameplay systems:** purposeful required rooms and optional recovery branches; reachable waypoint guidance; movement or 3.5-second opening trigger; short relief between encounters; staggered packs of 5–11 with a global cap of 12 living enemies. Both player views, distance and open-grid connectivity constrain arrivals even after waiting. Fixed a circular third-floor gate dependency. All five floors pass simulated encounters, keys and exit readiness.
- **AAA graphics phase:** numbered enamel destinations, warm thresholds against cool depth, restrained vent motion, retained six-light budget. Signs and recovery supplies each use three shared instance draws. Existing architecture/material library retained. The new signage texture is image-generated; room names are exact canvas typography.
- **UI:** current purpose and next reachable direction/distance, respecting doors. Recovery pickup feedback reports the actual health/energy received.
- **Motion/VFX:** seeded upper-body posture variation preserves captured attack/hit contact and foot placement. Smooth fluid droplets replace several low-sided legacy gore particles. Alternate fire uses a ribbed steel pressure canister and embossed brass coin; blast rings have softened, irregular coverage.
- **Audio:** calibrated quiet source pools, weapon/foley buses, threat prioritization, brief bed ducking, filtered room reflections and output headroom. Detailed measurements: [audio-v2.md](audio-v2.md).
- **Debug/profile:** shared skeletal assets, limited warmup, 60m visibility cutoff, 30Hz distant non-contact poses, and crowd diagnostics. Fixed hidden death clips freezing and dead wardens reappearing between throttled frames. Independent skinned actors remain; this is not GPU-instanced skeletal animation.
- **QA/release:** source regression tests, production build, isolated Chrome gameplay and visual evidence. No deployment or existing-tab reload.

## Verification

- New flow suite: 7 passes, including all five floors, strict unseen/reachable/co-op-safe spawns, 12-alive cap, out-of-order rooms, safe waypoint cells and one-shot recovery pickups.
- Existing engine/AI: 29 checks passed.
- Motion, impact, weapon presentation, progression UI and new geometry/pool contracts: 25 checks passed. The posture test repeats 999 frames and verifies captured contact remains unchanged.
- Environment: map composition tests now derive narrow-door clearance from aperture width rather than obsolete fixed widths. Lighting and material checks passed.
- Production build: `npm.cmd run build` passed; runtime includes the new modules and bundled WebP.
- Audio: all 128 assets decoded. Dense 32-voice fixture peaks at -2.77 dBFS at unity master, approximately -8.79 dBFS at default 0.5; no clipped samples. Master and voice mute are silent; SFX residual below -102 dB. These are offline signal measurements, not LUFS or a human listening certification.
- Browser artifacts: `output/playwright/dungeon-v2/`, `output/playwright/v2-wayfinding/`, `output/playwright/v2-skill-client/`. Screenshot pixel diversity uses decoded screenshots because the browser's default framebuffer is not preserved after presentation. Console, page error and HTTP collections are recorded separately.
- Sustained production journey: 120 seconds of real movement/fire inputs with debug aim steering; 32 kills, completed floor one and reached floor-two combat. No console/page/HTTP errors. Recovery pickup changed health from 50 to 75. This is automated play, not an unaided human navigation study.
- Migrated historical progression/map suites: 19/19 pass, including live collision movement to keys/lifts on all five floors. F4 allows reaching the lift platform via an open flank, but descent remains gated by its key and required encounters.
- Environment: 14 focused tests pass. Final directed screenshot shows the mounted Foundry Hall name at 10m with zero browser errors.
- Final fixture pass: actual right-click creates `BreachPressureCanister` and ricochet coin; both captured for inspection. Recovery, reduced motion, portrait overflow and return-to-menu pass, with zero console/page/HTTP errors. Artifacts: `output/playwright/dungeon-v2-final/`. This run deliberately skips the already completed two-minute journey and is not counted as additional sustained play.
- Replaced the remaining glossy static limb chains with 24-triangle, low-relief blood-atlas residue; static body piles use dark shrouded cloth. Four world geometry/batching tests passed, without added draws or collider changes. Removed the centered portrait kill-counter overlap.
- Existing isolated two-context WebRTC transport regression passed (measured host RTT 1ms).
- Final bundled web-game client completed two input/capture iterations with forward movement, firing, turning and jumping; no errors. Its short choreography ends against a wall and is not used as progression proof. Directed residue screenshot was inspected: fourteen shared instances use `BloodResiduePBR`, with local sheet height about2cm, replacing the red capsule chains. The sustained journey above supplies progression evidence.

Measured render budgets from the sustained run (1280×720): entry 283 calls/363k triangles; active combat 509/1.08M at approximately 37 FPS; sixteen-actor artificial stress view 802/1.62M at approximately 33 FPS when captured. A subsequent 90-frame sample had median 16.8ms and p95 33.4ms; this short sample is not a sustained 60-FPS claim. Normal gameplay caps at twelve living creatures. Portrait 390×844 fits without horizontal overflow; touch combat itself was not exercised. The expensive independent skinned crowd remains the main performance limitation.

The final first-floor fixture is cheaper (309 calls/758k triangles, approximately60 FPS; 16.7ms median/16.8ms p95), but much of its crowd is behind walls or outside the camera. It does not replace the heavier floor-two measurement above.

## External asset sourcing

Credential probe output (literal; this installed probe emits blanks for unset variables):

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

The built-in image generator is available independently of those environment variables.

| Surface | Chosen sources and reason |
| --- | --- |
| Hero/player and weapons | Preserve prior grounded firearm and arm pass; authored mechanical detail for alternate fire |
| Enemies | Existing `assets/models/afterlife-ash-witness-motion-v04.glb`, captured six-clip skeleton, stable procedural upper-body variations |
| Signature props/pickups | Small repeated recovery cases, instanced authored geometry |
| World/sky/background | Existing enclosed dungeon kit, room-specific set dressing and bounded practical lights; no sky change |
| Materials/textures/decals | Hybrid generated enamel surface plus exact room-name typography; reuse existing PBR materials |
| Logos/icons/GUI | Existing identity retained; simple directional UI arrow |
| Audio/SFX/voice | Existing bundled library, including `assets/audio/ambience/ossuary-dungeon.ogg`; mix correction improves the weak playback levels without replacing usable recordings |

New image output: `assets/textures/dungeon-enamel-wayfinding-v2.webp` (768×512). Built-in generation source ID `exec-3634abd6-52c5-48c9-8b62-26e9f9fe9bb1`, originally 1536×1024. Prompt requested a blank aged warm-ivory porcelain enamel sheet with subtle crazing, chipped steel perimeter, quiet center, no text or perspective. It is used on visible destination plaques.

No additional paid Meshy, Tripo, Gemini or ElevenLabs jobs were submitted. Prior Meshy rig `01a0ec1c-9581-709a-89c1-ee91a298163b` and motion task `01a0ec1d-f490-7469-a54c-ff73f6434d23` are reused. No new Blender bake was necessary for the bounded posture/phase variation. More distinctive creature silhouettes and individual rig instancing remain possible later improvements.

## Skill-loading ledger

Loaded from `C:/Users/wolfk/.codex/skills/`: `threejs-game-director`, `threejs-gameplay-systems`, `threejs-aaa-graphics-builder`, `threejs-game-ui-designer`, `threejs-debug-profiler`, `threejs-qa-release`, `threejs-3d-generator`, `threejs-image-generator`, `threejs-audio-generator`, `develop-web-game`; also `.system/imagegen/SKILL.md`. All required phase files were available. Gameplay, environment and audio phases used focused existing workers; integration, HUD, effects and final QA stayed with the parent.

## Reference ledger

Paths below are relative to the skill root above; each was loaded for its applicable phase (including worker reads).

- Director: `threejs-game-director/references/prompt-templates.md`.
- Gameplay: `threejs-gameplay-systems/references/gameplay-workflows.md`, `physics-engine-selection.md`. Existing fixed timestep/grid collider architecture retained; no physics engine migration.
- Graphics: `threejs-aaa-graphics-builder/references/{visual-scorecard,implementation-blueprint,model-recipes,render-recipes}.md`; `references/checklists/{aaa-game-quality-gate,aaa-visual-scorecard,material-lighting-quality,performance-safe-detail}.md`.
- UI: `threejs-game-ui-designer/references/ui-patterns.md`; `references/checklists/{game-ui-quality,hud-readability,responsive-ui-fit}.md`.
- Debug/profile: `threejs-debug-profiler/references/debug-profile-checklists.md`; `references/checklists/{scene-debugging,performance-profile}.md`.
- QA/release: `threejs-qa-release/references/qa-release-checklists.md`; `references/checklists/{visual-verification,playtest-qa,release}.md`.
- 3D generator: `threejs-3d-generator/references/{api-notes,threejs-integration,image-generator-workflows}.md`.
- Audio generator: `threejs-audio-generator/references/audio-workflows.md`.
- Develop-web-game: bundled action payloads and Playwright client; wrapper adapts local browser/package paths and asset warmup, preserving input/capture/error loop.

Primary design references: [Valve's Left 4 Dead AI presentation](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf) informs the short pressure/relief rhythm; this implementation is not Valve's director. [Three.js SkeletonUtils](https://threejs.org/docs/pages/module-SkeletonUtils.html) documents shared geometry/material skeleton clones. The [individual instanced skinning example](https://threejs.org/examples/webgpu_skinning_instancing_individual.html) uses WebGPU; it was evaluated but not copied into this WebGL game.

## Visual scorecard

Conservative scores, 0–3, based on inspected desktop, crowd and portrait captures. Before values are qualitative inspection of the existing build, not a matched screenshot benchmark.

| Category | Before | After | Evidence / remaining limits |
| --- | ---: | ---: | --- |
| Art direction | 2 | 2 | Cohesive worn dungeon/bodycam identity, stronger destination hierarchy |
| Hero/player | 2 | 2 | Existing detailed worn firearm, preserved mechanical animation |
| Obstacles/enemies | 2 | 2 | Captured clips and posture variants; repeated Ash silhouette remains |
| Rewards/interactables | 1 | 2 | Authored recovery caches with useful pickup state and UI feedback |
| World/environment | 2 | 2 | Purposeful routes, mounted signs, steam; still modular/repeated rooms |
| Materials/textures | 2 | 2 | Existing material library plus generated enamel and exact names |
| Lighting/render | 1 | 2 | Warm onward cues, cool depth, less obscuring lens noise/fringing |
| VFX/motion | 1 | 2 | Refined fluid/projectile shapes, restrained blast and stable captured poses |
| UI/HUD | 2 | 2 | Reachable direction, purpose and useful pickup communication |
| Performance evidence | 1 | 2 | Renderer counts, crowd instrumentation, build and desktop/mobile captures |

Average after review: 2.0/3. Automatic failures/limits: crowd silhouette repetition remains; no premium/AAA claim. Full campaign human playthrough, hardware diversity and mobile touch gameplay are outside this automated desktop-browser iteration; portrait screenshots establish layout only.
