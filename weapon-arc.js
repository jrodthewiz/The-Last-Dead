import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
import {applyWeaponMaterialProfile, stabilizeWeaponVertexWear, tagWeaponMechanism} from './weapon-materials.js';

// Image-guided Arc Lance: a long coil weapon with a caged plasma chamber,
// bone claw emitter and mechanical side frame.  +Y is up, -Z is the firing
// axis.  The model is procedural so it remains cheap enough for the browser
// while retaining the recognizable macro/meso/micro structure of the concept.

const V = p => new THREE.Vector3(...p);

function sweep(points, radii, sides = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map(V));
  const steps = Math.max(8, points.length * 4);
  const frames = curve.computeFrenetFrames(steps, false);
  const position = [], uv = [], index = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const q = t * (radii.length - 1);
    const a = Math.min(radii.length - 2, Math.floor(q));
    const radius = THREE.MathUtils.lerp(radii[a], radii[a + 1], q - a);
    const p = curve.getPointAt(t);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const point = p.clone()
        .addScaledVector(frames.normals[i], Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
      position.push(point.x, point.y, point.z);
      uv.push(j / sides, t);
      if (i < steps && j < sides) {
        const n = i * (sides + 1) + j;
        index.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

function profile(points, depth, bevel = .012, holes = []) {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
  for (const hole of holes) {
    const path = new THREE.Path();
    path.absellipse(hole[0], hole[1], hole[2], hole[3], 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 18,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function helix(z0, z1, radius, turns, segments = 36) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * turns * Math.PI * 2;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius, THREE.MathUtils.lerp(z0, z1, t)]);
  }
  return points;
}

function makeMaps(seed = 77) {
  const size = 64;
  const albedo = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const n0 = Math.sin((x + seed) * 12.9898 + (y - seed) * 78.233) * 43758.5453;
    const n = n0 - Math.floor(n0);
    const broad = Math.sin(x * .16 + Math.sin(y * .08) * 2.5) * .5 + .5;
    const value = 78 + broad * 64 + n * 20;
    const r = 124 + broad * 76 + n * 36;
    const b = 128 + (broad - .5) * 66 + (n - .5) * 24;
    albedo[i] = Math.min(240, value + 12); albedo[i + 1] = Math.min(235, value + 7); albedo[i + 2] = Math.min(228, value); albedo[i + 3] = 255;
    roughness[i] = roughness[i + 1] = roughness[i + 2] = Math.min(248, r); roughness[i + 3] = 255;
    bump[i] = bump[i + 1] = bump[i + 2] = Math.max(12, Math.min(242, b)); bump[i + 3] = 255;
  }
  const texture = (data, colorSpace = false) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.userData.sharedAsset = true;
    if (colorSpace) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { albedo: texture(albedo, true), roughness: texture(roughness), bump: texture(bump) };
}
let sharedMaps;
function getMaps() { return sharedMaps || (sharedMaps = makeMaps()); }

function addWear(root, seed = 31) {
  root.traverse(node => {
    if (!node.isMesh || !node.geometry?.attributes?.position || !node.material?.map) return;
    const p = node.geometry.attributes.position;
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const n = Math.sin((i + seed) * 9.17) * .5 + .5;
      const v = .8 + n * .2;
      colors[i * 3] = v; colors[i * 3 + 1] = v * .98; colors[i * 3 + 2] = v * .93;
    }
    node.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    node.material.vertexColors = true;
    node.material.needsUpdate = true;
  });
}

// Arc Lance has many small authored surfaces because its coil cage is meant
// to read in close first-person inspection.  Compile static siblings by
// material once at construction so those details do not become one draw call
// apiece.  Animated groups (reactor, charge slider, recoil and flash) remain
// separate at their semantic boundaries.
function mergeStaticSurfaces(parts) {
  for (const group of Object.values(parts)) {
    const directMeshes = group.children.filter(child => child.isMesh && child.geometry && child.material);
    if (directMeshes.length < 2) continue;
    const buckets = new Map();
    for (const child of directMeshes) {
      child.updateMatrix();
      const source = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      source.applyMatrix4(child.matrix);
      const list = buckets.get(child.material) || [];
      list.push({source, child});
      buckets.set(child.material, list);
    }
    for (const [material, entries] of buckets) {
      if (entries.length < 2) {
        for (const entry of entries) entry.source.dispose();
        continue;
      }
      const merged = mergeGeometries(entries.map(entry => entry.source), false);
      if (!merged) {
        for (const entry of entries) entry.source.dispose();
        continue;
      }
      for (const entry of entries) {
        group.remove(entry.child);
        entry.child.geometry.dispose();
        entry.source.dispose();
      }
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${group.name}-merged-${material.uuid.slice(0, 4)}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.explodeWithParent = true;
      group.add(mesh);
    }
  }
}

function materials() {
  return {
    frame: new THREE.MeshStandardMaterial({ color: 0x43505b, roughness: .4, metalness: .86 }),
    frameEdge: new THREE.MeshStandardMaterial({ color: 0x9a8061, roughness: .29, metalness: .9 }),
    black: new THREE.MeshStandardMaterial({ color: 0x070a10, roughness: .87, metalness: .3 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xb9a27f, roughness: .82, metalness: 0 }),
    boneDark: new THREE.MeshStandardMaterial({ color: 0x604c3f, roughness: .9, metalness: 0 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x20151b, roughness: .78, metalness: .05 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xa46b32, roughness: .32, metalness: .86 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1c5e9d, emissive: 0x091c87, emissiveIntensity: 1.8, roughness: .16, metalness: .22, transmission: .08, transparent: true, opacity: .88 }),
    energy: new THREE.MeshStandardMaterial({ color: 0x6fd9ff, emissive: 0x536aff, emissiveIntensity: 7, roughness: .14, metalness: .08 }),
    energySoft: new THREE.MeshBasicMaterial({ color: 0x75bfff, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }),
    muzzle: new THREE.MeshBasicMaterial({ color: 0x9edaff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }),
    muzzleCore: new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: .94, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}

export function createArc(options = {}) {
  const root = new THREE.Group();
  root.name = 'ArcLance';
  const parts = {};
  const mats = materials();
  const textures = getMaps();
  for (const key of ['frame', 'frameEdge', 'bone', 'boneDark', 'leather', 'brass']) {
    mats[key].map = textures.albedo;
    mats[key].roughnessMap = textures.roughness;
    mats[key].bumpMap = textures.bump;
    mats[key].bumpScale = key === 'bone' ? .016 : key === 'leather' ? .011 : .006;
    mats[key].needsUpdate = true;
  }
  applyWeaponMaterialProfile(mats,{frame:{roughness:.58,metalness:.78,envMapIntensity:.46},frameEdge:{roughness:.5,metalness:.82,envMapIntensity:.4},bone:{roughness:.92,envMapIntensity:.24},brass:{roughness:.5,metalness:.76,envMapIntensity:.4},glass:{roughness:.22,metalness:.14,envMapIntensity:.32}});
  const part = (name, parent = root) => {
    const group = new THREE.Group();
    group.name = name;
    group.userData.explodeWithParent = true;
    parent.add(group);
    parts[name] = group;
    return group;
  };
  const add = (parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], name = '') => {
    const mesh = new THREE.Mesh(geometry, mats[material]);
    mesh.name = name || `${parent.name}-surface-${parent.children.length}`;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.explodeWithParent = true;
    parent.add(mesh);
    return mesh;
  };

  const frame = part('frame');
  add(frame, profile([[-.22, -.16], [-.2, .15], [-.1, .21], [.1, .21], [.22, .13], [.21, -.16], [.1, -.21], [-.12, -.21]], .5, .022, [[0, .03, .13, .15]]), 'frame', [0, 0, -.04], [1, 1, 1], [0, 0, 0], 'frame-shell');
  for (const side of [-1, 1]) {
    add(frame, profile([[-.18, -.12], [-.15, .13], [.15, .13], [.18, -.12]], .025, .007), 'frameEdge', [side * .25, .02, -.05], [1, 1, 1], [0, Math.PI / 2, 0], `frame-side-plate-${side}`);
    for (let i = 0; i < 3; i++) add(frame, new THREE.SphereGeometry(.022, 9, 7), 'brass', [side * .265, -.1 + i * .1, -.2], [1, 1, 1], [0, 0, 0], `frame-rivet-${side}-${i}`);
    add(frame, new THREE.BoxGeometry(.035, .16, .34), 'black', [side * .272, .02, -.08], [1, 1, 1], [0, 0, 0], `frame-inset-${side}`);
    add(frame, new THREE.BoxGeometry(.018, .09, .22), 'frameEdge', [side * .294, .03, -.08], [1, 1, 1], [0, 0, 0], `frame-rail-inset-${side}`);
  }

  const reactor = part('reactor');
  add(reactor, new THREE.CylinderGeometry(.15, .15, .72, 22, 1, true), 'glass', [0, .03, -.47], [1, 1, 1], [Math.PI / 2, 0, 0], 'plasma-chamber');
  add(reactor, new THREE.CylinderGeometry(.086, .086, .68, 18, 1, true), 'energy', [0, .03, -.47], [1, 1, 1], [Math.PI / 2, 0, 0], 'plasma-core');
  add(reactor, new THREE.SphereGeometry(.105, 18, 12), 'energy', [0, .03, -.47], [1, .8, 2.1], [0, 0, 0], 'plasma-bead');
  for (let i = 0; i < 5; i++) {
    const z = -.18 - i * .145;
    add(reactor, new THREE.TorusGeometry(.17, .024, 8, 26), i % 2 ? 'brass' : 'frameEdge', [0, .03, z], [1, 1, 1], [0, 0, 0], `reactor-ring-${i}`);
  }
  add(reactor, sweep(helix(-.82, -.12, .122, 2.2), [.012, .014], 7), 'energy', [0, .03, 0], [1, 1, 1], [0, 0, 0], 'coil-helix-a');
  add(reactor, sweep(helix(-.82, -.12, .126, 2.2, 36).map(p => [p[0], -p[1], p[2]]), [.009, .011], 7), 'brass', [0, .03, 0], [1, 1, 1], [0, 0, 0], 'coil-helix-b');
  const glowShell = add(reactor, new THREE.CylinderGeometry(.17, .17, .76, 20, 1, true), 'energySoft', [0, .03, -.47], [1, 1, 1], [Math.PI / 2, 0, 0], 'reactor-glow');
  glowShell.renderOrder = 2;
  const baffles = part('reactor-baffles', reactor);
  for (const side of [-1, 1]) {
    add(baffles, profile([[-.11, -.1], [-.085, .1], [.085, .1], [.11, -.1]], .018, .004), 'frame', [side * .145, .03, -.47], [1, 1, 1], [0, Math.PI / 2, 0], `reactor-baffle-${side}`);
    for (let i = 0; i < 3; i++) add(baffles, new THREE.BoxGeometry(.025, .022, .12), 'brass', [side * .161, .03, -.26 - i * .21], [1, 1, 1], [0, 0, 0], `reactor-baffle-lock-${side}-${i}`);
  }
  const heatVents = part('reactor-heat-vents', reactor);
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const vent = add(heatVents, new THREE.BoxGeometry(.012, .028, .09), 'energySoft', [side * .175, .13, -.22 - i * .17], [1, 1, 1], [0, side * .12, 0], `reactor-vent-${side}-${i}`);
    vent.renderOrder = 3;
  }
  const chargeSlider = part('charge-slider', reactor);
  tagWeaponMechanism(chargeSlider, 'plasma-charge-slider', 'z');
  add(chargeSlider, new THREE.CylinderGeometry(.018, .018, .18, 8), 'frameEdge', [0, .205, -.47], [1, 1, 1], [0, 0, 0], 'charge-slider-rod');
  add(chargeSlider, new THREE.TorusGeometry(.035, .007, 6, 16), 'brass', [0, .205, -.47], [1, 1, 1], [Math.PI / 2, 0, 0], 'charge-slider-ring');

  const rails = part('rails');
  for (const side of [-1, 1]) {
    add(rails, sweep([[side * .17, .22, .35], [side * .25, .22, -.08], [side * .25, .2, -.58], [side * .19, .2, -.98]], [.022, .023, .02, .014], 7), 'frameEdge', [0, 0, 0], [1, 1, 1], [0, 0, 0], `upper-rail-${side}`);
    add(rails, sweep([[side * .18, -.22, .25], [side * .28, -.19, -.14], [side * .26, -.18, -.61], [side * .17, -.17, -.98]], [.018, .021, .018, .012], 7), 'frame', [0, 0, 0], [1, 1, 1], [0, 0, 0], `lower-rail-${side}`);
  }
  add(rails, new THREE.BoxGeometry(.05, .05, 1.26), 'frameEdge', [0, .25, -.3], [1, 1, 1], [0, 0, 0], 'sight-rail');
  for (const z of [.24, -.1, -.48, -.84]) add(rails, new THREE.BoxGeometry(.12, .08, .045), 'brass', [0, .25, z], [1, 1, 1], [0, 0, 0], `sight-block-${z}`);
  const railLocks = part('rail-locks', rails);
  for (const side of [-1, 1]) for (const z of [.18, -.18, -.54]) {
    add(railLocks, new THREE.CylinderGeometry(.018, .018, .08, 8), 'brass', [side * .245, .22, z], [1, 1, 1], [0, Math.PI / 2, 0], `rail-lock-${side}-${z}`);
    add(railLocks, new THREE.TorusGeometry(.024, .006, 6, 12), 'frameEdge', [side * .285, .22, z], [1, 1, 1], [0, Math.PI / 2, 0], `rail-lock-ring-${side}-${z}`);
  }

  const coilGuards = part('coil-guards');
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = -.2 - i * .26;
      add(coilGuards, sweep([[side * .13, .14, z + .1], [side * .23, .17, z], [side * .13, .15, z - .1]], [.02, .026, .018], 7), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], `coil-bone-${side}-${i}`);
      add(coilGuards, new THREE.CylinderGeometry(.018, .018, .28, 8), 'brass', [side * .23, .03, z], [1, 1, 1], [Math.PI / 2, 0, 0], `coil-pin-${side}-${i}`);
    }
  }

  const stock = part('stock');
  stock.position.set(-.08, .035, .34);
  stock.scale.setScalar(.66);
  const skullEmblem = part('stock-skull-emblem', stock);
  skullEmblem.position.set(-.12, .018, .03);
  skullEmblem.scale.setScalar(.52);
  skullEmblem.rotation.y = .38;
  add(stock, new THREE.CylinderGeometry(.14, .18, .34, 14), 'leather', [0, 0, .12], [1, 1, 1], [Math.PI / 2, 0, 0], 'stock-core');
  add(skullEmblem, profile([[-.2, -.14], [-.2, .12], [-.11, .2], [.11, .2], [.2, .12], [.2, -.14], [.1, -.2], [-.12, -.2]], .12, .018, [[-.07, .04, .04, .026], [.07, .04, .04, .026]]), 'bone', [0, 0, .3], [1, 1, 1], [0, 0, 0], 'stock-skull');
  for (const side of [-1, 1]) add(skullEmblem, new THREE.SphereGeometry(1, 12, 8), 'black', [side * .07, .04, .29], [.04, .027, .02], [0, 0, 0], `stock-eye-${side}`);
  for (let i = 0; i < 4; i++) add(skullEmblem, new THREE.ConeGeometry(.013, .045, 7), 'bone', [(i - 1.5) * .03, -.14, .29], [1, 1, 1], [0, 0, 0], `stock-tooth-${i}`);

  const grip = part('grip');
  grip.position.set(0, -.25, .02);
  grip.rotation.x = -.2;
  add(grip, new THREE.CylinderGeometry(.105, .14, .42, 14), 'leather', [0, -.08, .08], [1, 1, 1], [0, 0, 0], 'grip-core');
  for (let i = 0; i < 6; i++) add(grip, new THREE.TorusGeometry(.12, .012, 6, 16), i % 2 ? 'brass' : 'boneDark', [0, -.08 - i * .055, .08], [1, 1, 1], [0, 0, 0], `grip-wrap-${i}`);
  const guard = part('trigger-guard');
  add(guard, sweep([[0, -.05, -.02], [0, -.17, .02], [0, -.22, .14], [0, -.16, .25], [0, -.05, .28]], [.018, .023, .024, .02, .015], 8), 'frameEdge', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'trigger-guard');
  add(guard, new THREE.CapsuleGeometry(.022, .095, 6, 10), 'brass', [0, -.12, .12], [1, 1, 1], [Math.PI / 2, 0, 0], 'trigger');

  const emitter = part('emitter');
  add(emitter, new THREE.CylinderGeometry(.11, .09, .22, 18), 'frame', [0, .03, -.98], [1, 1, 1], [Math.PI / 2, 0, 0], 'emitter-collar');
  add(emitter, new THREE.TorusGeometry(.11, .018, 8, 24), 'brass', [0, .03, -1.12], [1, 1, 1], [0, 0, 0], 'emitter-ring');
  add(emitter, new THREE.CylinderGeometry(.073, .073, .13, 16, 1, true), 'black', [0, .03, -1.13], [1, 1, 1], [Math.PI / 2, 0, 0], 'emitter-bore');
  add(emitter, new THREE.CircleGeometry(.056, 18), 'energy', [0, .03, -1.2], [1, 1, 1], [0, 0, 0], 'emitter-aperture');
  add(emitter, new THREE.TorusGeometry(.064, .008, 7, 18), 'energySoft', [0, .03, -1.205], [1, 1, 1], [0, 0, 0], 'emitter-aperture-glow');
  for (const side of [-1, 1]) {
    add(emitter, sweep([[side * .1, .11, -1.02], [side * .18, .16, -1.13], [side * .24, .12, -1.24], [side * .14, .02, -1.29]], [.032, .038, .025, .004], 8), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], `emitter-claw-${side}`);
    add(emitter, sweep([[side * .1, -.06, -1.03], [side * .19, -.1, -1.14], [side * .23, -.04, -1.25]], [.022, .028, .004], 8), 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], `emitter-underclaw-${side}`);
    add(emitter, new THREE.SphereGeometry(.032, 8, 6), 'brass', [side * .17, .12, -1.13], [1, 1, 1], [0, 0, 0], `emitter-claw-joint-${side}`);
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, .03, -1.3);
  emitter.add(muzzle);
  const projectileOrigin = new THREE.Object3D();
  projectileOrigin.name = 'projectileOrigin';
  projectileOrigin.position.set(0, .03, -1.32);
  emitter.add(projectileOrigin);
  const muzzleFlash = part('muzzle-flash', emitter);
  muzzleFlash.visible = false;
  add(muzzleFlash, new THREE.ConeGeometry(.14, .42, 10), 'muzzle', [0, .03, -1.5], [1, 1, 1], [Math.PI / 2, 0, 0], 'arc-flash');
  add(muzzleFlash, new THREE.TorusGeometry(.16, .016, 8, 24), 'muzzle', [0, .03, -1.3], [1, 1, 1], [0, 0, 0], 'arc-flash-ring');
  add(muzzleFlash, new THREE.ConeGeometry(.065, .22, 8), 'muzzleCore', [0, .03, -1.43], [1, 1, 1], [Math.PI / 2, 0, 0], 'arc-flash-core');
  add(muzzleFlash, new THREE.TorusGeometry(.087, .009, 6, 18), 'muzzleCore', [0, .03, -1.305], [1, 1, 1], [0, 0, 0], 'arc-flash-core-ring');
  const shotArc = part('shot-arc', emitter);
  shotArc.visible = false;
  add(shotArc, new THREE.CylinderGeometry(.011, .026, .52, 8, 1, true), 'energy', [0, .03, -1.55], [1, 1, 1], [Math.PI / 2, 0, 0], 'arc-bolt-core');
  add(shotArc, new THREE.CylinderGeometry(.036, .07, .34, 8, 1, true), 'energySoft', [0, .03, -1.45], [1, 1, 1], [Math.PI / 2, 0, 0], 'arc-bolt-halo');
  add(shotArc, new THREE.TorusGeometry(.11, .012, 7, 20), 'energySoft', [0, .03, -1.31], [1, 1, 1], [0, 0, 0], 'arc-bolt-ring');
  shotArc.children.forEach(child => { child.renderOrder = 4; });
  mergeStaticSurfaces(parts);
  const inspect = new THREE.Object3D();
  inspect.name = 'inspect';
  inspect.position.set(0, .1, .28);
  root.add(inspect);
  const heat = new THREE.Object3D();
  heat.name = 'heat';
  heat.position.set(0, .04, -.48);
  reactor.add(heat);
  const sockets = { muzzle, projectileOrigin, muzzleFlash, shotArc, recoil: root, heat, inspect, grip, corePulse: reactor };
  root.userData.muzzle = muzzle;
  root.userData.projectileOrigin = projectileOrigin;
  const home = new Map();
  const explode = amount => {
    for (const p of Object.values(parts)) {
      if (!home.has(p)) home.set(p, p.position.clone());
      const delta = new THREE.Vector3(Math.sin(p.position.z * 7) * .04, .02, p === reactor ? -.05 : .03);
      p.position.copy(home.get(p)).addScaledVector(delta, Number(amount) || 0);
    }
  };
  root.userData.sculptRuntime = {
    parts, sockets, materials: mats, textures,
    collider: { type: 'capsule', size: [.48, .92, 1.8] },
    explode,
    pick(raycaster) { const hit = raycaster.intersectObject(root, true)[0]; return hit?.object?.parent?.name || hit?.object?.name || null; },
  };
  root.userData.arc = { kind: 'arc', parts, sockets, materials: mats, textures, reactor, emitter, chargeSlider, recoil: 0, flash: 0, heat: 0, lastShot: 0 };
  addWear(root);
  stabilizeWeaponVertexWear(root, 47);
  return root;
}

export function animateArc(root, time = 0, shot = 0, dt = .016, state = {}) {
  const meta = root?.userData?.arc;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) {
    meta.recoil = 1;
    meta.flash = 1;
    meta.heat = Math.min(1, meta.heat + .3);
  }
  meta.lastShot = shotValue;
  meta.recoil = THREE.MathUtils.damp(meta.recoil, 0, 16, delta);
  meta.flash = Math.max(0, meta.flash - delta * 11);
  meta.heat = THREE.MathUtils.damp(meta.heat, 0, 1.25, delta);
  meta.reactor.rotation.z = time * (.45 + meta.heat * 2.2);
  meta.chargeSlider.position.z = Math.sin(time * 3.2) * .14 - meta.heat * .035;
  meta.chargeSlider.rotation.y = meta.heat * .22;
  meta.recoil *= 1;
  root.position.z = meta.recoil * .028;
  root.rotation.x = meta.recoil * -.012;
  meta.materials.energy.emissiveIntensity = 4.4 + meta.heat * 7 + Math.sin(time * 9) * .45;
  meta.materials.glass.emissiveIntensity = 1.25 + meta.heat * 3.2;
  meta.materials.energySoft.opacity = .34 + meta.heat * .18;
  meta.materials.muzzle.opacity = .55 + meta.flash * .4;
  meta.materials.muzzleCore.opacity = .42 + meta.flash * .52;
  meta.sockets.muzzleFlash.visible = meta.flash > .012;
  meta.sockets.muzzleFlash.scale.setScalar(.75 + meta.flash * 1.45);
  meta.sockets.muzzleFlash.rotation.z = Math.sin(time * 33) * .2;
  meta.sockets.shotArc.visible = meta.flash > .035;
  meta.sockets.shotArc.scale.set(0.78 + meta.flash * .2, 0.78 + meta.flash * .2, .72 + meta.flash * 1.55);
  meta.sockets.shotArc.rotation.z = Math.sin(time * 29) * .24;
  if (state?.inspect) meta.sockets.inspect.rotation.y = Math.sin(time * .75) * .08;
}
