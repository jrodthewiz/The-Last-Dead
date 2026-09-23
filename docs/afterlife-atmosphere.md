# Afterlife atmosphere integration

`afterlife-atmosphere.js` is a bounded render layer for the forsaken-afterlife direction. It uses the dungeon course's room bounds and 4 m cell grid to place sparse low ankle-height mist wisps only on walkable room interiors. Transparent patches use one instanced draw with depth testing enabled, depth writing disabled, a low opacity, and a camera-distance fade so there is no full-screen grey veil, bright floor print, or visible near-plane card.

Authored `course.lights` provide deterministic cold pockets for one pooled speck draw. Specks are generated only inside the light's room, fade by distance to that source, and clamp to a one-to-three-pixel raster footprint. Hard-edged beam cones are disabled by default; they remain an explicit `enableBeams: true` opt-in for experiments. The module does not add lights, touch `scene.fog`, or alter gameplay state.

```js
const atmosphere = new AfterlifeAtmosphere(worldRoot, course, {
  mobile: renderer.isMobile,
  reducedMotion: settings.reducedMotion,
});

// Call after camera update and before the scene render.
atmosphere.update(run, nowMs, camera, { reducedMotion: settings.reducedMotion });

const diagnostics = atmosphere.diagnostics();
atmosphere.dispose();
```

`diagnostics()` reports the deterministic seed, course/room IDs, patch/speck/beam counts, draw-call estimate, and ownership guarantees. A renderer world rebuild should dispose the previous instance before constructing the new one.
