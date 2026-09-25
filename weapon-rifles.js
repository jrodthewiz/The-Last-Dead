import * as THREE from './vendor/three.module.js';
import { applyWeaponMaterialProfile, tagWeaponMechanism } from './weapon-materials.js';

// First-person rifle kit.  The local frame is shared with the occult weapon
// family: +Y is up, +Z is the player's face, and -Z is the firing direction.
// The two rifles use the same material roles and texture maps, but their
// mechanisms and silhouettes stay deliberately different in the camera.

const damp = (value, target, lambda, dt) => THREE.MathUtils.damp(value, target, lambda, dt);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function material(color, roughness, metalness, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

function part(name, parent, parts, mechanism = null) {
  const node = new THREE.Group();
  node.name = name;
  node.userData.explodeWithParent = true;
  if (mechanism) tagWeaponMechanism(node, mechanism, 'z');
  parent.add(node);
  parts[name] = node;
  return node;
}

function add(parent, geometry, materialValue, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], name = '') {
  const node = new THREE.Mesh(geometry, materialValue);
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

function profile(points, depth, bevel = .018, curveSegments = 6) {
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

function sweep(points, radii, sides = 10) {
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

function tube(parent, points, radius, materialValue, sides = 10, name = 'tube') {
  const radii = Array.isArray(radius) ? radius : points.map(() => radius);
  return add(parent, sweep(points, radii, sides), materialValue, [0, 0, 0], [0, 0, 0], [1, 1, 1], name);
}

function ring(parent, radius, tubeRadius, position, materialValue, name) {
  return add(parent, new THREE.TorusGeometry(radius, tubeRadius, 7, 20), materialValue, position, [0, 0, 0], [1, 1, 1], name);
}

function socket(parent, name, position) {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.set(...position);
  node.userData.viewmodelAnchor = name === 'supportGrip';
  parent.add(node);
  return node;
}

function bolt(parent, position, materialValue, name, radius = .025, length = .09) {
  return add(parent, new THREE.CylinderGeometry(radius, radius * 1.02, length, 12), materialValue, position, [0, 0, Math.PI / 2], [1, 1, 1], name);
}

function basePalette(variant) {
  if (variant === 'mourning') {
  return {
      steel: 0x9aa8a8, edge: 0xc5bda8, panel: 0x727f80, black: 0x101416,
      wood: 0x53382b, brass: 0x9a6b3e, accent: 0x4a2d2f, glow: 0x9d3b3d,
      heat: 0xc65d38,
    };
  }
  return {
    steel: 0xa0acad, edge: 0xc8c0aa, panel: 0x687679, black: 0x111619,
    wood: 0x4b3028, brass: 0xa87543, accent: 0x3c2a2b, glow: 0x97363b,
    heat: 0xd3633d,
  };
}

function commonMaterials(variant) {
  const palette = basePalette(variant);
  return {
    steel: material(palette.steel, .52, .74),
    edge: material(palette.edge, .38, .84),
    panel: material(palette.panel, .68, .48),
    black: material(palette.black, .9, .14),
    wood: material(palette.wood, .82, .04),
    brass: material(palette.brass, .45, .76),
    accent: material(palette.accent, .66, .25),
    glow: material(palette.glow, .43, .12, palette.glow, .12),
    heat: material(palette.heat, .4, .15, palette.heat, .1),
  };
}

let sharedMaps;
let sharedTextureReady = Promise.resolve();

function sharedTextureMaps() {
  if (sharedMaps !== undefined) return sharedMaps;
  sharedMaps = null;
  if (typeof document === 'undefined' || !THREE.TextureLoader) return null;
  try {
    const loader = new THREE.TextureLoader();
    let remaining = 2;
    let resolveReady;
    sharedTextureReady = new Promise(resolve => { resolveReady = resolve; });
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) resolveReady();
    };
    const configure = (texture, colorSpace) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1.55, 1.15);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
      texture.userData.sharedAsset = true;
      texture.needsUpdate = true;
      return texture;
    };
    sharedMaps = {
      steel: configure(loader.load('./assets/textures/dread-worn-steel-v1.webp', done, undefined, done), true),
      wood: configure(loader.load('./assets/textures/afterlife-cabinet-wood-v1.webp', done, undefined, done), true),
    };
  } catch {
    sharedMaps = null;
    sharedTextureReady = Promise.resolve();
  }
  return sharedMaps;
}

function applySharedMaps(materials) {
  const maps = sharedTextureMaps();
  if (!maps) return;
  // Keep the worn map on broad steel and wood surfaces.  The edge plates and
  // brass are intentionally un-mapped so their value separation survives the
  // game's deep falloff instead of becoming another dark slab.
  for (const key of ['steel', 'panel']) {
    materials[key].map = maps.steel;
    materials[key].needsUpdate = true;
  }
  materials.wood.map = maps.wood;
  materials.wood.needsUpdate = true;
}

function installViewmodelBounce(materials) {
  // The room's light pool is deliberately restrained.  A small material-owned
  // diffuse response keeps bevels and panel roles readable without adding a
  // light, bloom, or emissive body workaround to the weapon rig.
  const factors = { steel: .26, edge: .34, panel: .3, black: .11, wood: .22, brass: .28, accent: .18 };
  for (const [key, surface] of Object.entries(materials)) {
    const factor = factors[key];
    if (!surface?.isMeshStandardMaterial || !factor) continue;
    surface.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        float rifleViewBounce = .055 + ${factor.toFixed(3)} * pow(max(0., dot(normalize(geometryNormal), normalize(vec3(-.42, .72, .92)))), 1.22);
        reflectedLight.indirectDiffuse += diffuseColor.rgb * rifleViewBounce * (1. - metalnessFactor * .48);
      `);
    };
    surface.customProgramCacheKey = () => `rifle-view-bounce-${key}-v2`;
    surface.needsUpdate = true;
  }
}

function collectDiagnostics(root, variant, materials, sockets, mechanisms) {
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
    asset: `rifle-${variant}-v1`,
    variant,
    meshes,
    triangles,
    geometries: geometries.size,
    materials: Object.keys(materials).length,
    textures: sharedMaps ? Object.keys(sharedMaps).length : 0,
    sockets: ['muzzle', 'projectileOrigin', 'grip', 'supportGrip', 'ejectionSocket'].filter(name => Boolean(sockets[name])),
    mechanisms: Object.keys(mechanisms),
    budget: { targetTriangles: 12000, staticBatchSafe: true },
  };
}

function finish(root, variant, parts, materials, sockets, mechanisms) {
  applyWeaponMaterialProfile(materials, {
    steel: { roughness: .55, metalness: .7, envMapIntensity: .6, colorScale: .94 },
    edge: { roughness: .4, metalness: .8, envMapIntensity: .58, colorScale: .88 },
    panel: { roughness: .65, metalness: .45, envMapIntensity: .4, colorScale: .95 },
    black: { roughness: .9, metalness: .13, envMapIntensity: .16 },
    wood: { roughness: .82, metalness: .03, envMapIntensity: .18 },
    brass: { roughness: .46, metalness: .74, envMapIntensity: .38 },
    accent: { roughness: .65, metalness: .22, envMapIntensity: .2 },
    glow: { roughness: .43, metalness: .1, envMapIntensity: .18 },
    heat: { roughness: .38, metalness: .13, envMapIntensity: .18 },
  });
  applySharedMaps(materials);
  installViewmodelBounce(materials);
  for (const name of ['muzzle', 'projectileOrigin', 'grip', 'supportGrip', 'ejectionSocket']) {
    root.userData[name] = sockets[name];
  }
  root.userData.resourcesReady = sharedTextureReady;
  const diagnostics = collectDiagnostics(root, variant, materials, sockets, mechanisms);
  const meta = {
    variant,
    parts,
    materials,
    sockets,
    mechanisms,
    diagnostics,
    recoil: 0,
    cycle: 0,
    autoHeat: 0,
    heat: 0,
    charge: 0,
    recoilYaw: 0,
    lastShotSequence: 0,
    lastShotValue: 0,
    lastMode: '',
    firePulse: 0,
  };
  root.userData.rifle = meta;
  root.userData.rifleMechanisms = mechanisms;
  root.userData.diagnostics = diagnostics;
  return root;
}

function addRivets(parent, materialValue, positions, name = 'rivet') {
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    add(parent, new THREE.SphereGeometry(.022, 8, 5), materialValue, p, [0, 0, 0], [1, .72, 1], `${name}-${i}`);
  }
}

function buildCarrion() {
  const root = new THREE.Group();
  root.name = 'Carrion';
  const parts = {};
  const materials = commonMaterials('carrion');

  const receiver = part('receiver', root, parts);
  // Camera-side width is trimmed slightly so the compact receiver reads as a
  // stamped firearm instead of a single broad slab around the hands.
  receiver.scale.set(.88, .92, 1);
  add(receiver, profile([[-.24, -.15], [-.22, .12], [-.13, .19], [.12, .19], [.22, .12], [.24, -.14], [.14, -.2], [-.14, -.2]], .5, .026), materials.steel, [0, .02, .02], [0, 0, 0], [1, 1, 1], 'receiver-shell');
  add(receiver, profile([[-.18, -.11], [-.15, .1], [-.07, .14], [.1, .13], [.16, .08], [.16, -.11], [.1, -.14], [-.1, -.14]], .028, .006), materials.edge, [0, .03, .282], [0, 0, 0], [1, 1, 1], 'receiver-stamped-face');
  add(receiver, profile([[-.11, -.055], [.11, -.055], [.13, .025], [.08, .09], [-.07, .1], [-.13, .03]], .014, .003), materials.black, [0, .035, .302], [0, 0, 0], [1, 1, 1], 'receiver-recess');
  add(receiver, profile([[-.14, -.06], [.14, -.06], [.13, .04], [-.12, .04]], .024, .004), materials.panel, [0, .17, .04], [0, 0, 0], [1, 1, 1], 'dust-cover');
  // A dark, recessed port gives the automatic rifle a clear functional read
  // and gives the shell emitter a visible place to leave the receiver.
  add(receiver, new THREE.BoxGeometry(.028, .11, .16), materials.black, [.258, .13, .07], [0, 0, 0], [1, 1, 1], 'ejection-port');
  for (const side of [-1, 1]) {
    add(receiver, profile([[-.055, -.11], [.055, -.11], [.072, .1], [-.072, .1]], .028, .006), materials.panel, [side * .247, .02, .02], [0, side * Math.PI / 2, 0], [1, 1, 1], `receiver-side-plate-${side}`);
    add(receiver, new THREE.CylinderGeometry(.026, .026, .032, 12), materials.brass, [side * .265, .04, -.12], [0, 0, Math.PI / 2], [1, 1, 1], `receiver-rivet-${side}`);
  }
  addRivets(receiver, materials.brass, [[-.16, .12, .29], [.16, .12, .29], [-.18, -.1, .3], [.18, -.1, .3]], 'receiver-fastener');

  const recoilCarriage = part('recoil-carriage', root, parts, 'carrion-recoil-carriage');
  const boltCarrier = part('bolt-carrier', recoilCarriage, parts, 'carrion-reciprocating-bolt');
  add(boltCarrier, profile([[-.12, -.055], [.12, -.055], [.13, .045], [.07, .085], [-.08, .08], [-.13, .035]], .1, .008), materials.edge, [0, .215, .15], [0, 0, 0], [1, 1, 1], 'bolt-body');
  add(boltCarrier, new THREE.CylinderGeometry(.026, .026, .22, 12), materials.black, [0, .23, .07], [0, 0, Math.PI / 2], [1, 1, 1], 'bolt-guide');
  const boltHandle = part('bolt-handle', boltCarrier, parts, 'carrion-bolt-handle');
  boltHandle.position.set(.135, .2, .12);
  bolt(boltHandle, [.045, 0, 0], materials.brass, 'bolt-handle-stem', .018, .09);
  add(boltHandle, new THREE.SphereGeometry(.037, 10, 7), materials.edge, [.09, 0, 0], [0, 0, 0], [1.15, .9, 1], 'bolt-handle-knob');

  const barrel = part('barrel-shroud', recoilCarriage, parts, 'carrion-barrel-shroud');
  add(barrel, new THREE.CylinderGeometry(.135, .18, .76, 18), materials.steel, [0, .04, -.52], [Math.PI / 2, 0, 0], [1, 1, 1], 'short-barrel');
  add(barrel, new THREE.CylinderGeometry(.087, .1, .8, 14, 1, true), materials.black, [0, .04, -.53], [Math.PI / 2, 0, 0], [1, 1, 1], 'barrel-bore');
  for (const [i, z] of [-.27, -.43, -.6, -.76].entries()) ring(barrel, .14 - i * .006, .011, [0, .04, z], materials.edge, `shroud-collar-${i}`);
  const vents = part('heat-vents', barrel, parts, 'carrion-heat-vents');
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z = -.4 - i * .13;
    add(vents, profile([[-.018, -.05], [.018, -.05], [.027, .05], [-.027, .05]], .022, .004), materials.heat, [side * (.13 + i * .008), .08, z], [0, side * .35, 0], [1, 1, 1], `vent-${side}-${i}`);
  }
  const muzzle = part('muzzle-brake', barrel, parts);
  add(muzzle, new THREE.CylinderGeometry(.15, .18, .18, 18), materials.edge, [0, .04, -1.0], [Math.PI / 2, 0, 0], [1, 1, 1], 'muzzle-collar');
  add(muzzle, new THREE.CylinderGeometry(.09, .1, .04, 16, 1, true), materials.black, [0, .04, -1.1], [Math.PI / 2, 0, 0], [1, 1, 1], 'muzzle-bore');
  add(muzzle, new THREE.CircleGeometry(.092, 16), materials.black, [0, .04, -1.122], [0, Math.PI, 0], [1, 1, 1], 'muzzle-aperture');
  ring(muzzle, .16, .014, [0, .04, -1.04], materials.brass, 'muzzle-band');

  const magazine = part('curved-magazine', root, parts);
  // A curved stamped body gives Carrion its compact, forward-driving profile.
  add(magazine, profile([[-.1, .12], [.1, .12], [.12, -.04], [.1, -.17], [.04, -.28], [-.045, -.36], [-.13, -.33], [-.16, -.23], [-.13, -.1]], .2, .022), materials.panel, [0, -.27, .16], [0, 0, 0], [1, 1, 1], 'magazine-shell');
  add(magazine, profile([[-.065, .07], [.065, .07], [.075, -.04], [.05, -.17], [-.025, -.27], [-.09, -.25], [-.105, -.15], [-.08, -.03]], .018, .004), materials.black, [0, -.27, .115], [0, 0, 0], [1, 1, 1], 'magazine-inset');
  for (let i = 0; i < 4; i++) ring(magazine, .045, .006, [0, -.31 - i * .055, .115], materials.edge, `magazine-rib-${i}`);
  const magazineFollower = part('magazine-follower', magazine, parts, 'carrion-magazine-follower');
  add(magazineFollower, new THREE.BoxGeometry(.11, .018, .025), materials.brass, [0, -.1, .13], [0, 0, 0], [1, 1, 1], 'follower');

  const grip = part('grip', root, parts);
  grip.position.set(0, -.16, .18);
  grip.rotation.x = .16;
  add(grip, profile([[-.105, .08], [.105, .08], [.115, -.08], [.085, -.36], [.02, -.43], [-.085, -.37], [-.115, -.08]], .22, .023), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'wood-grip');
  for (let i = 0; i < 5; i++) add(grip, new THREE.BoxGeometry(.21, .012, .012), materials.edge, [0, -.04 - i * .064, .115], [0, 0, 0], [1, 1, 1], `grip-band-${i}`);
  const guard = part('trigger-guard', root, parts);
  tube(guard, [[0, -.01, .02], [0, -.2, .02], [0, -.27, .1], [0, -.18, .22]], [.016, .022, .021, .014], materials.edge, 9, 'trigger-guard-rail');
  const trigger = part('trigger', guard, parts, 'carrion-trigger');
  add(trigger, new THREE.CapsuleGeometry(.016, .085, 5, 8), materials.brass, [0, -.13, .04], [Math.PI / 2, 0, 0], [1, 1, 1], 'trigger-blade');

  const rearBrace = part('rear-brace', root, parts);
  for (const side of [-1, 1]) tube(rearBrace, [[side * .15, .15, .24], [side * .2, .13, .35], [side * .14, .08, .48]], [.022, .026, .017], materials.edge, 9, `brace-rail-${side}`);
  add(rearBrace, profile([[-.12, -.07], [.12, -.07], [.1, .04], [-.1, .04]], .18, .012), materials.panel, [0, .1, .42], [0, 0, 0], [1, 1, 1], 'brace-butt');

  const sockets = {
    // Barrel geometry is authored from the receiver toward negative Z; keep
    // both sockets on the actual brake aperture rather than at the barrel
    // group's origin.  This keeps tracers, impacts, and muzzle flash attached
    // to the visible tip when the whole carriage recoils.
    muzzle: socket(barrel, 'muzzle', [0, .04, -1.125]),
    projectileOrigin: socket(barrel, 'projectileOrigin', [0, .04, -1.14]),
    grip: socket(root, 'grip', [0, -.27, .22]),
    supportGrip: socket(root, 'supportGrip', [-.12, -.27, -.46]),
    heat: socket(barrel, 'heat', [0, .08, -.58]),
    // The shell port lives on the camera-side receiver, just behind the
    // bolt.  Keep this as a dedicated socket so the renderer can place a
    // casing at the authored port while the carriage is cycling.
    ejectionSocket: socket(receiver, 'ejectionSocket', [.255, .115, .08]),
    inspect: socket(root, 'inspect', [0, .1, .22]),
  };
  const mechanisms = { recoilCarriage, boltCarrier, boltHandle, vents, magazineFollower, trigger };
  return finish(root, 'carrion', parts, materials, sockets, mechanisms);
}

function buildMourning() {
  const root = new THREE.Group();
  root.name = 'Mourning';
  const parts = {};
  const materials = commonMaterials('mourning');

  const chassis = part('chassis', root, parts);
  chassis.scale.set(.9, .92, 1);
  add(chassis, profile([[-.22, -.16], [-.2, .12], [-.1, .2], [.12, .19], [.2, .11], [.21, -.15], [.11, -.21], [-.14, -.2]], .56, .028), materials.steel, [0, .02, .02], [0, 0, 0], [1, 1, 1], 'long-receiver');
  add(chassis, profile([[-.17, -.1], [-.15, .11], [-.07, .15], [.09, .14], [.15, .08], [.15, -.1], [.07, -.14], [-.1, -.13]], .028, .006), materials.edge, [0, .035, .31], [0, 0, 0], [1, 1, 1], 'receiver-face');
  add(chassis, profile([[-.11, -.06], [.11, -.06], [.11, .06], [.06, .1], [-.07, .1], [-.12, .05]], .014, .003), materials.black, [0, .04, .33], [0, 0, 0], [1, 1, 1], 'receiver-inset');
  add(chassis, new THREE.BoxGeometry(.028, .1, .17), materials.black, [.248, .13, .08], [0, 0, 0], [1, 1, 1], 'ejection-port');
  for (const side of [-1, 1]) {
    add(chassis, profile([[-.06, -.12], [.06, -.12], [.075, .1], [-.075, .1]], .035, .006), materials.panel, [side * .235, .02, .02], [0, side * Math.PI / 2, 0], [1, 1, 1], `receiver-cheek-${side}`);
    add(chassis, new THREE.CylinderGeometry(.027, .027, .04, 12), materials.brass, [side * .255, .03, -.14], [0, 0, Math.PI / 2], [1, 1, 1], `receiver-bolt-${side}`);
  }
  addRivets(chassis, materials.brass, [[-.16, .12, .34], [.16, .12, .34], [-.18, -.1, .34], [.18, -.1, .34]], 'chassis-rivet');

  const recoilCarriage = part('recoil-carriage', root, parts, 'mourning-recoil-carriage');
  const boltCarrier = part('bolt-carrier', recoilCarriage, parts, 'mourning-exposed-bolt');
  add(boltCarrier, profile([[-.13, -.06], [.13, -.06], [.14, .05], [.08, .095], [-.09, .09], [-.14, .03]], .11, .008), materials.edge, [0, .22, .13], [0, 0, 0], [1, 1, 1], 'bolt-body');
  add(boltCarrier, new THREE.CylinderGeometry(.026, .026, .24, 12), materials.black, [0, .235, .055], [0, 0, Math.PI / 2], [1, 1, 1], 'bolt-rail');
  const chargingLever = part('charging-lever', boltCarrier, parts, 'mourning-charging-lever');
  chargingLever.position.set(.15, .19, .08);
  bolt(chargingLever, [.045, 0, 0], materials.brass, 'charging-stem', .02, .13);
  add(chargingLever, new THREE.SphereGeometry(.043, 10, 7), materials.edge, [.105, 0, 0], [0, 0, 0], [1.15, .85, 1], 'charging-knob');

  const stock = part('wood-stock', root, parts);
  // The long stock remains substantial, but its near-camera shoulder mass is
  // narrowed enough for the wood grain and cheek-rest edge to read separately.
  stock.scale.set(.86, .84, 1);
  add(stock, profile([[-.19, -.16], [.18, -.16], [.18, .04], [.13, .16], [.02, .2], [-.12, .17], [-.2, .08]], .72, .03), materials.wood, [0, -.01, .35], [.09, 0, 0], [1, 1, 1], 'wood-chassis');
  add(stock, profile([[-.17, -.06], [.17, -.06], [.15, .07], [.08, .13], [-.09, .13], [-.16, .07]], .03, .005), materials.panel, [0, .04, .715], [.09, 0, 0], [1, 1, 1], 'stock-cheek-overlay');
  const cheekRest = part('cheek-rest', stock, parts);
  add(cheekRest, profile([[-.14, -.03], [.14, -.03], [.12, .08], [.04, .12], [-.1, .1], [-.15, .05]], .18, .016), materials.wood, [0, .2, .08], [0, 0, 0], [1, 1, 1], 'substantial-cheek-rest');
  add(cheekRest, new THREE.BoxGeometry(.16, .018, .14), materials.edge, [0, .21, .17], [0, 0, 0], [1, 1, 1], 'cheek-rest-edge');

  const barrel = part('barrel-sleeve', recoilCarriage, parts, 'mourning-barrel-sleeve');
  add(barrel, new THREE.CylinderGeometry(.13, .17, 1.22, 20), materials.steel, [0, .05, -.68], [Math.PI / 2, 0, 0], [1, 1, 1], 'long-barrel');
  add(barrel, new THREE.CylinderGeometry(.078, .09, 1.24, 14, 1, true), materials.black, [0, .05, -.69], [Math.PI / 2, 0, 0], [1, 1, 1], 'long-bore');
  for (const [i, z] of [-.17, -.51, -.84, -1.1].entries()) ring(barrel, .15 - i * .008, .012, [0, .05, z], i === 3 ? materials.brass : materials.edge, `barrel-sleeve-ring-${i}`);
  const muzzle = part('muzzle-brake', barrel, parts);
  add(muzzle, new THREE.CylinderGeometry(.16, .19, .22, 18), materials.edge, [0, .05, -1.29], [Math.PI / 2, 0, 0], [1, 1, 1], 'marksman-brake');
  add(muzzle, new THREE.CylinderGeometry(.09, .105, .045, 16, 1, true), materials.black, [0, .05, -1.41], [Math.PI / 2, 0, 0], [1, 1, 1], 'marksman-bore');
  add(muzzle, new THREE.CircleGeometry(.096, 16), materials.black, [0, .05, -1.435], [0, Math.PI, 0], [1, 1, 1], 'marksman-aperture');
  ring(muzzle, .17, .015, [0, .05, -1.34], materials.brass, 'marksman-muzzle-band');

  const magazine = part('box-magazine', root, parts);
  add(magazine, profile([[-.09, .08], [.09, .08], [.1, -.24], [.05, -.31], [-.08, -.27], [-.11, -.12]], .22, .022), materials.panel, [0, -.25, .14], [0, 0, 0], [1, 1, 1], 'box-mag-shell');
  add(magazine, profile([[-.06, .05], [.06, .05], [.065, -.2], [-.05, -.23], [-.07, -.1]], .018, .004), materials.black, [0, -.25, .11], [0, 0, 0], [1, 1, 1], 'box-mag-inset');
  for (let i = 0; i < 3; i++) add(magazine, new THREE.BoxGeometry(.15, .012, .015), materials.edge, [0, -.1 - i * .07, .125], [0, 0, 0], [1, 1, 1], `box-mag-rib-${i}`);

  const grip = part('grip', root, parts);
  grip.position.set(0, -.16, .2);
  grip.rotation.x = .15;
  add(grip, profile([[-.11, .08], [.11, .08], [.12, -.08], [.09, -.38], [.02, -.44], [-.09, -.37], [-.12, -.08]], .24, .024), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'wood-pistol-grip');
  for (let i = 0; i < 5; i++) add(grip, new THREE.BoxGeometry(.22, .012, .012), materials.edge, [0, -.04 - i * .064, .125], [0, 0, 0], [1, 1, 1], `grip-band-${i}`);
  const supportGrip = part('support-grip', root, parts);
  supportGrip.position.set(-.13, -.25, -.65);
  supportGrip.rotation.x = -.12;
  add(supportGrip, profile([[-.08, .07], [.08, .07], [.095, -.22], [.055, -.3], [-.07, -.24], [-.09, -.07]], .19, .018), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'wood-support-grip');

  const optic = part('open-optic', root, parts);
  tagWeaponMechanism(optic, 'mourning-open-optic', 'z');
  tube(optic, [[-.1, .31, .2], [-.1, .34, -.1], [-.1, .34, -.45]], .018, materials.edge, 9, 'optic-left-rail');
  tube(optic, [[.1, .31, .2], [.1, .34, -.1], [.1, .34, -.45]], .018, materials.edge, 9, 'optic-right-rail');
  for (const z of [.16, -.12, -.42]) {
    add(optic, new THREE.BoxGeometry(.24, .025, .035), materials.brass, [0, .33, z], [0, 0, 0], [1, 1, 1], `optic-crossbar-${z}`);
  }
  add(optic, new THREE.TorusGeometry(.088, .012, 7, 16), materials.edge, [0, .34, -.46], [Math.PI / 2, 0, 0], [1, 1, 1], 'optic-aperture');
  const chargeIndicator = part('charge-indicator', root, parts, 'mourning-charge-indicator');
  add(chargeIndicator, new THREE.BoxGeometry(.018, .025, .18), materials.black, [.145, .29, -.28], [0, 0, 0], [1, 1, 1], 'charge-window');
  const chargeBar = add(chargeIndicator, new THREE.BoxGeometry(.012, .014, .15), materials.heat, [.145, .292, -.28], [0, 0, 0], [1, 1, 1], 'charge-bar');
  tagWeaponMechanism(chargeBar, 'mourning-charge-bar', 'z');

  const guard = part('trigger-guard', root, parts);
  tube(guard, [[0, -.01, .02], [0, -.2, .02], [0, -.28, .1], [0, -.18, .23]], [.016, .022, .021, .014], materials.edge, 9, 'trigger-guard-rail');
  const trigger = part('trigger', guard, parts, 'mourning-trigger');
  add(trigger, new THREE.CapsuleGeometry(.016, .09, 5, 8), materials.brass, [0, -.13, .04], [Math.PI / 2, 0, 0], [1, 1, 1], 'trigger-blade');

  const sockets = {
    muzzle: socket(barrel, 'muzzle', [0, .05, -1.44]),
    projectileOrigin: socket(barrel, 'projectileOrigin', [0, .05, -1.46]),
    grip: socket(root, 'grip', [0, -.27, .24]),
    supportGrip: socket(root, 'supportGrip', [-.13, -.27, -.65]),
    heat: socket(barrel, 'heat', [0, .09, -.72]),
    ejectionSocket: socket(chassis, 'ejectionSocket', [.245, .12, .09]),
    inspect: socket(root, 'inspect', [0, .12, .34]),
  };
  const mechanisms = { recoilCarriage, boltCarrier, chargingLever, barrel, optic, chargeIndicator, chargeBar, trigger };
  return finish(root, 'mourning', parts, materials, sockets, mechanisms);
}

/**
 * Build one of the two first-person rifle variations.
 *
 * `carrion` is a compact automatic with a reciprocating bolt and curved mag.
 * `mourning` is a slower marksman rifle with a long sleeve, cheek rest, open
 * optic, exposed bolt and a restrained charge indicator.
 */
export function createRifle({ variant = 'carrion' } = {}) {
  return variant === 'mourning' ? buildMourning() : buildCarrion();
}

/**
 * Animate a rifle without allocating frame objects. `shotSequence` may keep
 * increasing for automatic fire; each change restarts the bolt/recoil pulse.
 * `heat` and `charge` are optional gameplay values in [0,1].
 */
export function animateRifle(root, shot = 0, time = 0, dt = .016, state = {}) {
  const meta = root?.userData?.rifle;
  if (!meta) return;
  const delta = clamp(Number(dt) || .016, .001, .1);
  const shotValue = clamp(Number(shot) || 0, 0, 1);
  const sequence = Number.isFinite(Number(state.shotSequence)) ? Number(state.shotSequence) : meta.lastShotSequence;
  const explicitHeat = clamp(Number(state.heat) || 0, 0, 1);
  const explicitCharge = clamp(Number(state.charge) || 0, 0, 1);
  const explicitKick = clamp(Number(state.kick) || 0, 0, 1.25);
  const explicitKickYaw = clamp(Number(state.kickYaw) || 0, -.2, .2);
  const requestedMode = typeof state.mode === 'string' ? state.mode : '';
  // The renderer updates hidden viewmodels too.  A global shot sequence is
  // useful for automatic fire, but it must only be consumed while this rifle
  // is actually firing or a hidden rifle would cycle when another slot fires.
  if (sequence < meta.lastShotSequence) {
    meta.lastShotSequence = sequence;
    meta.autoHeat = 0;
    meta.recoil = 0;
    meta.cycle = 0;
  }
  const fired = shotValue > .08 && (sequence > meta.lastShotSequence || shotValue > meta.lastShotValue + .08);
  if (fired) {
    meta.lastShotSequence = sequence;
    meta.recoil = 1;
    meta.cycle = 1;
    meta.firePulse = 1;
    meta.autoHeat = Math.min(1, meta.autoHeat + (meta.variant === 'carrion' ? .22 : .34));
    meta.lastMode = requestedMode || meta.lastMode || 'shot';
  }
  // Engine recoil is authoritative when supplied, while the sequence edge
  // above keeps this factory pleasant to use in isolated model previews.
  if (explicitKick > meta.recoil) meta.recoil = explicitKick;
  if (Math.abs(explicitKickYaw) > Math.abs(meta.recoilYaw || 0)) meta.recoilYaw = explicitKickYaw;
  meta.lastShotValue = shotValue;
  meta.recoil = damp(meta.recoil, 0, meta.variant === 'carrion' ? 22 : 15, delta);
  meta.cycle = damp(meta.cycle, 0, meta.variant === 'carrion' ? 18 : 10, delta);
  meta.firePulse = damp(meta.firePulse, 0, 16, delta);
  meta.autoHeat = damp(meta.autoHeat, 0, meta.variant === 'carrion' ? 1.45 : 1.05, delta);
  meta.recoilYaw = damp(meta.recoilYaw || 0, 0, 13, delta);
  meta.heat = damp(meta.heat, Math.max(explicitHeat, meta.autoHeat), 10, delta);
  meta.charge = damp(meta.charge, explicitCharge, 12, delta);

  const cycle = meta.cycle;
  const heat = meta.heat;
  const pulse = meta.firePulse;
  const recoil = meta.recoil;
  const recoilYaw = meta.recoilYaw || 0;
  const modeCycle = meta.lastMode === 'burst' ? 1.16 : meta.lastMode === 'charged' ? 1.1 : 1;
  const parts = meta.parts;
  const materials = meta.materials;
  if (meta.variant === 'carrion') {
    const carriage = meta.mechanisms.recoilCarriage;
    carriage.position.z = recoil * .065;
    carriage.rotation.x = -recoil * .024;
    carriage.rotation.y = recoilYaw * .4;
    meta.mechanisms.boltCarrier.position.z = cycle * .115 * modeCycle;
    meta.mechanisms.boltCarrier.rotation.x = cycle * .05 * modeCycle;
    meta.mechanisms.boltHandle.rotation.x = -cycle * .3 * modeCycle;
    meta.mechanisms.magazineFollower.position.y = cycle * .015;
    meta.mechanisms.vents.rotation.z = Math.sin(time * 22) * heat * .035;
    meta.mechanisms.vents.scale.set(1 + heat * .06, 1 + heat * .04, 1);
    parts['trigger'].rotation.x = -pulse * .12;
    materials.heat.emissiveIntensity = .1 + heat * 1.55 + pulse * 2.4;
    materials.glow.emissiveIntensity = .12 + heat * 1.3 + pulse * 2.2;
  } else {
    const carriage = meta.mechanisms.recoilCarriage;
    carriage.position.z = recoil * .075;
    carriage.rotation.x = -recoil * .026;
    carriage.rotation.y = recoilYaw * .25;
    meta.mechanisms.boltCarrier.position.z = cycle * .14;
    meta.mechanisms.boltCarrier.rotation.x = cycle * .08;
    meta.mechanisms.chargingLever.rotation.x = -cycle * .5;
    meta.mechanisms.chargingLever.position.z = .08 + cycle * .04;
    meta.mechanisms.barrel.scale.set(1 + heat * .012, 1 + heat * .01, 1);
    meta.mechanisms.chargeIndicator.rotation.z = Math.sin(time * 2.2) * .008;
    meta.mechanisms.chargeBar.scale.z = .25 + meta.charge * .75;
    meta.mechanisms.chargeBar.position.z = -.28 - meta.charge * .055;
    parts['trigger'].rotation.x = -pulse * .1;
    materials.heat.emissiveIntensity = .1 + heat * 1.65 + pulse * 2.1;
    materials.glow.emissiveIntensity = .12 + meta.charge * 1.5 + pulse * 1.7;
  }
}
