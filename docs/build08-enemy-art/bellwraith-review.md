# Bellwraith authored reconstruction review

The Bellwraith concept was admitted as a front three-quarter reference for the img2threejs intake. The reference is a 1145x1374 isolated concept with foreground coverage 0.4068 and largest connected component 0.9869. It supplies the olive bell shell, broad lip, suspended skull, horn crown, torn membranes, chains, dark cavity, and red ember read.

The runtime factory follows those landmarks with a lathed bell shell, thick rim and mouth, crown horns, skull face and sockets, ribs, bone arms, torn membranes, chains, clapper, hover sigil, and explicit gameplay sockets. Surface evidence was extracted into independent albedo, roughness, bump, and supporting maps under pbr/.

## Gameplay normalization

The factory applies renderScale 1.1 before measuring the visual Box3. The current measured bounds are:

- size: [1.650272, 1.982302, 1.267152]
- minimum y: -1.101560
- floorOffset: 1.121560
- mesh count: 35
- triangle count: 14,634

The collider copies visualSize and the renderer consumes floorOffset, so the enlarged creature stays grounded while remaining readable against the 1.6 m player eye height.

## Validation

tests/build06-models.test.mjs passes finite-geometry, bounds, socket, animation, death-hide, and reset checks. The natural visibility harness reports the Bellwraith bounds and facing contract alongside the authored Warden samples.

The generic character starter spec generated during intake was not used as acceptance evidence because it did not describe this non-humanoid bell creature closely enough. The authored factory and runtime measurements are the accepted implementation evidence for this pass.
