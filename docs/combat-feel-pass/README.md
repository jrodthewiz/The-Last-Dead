# Combat feel and enemy animation pass

Carrion fire now has heat-dependent recoil, bolt movement, a camera-facing muzzle flare, pressure ring, brief muzzle light, and pooled ejected brass. Automatic shots vary sample playback slightly and include a mechanism clack; burst and Mourning charge retain their different rhythms. Flesh hits use a short moving wound layer, directional spray, droplets, and seeded blood residue. The survivor enemy rig restores its last mixer pose before each update so unchanged clip samples do not snap limbs to bind pose.

The visual direction keeps the rifles dark and heavy while separating amber gun flashes and brass from red wet impact feedback. The extra effects are pooled and bounded, and reduced-motion/gore settings still suppress their respective effects. Models are the repository's procedural rifle meshes and imported survivor GLB; audio reuses the existing rifle samples documented in `docs/rifle-audio.md`. No new external assets were required. Asset credential probe output during this pass:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

Visual evidence: [machine-gun impact](machine-gun-impact.png), [Carrion flare](rifle/carrion-flash.png), [Mourning shot](rifle/mourning-charged-shot.png), [enemy hit](enemy/blood-hit.png), [attack pose](enemy/attack-commit.png), [settled corpse](enemy/corpse-side.png), and [narrow-screen rifles](rifle/rifles-mobile.png). These are isolated headless Chrome captures; the user's existing game tab was left intact.

Verification: `node build.mjs`; 20 focused rifle/casing/blood/animation tests; `npm test` (20 engine tests plus a two-context WebRTC check, with `PLAYWRIGHT_PATH` and `CHROME_PATH` set); browser rifle input/audio/mobile QA with no page or HTTP errors; enemy hit/kill/collapse browser QA; and an integrated six-shot machine-gun fixture against the actual imported survivor rig. That fixture recorded six flesh hits, six casings, five active wound layers, and zero animation-pose drift across a repeated mixer sample. See `rifle/qa-results.json`, `enemy/actions-qa.json`, and `combat-feel-qa.json` for the recorded checks.
