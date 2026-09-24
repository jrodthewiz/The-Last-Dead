import * as THREE from './vendor/three.module.js';
import {applyWeaponMaterialProfile, tagWeaponMechanism} from './weapon-materials.js';

// The viewmodel is authored around the player's hand: +Y is up and -Z is the
// firing direction. These forms spend the budget on silhouette, bevels, and
// readable mechanical surfaces instead of decorative emitters.
const V = points => points.map(point => new THREE.Vector3(...point));
const damp = (value, target, lambda, dt) => THREE.MathUtils.damp(value, target, lambda, dt);

function material(color, roughness, metalness, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({color, roughness, metalness, emissive, emissiveIntensity});
}

function fxMaterial(color) {
  return new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false});
}

function part(name, parent, parts) {
  const node = new THREE.Group();
  node.name = name;
  node.userData.explodeWithParent = true;
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

function profile(points, depth, bevel = .018, holes = []) {
  const shape = new THREE.Shape(points.map(point => new THREE.Vector2(...point)));
  for (const hole of holes) {
    const path = new THREE.Path();
    path.absellipse(hole[0], hole[1], hole[2], hole[3], 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 10, bevelEnabled: true,
    bevelSegments: 2, bevelSize: bevel, bevelThickness: Math.min(bevel, depth * .32),
  });
  geometry.translate(0, 0, -depth * .5);
  return geometry;
}

function sweep(points, radii, sides = 12) {
  const curve = new THREE.CatmullRomCurve3(V(points));
  const steps = Math.max(12, (points.length - 1) * 5);
  const frames = curve.computeFrenetFrames(steps, false);
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const q = t * (radii.length - 1);
    const a = Math.min(radii.length - 2, Math.floor(q));
    const radius = THREE.MathUtils.lerp(radii[a], radii[a + 1], q - a);
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

function addTube(parent, points, radius, materialValue, sides = 12, name = 'tube') {
  const radii = Array.isArray(radius) ? radius : points.map(() => radius);
  return add(parent, sweep(points, radii, sides), materialValue, [0, 0, 0], [0, 0, 0], [1, 1, 1], name);
}

function addRing(parent, radius, tubeRadius, position, materialValue, name) {
  return add(parent, new THREE.TorusGeometry(radius, tubeRadius, 8, 24), materialValue, position, [0, 0, 0], [1, 1, 1], name);
}

function addLathe(parent, points, segments, materialValue, position, name) {
  const geometry = new THREE.LatheGeometry(points.map(point => new THREE.Vector2(...point)), segments);
  return add(parent, geometry, materialValue, position, [Math.PI / 2, 0, 0], [1, 1, 1], name);
}

function socket(parent, name, position) {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.set(...position);
  node.userData.viewmodelAnchor = name === 'supportGrip';
  parent.add(node);
  return node;
}

function commonMaterials(palette) {
  return {
    // Mid-value metal lets room lighting create the darkness. Black albedo is
    // reserved for cavities and grip seams.
    steel: material(palette.steel, .5, .72),
    edge: material(palette.edge, .38, .84),
    panel: material(palette.panel, .63, .56),
    black: material(palette.black, .9, .12),
    bone: material(palette.bone, .84, 0),
    ceramic: material(palette.ceramic, .42, .12),
    wood: material(palette.wood, .79, .04),
    brass: material(palette.brass, .4, .78),
    accent: material(palette.accent, .58, .28),
    glow: material(palette.glow, .44, .12, palette.glow, .14),
    heat: material(palette.heat, .36, .16, palette.heat, .16),
    muzzle: fxMaterial(palette.muzzle),
    muzzleCore: fxMaterial(palette.muzzleCore),
    muzzleRing: fxMaterial(palette.muzzleRing),
  };
}

let sharedTextureMaps;
let sharedTextureReady = Promise.resolve();

function getSharedTextureMaps() {
  if (sharedTextureMaps !== undefined) return sharedTextureMaps;
  sharedTextureMaps = null;
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
    const configure = (texture, colorSpace = THREE.SRGBColorSpace) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1.8, 1.25);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      if (colorSpace) texture.colorSpace = colorSpace;
      texture.userData.sharedAsset = true;
      texture.needsUpdate = true;
      return texture;
    };
    sharedTextureMaps = {
      steel: configure(loader.load('./assets/textures/dread-worn-steel-v1.webp', done, undefined, done), THREE.SRGBColorSpace),
      wood: configure(loader.load('./assets/textures/afterlife-cabinet-wood-v1.webp', done, undefined, done), THREE.SRGBColorSpace),
    };
  } catch {
    sharedTextureMaps = null;
    sharedTextureReady = Promise.resolve();
  }
  return sharedTextureMaps;
}

function finish(root, kind, parts, materials, sockets, collider) {
  const materialProfile = {
    steel: {roughness: .52, metalness: .44, envMapIntensity: .86},
    edge: {roughness: .38, metalness: .7, envMapIntensity: .92},
    panel: {roughness: .58, metalness: .46, envMapIntensity: .66},
    black: {roughness: .88, metalness: .12, envMapIntensity: .14},
    bone: {roughness: .86, envMapIntensity: .25, colorScale: .96},
    ceramic: {roughness: .4, metalness: .1, envMapIntensity: .28},
    wood: {roughness: .8, metalness: .03, envMapIntensity: .22},
    brass: {roughness: .42, metalness: .76, envMapIntensity: .34},
    accent: {roughness: .58, metalness: .26, envMapIntensity: .2},
    glow: {roughness: .42, metalness: .1, envMapIntensity: .2},
    heat: {roughness: .34, metalness: .12, envMapIntensity: .2},
  };
  // Ossuary and Reliquary need material hierarchy in the dark first-person
  // read. Lift only the warm hand-facing roles; the steel shell stays
  // restrained so the pass does not turn the complete weapon into a bright
  // plate. Breach and Arc keep their existing response.
  if (kind === 'ossuary' || kind === 'reliquary') {
    Object.assign(materialProfile, {
      steel: {roughness: .56, metalness: .52, envMapIntensity: .78, colorScale: .94},
      edge: {roughness: .42, metalness: .68, envMapIntensity: .84, colorScale: .95},
      panel: {roughness: .62, metalness: .4, envMapIntensity: .64, colorScale: .94},
      bone: {roughness: .82, envMapIntensity: .46, colorScale: 1},
      wood: {roughness: .84, metalness: .03, envMapIntensity: .4, colorScale: 1},
      brass: {roughness: .46, metalness: .72, envMapIntensity: .46, colorScale: .96},
    });
  }
  applyWeaponMaterialProfile(materials, materialProfile);
  const textureMaps = getSharedTextureMaps();
  if (textureMaps) {
    for (const key of ['steel', 'edge', 'panel']) {
      materials[key].map = textureMaps.steel;
      materials[key].needsUpdate = true;
    }
    materials.wood.map = textureMaps.wood;
    materials.wood.needsUpdate = true;
  }
  root.userData.muzzle = sockets.muzzle;
  // A broad camera-side bounce belongs to the viewmodel material, so the
  // dark room and light pool stay unchanged. Normal-weighted diffuse fill
  // exposes bevels and machining without emissive metal or another light.
  const bounceKeys = kind === 'ossuary' || kind === 'reliquary'
    ? ['steel', 'edge', 'panel', 'brass', 'wood', 'bone']
    : ['steel', 'edge', 'panel', 'brass', 'wood'];
  for (const key of bounceKeys) {
    const surface = materials[key];
    const bounce = kind === 'ossuary' || kind === 'reliquary'
      ? ({
        steel: {base: .11, strength: .42},
        edge: {base: .14, strength: .46},
        panel: {base: .09, strength: .34},
        brass: {base: .1, strength: .36},
        wood: {base: .14, strength: .3},
        bone: {base: .12, strength: .24},
      }[key] || {base: .1, strength: .3})
      : {base: .12, strength: .42};
    surface.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        float toolBounce = ${bounce.base.toFixed(2)} + ${bounce.strength.toFixed(2)} * pow(max(0., dot(geometryNormal, normalize(vec3(-.35, .65, 1.)))), 1.4);
        reflectedLight.indirectDiffuse += diffuseColor.rgb * toolBounce * (1. - metalnessFactor * .72);
      `);
    };
    surface.customProgramCacheKey = () => `dread-tool-bounce-v2-${kind}-${key}-${bounce.base.toFixed(2)}-${bounce.strength.toFixed(2)}`;
    surface.needsUpdate = true;
  }
  root.userData.projectileOrigin = sockets.projectileOrigin;
  root.userData.resourcesReady = sharedTextureReady;
  root.userData.sculptRuntime = {
    parts, sockets, materials, collider,
    explode(amount = 0) {
      const strength = Number(amount) || 0;
      for (const node of Object.values(parts)) {
        if (!node.userData.explodeHome) node.userData.explodeHome = node.position.clone();
        node.position.copy(node.userData.explodeHome);
        node.position.x += Math.sin(node.position.z * 9.1) * strength * .018;
        node.position.y += strength * .014;
      }
    },
    pick(raycaster) {
      const hit = raycaster?.intersectObject(root, true)?.[0];
      return hit?.object?.parent?.name || hit?.object?.name || null;
    },
  };
  return root;
}

function addMuzzleFx(parent, materials, length = .34) {
  const muzzleFlash = new THREE.Group();
  muzzleFlash.name = 'muzzle-flash';
  muzzleFlash.visible = false;
  muzzleFlash.userData.pooled = true;
  muzzleFlash.userData.weaponBatchIgnore = true;
  const flashCone = add(muzzleFlash, new THREE.ConeGeometry(.12, length, 8), materials.muzzle, [0, 0, -length * .5], [Math.PI / 2, 0, 0], [1, 1, 1], 'flash-cone');
  const flashCore = add(muzzleFlash, new THREE.ConeGeometry(.06, length * .7, 7), materials.muzzleCore, [0, 0, -length * .3], [Math.PI / 2, 0, 0], [1, 1, 1], 'flash-core');
  const flashRing = add(muzzleFlash, new THREE.TorusGeometry(.12, .012, 8, 24), materials.muzzleRing, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'flash-ring');
  parent.add(muzzleFlash);
  return {muzzleFlash, flashCone, flashCore, flashRing};
}

function basePalette(kind) {
  const palettes = {
    ossuary: {steel: 0xbfc5c6, edge: 0xd1c8b1, panel: 0x9aa5a6, black: 0x131619, bone: 0xc0ad8e, ceramic: 0xb8a98b, wood: 0x6a422d, brass: 0xa87840, accent: 0x3e2b2d, glow: 0x9a3037, heat: 0xb64e31, muzzle: 0xff8e50, muzzleCore: 0xfff0ca, muzzleRing: 0xff4d32},
    breach: {steel: 0xbfc5c6, edge: 0xd2c9b4, panel: 0x9aa5a6, black: 0x11161a, bone: 0xb39876, ceramic: 0xb7aa91, wood: 0x6b432e, brass: 0xb27e42, accent: 0x402b2a, glow: 0x913c31, heat: 0xc05a30, muzzle: 0xffa05a, muzzleCore: 0xfff2d1, muzzleRing: 0xff5733},
    arc: {steel: 0xbfc5c6, edge: 0xd2d1c1, panel: 0x9aa5a6, black: 0x10171a, bone: 0xa79b86, ceramic: 0xc1c0aa, wood: 0x624336, brass: 0xa87b4e, accent: 0x29454e, glow: 0x56a4ac, heat: 0x67b9bc, muzzle: 0x8bd4dc, muzzleCore: 0xe1fbf0, muzzleRing: 0x4d9dac},
    reliquary: {steel: 0xbfc5c6, edge: 0xd1c8af, panel: 0x9aa5a6, black: 0x111418, bone: 0xbca47e, ceramic: 0xbcb19a, wood: 0x67412d, brass: 0xaa7746, accent: 0x452b2b, glow: 0x913a3b, heat: 0xc35b32, muzzle: 0xff8f54, muzzleCore: 0xffefcf, muzzleRing: 0xff4d31},
  };
  return palettes[kind];
}

function commonSockets(root, recoilCarriage, muzzlePosition, projectilePosition, gripPosition, supportPosition) {
  const muzzle = socket(recoilCarriage, 'muzzle', muzzlePosition);
  const projectileOrigin = socket(recoilCarriage, 'projectileOrigin', projectilePosition);
  const grip = socket(root, 'grip', gripPosition);
  const supportGrip = supportPosition ? socket(root, 'supportGrip', supportPosition) : null;
  const heat = socket(recoilCarriage, 'heat', [0, .03, -.62]);
  const inspect = socket(root, 'inspect', [0, .1, .25]);
  return {muzzle, projectileOrigin, grip, supportGrip, heat, inspect};
}

function addGripWraps(grip, materials, width = .11, z = .1, count = 7) {
  for (let i = 0; i < count; i++) {
    const y = -.02 - i * .043;
    const band = addRing(grip, width - .01, .009, [0, y, z], materials.edge, `grip-band-${i}`);
    band.rotation.x = Math.PI / 2;
  }
}

export function buildOssuaryRedesign() {
  const root = new THREE.Group();
  root.name = 'Ossuary';
  const parts = {};
  const materials = commonMaterials(basePalette('ossuary'));
  const receiver = part('receiver', root, parts);
  add(receiver, profile([[-.16, -.14], [.16, -.14], [.2, -.03], [.17, .13], [.08, .19], [-.08, .19], [-.17, .13], [-.2, -.03]], .52, .028), materials.steel, [0, .01, .01], [0, 0, 0], [1, 1, 1], 'receiver-shell');
  add(receiver, profile([[-.13, -.1], [.13, -.1], [.15, -.02], [.12, .1], [.06, .14], [-.06, .14], [-.12, .1], [-.15, -.02]], .028, .007), materials.edge, [0, .015, .285], [0, 0, 0], [1, 1, 1], 'receiver-face-plate');
  add(receiver, profile([[-.08, -.055], [.08, -.055], [.095, .01], [.07, .08], [-.07, .08], [-.095, .01]], .012, .003), materials.black, [0, .02, .304], [0, 0, 0], [1, 1, 1], 'receiver-inset');
  for (const side of [-1, 1]) {
    add(receiver, profile([[-.06, -.09], [.06, -.09], [.075, .08], [-.075, .08]], .03, .006), materials.panel, [side * .208, .01, .03], [0, side * Math.PI / 2, 0], [1, 1, 1], `receiver-cheek-${side}`);
    add(receiver, new THREE.CylinderGeometry(.026, .026, .035, 16), materials.brass, [side * .23, .02, -.12], [0, 0, Math.PI / 2], [1, 1, 1], `receiver-rivet-${side}`);
  }
  add(receiver, profile([[-.035, -.02], [.035, -.02], [.042, .075], [-.042, .075]], .05, .009), materials.edge, [0, .215, .01], [0, 0, 0], [1, 1, 1], 'top-sight-rail');

  const recoilCarriage = part('recoil-carriage', root, parts);
  const barrel = part('barrel', recoilCarriage, parts);
  tagWeaponMechanism(barrel, 'tapered-bore', 'z');
  add(barrel, new THREE.CylinderGeometry(.112, .15, .8, 20), materials.steel, [0, .035, -.57], [Math.PI / 2, 0, Math.PI / 8], [1, 1, 1], 'barrel-shell');
  add(barrel, new THREE.CylinderGeometry(.075, .092, .83, 16, 1, true), materials.black, [0, .035, -.58], [Math.PI / 2, 0, 0], [1, 1, 1], 'barrel-bore');
  for (const [index, z] of [-.27, -.43, -.61, -.79].entries()) addRing(barrel, .145 - index * .006, .012, [0, .035, z], materials.edge, `barrel-collar-${index}`);
  add(barrel, profile([[-.045, -.018], [.045, -.018], [.034, .055], [-.034, .055]], .05, .008), materials.edge, [0, .176, -.51], [0, 0, 0], [1, 1, 1], 'barrel-sight');

  const cylinder = part('cylinder', recoilCarriage, parts);
  tagWeaponMechanism(cylinder, 'ossuary-cylinder', 'z');
  // Mount the cylinder on the near side of the receiver like the reference
  // revolver. Its face must survive the first-person rear receiver overlap.
  cylinder.position.x = -.14;
  add(cylinder, new THREE.CylinderGeometry(.215, .215, .3, 24), materials.bone, [0, .02, -.19], [Math.PI / 2, 0, 0], [1, 1, 1], 'cylinder-shell');
  // The player is on +Z. Keep the authored face and chamber insets on that
  // side; placing them on the -Z muzzle side leaves a blank ivory backside in
  // the first-person view.
  add(cylinder, new THREE.CylinderGeometry(.233, .233, .045, 24), materials.edge, [0, .02, -.025], [Math.PI / 2, 0, 0], [1, 1, 1], 'cylinder-face');
  add(cylinder, new THREE.CylinderGeometry(.075, .075, .055, 18), materials.brass, [0, .02, .01], [Math.PI / 2, 0, 0], [1, 1, 1], 'cylinder-hub');
  const chamberInsets = new THREE.InstancedMesh(new THREE.CircleGeometry(.038, 16), materials.black, 6);
  chamberInsets.name = 'chamber-insets';
  chamberInsets.userData.explodeWithParent = true;
  const insetMarker = new THREE.Object3D();
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(angle) * .13;
    const y = .02 + Math.sin(angle) * .13;
    add(cylinder, new THREE.CylinderGeometry(.047, .047, .03, 16, 1, true), materials.black, [x, y, .01], [Math.PI / 2, 0, 0], [1, 1, 1], `chamber-${i}`);
    insetMarker.position.set(x, y, .029);
    insetMarker.rotation.set(0, 0, 0);
    insetMarker.scale.set(1, 1, 1);
    insetMarker.updateMatrix();
    chamberInsets.setMatrixAt(i, insetMarker.matrix);
    addRing(cylinder, .049, .007, [x, y, .03], materials.brass, `chamber-ring-${i}`);
  }
  chamberInsets.instanceMatrix.needsUpdate = true;
  cylinder.add(chamberInsets);
  const ribs = part('ribs', cylinder, parts);
  tagWeaponMechanism(ribs, 'cylinder-cradle', 'z');
  for (const side of [-1, 1]) addTube(ribs, [[side * .14, .16, -.02], [side * .235, .1, -.17], [side * .2, -.03, -.34]], [.027, .038, .025], materials.edge, 12, `rib-${side}`);
  addTube(ribs, [[-.19, -.11, -.03], [-.24, -.02, -.19], [-.18, .1, -.34]], [.022, .03, .02], materials.bone, 12, 'lower-rib-left');
  addTube(ribs, [[.19, -.11, -.03], [.24, -.02, -.19], [.18, .1, -.34]], [.022, .03, .02], materials.bone, 12, 'lower-rib-right');

  const spine = part('spine', root, parts);
  addTube(spine, [[0, .22, .3], [0, .23, -.06], [0, .22, -.47], [0, .19, -.88]], [.026, .033, .029, .018], materials.edge, 12, 'spine-rail');
  for (let i = 0; i < 6; i++) {
    const z = .2 - i * .15;
    add(spine, new THREE.SphereGeometry(.055, 11, 6), materials.bone, [0, .22, z], [0, 0, 0], [1.05, .65, .72], `vertebra-${i}`);
  }

  const muzzleHousing = part('muzzle-housing', recoilCarriage, parts);
  add(muzzleHousing, profile([[-.18, -.13], [.18, -.13], [.2, -.05], [.16, .12], [.08, .16], [-.08, .16], [-.16, .12], [-.2, -.05]], .22, .022), materials.edge, [0, .035, -1.0], [0, 0, 0], [1, 1, 1], 'muzzle-housing');
  add(muzzleHousing, new THREE.CylinderGeometry(.16, .175, .13, 28), materials.edge, [0, .035, -1.12], [Math.PI / 2, 0, 0], [1, 1, 1], 'muzzle-collar');
  add(muzzleHousing, new THREE.CylinderGeometry(.098, .105, .03, 24, 1, true), materials.black, [0, .035, -1.195], [Math.PI / 2, 0, 0], [1, 1, 1], 'muzzle-bore');
  add(muzzleHousing, new THREE.CircleGeometry(.092, 24), materials.black, [0, .035, -1.212], [0, Math.PI, 0], [1, 1, 1], 'muzzle-aperture');
  const jaw = part('jaw', muzzleHousing, parts);
  tagWeaponMechanism(jaw, 'jaw-clamp', 'z');
  const jawLeft = addTube(jaw, [[-.17, .12, -.88], [-.205, .08, -.99], [-.16, -.02, -1.11]], [.035, .04, .018], materials.bone, 12, 'jaw-left');
  const jawRight = addTube(jaw, [[.17, .12, -.88], [.205, .08, -.99], [.16, -.02, -1.11]], [.035, .04, .018], materials.bone, 12, 'jaw-right');
  jawLeft.userData.weaponDynamic = true;
  jawRight.userData.weaponDynamic = true;
  add(jaw, new THREE.CylinderGeometry(.035, .035, .06, 16), materials.brass, [-.18, .1, -.92], [0, 0, Math.PI / 2], [1, 1, 1], 'jaw-hinge-left');
  add(jaw, new THREE.CylinderGeometry(.035, .035, .06, 16), materials.brass, [.18, .1, -.92], [0, 0, Math.PI / 2], [1, 1, 1], 'jaw-hinge-right');
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) add(jaw, new THREE.ConeGeometry(.016, .065, 8), materials.bone, [side * (.15 + i * .025), -.01, -1.105], [Math.PI / 2, 0, side * .16], [1, 1, 1], `jaw-tooth-${side}-${i}`);
  const grip = part('grip', root, parts);
  grip.position.set(0, -.16, .12);
  grip.rotation.x = .16;
  add(grip, profile([[-.105, .08], [.105, .08], [.115, -.06], [.085, -.38], [.02, -.43], [-.08, -.38], [-.115, -.06]], .22, .023), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'wood-grip');
  add(grip, profile([[-.075, -.04], [.075, -.04], [.07, -.27], [-.07, -.27]], .024, .006), materials.panel, [0, -.02, .12], [0, 0, 0], [1, 1, 1], 'grip-side-inset');
  addGripWraps(grip, materials, .105, .12, 7);
  const guard = part('guard', root, parts);
  addTube(guard, [[0, -.03, -.04], [0, -.2, -.04], [0, -.29, .06], [0, -.2, .18]], [.018, .022, .022, .015], materials.edge, 10, 'trigger-guard');
  const trigger = part('trigger', guard, parts);
  tagWeaponMechanism(trigger, 'trigger-blade', 'y');
  add(trigger, new THREE.CapsuleGeometry(.018, .09, 6, 10), materials.brass, [0, -.14, -.04], [Math.PI / 2, 0, 0], [1, 1, 1], 'trigger-blade');
  const sockets = commonSockets(root, recoilCarriage, [0, .035, -1.23], [0, .035, -1.25], [0, -.27, .1], null);
  const fx = addMuzzleFx(muzzleHousing, materials, .36);
  sockets.muzzleFlash = fx.muzzleFlash;
  const shotArc = new THREE.Object3D();
  sockets.shotArc = shotArc;
  const meta = {
    kind: 'ossuary', parts, sockets, materials, recoilCarriage, cylinder, jaw, ribs,
    jawLeft, jawRight,
    // The jaw members are existing meshes with local side travel. Keeping the
    // opening as a state value makes the action readable without adding a new
    // glow mesh or changing any projectile/socket contract.
    jawOpening: 0,
    jawOpeningTarget: 0,
    spin: 0, recoil: 0, flash: 0, heat: 0, jawTension: 0, lastShot: 0, shotFx: fx,
  };
  finish(root, 'ossuary', parts, materials, sockets, {type: 'box', size: [.48, .82, 1.48]});
  root.userData.ossuary = meta;
  return root;
}

export function animateOssuaryRedesign(root, shot = 0, time = 0, dt = .016) {
  const meta = root?.userData?.ossuary;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) {
    meta.recoil = 1;
    meta.flash = 1;
    meta.heat = Math.min(1, meta.heat + .3);
    meta.jawTension = 1;
    meta.jawOpeningTarget = 1;
    meta.jawOpening = 1;
    meta.spin += Math.PI / 3;
  }
  meta.lastShot = shotValue;
  meta.recoil = damp(meta.recoil, 0, 16, delta);
  meta.flash = Math.max(0, meta.flash - delta * 12);
  meta.heat = damp(meta.heat, 0, 1.6, delta);
  meta.jawTension = damp(meta.jawTension, 0, 13, delta);
  meta.jawOpeningTarget = meta.jawTension > .06 ? 1 : 0;
  meta.jawOpening = damp(meta.jawOpening, meta.jawOpeningTarget, 18, delta);
  meta.recoilCarriage.position.z = meta.recoil * .06;
  meta.recoilCarriage.rotation.x = meta.recoil * -.026;
  meta.cylinder.rotation.z = meta.spin + Math.sin(time * 2.4) * .012;
  meta.jaw.rotation.x = Math.sin(time * 2.2) * .01 - meta.jawTension * .08;
  meta.ribs.rotation.z = Math.sin(time * 2.2) * .012 + meta.jawTension * .035;
  const jawOpen = meta.jawOpening;
  // Hinge the existing bone members away from the bore. The outward travel is
  // intentionally larger than the idle sway so a still action frame shows a
  // changed silhouette and a real aperture, even before muzzle flash is read.
  meta.jawLeft.position.x = -jawOpen * .072;
  meta.jawLeft.position.y = jawOpen * .014;
  meta.jawRight.position.x = jawOpen * .072;
  meta.jawRight.position.y = jawOpen * .014;
  meta.jawLeft.rotation.z = -.12 - jawOpen * .26;
  meta.jawRight.rotation.z = .12 + jawOpen * .26;
  meta.materials.glow.emissiveIntensity = .14 + meta.heat * 2.1 + meta.flash * 4.2;
  meta.materials.heat.emissiveIntensity = .16 + meta.heat * 2.8 + meta.flash * 3.2;
  meta.shotFx.muzzleFlash.visible = meta.flash > .012;
  meta.shotFx.muzzleFlash.scale.set(.84 + meta.flash * 1.2, .84 + meta.flash * 1.2, .84 + meta.flash);
  meta.shotFx.flashCone.material.opacity = meta.flash * .82;
  meta.shotFx.flashCore.material.opacity = meta.flash * .95;
  meta.shotFx.flashRing.material.opacity = meta.flash * .6;
}

export function buildBreachRedesign() {
  const root = new THREE.Group();
  root.name = 'BreachShotgun';
  const parts = {};
  const materials = commonMaterials(basePalette('breach'));
  const receiver = part('receiver', root, parts);
  add(receiver, profile([[-.22, -.16], [-.2, .13], [-.11, .2], [.11, .2], [.2, .13], [.22, -.16], [.13, -.21], [-.13, -.21]], .46, .03), materials.steel, [0, .01, .01], [0, 0, 0], [1, 1, 1], 'receiver-shell');
  add(receiver, profile([[-.17, -.11], [-.15, .11], [-.07, .15], [.07, .15], [.15, .11], [.17, -.11], [.09, -.15], [-.09, -.15]], .032, .008), materials.edge, [0, .01, .255], [0, 0, 0], [1, 1, 1], 'receiver-face-plate');
  add(receiver, profile([[-.11, -.07], [.11, -.07], [.12, .07], [.06, .11], [-.06, .11], [-.12, .07]], .014, .003), materials.black, [0, .03, .278], [0, 0, 0], [1, 1, 1], 'receiver-inset');
  for (const side of [-1, 1]) {
    add(receiver, profile([[-.055, -.12], [.055, -.12], [.072, .11], [-.072, .11]], .03, .007), materials.panel, [side * .237, .01, .02], [0, side * Math.PI / 2, 0], [1, 1, 1], `receiver-side-plate-${side}`);
    add(receiver, new THREE.CylinderGeometry(.029, .029, .04, 16), materials.brass, [side * .26, .02, -.14], [0, 0, Math.PI / 2], [1, 1, 1], `receiver-fastener-${side}`);
  }
  const recoilCarriage = part('recoil-carriage', root, parts);
  const barrels = part('twin-barrels', recoilCarriage, parts);
  tagWeaponMechanism(barrels, 'twin-pressure-barrels', 'z');
  for (const side of [-1, 1]) {
    add(barrels, new THREE.CylinderGeometry(.13, .17, .98, 30), materials.steel, [side * .135, .06, -.58], [Math.PI / 2, 0, 0], [1, 1, 1], `barrel-${side}`);
    add(barrels, new THREE.CylinderGeometry(.086, .092, 1.0, 24, 1, true), materials.black, [side * .135, .06, -.58], [Math.PI / 2, 0, 0], [1, 1, 1], `bore-${side}`);
    addRing(barrels, .17, .018, [side * .135, .06, -.25], materials.edge, `barrel-collar-${side}`);
    addRing(barrels, .18, .022, [side * .135, .06, -.98], materials.brass, `muzzle-band-${side}`);
    add(barrels, new THREE.CircleGeometry(.084, 24), materials.black, [side * .135, .06, -1.09], [0, Math.PI, 0], [1, 1, 1], `muzzle-bore-${side}`);
  }
  add(barrels, profile([[-.29, -.028], [.29, -.028], [.23, .05], [-.23, .05]], .055, .01), materials.edge, [0, .225, -.54], [0, 0, 0], [1, 1, 1], 'barrel-top-rib');
  addTube(barrels, [[-.28, -.03, -.84], [-.18, .17, -.6], [0, .2, -.45], [.18, .17, -.6], [.28, -.03, -.84]], .018, materials.panel, 10, 'barrel-under-rib');
  const breechBlock = part('breech-block', recoilCarriage, parts);
  tagWeaponMechanism(breechBlock, 'break-action-breech', 'z');
  add(breechBlock, profile([[-.24, -.12], [-.22, .12], [-.13, .17], [.13, .17], [.22, .12], [.24, -.12], [.13, -.17], [-.13, -.17]], .11, .018, [[0, 0, .08, .065]]), materials.edge, [0, .08, -.16], [0, 0, 0], [1, 1, 1], 'breech-frame');
  add(breechBlock, profile([[-.14, -.07], [.14, -.07], [.14, .08], [-.14, .08]], .018, .004), materials.black, [0, .08, -.105], [0, 0, 0], [1, 1, 1], 'breech-cavity');
  add(breechBlock, new THREE.CylinderGeometry(.055, .055, .52, 20), materials.brass, [0, .22, -.17], [0, 0, Math.PI / 2], [1, 1, 1], 'breech-hinge');
  for (const side of [-1, 1]) add(breechBlock, new THREE.CylinderGeometry(.075, .075, .025, 20), materials.edge, [side * .265, .08, -.17], [0, 0, Math.PI / 2], [1, 1, 1], `hinge-cap-${side}`);
  const pressureValve = part('pressure-valve', recoilCarriage, parts);
  tagWeaponMechanism(pressureValve, 'pressure-valve', 'y');
  for (const side of [-1, 1]) {
    add(pressureValve, new THREE.CylinderGeometry(.028, .034, .2, 16), materials.brass, [side * .19, .29, -.21], [0, 0, 0], [1, 1, 1], `valve-stem-${side}`);
    add(pressureValve, new THREE.CylinderGeometry(.075, .085, .1, 18), materials.edge, [side * .19, .4, -.21], [0, 0, 0], [1, 1, 1], `valve-cap-${side}`);
    const knurl = addRing(pressureValve, .06, .01, [side * .19, .455, -.21], materials.brass, `valve-knurl-${side}`);
    knurl.rotation.x = Math.PI / 2;
  }
  const ribcage = part('ribcage', recoilCarriage, parts);
  for (const side of [-1, 1]) {
    addTube(ribcage, [[side * .16, .17, -.26], [side * .25, .1, -.5], [side * .22, -.04, -.82]], [.026, .038, .023], materials.bone, 12, `rib-${side}`);
    addTube(ribcage, [[side * .18, .16, -.34], [side * .28, .09, -.59], [side * .24, -.03, -.88]], [.018, .025, .015], materials.edge, 10, `pressure-rail-${side}`);
  }
  const extractors = part('shell-extractors', recoilCarriage, parts);
  addTube(extractors, [[-.13, .02, -.27], [-.19, .04, -.17], [-.16, .12, -.1]], [.026, .031, .016], materials.edge, 10, 'extractor-left');
  addTube(extractors, [[.13, .02, -.27], [.19, .04, -.17], [.16, .12, -.1]], [.026, .031, .016], materials.edge, 10, 'extractor-right');
  const stock = part('stock', root, parts);
  add(stock, profile([[-.17, -.16], [.17, -.16], [.15, .12], [.09, .2], [-.09, .2], [-.15, .12]], .3, .026), materials.wood, [0, -.01, .34], [.12, 0, 0], [1, 1, 1], 'wood-stock');
  const grip = part('grip', root, parts);
  grip.position.set(0, -.18, .08);
  grip.rotation.x = .18;
  add(grip, profile([[-.105, .08], [.105, .08], [.12, -.08], [.09, -.4], [.02, -.45], [-.09, -.39], [-.12, -.08]], .24, .025), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'wood-grip');
  addGripWraps(grip, materials, .11, .1, 7);
  const supportGrip = part('support-grip', root, parts);
  supportGrip.position.set(-.16, -.25, -.47);
  supportGrip.rotation.x = -.12;
  add(supportGrip, profile([[-.075, .08], [.075, .08], [.085, -.18], [.06, -.26], [-.06, -.26], [-.085, -.18]], .18, .018), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'support-wood');
  const muzzleHousing = part('muzzle-housing', recoilCarriage, parts);
  add(muzzleHousing, profile([[-.31, -.12], [.31, -.12], [.29, .1], [.19, .16], [-.19, .16], [-.29, .1]], .18, .02), materials.edge, [0, .06, -1.05], [0, 0, 0], [1, 1, 1], 'muzzle-bridge');
  const sockets = commonSockets(root, recoilCarriage, [0, .06, -1.14], [0, .06, -1.17], [0, -.25, .08], [-.16, -.25, -.47]);
  sockets.supportGrip = supportGrip;
  const fx = addMuzzleFx(muzzleHousing, materials, .42);
  sockets.muzzleFlash = fx.muzzleFlash;
  const meta = {kind: 'breach', parts, sockets, materials, recoilCarriage, barrels, breechBlock, extractors, pressureValve, ribcage, recoil: 0, flash: 0, heat: 0, pressurePulse: 0, lastShot: 0, shotFx: fx};
  finish(root, 'breach', parts, materials, sockets, {type: 'capsule', size: [.62, .96, 1.8]});
  root.userData.breach = meta;
  return root;
}

export function animateBreachRedesign(root, time = 0, shot = 0, dt = .016) {
  const meta = root?.userData?.breach;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) { meta.recoil = 1; meta.flash = 1; meta.heat = Math.min(1, meta.heat + .34); meta.pressurePulse = 1; }
  meta.lastShot = shotValue;
  meta.recoil = damp(meta.recoil, 0, 14, delta);
  meta.flash = Math.max(0, meta.flash - delta * 10);
  meta.heat = damp(meta.heat, 0, 1.35, delta);
  meta.pressurePulse = damp(meta.pressurePulse, 0, 10, delta);
  meta.recoilCarriage.position.z = meta.recoil * .07;
  meta.recoilCarriage.rotation.x = meta.recoil * -.022;
  meta.breechBlock.position.z = -meta.recoil * .12;
  meta.breechBlock.rotation.x = -meta.recoil * .12;
  meta.extractors.position.z = -meta.recoil * .08;
  meta.barrels.rotation.z = Math.sin(time * 1.8) * .004 + meta.pressurePulse * .014;
  meta.pressureValve.position.y = meta.pressurePulse * .022;
  meta.pressureValve.rotation.z = Math.sin(time * 4.5) * meta.pressurePulse * .035 + meta.pressurePulse * .07;
  meta.ribcage.scale.set(1 + meta.pressurePulse * .035, 1 + meta.pressurePulse * .022, 1);
  meta.materials.glow.emissiveIntensity = .14 + meta.heat * 2.2 + meta.flash * 4.2;
  meta.materials.heat.emissiveIntensity = .16 + meta.heat * 2.8 + meta.flash * 3.8;
  meta.shotFx.muzzleFlash.visible = meta.flash > .012;
  meta.shotFx.muzzleFlash.scale.set(.8 + meta.flash * 1.2, .8 + meta.flash * 1.2, .8 + meta.flash);
  meta.shotFx.flashCone.material.opacity = meta.flash * .9;
  meta.shotFx.flashCore.material.opacity = meta.flash;
  meta.shotFx.flashRing.material.opacity = meta.flash * .65;
}

export function buildArcRedesign() {
  const root = new THREE.Group();
  root.name = 'ArcLance';
  const parts = {};
  const materials = commonMaterials(basePalette('arc'));
  const frame = part('frame', root, parts);
  // Four tapered rails leave a clear negative-space channel around the
  // capacitor. The outer silhouette reads before the glow is ever seen.
  for (const side of [-1, 1]) {
    addTube(frame, [[side * .24, .17, .18], [side * .34, .19, -.2], [side * .31, .16, -.68], [side * .19, .12, -1.02]], [.045, .062, .052, .028], materials.steel, 14, `outer-spine-${side}`);
    addTube(frame, [[side * .18, .12, .22], [side * .24, .13, -.24], [side * .22, .11, -.73], [side * .14, .08, -.98]], [.024, .03, .026, .016], materials.edge, 10, `inner-spine-${side}`);
  }
  add(frame, profile([[-.29, -.025], [.29, -.025], [.24, .04], [-.24, .04]], .06, .01), materials.edge, [0, .19, .18], [0, 0, 0], [1, 1, 1], 'rear-bridge');
  add(frame, profile([[-.18, -.02], [.18, -.02], [.14, .035], [-.14, .035]], .05, .009), materials.edge, [0, .13, -1.0], [0, 0, 0], [1, 1, 1], 'emitter-bridge');
  const recoil = part('recoil', root, parts);
  const reactor = part('reactor', recoil, parts);
  tagWeaponMechanism(reactor, 'ceramic-capacitor', 'z');
  addLathe(reactor, [[.11, -.34], [.155, -.29], [.19, -.18], [.2, .16], [.165, .28], [.11, .34]], 24, materials.ceramic, [0, .06, -.45], 'ceramic-capacitor');
  addLathe(reactor, [[.052, -.31], [.08, -.24], [.09, .22], [.052, .3]], 18, materials.glow, [0, .06, -.45], 'capacitor-core');
  addRing(reactor, .195, .018, [0, .06, -.72], materials.brass, 'capacitor-collar-front');
  addRing(reactor, .195, .018, [0, .06, -.18], materials.brass, 'capacitor-collar-rear');
  addRing(reactor, .106, .008, [0, .06, -.72], materials.edge, 'core-collar-front');
  addRing(reactor, .106, .008, [0, .06, -.18], materials.edge, 'core-collar-rear');
  const baffles = part('reactor-baffles', reactor, parts);
  for (const side of [-1, 1]) {
    addTube(baffles, [[side * .18, .2, -.25], [side * .24, .19, -.39], [side * .22, .18, -.56], [side * .16, .2, -.69]], [.018, .032, .032, .018], materials.edge, 10, `capacitor-fin-${side}`);
    addTube(baffles, [[side * .18, -.08, -.25], [side * .24, -.08, -.4], [side * .22, -.08, -.56], [side * .16, -.07, -.69]], [.016, .023, .023, .014], materials.brass, 10, `capacitor-lower-fin-${side}`);
  }
  const heatVents = part('reactor-heat-vents', reactor, parts);
  tagWeaponMechanism(heatVents, 'capacitor-vents', 'z');
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z = -.32 - i * .13;
    add(heatVents, profile([[-.018, -.04], [.018, -.04], [.028, .04], [-.028, .04]], .025, .004), materials.heat, [side * (.19 + i * .008), .16, z], [0, side * .2, 0], [1, 1, 1], `vent-${side}-${i}`);
  }
  const coilGuards = part('coil-guards', root, parts);
  for (const side of [-1, 1]) {
    addTube(coilGuards, [[side * .22, .23, .16], [side * .29, .25, -.16], [side * .28, .23, -.54], [side * .2, .19, -.86]], [.025, .034, .034, .018], materials.bone, 12, `guard-upper-${side}`);
    addTube(coilGuards, [[side * .2, -.13, .12], [side * .27, -.14, -.2], [side * .26, -.12, -.57], [side * .18, -.06, -.86]], [.018, .025, .025, .014], materials.edge, 10, `guard-lower-${side}`);
  }
  const chargeSlider = part('charge-slider', root, parts);
  tagWeaponMechanism(chargeSlider, 'charge-slider', 'z');
  addTube(chargeSlider, [[0, .27, .2], [0, .27, -.22], [0, .27, -.76]], .018, materials.edge, 10, 'charge-rail');
  add(chargeSlider, profile([[-.06, -.04], [.06, -.04], [.07, .04], [-.07, .04]], .075, .01), materials.brass, [0, .27, -.45], [0, 0, 0], [1, 1, 1], 'charge-carriage');
  add(chargeSlider, new THREE.CylinderGeometry(.026, .026, .08, 14), materials.edge, [0, .27, -.45], [Math.PI / 2, 0, 0], [1, 1, 1], 'charge-pin');
  const emitter = part('emitter', root, parts);
  add(emitter, new THREE.CylinderGeometry(.16, .2, .22, 24), materials.edge, [0, .1, -1.08], [Math.PI / 2, 0, 0], [1, 1, 1], 'emitter-collar');
  add(emitter, new THREE.CylinderGeometry(.1, .125, .16, 20), materials.black, [0, .1, -1.2], [Math.PI / 2, 0, 0], [1, 1, 1], 'emitter-aperture');
  add(emitter, new THREE.CircleGeometry(.085, 20), materials.black, [0, .1, -1.29], [0, Math.PI, 0], [1, 1, 1], 'emitter-void');
  const emitterClaws = part('emitter-claws', emitter, parts);
  for (const side of [-1, 1]) {
    addTube(emitterClaws, [[side * .15, .2, -.97], [side * .21, .18, -1.11], [side * .15, .14, -1.27]], [.03, .04, .014], materials.bone, 12, `emitter-claw-${side}`);
    add(emitterClaws, new THREE.SphereGeometry(.034, 12, 8), materials.brass, [side * .15, .2, -.97], [0, 0, 0], [1, 1, 1], `emitter-pin-${side}`);
  }
  const grip = part('grip', root, parts);
  grip.position.set(0, -.2, .08);
  grip.rotation.x = .18;
  add(grip, profile([[-.1, .08], [.1, .08], [.11, -.35], [.05, -.42], [-.08, -.36], [-.11, -.08]], .2, .023), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'wood-grip');
  addGripWraps(grip, materials, .1, .1, 7);
  const supportGrip = part('support-grip', root, parts);
  supportGrip.position.set(-.06, -.31, -.55);
  supportGrip.rotation.x = -.12;
  add(supportGrip, profile([[-.07, .06], [.07, .06], [.075, -.2], [.04, -.28], [-.06, -.23], [-.08, -.08]], .16, .017), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'support-grip-body');
  const sockets = commonSockets(root, recoil, [0, .1, -1.31], [0, .1, -1.34], [0, -.26, .08], [-.06, -.31, -.55]);
  sockets.supportGrip = supportGrip;
  const fx = addMuzzleFx(emitter, materials, .4);
  sockets.muzzleFlash = fx.muzzleFlash;
  const shotArc = part('shot-arc', emitter, parts);
  shotArc.visible = false;
  add(shotArc, new THREE.CylinderGeometry(.015, .03, .6, 8), materials.muzzleCore, [0, .1, -.34], [Math.PI / 2, 0, 0], [1, 1, 1], 'arc-bolt');
  const meta = {kind: 'arc', parts, sockets, materials, recoilCarriage: recoil, reactor, emitter, chargeSlider, baffles, heatVents, coilGuards, recoil: 0, flash: 0, heat: 0, cagePulse: 0, lastShot: 0, shotFx: fx};
  sockets.shotArc = shotArc;
  sockets.corePulse = reactor;
  finish(root, 'arc', parts, materials, sockets, {type: 'capsule', size: [.7, .9, 1.85]});
  root.userData.arc = meta;
  return root;
}

export function animateArcRedesign(root, time = 0, shot = 0, dt = .016) {
  const meta = root?.userData?.arc;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) { meta.recoil = 1; meta.flash = 1; meta.heat = Math.min(1, meta.heat + .3); meta.cagePulse = 1; }
  meta.lastShot = shotValue;
  meta.recoil = damp(meta.recoil, 0, 16, delta);
  meta.flash = Math.max(0, meta.flash - delta * 12);
  meta.heat = damp(meta.heat, 0, 1.3, delta);
  meta.cagePulse = damp(meta.cagePulse, 0, 7, delta);
  const charge = THREE.MathUtils.clamp(meta.heat * .7 + meta.cagePulse * .8, 0, 1);
  meta.recoilCarriage.position.z = meta.recoil * .035;
  meta.recoilCarriage.rotation.x = meta.recoil * -.014;
  meta.reactor.rotation.z = time * (.38 + charge * 1.5);
  meta.baffles.scale.set(1 + charge * .14, 1 + charge * .06, 1);
  meta.heatVents.scale.set(1 + charge * .16, 1 + charge * .04, 1);
  meta.coilGuards.rotation.z = Math.sin(time * 2.1) * .01 + charge * .03;
  meta.chargeSlider.position.z = Math.sin(time * 3.1 + charge) * (.1 + charge * .03) - charge * .03;
  meta.materials.glow.emissiveIntensity = .16 + meta.heat * 4.3 + meta.cagePulse * 3.2;
  meta.materials.heat.emissiveIntensity = .18 + meta.heat * 3.2 + meta.cagePulse * 2.2;
  meta.shotFx.muzzleFlash.visible = meta.flash > .012;
  meta.shotFx.muzzleFlash.scale.set(.84 + meta.flash * 1.3, .84 + meta.flash * 1.3, .84 + meta.flash);
  meta.shotFx.flashCone.material.opacity = meta.flash * .75;
  meta.shotFx.flashCore.material.opacity = meta.flash;
  meta.shotFx.flashRing.material.opacity = meta.flash * .55;
  meta.sockets.shotArc.visible = meta.flash > .03;
  meta.sockets.shotArc.scale.setScalar(.8 + meta.flash * 1.35);
}

export function buildReliquaryRedesign() {
  const root = new THREE.Group();
  root.name = 'Reliquary';
  const parts = {};
  const materials = commonMaterials(basePalette('reliquary'));
  const receiver = part('receiver', root, parts);
  // A lathed octagonal pressure chamber carries the silhouette; the face
  // plate is separate so the aperture remains visible in the first-person view.
  addLathe(receiver, [[.17, -.32], [.23, -.27], [.285, -.16], [.3, .07], [.27, .2], [.2, .3], [.16, .34]], 10, materials.steel, [0, .04, -.08], 'octagonal-chamber');
  add(receiver, profile([[-.25, -.22], [.25, -.22], [.29, -.12], [.29, .15], [.2, .25], [-.2, .25], [-.29, .15], [-.29, -.12]], .075, .018, [[0, .01, .14, .11]]), materials.edge, [0, .04, .29], [0, 0, 0], [1, 1, 1], 'chamber-face');
  add(receiver, profile([[-.18, -.14], [.18, -.14], [.21, -.06], [.21, .1], [.14, .16], [-.14, .16], [-.21, .1], [-.21, -.06]], .022, .005, [[0, .01, .1, .075]]), materials.black, [0, .04, .34], [0, 0, 0], [1, 1, 1], 'chamber-inset');
  for (const side of [-1, 1]) {
    add(receiver, profile([[-.05, -.17], [.05, -.17], [.07, .18], [-.07, .18]], .04, .008), materials.panel, [side * .292, .04, -.08], [0, side * Math.PI / 2, 0], [1, 1, 1], `chamber-armor-${side}`);
    add(receiver, new THREE.CylinderGeometry(.032, .032, .04, 12), materials.brass, [side * .324, .04, -.18], [0, 0, Math.PI / 2], [1, 1, 1], `chamber-bolt-${side}`);
  }
  for (const z of [-.28, -.12, .08, .24]) addRing(receiver, .29, .014, [0, .04, z], materials.edge, `chamber-band-${z}`);
  const recoilCarriage = part('recoil-carriage', root, parts);
  const barrel = part('barrel', recoilCarriage, parts);
  add(barrel, new THREE.CylinderGeometry(.14, .205, .68, 20), materials.steel, [0, .04, -.66], [Math.PI / 2, 0, 0], [1, 1, 1], 'tapered-barrel');
  add(barrel, new THREE.CylinderGeometry(.082, .108, .72, 16, 1, true), materials.black, [0, .04, -.66], [Math.PI / 2, 0, 0], [1, 1, 1], 'barrel-bore');
  addRing(barrel, .2, .018, [0, .04, -.39], materials.brass, 'barrel-rear-collar');
  addRing(barrel, .16, .018, [0, .04, -.95], materials.edge, 'barrel-front-collar');
  const core = part('core', recoilCarriage, parts);
  tagWeaponMechanism(core, 'sealed-core', 'z');
  addLathe(core, [[.1, -.2], [.14, -.15], [.15, .1], [.1, .2]], 18, materials.bone, [0, .04, -.37], 'relic-core-shell');
  addLathe(core, [[.045, -.16], [.07, -.1], [.07, .13], [.045, .17]], 16, materials.glow, [0, .04, -.37], 'relic-core');
  addRing(core, .15, .015, [0, .04, -.53], materials.brass, 'core-collar-front');
  addRing(core, .15, .015, [0, .04, -.2], materials.edge, 'core-collar-rear');
  const heatVents = part('heat-vents', recoilCarriage, parts);
  tagWeaponMechanism(heatVents, 'pressure-shutters', 'z');
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const z = -.28 - i * .13;
    add(heatVents, profile([[-.035, -.07], [.035, -.07], [.04, .07], [-.04, .07]], .035, .006), materials.edge, [side * (.23 + i * .008), .2, z], [0, side * .18, side * .08], [1, 1, 1], `shutter-${side}-${i}`);
    add(heatVents, new THREE.CylinderGeometry(.018, .018, .15, 12), materials.heat, [side * (.27 + i * .008), .2, z], [0, 0, side * .12], [1, 1, 1], `vent-${side}-${i}`);
  }
  const ribcage = part('ribcage', recoilCarriage, parts);
  for (const side of [-1, 1]) addTube(ribcage, [[side * .16, .2, -.18], [side * .28, .15, -.4], [side * .25, .06, -.67]], [.025, .036, .02], materials.bone, 12, `rib-${side}`);
  const muzzleClaws = part('muzzle-claws', recoilCarriage, parts);
  tagWeaponMechanism(muzzleClaws, 'ceremonial-aperture', 'z');
  const clawLeft = addTube(muzzleClaws, [[-.16, .2, -.91], [-.23, .16, -1.04], [-.16, .1, -1.18]], [.038, .045, .014], materials.bone, 12, 'aperture-claw-left');
  const clawRight = addTube(muzzleClaws, [[.16, .2, -.91], [.23, .16, -1.04], [.16, .1, -1.18]], [.038, .045, .014], materials.bone, 12, 'aperture-claw-right');
  const clawHingeLeft = add(muzzleClaws, new THREE.SphereGeometry(.038, 12, 8), materials.brass, [-.16, .2, -.91], [0, 0, 0], [1, 1, 1], 'aperture-hinge-left');
  const clawHingeRight = add(muzzleClaws, new THREE.SphereGeometry(.038, 12, 8), materials.brass, [.16, .2, -.91], [0, 0, 0], [1, 1, 1], 'aperture-hinge-right');
  for (const node of [clawLeft, clawRight, clawHingeLeft, clawHingeRight]) node.userData.weaponDynamic = true;
  const clawHingeLeftRest = clawHingeLeft.position.clone();
  const clawHingeRightRest = clawHingeRight.position.clone();
  const muzzleBrake = part('muzzle-brake', recoilCarriage, parts);
  add(muzzleBrake, new THREE.CylinderGeometry(.18, .23, .22, 12), materials.edge, [0, .04, -1.06], [Math.PI / 2, 0, 0], [1, 1, 1], 'muzzle-chamber');
  add(muzzleBrake, new THREE.CylinderGeometry(.12, .14, .045, 12, 1, true), materials.black, [0, .04, -1.19], [Math.PI / 2, 0, 0], [1, 1, 1], 'muzzle-aperture');
  add(muzzleBrake, new THREE.CircleGeometry(.115, 12), materials.black, [0, .04, -1.22], [0, Math.PI, 0], [1, 1, 1], 'muzzle-void');
  addRing(muzzleBrake, .19, .018, [0, .04, -1.16], materials.brass, 'muzzle-ring');
  const grip = part('grip', root, parts);
  grip.position.set(0, -.2, .13);
  grip.rotation.x = .15;
  add(grip, profile([[-.14, .08], [.14, .08], [.16, -.06], [.12, -.4], [.04, -.48], [-.11, -.4], [-.16, -.06]], .26, .027), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'relic-grip');
  addGripWraps(grip, materials, .14, .13, 8);
  const supportGrip = part('support-grip', root, parts);
  supportGrip.position.set(-.17, -.29, -.55);
  supportGrip.rotation.x = -.12;
  add(supportGrip, profile([[-.08, .06], [.08, .06], [.095, -.2], [.055, -.29], [-.07, -.24], [-.09, -.07]], .19, .018), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'support-grip');
  const sockets = commonSockets(root, recoilCarriage, [0, .04, -1.23], [0, .04, -1.26], [0, -.26, .12], [-.17, -.29, -.55]);
  sockets.supportGrip = supportGrip;
  const fx = addMuzzleFx(muzzleBrake, materials, .46);
  sockets.muzzleFlash = fx.muzzleFlash;
  const heatBloom = socket(recoilCarriage, 'heatBloom', [0, .04, -1.06]);
  const explosion = socket(recoilCarriage, 'explosion', [0, .04, -1.26]);
  const meta = {
    kind: 'reliquary', variant: 'bone-rocket', parts, sockets, materials, recoilCarriage,
    core, barrel, heatVents, heatBloom, muzzleClaws, ribcage,
    clawLeft, clawRight, clawHingeLeft, clawHingeRight,
    clawHingeLeftRest, clawHingeRightRest,
    // Side travel is the actual ceremonial aperture state. The muzzle group
    // remains the public mechanism handle for callers that already inspect it.
    clawOpening: 0,
    clawOpeningTarget: 0,
    explosion, recoil: 0, flash: 0, heat: 0, ritualPulse: 0, lastShot: 0, shotFx: fx,
  };
  finish(root, 'reliquary', parts, materials, sockets, {type: 'capsule', size: [.68, .94, 1.62]});
  root.userData.reliquary = meta;
  return root;
}

export function animateReliquaryRedesign(root, shot = 0, time = 0, dt = .016) {
  const meta = root?.userData?.reliquary;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) {
    meta.recoil = 1;
    meta.flash = 1;
    meta.heat = Math.min(1, meta.heat + .34);
    meta.ritualPulse = 1;
    meta.clawOpeningTarget = 1;
    meta.clawOpening = 1;
  }
  meta.lastShot = shotValue;
  meta.recoil = damp(meta.recoil, 0, 13, delta);
  meta.flash = Math.max(0, meta.flash - delta * 9);
  meta.heat = damp(meta.heat, 0, 1.25, delta);
  meta.ritualPulse = damp(meta.ritualPulse, 0, 8, delta);
  meta.clawOpeningTarget = meta.ritualPulse > .06 ? 1 : 0;
  meta.clawOpening = damp(meta.clawOpening, meta.clawOpeningTarget, 14, delta);
  const ritual = THREE.MathUtils.clamp(meta.heat * .62 + meta.ritualPulse * .7, 0, 1);
  meta.recoilCarriage.position.z = meta.recoil * .075;
  meta.recoilCarriage.rotation.x = meta.recoil * -.025;
  meta.core.rotation.z = time * (.8 + ritual * 2.4);
  meta.core.scale.setScalar(1 + ritual * .08);
  meta.heatVents.scale.set(1 + ritual * .2, 1 + ritual * .06, 1);
  meta.heatVents.rotation.z = Math.sin(time * 4.1) * .04 + ritual * .11;
  meta.muzzleClaws.scale.set(1 + ritual * .08, 1 + ritual * .04, 1);
  const clawOpen = meta.clawOpening;
  // Pull the two existing claw meshes and their hinge pins away from the
  // muzzle centerline. This reveals the black aperture by silhouette, rather
  // than asking a brighter flash to communicate the shot.
  meta.clawLeft.position.x = -clawOpen * .082;
  meta.clawLeft.position.y = clawOpen * .018;
  meta.clawRight.position.x = clawOpen * .082;
  meta.clawRight.position.y = clawOpen * .018;
  meta.clawHingeLeft.position.copy(meta.clawHingeLeftRest);
  meta.clawHingeLeft.position.x -= clawOpen * .082;
  meta.clawHingeLeft.position.y += clawOpen * .018;
  meta.clawHingeRight.position.copy(meta.clawHingeRightRest);
  meta.clawHingeRight.position.x += clawOpen * .082;
  meta.clawHingeRight.position.y += clawOpen * .018;
  meta.clawLeft.rotation.z = -clawOpen * .24;
  meta.clawRight.rotation.z = clawOpen * .24;
  meta.muzzleClaws.rotation.z = Math.sin(time * 2.4) * .012 + ritual * .02;
  meta.ribcage.scale.set(1 + ritual * .035, 1 + ritual * .02, 1);
  meta.ribcage.rotation.z = Math.sin(time * 2.1) * .01 + ritual * .02;
  meta.materials.glow.emissiveIntensity = .16 + meta.heat * 4.2 + meta.ritualPulse * 3.1;
  meta.materials.heat.emissiveIntensity = .18 + meta.heat * 2.8 + meta.ritualPulse * 2.4;
  meta.shotFx.muzzleFlash.visible = meta.flash > .012;
  meta.shotFx.muzzleFlash.scale.set(.82 + meta.flash * 1.25, .82 + meta.flash * 1.25, .82 + meta.flash);
  meta.shotFx.flashCone.material.opacity = meta.flash * .9;
  meta.shotFx.flashCore.material.opacity = meta.flash;
  meta.shotFx.flashRing.material.opacity = meta.flash * .68;
}
