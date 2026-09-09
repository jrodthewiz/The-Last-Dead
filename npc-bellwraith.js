import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
import {applyBellwraithVariant,resolveBellwraithVariant} from './enemy-variation.js';

// Bellwraith is a standalone stylized creature factory. It deliberately keeps
// the same animate(root, enemy, now, seed) shape as the imported Warden.
// Coordinate contract: +Y up, +Z is the visible face / attack direction.
const V = p => new THREE.Vector3(...p);

function sweep(points, radii, sides = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(V));
  const steps = Math.max(8, points.length * 4);
  const frames = curve.computeFrenetFrames(steps, false);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const q = t * (radii.length - 1);
    const a = Math.min(radii.length - 2, Math.floor(q));
    const r = THREE.MathUtils.lerp(radii[a], radii[a + 1], q - a);
    const p = curve.getPointAt(t);
    for (let j = 0; j <= sides; j++) {
      const ang = j / sides * Math.PI * 2;
      const v = p.clone()
        .addScaledVector(frames.normals[i], Math.cos(ang) * r)
        .addScaledVector(frames.binormals[i], Math.sin(ang) * r);
      pos.push(v.x, v.y, v.z);
      uv.push(j / sides, t);
      if (i < steps && j < sides) {
        const n = i * (sides + 1) + j;
        idx.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function faceProfile(points, depth, bevel = .01, holes = []) {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
  for (const h of holes) {
    const path = new THREE.Path();
    path.absellipse(h[0], h[1], h[2], h[3], 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, steps: 1, curveSegments: 16
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

function compactGroup(group) {
  const buckets = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh || child.userData.keepSeparate) continue;
    child.updateMatrix();
    const source = child.geometry.clone();
    const geometry = source.index ? source.toNonIndexed() : source;
    geometry.applyMatrix4(child.matrix);
    for (const key of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'uv'].includes(key)) geometry.deleteAttribute(key);
    }
    const list = buckets.get(child.material) || [];
    list.push(geometry);
    buckets.set(child.material, list);
    group.remove(child);
    if (geometry !== source) source.dispose();
    child.geometry.dispose();
  }
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = group.name + '-merged-' + material.uuid.slice(0, 4);
    mesh.userData.explodeWithParent = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function makeSurfaceMaps(seed = 41) {
  const size = 64;
  const albedo = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const hash = (x, y) => {
    const v = Math.sin((x + seed) * 12.9898 + (y - seed) * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const fine = hash(x, y);
      const patina = Math.sin(x * .11 + Math.sin(y * .08) * 3.4) * .5 + .5;
      const streak = Math.sin((x * .15 + y) * .23) * .5 + .5;
      const pit = Math.max(0, fine - .74) * 3.8;
      const value = Math.max(38, Math.min(255, 208 + patina * 29 + streak * 8 - pit * 112));
      const cavity = Math.max(18, Math.min(255, 178 + patina * 35 - pit * 126));
      const relief = Math.max(0, Math.min(255, 128 + (patina - .5) * 78 + (fine - .5) * 18 - pit * 72));
      albedo[i] = value; albedo[i + 1] = Math.max(0, value - 10); albedo[i + 2] = Math.max(0, value - 22); albedo[i + 3] = 255;
      roughness[i] = cavity; roughness[i + 1] = cavity; roughness[i + 2] = cavity; roughness[i + 3] = 255;
      bump[i] = relief; bump[i + 1] = relief; bump[i + 2] = relief; bump[i + 3] = 255;
    }
  }
  const texture = (data, colorSpace = false) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.userData.sharedAsset = true;
    if (colorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };
  return {albedo: texture(albedo, true), roughness: texture(roughness), bump: texture(bump)};
}
const surfaceMapCache = new Map();
function getSurfaceMaps(seed = 41) {
  const key = Number(seed) || 41;
  let maps = surfaceMapCache.get(key);
  if (!maps) {
    maps = makeSurfaceMaps(key);
    surfaceMapCache.set(key, maps);
  }
  return maps;
}

function applySurfaceMaps(materials, maps) {
  for (const key of ['bell', 'bellEdge', 'bone', 'boneDark', 'membrane', 'chain']) {
    const material = materials[key];
    if (!material) continue;
    material.map = maps.albedo;
    material.roughnessMap = maps.roughness;
    material.bumpMap = maps.bump;
    material.bumpScale = key === 'bone' ? .02 : key === 'membrane' ? .012 : .008;
    material.needsUpdate = true;
  }
}

function addWearColors(root, seed = 47) {
  root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.material?.map || !mesh.geometry.attributes.position) return;
    const position = mesh.geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const n = Math.sin((i + seed) * 12.9898) * .5 + .5;
      const v = .8 + n * .2;
      colors[i * 3] = v;
      colors[i * 3 + 1] = v * .96;
      colors[i * 3 + 2] = v * .88;
    }
    mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    mesh.material.vertexColors = true;
    mesh.material.needsUpdate = true;
  });
}

function materials() {
  const mats = {
    bell: new THREE.MeshStandardMaterial({color: 0x5a4032, roughness: .5, metalness: .72, side: THREE.DoubleSide}),
    bellEdge: new THREE.MeshStandardMaterial({color: 0xa36d3f, roughness: .38, metalness: .72}),
    bone: new THREE.MeshStandardMaterial({color: 0xd4c8a8, roughness: .94, metalness: 0}),
    boneDark: new THREE.MeshStandardMaterial({color: 0x5e4a3b, roughness: .98, metalness: 0}),
    void: new THREE.MeshStandardMaterial({color: 0x030307, roughness: 1, metalness: 0, side: THREE.DoubleSide}),
    membrane: new THREE.MeshStandardMaterial({
      color: 0x34131d, roughness: .9, metalness: 0, side: THREE.DoubleSide,
      transparent: true, opacity: .88
    }),
    ember: new THREE.MeshStandardMaterial({
      color: 0xff244d, emissive: 0xff0b3f, emissiveIntensity: 2.6,
      roughness: .25, metalness: .15
    }),
    acid: new THREE.MeshStandardMaterial({
      color: 0x8fdb58, emissive: 0x315f14, emissiveIntensity: 1.5,
      roughness: .55, metalness: .1
    }),
    chain: new THREE.MeshStandardMaterial({color: 0x84756f, roughness: .61, metalness: .7})
  };
  for (const [key, material] of Object.entries(mats)) material.userData.bellMaterialKey = key;
  return mats;
}

// One immutable scene template per authored family. Object3D.clone(true)
// shares BufferGeometry while giving each actor its own transform hierarchy;
// instance materials are cloned later so hit flashes remain isolated.
const bellTemplateCache = new Map();
const BELL_TEMPLATE_KEYS = ['bellwraith', 'bellwraithEcho', 'rustBell', 'ivoryBell'];

function ensureBellwraithTemplate(appearance) {
  let cached = bellTemplateCache.get(appearance.key);
  if (cached) return cached;
  const template = buildBellwraithTemplate({variant: appearance.key});
  const source = template.userData.bellwraith;
  const metrics = {
    renderScale: source.renderScale,
    floorOffset: source.floorOffset,
    visualSize: source.visualSize,
    visualBounds: source.visualBounds,
  };
  // These fields contain live Object3D references and closures. Remove them
  // before cloning because Three.js serializes userData during clone().
  delete template.userData.sculptRuntime;
  delete template.userData.bellwraith;
  template.userData.bellTemplateMetrics = metrics;
  const geometries = new Set();
  template.traverse(object => {
    if (object.geometry) {
      object.geometry.userData.sharedAsset = true;
      geometries.add(object.geometry);
    }
  });
  cached = {template, metrics, geometryCount: geometries.size, profile: appearance};
  bellTemplateCache.set(appearance.key, cached);
  return cached;
}

export function warmBellwraithVariants() {
  for (const key of BELL_TEMPLATE_KEYS) ensureBellwraithTemplate(resolveBellwraithVariant(key));
  return getBellwraithCacheStats();
}

export function getBellwraithCacheStats() {
  let templates = 0, geometries = 0, meshes = 0;
  for (const cached of bellTemplateCache.values()) {
    templates++;
    geometries += cached.geometryCount;
    cached.template.traverse(object => { if (object.isMesh) meshes++; });
  }
  return {templates, geometries, meshes, profiles: BELL_TEMPLATE_KEYS.length};
}

function cloneBellwraithMaterials(root) {
  const clones = new Map();
  const materialsByKey = {};
  root.traverse(object => {
    if (!object.isMesh || !object.material) return;
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const instanceMaterials = sourceMaterials.map(source => {
      let material = clones.get(source);
      if (!material) {
        material = source.clone();
        clones.set(source, material);
      }
      const key = material.userData.bellMaterialKey;
      if (key) materialsByKey[key] = material;
      return material;
    });
    object.material = Array.isArray(object.material) ? instanceMaterials : instanceMaterials[0];
  });
  return materialsByKey;
}

function hydrateBellwraith(root, appearance, options, cached) {
  const parts = {};
  for (const name of [
    'bell-body', 'bell-crown', 'rune-ring', 'clapper', 'skull-face',
    'nasal-cavity', 'brow-ridge', 'teeth', 'crown-horns', 'skull-hanger',
    'rib-basket', 'bell-arms', 'left-arm', 'left-hand', 'right-arm',
    'right-hand', 'torn-membranes', 'hanging-chains', 'hover-ring',
  ]) parts[name] = root.getObjectByName(name);
  const mats = cloneBellwraithMaterials(root);
  applyBellwraithVariant(mats, appearance);
  const body = parts['bell-body'];
  const face = parts['skull-face'];
  const arms = parts['bell-arms'];
  const hover = parts['hover-ring'];
  const ring = hover?.getObjectByName('hover-sigil');
  const sockets = {
    pulseOrigin: root.getObjectByName('pulseOrigin'),
    attackOrigin: root.getObjectByName('attackOrigin'),
    leftHandSocket: root.getObjectByName('leftHandSocket'),
    rightHandSocket: root.getObjectByName('rightHandSocket'),
    hoverAnchor: root.getObjectByName('hoverAnchor'),
    deathBurst: root.getObjectByName('deathBurst'),
  };
  const faceEmbers = [];
  face?.traverse(child => {
    const material = child.isMesh ? child.material : null;
    if (child.isMesh && material?.userData?.bellMaterialKey === 'ember') faceEmbers.push(child);
  });
  const floatParts = [body, face, parts['rib-basket'], arms, parts['torn-membranes'], parts['hanging-chains']].filter(Boolean);
  for (const part of Object.values(parts)) if (part) part.userData.basePosition = part.position.toArray();
  const home = new Map();
  const explode = amount => {
    for (const p of Object.values(parts)) {
      if (!p) continue;
      if (!home.has(p)) home.set(p, p.position.clone());
      const dir = new THREE.Vector3(Math.sin(p.position.z * 13) * .1, .1 + Math.abs(p.position.y) * .12, .08).normalize();
      p.position.copy(home.get(p)).addScaledVector(dir, amount * .08);
    }
  };
  const metrics = cached.metrics;
  const textures = getSurfaceMaps(appearance.surfaceSeed);
  root.userData.sculptRuntime = {
    parts, sockets, materials: mats, textures,
    collider: {type: 'capsule', size: [...metrics.visualSize], floorOffset: metrics.floorOffset},
    explode,
    pick(raycaster) {
      const hit = raycaster.intersectObject(root, true)[0];
      return hit?.object?.parent?.name || hit?.object?.name || null;
    }
  };
  root.userData.bellwraith = {
    kind: 'bellwraith', variant: appearance.key, appearance,
    parts, sockets, materials: mats, textures, body, arms, hover, ring, faceEmbers, floatParts,
    leftArm: parts['left-arm'], rightArm: parts['right-arm'],
    deathAt: null, lastNow: 0, phase: options.phase || 0,
    renderScale: metrics.renderScale, floorOffset: metrics.floorOffset,
    visualSize: [...metrics.visualSize], visualBounds: metrics.visualBounds,
  };
  return root;
}

function buildBellwraithTemplate(options = {}) {
  const root = new THREE.Group();
  root.name = 'Bellwraith';
  const parts = {};
  const mats = materials();
  const appearance = resolveBellwraithVariant(options.variant, options.phase || 0);
  const textures = getSurfaceMaps(appearance.surfaceSeed);
  applySurfaceMaps(mats, textures);
  applyBellwraithVariant(mats, appearance);
  const part = (name, parent = root) => {
    const g = new THREE.Group();
    g.name = name;
    g.userData.explodeWithParent = true;
    parent.add(g);
    parts[name] = g;
    return g;
  };
  const add = (parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], name = '') => {
    const mesh = new THREE.Mesh(geometry, mats[material]);
    mesh.name = name || (parent.name + '-surface-' + parent.children.length);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.userData.explodeWithParent = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const body = part('bell-body');
  const bellProfile = [
    // Lathe points run lip-to-crown so the outward normals face the review
    // camera; the lower lip stays broad while the crown is short and rounded.
    new THREE.Vector2(.525, -.45), new THREE.Vector2(.515, -.4), new THREE.Vector2(.48, -.3),
    new THREE.Vector2(.43, -.16), new THREE.Vector2(.36, .0), new THREE.Vector2(.28, .15),
    new THREE.Vector2(.2, .27), new THREE.Vector2(.14, .35), new THREE.Vector2(.1, .39)
  ];
  // The profile stays narrow at the crown and opens continuously to a thick
  // lip, leaving the underside open for the hanging skull and clapper.
  add(body, new THREE.LatheGeometry(bellProfile, 28), 'bell', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'bell-shell');
  add(body, new THREE.TorusGeometry(.525, .045, 9, 32), 'bellEdge', [0, -.49, 0], [1, 1, 1], [Math.PI / 2, 0, 0], 'bell-rim');
  add(body, new THREE.TorusGeometry(.47, .022, 7, 28), 'bellEdge', [0, -.29, 0], [1, 1, 1], [Math.PI / 2, 0, 0], 'bell-shoulder');
  add(body, new THREE.RingGeometry(.36, .49, 32, 1), 'void', [0, -.47, 0], [1, 1, 1], [Math.PI / 2, 0, 0], 'bell-mouth');
  for (const band of [[.3, .18], [.06, .34], [-.2, .46]]) {
    add(body, new THREE.TorusGeometry(band[1], .011, 6, 28), 'bellEdge', [0, band[0], 0], [1, 1, 1], [Math.PI / 2, 0, 0], 'bell-band-' + band[0]);
  }
  const crown = part('bell-crown');
  for (const [side, height, front] of [[-1, .68, .02], [0, .8, .07], [1, .68, .02]]) {
    const sx = side * .2;
    add(crown, sweep([[sx, .29, front], [sx + side * .06, .43, front - .01], [sx + side * .11, .57, front], [sx + side * .09, height, front + .04]], [.052, .047, .031, .004], 9), 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'bell-crown-horn-' + side);
  }
  const runeRing = part('rune-ring', body);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const x = Math.cos(a) * .386, z = Math.sin(a) * .386;
    add(runeRing, new THREE.BoxGeometry(.045, .012, .018), 'acid', [x, -.11, z], [1, 1, 1], [0, -a, 0], 'rune-' + i);
  }
  const clapper = part('clapper', body);
  add(clapper, new THREE.SphereGeometry(.095, 12, 8), 'boneDark', [0, -.58, 0], [1, 1, .85], [0, 0, 0], 'clapper-ball');
  add(clapper, sweep([[0, .08, 0], [0, -.1, 0], [0, -.34, 0], [0, -.5, 0]], [.014, .014, .012, .008], 7), 'chain', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'clapper-chain');

  const face = part('skull-face');
  // Keep the skull below the lower bell lip so the face reads in the front
  // and three-quarter views instead of disappearing inside the shell.
  // The review/front and in-game camera look down +Z; keeping the skull on
  // that face makes the hanging mask readable outside the open bell mouth.
  face.position.set(0, -.62, .44);
  face.scale.setScalar(1.08);
  const contour = [
    [-.2, -.02], [-.19, .1], [-.13, .18], [-.07, .22], [0, .24],
    [.07, .22], [.13, .18], [.19, .1], [.2, -.02],
    [.11, -.11], [.05, -.08], [-.05, -.08], [-.11, -.11]
  ];
  add(face, faceProfile(contour, .1, .012, [[-.09, .085, .052, .034], [.09, .085, .052, .034]]), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'face-plate');
  for (const side of [-1, 1]) {
    add(face, new THREE.SphereGeometry(1, 14, 9), 'void', [side * .09, .085, .061], [.052, .035, .026], [0, 0, 0], 'eye-socket-' + side);
    add(face, new THREE.SphereGeometry(1, 11, 8), 'ember', [side * .09, .085, .082], [.023, .015, .012], [0, 0, 0], 'eye-ember-' + side);
  }
  const nasal = part('nasal-cavity', face);
  add(nasal, faceProfile([[-.025, .045], [.025, .045], [.038, -.01], [0, -.052], [-.038, -.01]], .012, .002), 'void', [0, -.005, .07], [1, 1, 1], [0, 0, 0], 'nasal-cavity');
  const brow = part('brow-ridge', face);
  for (const side of [-1, 1]) {
    add(brow, sweep([[side * .15, .15, .055], [side * .095, .17, .075], [side * .03, .135, .075]], [.018, .024, .012], 7), 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'brow-' + side);
  }
  const mouth = part('teeth', face);
  add(mouth, sweep([[-.13, -.06, -.06], [-.08, -.14, -.07], [0, -.17, -.075], [.08, -.14, -.07], [.13, -.06, -.06]], [.019, .022, .023, .022, .019], 7), 'boneDark');
  for (let i = 0; i < 7; i++) add(mouth, new THREE.ConeGeometry(.012, .06, 5), 'bone', [(i - 3) * .028, -.14, -.082], [1, 1, 1], [Math.PI, 0, 0], 'tooth-' + i);
  const horns = part('crown-horns', face);
  for (const side of [-1, 1]) {
    add(horns, sweep([
      [side * .12, .17, -.02], [side * .22, .25, -.015], [side * .28, .34, .02],
      [side * .3, .43, .07], [side * .27, .49, .13]
    ], [.044, .043, .035, .021, .002], 9), 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'horn-' + side);
  }
  const hanger = part('skull-hanger', body);
  add(hanger, sweep([[0, -.42, .12], [0, -.5, .24], [0, -.57, .36]], [.014, .012, .007], 7), 'chain', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'skull-hanger-chain');
  add(hanger, new THREE.TorusGeometry(.045, .009, 6, 14), 'bellEdge', [0, -.5, .24], [1, 1, 1], [Math.PI / 2, 0, 0], 'skull-hanger-clasp');

  const ribs = part('rib-basket');
  ribs.position.set(0, -.38, .02);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const y = .18 - i * .09;
      add(ribs, sweep([
        [side * .08, y, -.23], [side * (.23 + i * .01), y - .015, -.2],
        [side * (.32 + i * .008), y - .06, -.05], [side * .24, y - .1, .12],
        [side * .08, y - .08, .22]
      ], [.021, .032, .029, .018, .006], 8), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'rib-' + side + '-' + i);
    }
  }
  for (let i = 0; i < 5; i++) add(ribs, new THREE.SphereGeometry(1, 9, 7), 'boneDark', [0, .16 - i * .08, -.21], [.047, .04, .05]);

  const arms = part('bell-arms');
  arms.position.set(0, -.25, .02);
  const handSockets = [];
  for (const side of [-1, 1]) {
    const arm = part(side < 0 ? 'left-arm' : 'right-arm', arms);
    add(arm, sweep([[side * .25, .18, -.05], [side * .43, .04, -.13], [side * .62, -.12, -.25]], [.052, .046, .03], 8), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'upper-arm');
    add(arm, sweep([[side * .62, -.12, -.25], [side * .72, -.35, -.35], [side * .64, -.58, -.42]], [.036, .031, .016], 8), 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'fore-arm');
    const hand = part(side < 0 ? 'left-hand' : 'right-hand', arm);
    hand.position.set(side * .64, -.58, -.43);
    for (let i = 0; i < 4; i++) {
      const f = (i - 1.5) * .025;
      add(hand, sweep([[f, 0, 0], [f + side * .028, -.1, -.035], [f + side * .016, -.17, -.13]], [.014, .011, .002], 6), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'finger-' + i);
    }
    const socket = new THREE.Object3D();
    socket.name = side < 0 ? 'leftHandSocket' : 'rightHandSocket';
    socket.position.set(0, -.1, -.02);
    hand.add(socket);
    handSockets.push(socket);
  }

  const membranes = part('torn-membranes');
  membranes.position.set(0, -.28, .06);
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, .22); shape.lineTo(side * .4, .13); shape.lineTo(side * .67, -.06);
    shape.lineTo(side * .54, -.18); shape.lineTo(side * .7, -.35);
    shape.lineTo(side * .38, -.3); shape.lineTo(side * .27, -.48); shape.lineTo(0, -.08); shape.closePath();
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), mats.membrane);
    wing.name = 'torn-membrane-' + side;
    wing.position.z = .04;
    wing.userData.explodeWithParent = true;
    membranes.add(wing);
    for (let i = 0; i < 3; i++) {
      add(membranes, sweep([[side * (.1 + i * .1), .17 - i * .05, .035], [side * (.3 + i * .1), -.02 - i * .12, .045], [side * (.46 + i * .07), -.26 - i * .05, .05]], [.009, .01, .003], 6), 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'membrane-strut-' + side + '-' + i);
    }
  }

  const chains = part('hanging-chains');
  chains.position.set(0, -.3, .02);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + (side < 0 ? 0 : .2);
      const x = Math.cos(a) * .39, z = Math.sin(a) * .39;
      const link = add(chains, new THREE.TorusGeometry(.026, .007, 5, 12), 'chain', [x, -.3 - (i % 2) * .12, z], [1, 1, 1], [Math.PI / 2, (i % 2) * Math.PI / 2, 0], 'chain-link-' + side + '-' + i);
      link.rotation.z = a;
    }
  }

  const hover = part('hover-ring');
  hover.position.set(0, -.38, 0);
  add(hover, new THREE.TorusGeometry(.5, .012, 6, 32), 'acid', [0, -.48, 0], [1, 1, .82], [Math.PI / 2, 0, 0], 'hover-sigil');
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    add(hover, new THREE.BoxGeometry(.06, .014, .014), 'ember', [Math.cos(a) * .5, -.48, Math.sin(a) * .41], [1, 1, 1], [0, -a, 0], 'hover-tooth-' + i);
  }
  const pulseOrigin = new THREE.Object3D();
  pulseOrigin.name = 'pulseOrigin';
  pulseOrigin.position.set(0, -.56, .48);
  root.add(pulseOrigin);
  const attackOrigin = new THREE.Object3D();
  attackOrigin.name = 'attackOrigin';
  attackOrigin.position.set(0, -.52, .62);
  root.add(attackOrigin);
  const hoverAnchor = new THREE.Object3D();
  hoverAnchor.name = 'hoverAnchor';
  hoverAnchor.position.set(0, -.86, 0);
  root.add(hoverAnchor);
  const deathBurst = new THREE.Object3D();
  deathBurst.name = 'deathBurst';
  deathBurst.position.set(0, -.58, 0);
  root.add(deathBurst);
  const sockets = {
    pulseOrigin, attackOrigin, leftHandSocket: handSockets[0], rightHandSocket: handSockets[1],
    hoverAnchor, deathBurst
  };
  // Collapse static surfaces inside each articulated part by material. The
  // hover sigil stays as authored so its warning pulse remains addressable.
  for (const [name, group] of Object.entries(parts)) {
    if (name !== 'hover-ring') compactGroup(group);
  }
  addWearColors(root);
  const renderScale = Number.isFinite(Number(options.scale)) ? Number(options.scale) : 1.1;
  root.scale.setScalar(renderScale);
  const visualBounds = new THREE.Box3().setFromObject(root);
  const visualSize = visualBounds.getSize(new THREE.Vector3());
  const floorOffset = Math.max(0.02, -visualBounds.min.y + 0.02);
  const ring = hover.getObjectByName('hover-sigil');
  hover.userData.floatBaseY = hover.position.y;
  const faceEmbers = [];
  face.traverse(child => {if (child.isMesh && child.material === mats.ember) faceEmbers.push(child);});
  const floatParts = [body, face, ribs, arms, membranes, chains];
  for (const floatPart of floatParts) floatPart.userData.floatBaseY = floatPart.position.y;
  const home = new Map();
  const explode = amount => {
    for (const p of Object.values(parts)) {
      if (!home.has(p)) home.set(p, p.position.clone());
      const dir = new THREE.Vector3(Math.sin(p.position.z * 13) * .1, .1 + Math.abs(p.position.y) * .12, .08).normalize();
      p.position.copy(home.get(p)).addScaledVector(dir, amount * .08);
    }
  };
  root.userData.sculptRuntime = {
    parts, sockets, materials: mats, textures,
    collider: {type: 'capsule', size: [visualSize.x, visualSize.y, visualSize.z], floorOffset},
    explode,
    pick(raycaster) {
      const hit = raycaster.intersectObject(root, true)[0];
      return hit?.object?.parent?.name || hit?.object?.name || null;
    }
  };
  root.userData.bellwraith = {
    kind: 'bellwraith',
    variant: appearance.key,
    appearance,
    parts, sockets, materials: mats, textures, body, arms, hover, ring, faceEmbers, floatParts,
    leftArm: parts['left-arm'], rightArm: parts['right-arm'],
    deathAt: null, lastNow: 0, phase: options.phase || 0, renderScale, floorOffset, visualSize: visualSize.toArray(), visualBounds: {min: visualBounds.min.toArray(), max: visualBounds.max.toArray()}
  };
  return root;
}

export function createBellwraith(options = {}) {
  const appearance = resolveBellwraithVariant(options.variant, options.phase || 0);
  const cached = ensureBellwraithTemplate(appearance);
  const root = cached.template.clone(true);
  root.name = 'Bellwraith';
  return hydrateBellwraith(root, appearance, options, cached);
}

export function resetBellwraith(root, variant='', phase=0, seed=0) {
  const meta = root?.userData?.bellwraith;
  if (!meta) return root;
  root.visible = true;
  root.rotation.set(0, 0, 0);
  meta.deathAt = null;
  meta.lastNow = 0;
  meta.phase = Number.isFinite(Number(phase)) ? Number(phase) : 0;
  const appearance = resolveBellwraithVariant(variant || meta.variant, seed);
  meta.variant = appearance.key;
  meta.appearance = appearance;
  applyBellwraithVariant(meta.materials, appearance);
  for (const part of Object.values(meta.parts)) {
    if (!part) continue;
    if (part.userData.basePosition) part.position.fromArray(part.userData.basePosition);
    part.rotation.set(0, 0, 0);
  }
  for (const floatPart of meta.floatParts) floatPart.position.y = floatPart.userData.floatBaseY;
  meta.ring.visible = false;
  meta.hover.rotation.set(0, 0, 0);
  meta.hover.position.y = meta.hover.userData.floatBaseY;
  meta.materials.ember.emissiveIntensity = 2.1;
  return root;
}

export function animateBellwraith(root, enemy = {}, now = 0, seed = 0) {
  const meta = root?.userData?.bellwraith;
  if (!meta) return;
  const appearance = resolveBellwraithVariant(enemy.variant || meta.variant, seed);
  if (appearance.key !== meta.variant) {
    meta.variant = appearance.key;
    meta.appearance = appearance;
    applyBellwraithVariant(meta.materials, appearance);
  }
  const t = Number(now) * .001;
  const dt = meta.lastNow ? Math.min(.08, Math.max(.001, (Number(now) - meta.lastNow) * .001)) : .016;
  meta.lastNow = Number(now);
  const phase = meta.phase + seed * .37;
  const attacking = !!(enemy.attacking || enemy.attack || enemy.state === 'attack');
  const windup = Math.min(1, Math.max(0, Number(enemy.windup || enemy.attackWindup || 0) / .6));
  const strike = enemy.strike ? Math.min(1, Math.max(0, Number(enemy.strike))) : (enemy.attackPhase === 'strike' ? 1 : 0);
  const hit = Math.min(1, Math.max(0, Number(enemy.flash || enemy.hitFlash || 0) / .16));
  const dead = !!enemy.dead || (enemy.health != null && enemy.health <= 0 && enemy.dying);
  const warning = attacking && !dead;
  const attackMix = warning ? Math.max(windup, strike) : 0;
  if (dead) {
    if (meta.deathAt == null) meta.deathAt = t;
    const fall = Math.min(1, (t - meta.deathAt) * 2.2);
    root.rotation.z = fall * .7;
    meta.ring.visible = false;
    root.visible = fall < 1;
    return;
  }
  meta.deathAt = null;
  root.visible = true;
  const bob = Math.sin(t * 2.35 + phase) * .018;
  for (const floatPart of meta.floatParts) floatPart.position.y = floatPart.userData.floatBaseY + bob;
  meta.body.rotation.y = Math.sin(t * .9 + phase) * .045;
  meta.body.rotation.x = Math.sin(t * 1.7 + phase) * .022;
  meta.ring.visible = warning;
  meta.ring.scale.setScalar(1 + attackMix * .35 + Math.sin(t * 9) * .025);
  meta.ring.material.emissiveIntensity = .8 + attackMix * 4.4;
  if (meta.leftArm && meta.rightArm) {
    meta.leftArm.rotation.z = THREE.MathUtils.damp(meta.leftArm.rotation.z, -.12 - attackMix * .9, 11, dt);
    meta.rightArm.rotation.z = THREE.MathUtils.damp(meta.rightArm.rotation.z, .12 + attackMix * .9, 11, dt);
    meta.leftArm.rotation.x = THREE.MathUtils.damp(meta.leftArm.rotation.x, attackMix * .25, 9, dt);
    meta.rightArm.rotation.x = THREE.MathUtils.damp(meta.rightArm.rotation.x, -attackMix * .25, 9, dt);
  }
  meta.hover.rotation.y += dt * (1.1 + attackMix * 3);
  meta.hover.position.y = meta.hover.userData.floatBaseY + Math.sin(t * 3.2 + phase) * .02;
  meta.materials.ember.emissiveIntensity = 2.1 + attackMix * 5.2 + hit * 2.4 + Math.sin(t * 7.1) * .16;
  for (const eye of meta.faceEmbers) eye.scale.setScalar(1 + attackMix * .28 + hit * .16);
}
