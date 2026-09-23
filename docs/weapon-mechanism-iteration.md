# Weapon mechanism iteration

This pass keeps the four first-person weapons lightweight while giving each one
an identifiable firing rhythm. It only transforms existing groups plus four
small Breach valve meshes; no renderer, gameplay, or audio contracts changed.

| Weapon | Motion cue | Runtime state | Added geometry |
| --- | --- | --- | --- |
| Ossuary | Jaw drops and rib cage flexes on the shot, then returns to a quiet breath | `jawTension` | 0 |
| Breach | Breech recoil is joined by twin pressure valves and a short rib-cage expansion | `pressurePulse` | 4 low-segment meshes |
| Arc Lance | Charge cage opens around an irregular plasma pulse and its vents breathe | `cagePulse` | 0 |
| Reliquary | Muzzle claws and heat vents part around the core like a small ritual, then close | `ritualPulse` | 0 |

The factories continue to expose `muzzle`, `projectileOrigin`, grip sockets, and
the existing `animate*` functions. The renderer still calls those functions
with the existing `shot`, `time`, and `dt` arguments. The long shot cadence is
therefore readable without adding a new per-frame allocation, light, texture,
or gameplay state field.

## Emission balance pass

The first afterlife gameplay frame showed the Ossuary's idle bars reading as
neon pink. The four continuous accents now sit in the room's low-energy range,
while the existing shot, heat, and charge state drives the brief peaks:

| Weapon accent | Previous idle | New idle base | New pulse terms |
| --- | ---: | ---: | --- |
| Ossuary glow / ember | 1.6 / 1.8 animated | .32 / .48 | `shot * 5.2`, `flash * 1.3`; ember `heat * 2.6`, `flash * 6.2` |
| Breach ember | 2.8 animated | .45 | `heat * 2.9`, `flash * 6.1` |
| Arc energy / glass | 4.4 / 1.25 animated | .72 / .36 | energy `heat * 6.6 + cagePulse * 3.8`; glass `heat * 3.2 + cagePulse * 1.8` |
| Reliquary ember / muzzle | 2.2 / 2.2 animated | .48 / .50 | ember `heat * 2.8 + ritualPulse * 4.8`; muzzle `flash * 11 + heat * 1.4` |

Only existing `emissiveIntensity` values changed; colors, opacity, geometry,
lights, and gameplay contracts remain unchanged.

Verification:

```text
node --test tests/build08-weapons.test.mjs
node --test tests/weapon-mechanism-motion.test.mjs
```

The motion test checks that each mechanism moves on a shot, that the distinct
state pulse is finite and stateful, and that all four mechanisms settle back to
idle after two seconds.
