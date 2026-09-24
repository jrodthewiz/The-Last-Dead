import * as THREE from './vendor/three.module.js';
import { applyWeaponMaterialProfile, tagWeaponMechanism } from './weapon-materials.js';

// First-person melee kit.  The origin is the main hand socket, +Y is up and
// -Z points into the room.  The factories stay code-native so the gameplay
// pass can reuse the same geometry, materials, and animation contract in solo
// and co-op without loading a model at runtime.

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => value * value * (3 - 2 * value);
const damp = (value, target, lambda, dt) => THREE.MathUtils.damp(value, target, lambda, dt);

function part(name, parent, parts, mechanism = null, axis = 'z') {
  const node = new THREE.Group();
  node.name = name;
  node.userData.explodeWithParent = true;
  if (mechanism) tagWeaponMechanism(node, mechanism, axis);
  parent.add(node);
  parts[name] = node;
  return node;
}

function add(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], name = '') {
  const node = new THREE.Mesh(geometry, material);
  node.name = name || `${parent.name}-surface-${parent.children.length}`;
  node.position.set(...position);
  node.rotation.set(...rotation);
  node.scale.set(...scale);
  node.castShadow = false;
  node.receiveShadow = false;
  node.userData.explodeWithParent = true;
  parent.add(node);
  return node;
}

function profile(points, depth, bevel = .012, curveSegments = 5) {
  const shape = new THREE.Shape(points.map(point => new THREE.Vector2(...point)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: Math.min(bevel, depth * .34),
  });
  geometry.translate(0, 0, -depth * .5);
  return geometry;
}

function sweep(points, radii, sides = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const steps = Math.max(8, (points.length - 1) * 4);
  const frames = curve.computeFrenetFrames(steps, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const q = t * (radii.length - 1);
    const index = Math.min(radii.length - 2, Math.floor(q));
    const radius = THREE.MathUtils.lerp(radii[index], radii[index + 1], q - index);
    const center = curve.getPointAt(t);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const point = center.clone()
        .addScaledVector(frames.normals[i], Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
      positions.push(point.x, point.y, point.z);
      uvs.push(j / sides, t);
      if (i < steps && j < sides) {
        const n = i * (sides + 1) + j;
        indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function tube(parent, points, radii, material, sides = 8, name = 'tube') {
  const values = Array.isArray(radii) ? radii : points.map(() => radii);
  return add(parent, sweep(points, values, sides), material, [0, 0, 0], [0, 0, 0], [1, 1, 1], name);
}

function socket(parent, name, position) {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.set(...position);
  node.userData.viewmodelAnchor = true;
  parent.add(node);
  return node;
}

function makeMaterial(color, roughness, metalness, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

function palette(variant) {
  if (variant === 'chainsaw') {
    return {
      wood: 0x4d2d20, steel: 0x758086, edge: 0xb3b9aa, iron: 0x303a3e,
      black: 0x151819, rubber: 0x252526, brass: 0x99683d, danger: 0x762d2a,
      red: 0xa33a32, glow: 0xff6a36,
    };
  }
  return {
    wood: 0x67402b, steel: 0x868b87, edge: 0xc2ae8c, iron: 0x47413c,
    black: 0x171817, rubber: 0x30251e, brass: 0x9a6f42, danger: 0x6d2927,
    red: 0x8c3932, glow: 0xe65837,
  };
}

function materialsFor(variant) {
  const p = palette(variant);
  return {
    wood: makeMaterial(p.wood, .84, .03),
    steel: makeMaterial(p.steel, .54, .7),
    edge: makeMaterial(p.edge, .4, .8),
    iron: makeMaterial(p.iron, .7, .62),
    black: makeMaterial(p.black, .9, .16),
    rubber: makeMaterial(p.rubber, .92, .03),
    brass: makeMaterial(p.brass, .48, .76),
    danger: makeMaterial(p.danger, .62, .3),
    red: makeMaterial(p.red, .53, .32),
    glow: makeMaterial(p.glow, .4, .12, p.glow, .08),
  };
}

let sharedWoodMap;
let sharedTextureReady = Promise.resolve();

function sharedTexture() {
  if (sharedWoodMap !== undefined) return sharedWoodMap;
  sharedWoodMap = null;
  if (typeof document === 'undefined' || !THREE.TextureLoader) return null;
  try {
    let resolveReady;
    sharedTextureReady = new Promise(resolve => { resolveReady = resolve; });
    const done = () => resolveReady();
    const loader = new THREE.TextureLoader();
    sharedWoodMap = loader.load('./assets/textures/afterlife-cabinet-wood-v1.webp', texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1.25, 1.55);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.userData.sharedAsset = true;
      texture.needsUpdate = true;
      done();
    }, undefined, done);
  } catch {
    sharedWoodMap = null;
    sharedTextureReady = Promise.resolve();
  }
  return sharedWoodMap;
}

function finishMaterials(materials, variant) {
  const profileOverrides = variant === 'chainsaw' ? {
    wood: { roughness: .86, metalness: .03, envMapIntensity: .18, colorScale: .96 },
    steel: { roughness: .54, metalness: .68, envMapIntensity: .56, colorScale: .96 },
    edge: { roughness: .4, metalness: .78, envMapIntensity: .52, colorScale: .9 },
    iron: { roughness: .68, metalness: .58, envMapIntensity: .34, colorScale: .97 },
    black: { roughness: .9, metalness: .15, envMapIntensity: .18, colorScale: 1 },
    rubber: { roughness: .9, metalness: .02, envMapIntensity: .15, colorScale: 1 },
    brass: { roughness: .48, metalness: .74, envMapIntensity: .4, colorScale: .92 },
    danger: { roughness: .6, metalness: .28, envMapIntensity: .22, colorScale: .98 },
    red: { roughness: .52, metalness: .3, envMapIntensity: .26, colorScale: 1 },
    glow: { roughness: .4, metalness: .1, envMapIntensity: .2, colorScale: 1 },
  } : {
    wood: { roughness: .84, metalness: .03, envMapIntensity: .2, colorScale: 1 },
    steel: { roughness: .58, metalness: .66, envMapIntensity: .5, colorScale: .98 },
    edge: { roughness: .42, metalness: .78, envMapIntensity: .48, colorScale: .9 },
    iron: { roughness: .7, metalness: .52, envMapIntensity: .3, colorScale: 1 },
    black: { roughness: .9, metalness: .14, envMapIntensity: .16, colorScale: 1 },
    rubber: { roughness: .9, metalness: .02, envMapIntensity: .14, colorScale: 1 },
    brass: { roughness: .5, metalness: .74, envMapIntensity: .38, colorScale: .92 },
    danger: { roughness: .64, metalness: .26, envMapIntensity: .2, colorScale: 1 },
    red: { roughness: .55, metalness: .28, envMapIntensity: .24, colorScale: 1 },
    glow: { roughness: .42, metalness: .1, envMapIntensity: .2, colorScale: 1 },
  };
  applyWeaponMaterialProfile(materials, profileOverrides);
  const map = sharedTexture();
  if (map) {
    materials.wood.map = map;
    materials.wood.needsUpdate = true;
  }
}

function countDiagnostics(root, variant, materials, mechanisms) {
  let meshes = 0;
  let triangles = 0;
  const geometries = new Set();
  root.traverse(node => {
    if (!node.isMesh) return;
    meshes += 1;
    geometries.add(node.geometry);
    triangles += Math.round((node.geometry.index?.count || node.geometry.attributes.position?.count || 0) / 3) * (node.count || 1);
  });
  return {
    asset: `melee-${variant}-v1`,
    variant,
    meshes,
    triangles,
    geometries: geometries.size,
    materials: Object.keys(materials).length,
    textures: sharedWoodMap ? 1 : 0,
    mechanisms: Object.keys(mechanisms),
    budget: { targetTriangles: 12000, staticBatchSafe: true },
  };
}

function finish(root, variant, parts, materials, sockets, mechanisms, extra = {}) {
  finishMaterials(materials, variant);
  for (const [name, node] of Object.entries(sockets)) root.userData[name] = node;
  const diagnostics = countDiagnostics(root, variant, materials, mechanisms);
  const meta = {
    variant,
    parts,
    materials,
    sockets,
    mechanisms,
    diagnostics,
    lastSequence: 0,
    swingValue: 0,
    contactValue: 0,
    chainPhase: 0,
    restCaptured: false,
    restPosition: new THREE.Vector3(),
    restRotation: new THREE.Euler(),
    ...extra,
  };
  root.userData.resourcesReady = sharedTextureReady;
  root.userData.melee = meta;
  root.userData.meleeMechanisms = mechanisms;
  root.userData.diagnostics = diagnostics;
  root.userData.weaponDynamic = false;
  return root;
}

function createBat() {
  const root = new THREE.Group();
  root.name = 'BatteredBat';
  const parts = {};
  const materials = materialsFor('bat');

  const body = part('bat-body', root, parts);
  // The origin lives between the hands; the barrel leans into -Z so it stays
  // out of the reticle at rest while retaining a large, readable strike arc.
  add(body, new THREE.CylinderGeometry(.16, .082, .78, 18), materials.wood, [0, .015, -.35], [Math.PI / 2, 0, 0], [1, 1, 1], 'hardwood-barrel');
  add(body, new THREE.SphereGeometry(.16, 16, 10), materials.wood, [0, .015, -.73], [0, 0, 0], [.98, .98, .62], 'splintered-bat-head');
  add(body, new THREE.CylinderGeometry(.145, .145, .04, 18), materials.edge, [0, .015, -.86], [Math.PI / 2, 0, 0], [1, 1, 1], 'steel-impact-cap');
  add(body, new THREE.CylinderGeometry(.12, .12, .022, 16), materials.black, [0, .015, -.884], [Math.PI / 2, 0, 0], [1, 1, 1], 'impact-face');

  const ferrule = part('bat-metal-bands', root, parts, 'bat-band-flex', 'z');
  for (const [index, z] of [-.08, -.53, -.72].entries()) {
    add(ferrule, new THREE.TorusGeometry(index === 2 ? .154 : .128, .014 + index * .002, 7, 20), materials.edge, [0, .015, z], [0, 0, 0], [1, 1, 1], `steel-band-${index}`);
    add(ferrule, new THREE.TorusGeometry(index === 2 ? .142 : .116, .006, 6, 16), materials.brass, [0, .015, z + .012], [0, 0, 0], [1, 1, 1], `band-inset-${index}`);
  }

  const handle = part('bat-handle', root, parts);
  tube(handle, [[0, -.03, .31], [0, -.055, .17], [0, -.06, .01]], [.076, .082, .072], materials.wood, 9, 'wooden-handle');
  for (let i = 0; i < 5; i++) {
    const z = .015 + i * .057;
    add(handle, new THREE.TorusGeometry(.078 - i * .001, .009, 6, 16), materials.rubber, [0, -.06, z], [Math.PI / 2, 0, 0], [1, 1, 1], `grip-wrap-${i}`);
  }
  add(handle, new THREE.CylinderGeometry(.085, .085, .055, 12), materials.edge, [0, -.06, -.035], [Math.PI / 2, 0, 0], [1, 1, 1], 'pommel-ring');

  const damage = part('bat-wear', root, parts);
  for (const [i, p] of [
    [.058, .11, .022, -.34], [-.07, .075, -.018, -.48], [.052, -.01, .02, -.62],
    [-.045, .08, -.018, -.75], [.09, .04, -.012, -.19],
  ].entries()) {
    add(damage, new THREE.BoxGeometry(.018, .105, .012), materials.danger, [p[0], p[1], p[3]], [0, .08, p[2]], [1, 1, 1], `wood-gouge-${i}`);
  }
  const rivets = part('bat-rivets', ferrule, parts);
  for (const z of [-.08, -.53, -.72]) for (const side of [-1, 1]) {
    add(rivets, new THREE.SphereGeometry(.018, 8, 5), materials.brass, [side * .096, .094, z], [0, 0, 0], [1, .8, 1], `band-rivet-${z}-${side}`);
  }

  const swingPivot = part('bat-swing-pivot', root, parts, 'bat-swing-pivot', 'y');
  swingPivot.userData.weaponDynamic = true;
  // Contact is already communicated by the world blood/spark pools. Keep a
  // semantic, zero-draw pivot for a restrained material flash instead of
  // adding a floating glowing ring around the bat head.
  const impactPulse = part('impact-pulse', swingPivot, parts, 'bat-impact-pulse', 'scale');
  impactPulse.userData.weaponDynamic = true;
  impactPulse.visible = false;

  const sockets = {
    grip: socket(root, 'grip', [0, -.1, .24]),
    supportGrip: socket(root, 'supportGrip', [0, -.08, .055]),
    impactTip: socket(root, 'impactTip', [0, .015, -.91]),
    projectileOrigin: socket(root, 'projectileOrigin', [0, .015, -.91]),
    inspect: socket(root, 'inspect', [0, .1, -.25]),
  };
  const mechanisms = { swingPivot, ferrule, impactPulse };
  return finish(root, 'bat', parts, materials, sockets, mechanisms, {
    impactPulse,
    swingStyle: 'cross-screen-heavy',
    timeline: { windup: .24, strike: .48, contact: .4, recover: 1 },
  });
}

function chainPath() {
  // A closed, slightly rounded bar loop.  The path is expressed in x/z so
  // every tooth can move around the guide instead of sliding on a line.
  return [
    new THREE.Vector3(-.105, 0, -.16),
    new THREE.Vector3(.105, 0, -.16),
    new THREE.Vector3(.105, 0, -1.18),
    new THREE.Vector3(.075, 0, -1.32),
    new THREE.Vector3(0, 0, -1.405),
    new THREE.Vector3(-.075, 0, -1.32),
    new THREE.Vector3(-.105, 0, -1.18),
  ];
}

function makePathData(points) {
  const segmentLengths = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const length = points[i].distanceTo(points[(i + 1) % points.length]);
    segmentLengths.push(length);
    total += length;
  }
  return { points, segmentLengths, total };
}

function pathSample(pathData, t, position, tangent) {
  const { points, segmentLengths, total } = pathData;
  let distance = ((t % 1) + 1) % 1 * total;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const length = segmentLengths[i];
    if (distance <= length) {
      const u = length ? distance / length : 0;
      position.copy(a).lerp(b, u);
      tangent.copy(b).sub(a).normalize();
      return;
    }
    distance -= length;
  }
  position.copy(points[0]);
  tangent.copy(points[1]).sub(points[0]).normalize();
}

function buildChainLoop(parent, materials) {
  const path = chainPath();
  const pathData = makePathData(path);
  const loop = part('moving-chain-loop', parent, {}, 'chainsaw-chain-loop', 'y');
  loop.userData.weaponDynamic = true;
  const count = 22;
  // Instancing keeps the authored loop readable while reducing the moving
  // chain from 44 independent draw calls to two dynamic matrix buffers.
  const toothGeometry = new THREE.ConeGeometry(.027, .062, 4);
  const teethMesh = new THREE.InstancedMesh(toothGeometry, materials.edge, count);
  teethMesh.name = 'chain-teeth';
  teethMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  teethMesh.userData.weaponDynamic = true;
  tagWeaponMechanism(teethMesh, 'chainsaw-chain-teeth', 'matrix');
  loop.add(teethMesh);
  const linkGeometry = new THREE.BoxGeometry(.037, .018, .07);
  const linksMesh = new THREE.InstancedMesh(linkGeometry, materials.iron, count);
  linksMesh.name = 'chain-links';
  linksMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  linksMesh.userData.weaponDynamic = true;
  tagWeaponMechanism(linksMesh, 'chainsaw-chain-links', 'matrix');
  loop.add(linksMesh);
  const teeth = [];
  const links = [];
  for (let i = 0; i < count; i++) {
    const tooth = new THREE.Object3D();
    tooth.name = `chain-tooth-${i}`;
    tooth.userData.chainOffset = i / count;
    tooth.userData.weaponDynamic = true;
    teeth.push(tooth);
    const link = new THREE.Object3D();
    link.name = `chain-link-${i}`;
    link.userData.chainOffset = (i + .5) / count;
    link.userData.weaponDynamic = true;
    links.push(link);
  }
  loop.userData.path = path;
  loop.userData.pathData = pathData;
  loop.userData.teethMesh = teethMesh;
  loop.userData.linksMesh = linksMesh;
  loop.userData.teeth = teeth;
  loop.userData.links = links;
  loop.userData.samplePosition = new THREE.Vector3();
  loop.userData.sampleTangent = new THREE.Vector3();
  loop.userData.instanceMatrix = new THREE.Matrix4();
  updateChain(loop,0);
  return loop;
}

function createChainsaw() {
  const root = new THREE.Group();
  root.name = 'GravewindChainsaw';
  const parts = {};
  const materials = materialsFor('chainsaw');

  const motor = part('chainsaw-motor', root, parts, 'chainsaw-motor-vibration', 'x');
  motor.userData.weaponDynamic = true;
  add(motor, profile([[-.2, -.18], [.16, -.2], [.22, -.08], [.2, .16], [.1, .22], [-.17, .18], [-.23, .04]], .46, .024), materials.red, [0, .05, .08], [0, 0, 0], [1, 1, 1], 'motor-casing');
  add(motor, profile([[-.14, -.1], [.12, -.12], [.15, .08], [.07, .14], [-.12, .11], [-.16, .01]], .026, .006), materials.iron, [0, .08, .323], [0, 0, 0], [1, 1, 1], 'motor-side-panel');
  for (let i = 0; i < 4; i++) add(motor, new THREE.BoxGeometry(.16, .015, .016), materials.black, [0, -.02 + i * .055, .34], [0, 0, .08], [1, 1, 1], `cooling-vent-${i}`);
  add(motor, new THREE.CylinderGeometry(.06, .06, .025, 12), materials.brass, [.13, .18, .16], [Math.PI / 2, 0, 0], [1, 1, 1], 'fuel-cap');
  add(motor, new THREE.BoxGeometry(.045, .08, .025), materials.edge, [-.17, .02, .33], [0, 0, -.18], [1, 1, 1], 'chain-brake');
  add(motor, new THREE.BoxGeometry(.035, .075, .027), materials.glow, [.18, -.06, .333], [0, 0, .12], [1, 1, 1], 'rev-indicator');

  const rearGrip = part('chainsaw-rear-grip', root, parts);
  add(rearGrip, new THREE.CylinderGeometry(.085, .1, .38, 12), materials.rubber, [0, -.18, .23], [0, 0, 0], [1, 1, 1], 'rear-handle');
  for (let i = 0; i < 4; i++) add(rearGrip, new THREE.TorusGeometry(.088, .009, 6, 14), materials.edge, [0, -.18 - i * .07, .23], [Math.PI / 2, 0, 0], [1, 1, 1], `rear-grip-rib-${i}`);
  const triggerGuard = part('chainsaw-trigger-guard', root, parts);
  tube(triggerGuard, [[0, -.03, .24], [0, -.2, .24], [0, -.27, .17]], [.016, .021, .014], materials.edge, 8, 'trigger-guard');
  add(triggerGuard, new THREE.CapsuleGeometry(.019, .075, 5, 8), materials.brass, [0, -.15, .19], [Math.PI / 2, 0, 0], [1, 1, 1], 'throttle-trigger');

  const frontHandle = part('chainsaw-front-handle', root, parts, 'chainsaw-front-handle', 'z');
  frontHandle.userData.weaponDynamic = true;
  tube(frontHandle, [[-.15, .19, .04], [-.24, .27, -.12], [-.21, .18, -.34], [-.1, .11, -.39]], [.034, .038, .037, .032], materials.rubber, 9, 'wrap-handle');
  tube(frontHandle, [[-.15, .195, .04], [-.24, .275, -.12], [-.21, .185, -.34]], [.011, .011, .011], materials.edge, 7, 'handle-brace');

  const guide = part('chainsaw-guide-bar', root, parts, 'chainsaw-guide-vibration', 'x');
  guide.userData.weaponDynamic = true;
  add(guide, profile([[-.095, -.055], [.095, -.055], [.09, .045], [.045, .08], [-.045, .08], [-.09, .045]], 1.22, .012), materials.steel, [0, .035, -.67], [0, 0, 0], [1, 1, 1], 'steel-guide-bar');
  add(guide, new THREE.BoxGeometry(.035, .018, .96), materials.edge, [0, .115, -.67], [0, 0, 0], [1, 1, 1], 'guide-ridge');
  add(guide, new THREE.CylinderGeometry(.108, .108, .072, 16), materials.iron, [0, .13, -1.36], [Math.PI / 2, 0, 0], [1, 1, 1], 'nose-sprocket');
  add(guide, new THREE.CylinderGeometry(.093, .093, .08, 16), materials.black, [0, .14, -.17], [Math.PI / 2, 0, 0], [1, 1, 1], 'drive-sprocket');

  const chainLoop = buildChainLoop(root, materials);
  parts.chainLoop = chainLoop;
  const bladeLabel = part('blade-markings', guide, parts);
  add(bladeLabel, new THREE.BoxGeometry(.022, .013, .3), materials.brass, [.07, .115, -.75], [0, 0, 0], [1, 1, 1], 'blade-mark');
  add(bladeLabel, new THREE.BoxGeometry(.022, .013, .16), materials.black, [-.065, .116, -1.03], [0, 0, 0], [1, 1, 1], 'blade-wear');

  const sockets = {
    grip: socket(root, 'grip', [0, -.16, .24]),
    supportGrip: socket(root, 'supportGrip', [-.2, .22, -.18]),
    impactTip: socket(root, 'impactTip', [0, .13, -1.43]),
    bladeTip: socket(root, 'bladeTip', [0, .13, -1.43]),
    projectileOrigin: socket(root, 'projectileOrigin', [0, .13, -1.43]),
    inspect: socket(root, 'inspect', [0, .24, .08]),
  };
  const mechanisms = { motor, frontHandle, guide, chainLoop };
  return finish(root, 'chainsaw', parts, materials, sockets, mechanisms, {
    chainLoop,
    chainPath: chainLoop.userData.path,
    chainTeeth: chainLoop.userData.teeth,
    chainLinks: chainLoop.userData.links,
    swingStyle: 'brace-lunge',
    timeline: { windup: .24, strike: .48, contact: .4, recover: 1 },
  });
}

export function createMeleeWeapon({ variant = 'bat' } = {}) {
  return variant === 'chainsaw' ? createChainsaw() : createBat();
}

function captureRest(root, meta) {
  if (meta.restCaptured) return;
  meta.restPosition.copy(root.position);
  meta.restRotation.set(root.rotation.x, root.rotation.y, root.rotation.z, root.rotation.order);
  meta.restCaptured = true;
}

function animateBat(root, meta, frame, time, dt) {
  // Gameplay keeps the last completed progress at 1 while the weapon is
  // idle. Only an explicit active flag should enter the swing timeline;
  // otherwise every hidden/idle viewmodel would remain in its follow-through.
  const active = Boolean(frame.active);
  const progress = active ? clamp(Number(frame.progress) || 0, 0, 1) : 0;
  const reduced = Boolean(frame.reducedMotion);
  const amp = reduced ? .58 : 1;
  const heavy = frame.heavy ? 1 : 0;
  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  if (active) {
    if (progress < .24) {
      const u = smooth(progress / .24);
      // Pull the bat high on the right first.  The authored renderer hold is
      // already diagonal; this local yaw makes the windup read as a committed
      // backswing instead of a small rifle-like recoil.
      yaw = THREE.MathUtils.lerp(-.08, -.88 - heavy * .1, u);
      pitch = THREE.MathUtils.lerp(.02, -.1 - heavy * .06, u);
      roll = THREE.MathUtils.lerp(.02, -.5, u);
      x = THREE.MathUtils.lerp(0, -.035, u);
    } else if (progress < .4) {
      const u = smooth((progress - .24) / .16);
      // The hit frame is authored as the crossing point: the bat comes from
      // screen right, passes the reticle, and finishes its contact low enough
      // to read as a strike rather than an upright pose.
      yaw = THREE.MathUtils.lerp(-.88 - heavy * .1, 1.6 + heavy * .12, u);
      pitch = THREE.MathUtils.lerp(-.1 - heavy * .06, -.5 - heavy * .08, u);
      roll = THREE.MathUtils.lerp(-.5, -.42, u);
      x = THREE.MathUtils.lerp(-.035, .025, u);
      y = THREE.MathUtils.lerp(0, .3 + heavy * .04, u);
      z = THREE.MathUtils.lerp(0, -.055 - heavy * .025, u);
    } else if (progress < .48) {
      const u = smooth((progress - .4) / .08);
      // Let the head continue left and down immediately after contact.  This
      // short follow-through is what sells weight before the longer recovery.
      yaw = THREE.MathUtils.lerp(1.6 + heavy * .12, 1.9 + heavy * .12, u);
      pitch = THREE.MathUtils.lerp(-.5 - heavy * .08, -.7 - heavy * .08, u);
      roll = THREE.MathUtils.lerp(-.42, .1, u);
      x = THREE.MathUtils.lerp(.025, .03, u);
      y = THREE.MathUtils.lerp(.3 + heavy * .04, .1, u);
      z = THREE.MathUtils.lerp(-.055 - heavy * .025, -.08 - heavy * .025, u);
    } else {
      const u = smooth((progress - .48) / .52);
      const decay = 1 - u;
      yaw = THREE.MathUtils.lerp(1.9 + heavy * .12, .05, u);
      pitch = THREE.MathUtils.lerp(-.7 - heavy * .08, .02, u);
      roll = THREE.MathUtils.lerp(.1, .025, u);
      x = .03 * decay;
      y = .1 * decay;
      z = (-.08 - heavy * .025) * decay;
    }
  }
  // Contact comes from authoritative gameplay after collision resolution. Do
  // not flash or imply a hit merely because the visual swing crossed .4.
  const contact = clamp(Number(frame.contact) || 0, 0, 1);
  meta.swingValue = damp(meta.swingValue, active ? Math.max(progress, .04) : 0, 20, dt);
  meta.contactValue = damp(meta.contactValue, contact, 26, dt);
  root.rotation.x = meta.restRotation.x + pitch * amp;
  root.rotation.y = meta.restRotation.y + yaw * amp;
  root.rotation.z = meta.restRotation.z + roll * amp;
  root.position.set(meta.restPosition.x + x * amp, meta.restPosition.y + y * amp, meta.restPosition.z + z * amp);
  const pivot = meta.mechanisms.swingPivot;
  pivot.rotation.y = yaw * .2;
  const pulse = meta.impactPulse;
  pulse.visible = meta.contactValue > .015;
  pulse.scale.setScalar(.82 + meta.contactValue * .5);
  meta.materials.glow.emissiveIntensity = .08 + meta.contactValue * 1.65;
  meta.materials.danger.emissiveIntensity = .01 + meta.contactValue * .14;
  meta.lastSequence = Number(frame.sequence) || meta.lastSequence;
}

function updateChain(loop, phase) {
  const pathData = loop.userData.pathData;
  const samplePosition = loop.userData.samplePosition;
  const sampleTangent = loop.userData.sampleTangent;
  const teethMesh = loop.userData.teethMesh;
  const linksMesh = loop.userData.linksMesh;
  for (let i = 0; i < loop.userData.teeth.length; i++) {
    const tooth = loop.userData.teeth[i];
    pathSample(pathData, (tooth.userData.chainOffset || 0) + phase, samplePosition, sampleTangent);
    tooth.position.set(samplePosition.x, .14, samplePosition.z);
    tooth.rotation.set(Math.PI * .5, Math.atan2(sampleTangent.x, sampleTangent.z), 0);
    tooth.updateMatrix();
    teethMesh.setMatrixAt(i, tooth.matrix);

    const link = loop.userData.links[i];
    pathSample(pathData, (link.userData.chainOffset || 0) + phase, samplePosition, sampleTangent);
    link.position.set(samplePosition.x, .12, samplePosition.z);
    link.rotation.set(0, Math.atan2(sampleTangent.x, sampleTangent.z), 0);
    link.updateMatrix();
    linksMesh.setMatrixAt(i, link.matrix);
  }
  teethMesh.instanceMatrix.needsUpdate = true;
  linksMesh.instanceMatrix.needsUpdate = true;
}

function animateChainsaw(root, meta, frame, time, dt) {
  const active = Boolean(frame.active);
  const progress = active ? clamp(Number(frame.progress) || 0, 0, 1) : 0;
  const reduced = Boolean(frame.reducedMotion);
  const amp = reduced ? .6 : 1;
  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let z = 0;
  if (active) {
    if (progress < .24) {
      const u = smooth(progress / .24);
      yaw = THREE.MathUtils.lerp(-.2, -.48, u);
      pitch = THREE.MathUtils.lerp(-.04, .1, u);
      roll = THREE.MathUtils.lerp(.01, -.18, u);
    } else if (progress < .48) {
      const u = smooth((progress - .24) / .24);
      yaw = THREE.MathUtils.lerp(-.48, .46, u);
      pitch = THREE.MathUtils.lerp(.1, -.12, u);
      roll = THREE.MathUtils.lerp(-.18, .1, u);
      z = THREE.MathUtils.lerp(0, -.095, u);
    } else {
      const u = smooth((progress - .48) / .52);
      const decay = 1 - u;
      yaw = THREE.MathUtils.lerp(.46, .04, u);
      pitch = THREE.MathUtils.lerp(-.12, .015, u);
      roll = THREE.MathUtils.lerp(.1, .02, u);
      z = -.095 * decay;
    }
  }
  const rev = clamp(Number(frame.sawRev) || 0, 0, 1);
  const sawActive = Boolean(frame.sawActive) || rev > .01;
  const contact = clamp(Number(frame.contact) || 0, 0, 1);
  meta.swingValue = damp(meta.swingValue, active ? Math.max(progress, .04) : 0, 18, dt);
  meta.contactValue = damp(meta.contactValue, contact, 28, dt);
  const vibration = (sawActive ? .002 + rev * .007 : 0) * (reduced ? .5 : 1);
  root.rotation.x = meta.restRotation.x + pitch * amp + Math.sin(time * 73) * vibration;
  root.rotation.y = meta.restRotation.y + yaw * amp;
  root.rotation.z = meta.restRotation.z + roll * amp + Math.cos(time * 61) * vibration * .65;
  root.position.set(meta.restPosition.x + Math.sin(time * 83) * vibration, meta.restPosition.y, meta.restPosition.z + z * amp);
  if(sawActive){
    meta.chainPhase = (meta.chainPhase + (.18 + rev * .8) * dt) % 1;
    updateChain(meta.chainLoop, meta.chainPhase);
  }
  const motor = meta.mechanisms.motor;
  motor.position.x = Math.sin(time * 89) * vibration * 1.2;
  motor.position.y = Math.cos(time * 79) * vibration * .5;
  meta.mechanisms.guide.rotation.x = Math.sin(time * 71) * vibration * .5;
  meta.mechanisms.frontHandle.rotation.z = Math.sin(time * 67) * vibration * .8;
  meta.materials.glow.emissiveIntensity = .08 + rev * 1.4 + meta.contactValue * 1.2;
  meta.materials.red.emissiveIntensity = .01 + rev * .06;
  meta.lastSequence = Number(frame.sequence) || meta.lastSequence;
}

export function animateMeleeWeapon(root, frame = {}, time = 0, dt = .016) {
  const meta = root?.userData?.melee;
  if (!meta) return;
  const delta = clamp(Number(dt) || .016, .001, .1);
  captureRest(root, meta);
  if (meta.variant === 'chainsaw') animateChainsaw(root, meta, frame, Number(time) || 0, delta);
  else animateBat(root, meta, frame, Number(time) || 0, delta);
}
