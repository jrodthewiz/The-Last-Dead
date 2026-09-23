# Weapon silhouette redesign

The four first-person weapons now use a small procedural kit in
`weapon-occult-redesign.js`. Each silhouette is built from a manufactured shell,
one readable occult mechanism, and a dark wood or bakelite grip. The redesign
keeps the afterlife palette muted so the brief firing pulse has room to read.

| Weapon | Authored mechanism | Shot motion | Meshes / triangles |
| --- | --- | --- | ---: |
| Ossuary | Ratchet cylinder, rib cradle, jaw clamp | carriage recoil, cylinder index, jaw tension | 26 / 726 |
| Breach | Twin pressure barrels, break-action breech, valves | breech travel, extractor follow-through, valve kick | 26 / 946 |
| Arc Lance | Open frame, caged capacitor, charge slider | cage pulse, rotating core, vent expansion | 26 / 674 |
| Reliquary | Sealed core, pressure shutters, aperture claws | core rotation, shutter breath, claw opening | 23 / 674 |

Triangle totals are from the structural factory check and stay below 1,000 per
weapon. The meshes share the factory's material instances, use no dynamic
lights, and animate existing groups without allocating in the frame loop.

All factories retain `muzzle`, `projectileOrigin`, `grip`, and the optional
`supportGrip` sockets. The wrapper modules retain the original create and
animate exports; only their construction and animation delegates changed.
The shot contracts remain the existing numeric `shot`, `time`, and `dt`
arguments, with the mechanism pulse state stored locally in each weapon's
metadata (`jawTension`, `pressurePulse`, `cagePulse`, or `ritualPulse`).

The explicit runtime file list in `build.mjs` must include
`weapon-occult-redesign.js` because the four wrapper modules import it.

Focused checks:

```text
node --test tests/build08-weapons.test.mjs tests/build10-vfx.test.mjs tests/weapon-mechanism-motion.test.mjs
```
