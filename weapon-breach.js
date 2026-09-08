import * as THREE from './vendor/three.module.js';
import {applyWeaponMaterialProfile, stabilizeWeaponVertexWear, tagWeaponMechanism} from './weapon-materials.js';

// Image-guided Breach: a paired infernal shotgun built from the bone-wrapped
// receiver and twin muzzle silhouette in docs/build08-art/references.  The
// factory keeps the model procedural and action-ready; +Y is up and -Z fires.

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

function surfaceMaps(seed = 51) {
  const size = 64;
  const albedo = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const noise = Math.sin((x + seed) * 12.9898 + (y - seed) * 78.233) * 43758.5453;
    const fine = noise - Math.floor(noise);
    const broad = Math.sin(x * .18 + Math.sin(y * .09) * 1.8) * .5 + .5;
    const pitted = Math.max(0, fine - .76) * 3.7;
    const value = Math.max(34, Math.min(244, 102 + broad * 52 - pitted * 42));
    const r = Math.max(48, Math.min(248, 176 + broad * 44 - pitted * 85));
    const n = Math.max(18, Math.min(238, 128 + (broad - .5) * 82 + (fine - .5) * 35));
    albedo[i] = value; albedo[i + 1] = Math.max(0, value - 8); albedo[i + 2] = Math.max(0, value - 17); albedo[i + 3] = 255;
    roughness[i] = roughness[i + 1] = roughness[i + 2] = r; roughness[i + 3] = 255;
    bump[i] = bump[i + 1] = bump[i + 2] = n; bump[i + 3] = 255;
  }
  const make = (data, colorSpace = false) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.userData.sharedAsset = true;
    if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  return { albedo: make(albedo, true), roughness: make(roughness), bump: make(bump) };
}

let sharedMaps;
function getMaps() { return sharedMaps || (sharedMaps = surfaceMaps()); }

function addVertexWear(root, seed = 13) {
  root.traverse(node => {
    if (!node.isMesh || !node.geometry?.attributes?.position || !node.material?.map) return;
    const p = node.geometry.attributes.position;
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const n = Math.sin((i + seed) * 17.71) * .5 + .5;
      const v = .78 + n * .22;
      colors[i * 3] = v;
      colors[i * 3 + 1] = v * .97;
      colors[i * 3 + 2] = v * .9;
    }
    node.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    node.material.vertexColors = true;
    node.material.needsUpdate = true;
  });
}

function makeMaterials() {
  return {
    steel: new THREE.MeshStandardMaterial({ color: 0x2b2d32, roughness: .46, metalness: .82 }),
    steelEdge: new THREE.MeshStandardMaterial({ color: 0x9a8772, roughness: .31, metalness: .9 }),
    black: new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: .92, metalness: .1 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xc2a783, roughness: .82, metalness: 0 }),
    boneDark: new THREE.MeshStandardMaterial({ color: 0x6e4e3c, roughness: .9, metalness: 0 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x24131a, roughness: .78, metalness: .03 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x9c672c, roughness: .35, metalness: .83 }),
    ember: new THREE.MeshStandardMaterial({ color: 0xff4b23, emissive: 0xff1807, emissiveIntensity: 3.2, roughness: .22, metalness: .2 }),
    muzzle: new THREE.MeshBasicMaterial({ color: 0xffb56c, transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}

export function createBreach(options = {}) {
  const root = new THREE.Group();
  root.name = 'BreachShotgun';
  const parts = {};
  const materials = makeMaterials();
  const textures = getMaps();
  for (const key of ['steel', 'steelEdge', 'bone', 'boneDark', 'leather', 'brass']) {
    materials[key].map = textures.albedo;
    materials[key].roughnessMap = textures.roughness;
    materials[key].bumpMap = textures.bump;
    materials[key].bumpScale = key === 'bone' ? .018 : key === 'leather' ? .012 : .007;
    materials[key].needsUpdate = true;
  }
  applyWeaponMaterialProfile(materials,{steel:{roughness:.55,metalness:.78,envMapIntensity:.45},steelEdge:{roughness:.5,metalness:.82,envMapIntensity:.42},bone:{roughness:.92,envMapIntensity:.24},brass:{roughness:.5,metalness:.76,envMapIntensity:.4}});
  const part = (name, parent = root) => {
    const group = new THREE.Group();
    group.name = name;
    group.userData.explodeWithParent = true;
    parent.add(group);
    parts[name] = group;
    return group;
  };
  const add = (parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], name = '') => {
    const mesh = new THREE.Mesh(geometry, materials[material]);
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

  const receiver = part('receiver');
  add(receiver, profile([[-.21, -.14], [-.19, .13], [-.1, .19], [.1, .19], [.2, .12], [.21, -.14], [.12, -.19], [-.13, -.19]], .46, .022), 'steel', [0, 0, -.02], [1, 1, 1], [0, 0, 0], 'receiver-shell');
  add(receiver, profile([[-.17, -.1], [-.15, .1], [.15, .1], [.17, -.1]], .025, .008), 'steelEdge', [0, .205, -.08], [1, 1, 1], [0, 0, 0], 'receiver-top-plate');
  for (const side of [-1, 1]) {
    add(receiver, profile([[-.03, -.12], [.03, -.12], [.05, .12], [-.05, .12]], .026, .006), 'brass', [side * .205, .015, -.08], [1, 1, 1], [0, Math.PI / 2, 0], `receiver-side-plate-${side}`);
    for (const y of [-.1, .1]) add(receiver, new THREE.SphereGeometry(.024, 10, 8), 'steelEdge', [side * .228, y, -.18], [1, 1, 1], [0, 0, 0], `receiver-rivet-${side}-${y}`);
  }

  const recoilCarriage = part('recoil-carriage');
  const barrels = part('twin-barrels', recoilCarriage);
  for (const side of [-1, 1]) {
    add(barrels, new THREE.CylinderGeometry(.105, .128, .83, 18), 'steel', [side * .12, .045, -.56], [1, 1, 1], [Math.PI / 2, 0, 0], `barrel-${side}`);
    add(barrels, new THREE.CylinderGeometry(.072, .073, .84, 16, 1, true), 'black', [side * .12, .045, -.56], [1, 1, 1], [Math.PI / 2, 0, 0], `bore-${side}`);
    add(barrels, new THREE.TorusGeometry(.13, .018, 8, 24), 'steelEdge', [side * .12, .045, -.25], [1, 1, 1], [Math.PI / 2, 0, 0], `barrel-collar-${side}`);
    add(barrels, new THREE.TorusGeometry(.134, .022, 8, 24), 'brass', [side * .12, .045, -.9], [1, 1, 1], [Math.PI / 2, 0, 0], `muzzle-band-${side}`);
    add(barrels, new THREE.TorusGeometry(.075, .009, 6, 18), 'ember', [side * .12, .045, -.932], [1, 1, 1], [Math.PI / 2, 0, 0], `muzzle-ember-${side}`);
    add(barrels, new THREE.CircleGeometry(.07, 18), 'black', [side * .12, .045, -.941], [1, 1, 1], [0, Math.PI, 0], `muzzle-bore-${side}`);
  }
  add(barrels, new THREE.BoxGeometry(.34, .09, .73), 'steelEdge', [0, .19, -.52], [1, 1, 1], [0, 0, 0], 'barrel-top-rail');
  const breechBlock = part('breech-block', recoilCarriage);
  tagWeaponMechanism(breechBlock, 'sliding-breech', 'z');
  add(breechBlock, new THREE.BoxGeometry(.22, .055, .18), 'steel', [0, .13, -.18], [1, 1, 1], [0, 0, 0], 'breech-carrier');
  for (const side of [-1, 1]) {
    add(breechBlock, new THREE.CylinderGeometry(.012, .016, .24, 8), 'steelEdge', [side * .14, .13, -.18], [1, 1, 1], [Math.PI / 2, 0, 0], 'breech-guide-' + side);
    add(breechBlock, new THREE.TorusGeometry(.026, .006, 6, 12), 'brass', [side * .14, .13, -.18], [1, 1, 1], [Math.PI / 2, 0, 0], 'breech-ring-' + side);
  }
  const extractors = part('shell-extractors', recoilCarriage);
  tagWeaponMechanism(extractors, 'dual-shell-extractor', 'z');
  for (const side of [-1, 1]) add(extractors, sweep([[side * .09, .02, -.27], [side * .12, .055, -.2], [side * .105, .09, -.13]], [.012, .014, .005], 7), 'steelEdge', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'extractor-' + side);
  const ribcage = part('ribcage', recoilCarriage);
  for (let i = 0; i < 6; i++) {
    const z = -.22 - i * .12;
    for (const side of [-1, 1]) {
      add(ribcage, sweep([
        [side * .11, .18, z + .045], [side * (.2 + i * .006), .15, z + .02],
        [side * (.23 + i * .004), .02, z - .055], [side * (.19 + i * .006), -.13, z - .11], [side * .09, -.16, z - .13]
      ], [.022, .034, .03, .021, .008], 8), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], `rib-${side}-${i}`);
      add(ribcage, new THREE.SphereGeometry(.032, 9, 7), 'boneDark', [side * (.21 + i * .004), .03, z - .055], [1, 1, 1], [0, 0, 0], `rib-joint-${side}-${i}`);
    }
  }
  const lowerSpine = part('lower-spine', recoilCarriage);
  add(lowerSpine, sweep([[0, -.16, .15], [0, -.2, -.05], [0, -.18, -.29], [0, -.19, -.6], [0, -.18, -.94]], [.046, .06, .052, .045, .026], 9), 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'vertebral-rail');
  for (let i = 0; i < 6; i++) {
    const z = .1 - i * .16;
    add(lowerSpine, new THREE.SphereGeometry(.05 - i * .002, 10, 8), 'bone', [0, -.18, z], [1.15, .72, .8], [0, 0, 0], `vertebra-${i}`);
  }

  const stock = part('skull-stock');
  stock.position.set(-.12, .055, .31);
  stock.scale.setScalar(.62);
  stock.rotation.y = -.34;
  const skullContour = [[-.17, -.08], [-.18, .02], [-.13, .13], [-.06, .18], [0, .21], [.07, .17], [.15, .1], [.18, .01], [.14, -.09], [.08, -.14], [.02, -.09], [-.05, -.1], [-.1, -.15]];
  add(stock, profile(skullContour, .15, .018, [[-.075, .045, .042, .028], [.075, .045, .042, .028]]), 'bone', [0, 0, .02], [1, 1, 1], [0, 0, 0], 'stock-skull');
  for (const side of [-1, 1]) {
    add(stock, new THREE.SphereGeometry(1, 14, 10), 'black', [side * .073, .045, -.065], [.041, .029, .022], [0, 0, 0], `stock-eye-${side}`);
    add(stock, sweep([[side * .15, -.01, -.035], [side * .1, -.1, -.055], [side * .038, -.11, -.045]], [.022, .029, .012], 8), 'bone', [0, 0, .02], [1, 1, 1], [0, 0, 0], `stock-cheek-${side}`);
  }
  add(stock, sweep([[-.12, -.09, -.07], [-.08, -.16, -.08], [0, -.18, -.09], [.08, -.16, -.08], [.12, -.09, -.07]], [.018, .024, .02, .024, .018], 8), 'boneDark', [0, 0, .02], [1, 1, 1], [0, 0, 0], 'stock-jaw');
  for (let i = 0; i < 5; i++) add(stock, new THREE.ConeGeometry(.013, .05, 7), 'bone', [(i - 2) * .03, -.16, -.07], [1, 1, 1], [0, 0, 0], `stock-tooth-${i}`);
  const horn = part('stock-horns', stock);
  for (const side of [-1, 1]) add(horn, sweep([[side * .12, .1, .01], [side * .18, .18, .03], [side * .2, .25, .08], [side * .16, .3, .14]], [.036, .036, .025, .003], 8), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], `horn-${side}`);

  const grip = part('grip');
  grip.position.set(0, -.2, .04);
  grip.rotation.x = -.24;
  add(grip, profile([[-.1, .1], [.1, .1], [.08, -.3], [.03, -.38], [-.08, -.33]], .23, .02), 'leather', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'grip-shell');
  for (let i = 0; i < 7; i++) add(grip, sweep([[-.105, .06 - i * .05, -.11], [.105, .03 - i * .05, .1]], [.014, .014], 7), i % 3 === 0 ? 'brass' : 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], `grip-wrap-${i}`);
  const guard = part('trigger-guard');
  add(guard, sweep([[0, -.06, -.13], [0, -.18, -.08], [0, -.24, .02], [0, -.18, .13], [0, -.06, .17]], [.018, .023, .024, .02, .015], 8), 'steelEdge', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'trigger-guard');
  add(guard, new THREE.CapsuleGeometry(.024, .1, 6, 10), 'brass', [0, -.13, .01], [1, 1, 1], [Math.PI / 2, 0, 0], 'trigger');

  const sidePlates = part('side-plates');
  for (const side of [-1, 1]) {
    add(sidePlates, profile([[-.18, -.12], [-.16, .13], [.12, .15], [.19, .04], [.15, -.13]], .028, .008), 'steelEdge', [side * .23, .01, -.2], [1, 1, 1], [0, Math.PI / 2, 0], `side-plate-${side}`);
    for (let i = 0; i < 4; i++) add(sidePlates, new THREE.SphereGeometry(.016, 8, 6), 'brass', [side * .25, -.08 + i * .07, -.2], [1, 1, 1], [0, 0, 0], `side-rivet-${side}-${i}`);
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, .045, -1.02);
  recoilCarriage.add(muzzle);
  const projectileOrigin = new THREE.Object3D();
  projectileOrigin.name = 'projectileOrigin';
  projectileOrigin.position.set(0, .045, -1.045);
  recoilCarriage.add(projectileOrigin);
  const muzzleFlash = part('muzzle-flash', recoilCarriage);
  muzzleFlash.visible = false;
  add(muzzleFlash, new THREE.ConeGeometry(.13, .42, 10), 'muzzle', [0, .045, -1.23], [1, 1, 1], [Math.PI / 2, 0, 0], 'flash-cone');
  add(muzzleFlash, new THREE.TorusGeometry(.15, .018, 8, 24), 'muzzle', [0, .045, -1.03], [1, 1, 1], [Math.PI / 2, 0, 0], 'flash-ring');
  const heat = new THREE.Object3D();
  heat.name = 'heat';
  heat.position.set(0, .045, -.62);
  recoilCarriage.add(heat);
  const inspect = new THREE.Object3D();
  inspect.name = 'inspect';
  inspect.position.set(0, .1, .26);
  root.add(inspect);

  const sockets = { muzzle, projectileOrigin, muzzleFlash, recoil: recoilCarriage, heat, inspect, grip };
  root.userData.muzzle = muzzle;
  root.userData.projectileOrigin = projectileOrigin;
  const home = new Map();
  const explode = amount => {
    for (const p of Object.values(parts)) {
      if (!home.has(p)) home.set(p, p.position.clone());
      const offset = new THREE.Vector3(Math.sin(p.position.z * 8.1) * .055, .025, p === recoilCarriage ? -.06 : .04);
      p.position.copy(home.get(p)).addScaledVector(offset, Number(amount) || 0);
    }
  };
  root.userData.sculptRuntime = {
    parts, sockets, materials, textures,
    collider: { type: 'capsule', size: [.5, .94, 1.72] },
    explode,
    pick(raycaster) { const hit = raycaster.intersectObject(root, true)[0]; return hit?.object?.parent?.name || hit?.object?.name || null; },
  };
  root.userData.breach = { kind: 'breach', parts, sockets, materials, textures, recoilCarriage, barrels, breechBlock, extractors, recoil: 0, flash: 0, heat: 0, lastShot: 0 };
  addVertexWear(root);
  stabilizeWeaponVertexWear(root, 43);
  return root;
}

export function animateBreach(root, time = 0, shot = 0, dt = .016, state = {}) {
  const meta = root?.userData?.breach;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) {
    meta.recoil = 1;
    meta.flash = 1;
    meta.heat = Math.min(1, meta.heat + .34);
  }
  meta.lastShot = shotValue;
  meta.recoil = THREE.MathUtils.damp(meta.recoil, 0, 14, delta);
  meta.flash = Math.max(0, meta.flash - delta * 9);
  meta.heat = THREE.MathUtils.damp(meta.heat, 0, 1.4, delta);
  meta.recoilCarriage.position.z = meta.recoil * .058;
  meta.recoilCarriage.rotation.x = meta.recoil * -.018;
  meta.breechBlock.position.z = -meta.recoil * .065;
  meta.breechBlock.rotation.x = meta.recoil * -.06;
  meta.extractors.position.z = -meta.recoil * .05;
  meta.extractors.rotation.y = meta.recoil * .12;
  meta.barrels.rotation.z = Math.sin(time * 1.7) * .002;
  meta.materials.ember.emissiveIntensity = 2.8 + meta.heat * 5.2 + Math.sin(time * 7) * .16;
  meta.sockets.muzzleFlash.visible = meta.flash > .012;
  meta.sockets.muzzleFlash.scale.setScalar(.72 + meta.flash * 1.35);
  meta.sockets.muzzleFlash.rotation.z = Math.sin(time * 27) * .18;
  if (state?.inspect) meta.sockets.inspect.rotation.y = Math.sin(time * .8) * .08;
}

