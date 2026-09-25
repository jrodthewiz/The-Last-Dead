import * as THREE from './vendor/three.module.js';

// The atmosphere is deliberately a small, self-contained render layer. It
// never changes scene.fog or the renderer's light stack. World coordinates use
// the dungeon compiler's four-metre cells, with the floor at y = 0.
export const CELL = 4;

const DEFAULTS = Object.freeze({
  maxMistPatches: 42,
  maxSpecks: 52,
  maxEmberMotes: 48,
  maxBeams: 4,
  mistDensity: 0.13,
  // The source rooms are dark and reflective. Keep the wisps below a bright
  // floor decal value so the surrounding black air remains the dominant read.
  mistOpacity: 0.085,
  mistColor: 0x6d878c,
  coldColor: 0xb8d6d8,
  beamOpacity: 0.027,
  reducedMotion: false,
  mobile: false,
  // The cone fallback remains available for a deliberate later pass, but
  // hard-edged translucent beams are too graphic for the default afterlife.
  enableBeams: false,
});

const finite = value => Number.isFinite(Number(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function hashString(value) {
  const text = String(value ?? 'afterlife');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function asBounds(raw) {
  if (!raw) return null;
  if (raw.bounds?.minX !== undefined && raw.bounds?.maxX !== undefined) {
    const minX = Number(raw.bounds.minX), maxX = Number(raw.bounds.maxX);
    const minZ = Number(raw.bounds.minZ), maxZ = Number(raw.bounds.maxZ);
    if ([minX, maxX, minZ, maxZ].every(Number.isFinite) && maxX > minX && maxZ > minZ) {
      return { minX, minZ, maxX, maxZ };
    }
  }
  if (Array.isArray(raw.rect) && raw.rect.length >= 4) {
    const [minX, minZ, width, depth] = raw.rect.map(Number);
    if ([minX, minZ, width, depth].every(Number.isFinite) && width > 0 && depth > 0) {
      return { minX, minZ, maxX: minX + width, maxZ: minZ + depth };
    }
  }
  if (Array.isArray(raw.center) && Array.isArray(raw.size)) {
    const [x, z] = raw.center.map(Number), [width, depth] = raw.size.map(Number);
    if ([x, z, width, depth].every(Number.isFinite) && width > 0 && depth > 0) {
      return { minX: x - width * .5, minZ: z - depth * .5, maxX: x + width * .5, maxZ: z + depth * .5 };
    }
  }
  if (raw.center && raw.size && finite(raw.center.x) && finite(raw.center.y) && finite(raw.size.w) && finite(raw.size.d)) {
    const x = Number(raw.center.x), z = Number(raw.center.y), width = Number(raw.size.w), depth = Number(raw.size.d);
    return { minX: x - width * .5, minZ: z - depth * .5, maxX: x + width * .5, maxZ: z + depth * .5 };
  }
  return null;
}

function readRooms(course = {}) {
  const source = course.rooms || course.roomPlan?.rooms || course.roomPlan || course.layout?.rooms;
  if (!Array.isArray(source)) return [];
  return source.map((raw, index) => ({
    id: String(raw?.id || raw?.name || `room-${index + 1}`),
    bounds: asBounds(raw),
    raw,
  })).filter(room => room.bounds);
}

function worldAnchor(anchor) {
  if (!Array.isArray(anchor)) return null;
  const x = Number(anchor[0]), z = Number(anchor[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? { x: x * CELL, z: z * CELL } : null;
}

function roomContainsCell(room, x, z) {
  const b = room.bounds;
  return x + .5 >= b.minX && x + .5 < b.maxX && z + .5 >= b.minZ && z + .5 < b.maxZ;
}

function roomContainsPoint(room, x, z) {
  const b = room.bounds;
  return x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ;
}

function isCellWalkable(course, x, z) {
  if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0) return false;
  if (finite(course.w) && x >= Number(course.w)) return false;
  if (finite(course.h) && z >= Number(course.h)) return false;

  const blocked = course.blocks || course.dungeonCompiled?.coverBlocks;
  if (Array.isArray(blocked) && blocked.some(block => {
    const bx = Number(block?.x ?? block?.[0]), bz = Number(block?.y ?? block?.z ?? block?.[1]);
    return bx === x && bz === z;
  })) return false;

  const cells = course.cells || course.renderCells;
  const sides = Array.isArray(cells) ? cells[z * Number(course.w || 0) + x] : null;
  // A four-sided cell is a cover/solid cell in the dungeon compiler. Treating
  // it as empty prevents a mist card from sitting inside a wall or prop block.
  if (Array.isArray(sides) && sides.length >= 4 && sides.every(Boolean)) return false;
  return true;
}

function roomInteriorCandidates(course, rooms, rng) {
  const candidates = [];
  const cells = course.cells || course.renderCells;
  const width = Number(course.w || 0);
  for (const room of rooms) {
    const b = room.bounds;
    const minX = Math.ceil(b.minX), maxX = Math.floor(b.maxX - 1e-6);
    const minZ = Math.ceil(b.minZ), maxZ = Math.floor(b.maxZ - 1e-6);
    const roomCandidates = [];
    for (let z = minZ; z < maxZ; z += 1) {
      for (let x = minX; x < maxX; x += 1) {
        if (!isCellWalkable(course, x, z)) continue;
        if (course.dungeonCompiled?.reach && !course.dungeonCompiled.reach.has(`${x},${z}`)) continue;
        // Keep the source coordinate stable, but jitter within a cell so a
        // repeated floor plan does not produce a rigid checkerboard.
        const centerX = x + .5 + (rng() - .5) * .64;
        const centerZ = z + .5 + (rng() - .5) * .64;
        if (!roomContainsPoint(room, centerX, centerZ)) continue;
        const worldX = centerX * CELL, worldZ = centerZ * CELL;
        const roomMinX = b.minX * CELL, roomMaxX = b.maxX * CELL;
        const roomMinZ = b.minZ * CELL, roomMaxZ = b.maxZ * CELL;
        const edgeMargin = Math.min(worldX - roomMinX, roomMaxX - worldX, worldZ - roomMinZ, roomMaxZ - worldZ);
        // A patch stays fully inside the authored room. This is what keeps
        // transparent cards from peeking around a wall corner.
        if (edgeMargin < .85) continue;
        roomCandidates.push({
          x: worldX,
          z: worldZ,
          maxRadius: clamp(edgeMargin - .4, .7, 1.65),
          roomId: room.id,
          order: roomCandidates.length,
        });
      }
    }
    // A deterministic shuffle lets each room have quiet gaps while keeping
    // the same course identity visually stable across rebuilds.
    for (let i = roomCandidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [roomCandidates[i], roomCandidates[j]] = [roomCandidates[j], roomCandidates[i]];
    }
    candidates.push(...roomCandidates);
  }

  // If a non-dungeon course supplies no authored rooms, use its open cells as
  // a conservative fallback. The live campaign always takes the room path.
  if (!candidates.length && width > 0 && Number(course.h) > 0) {
    for (let z = 0; z < Number(course.h); z += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!isCellWalkable(course, x, z)) continue;
        candidates.push({ x: (x + .5) * CELL, z: (z + .5) * CELL, maxRadius: 1.15, roomId: 'fallback', order: candidates.length });
      }
    }
  }
  return candidates;
}

function chooseMistPatches(course, rooms, rng, options) {
  const candidates = roomInteriorCandidates(course, rooms, rng);
  if (!candidates.length) return [];
  const maxCount = Math.max(0, Math.floor(options.maxMistPatches));
  const density = clamp(Number(options.mistDensity) || DEFAULTS.mistDensity, .02, .42);
  const patches = [];
  const occupied = [];
  for (const candidate of candidates) {
    if (patches.length >= maxCount) break;
    if (rng() > density && patches.length > 0) continue;
    const tooClose = occupied.some(item => Math.hypot(item.x - candidate.x, item.z - candidate.z) < 2.35);
    if (tooClose) continue;
    const radius = clamp(.86 + rng() * .82, .72, candidate.maxRadius);
    patches.push({
      x: candidate.x,
      z: candidate.z,
      radiusX: radius * (.82 + rng() * .34),
      // The shader turns this into a low vertical billboard. Keep the base
      // footprint compact so neighboring wisps still read as separated gaps.
      radiusZ: .22 + rng() * .22,
      opacity: .55 + rng() * .45,
      phase: rng() * Math.PI * 2,
      rotation: rng() * Math.PI * 2,
      roomId: candidate.roomId,
    });
    occupied.push(candidate);
  }
  return patches;
}

function makeMistMaterial(options) {
  return new THREE.ShaderMaterial({
    name: 'AfterlifeGroundMistMaterial',
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: Number(options.mistOpacity) || DEFAULTS.mistOpacity },
      uColor: { value: new THREE.Color(options.mistColor ?? DEFAULTS.mistColor) },
      uMotion: { value: options.reducedMotion ? 0 : 1 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uMotion;
      attribute float aPhase;
      attribute float aOpacity;
      varying vec2 vUv;
      varying float vPhase;
      varying float vOpacity;
      varying vec3 vWorldPosition;
      void main() {
        // Read each instance's translation and scale, then billboard a low
        // vertical wisp in camera space. A raised wisp avoids the opaque
        // floor-print look of a horizontal quad while staying near ankle height.
        vec3 instanceCenter = vec3(0.0);
        float instanceWidth = 1.0;
        float instanceHeight = 1.0;
        #ifdef USE_INSTANCING
          instanceCenter = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          instanceWidth = length(instanceMatrix[0].xyz);
          instanceHeight = length(instanceMatrix[1].xyz);
        #endif
        vec2 local = position.xy;
        float sway = sin(uTime * .16 + aPhase + local.y * 1.7) * .08 * uMotion;
        local.x += sway * (1.0 - abs(local.y));
        float c = cos(aPhase), s = sin(aPhase);
        local = mat2(c, -s, s, c) * local;
        vec3 cameraRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
        vec3 cameraUp = normalize(vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]));
        vec3 worldOffset = cameraRight * local.x * instanceWidth + cameraUp * local.y * instanceHeight;
        vec4 worldPosition = modelMatrix * vec4(instanceCenter + worldOffset, 1.0);
        worldPosition.y += .06;
        vWorldPosition = worldPosition.xyz;
        vUv = uv;
        vPhase = aPhase;
        vOpacity = aOpacity;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uMotion;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying float vPhase;
      varying float vOpacity;
      varying vec3 vWorldPosition;
      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        float radius = length(vec2(centered.x, centered.y * 1.35));
        float edge = 1.0 - smoothstep(.34, 1.02, radius);
        float wave = sin(vUv.x * 10.7 + vPhase * 1.7 + uTime * .11 * uMotion)
          * sin(vUv.y * 8.1 - vPhase * 1.13 - uTime * .07 * uMotion);
        float breakup = mix(.48, 1.0, smoothstep(-.84, .82, wave));
        float nearFade = smoothstep(.72, 2.35, distance(cameraPosition.xz, vWorldPosition.xz));
        float alpha = edge * breakup * vOpacity * uOpacity * nearFade;
        if (alpha < .008) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}

function makeSpeckMaterial(options) {
  return new THREE.ShaderMaterial({
    name: 'AfterlifeColdSpeckMaterial',
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: options.reducedMotion ? .30 : .38 },
      uColor: { value: new THREE.Color(options.coldColor ?? DEFAULTS.coldColor) },
      uMotion: { value: options.reducedMotion ? 0 : 1 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uMotion;
      attribute float aPhase;
      attribute float aSize;
      attribute float aOpacity;
      attribute vec3 aLightPosition;
      attribute float aLightRadius;
      varying float vAlpha;
      void main() {
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        float t = uTime * uMotion;
        world.x += sin(t * .24 + aPhase) * .055;
        world.y += sin(t * .41 + aPhase * 1.7) * .045;
        world.z += cos(t * .21 + aPhase * .8) * .055;
        float distanceToLight = distance(world.xz, aLightPosition.xz) + abs(world.y - aLightPosition.y) * .2;
        float lightWeight = 1.0 - smoothstep(aLightRadius * .35, aLightRadius, distanceToLight);
        float cameraWeight = 1.0 - smoothstep(11.0, 24.0, distance(cameraPosition, world));
        vAlpha = aOpacity * lightWeight * cameraWeight;
        vec4 viewPosition = viewMatrix * vec4(world, 1.0);
        // Specks are dust, not floating orbs. Keep their raster footprint
        // explicitly within a one-to-three-pixel range at every depth.
        gl_PointSize = clamp(aSize * (16.0 / max(1.0, -viewPosition.z)), .7, 2.8);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 centered = gl_PointCoord * 2.0 - 1.0;
        float disc = 1.0 - smoothstep(.28, 1.0, length(centered));
        float alpha = disc * vAlpha * uOpacity;
        if (alpha < .006) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}

function makePracticalGlowMaterial(course, options) {
  const style = course?.artDirection?.lightFixture;
  const color = style === 'surgical-bowl' ? 0x91c8c2
    : style === 'buried-ember' ? 0xee4b35
    : style === 'bone-censer' ? 0xd8aa72 : 0xffb864;
  return new THREE.ShaderMaterial({
    name: 'AfterlifePracticalGlowMaterial',
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: options.reducedMotion ? 0 : 1 },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uMotion;
      attribute float aPhase;
      attribute float aSize;
      attribute float aMote;
      varying float vMote;
      varying float vAlpha;
      void main() {
        float time = uTime * uMotion;
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        float life = fract(time * (.12 + aPhase * .007) + aPhase);
        if (aMote > .5) {
          world.x += sin(aPhase * 13.1 + life * 5.2) * .22;
          world.y += life * .95;
          world.z += cos(aPhase * 9.7 + life * 4.1) * .22;
        }
        float cameraDistance = distance(cameraPosition, world);
        float distanceFade = (1.0 - smoothstep(22.0, 56.0, cameraDistance))
          * smoothstep(1.2, 3.0, cameraDistance);
        vMote = aMote;
        vAlpha = distanceFade * (aMote > .5
          ? (1.0 - smoothstep(.45, 1.0, life)) * uMotion
          : .77 + .08 * sin(time * 2.3 + aPhase * 13.0));
        vec4 viewPosition = viewMatrix * vec4(world, 1.0);
        gl_PointSize = clamp(aSize * (18.0 / max(1.0, -viewPosition.z)), 1.0, aMote > .5 ? 4.2 : 52.0);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vMote;
      varying float vAlpha;
      void main() {
        float radius = length(gl_PointCoord * 2.0 - 1.0);
        float soft = 1.0 - smoothstep(vMote > .5 ? .12 : .06, 1.0, radius);
        float core = 1.0 - smoothstep(.02, .32, radius);
        float alpha = soft * vAlpha * (vMote > .5 ? .49 : .29);
        if (alpha < .005) discard;
        gl_FragColor = vec4(mix(uColor, vec3(1.0, .88, .68), core * (vMote > .5 ? .65 : .12)), alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function makeBeamMaterial(options) {
  const material = new THREE.MeshBasicMaterial({
    name: 'AfterlifeColdBeamMaterial',
    color: options.coldColor ?? DEFAULTS.coldColor,
    transparent: true,
    opacity: Number(options.beamOpacity) || DEFAULTS.beamOpacity,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
  material.userData.baseOpacity = material.opacity;
  return material;
}

function lightWorldY(course) {
  return course?.artDirection?.lightFixture === 'buried-ember' ? .48 : 3.55;
}

function roomForAnchor(rooms, anchor) {
  if (!anchor) return null;
  const cellX = Number(anchor[0]), cellZ = Number(anchor[1]);
  return rooms.find(room => roomContainsPoint(room, cellX, cellZ)) || null;
}

function readColdSources(course, rooms, rng, options) {
  const lights = Array.isArray(course?.lights) ? course.lights : [];
  const sources = [];
  for (const light of lights) {
    const point = worldAnchor(light?.anchor);
    if (!point || !roomForAnchor(rooms, light.anchor)) continue;
    const intensity = clamp(Number(light.intensity) || 1, .4, 5);
    sources.push({
      x: point.x,
      y: lightWorldY(course),
      z: point.z,
      radius: clamp(2.8 + intensity * .52, 3.0, 5.4),
      intensity,
      role: String(light.role || ''),
      order: sources.length,
    });
  }
  // Deterministically prioritize stronger practicals, then use authored order
  // as the stable tie breaker. This prevents a different room array ordering
  // from moving the visible cold pockets around a course.
  sources.sort((a, b) => (b.intensity - a.intensity) || (a.order - b.order));
  const sourceLimit = options.mobile ? 6 : 10;
  return sources.slice(0, sourceLimit).map(source => ({ ...source, phase: rng() * Math.PI * 2 }));
}

function makeSpecks(sources, rooms, rng, options) {
  const limit = Math.max(0, Math.floor(options.maxSpecks));
  if (!sources.length || !limit) return [];
  const perSource = Math.max(2, Math.ceil(limit / sources.length));
  const specks = [];
  for (const source of sources) {
    const sourceRoom = rooms.find(room => roomContainsPoint(room, source.x / CELL, source.z / CELL));
    if (!sourceRoom) continue;
    const bounds = sourceRoom.bounds;
    for (let i = 0; i < perSource && specks.length < limit; i += 1) {
      const radius = Math.min(source.radius * .72, 2.15);
      const angle = rng() * Math.PI * 2;
      const distance = Math.sqrt(rng()) * radius;
      const x = source.x + Math.cos(angle) * distance;
      const z = source.z + Math.sin(angle) * distance;
      const cellX = x / CELL, cellZ = z / CELL;
      if (!roomContainsPoint(sourceRoom, cellX, cellZ)) continue;
      if (!isCellWalkable({ ...options.course, cells: options.course.cells, blocks: options.course.blocks, w: options.course.w, h: options.course.h }, Math.floor(cellX), Math.floor(cellZ))) continue;
      const y = clamp(source.y - 1.35 + rng() * 1.5, .28, 3.8);
      specks.push({
        x, y, z,
        phase: rng() * Math.PI * 2,
        size: .65 + rng() * .6,
        opacity: .42 + rng() * .48,
        lightX: source.x,
        lightY: source.y,
        lightZ: source.z,
        lightRadius: source.radius,
      });
    }
  }
  return specks;
}

function makePracticalGlowPoints(course, sources, rng, options) {
  if (!sources.length) return [];
  const style = course?.artDirection?.lightFixture;
  const fixtureY = {
    'caged-amber': 4.06, 'surgical-bowl': 3.78,
    'bone-censer': 3.88, 'bell-censer': 3.78,
    'buried-ember': .32,
  }[style];
  if (!Number.isFinite(fixtureY)) return [];
  const points = [];
  const limit = Math.max(0, Math.floor(options.maxEmberMotes));
  const perSource = Math.min(5, Math.ceil(limit / sources.length));
  let moteCount = 0;
  for (const source of sources) {
    // The hanging entry cue has no matching fixture: its light comes from a
    // nearby tunnel rib. A halo there would read as a floating orange orb.
    if (source.role === 'entry' && style !== 'buried-ember') continue;
    points.push({ x: source.x, y: fixtureY, z: source.z,
      phase: source.phase, size: style === 'buried-ember' ? 33 : 29, mote: 0 });
    for (let i = 0; i < perSource && moteCount < limit; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = .12 + rng() * .28;
      points.push({ x: source.x + Math.cos(angle) * radius,
        y: fixtureY + rng() * .46,
        z: source.z + Math.sin(angle) * radius,
        phase: rng(), size: 1.5 + rng() * 1.3, mote: 1 });
      moteCount += 1;
    }
  }
  return points;
}

/**
 * Bounded, reusable afterlife atmosphere contract:
 *
 *   const atmosphere = new AfterlifeAtmosphere(worldRoot, course, options);
 *   atmosphere.update(run, nowMs, camera, options);
 *   atmosphere.diagnostics();
 *   atmosphere.dispose();
 *
 * `nowMs` may be milliseconds (the renderer's normal path) or seconds. The
 * module owns only its internal group and resources; it does not own scene.fog,
 * lights, gameplay state, or UI.
 */
export class AfterlifeAtmosphere {
  constructor(root, course = {}, options = {}) {
    this.parent = root && typeof root.add === 'function' ? root : null;
    this.options = { ...DEFAULTS, ...options };
    if (this.options.mobile || this.options.quality === 'low') {
      this.options.maxMistPatches = Math.min(this.options.maxMistPatches, 20);
      this.options.maxSpecks = Math.min(this.options.maxSpecks, 24);
      this.options.maxEmberMotes = Math.min(this.options.maxEmberMotes, 18);
      this.options.maxBeams = Math.min(this.options.maxBeams, 2);
    }
    this.root = new THREE.Group();
    this.root.name = 'AfterlifeAtmosphere';
    this.root.userData.atmosphereLayer = 'forsaken-afterlife';
    this.parent?.add(this.root);
    this.course = course || {};
    this.seed = hashString(this.options.seed ?? this.course.id ?? this.course.sectorId ?? this.course.index ?? 'afterlife');
    this._disposed = false;
    this._build(this.course);
  }

  _build(course = {}) {
    const rng = makeRng(this.seed);
    const rooms = readRooms(course);
    const patches = chooseMistPatches(course, rooms, rng, this.options);
    const sources = readColdSources(course, rooms, rng, this.options);
    const specks = makeSpecks(sources, rooms, rng, { ...this.options, course });
    const practicalPoints = makePracticalGlowPoints(course, sources, rng, this.options);
    this._rooms = rooms;
    this._patches = patches;
    this._sources = sources;
    this._specks = specks;
    this._practicalPoints = practicalPoints;
    this._mistMaterial = makeMistMaterial(this.options);
    this._beamMaterial = makeBeamMaterial(this.options);
    this._mistGeometry = new THREE.PlaneGeometry(2, 2, 1, 1);
    const patchCount = Math.max(1, patches.length);
    const phase = new Float32Array(patchCount), opacity = new Float32Array(patchCount);
    const mist = new THREE.InstancedMesh(this._mistGeometry, this._mistMaterial, patchCount);
    mist.name = 'AfterlifeGroundMist';
    mist.count = patches.length;
    mist.frustumCulled = false;
    mist.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
    patches.forEach((patch, index) => {
      phase[index] = patch.phase;
      opacity[index] = patch.opacity;
      position.set(patch.x, .035, patch.z);
      euler.set(0, patch.rotation, 0);
      quaternion.setFromEuler(euler);
      scale.set(patch.radiusX, patch.radiusZ, 1);
      matrix.compose(position, quaternion, scale);
      mist.setMatrixAt(index, matrix);
    });
    mist.instanceMatrix.needsUpdate = true;
    mist.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    mist.geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacity, 1));
    mist.renderOrder = 4;
    this._mist = mist;
    this.root.add(mist);

    if (specks.length) {
      const positions = new Float32Array(specks.length * 3);
      const phases = new Float32Array(specks.length), sizes = new Float32Array(specks.length);
      const opacities = new Float32Array(specks.length), lightPositions = new Float32Array(specks.length * 3), lightRadii = new Float32Array(specks.length);
      specks.forEach((speck, index) => {
        const i3 = index * 3;
        positions[i3] = speck.x; positions[i3 + 1] = speck.y; positions[i3 + 2] = speck.z;
        phases[index] = speck.phase; sizes[index] = speck.size; opacities[index] = speck.opacity;
        lightPositions[i3] = speck.lightX; lightPositions[i3 + 1] = speck.lightY; lightPositions[i3 + 2] = speck.lightZ;
        lightRadii[index] = speck.lightRadius;
      });
      this._speckGeometry = new THREE.BufferGeometry();
      this._speckGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      this._speckGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
      this._speckGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
      this._speckGeometry.setAttribute('aOpacity', new THREE.Float32BufferAttribute(opacities, 1));
      this._speckGeometry.setAttribute('aLightPosition', new THREE.Float32BufferAttribute(lightPositions, 3));
      this._speckGeometry.setAttribute('aLightRadius', new THREE.Float32BufferAttribute(lightRadii, 1));
      this._speckGeometry.computeBoundingSphere();
      this._speckMaterial = makeSpeckMaterial(this.options);
      this._specksObject = new THREE.Points(this._speckGeometry, this._speckMaterial);
      this._specksObject.name = 'AfterlifeColdLightSpecks';
      this._specksObject.frustumCulled = false;
      this._specksObject.renderOrder = 5;
      this.root.add(this._specksObject);
    } else {
      this._speckGeometry = null;
      this._speckMaterial = null;
      this._specksObject = null;
    }

    if (practicalPoints.length) {
      const positions = new Float32Array(practicalPoints.length * 3);
      const phases = new Float32Array(practicalPoints.length);
      const sizes = new Float32Array(practicalPoints.length);
      const motes = new Float32Array(practicalPoints.length);
      practicalPoints.forEach((point, index) => {
        positions.set([point.x, point.y, point.z], index * 3);
        phases[index] = point.phase;
        sizes[index] = point.size;
        motes[index] = point.mote;
      });
      this._practicalGeometry = new THREE.BufferGeometry();
      this._practicalGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      this._practicalGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
      this._practicalGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
      this._practicalGeometry.setAttribute('aMote', new THREE.Float32BufferAttribute(motes, 1));
      this._practicalGeometry.computeBoundingSphere();
      this._practicalMaterial = makePracticalGlowMaterial(course, this.options);
      this._practicalObject = new THREE.Points(this._practicalGeometry, this._practicalMaterial);
      this._practicalObject.name = 'AfterlifePracticalGlow';
      this._practicalObject.frustumCulled = false;
      this._practicalObject.renderOrder = 5;
      this.root.add(this._practicalObject);
    } else {
      this._practicalGeometry = null;
      this._practicalMaterial = null;
      this._practicalObject = null;
    }

    this._beams = [];
    this._beamObject = null;
    if (this.options.enableBeams !== false && sources.length && this.options.maxBeams > 0) {
      const beamGeometry = new THREE.CylinderGeometry(.22, 1.55, 3.55, 12, 1, true);
      beamGeometry.userData.sharedAsset = false;
      const beamSources = sources.filter(source => source.intensity >= 2.7).slice(0, Math.floor(this.options.maxBeams));
      const beamMesh = new THREE.InstancedMesh(beamGeometry, this._beamMaterial, Math.max(1, beamSources.length));
      beamMesh.name = 'AfterlifeColdBeams';
      beamMesh.count = beamSources.length;
      beamMesh.frustumCulled = false;
      beamMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      const beamMatrix = new THREE.Matrix4(), beamPosition = new THREE.Vector3(), beamScale = new THREE.Vector3();
      const beamQuaternion = new THREE.Quaternion();
      beamSources.forEach((source, index) => {
        beamPosition.set(source.x, 1.8, source.z);
        beamScale.setScalar(clamp(.78 + source.intensity * .06, .84, 1.12));
        beamMatrix.compose(beamPosition, beamQuaternion, beamScale);
        beamMesh.setMatrixAt(index, beamMatrix);
        this._beams.push(source);
      });
      beamMesh.instanceMatrix.needsUpdate = true;
      beamMesh.renderOrder = 3;
      this._beamObject = beamMesh;
      this.root.add(beamMesh);
      this._beamGeometry = beamGeometry;
    } else {
      this._beamGeometry = null;
    }
    this.root.visible = true;
    this._diagnostic = {
      name: 'AfterlifeAtmosphere',
      seed: this.seed,
      courseId: String(course?.id ?? course?.sectorId ?? course?.index ?? 'afterlife'),
      bounded: true,
      coordinateCellMeters: CELL,
      floorY: 0,
      roomCount: rooms.length,
      roomIds: rooms.map(room => room.id),
      mistPatches: patches.length,
      coldSources: sources.length,
      specks: specks.length,
      practicalGlowPoints: practicalPoints.length,
      beams: this._beams.length,
      drawCalls: 1 + (specks.length ? 1 : 0) + (practicalPoints.length ? 1 : 0) + (this._beams.length ? 1 : 0),
      reducedMotion: !!this.options.reducedMotion,
      mobileBudget: !!(this.options.mobile || this.options.quality === 'low'),
      noSceneFogMutation: true,
      noDynamicLights: true,
      disposed: false,
    };
  }

  _clear() {
    this.root.clear();
    this._mistGeometry?.dispose?.();
    this._speckGeometry?.dispose?.();
    this._practicalGeometry?.dispose?.();
    this._beamGeometry?.dispose?.();
    this._mistMaterial?.dispose?.();
    this._speckMaterial?.dispose?.();
    this._practicalMaterial?.dispose?.();
    this._beamMaterial?.dispose?.();
    this._mistGeometry = null;
    this._speckGeometry = null;
    this._practicalGeometry = null;
    this._beamGeometry = null;
    this._mistMaterial = null;
    this._speckMaterial = null;
    this._practicalMaterial = null;
    this._beamMaterial = null;
    this._mist = null;
    this._specksObject = null;
    this._practicalObject = null;
    this._beams = [];
    this._beamObject = null;
  }

  update(run = null, now = 0, camera = null, options = {}) {
    if (this._disposed) return this;
    const nextCourse = run?.course || options.course || this.course;
    if (nextCourse && nextCourse !== this.course) {
      this._clear();
      this.course = nextCourse;
      this.seed = hashString(options.seed ?? this.options.seed ?? nextCourse.id ?? nextCourse.sectorId ?? nextCourse.index ?? 'afterlife');
      this._build(nextCourse);
    }
    const reducedMotion = options.reducedMotion ?? run?.settings?.reducedMotion ?? this.options.reducedMotion;
    const time = Number(now) > 100 ? Number(now) * .001 : Number(now) || 0;
    if (this._mistMaterial) {
      this._mistMaterial.uniforms.uTime.value = reducedMotion ? 0 : time;
      this._mistMaterial.uniforms.uMotion.value = reducedMotion ? 0 : 1;
    }
    if (this._speckMaterial) {
      this._speckMaterial.uniforms.uTime.value = reducedMotion ? 0 : time;
      this._speckMaterial.uniforms.uMotion.value = reducedMotion ? 0 : 1;
      this._speckMaterial.uniforms.uOpacity.value = reducedMotion ? .30 : .38;
    }
    if (this._practicalMaterial) {
      this._practicalMaterial.uniforms.uTime.value = reducedMotion ? 0 : time;
      this._practicalMaterial.uniforms.uMotion.value = reducedMotion ? 0 : 1;
    }
    if (this._beamMaterial) {
      const base = this._beamMaterial.userData.baseOpacity ?? DEFAULTS.beamOpacity;
      this._beamMaterial.opacity = reducedMotion ? base : base * (.88 + Math.sin(time * .48 + this.seed * .00001) * .07);
    }
    if (this._diagnostic) this._diagnostic.reducedMotion = !!reducedMotion;
    // The camera argument is accepted as part of the integration contract;
    // near-plane and distance fades are evaluated in the shaders using the
    // renderer's cameraPosition uniform, so no per-frame CPU work is needed.
    void camera;
    return this;
  }

  diagnostics() {
    return { ...(this._diagnostic || { name: 'AfterlifeAtmosphere', disposed: this._disposed }) };
  }

  dispose() {
    if (this._disposed) return;
    this._clear();
    this.root.removeFromParent();
    this._disposed = true;
    if (this._diagnostic) this._diagnostic.disposed = true;
  }
}

export function createAfterlifeAtmosphere(root, course = {}, options = {}) {
  return new AfterlifeAtmosphere(root, course, options);
}

export default AfterlifeAtmosphere;
