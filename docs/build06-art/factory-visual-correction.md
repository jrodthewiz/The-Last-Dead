# Build 06 factory visual correction

Date: 2026-09-08

The review fixture exposed two silhouette defects and they were corrected in
the owned factories:

- Bellwraith now uses a bottom-to-top lathe profile with a short curved crown,
  continuous outward flare, opaque double-sided bronze shell, and a thick
  lower lip. The skull is forward-readable but hangs below the lip on a chain
  clasp; its ember eyes, longer claw arms, torn membranes, pulse sockets, and
  hover anchor remain addressable.
- Reliquary now has a heavier barrel core and bone shroud, four metal collars,
  layered muzzle collar and bands, a dark bore, ember muzzle ring/core, and
  longer bone teeth. Projectile and muzzle sockets were moved to the revised
  muzzle depth.

Visual evidence was produced with:

    PLAYWRIGHT_PATH=C:\Users\wolfk\Desktop\Dogfight\node_modules\playwright
    CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
    node tests\build06-visual.mjs

The refreshed captures are in docs/build06-reviews. All nine views
(Reliquary, Bellwraith, Ossuary; three-quarter, front, side) report
failedPrograms=0 and the run reports no page errors. Current fixture metrics:

- Reliquary: 37 calls, 18,868 triangles.
- Bellwraith: 33 calls, 13,378 triangles.
- Ossuary: 24 calls, 17,472 triangles.

The captures establish a visual correction pass and runtime render health.
They do not claim photorealistic parity with the generated concepts.
