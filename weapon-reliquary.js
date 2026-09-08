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
  skull.position.set(0, .04, .51);
  const skullContour = [
    [-.15, -.045], [-.16, .04], [-.115, .125], [-.065, .165], [0, .19],
    [.065, .165], [.115, .125], [.16, .04], [.15, -.045],
    [.085, -.085], [.035, -.03], [-.035, -.03], [-.085, -.085]
  ];
  add(skull, profile(skullContour, .09, .01, [[-.078, .045, .043, .027], [.078, .045, .043, .027]]), 'bone');
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
  muzzle.position.set(0, .015, -1.24);
  recoilCarriage.add(muzzle);
  const projectileOrigin = new THREE.Object3D();
  projectileOrigin.name = 'projectileOrigin';
  projectileOrigin.position.set(0, .015, -1.26);
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

  const home = new Map();
  const explode = amount => {
    for (const p of Object.values(parts)) {
      if (!home.has(p)) home.set(p, p.position.clone());
      const dir = p.position.clone().add(new THREE.Vector3(p.name.includes('skull') ? 0 : Math.sin(p.position.z * 11) * .08, .03, .14)).normalize();
      p.position.copy(home.get(p)).addScaledVector(dir, amount * (.035 + Math.abs(p.position.z) * .03));
    }
  };
  root.userData.sculptRuntime = {
    parts, sockets, materials,
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
    parts, sockets, materials, recoilCarriage, core, barrel,
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
