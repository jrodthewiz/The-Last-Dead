# Build 06 art factory pass

Date: 2026-09-08

The admitted concept references and strict sculpt specs are reconstructed as
standalone, stylized procedural Three.js factories:

- weapon-reliquary.js exports createReliquary(options) and
  animateReliquary(root, shot, time, dt, state).
- npc-bellwraith.js exports createBellwraith(options) and
  animateBellwraith(root, enemy, now, seed).
- weapon-ossuary.js retains createOssuary() and
  animateOssuary(root, shot, time, dt) while adding recoil, flash, heat,
  projectile, muzzle, inspect, grip, and core sockets.

Each factory returns a named root with userData.sculptRuntime, an explicit
parts map, material identities, sockets, a coarse collider, and explode and
pick hooks. The hero weapon uses a ribcage receiver, skull stock, bone muzzle
brake, animated core, pressure vents, and a recoil carriage. The enemy uses a
bell shell, face plate, ember sockets, ribs, articulated arms and hands, torn
membrane struts, chains, and a hover sigil. Static surfaces are collapsed per
material inside articulated groups to control draw calls while keeping socket
and animation groups addressable.

Evidence:

- C:\Users\wolfk\Desktop\thelastdead\weapon-reliquary.js
- C:\Users\wolfk\Desktop\thelastdead\npc-bellwraith.js
- C:\Users\wolfk\Desktop\thelastdead\weapon-ossuary.js
- node --check passed for all three modules.
- A bounded Node constructor and animation smoke test passed with 18 named
  Reliquary parts / 9 sockets, 15 Bellwraith parts / 6 sockets, and 19
  Ossuary parts / 8 sockets.

The image-to-3D result is a stylized reconstruction authored from the admitted
concepts. A browser render, orbit comparison, runtime part manifest, and
pixel-level review remain pending because the parent agent owns renderer/build
integration and the live review tab. No visual parity or measured draw-count
claim is made here.
