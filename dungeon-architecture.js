import * as THREE from './vendor/three.module.js';

const CELL = 4;
const PALETTES = new WeakMap();

const part = (parent, geometry, material, x = 0, y = 0, z = 0, name = '', castShadow = true) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};
const beam = (parent, material, x, y, z, sx, sy, sz, name = '', castShadow = true) =>
  part(parent, new THREE.BoxGeometry(sx, sy, sz), material, x, y, z, name, castShadow);
const curve = (parent, material, points, radius, name, moving = false) => {
  const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const mesh = part(parent, new THREE.TubeGeometry(path, Math.max(16, points.length * 7), radius, 8, false), material, 0, 0, 0, name);
  if (moving) mesh.userData.noBatch = true;
  return mesh;
};
const cable = (parent, material, a, b, radius = .05, name = '') => {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const mesh = part(parent, new THREE.CylinderGeometry(radius * .84, radius, delta.length(), 8), material, 0, 0, 0, name);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function periodicNoise(u, v, cells, seed) {
  const px = u * cells, py = v * cells;
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
  const fx = px - x0, fy = py - y0;
  const fade = value => value * value * (3 - 2 * value);
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const hash = (x, y) => {
    const value = Math.sin((x + seed * 3.1) * 127.1 + (y - seed * 7.7) * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const tx = fade(fx), ty = fade(fy);
  return lerp(
    lerp(hash(x0, y0), hash(x1, y0), tx),
    lerp(hash(x0, y1), hash(x1, y1), tx),
    ty,
  );
}

function makeTileableMawSurface(seed, repeat, normalStrength) {
  const size = 128;
  const height = new Float32Array(size * size);
  const reliefAt = (u, v) => {
    const macro = periodicNoise(u, v, 4, seed);
    const meso = periodicNoise(u, v, 13, seed + 3.17);
    const micro = periodicNoise(u, v, 37, seed + 7.83);
    const striation = Math.sin(Math.PI * 2 * (v * 17 + Math.sin(Math.PI * 2 * (u * 3 + seed * .01)) * .015));
    return clamp(.5 + (macro - .5) * .62 + (meso - .5) * .32 + (micro - .5) * .16 + striation * .055, .04, .96);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) height[y * size + x] = reliefAt(x / size, y / size);
  }

  const albedoData = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const roughnessData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x, pixel = index * 4, value = height[index];
      const tone = Math.round(255 * clamp(.97 + (value - .5) * .17, .9, 1));
      albedoData[pixel] = tone;
      albedoData[pixel + 1] = Math.max(0, tone - 2);
      albedoData[pixel + 2] = Math.max(0, tone - 4);
      albedoData[pixel + 3] = 255;

      const left = height[y * size + (x + size - 1) % size];
      const right = height[y * size + (x + 1) % size];
      const up = height[((y + size - 1) % size) * size + x];
      const down = height[((y + 1) % size) * size + x];
      let nx = -(right - left) * size * normalStrength;
      let ny = -(down - up) * size * normalStrength;
      let nz = 1;
      const length = Math.hypot(nx, ny, nz);
      nx /= length; ny /= length; nz /= length;
      normalData[pixel] = Math.round((nx * .5 + .5) * 255);
      normalData[pixel + 1] = Math.round((ny * .5 + .5) * 255);
      normalData[pixel + 2] = Math.round((nz * .5 + .5) * 255);
      normalData[pixel + 3] = 255;

      const roughness = Math.round(255 * clamp(.89 + (.5 - value) * .14, .82, .96));
      roughnessData[pixel] = roughness;
      roughnessData[pixel + 1] = roughness;
      roughnessData[pixel + 2] = roughness;
      roughnessData[pixel + 3] = 255;
    }
  }

  const texture = (data, name, colorSpace = THREE.NoColorSpace) => {
    const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    map.name = `BlackGullet_${name}`;
    map.colorSpace = colorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat, repeat);
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.anisotropy = 4;
    map.userData.sharedAsset = true;
    map.userData.authoredSurface = 'black-gullet-periodic-relief-v1';
    map.needsUpdate = true;
    return map;
  };

  return {
    albedo: texture(albedoData, 'Albedo', THREE.SRGBColorSpace),
    normal: texture(normalData, 'Normal'),
    roughness: texture(roughnessData, 'Roughness'),
  };
}

function materialsFor(source, course) {
  let map = PALETTES.get(source);
  if (!map) { map = new Map(); PALETTES.set(source, map); }
  const family = course.artDirection?.family || course.sectorId || 'bloodworks';
  const key = `${family}:${course.id || ''}`;
  if (map.has(key)) return map.get(key);
  const make = (name, color, roughness = .82, metalness = .12, extra = {}) => {
    const Physical = 'clearcoat' in extra || 'clearcoatRoughness' in extra;
    const Material = Physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const material = new Material({ color, roughness, metalness, ...extra });
    material.name = `Dungeon_${course.id}_${name}`;
    material.userData.sharedLibrary = true;
    return material;
  };
  const palette = {
    dark: source.black || source.metalDark,
    iron: source.weaponDark || source.metalDark,
    edge: source.steel || source.metal,
    rust: source.rust || source.enemyArmor,
    red: source.red || source.enemyRed,
    goldSignal: source.orange || source.gold,
    glass: source.glass || source.cyan,
    gore: source.gore || source.enemyRed,
    flesh: make('Flesh', family === 'ossuary' ? 0x392d3a : family === 'choir' ? 0x4b2020 : 0x4c2028, .58, .05, { clearcoat: .28, clearcoatRoughness: .45 }),
    membrane: make('Membrane', 0x3c2027, .48, .02, { transparent: true, opacity: .9, side: THREE.DoubleSide, clearcoat: .38 }),
    bone: make('Bone', family === 'ossuary' ? 0xc9bd9e : 0xb7aa91, .9, .04),
    boneEdge: make('BoneEdge', family === 'ossuary' ? 0x8c806e : 0x847969, .84, .08),
    bronze: make('Bronze', family === 'choir' ? 0x927246 : 0x82604b, .34, .82),
    mawBasalt: make('MawBasalt', 0x30272c, .94, .015, { emissive: 0x090608, emissiveIntensity: .14 }),
    mawBasaltEdge: make('MawBasaltEdge', 0x443b3c, .89, .02),
    mawBone: make('MawBone', 0xc1b08f, .88, .015),
    mawBoneShade: make('MawBoneShade', 0x716354, .94, .01),
    mawBronze: make('MawBronze', 0x725337, .52, .64),
    mawOxblood: make('MawOxblood', 0x3b151d, .76, .01, { clearcoat: .08, clearcoatRoughness: .72 }),
    mawLining: make('MawLining', 0x612532, .66, .015, { clearcoat: .16, clearcoatRoughness: .58, emissive: 0x16040a, emissiveIntensity: .16 }),
    mawVascular: make('MawVascular', 0x521d29, .7, .01, { emissive: 0x1d060c, emissiveIntensity: .24 }),
    mawPocketRim: make('MawPocketRim', 0x481923, .74, .01, { emissive: 0x14040a, emissiveIntensity: .11 }),
    mawTendon: make('MawTendon', 0x42181f, .72, .015),
    mawRecess: make('MawRecess', 0x0b080c, .98, 0),
    mawEmber: make('MawEmber', 0xffb14d, .32, 0, { emissive: 0xff7a25, emissiveIntensity: 1.8 }),
    mawDamp: make('MawDamp', 0x302729, .27, .02),
    porcelain: make('Porcelain', 0xb9c0b4, .42, .14, { clearcoat: .52, clearcoatRoughness: .32 }),
    void: make('Recess', 0x08090c, .98, 0),
  };
  if (course.id === 'f5-last-descent') {
    for (const [name, seed, repeat, normalStrength, normalScale] of [
      ['mawBasalt', 1.4, 1.45, .14, .34],
      ['mawBone', 3.2, 1.9, .11, .26],
      ['mawBronze', 5.1, 2.35, .09, .2],
      ['mawOxblood', 7.6, 1.8, .08, .16],
      ['mawLining', 9.1, 1.55, .06, .12],
    ]) {
      const material = palette[name];
      const surface = makeTileableMawSurface(seed, repeat, normalStrength);
      material.map = surface.albedo;
      material.normalMap = surface.normal;
      material.roughnessMap = surface.roughness;
      material.normalScale.set(normalScale, normalScale);
      material.needsUpdate = true;
    }
  }
  map.set(key, palette);
  return palette;
}

function makeRoot(item, materials, course, moving, motion, anchors, lights) {
  const family = course.artDirection?.family || course.sectorId || 'bloodworks';
  const palette = materialsFor(materials, course);
  const anchor = item.anchor || [0, 0];
  const room = (course.rooms || []).find(entry => entry.id === item.roomId);
  const mouthLaneX = String(item.type || '').toLowerCase().includes('mouth') && Number.isFinite(room?.center?.x)
    ? room.center.x
    : anchor[0];
  const root = new THREE.Group();
  root.name = `StoryLandmark_${item.id}`;
  root.position.set(mouthLaneX * CELL, 0, anchor[1] * CELL + (item.playerFacing ? CELL * 1.35 : 0));
  // Static children are baked by batchStaticWorld; only the animated parts below
  // stay independent so the new silhouette does not multiply draw calls.
  root.userData.storyArchitecturePart = true;
  root.userData.visualOnly = true;
  root.userData.floorId = course.id;
  root.userData.family = family;
  root.userData.modelId = course.artDirection?.landmark || item.type;
  if (String(item.type || '').toLowerCase().includes('mouth')) root.userData.laneCenterX = mouthLaneX * CELL;
  root.userData.collisionSource = (course.blocks || []).some(block => block[0] === Math.floor(anchor[0]) && block[1] === Math.floor(anchor[1]))
    ? 'existing-authored-cover-cell' : 'clearance-preserving-visual';
  root.userData.landmarkId = item.id;
  if (item.hero) anchors.hero = root;
  return { root, p: palette, moving, motion, anchors, lights, artDirection: course.artDirection };
}

function dimensions(item, widthScale = 1.55, heightScale = 1.4, depthScale = 1.5) {
  const size = item.size || [3, 4, 2.5];
  return {
    width: clamp(size[0] * widthScale, 4.2, 11.4),
    height: clamp(size[1] * heightScale, 4.2, 7.8),
    depth: clamp(size[2] * depthScale, 2.4, 7.4),
  };
}

function buildPressureCrucible(item, ctx) {
  const { root, p, moving, anchors } = ctx;
  const { width, height, depth } = dimensions(item, 2.05, 1.45, 1.6);
  const half = width * .5, centerY = height * .55, faceZ = depth * .5;
  beam(root, p.dark, 0, .27, 0, width * 1.16, .5, depth * 1.25, 'CrucibleCastFoot');
  beam(root, p.iron, 0, .56, .12, width * .87, .12, depth * .96, 'CrucibleCatchTray', false);
  beam(root, p.edge, 0, .68, faceZ * .58, width * .72, .08, .12, 'CrucibleDrainLip', false);
  for (const side of [-1, 1]) {
    const post = beam(root, p.iron, side * half * .4, height * .49, 0, .42, height * .91, .48, `CrucibleUpright_${side}`);
    post.rotation.z = side * -.045;
    beam(root, p.edge, side * half * .4, height * .49, faceZ * .68, .11, height * .76, .11, `CrucibleRail_${side}`, false);
    const piston = part(root, new THREE.CylinderGeometry(.22, .3, height * .47, 12), p.edge, side * half * .34, height * .48, faceZ * .58, `CrucibleRam_${side}`);
    piston.rotation.z = side * .04;
    part(root, new THREE.CylinderGeometry(.11, .14, height * .28, 10), p.rust, side * half * .34, height * .44, faceZ * .68, `CrucibleRamRod_${side}`, false);
    beam(root, p.iron, side * half * .54, .42, 0, .65, .65, depth * .9, `CrucibleFoot_${side}`);
  }
  beam(root, p.iron, 0, height * .94, -.04, width * 1.04, .46, .58, 'CrucibleOverheadPress');
  beam(root, p.edge, 0, height * .84, faceZ * .64, width * .74, .11, .12, 'CrucibleTopRail', false);
  const ring = part(root, new THREE.TorusGeometry(.98, .19, 12, 36), p.edge, 0, centerY, faceZ * .72, 'CruciblePressureCollar');
  ring.scale.set(width * .22, height * .255, 1);
  const gasket = part(root, new THREE.TorusGeometry(.9, .075, 8, 32), p.bronze, 0, centerY, faceZ * .74 + .05, 'CrucibleCopperGasket', false);
  gasket.scale.set(width * .205, height * .238, 1);
  const cavity = part(root, new THREE.SphereGeometry(1, 20, 14), p.void, 0, centerY, faceZ * .65, 'CrucibleAbyss');
  cavity.scale.set(width * .188, height * .215, .22);
  const membrane = part(root, new THREE.SphereGeometry(1, 18, 12), p.membrane, -.08, centerY - .04, faceZ * .78, 'CrucibleTautMembrane', false);
  membrane.scale.set(width * .153, height * .179, .12);
  membrane.userData.noBatch = true;
  moving.push(membrane);
  const core = part(root, new THREE.SphereGeometry(.18, 14, 10), p.red, .05, centerY, faceZ * .83, 'CrucibleEmberCore', false);
  core.scale.set(1.1, 1.4, .65);
  core.userData.noBatch = true;
  moving.push(core);
  anchors.core ||= core;
  for (let i = 0; i < 9; i++) {
    const angle = i / 9 * Math.PI * 2;
    const x = Math.cos(angle) * width * .22, y = centerY + Math.sin(angle) * height * .255;
    const bolt = part(root, new THREE.CylinderGeometry(.065, .08, .1, 8), p.dark, x, y, faceZ * .73 + .12, `CrucibleCollarBolt_${i}`, false);
    bolt.rotation.x = Math.PI / 2;
  }
  const gear = part(root, new THREE.TorusGeometry(.43, .11, 8, 22), p.bronze, half * .48, height * .88, faceZ * .22, 'CrucibleRatchetWheel');
  gear.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    beam(root, p.edge, half * .48 + Math.cos(a) * .48, height * .88 + Math.sin(a) * .48, faceZ * .22, .12, .12, .2, `CrucibleRatchetTooth_${i}`, false);
  }
  cable(root, p.dark, [half * .48, height, faceZ * .22], [half * .48, height * .67, faceZ * .22], .055, 'CrucibleHangingChain');
  const gauge = beam(root, p.dark, half * .69, height * .62, faceZ * .48, .56, 1.05, .13, 'CruciblePressureGauge');
  gauge.rotation.z = -.035;
  for (let i = 0; i < 3; i++) {
    const lamp = part(root, new THREE.SphereGeometry(.095, 10, 8), p.goldSignal, half * .69, height * (.76 - i * .14), faceZ * .56, `CrucibleGaugeLamp_${i}`, false);
    lamp.scale.z = .42;
  }
  for (const side of [-1, 1]) {
    curve(root, p.rust, [[side * half * .4, height * .58, faceZ * .35], [side * half * .62, height * .48, faceZ * .22], [side * half * .7, .35, 0]], .085, `CruciblePressureHose_${side}`);
  }
  return root;
}

function buildTheatreTable(item, ctx) {
  const { root, p, moving, anchors } = ctx;
  const { width, height, depth } = dimensions(item, 1.5, 1.15, 1.2);
  const tableLength = Math.min(5.8, width * .88), tableDepth = Math.min(2.8, depth * .7);
  beam(root, p.iron, 0, 1.02, .05, tableLength, .22, tableDepth, 'GraftTheatreTableTop');
  beam(root, p.porcelain, 0, 1.15, .09, tableLength * .9, .08, tableDepth * .83, 'GraftTheatreCeramicPad', false);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      part(root, new THREE.CylinderGeometry(.075, .12, .9, 8), p.edge, side * tableLength * .4, .52, end * tableDepth * .36, `GraftTableLeg_${side}_${end}`);
    }
    const cuff = part(root, new THREE.TorusGeometry(.18, .045, 7, 16), p.bronze, side * tableLength * .37, 1.28, .12, `GraftRestraint_${side}`, false);
    cuff.rotation.x = Math.PI / 2;
  }
  beam(root, p.dark, 0, .3, 0, tableLength * .7, .12, tableDepth * .72, 'GraftDrainPan', false);
  const specimen = part(root, new THREE.CapsuleGeometry(.3, tableLength * .36, 5, 12), p.membrane, 0, 1.32, 0, 'GraftCoveredSpecimen', false);
  specimen.rotation.z = Math.PI / 2;
  specimen.scale.set(1, 1, .66);
  specimen.userData.noBatch = true;
  moving.push(specimen);
  if (item.hero) anchors.hero = root;

  const railY = clamp(height * .95, 5.2, 6.9), ringY = clamp(height * .72, 4.1, 5.5);
  beam(root, p.edge, 0, railY, -.35, tableLength * 1.26, .16, .18, 'GraftCeilingTrack');
  for (const side of [-1, 1]) cable(root, p.iron, [side * tableLength * .52, railY, -.35], [side * tableLength * .44, ringY + .7, .16], .045, `GraftLampSuspension_${side}`);
  const lampRing = part(root, new THREE.TorusGeometry(.84, .12, 10, 28), p.edge, .14, ringY, .18, 'GraftSurgicalLampRing');
  lampRing.scale.set(1.45, .72, 1);
  lampRing.userData.noBatch = true;
  moving.push(lampRing);
  for (let i = 0; i < 5; i++) {
    const angle = i / 5 * Math.PI * 2;
    const x = .14 + Math.cos(angle) * 1.03, y = ringY + Math.sin(angle) * .5;
    part(root, new THREE.CylinderGeometry(.13, .18, .14, 10), p.dark, x, y, .23, `GraftLampSocket_${i}`, false);
    part(root, new THREE.SphereGeometry(.1, 10, 8), i % 2 ? p.goldSignal : p.red, x, y - .08, .24, `GraftLampEmitter_${i}`, false);
  }
  beam(root, p.iron, -tableLength * .56, 2.85, -.42, .22, 3.2, .2, 'GraftInstrumentSpine');
  for (let i = 0; i < 3; i++) {
    const tool = beam(root, i === 1 ? p.bronze : p.edge, -tableLength * .55 + i * .29, 3.35, -.27, .085, 1.25 + i * .12, .085, `GraftHangingInstrument_${i}`, false);
    tool.rotation.z = (i - 1) * .09;
  }

  // A suspended extraction rig gives the theatre a readable vertical
  // silhouette from the entry. Its tools stay over the existing table block
  // and above head height, so the authored route and collision map do not
  // change. The static parts merge into the floor's existing material batches.
  const gantryY = railY + .38;
  for (const side of [-1, 1]) {
    const rail = beam(root, p.iron, 0, gantryY, side * tableDepth * .5, tableLength * 1.08, .13, .14, `GraftExtractionRail_${side}`, false);
    rail.receiveShadow = false;
    const end = beam(root, p.edge, side * tableLength * .52, gantryY, 0, .15, .13, tableDepth * 1.08, `GraftExtractionCrossbar_${side}`, false);
    end.receiveShadow = false;
  }
  const manipulators = [
    { side: -1, anchor: [-tableLength * .36, gantryY, -.84], elbow: [-tableLength * .22, ringY + 1.12, -.14], wrist: [-.38, 2.45, .2], tip: [-.46, 1.96, .2] },
    { side: 1, anchor: [tableLength * .37, gantryY, .84], elbow: [tableLength * .23, ringY + .92, .48], wrist: [.68, 2.88, .3], tip: [.77, 2.39, .3] },
  ];
  for (const rig of manipulators) {
    const [ax, ay, az] = rig.anchor, [ex, ey, ez] = rig.elbow, [wx, wy, wz] = rig.wrist, [tx, ty, tz] = rig.tip;
    const upper = cable(root, p.edge, rig.anchor, rig.elbow, .092, `GraftManipulatorUpperArm_${rig.side}`);
    const forearm = cable(root, p.iron, rig.elbow, rig.wrist, .067, `GraftManipulatorForearm_${rig.side}`);
    const needle = cable(root, p.bone, rig.wrist, rig.tip, .047, `GraftManipulatorNeedle_${rig.side}`);
    for (const link of [upper, forearm, needle]) { link.castShadow = false; link.receiveShadow = false; }
    const shoulder = part(root, new THREE.SphereGeometry(.16, 10, 8), p.bronze, ax, ay, az, `GraftManipulatorShoulder_${rig.side}`, false);
    const elbow = part(root, new THREE.SphereGeometry(.2, 12, 8), p.rust, ex, ey, ez, `GraftManipulatorJoint_${rig.side}`, false);
    const wrist = part(root, new THREE.TorusGeometry(.16, .045, 6, 14), p.edge, wx, wy, wz, `GraftManipulatorCollar_${rig.side}`, false);
    wrist.rotation.x = Math.PI / 2;
    for (const joint of [shoulder, elbow, wrist]) joint.receiveShadow = false;
    const hose = curve(root, p.dark, [rig.anchor, [ax, ay - .5, az * .82], [ex * .94, ey + .48, ez - .15], rig.wrist], .052, `GraftManipulatorUmbilical_${rig.side}`);
    hose.castShadow = false; hose.receiveShadow = false;
    const warning = part(root, new THREE.SphereGeometry(.075, 8, 6), p.red, ax, ay - .22, az, `GraftManipulatorWarning_${rig.side}`, false);
    warning.receiveShadow = false;
  }
  return root;
}

function archOpeningShape(width, height, inset = .18) {
  const shape = new THREE.Shape();
  const innerWidth = width * (1 - inset * 2), innerHeight = height * .79;
  shape.moveTo(-width * .5, 0);
  shape.lineTo(-width * .5, height * .58);
  shape.quadraticCurveTo(-width * .42, height * .88, 0, height);
  shape.quadraticCurveTo(width * .42, height * .88, width * .5, height * .58);
  shape.lineTo(width * .5, 0);
  shape.lineTo(innerWidth * .5, 0);
  shape.lineTo(innerWidth * .5, innerHeight * .57);
  shape.quadraticCurveTo(innerWidth * .42, innerHeight * .88, 0, innerHeight);
  shape.quadraticCurveTo(-innerWidth * .42, innerHeight * .88, -innerWidth * .5, innerHeight * .57);
  shape.lineTo(-innerWidth * .5, 0);
  shape.closePath();
  return shape;
}

function archVoidShape(width, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * .5, 0);
  shape.lineTo(-width * .5, height * .56);
  shape.quadraticCurveTo(-width * .42, height * .88, 0, height);
  shape.quadraticCurveTo(width * .42, height * .88, width * .5, height * .56);
  shape.lineTo(width * .5, 0);
  shape.closePath();
  return shape;
}

function tornMembraneGeometry(width, height, seed = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * .34, 0);
  shape.quadraticCurveTo(-width * .56, height * .22, -width * .31, height * .38);
  shape.lineTo(-width * .42, height * .55);
  shape.quadraticCurveTo(-width * .14, height * .5, width * .02, height * .7);
  shape.lineTo(width * .18, height * .57);
  shape.quadraticCurveTo(width * .34, height * .78, width * .46, height);
  shape.quadraticCurveTo(width * .12, height * .87, -width * .11, height * .96);
  shape.quadraticCurveTo(-width * .3, height * .68, -width * .23, height * .5);
  shape.lineTo(-width * .44, height * .43);
  shape.quadraticCurveTo(-width * .15, height * .24, -width * .34, 0);
  const geometry = new THREE.ShapeGeometry(shape, 16);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i), y = positions.getY(i);
    positions.setZ(i, Math.sin((x + seed) * 8.4) * .035 + Math.sin(y * 5.3 + seed) * .045);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function irregularThroatPocketGeometry(width, height, seed = 0) {
  const shape = new THREE.Shape();
  const segments = 11;
  const point = index => {
    const angle = index / segments * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 2.2 + seed * 1.7) * .11 + Math.sin(angle * 4.1 - seed) * .055;
    return [
      Math.cos(angle) * width * .5 * wobble,
      Math.sin(angle) * height * .5 * (1 + Math.sin(angle * 3 + seed) * .08) * wobble,
    ];
  };
  const first = point(0);
  shape.moveTo(first[0], first[1]);
  for (let i = 1; i <= segments; i++) {
    const next = point(i % segments);
    shape.lineTo(next[0], next[1]);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .055,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: .018,
    bevelThickness: .012,
    curveSegments: 2,
  });
  geometry.translate(0, 0, -.0275);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i), y = positions.getY(i);
    positions.setZ(i, positions.getZ(i) + Math.sin((x + seed) * 5.7) * .018 + Math.cos(y * 4.3 - seed) * .014);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function chippedMawBlockGeometry(width, height, depth, seed = 0) {
  const cut = Math.min(width, height) * (.11 + (seed % 3) * .018);
  const shape = new THREE.Shape();
  shape.moveTo(-width * .5 + cut, -height * .5);
  shape.lineTo(width * .5 - cut * .82, -height * .5);
  shape.lineTo(width * .5, -height * (.5 - cut / height * .72));
  shape.lineTo(width * .5 - cut * .7, height * .5);
  shape.lineTo(-width * (.5 - cut / width * .78), height * .5);
  shape.lineTo(-width * .5, height * (.5 - cut / height * .68));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(.04, width * .08, height * .08),
    bevelThickness: Math.min(.035, depth * .08),
    curveSegments: 1,
    steps: 1,
  });
  geometry.translate(0, 0, -depth * .5);
  return geometry;
}

function rootedMawFangGeometry(radius, length, seed = 0) {
  const geometry = new THREE.ConeGeometry(radius, length, 9, 5);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const t = (y + length * .5) / length;
    const ripple = 1 + Math.sin(Math.atan2(z, x) * 3 + seed * 1.7 + t * 2.2) * .055;
    positions.setXYZ(i, x * ripple + Math.sin(seed * 2.1) * t * t * length * .065,
      y, z * ripple * .8 + Math.cos(seed * 1.9) * t * t * length * .035);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function gulletArchPoint(width, height, side, t) {
  const springT = .42;
  const springY = height * .58;
  if (t <= springT) return { x: side * width * .5, y: springY * t / springT };
  const u = clamp((t - springT) / (1 - springT), 0, 1);
  const inv = 1 - u;
  const p0 = [side * width * .5, springY];
  const p1 = [side * width * .42, height * .88];
  const p2 = [0, height];
  return {
    x: inv * inv * p0[0] + 2 * inv * u * p1[0] + u * u * p2[0],
    y: inv * inv * p0[1] + 2 * inv * u * p1[1] + u * u * p2[1],
  };
}

function buildMawVoussoirs(root, p, width, height) {
  const count = 9;
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const a = gulletArchPoint(width, height, side, i / count);
      const b = gulletArchPoint(width, height, side, (i + 1) / count);
      const center = gulletArchPoint(width, height, side, (i + .5) / count);
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy) * .9;
      const angle = Math.atan2(-dx, dy);
      const shoulderSag = side > 0 && i >= 6 ? (i - 5) * .045 : 0;
      const mesh = part(root, chippedMawBlockGeometry(.46 + (i % 3) * .035, length, .58, i + side + 2),
        i % 4 === 0 ? p.mawBasaltEdge : p.mawBasalt,
        center.x + (side > 0 && i >= 7 ? .075 : 0), Math.max(length * .48, center.y - shoulderSag), -.2 + Math.sin(i * 1.8 + side) * .045,
        `MawVoussoir_${side}_${i}`);
      mesh.rotation.z = angle + (side > 0 && i >= 6 ? .035 : 0);
      mesh.userData.featureId = 'broken-block-silhouette';
    }
  }
  const keystone = part(root, new THREE.DodecahedronGeometry(.62, 0), p.mawBasaltEdge,
    .1, height * .925, -.24, 'MawCrownKeystone');
  keystone.scale.set(1.2, .84, .78);
  keystone.rotation.z = .075;
}

function taperedMawRibGeometry(points, side) {
  const path = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const rings = 28, sides = 9;
  const vertices = [], uvs = [], indices = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const center = path.getPoint(t);
    const tangent = path.getTangent(t).normalize();
    const lateral = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const radius = (.275 - t * .095) * (1 + Math.sin(i * 1.91 + side * .7) * .07 + Math.sin(i * .68) * .055);
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const chip = (i === 9 || i === 17 || i === 23) && j % 3 === 0 ? .78 : 1;
      const across = Math.cos(angle) * radius * chip;
      const deep = Math.sin(angle) * radius * .7 * chip;
      vertices.push(center.x + lateral.x * across, center.y + lateral.y * across, center.z + deep);
      uvs.push(j / sides, t * 2.5);
      if (i < rings) {
        const a = i * sides + j, b = i * sides + (j + 1) % sides;
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildMawBoneRibs(root, p, apertureWidth, height, front, heroWidth = 0) {
  for (const side of [-1, 1]) {
    const z = front * (heroWidth ? .2 : .13);
    // On the final altar the bone is a pair of actual struts riding the stone
    // crown, not a continuous ivory fascia that hides the masonry underneath.
    const points = heroWidth ? [
      [side * heroWidth * .43, .24, z],
      [side * heroWidth * .435, height * .39, z + .035],
      [side * heroWidth * .41, height * .65, z + .025],
      [side * heroWidth * .34, height * .82, z - .025],
      [side * heroWidth * .2, height * .94, z - .06],
      [side * .1, height * .98, z - .1],
    ] : [
      [side * apertureWidth * .46, .24, z],
      [side * apertureWidth * .46, height * .3, z + .035],
      [side * apertureWidth * .43, height * .58, z + .025],
      [side * apertureWidth * .32, height * .78, z - .025],
      [side * apertureWidth * .16, height * .91, z - .06],
      [side * .09, height * .94, z - .1],
    ];
    const rib = heroWidth
      ? part(root, taperedMawRibGeometry(points, side), p.mawBone, 0, 0, 0, `MawBoneLoadRib_${side}`)
      : curve(root, p.mawBone, points, .145, `MawBoneLoadRib_${side}`);
    rib.userData.featureId = 'rooted-contact';
    const groovePoints = points.slice(1, 5).map(([x, y, zValue]) => [x - side * .09, y, zValue + (heroWidth ? .155 : .085)]);
    curve(root, p.mawBoneShade, groovePoints, .025, `MawBoneAxialGroove_${side}`, false);
  }
  const centerSpine = part(root, new THREE.CapsuleGeometry(.16, height * .22, 5, 9), p.mawBone,
    0, height * .89, front * .13, 'MawCrownLoadSpine');
  centerSpine.rotation.z = Math.PI;
}

function buildMawSquareClamp(root, p, x, y, z, name) {
  const inset = beam(root, p.mawTendon, x, y, z - .035, .46, .31, .08, `${name}_Recess`, false);
  inset.userData.featureId = 'square-bronze-collar';
  const rails = [
    [x, y + .205, .68, .075], [x, y - .205, .68, .075],
    [x - .3, y, .075, .42], [x + .3, y, .075, .42],
  ];
  rails.forEach(([rx, ry, sx, sy], i) => {
    const rail = part(root, chippedMawBlockGeometry(sx, sy, .17, i + 1), p.mawBronze,
      rx, ry, z + .045, `${name}_Rail_${i}`, false);
    rail.userData.featureId = 'square-bronze-collar';
  });
  for (const rivetOffset of [-.22, .22]) {
    const rivet = part(root, new THREE.SphereGeometry(.064, 10, 7), p.mawBronze,
      x + rivetOffset, y, z + .15, `${name}_Rivet_${rivetOffset < 0 ? 'L' : 'R'}`, false);
    rivet.scale.set(1, 1, .42);
    rivet.userData.featureId = 'square-bronze-collar';
  }
}

function buildMawOpenWeb(root, p, apertureWidth, front, depth) {
  const z = front - depth * .68;
  const half = apertureWidth * .39;
  const branches = [
    [[-half, 2.48, z], [-half * .76, 3.05, z - .07], [-half * .45, 3.72, z - .04], [-.18, 4.47, z - .1]],
    [[half, 2.5, z], [half * .74, 3.02, z - .06], [half * .42, 3.73, z - .04], [.16, 4.45, z - .1]],
    [[-half * .76, 3.42, z - .06], [-half * .35, 3.66, z - .11], [0, 3.82, z - .13], [half * .46, 3.55, z - .09]],
    [[-half * .56, 2.8, z - .08], [-half * .38, 3.11, z - .12], [-half * .17, 3.33, z - .1]],
    [[half * .59, 2.86, z - .06], [half * .39, 3.19, z - .12], [half * .19, 3.42, z - .1]],
  ];
  branches.forEach((points, i) => {
    const strand = curve(root, p.mawOxblood, points, i < 2 ? .052 : .034, `MawOpenWebBranch_${i}`, false);
    strand.userData.featureId = 'open-vascular-web';
    strand.userData.noBatch = false;
  });
}

function buildMawThroatDepth(root, p, apertureWidth, front, depth) {
  // A second, recessed layer gives the throat a living depth cue without
  // placing geometry in the first-person lane. The strands sit behind the
  // fascia and start above the 2.1 m standing clearance contract.
  const z = front - depth * .58;
  const half = apertureWidth * .34;
  const liningZ = front - depth * .44;
  const farZ = front - depth * .72;

  // Uneven side folds establish a nearer lining and a darker, farther lining.
  // The open center remains a broad negative shape so the threshold still reads
  // as a walk-through mouth instead of a decorative wall.
  for (const side of [-1, 1]) {
    const outer = part(root, tornMembraneGeometry(half * .46, 1.9, side + 8), p.mawLining,
      side * half * .8, 2.42, liningZ, `MawThroatLining_${side}`, false);
    outer.rotation.z = side * .07;
    outer.scale.x = side < 0 ? .94 : 1.08;
    outer.userData.featureId = 'recessed-throat-lining';

    const inner = part(root, tornMembraneGeometry(half * .29, 1.25, side + 12), p.mawTendon,
      side * half * .61, 2.92, farZ, `MawThroatFarFold_${side}`, false);
    inner.rotation.z = side * -.12;
    inner.scale.x = side < 0 ? 1.04 : .9;
    inner.userData.featureId = 'recessed-throat-depth-gradient';

    // Dark pockets break the lining into large negative holes rather than a
    // flat red sheet. They stay above the player eye line and behind the arch.
    for (let pocketIndex = 0; pocketIndex < 2; pocketIndex++) {
      const pocketWidth = .34 + pocketIndex * .08;
      const pocketHeight = .52 + pocketIndex * .13;
      const pocketX = side * (half * (.73 - pocketIndex * .12));
      const pocketY = 2.72 + pocketIndex * .77;
      const pocket = part(root, irregularThroatPocketGeometry(pocketWidth, pocketHeight, side * 2 + pocketIndex), p.mawRecess,
        pocketX, pocketY,
        liningZ - .02, `MawThroatNegativePocket_${side}_${pocketIndex}`, false);
      pocket.rotation.z = side * (.1 + pocketIndex * .07);
      pocket.userData.featureId = 'recessed-throat-negative-pocket';

      const rimPoints = [];
      for (let rimIndex = 0; rimIndex <= 8; rimIndex++) {
        const angle = rimIndex / 8 * Math.PI * 2;
        const wobble = 1 + Math.sin(angle * 2.4 + side * .7 + pocketIndex) * .08;
        rimPoints.push([
          Math.cos(angle) * pocketWidth * .53 * wobble,
          Math.sin(angle) * pocketHeight * .53 * wobble,
          0,
        ]);
      }
      const rim = curve(root, p.mawPocketRim, rimPoints, .009, `MawThroatNegativePocketRim_${side}_${pocketIndex}`, false);
      rim.position.set(pocketX, pocketY, liningZ + .018);
      rim.rotation.z = side * (.1 + pocketIndex * .07);
      rim.userData.featureId = 'recessed-throat-pocket-rim';
    }
  }

  const strands = [
    [[-half, 2.56, z], [-half * .74, 2.98, z - .04], [-half * .38, 3.55, z - .02], [-.08, 4.22, z - .08]],
    [[half, 2.62, z - .03], [half * .7, 3.04, z - .02], [half * .36, 3.62, z - .06], [.14, 4.06, z - .1]],
    [[-half * .66, 3.28, z - .06], [-half * .24, 3.58, z - .1], [half * .18, 3.42, z - .12], [half * .55, 3.76, z - .14]],
  ];
  strands.forEach((points, index) => {
    const vein = curve(root, p.mawVascular, points, index === 2 ? .026 : .034, `MawThroatVascular_${index}`, false);
    vein.userData.featureId = 'recessed-throat-depth';
  });

  const liningVeins = [
    [[-half * .98, 2.44, liningZ + .03], [-half * .88, 2.8, z + .02], [-half * .72, 3.2, farZ + .04], [-half * .43, 3.55, farZ]],
    [[half * .98, 2.48, liningZ + .03], [half * .87, 2.88, z + .02], [half * .68, 3.28, farZ + .04], [half * .38, 3.66, farZ]],
    [[-half * .77, 3.18, farZ + .03], [-half * .53, 3.42, farZ - .02], [-half * .18, 3.54, z - .06], [half * .19, 3.46, z - .09]],
    [[half * .72, 3.07, farZ + .03], [half * .49, 3.37, farZ - .02], [half * .13, 3.55, z - .06], [-half * .24, 3.63, z - .1]],
  ];
  liningVeins.forEach((points, index) => {
    const vein = curve(root, p.mawVascular, points, index < 2 ? .044 : .029, `MawThroatLiningVein_${index}`, false);
    vein.userData.featureId = 'recessed-throat-vascular-lining';
  });

  root.userData.throatDepth = {
    liningMinY: 2.42,
    liningZ,
    farZ,
    negativePockets: 4,
    vascularStrands: strands.length + liningVeins.length,
  };
}

function buildMawGrounding(root, p, width, apertureWidth, front, hero = false) {
  for (const side of [-1, 1]) {
    const x = side * (apertureWidth * .5 + .64);
    const base = part(root, chippedMawBlockGeometry(.86, .74, 1.08, side + 4), p.mawBasaltEdge,
      x, .36, -.04, `MawRootedBasaltMass_${side}`);
    base.rotation.z = side * -.055;
    for (let i = 0; i < 4; i++) {
      const chip = part(root, new THREE.IcosahedronGeometry(.21 + (i % 2) * .07, 0),
        i % 3 === 0 ? p.mawBoneShade : p.mawBasaltEdge,
        side * (apertureWidth * .5 + .4 + i * .18), .11 + (i % 2) * .09,
        front * .24 + (i % 2) * .24, `MawFootRubble_${side}_${i}`, false);
      chip.scale.set(1.45, .76, .85);
    }
    // A deterministic, uneven skirt ties the monumental arch back into the
    // floor. Keep it beyond the walking aperture; the right shoulder carries
    // one extra raised shard so the silhouette feels fractured, not mirrored.
    const cluster = [
      { offset: .32, radius: .34, y: .23, scale: [1.8, .9, 1.25] },
      { offset: .61, radius: .42, y: .31, scale: [1.42, 1.05, 1.1] },
      { offset: .9, radius: .32, y: .21, scale: [1.9, .72, 1.5] },
    ];
    if (side > 0) cluster.push({ offset: .98, radius: .31, y: .66, scale: [.9, 2.05, .95] });
    cluster.forEach((rock, index) => {
      const seed = index * 1.73 + side * .61;
      const shard = part(root, new THREE.DodecahedronGeometry(rock.radius, 0),
        index === 1 && side > 0 ? p.mawBoneShade : p.mawBasaltEdge,
        side * (apertureWidth * .5 + .38 + rock.offset), rock.y,
        front * (.17 + (index % 2) * .22), `MawFootRubbleCluster_${side}_${index}`, false);
      shard.scale.set(...rock.scale);
      shard.rotation.set(seed * .11, seed * .73, side * (-.12 - index * .045));
      shard.userData.featureId = 'grounded-fracture';
    });
    if (hero) {
      // The altar's outer walls collapse into an uneven basalt buttress. The
      // chunks are outside the open lane and vary in height and depth.
      const shoulder = side < 0 ? [
        [.13, .67, .78, 0], [.29, 1.7, .58, -.1], [.03, 2.75, .62, -.2], [.23, 3.78, .48, -.26],
      ] : [
        [.2, .72, .91, .04], [.43, 1.58, .73, -.08], [.21, 2.48, .62, -.17], [.35, 3.55, .55, -.29], [.07, 4.24, .37, -.33],
      ];
      shoulder.forEach(([outward, y, radius, z], index) => {
        const chunk = part(root, new THREE.DodecahedronGeometry(radius, 0),
          index % 3 === 1 ? p.mawBasaltEdge : p.mawBasalt,
          side * (width * .5 + outward), y, z, `MawFracturedButtress_${side}_${index}`, false);
        chunk.scale.set(1.08 + index * .07, 1.32 - index * .06, .89 + (index % 2) * .18);
        chunk.rotation.set(.08 * index, side * (.16 + index * .23), side * (.06 - index * .045));
        chunk.userData.featureId = 'broken-block-silhouette';
      });
    }
    const wet = part(root, new THREE.PlaneGeometry(.94, .17), p.mawDamp,
      side * (apertureWidth * .5 + .88), .013, front * .45, `MawDampFootStreak_${side}`, false);
    wet.rotation.x = -Math.PI / 2;
    wet.rotation.z = side * .18;
    wet.receiveShadow = false;
  }
}

function buildBoneReliquary(item, ctx) {
  const { root, p, moving } = ctx;
  const size = item.size || [3, 4, 2.5];
  const width = clamp(size[0] * 1.95, 4, 10.8), height = clamp(size[1] * 1.45, 4.4, 7.8), depth = clamp(size[2] * 1.45, 2.6, 6.8);
  const outer = archOpeningShape(width, height, .18);
  const arch = part(root, new THREE.ExtrudeGeometry(outer, { depth: .36, bevelEnabled: true, bevelSegments: 2, bevelSize: .08, bevelThickness: .08, curveSegments: 8 }), p.bone, 0, 0, -.16, 'ReliquaryPointedBoneArch');
  arch.castShadow = true;
  const inner = archVoidShape(width * .58, height * .78);
  const alcove = part(root, new THREE.ShapeGeometry(inner), p.void, 0, 0, -.22, 'ReliquaryBlackAlcove', false);
  const plinth = beam(root, p.dark, 0, .25, .16, width * .95, .5, depth, 'ReliquarySteppedFoot');
  beam(root, p.boneEdge, 0, .55, .2, width * .76, .1, depth * .74, 'ReliquaryStoneShelf', false);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = side * width * (.34 + i * .045);
      const rib = part(root, new THREE.CapsuleGeometry(.14 + i * .025, height * (.31 + (i % 2) * .06), 5, 10), p.boneEdge, x, height * .42, depth * .22, `ReliquaryRib_${side}_${i}`);
      rib.rotation.z = side * (i - 1) * .12;
    }
  }
  const spine = part(root, new THREE.CylinderGeometry(.19, .28, height * .57, 9), p.boneEdge, 0, height * .34, depth * .33, 'ReliquaryLoadBearingSpine');
  spine.rotation.z = .08;
  for (let i = 0; i < 5; i++) {
    const skull = part(root, new THREE.IcosahedronGeometry(.26 + (i % 2) * .035, 1), p.bone, Math.sin(i * 1.8) * width * .2, height * (.29 + i * .105), depth * .38, `ReliquarySkull_${i}`, false);
    skull.scale.set(1.15, .92, .72);
    const socket = part(root, new THREE.SphereGeometry(.055, 8, 6), p.void, skull.position.x - .11, skull.position.y + .025, depth * .4, `ReliquaryEyeSocket_${i}`, false);
    socket.scale.x = 1.25;
  }
  for (const side of [-1, 1]) {
    const taper = part(root, new THREE.ConeGeometry(.18, 1.25, 8), p.bone, side * width * .41, height * .78, .1, `ReliquaryCrownTooth_${side}`, false);
    taper.rotation.z = side * -.16;
  }
  const ember = part(root, new THREE.SphereGeometry(.11, 10, 8), p.goldSignal, -.03, height * .54, depth * .42, 'ReliquaryVotive');
  ember.scale.set(1, 1.6, .5);
  ember.userData.noBatch = true;
  moving.push(ember);
  root.userData.massing = { style: 'pointed-load-bearing-arch', width, height, depth, clearOpening: true };
  return root;
}

function buildMouthAltar(item, ctx, gate = false) {
  const { root, p, moving, anchors, lights } = ctx;
  const blackGulletFamily = ctx.artDirection?.id === 'f5-last-descent' && String(item.type || '').toLowerCase().includes('mouth');
  const blackGulletHero = item.hero === true && item.id === 'f5-last-altar';
  const blackGulletRouteLandmark = item.id === 'f5-mid-throat';
  const blackGulletThroat = blackGulletHero || blackGulletRouteLandmark;
  const size = item.size || [3, 4, 2.5];
  const width = clamp(size[0] * (blackGulletHero ? 2.15 : gate ? 1.65 : 1.85), 4.2, 10.6);
  const height = clamp(size[1] * (gate ? 1.18 : 1.38), 4.2, 7.7);
  const depth = clamp(size[2] * 1.35, 2.4, 6.4);
  const front = depth * .43;
  const apertureWidth = width * (blackGulletRouteLandmark ? .68 : .61);
  const apertureHeight = height * .78;
  // Keep the receding hoops above the standing player silhouette. The lower
  // placement looked dramatic in plan view but clipped the avatar through the
  // authored center lane in first-person play.
  const throatY = height * .75;

  // The dark stone and bone are a structural arch around an open, walk-through
  // throat. Nested rings pull the eye into depth without placing a face across
  // the gameplay lane.
  const footWidth = (width * 1.08 - apertureWidth) * .5;
  for (const side of [-1, 1]) {
    beam(root, blackGulletFamily ? p.mawBasalt : p.dark, side * (apertureWidth * .5 + footWidth * .5), .18, 0, footWidth, .34, depth * 1.12, `MawBasaltFoot_${side}`);
  }
  const backingArch = part(root, new THREE.ExtrudeGeometry(archOpeningShape(width, height, blackGulletRouteLandmark ? .13 : .2), {
    depth: .38, bevelEnabled: true, bevelSegments: 2, bevelSize: .075, bevelThickness: .07, curveSegments: 9,
  }), blackGulletFamily ? p.mawBasalt : p.iron, 0, .22, -.42, 'MawBasaltLoadBearingArch');
  backingArch.castShadow = true;
  if (blackGulletThroat) {
    buildMawVoussoirs(root, p, width, height);
    buildMawGrounding(root, p, width, apertureWidth, front, blackGulletHero);
  }
  if (!blackGulletHero) {
    const boneArch = part(root, new THREE.ExtrudeGeometry(archOpeningShape(
      width * (blackGulletRouteLandmark ? .98 : .89),
      height * .93,
      blackGulletRouteLandmark ? .13 : .19,
    ), {
      depth: .34, bevelEnabled: true, bevelSegments: 2, bevelSize: .06, bevelThickness: .055, curveSegments: 9,
    }), blackGulletFamily ? p.mawBone : p.boneEdge, 0, .3, -.04, 'MawUnevenBoneRibArch');
    boneArch.castShadow = true;
  }
  if (blackGulletThroat) buildMawBoneRibs(root, p, apertureWidth, height, front, blackGulletHero ? width : 0);
  if (blackGulletHero) {
    // A deep, open arch section gives the final mouth a fleshy inner wall.
    // It is a ring, never a closing sheet across the playable lane.
    const vault = part(root, new THREE.ExtrudeGeometry(
      archOpeningShape(apertureWidth * 1.18, apertureHeight * 1.08, .14),
      { depth: depth * .68, bevelEnabled: false, curveSegments: 9 },
    ), p.mawOxblood, 0, .38, front * .25 - depth * .68, 'MawOxbloodThroatVault', false);
    vault.userData.featureId = 'walk-through-throat-depth';
  }
  const innerFascia = part(root, new THREE.ExtrudeGeometry(archOpeningShape(apertureWidth * 1.1, apertureHeight, .13), {
    depth: .2, bevelEnabled: true, bevelSegments: 1, bevelSize: .045, bevelThickness: .035, curveSegments: 9,
  }), blackGulletHero ? p.mawOxblood : blackGulletFamily ? p.mawRecess : p.flesh, 0, .38, front * .48, 'MawRecessedLivingFascia', false);
  innerFascia.castShadow = false;

  // The right shoulder has a torn oxblood membrane with branching veins. Its
  // inner edge stays outside the clear aperture so the horror dressing never
  // turns into a paper wall across the playable threshold.
  const membraneWidth = Math.min(1.1, (width - apertureWidth) * .95);
  const membraneHeight = height * .57;
  const membraneX = apertureWidth * .5 + membraneWidth * .58;
  const membraneY = height * .19;
  const membraneZ = front * .72;
  const membrane = part(root, tornMembraneGeometry(membraneWidth, membraneHeight, item.anchor?.[0] || 0), blackGulletFamily ? p.mawOxblood : p.membrane,
    membraneX, membraneY, membraneZ, 'MawOxbloodTearMembrane', false);
  membrane.castShadow = false;
  curve(root, blackGulletFamily ? p.mawOxblood : p.gore, [
    [membraneX - membraneWidth * .16, membraneY + membraneHeight * .08, membraneZ + .045],
    [membraneX + membraneWidth * .12, membraneY + membraneHeight * .36, membraneZ + .055],
    [membraneX - membraneWidth * .04, membraneY + membraneHeight * .63, membraneZ + .045],
    [membraneX + membraneWidth * .23, membraneY + membraneHeight * .86, membraneZ + .035],
  ], .028, 'MawMembraneVascularSeam', false);
  if (blackGulletThroat) buildMawOpenWeb(root, p, apertureWidth, front, depth);
  if (blackGulletThroat) buildMawThroatDepth(root, p, apertureWidth, front, depth);
  if (blackGulletHero) {
    // A collapsed right shoulder breaks the altar’s otherwise mirrored read
    // and gives the player a grounded scale cue when approaching in motion.
    const brokenShoulder = beam(root, p.mawBasaltEdge, width * .36, .9, front * .28,
      .34, 1.68, .3, 'MawBrokenShoulder', false);
    brokenShoulder.rotation.z = -.24;
    const shoulderJoint = beam(root, p.mawBasalt, width * .34, .34, front * .2,
      .72, .28, .62, 'MawBrokenShoulderJoint', false);
    shoulderJoint.rotation.z = -.08;
    for (let rubbleIndex = 0; rubbleIndex < 3; rubbleIndex += 1) {
      const rubble = part(root, new THREE.DodecahedronGeometry(.28 + rubbleIndex * .08, 0),
        rubbleIndex === 1 ? p.mawBoneShade : p.mawBasaltEdge,
        width * (.34 + rubbleIndex * .045), .22 + rubbleIndex * .1,
        .58 + rubbleIndex * .19, `MawShoulderRubble_${rubbleIndex}`, false);
      rubble.scale.set(1.15, .72 + rubbleIndex * .08, .82);
      rubble.rotation.set(.18 * rubbleIndex, .4 + rubbleIndex * .31, -.2 * rubbleIndex);
    }
    const looseTooth = part(root, new THREE.ConeGeometry(.13, .78, 7), p.mawBoneShade,
      width * .42, .6, front * .58, 'MawLooseShoulderTooth', false);
    looseTooth.rotation.z = -.56;
  }

  for (const side of [-1, 1]) {
    const outer = part(root, new THREE.CapsuleGeometry(.21, height * .63, 5, 10), blackGulletFamily ? p.mawBone : p.bone, side * width * .43, height * .39, .16, `MawLoadBearingStrut_${side}`);
    outer.rotation.z = side * -.11;
    const inner = part(root, new THREE.CapsuleGeometry(.11, height * .48, 4, 9), blackGulletFamily ? p.mawTendon : p.flesh, side * apertureWidth * .43, height * .39, front * .77, `MawInnerTendonRib_${side}`, false);
    inner.rotation.z = side * .09;
    for (let cuff = 0; cuff < 2; cuff++) {
      const clampY = height * (.28 + cuff * .42);
      if (blackGulletFamily) {
        buildMawSquareClamp(root, p, side * width * .43, clampY, .31, `MawBronzeTie_${side}_${cuff}`);
      } else {
        const clampRing = part(root, new THREE.TorusGeometry(.25, .055, 7, 16), p.bronze, side * width * .43, clampY, .22, `MawBronzeTie_${side}_${cuff}`, false);
        clampRing.rotation.x = Math.PI / 2;
        clampRing.scale.set(1.22, .9, 1);
      }
    }
    if (blackGulletFamily) {
      curve(root, p.mawTendon, [
        [side * width * .43, height * .70, .31],
        [side * width * .39, height * .77, .12],
        [side * width * .33, height * .83, -.12],
        [side * width * .28, height * .86, -.22],
      ], .062, `MawTendonAnchor_${side}`);
      curve(root, p.mawTendon, [
        [side * width * .43, height * .28, .31],
        [side * width * .4, height * .35, .22],
        [side * width * .34, height * .42, .12],
        [side * apertureWidth * .43, height * .47, .08],
      ], .047, `MawLowerSinew_${side}`);
    } else {
      cable(root, p.rust, [side * width * .4, height * .58, .08], [side * width * .29, height * .84, -.1], .095, `MawTendonAnchor_${side}`);
      cable(root, p.flesh, [side * width * .31, height * .22, front * .83], [side * width * .2, height * .46, front * .8], .075, `MawLowerSinew_${side}`);
    }
  }

  const ringCount = blackGulletFamily ? 1 : 3;
  for (let ring = 0; ring < ringCount; ring++) {
    const sizeScale = blackGulletFamily ? .28 : 1 - ring * .105;
    const loop = part(root, new THREE.TorusGeometry(.5, blackGulletFamily ? .035 : ring === 0 ? .12 : .075, 9, 28),
      blackGulletFamily ? p.mawBronze : ring === 0 ? p.bronze : ring === 1 ? p.boneEdge : p.flesh,
      0, throatY, blackGulletFamily ? front - depth * .7 : front - ring * depth * .31,
      `MawVanishingThroatRing_${ring}`, false);
    loop.scale.set(apertureWidth * sizeScale, apertureHeight * .48 * sizeScale, 1);
    if (ring === 2) { loop.userData.noBatch = true; moving.push(loop); }
  }

  // Teeth hang from the roof and gather at the outer edges. The middle of the
  // aperture stays clear enough to read as an actual threshold.
  const toothLengths = [.55, .39, .82, .34, .7, .47, 1.08];
  for (let i = 0; i < toothLengths.length; i++) {
    if (i === 3 && !gate && !blackGulletHero) continue;
    const t = i / 6, x = (t - .5) * apertureWidth * .84;
    const length = blackGulletHero && i === 3 ? 1.42 : toothLengths[i];
    const radius = blackGulletHero && i === 3 ? .22 : .11 + (i % 3) * .025;
    const tooth = part(root, blackGulletHero ? rootedMawFangGeometry(radius, length, i + 2) : new THREE.ConeGeometry(radius, length, 7),
      blackGulletFamily ? (i % 2 || i === 3 ? p.mawBone : p.mawBoneShade) : (i % 2 ? p.bone : p.boneEdge),
      x + (i % 2 ? -.055 : .075), height * (.81 + Math.sin(t * Math.PI) * .015) - length * .44, front + .1, `MawCrownTooth_${i}`, false);
    tooth.rotation.z = Math.PI + (t - .5) * .18 + (i % 2 ? .06 : -.035);
  }
  for (const side of [-1, 1]) {
    const sideToothCount = side < 0 ? 2 : 1;
    for (let i = 0; i < sideToothCount; i++) {
      const tooth = part(root, new THREE.ConeGeometry(.09 + i * .018, .36 + i * .12, 7), blackGulletFamily ? p.mawBone : p.bone,
        side * apertureWidth * (.44 + i * .035), .72 + i * .3, front + .11, `MawSideTooth_${side}_${i}`, false);
      tooth.rotation.z = side < 0 ? -.62 : .62;
    }
  }
  if (blackGulletHero) {
    // These fangs grow out of the side rubble, not the walk lane. Their
    // different heights give the final mouth a grounded lower jaw.
    for (const side of [-1, 1]) {
      const fangs = side < 0 ? [
        { x: .46, length: 1.32, radius: .29, z: .53 },
        { x: .37, length: .91, radius: .21, z: .36 },
      ] : [
        { x: .46, length: 1.18, radius: .28, z: .5 },
        { x: .39, length: .74, radius: .18, z: .32 },
      ];
      fangs.forEach((fang, index) => {
        const rootX = side * apertureWidth * fang.x;
        const tooth = part(root, rootedMawFangGeometry(fang.radius, fang.length, index + side * 3),
          index === 0 ? p.mawBone : p.mawBoneShade,
          rootX, fang.length * .48, front * fang.z,
          `MawRootedGroundFang_${side}_${index}`, false);
        tooth.rotation.z = side * (index === 0 ? -.1 : -.16);
        tooth.userData.featureId = 'rooted-lower-fangs';
      });
    }
  }

  const ember = part(root, new THREE.SphereGeometry(blackGulletFamily ? .13 : .105, 10, 8), blackGulletFamily ? p.mawEmber : p.red, -.06, throatY, front - depth * .78, 'MawDeepEmber', false);
  ember.scale.set(blackGulletFamily ? .84 : .76, blackGulletFamily ? 1.26 : 1.2, blackGulletFamily ? .68 : .62);
  ember.userData.noBatch = true;
  moving.push(ember);
  if (blackGulletHero) {
    // Keep the deep ember for parallax, then add a small mid-depth core so the
    // altar has one readable focal signal from the player's approach distance.
    // It remains above the standing lane and uses the same authored material.
    const coreZ = front - depth * .46;
    const coreY = Math.max(2.6, throatY - 1.05);
    const core = part(root, new THREE.SphereGeometry(.09, 8, 6), p.mawEmber, 0, coreY, coreZ, 'MawEmberCore', false);
    core.scale.set(.84, 1.28, .68);
    core.userData.noBatch = true;
    moving.push(core);
    const coreHalo = new THREE.PointLight(new THREE.Color(0xff7040), .18, 2.8, 2);
    coreHalo.name = `MawEmberCoreHalo_${item.id}`;
    coreHalo.position.set(0, coreY, coreZ);
    coreHalo.userData.baseIntensity = coreHalo.intensity;
    coreHalo.userData.phase = (item.anchor?.[1] || 0) * .19 + 1.4;
    root.add(coreHalo);
    lights.push(coreHalo);
  }
  anchors.core ||= ember;
  if (item.hero) {
    const lampColor = blackGulletHero ? 0xffa94b : (ctx.artDirection?.accent || 0xff3c3c);
    // The hero ember is the one deliberate value break inside the gullet. It
    // is brighter than a room cue but remains short-ranged, so it reveals the
    // web, rim, and altar silhouette without lifting the whole chamber.
    const lamp = new THREE.PointLight(new THREE.Color(lampColor), blackGulletHero ? .5 : .58, blackGulletHero ? 5.5 : 8, 2);
    lamp.name = `MawEmberLight_${item.id}`;
    lamp.position.set(-.06, throatY, front - depth * .7);
    lamp.userData.baseIntensity = lamp.intensity;
    lamp.userData.phase = item.anchor?.[0] * .17 || 0;
    root.add(lamp);
    lights.push(lamp);
    if (blackGulletHero) {
      const bounce = new THREE.PointLight(0x9a3b3f, .24, 5.1, 2);
      bounce.name = `MawThroatBounce_${item.id}`;
      bounce.position.set(.04, throatY + .76, front - depth * .55);
      bounce.userData.baseIntensity = bounce.intensity;
      bounce.userData.phase = (item.anchor?.[1] || 0) * .23 + .8;
      root.add(bounce);
      lights.push(bounce);
    }
  }
  if (item.id === 'f5-mid-throat') {
    // Paired shoulder embers hold the mid-route silhouette at approach range.
    // They sit outside the open center and use short, low-power pools.
    for (const side of [-1, 1]) {
      const x = side * width * .43;
      const y = height * .68;
      const z = front * .56;
      const socket = part(root, new THREE.SphereGeometry(.13, 9, 7), p.mawBronze,
        x, y, z, `MawShoulderCueSocket_${side}`, false);
      socket.scale.set(1, 1.2, .58);
      const emitter = part(root, new THREE.SphereGeometry(.075, 8, 6), p.mawEmber,
        x, y, z + .07, `MawShoulderCueEmitter_${side}`, false);
      emitter.userData.noBatch = true;
      moving.push(emitter);
      const light = new THREE.PointLight(0xffa35a, .24, 7.5, 2);
      light.name = `MawShoulderCueLight_${side}`;
      light.position.set(x, y, z + .08);
      light.userData.baseIntensity = light.intensity;
      light.userData.phase = (item.anchor?.[1] || 0) * .16 + (side > 0 ? .7 : 0);
      root.add(light);
      lights.push(light);
    }
  }
  const clearApertureWidth = apertureWidth * 1.1 * .74 - .1;
  const clearApertureHeight = apertureHeight * .79;
  root.userData.massing = {
    style: blackGulletFamily ? 'load-bearing-black-gullet' : gate ? 'jaw-framed-open-threshold' : 'load-bearing-black-gullet',
    width,
    height,
    depth,
    apertureWidth,
    apertureHeight,
    clearApertureWidth,
    clearApertureHeight,
    bottomClearance: clearApertureHeight,
    walkThrough: true,
    ...(blackGulletHero ? {
      visualIdentity: 'black-gullet-v2',
      featureComponents: [
        'segmented-basalt', 'warm-bone-load-ribs', 'square-socket-clamps',
        'open-vascular-web', 'recessed-throat-lining', 'negative-pocket-depth',
        'grounded-footing',
      ],
      collisionOwner: 'f5-last-descent-course',
    } : {}),
    ...(item.id === 'f5-mid-throat' ? {
      visualIdentity: 'black-gullet-throat-v1',
      featureComponents: [
        'segmented-basalt', 'warm-bone-load-ribs', 'square-socket-clamps',
        'open-vascular-web', 'recessed-throat-lining', 'grounded-footing',
        'paired-shoulder-embers',
      ],
      collisionOwner: 'f5-last-descent-course',
    } : {}),
  };
  if (item.hero) anchors.hero = root;
  return root;
}

function buildBellArray(item, ctx) {
  const { root, p, motion } = ctx;
  const size = item.size || [3.5, 4, 2.5];
  const span = clamp(size[0] * 1.8, 4.8, 9.2), top = clamp(size[1] * 1.25, 4.8, 7.2);
  beam(root, p.iron, 0, top, 0, span, .24, .34, 'BellNaveCrossbeam');
  beam(root, p.bronze, 0, top - .21, .18, span * .76, .07, .08, 'BellNaveResonatorRail', false);
  const count = item.id.includes('f5') ? 3 : item.id.includes('f3') ? 4 : 5;
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    group.name = `HollowBronzeBell_${i}`;
    group.userData.noBatch = true;
    const x = (i / (count - 1) - .5) * span * .78;
    const bottom = top - 1.45 - (i % 2) * .36;
    group.position.set(x, bottom, (i % 2 ? .32 : -.16));
    const scale = .72 + (i % 3) * .12;
    const profile = [
      new THREE.Vector2(.17, .84), new THREE.Vector2(.25, .8), new THREE.Vector2(.36, .68),
      new THREE.Vector2(.46, .46), new THREE.Vector2(.54, .2), new THREE.Vector2(.55, .08),
      new THREE.Vector2(.49, .04), new THREE.Vector2(.4, .2), new THREE.Vector2(.31, .46),
      new THREE.Vector2(.2, .63), new THREE.Vector2(.14, .65),
    ];
    const shell = part(group, new THREE.LatheGeometry(profile, 20), i % 3 === 0 ? p.boneEdge : p.bronze, 0, 0, 0, `BellShell_${i}`);
    shell.scale.setScalar(scale);
    const lip = part(group, new THREE.TorusGeometry(.53, .065, 8, 22), p.edge, 0, .1, 0, `BellLip_${i}`, false);
    lip.scale.setScalar(scale);
    const clapper = part(group, new THREE.SphereGeometry(.1, 10, 8), p.goldSignal, 0, .18, 0, `BellClapper_${i}`, false);
    clapper.scale.setScalar(scale);
    cable(root, p.dark, [x, top, (i % 2 ? .32 : -.16)], [x, bottom + .68 * scale, (i % 2 ? .32 : -.16)], .045, `BellChain_${i}`);
    root.add(group);
    motion.push({ object: group, mode: 'pendulum', phase: i * .93 + item.anchor[0] * .11 });
  }
  root.userData.massing = { style: 'suspended-resonator-array', span, count, clearFloor: true };
  return root;
}

function buildGateOrgan(item, ctx) {
  const { root, p, moving, anchors } = ctx;
  const { width, height } = dimensions(item, 1.55, 1.3, 1.2);
  const half = width * .47, centerY = height * .53;
  beam(root, p.iron, -half, height * .4, 0, .36, height * .8, .56, 'IntakeIrisLeftCasting');
  beam(root, p.iron, half, height * .4, 0, .36, height * .8, .56, 'IntakeIrisRightCasting');
  beam(root, p.edge, 0, height * .89, 0, width, .42, .62, 'IntakeIrisHeader');
  const ring = part(root, new THREE.TorusGeometry(1.25, .22, 12, 36), p.edge, 0, centerY, .3, 'IntakeIrisBezel');
  ring.scale.set(width * .25, height * .33, 1);
  const cavity = part(root, new THREE.CircleGeometry(1, 28), p.void, 0, centerY, .22, 'IntakeIrisDarkAperture', false);
  cavity.scale.set(width * .218, height * .29, 1);
  for (let i = 0; i < 8; i++) {
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(.02, -.12); bladeShape.lineTo(.18, -.18); bladeShape.lineTo(1.02, -.28);
    bladeShape.quadraticCurveTo(1.15, 0, 1.02, .28); bladeShape.lineTo(.18, .18); bladeShape.closePath();
    const blade = part(root, new THREE.ExtrudeGeometry(bladeShape, { depth: .1, bevelEnabled: true, bevelSegments: 1, bevelSize: .02, bevelThickness: .025 }), i % 2 ? p.iron : p.bronze, 0, centerY, .38, `IntakeIrisPetal_${i}`);
    const angle = i / 8 * Math.PI * 2;
    blade.position.set(Math.cos(angle) * width * .19, centerY + Math.sin(angle) * height * .19, .39);
    blade.rotation.z = angle + Math.PI;
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const rib = part(root, new THREE.CapsuleGeometry(.09, height * .47, 4, 8), p.rust, side * width * (.34 + i * .035), height * (.35 + i * .13), -.05, `IntakeGateRib_${side}_${i}`);
      rib.rotation.z = side * .08;
    }
  }
  const core = part(root, new THREE.SphereGeometry(.13, 12, 8), p.red, 0, centerY, .5, 'IntakeIrisPilotLight', false);
  core.userData.noBatch = true; moving.push(core); anchors.core ||= core;
  root.userData.massing = { style: 'nine-rib-pressure-iris', width, height, clearOpening: true };
  if (item.hero) anchors.hero = root;
  return root;
}

function buildToothRack(item, ctx) {
  const { root, p, moving } = ctx;
  const { width, height, depth } = dimensions(item, 1.35, 1.22, 1.1);
  beam(root, p.dark, 0, .23, 0, width * .92, .42, depth * .72, 'ToothRackStoneBase');
  for (const side of [-1, 1]) beam(root, p.iron, side * width * .38, height * .48, 0, .23, height * .9, .24, `ToothRackPost_${side}`);
  beam(root, p.bronze, 0, height * .9, 0, width * .85, .18, .3, 'ToothRackTopRail');
  for (let i = 0; i < 7; i++) {
    const x = (i / 6 - .5) * width * .68, toothHeight = height * (.42 + ((i * 7) % 4) * .105);
    const tooth = part(root, new THREE.ConeGeometry(.18 + (i % 3) * .035, toothHeight, 7), i % 2 ? p.bone : p.boneEdge, x, toothHeight * .5 + .36, .08, `ToothRackSpecimen_${i}`, false);
    tooth.rotation.z = (i % 2 ? -.08 : .08);
  }
  for (let i = 0; i < 4; i++) {
    const clamp = beam(root, p.edge, -width * .34 + i * width * .22, height * .28, .18, .16, .12, .36, `ToothRackClamp_${i}`, false);
    clamp.rotation.z = (i % 2 ? -.04 : .04);
  }
  const pulse = part(root, new THREE.SphereGeometry(.14, 10, 8), p.goldSignal, 0, height * .83, .2, 'ToothRackAlarm', false);
  pulse.userData.noBatch = true; moving.push(pulse);
  return root;
}

function buildBoiler(item, ctx) {
  const { root, p, moving, anchors } = ctx;
  const { width, height, depth } = dimensions(item, 1.7, 1.38, 1.45);
  beam(root, p.dark, 0, .28, 0, width * 1.08, .5, depth * 1.08, 'FurnaceBoilerFoot');
  const vessel = part(root, new THREE.CylinderGeometry(width * .32, width * .38, height * .64, 16), p.iron, 0, height * .43, 0, 'FurnacePressureVessel');
  const cap = part(root, new THREE.CylinderGeometry(width * .3, width * .36, .32, 16), p.bronze, 0, height * .76, 0, 'FurnaceCrown');
  cap.rotation.z = .02;
  for (let i = 0; i < 7; i++) {
    const y = height * (.2 + i * .088);
    const ring = part(root, new THREE.TorusGeometry(width * .34, .065, 7, 22), i % 2 ? p.edge : p.bronze, 0, y, 0, `FurnaceVesselBand_${i}`, false);
    ring.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const x = side * width * .34;
      cable(root, p.edge, [x, y, .02], [x + side * .08, y + .3, .02], .045, `FurnaceBandBrace_${i}_${side}`);
    }
  }
  const furnaceEye = part(root, new THREE.SphereGeometry(.36, 16, 12), p.red, 0, height * .48, width * .35, 'FurnacePilotWindow');
  furnaceEye.scale.set(1.1, .85, .36); furnaceEye.userData.noBatch = true; moving.push(furnaceEye); anchors.core ||= furnaceEye;
  const gauge = part(root, new THREE.TorusGeometry(.42, .08, 8, 18), p.edge, width * .47, height * .66, .02, 'FurnacePressureDial');
  gauge.scale.set(.8, 1.05, 1);
  beam(root, p.dark, width * .47, height * .66, .1, .045, .48, .09, 'FurnaceDialNeedle', false);
  for (const side of [-1, 1]) {
    curve(root, p.rust, [[side * width * .25, height * .22, depth * .35], [side * width * .42, height * .12, depth * .32], [side * width * .5, .25, .12]], .1, `FurnaceFeedPipe_${side}`);
  }
  return root;
}

function buildPumpBank(item, ctx) {
  const { root, p, moving, motion } = ctx;
  const span = item.size?.[0] ? clamp(item.size[0] * 1.15, 2.4, 5.3) : 3.6;
  const height = item.size?.[1] ? clamp(item.size[1] * 1.2, 3, 5.8) : 4.1;
  beam(root, p.dark, 0, .26, 0, span * 1.3, .48, 1.4, 'PumpBankBoltedBase');
  beam(root, p.iron, 0, .58, -.12, span * 1.06, .14, .9, 'PumpBankManifold');
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * span * .31;
    const barrel = part(root, new THREE.CylinderGeometry(.23, .31, height * .52, 12), p.iron, x, height * .43, 0, `PumpBankCylinder_${i}`);
    const top = part(root, new THREE.TorusGeometry(.27, .045, 6, 16), p.bronze, x, height * .7, 0, `PumpBankCap_${i}`, false);
    top.rotation.x = Math.PI / 2;
    const piston = part(root, new THREE.CylinderGeometry(.085, .11, .62, 8), p.edge, x, height * .79, 0, `PumpBankPiston_${i}`);
    piston.userData.noBatch = true; moving.push(piston); motion.push({ object: piston, mode: 'pulse', phase: i * .65 });
    curve(root, p.rust, [[x, .7, .3], [x + .08, .42, .55], [x + .2, .35, .62]], .06, `PumpBankFeed_${i}`);
  }
  const dial = part(root, new THREE.CylinderGeometry(.37, .37, .11, 16), p.dark, 0, height * .74, .53, 'PumpBankDial');
  dial.rotation.x = Math.PI / 2;
  part(root, new THREE.TorusGeometry(.33, .045, 7, 20), p.bronze, 0, height * .74, .6, 'PumpBankDialBezel', false);
  part(root, new THREE.SphereGeometry(.08, 8, 6), p.goldSignal, .11, height * .76, .61, 'PumpBankNeedle', false);
  return root;
}

function buildChainLift(item, ctx) {
  const { root, p, motion } = ctx;
  const { width, height, depth } = dimensions(item, 1.35, 1.35, 1.35);
  const railX = Math.min(1.35, width * .25), top = clamp(height + 1.6, 5.5, 7.2);
  beam(root, p.iron, 0, top, 0, width * 1.1, .26, depth * .74, 'DescentLiftHeader');
  for (const side of [-1, 1]) {
    beam(root, p.edge, side * railX, top * .48, 0, .16, top * .88, .22, `DescentLiftGuide_${side}`);
    const drum = part(root, new THREE.TorusGeometry(.45, .12, 8, 22), p.bronze, side * railX, top * .91, .05, `DescentLiftSheave_${side}`);
    drum.rotation.x = Math.PI / 2;
    motion.push({ object: drum, mode: 'ratchet', phase: side * .75 });
    cable(root, p.dark, [side * railX, top, .05], [side * railX, 3.1, .05], .045, `DescentLiftChain_${side}`);
  }
  const cage = new THREE.Group(); cage.name = 'DescentLiftSuspendedCage'; cage.position.set(0, 2.35, .05); cage.userData.noBatch = true;
  beam(cage, p.iron, 0, 0, 0, railX * 1.82, .16, depth * .68, 'DescentLiftCageFloor');
  for (const side of [-1, 1]) {
    beam(cage, p.edge, side * railX * .8, .85, 0, .12, 1.7, .12, `DescentLiftCagePost_${side}`);
    beam(cage, p.iron, side * railX * .8, 1.65, 0, .12, .12, depth * .68, `DescentLiftCageRail_${side}`);
  }
  root.add(cage);
  root.userData.massing = { style: 'overhead-chain-lift', clearFloor: true, walkHeight: 2.0 };
  return root;
}

function buildConduit(item, ctx) {
  const { root, p } = ctx;
  const { height, depth } = dimensions(item, 1.2, 1.35, 1.15);
  const pts = [[-.6, .55, .08], [-.45, height * .38, .05], [.08, height * .55, .12], [.28, height * .82, .02], [.72, height * .9, 0]];
  curve(root, p.rust, pts, .23, 'GraftConduitOuterSine');
  curve(root, p.flesh, pts.map(([x, y, z]) => [x + .12, y, z + .08]), .11, 'GraftConduitInnerVessel');
  beam(root, p.dark, 0, .24, 0, 2.8, .42, depth, 'GraftConduitDrain', false);
  for (let i = 0; i < 4; i++) {
    const y = height * (.22 + i * .17), rib = part(root, new THREE.TorusGeometry(.38 + i * .02, .055, 7, 16), p.bronze, pts[i + 1][0], y, .06, `GraftConduitClamp_${i}`, false);
    rib.scale.set(1.35, .62, 1);
  }
  return root;
}

function buildGantry(item, ctx) {
  const { root, p, motion } = ctx;
  const width = clamp((item.size?.[0] || 4) * 1.9, 6, 13), height = clamp((item.size?.[1] || 3) * 1.4, 4.8, 7.1);
  beam(root, p.iron, 0, height, 0, width, .3, .4, 'CraneGalleryRail');
  for (const side of [-1, 1]) {
    beam(root, p.edge, side * width * .43, height * .5, 0, .25, height, .3, `CraneGalleryStanchion_${side}`);
    curve(root, p.iron, [[side * width * .43, height * .22, .02], [side * width * .18, height * .62, .02], [0, height * .95, .02]], .13, `CraneGalleryBrace_${side}`);
  }
  const trolley = new THREE.Group(); trolley.name = 'CraneGalleryTrolley'; trolley.position.y = height - .14; trolley.userData.noBatch = true;
  beam(trolley, p.bronze, 0, 0, .08, 1.15, .18, .56, 'CraneTrolleyBody');
  for (const side of [-1, 1]) {
    const wheel = part(trolley, new THREE.TorusGeometry(.2, .07, 7, 16), p.dark, side * .44, -.08, 0, `CraneTrolleyWheel_${side}`);
    wheel.rotation.y = Math.PI / 2;
    cable(trolley, p.dark, [side * .2, -.05, .14], [side * .2, -2.0, .14], .04, `CraneTrolleyChain_${side}`);
  }
  root.add(trolley); motion.push({ object: trolley, mode: 'sway', phase: item.anchor[0] * .23 });
  return root;
}

function buildRibStack(item, ctx) {
  const { root, p } = ctx;
  const { width, height, depth } = dimensions(item, 1.45, 1.35, 1.35);
  beam(root, p.dark, 0, .22, 0, width * .95, .42, depth, 'RibStackCasketBase');
  for (let i = 0; i < 5; i++) {
    const x = (i / 4 - .5) * width * .75, heightFactor = .7 + ((i * 5) % 3) * .12;
    const rib = part(root, new THREE.TorusGeometry(.7, .13, 8, 20, Math.PI), p.bone, x, height * .52 * heightFactor, .18, `RibStackArch_${i}`);
    rib.scale.set(.8 + (i % 2) * .12, height * .55, .8);
    rib.rotation.set(0, Math.PI / 2, Math.PI);
  }
  const darkSpine = part(root, new THREE.CylinderGeometry(.18, .25, height * .85, 9), p.boneEdge, 0, height * .46, -.08, 'RibStackVertebralSpine');
  darkSpine.rotation.z = .12;
  for (let i = 0; i < 3; i++) {
    const shard = part(root, new THREE.IcosahedronGeometry(.24 + i * .035, 1), p.bone, (i - 1) * width * .18, height * (.4 + i * .13), depth * .2, `RibStackSkull_${i}`, false);
    shard.scale.y = .8;
  }
  return root;
}

export function buildDungeonLandmark(item, materials, course, animation) {
  if (!item || !course?.dungeon) return null;
  const moving = animation.moving || [], motion = animation.motion || [], anchors = animation.anchors || {}, lights = animation.lights || [];
  const ctx = makeRoot(item, materials, course, moving, motion, anchors, lights);
  const type = String(item.type || '').toLowerCase(), id = String(item.id || '').toLowerCase();
  let root;
  if (type === 'organ-pump' && id.includes('theater')) root = buildTheatreTable(item, ctx);
  else if (type.includes('mouth')) root = buildMouthAltar(item, ctx, type.includes('gate'));
  else if (type.includes('bell-array')) root = buildBellArray(item, ctx);
  else if (type.includes('gate') && type.includes('rib')) root = buildBoneReliquary(item, ctx);
  else if (type.includes('gate')) root = buildGateOrgan(item, ctx);
  else if (type.includes('organ-pump')) root = buildPressureCrucible(item, ctx);
  else if (type.includes('boiler')) root = buildBoiler(item, ctx);
  else if (type.includes('bone-throne')) root = buildBoneReliquary(item, ctx);
  else if (type.includes('rib')) root = buildRibStack(item, ctx);
  else if (type.includes('tooth')) root = buildToothRack(item, ctx);
  else if (type.includes('pump-bank')) root = buildPumpBank(item, ctx);
  else if (type.includes('chain-lift')) root = buildChainLift(item, ctx);
  else if (type.includes('gantry')) root = buildGantry(item, ctx);
  else if (type.includes('conduit')) root = buildConduit(item, ctx);
  else return null;
  root.userData.visualOnly = true;
  root.userData.floorId = course.id;
  root.userData.modelFamily = course.artDirection?.architecture || course.sectorId;
  root.userData.modelId = `${root.userData.modelFamily}-${type}`;
  root.userData.collisionSource = ctx.root.userData.collisionSource;
  root.userData.landmarkId = item.id;
  root.userData.massing ||= { style: `${type}-landmark`, clearFloor: root.userData.collisionSource !== 'existing-authored-cover-cell' };
  if (item.hero && !anchors.hero) anchors.hero = root;
  return ctx.root;
}
