# Character motion and controls — 2026-10-02

R now displays weapon status: weapons replenish automatically and do not need a
manual reload. It preserves the current run, health, kills and progress. Enter
retries after death or victory; the pause menu retains its explicit Restart
button. The controls guide, finish screen and README agree with these bindings.

Headless Blender 2.93 refines the Ash Witness idle, shuffle and chase with
bounded breathing, shoulder counter-motion and delayed neck/head movement.
The Warden receives the same restrained treatment on idle and walk, with lower
amplitudes for its heavier body. Six named clips remain on each actor. The
maximum added rotation is below 0.1 radians. The small secondary offsets return
to zero at each loop boundary; original gait closure and foot poses remain.

The authoring script preserves character vertices, skin weights, normals, UVs,
joint hierarchy, inverse bind matrices, sockets and packed texture bytes. Every
foot channel and attack, hit and collapse channel stays exact. The zombie is a
new `assets/models/afterlife-ash-witness-motion-v06.glb`; the reviewed v05 candidate
remains preserved. Warden motion updates `assets/models/bloodworks-warden.glb`.
Original inputs and editable masters are in the ignored preservation archive:
`.art-source/motion-polish/`. This archive is never runtime input.

The Blender masters have editable actions/NLA tracks and open on idle with the
review camera. Their neutral proof materials avoid the Blender 2.93 WebP import
limitation; the runtime assets retain their exact packed materials and textures.
See [the motion sheet](blender-motion-sheet.jpg) and [validation](validation.json).

Runtime changes make distant melee approaches, flank routes and wall slides
face measured travel. Ranged strafes retain target aim. Arrival steps stop at
their destinations, and crowd movement contributes to the animation signal.
Warden retreat now reverses its distance-driven walk, and strike recovery fades
into locomotion over 140–220 ms. A normal hit flash no longer overrides committed
Warden contact; real stagger still interrupts it. Reset preserves the Warden's
forward alignment. Cantor retreat reverses its clips, duplicate time freezes its
pose, and teleporting does not produce a sprint burst. Warden, Cantor and
Bellwraith collapses retain their orientation as the player moves.

## Rebuild

```powershell
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --python scripts/polish-character-motion.py
node build.mjs
```

The script rebuilds deterministically from preserved inputs. Runtime and build
continue to need only Node and the bundled assets/vendor files.

## Verification

The production build passes. Focused Node batches cover actual imported skins,
geometry preservation, bounded normalized motion, 30/60/120 Hz attack contact,
grabs, collision, separation, navigation, Warden/Cantor recovery and keyboard
bindings. Run them with Node's `--test-isolation=none` on this Windows sandbox:

```powershell
node --test --test-isolation=none engine.test.mjs enemy-ai.test.mjs tests/character-motion-polish.test.mjs tests/character-rig-v05.test.mjs tests/character-articulation.test.mjs tests/enemy-animation-quality.test.mjs tests/warden-motion.test.mjs tests/afterlife-animation.test.mjs tests/afterlife-enemy.test.mjs tests/enemy-pressure.test.mjs tests/player-bite.test.mjs tests/retry-input.test.mjs tests/gamepad-input.test.mjs
```

Real Chrome input checks pass: R preserves the same run, health and kills;
Enter during play leaves the run intact; R on death leaves it intact; Enter on
death creates a fresh run; the pause Restart button still works. Receipt and
screenshots: `.logs/retry-input/`.

The source and production zombie browser checks exercise all three variants on
the real simulation/renderer. Across twelve simulated seconds per variant,
Stalker/Skitter/Bloodhound retain their pursuit and authored attacks. All damage
contacts sample 0.375 seconds, action weights remain normalized, and there are
zero moving contact frames. Each recovery retains only its short intended fade.
Source evidence: `output/playwright/character-motion-polish/source/`; production
evidence: `output/playwright/character-motion-polish/production/`.

The production Warden browser check passes for Warden, Bulwark and Colossus in
walk, windup, strike, hit and collapse. It uses the actual renderer asset branch.
The source and production checks report no page/console/HTTP or failed asset
requests. Desktop screenshots and canvas samples confirm visible rendering.
Source canvas diagnostic: 367 calls, 594,918 triangles, 148 textures, 167 sampled
color levels at 1280×720. These are scene measurements, not an FPS improvement
claim. Both checks own ephemeral servers and headless browsers; the user's game
tab and port 5200 are preserved.

## Workflow ledger and limits

Loaded the Three.js game director, gameplay systems and QA/release skills;
applied gameplay workflows, QA/release checklist, visual-verification,
playtest-QA and release references. Delegated the input and runtime character
phases; authored Blender assets and verified integration in the parent task.
Gameplay/input, motion authoring, runtime integration and focused QA are done.
This is a bounded pass on existing authored assets; no external asset generation,
audio work, renderer redesign, physics engine replacement or deployment is in
scope. Existing user edits elsewhere in the checkout are preserved.

No new magazine/ammunition mechanic is introduced. The motion pass adds subtle
secondary movement and improves direction/recovery; it does not introduce foot
IK, individual finger animation or a new Bellwraith rig. Warden retains its
existing approximately 34 MB geometry/texture payload; animation adds about
21 KB. Zombie motion adds about 37 KB to the preserved v05 rig.
