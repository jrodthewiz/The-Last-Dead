# Afterlife map composition contract

world-afterlife-design.js is a visual-only layer for the existing Story and
campaign courses. It consumes course.openings when Story mode exposes the
compiled doorway graph, or the authored course.layout.routes primary route
for campaign areas. It never changes cells, walls, blocks, room gates, spawn
positions, or exit positions.

The integration point is after authored world details have been built and
before static batching:

    import { buildAfterlifeMapDesign } from './world-afterlife-design.js';

    this.afterlifeMapDesign = buildAfterlifeMapDesign(
      this.worldRoot,
      this.materials,
      course,
      {
        propFactories: {
          wheelchair: makeAfterlifeWheelchair,
          'mourning-cabinet': makeAfterlifeMourningCabinet,
        },
      },
    );

Each factory receives { slot, materials, course, profile } and returns a
THREE.Object3D. The returned model is placed at an edge-grounded slot in an
entry or flank room. When a factory is absent, a single low detail cabinet
silhouette keeps the room scaled; the wheelchair slot remains an explicit
diagnostic so the model loop can fill it later.

The pass uses a shared unit box and four role materials. Story floors receive
one eye-height divider at the edge of the first room transition, a short
lateral ceiling silhouette at the next sightline, and one small divider signal;
the centre lane stays open and the divider base is placed at floor height.
Campaign areas keep their authored route frames and edge screens. The
generated map layer is capped at six instanced draws and 25,000 triangles;
current node checks produce 3–5 draws and 36–600 triangles per course. The
tests also snapshot course topology before and after generation.

The visual intent is a small cold reveal followed by an unanswered dark gap:
the first authored entry light pool carries the wheelchair prop beside the
lane, with a small authored tunnel-jamb clearance correction when that pool
overlaps the entry arch. The eye-height divider catches the far edge of the
next room, and the high lateral silhouette keeps the ceiling from reading as
empty black space.
The profile changes height, finish, and stagger for foundry, gallery,
ossuary, choir, and gullet spaces without creating five separate mesh kits.
