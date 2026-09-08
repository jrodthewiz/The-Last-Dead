# Build 10 weapon pass

Ossuary gained chamber-drive rails and moving extractor claws. Breach gained a sliding breech, guides and shell extractors. Arc gained a moving charge slider/ring. Reliquary gained heat-driven pressure shutters. The added mechanisms preserve the existing muzzle, grip, inspect, projectile and recoil contracts.

The shared `weapon-materials.js` profiles distinguish iron, edge metal, bone, horn and leather. They reduce broad environment highlights and tame pale vertex wear. The renderer respects those authored reflection settings instead of replacing them globally.

Factory budget after the pass: Ossuary 30 meshes / 19,984 triangles; Breach 94 / 15,914; Arc 68 / 15,868; Reliquary 43 / 21,952. Existing bounded/finiteness/socket/animation tests passed. These counts exclude the separate first-person arms.

This is a procedural material and mechanism refinement based on existing concept references. Formal Divine Eye/assembly gates are not newly completed. The root Build 10 actual-game screenshots are the visual review evidence; no exact reconstruction or AAA certification is claimed.

Root review found a pre-existing undefined `boneDark` palette entry in Ossuary. The skull and jaw were silently falling back to Three.js white material. Added the missing aged bone material and a regression requiring those meshes to use the factory palette.
