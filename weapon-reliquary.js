import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// Image-guided stylized reconstruction: a ribcage / skull rocket launcher.
// Coordinate contract: +Y up, -Z is the projectile direction.
const V = p => new THREE.Vector3(...p);

function sweep(points, radii, sides = 9) {
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

function profile(points, depth, bevel = .012, holes = []) {
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
    group.add(mesh);
  }
}

function makeSurfaceMaps(seed = 17) {
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
      const broad = Math.sin(x * .17 + Math.sin(y * .06) * 2.2) * .5 + .5;
      const streak = Math.sin((x + y * .22) * .47) * .5 + .5;
      const pit = Math.max(0, fine - .78) * 3.2;
      const value = Math.max(46, Math.min(255, 214 + broad * 24 + streak * 12 - pit * 95));
      const cavity = Math.max(20, Math.min(255, 168 + broad * 42 - pit * 110));
      const relief = Math.max(0, Math.min(255, 128 + (broad - .5) * 70 + (fine - .5) * 22 - pit * 65));
      albedo[i] = value; albedo[i + 1] = Math.max(0, value - 8); albedo[i + 2] = Math.max(0, value - 18); albedo[i + 3] = 255;
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
let sharedSurfaceMaps;
function getSurfaceMaps() {
  return sharedSurfaceMaps || (sharedSurfaceMaps = makeSurfaceMaps());
}

function applySurfaceMaps(materials, maps) {
  for (const key of ['iron', 'ironEdge', 'bone', 'boneDark', 'leather', 'brass']) {
    const material = materials[key];
    if (!material) continue;
    material.map = maps.albedo;
    material.roughnessMap = maps.roughness;
    material.bumpMap = maps.bump;
    material.bumpScale = key === 'bone' ? .022 : key === 'leather' ? .016 : .009;
    material.needsUpdate = true;
  }
}

function addWearColors(root, seed = 23) {
  root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.material?.map || !mesh.geometry.attributes.position) return;
    const position = mesh.geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const n = Math.sin((i + seed) * 12.9898) * .5 + .5;
      const v = .82 + n * .18;
      colors[i * 3] = v;
      colors[i * 3 + 1] = v * .97;
      colors[i * 3 + 2] = v * .91;
    }
    mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    mesh.material.vertexColors = true;
    mesh.material.needsUpdate = true;
  });
}

function makeMaterials() {
  return {
    iron: new THREE.MeshStandardMaterial({color: 0x3a3033, roughness: .52, metalness: .68}),
    ironEdge: new THREE.MeshStandardMaterial({color: 0x8b716a, roughness: .34, metalness: .84}),
    bone: new THREE.MeshStandardMaterial({color: 0xd1bea0, roughness: .9, metalness: 0}),
    boneDark: new THREE.MeshStandardMaterial({color: 0x795d48, roughness: .94, metalness: 0}),
    leather: new THREE.MeshStandardMaterial({color: 0x291217, roughness: .82, metalness: .03}),
    soot: new THREE.MeshStandardMaterial({color: 0x060609, roughness: .97, metalness: 0}),
    brass: new THREE.MeshStandardMaterial({color: 0x8d5025, roughness: .38, metalness: .8}),
    ember: new THREE.MeshStandardMaterial({
      color: 0xff1739, emissive: 0xff092e, emissiveIntensity: 2.8,
      roughness: .3, metalness: .15
    }),
    muzzle: new THREE.MeshStandardMaterial({
      color: 0xff5a32, emissive: 0xff1f0b, emissiveIntensity: 3.8,
      transparent: true, opacity: .95, roughness: .18
    })
  };
}

export function createReliquary(options = {}) {
  const root = new THREE.Group();
  root.name = 'Reliquary';
  const parts = {};
  const materials = makeMaterials();
  const textures = getSurfaceMaps();
  applySurfaceMaps(materials, textures);
  const part = (name, parent = root) => {
    const g = new THREE.Group();
    g.name = name;
    g.userData.explodeWithParent = true;
    parent.add(g);
    parts[name] = g;
    return g;
  };
  const add = (parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], name = '') => {
    const mesh = new THREE.Mesh(geometry, materials[material]);
    mesh.name = name || (parent.name + '-surface-' + parent.children.length);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.userData.explodeWithParent = true;
    parent.add(mesh);
    return mesh;
  };

  const receiver = part('receiver');
  add(receiver, new THREE.BoxGeometry(.34, .28, .5), 'iron', [0, .02, -.03], [1, 1, 1], [0, 0, 0], 'receiver-shell');
  add(receiver, new THREE.BoxGeometry(.385, .065, .43), 'ironEdge', [0, .16, -.04], [1, 1, 1], [0, 0, 0], 'receiver-top-rail');
  add(receiver, new THREE.BoxGeometry(.385, .065, .43), 'ironEdge', [0, -.14, -.04], [1, 1, 1], [0, 0, 0], 'receiver-under-rail');
  add(receiver, new THREE.BoxGeometry(.03, .17, .36), 'brass', [-.19, 0, -.05], [1, 1, 1], [0, 0, 0], 'left-riveted-plate');
  add(receiver, new THREE.BoxGeometry(.03, .17, .36), 'brass', [.19, 0, -.05], [1, 1, 1], [0, 0, 0], 'right-riveted-plate');
  for (const side of [-1, 1]) {
    for (const y of [-.075, .075]) add(receiver, new THREE.SphereGeometry(.018, 8, 6), 'brass', [side * .205, y, -.1]);
  }

  const recoilCarriage = part('recoil-carriage');
  const barrel = part('barrel', recoilCarriage);
  add(barrel, new THREE.CylinderGeometry(.17, .205, .9, 14), 'iron', [0, .015, -.59], [1, 1, 1], [Math.PI / 2, 0, 0], 'barrel-core');
  add(barrel, new THREE.CylinderGeometry(.105, .105, .84, 12, 1, true), 'soot', [0, .015, -.6], [1, 1, 1], [Math.PI / 2, 0, 0], 'barrel-bore');
  add(barrel, new THREE.CylinderGeometry(.21, .225, .28, 10, 1, true), 'boneDark', [0, .015, -.36], [1, 1, 1], [Math.PI / 2, 0, 0], 'barrel-bone-shroud');
  for (const z of [-.28, -.48, -.72, -.96]) {
    add(barrel, new THREE.TorusGeometry(z > -.8 ? .205 : .22, .018, 7, 20), 'ironEdge', [0, .015, z], [1, 1, 1], [Math.PI / 2, 0, 0], 'barrel-collar-' + z);
  }
  const muzzleBrake = part('muzzle-brake', recoilCarriage);
  add(muzzleBrake, new THREE.CylinderGeometry(.22, .245, .18, 12, 1, true), 'ironEdge', [0, .015, -1.03], [1, 1, 1], [Math.PI / 2, 0, 0], 'muzzle-collar');
  add(muzzleBrake, new THREE.TorusGeometry(.235, .04, 8, 24), 'boneDark', [0, .015, -1.08], [1, 1, 1], [Math.PI / 2, 0, 0], 'muzzle-rib');
  add(muzzleBrake, new THREE.TorusGeometry(.19, .023, 8, 24), 'brass', [0, .015, -1.155], [1, 1, 1], [Math.PI / 2, 0, 0], 'muzzle-band');
  add(muzzleBrake, new THREE.CircleGeometry(.16, 16), 'soot', [0, .015, -1.19], [1, 1, 1], [0, Math.PI, 0], 'muzzle-bore');
  add(muzzleBrake, new THREE.TorusGeometry(.145, .014, 7, 20), 'ember', [0, .015, -1.205], [1, 1, 1], [Math.PI / 2, 0, 0], 'muzzle-ember-ring');
  add(muzzleBrake, new THREE.CircleGeometry(.085, 16), 'ember', [0, .015, -1.21], [1, 1, 1], [0, 0, 0], 'muzzle-ember-core');
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const x = Math.cos(a) * .21, y = .015 + Math.sin(a) * .21;
    add(muzzleBrake, new THREE.ConeGeometry(.035, .18, 6), 'bone', [x, y, -1.1], [1, 1, 1], [Math.PI / 2 + Math.sin(a) * .9, Math.cos(a) * .9, a], 'muzzle-tooth-' + i);
  }

  // Keep the front socket deep and readable in first-person: the collar is a compact housing, while the bone silhouette carries the asymmetry.
  muzzleBrake.scale.setScalar(.76);
  muzzleBrake.position.x = .035;
  muzzleBrake.position.y = .012;

  // Muzzle silhouette pass: two asymmetrical bone claws frame the bore and
  // break up the round launcher nose while keeping the projectile socket clear.
  const muzzleClaws = part('muzzle-claws', recoilCarriage);
  muzzleClaws.scale.setScalar(.7);
  muzzleClaws.position.set(.035, .012, 0);
  for (const side of [-1, 1]) {
    add(muzzleClaws, sweep([[side * .12, .16, -.98], [side * .2, .22, -1.05], [side * .25, .16, -1.17], [side * .17, .06, -1.24]], [.036, .043, .03, .004], 8), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], `muzzle-claw-top-${side}`);
    add(muzzleClaws, sweep([[side * .11, -.11, -1.0], [side * .19, -.16, -1.09], [side * .23, -.1, -1.2]], [.023, .031, .004], 8), 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], `muzzle-claw-under-${side}`);
  }

  const ribcage = part('ribcage');
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = .22 - i * .085;
      add(ribcage, sweep([
        [side * .10, .13, z + .04],
        [side * (.2 + i * .008), .12, z + .015],
        [side * (.235 + i * .012), .02, z - .05],
        [side * (.19 + i * .012), -.12, z - .12],
        [side * .08, -.145, z - .15]
      ], [.025, .035, .031, .022, .009], 8), 'bone', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'rib-' + side + '-' + i);
    }
  }
  const sternum = part('sternum', ribcage);
  for (let i = 0; i < 5; i++) {
    const z = .22 - i * .09;
    add(sternum, new THREE.SphereGeometry(1, 9, 7), 'boneDark', [0, .145, z], [.052, .055, .06]);
  }
  const core = part('core');
  add(core, new THREE.SphereGeometry(.095, 16, 10), 'ember', [0, .06, -.025], [1.0, .8, .8], [0, 0, 0], 'reactor-core');
  add(core, new THREE.TorusGeometry(.125, .011, 7, 20), 'brass', [0, .06, -.025], [1, .85, 1], [Math.PI / 2, 0, 0], 'reactor-ring');
  for (let i = 0; i < 3; i++) add(core, new THREE.BoxGeometry(.016, .15, .025), 'ember', [0, .06, -.025], [1, 1, 1], [0, i * Math.PI / 3, 0], 'reactor-spoke-' + i);

  const vents = part('pressure-vents');
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = .06 - i * .062;
      add(vents, new THREE.CylinderGeometry(.026, .026, .05, 10), 'ember', [side * .185, y, -.03], [1, 1, 1], [0, Math.PI / 2, 0], 'vent-' + side + '-' + i);
      add(vents, new THREE.TorusGeometry(.034, .009, 6, 14), 'brass', [side * .215, y, -.03], [1, 1, 1], [0, Math.PI / 2, 0]);
    }
  }

  const vertebrae = part('vertebrae');
  for (let i = 0; i < 7; i++) {
    const z = .12 + i * .082;
    add(vertebrae, new THREE.SphereGeometry(1, 9, 7), 'bone', [0, .12, z], [.055, .047, .05], [0, 0, 0], 'vertebra-' + i);
    for (const side of [-1, 1]) {
      add(vertebrae, sweep([[0, .12, z], [side * .055, .13, z + .015], [side * .11, .11, z + .032]], [.019, .018, .006], 7), 'boneDark', [0, 0, 0], [1, 1, 1], [0, 0, 0], 'vertebra-wing-' + side + '-' + i);
    }
  }

  const stock = part('stock');
  add(stock, profile([[-.12, .1], [.12, .1], [.105, -.06], [.065, -.18], [-.08, -.18], [-.125, -.04]], .28, .018), 'leather', [0, -.02, .32]);
  add(stock, new THREE.BoxGeometry(.22, .06, .28), 'iron', [0, .11, .31]);
  for (let i = 0; i < 6; i++) add(stock, new THREE.TorusGeometry(.08, .008, 5, 16), 'brass', [0, .0, .23 + i * .055], [1, 1, 1], [Math.PI / 2, 0, 0]);
  const grip = part('grip');
  grip.position.set(0, -.13, .05);
  grip.rotation.x = -.22;
  add(grip, profile([[-.085, .08], [.085, .08], [.105, -.28], [.065, -.36], [-.07, -.34], [-.1, -.2]], .2, .018), 'leather', [0, 0, 0]);
  for (let i = 0; i < 7; i++) {
    const y = .02 - i * .045;
    add(grip, sweep([[-.09, y, -.11], [.09, y + .018, -.11], [.09, y + .014, .1], [-.09, y - .01, .1]], [.012, .014, .014, .012], 6), 'boneDark');
  }
  const guard = part('trigger-guard');
  add(guard, sweep([[0, -.05, -.23], [0, -.22, -.19], [0, -.26, -.04], [0, -.2, .12], [0, -.06, .16]], [.018, .022, .02, .018, .015], 8), 'ironEdge');
  add(guard, sweep([[0, -.07, -.08], [0, -.15, -.105], [0, -.18, -.035]], [.012, .011, .006], 7), 'brass');

  const skull = part('skull-stock');
  skull.position.set(-.12, .085, .43);
  skull.scale.setScalar(.58);
  skull.rotation.y = .34;
  const skullContour = [
    [-.15, -.045], [-.16, .04], [-.115, .125], [-.065, .165], [0, .19],
    [.065, .165], [.115, .125], [.16, .04], [.15, -.045],
    [.085, -.085], [.035, -.03], [-.035, -.03], [-.085, -.085]
  ];
  add(skull, profile(skullContour, .09, .01, [[-.078, .045, .043, .027], [.078, .045, .043, .027]]), 'bone');
  // A shallow extruded mask looked paper-thin at the player's inspect angle.
  // The dome and layered facial planes keep the rear death mask dimensional.
  add(skull, new THREE.SphereGeometry(1, 18, 12), 'boneDark', [0, .07, .02], [.15, .14, .1]);
  for (const side of [-1, 1]) {
    add(skull, sweep([[side * .14, .03, .045], [side * .1, .12, .035], [side * .03, .14, .04]], [.02, .028, .014], 8), 'bone');
    add(skull, sweep([[side * .12, -.015, .045], [side * .085, -.075, .05], [side * .025, -.09, .045]], [.017, .024, .009], 8), 'bone');
    add(skull, new THREE.TorusGeometry(.046, .008, 6, 18), 'bone', [side * .078, .045, .083], [1, .72, 1]);
  }
  add(skull, sweep([[0, .12, .04], [0, .055, .055], [0, -.02, .052]], [.019, .022, .011], 8), 'bone');
  for (const side of [-1, 1]) {
    add(skull, new THREE.SphereGeometry(1, 12, 8), 'soot', [side * .078, .045, .052], [.043, .026, .024]);
    add(skull, new THREE.SphereGeometry(1, 10, 7), 'ember', [side * .078, .045, .076], [.019, .012, .011]);
    add(skull, sweep([[side * .145, -.01, .035], [side * .11, .075, .0], [side * .035, .105, .015]], [.023, .027, .014], 7), 'bone');
  }
  const jaw = part('skull-jaw', skull);
  add(jaw, sweep([[-.12, -.07, .03], [-.09, -.16, .0], [0, -.18, -.005], [.09, -.16, .0], [.12, -.07, .03]], [.018, .023, .025, .023, .018]), 'bone');
  for (let i = 0; i < 5; i++) add(jaw, sweep([[(i - 2) * .027, -.16, .0], [(i - 2) * .027, -.13, -.008]], [.011, .004], 6), 'bone');
  const horns = part('horns', skull);
  for (const side of [-1, 1]) {
    add(horns, sweep([
      [side * .1, .12, .045], [side * .16, .2, .06], [side * .18, .29, .02],
      [side * .145, .35, -.08], [side * .08, .37, -.15]
    ], [.038, .04, .03, .018, .002], 9), 'boneDark');
  }

  const cables = part('cables');
  for (const side of [-1, 1]) {
    add(cables, sweep([[side * .18, .06, -.15], [side * .28, .04, -.1], [side * .32, -.04, .04], [side * .2, -.12, .3]], [.012, .014, .011, .005], 7), 'leather');
    add(cables, sweep([[side * .2, .1, -.18], [side * .3, .11, -.04], [side * .28, .13, .2]], [.008, .009, .006], 6), 'brass');
  }
  const sight = part('sight-rail');
  add(sight, new THREE.BoxGeometry(.035, .035, .53), 'ironEdge', [0, .205, -.36]);
  add(sight, new THREE.BoxGeometry(.08, .05, .035), 'bone', [0, .24, -.62]);
  add(sight, new THREE.BoxGeometry(.08, .05, .035), 'bone', [0, .24, -.2]);

  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(.035, .027, -.9);
  recoilCarriage.add(muzzle);
  const projectileOrigin = new THREE.Object3D();
  projectileOrigin.name = 'projectileOrigin';
  projectileOrigin.position.set(.035, .027, -.92);
  recoilCarriage.add(projectileOrigin);
  const muzzleFlash = part('muzzle-flash', recoilCarriage);
  muzzleFlash.visible = false;
  add(muzzleFlash, new THREE.ConeGeometry(.15, .5, 8), 'muzzle', [0, .015, -1.47], [1, 1, 1], [Math.PI / 2, 0, 0], 'flash-cone');
  add(muzzleFlash, new THREE.TorusGeometry(.2, .022, 6, 20), 'muzzle', [0, .015, -1.25], [1, 1, 1], [Math.PI / 2, 0, 0], 'flash-ring');
  const explosion = new THREE.Object3D();
  explosion.name = 'explosion';
  explosion.position.copy(projectileOrigin.position);
  recoilCarriage.add(explosion);
  const heat = new THREE.Object3D();
  heat.name = 'heat';
  heat.position.set(0, .015, -.96);
  recoilCarriage.add(heat);
  const inspect = new THREE.Object3D();
  inspect.name = 'inspect';
  inspect.position.set(0, .1, .25);
  root.add(inspect);
  const sockets = {muzzle, projectileOrigin, muzzleFlash, recoil: recoilCarriage, heat, inspect, grip, corePulse: core, explosion};
  root.userData.muzzle = muzzle;
  root.userData.projectileOrigin = projectileOrigin;

  // Keep articulated groups separate while collapsing their static surfaces by
  // material. This makes the hero weapon detailed without ballooning draw calls.
  for (const group of Object.values(parts)) compactGroup(group);
  addWearColors(root);

  const home = new Map();
  const explode = amount => {
    for (const p of Object.values(parts)) {
      if (!home.has(p)) home.set(p, p.position.clone());
      const dir = p.position.clone().add(new THREE.Vector3(p.name.includes('skull') ? 0 : Math.sin(p.position.z * 11) * .08, .03, .14)).normalize();
      p.position.copy(home.get(p)).addScaledVector(dir, amount * (.035 + Math.abs(p.position.z) * .03));
    }
  };
  root.userData.sculptRuntime = {
    parts, sockets, materials, textures,
    collider: {type: 'capsule', size: [.42, .82, 1.48]},
    explode,
    pick(raycaster) {
      const hit = raycaster.intersectObject(root, true)[0];
      return hit?.object?.parent?.name || hit?.object?.name || null;
    }
  };
  root.userData.reliquary = {
    kind: 'reliquary',
    variant: options.variant || 'bone-rocket',
    parts, sockets, materials, textures, recoilCarriage, core, barrel,
    recoil: 0, flash: 0, heat: 0, charge: 0, lastShot: 0
  };
  return root;
}

export function animateReliquary(root, shot = 0, time = 0, dt = .016, state = {}) {
  const meta = root?.userData?.reliquary;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) {
    meta.recoil = 1;
    meta.flash = 1;
    meta.heat = Math.min(1, meta.heat + .34);
  }
  meta.lastShot = shotValue;
  meta.recoil = THREE.MathUtils.damp(meta.recoil, 0, 13, delta);
  meta.flash = Math.max(0, meta.flash - delta * 8);
  meta.heat = THREE.MathUtils.damp(meta.heat, 0, 1.3, delta);
  meta.recoilCarriage.position.z = meta.recoil * .065;
  meta.recoilCarriage.rotation.x = meta.recoil * -.018;
  meta.core.rotation.z += delta * (1.4 + meta.heat * 5.2);
  meta.core.scale.setScalar(1 + meta.heat * .08 + Math.sin(time * 5.5) * .018);
  meta.materials.ember.emissiveIntensity = 2.2 + meta.heat * 4.4 + Math.sin(time * 6.5) * .18;
  meta.materials.muzzle.emissiveIntensity = 2.2 + meta.flash * 8;
  meta.sockets.muzzleFlash.visible = meta.flash > .012;
  meta.sockets.muzzleFlash.scale.setScalar(.7 + meta.flash * 1.25);
  meta.sockets.muzzleFlash.rotation.z = Math.sin(time * 29) * .18;
  if (state.inspect) meta.sockets.inspect.rotation.y = Math.sin(time * .8) * .08;
}
