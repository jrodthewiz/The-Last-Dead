# Longer map and open-world direction — October 2, 2026

## Third iteration

- **Map/readability:** removed the sixteen-room sign cap, resized the sign atlas
  to cover extended destinations, and moved the loading-return sign with the
  original wing's offset. Five-floor tests check sign coverage and UV bounds.
- **Materials:** seeded per-panel tint adds restrained wear variation to the
  existing annex instance pools, without another texture or draw call.
- **Backpack:** a full pack explains the blocked pickup once per approach;
  the cache stays available and can be collected after buying a fitting.
- **Weapon model:** the Ossuary fitting now adds a visible brass/steel barrel
  clamp, following the existing recoil pivot. It is one prebuilt mesh; buying,
  switching, floor travel and new-run reset read the existing backpack state.
  Other weapons still have functional damage fittings without custom meshes.
- **Infected:** competing audible sounds choose the strongest perceived source
  rather than whichever event was appended last. Seeded search cadence and
  attack warnings remain. Existing recorded audio and character rigs are reused.
- **Open-world authoring:** `scripts/export-neighborhood-house.py` now exports
  intact and storm-damaged single-storey shells, editable Blender files and
  Y-up metre collision metadata. Each shell has 96 triangles and a 1.4×2.4 m
  doorway. Export checks cover capsule-width doorway clearance, front-wall
  blocking and exact duplicate faces. Browser checks compare every exported
  mesh bound with its proxy and capture exterior/interior views.

The house is a plain geometry/metadata prototype in `output/house-poc/`, not a
live game map or finished environment asset. Its next gate is a single playable
plot adapter using the current movement system, followed by windows, roof
silhouette, generated materials and a moving-camera flicker check. Keep the
current dungeon available while testing that plot. Only replicate houses after
that gate passes; no character/audio downloads are needed for this step.

Reproduce the offline exporter in PowerShell:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/export-neighborhood-house.py -- --output output/house-poc
node tests/house-poc-browser.mjs
```

Browser tests use the existing `PLAYWRIGHT_PATH`/`CHROME_PATH` overrides.
Third-pass game evidence: `output/playwright/open-world-iteration-3/`.
House evidence: `output/playwright/house-poc/`. Focused checks:
`tests/scavenger-iteration.test.mjs` plus the existing map, AI and fitting suites.

Verification: **62 passing automated checks** (35 focused, 27 regressions),
successful production build and whitespace checks. Full browser PASS: real
scrap collection, fitting purchase and visible mesh, damage 2→2.5, both pause
paths, textured/tinted annex panels and three responsive views; zero page/HTTP
errors. Inspected fitting and annex screenshots. Both exported house GLBs
passed bounds/proxy checks with no browser errors; repeat export metadata is
identical. These checks do not yet establish full-world streaming performance,
house integration with the live controller, or temporal flicker across a city.

## Second iteration

The five annexes now have distinct district identities: Pumpworks, Isolation
Ward, Ash Galleries, Cold Stores and Blackwater Control. Their panel tints,
roughness and metalness differ, including the fifth floor. Route geometry and
the shared collision compiler remain the basis of traversal.

The generated atlas now loads as a 556,124-byte WebP instead of the
3,333,708-byte PNG (83.3% fewer texture-transfer bytes). The original PNG is
retained as source. Resolution stays 1254×1254; this is transfer compression,
not a GPU-memory reduction. Browser checks decode the WebP, verify all five
styles share that texture, and inspect UVs on both panel orientations.

Backpack rendering now updates only when its displayed state changes.
Successful fitting feedback survives subsequent frames. Closing the backpack
preserves an existing pause; opening it during play still resumes normally.
The narrow-screen launcher no longer has conflicting top/bottom positioning.
At four viewport sizes, 120 unchanged updates cause zero DOM mutations;
purchase, focus trap, keyboard closing and scroll access remain tested.

An investigating infected now interrupts its stationary search when an
audible sound comes from a different location. Repeated sounds at the same
point do not restart the timer, and attack warnings are retained. Existing
recorded voices and character rigs remain in use.

Next bounded experiments, in order:

| Experiment | Concrete acceptance gate |
| --- | --- |
| One Blender house shell and one damaged variant | Headless repeat export; enter both doors using real movement; collision proxy matches the visible wall; no duplicate exterior faces |
| One visible weapon fitting | Purchase changes the equipped mesh and measured damage; switching and floor travel preserve both; no extra per-frame geometry |
| Character pack audition | One candidate rig demonstrates idle, walk, attack and injury with current movement; retain the existing rig unless screenshots and foot-contact checks improve |
| Sound audition | Compare three licensed recorded candidates at matched loudness; attack onset remains readable over ambience; store provenance before bundling |
| Neighborhood replication | Only after the house passes: six seeded plots, one landmark, stable loot IDs; fixed-camera and moving-camera flicker checks, then save/reload |

These remain experiments to implement, not completed open-world features.
The second-pass browser artifacts live in
`output/playwright/open-world-iteration-2/`; isolated material and UI evidence
is in `output/playwright/scavenger-pack/report.json`.

Second-pass verification: integrated browser PASS with zero page/HTTP errors,
both pause paths, real-input scrap collection, damage 2→2.5, two inspected
annex views and three responsive views. All 136 audio entries decoded with
zero audio errors. Thirty focused map/AI/pack/fitting checks, the broader
engine/story/loading/presentation regression, and 32 animation/spatial/room
audio checks passed. Build and whitespace checks passed. Cold headless startup
took 170 seconds; ordinary hardware FPS and a full temporal-flicker sweep
remain unverified.

This is a light playable iteration. Normal solo Story now loads connected,
mirrored service annexes on all five floors. Each floor retains its original
records, weapons, keys and chapter actions, with a real exit at the added wing's
end. `?extended=0` restores the earlier layout for comparison. Co-op continues
to use its existing arena campaign.

| Floor | Earlier shortest route | Extended route |
| --- | ---: | ---: |
| Receiving | 148 m | 332 m |
| Wards | 124 m | 284 m |
| Catacombs | 188 m | 416 m |
| Choir | 152 m | 344 m |
| Final throat | 104 m | 240 m |
| Total | **716 m** | **1,616 m (2.26×)** |

These are open-gate shortest travel distances, not estimates of play time.
The extra sections mirror room positions and door sides, vary cover rhythms,
scale/reorient scenery, tint lighting, and reduce encounter budgets. The final
shutdown moves forward into its annex. Collision, navigation and drawing all
consume the same compiled map records. Wall slots remain unique.

Amber tool caches supply four scrap each. **B** or the **PACK** button opens
the backpack and pauses solo play. Capacity is twelve scrap. Eight scrap buys
a hardened fitting for one owned weapon, giving that weapon 25% more direct
damage. Duplicate purchases are blocked. A full backpack leaves caches in the
world. Scrap and fittings persist between floors and reset on a new run.
They are run state; persistent saves, equipment meshes, repair, durability and
multiple recipe choices are later steps. Projectile damage is stamped at launch, so switching weapons cannot change
a rocket or core already in flight. Scripted finishers, punches and slams
retain their existing damage. Recorded pickup/mechanical cues provide feedback.

Infected investigating a last-known noise now stop to listen between slower
body sweeps while their heads scan independently. Cadence is deterministic per
enemy. Reacquiring a player cancels the search, preserving attack warnings.
Existing rigs, distance-driven gait, injury/crawl and bounded reanimation stay
integrated. The current twenty-four recorded zombie vocal takes are already
sourced in [the audio ledger](../audio-sources.md); this pass reuses them.

## Small steps toward an original open-world survival game

1. **One 128 m neighborhood, six to eight houses, one service landmark.**
   Write a Last Dead-owned headless Blender exporter for reusable single-storey
   shells, damaged variants, doors and separate collision proxies. Export GLB
   geometry plus seed/placement/door metadata. Compile placement offline.
   First acceptance: walk the block, enter one house, collect scrap, fight,
   return and save. Retain current movement and visual identity while testing
   a stronger melee/scavenging loop inspired by Dead Island.
2. **Make one house work before adding more.** The current controller uses
   flat floors and cell walls. Add explicit door/wall collision and ground-height
   queries before stairs or multi-storey interiors. Keep doorway and player
   clearance independent of decorative geometry. Doors, loot and infected need
   stable IDs across chunk unloads. Add bounded save records, then test reload.
3. **Grow to three distinct neighborhoods.** Seeded plot subdivision, street
   graph, selected house prototypes, small palette/scale changes, and authored
   landmarks. Keep only nearby chunks and infected active. Bake static kits;
   use instancing for repeated props. Preserve a fixed active-enemy budget.
4. **Deepen the tested loop.** Add a few backpack slots, weapon-specific
   recipes with visible fittings, one wounded/listener temperament, and local
   sound responses. Expand clothing from the current rig before replacing it.
   Add new sounds only when an audition shows an existing event needs them.

Each step stops for a short real-input test, camera-motion surface check,
renderer counts and a save/reload check. A multi-kilometer city is premature
until that neighborhood loop works.

## What Duals actually provides

Duals is currently **C:/Users/wolfk/Desktop/Dogfight**, not Desktop/duals.
It was inspected read-only. Useful source paths relative to that repository:

| System | Source | Adaptation |
| --- | --- | --- |
| Seeded city/prototypes | `src/shared/maps/millhaven/millhavenWorld.js`, `sourceLibrary.json`, `districts.js` | Plot selection, small scale/palette changes, district identity |
| Clear interiors | `src/shared/maps/millhaven/interiorLayout.js` | Door/stair/furniture clearance and deterministic arrangements |
| Street surfaces | `src/shared/maps/millhaven/streetSurfaceGeometry.js` | Polygon subtraction and one geometric owner per ground area |
| Residential kit | `src/shared/maps/suburbanBuildingKit.js` | Gables, openings, trim, closed windows |
| Offline compilation | `scripts/compile-millhaven-world.mjs` | Compile placements and binary chunks away from gameplay frames |
| Flicker ownership | `src/visual/coplanarGeometryOwnership.js`, `mapCoplanarDepthLayers.js` | Reject/partition overlapping faces before batching |
| Premade props | `models.json`, `models.lock.json`, `src/models/`, `public/models/Props/thai-kit/LICENSE.txt` | Curated MIT Thai Kit factories; retain notice and inspect vendor compatibility |

The referenced `art/town-shell/export_game_library.py` and city `.blend`
masters are currently missing from Dogfight. The exported city data and compiler
exist; reproducing that Blender authoring requires recovering or rebuilding the
source. The original Vibe3D acquisition command was not retained. The registry
lock identifies `npm:@thai-kit/props` version `0.3.4`; do not invent a recovered
CLI. Its Three.js peer version must be checked before porting factory code.

Actual existing commands, shown as references rather than run on Dogfight:

```powershell
# Run inside Dogfight; writes that project's compiled world.
node scripts/compile-millhaven-world.mjs
node scripts/glb-shrink-assets.mjs input.glb --preset balanced --output candidate.glb
node my-server/node_modules/tsx/dist/cli.mjs scripts/compile-map-depth-recipes.mjs
node my-server/node_modules/tsx/dist/cli.mjs scripts/check-map-depth-layering.mjs
node scripts/visual/check-map-temporal-stability.mjs <capture-directory>

# Existing Last Dead character workflow; supply real input/output paths.
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --factory-startup --python scripts/afterlife-character-blender.py -- --input INPUT.glb --blend MASTER.blend --export AUTHORED.glb --report REPORT.json
node scripts/afterlife-character-package.mjs AUTHORED.glb RUNTIME.glb PACKAGE.json 'Character Name'
```

Last Dead's packager already uses Dogfight-installed `@gltf-transform`, `sharp`
and `meshoptimizer` offline. The game and build continue to require only Node
and bundled assets. Keep all new authoring/output inside Last Dead.

## Asset candidates and surface rules

[Kenney City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban) is a
CC0 candidate for blockout house shells. [Quaternius Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularcharacters.html)
provides CC0 modular animated characters; use only after testing skeleton,
scale and animation adaptation to our movement. Neither pack was downloaded
or substituted this pass. Existing recorded zombie, firearm and mechanical
sources and their runtime files are documented in the audio ledger.

One owner for each wall, street and house apron; remove hidden/internal faces;
subtract intersecting roads; keep coordinates local to chunks; reserve depth
offsets for intentional decals. Texture atlases use UV borders. This pass
replaces annex wall panels with generated atlas material at the existing panel
depth, rather than adding overlapping walls. Unique wall-slot tests pass;
exhaustive temporal flicker certification belongs to the neighborhood gate.

## Implementation and verification ledger

Loaded: Three.js game director, gameplay systems, QA/release, imagegen,
develop-web-game, local-dev-instances, Playwright and audio workflow guidance.
Backpack worker loaded UI designer and its readability/responsive checklists.
Gameplay, custom-collision selection and QA references were read. Economy
scope follows the user's explicit light-pass request; no premium/full-world
completion claim. No paid model/audio generation was required.

Built-in imagegen produced `assets/textures/service-district-atlas-v1.png`.
Four UV quadrants supply rusty enamel, damp tile, soot concrete and corroded
steel. The exact prompt is saved alongside this report. Existing character
assets and recorded audio were reused. Blender city authoring, streamed worlds,
replacement character packs and new sound auditions are planned stages.

Run: `node --test --test-isolation=none tests/dungeon-extension.test.mjs tests/scavenger-pack.test.mjs enemy-ai.test.mjs engine.test.mjs tests/campaign-journey.test.mjs`.
The extension tests include actual tick-driven movement, proximity keys and
scrap, held chapter actions, floor transitions, fitting persistence and final
exit victory. `node build.mjs` produces the static build. Browser evidence is
under `output/playwright/open-world-poc/` and `output/playwright/scavenger-pack/`.
These harnesses open their own browsers and leave the user's game tab intact.

Browser evidence: the integrated desktop pass collected two caches through real
movement, paused with B, consumed eight scrap once, resumed, and measured
Ossuary damage 2→2.5. Both annex panel pools loaded the generated atlas; two
camera views were inspected. Screenshot center-region channel deviation
22.8–28.7 and entropy 4.62 verify varied rendered scene pixels. The first
viewport sweep used pointer clicks while desktop mouse capture was active;
the harness now uses B during desktop-context resizing. Isolated touch/button
UI checks pass at four sizes. Cold headless startup measured 131.9 seconds;
this does not establish ordinary hardware FPS. Static-world streaming/culling
and a larger-world temporal-flicker sweep remain future gates.

Final focused regression total: **90 passing checks** (79 mechanics/map/story/AI/pack, two projectile-fitting integration, nine loading/presentation/static-world). Build and diff whitespace checks pass. The bundled web-game action client also completed two iterations against the static build, with the final PACK placement and paused scene captured and no console-error artifact. Its temporary adapter only resolves the existing Playwright package and waits for this game's cold equipment preparation; no testing package was installed.

Corrected final integrated browser run: **PASS**. Real-input scavenging and
fitting, 25% measured damage, pause/resume, generated annex panel loading,
and desktop/portrait/landscape backpack layout all pass with zero page/HTTP
errors. Latest screenshots and browser-report.json supersede the earlier
harness failure image. The pause background now remains still instead of
redrawing the whole world behind the backpack.

## Harbor milestone

The next exterior proof of concept now exists as **BLACKWATER HARBOR** in the
main menu: structured lots and streets, analytic water, a drivable truck and
weapon ownership/backpack equip. See [the harbor iteration report](../harbor-iteration.md)
for verification, limitations and the next bounded neighborhood/interior tests.
This does not replace the five-floor doubled-map slice or claim streaming.
