# First-person Blender motion

The game now samples 38 Blender-authored actions: draw, idle breathing, walk and landing for all eight weapons, plus firing/recovery for the six firearms. The existing gameplay-driven bat/chainsaw attacks, mechanical weapon parts, trigger finger and responsive aim/look lag remain layered with these actions.

`weapon-presentation.js` applies the clips to the shared camera-local held assembly. `fitForegroundArms` then solves hands against the current weapon sockets and keeps the sleeve segments connected with fixed lengths and bounded wrist angles. The clips are presentation only; they do not change aim, damage, cadence or network state. Reduced-motion and ADS weights remain active.

## Authoring

Editable source: `.art-source/viewmodel-motion/The_Last_Dead_First_Person_Motion.blend`.
It contains all eight fitted weapon/arm geometry references, one named control per weapon, 38 Actions and a first-person camera. Reference geometry uses flat material colors, not the runtime texture/shader pipeline. Breach is visible initially; unhide the desired control and its children and hide the previous weapon. Select its Action in the Action Editor. NLA library tracks are intentionally muted to avoid evaluating multiple clips together.

These are held-assembly control animations with runtime arm fitting, not newly skinned anatomical arm animations or reload/inspection interactions. The Blender geometry is a posed reference; the live sleeve solver is authoritative for elbow/wrist articulation.

Rebuild the reference and authored defaults from the repository root in PowerShell:

```powershell
node scripts/export-viewmodel-animation-reference.mjs
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --factory-startup --python scripts/build-viewmodel-motion.py
```

After manually editing and saving Actions, preserve those edits and rebake only:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 2.93/blender.exe' --background --factory-startup --python scripts/build-viewmodel-motion.py -- --export-only
```

Action duration is stored in its `duration` custom property in seconds. Frame 1 is time zero; the scene uses 120 fps. Control channels use game coordinates (X right, Y up, forward -Z); the parent converts to Blender coordinates. Rotation order ZYX matches Three.js XYZ intrinsic composition. The exporter evaluates Blender Bezier curves into `assets/survivor/viewmodel-motion-clips.js`; the runtime sampler interpolates without allocations and clamps one-shot endpoints exactly. Loops are wrapped by the driver. Blender is needed only for authoring, never at runtime or for a normal build.

## Verification

```powershell
node --test --test-isolation=none tests/viewmodel-blender-motion.test.mjs tests/weapon-presentation.test.mjs tests/foreground-arms.test.mjs
node tests/viewmodel-blender-browser.mjs
node build.mjs
```

Browser QA accepts `PLAYWRIGHT_PATH` and `CHROME_PATH`. It creates its own temporary server and headless browser, sweeps every action across all eight weapons, measures grip contact and wrist limits, and saves 24 pose captures plus a report in `output/playwright/viewmodel-blender`. It leaves the existing game tab and port 5200 server intact.

Verified October 3, 2026: 17 focused tests passed; build passed. Browser sweep: 38 actions, 798 sampled poses, zero page errors, maximum grip gap 3.16e-16 metres and maximum wrist angle 75 degrees. Breach firing, Carrion draw and chainsaw rest captures were visually inspected. This is an isolated actual-asset WebGL check; it does not certify full gameplay, WebGPU or subjective animation quality at every camera setting.
