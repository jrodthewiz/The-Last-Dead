import * as THREE from './vendor/three.module.js';

// Lightweight procedural props for the Forsaken Afterlife pass.  These are
// intentionally authored as small, reusable factories instead of imported
// meshes: the wheelchair is a sparse tube network and the cabinet is a narrow
// assembled shell.  Both stay below the close-prop budget while retaining the
// silhouettes and negative spaces that make them readable in the dark.

export const AFTERLIFE_PROP_VERSION = 1;

export const AFTERLIFE_PROP_DIMENSIONS = Object.freeze({
  wheelchair: Object.freeze({ width: .68, depth: 1.05, height: 1.10, triangleBudget: 3000 }),
  mourningCabinet: Object.freeze({ width: .72, depth: .32, height: 2.05, triangleBudget: 3000 }),
});

const UP = new THREE.Vector3(0, 1, 0);
const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();
const TMP_C = new THREE.Vector3();
const TMP_Q = new THREE.Quaternion();
const TMP_M = new THREE.Matrix4();

const DEFAULTS = Object.freeze({
  metal: { color: 0x4a4c48, roughness: .58, metalness: .74 },
  rubber: { color: 0x151719, roughness: .9, metalness: .03 },
  fabric: { color: 0x35191c, roughness: .82, metalness: .04 },
  cabinet: { color: 0x242727, roughness: .82, metalness: .18 },
  bone: { color: 0x53595a, roughness: .78, metalness: .06 },
  recess: { color: 0x070a0b, roughness: .97, metalness: .01 },
});

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function ownGeometry(root, geometry) {
  root.userData.afterlifePropOwned.geometries.add(geometry);
  return geometry;
}

function ownMaterial(root, material) {
  root.userData.afterlifePropOwned.materials.add(material);
  return material;
}

function sourceMaterial(options, keys) {
  const materials = options?.materials || {};
  for (const key of keys) {
    if (materials[key]) return materials[key];
  }
  return null;
}

function material(root, options, key, keys, defaults = DEFAULTS[key], role = null) {
  const source = sourceMaterial(options, keys);
  if (source) return source;
  const created = new THREE.MeshStandardMaterial(defaults);
  created.name = `AfterlifeProp_${key}`;
  created.userData.afterlifePropOwned = true;
  if (role) created.userData.afterlifeSurfaceRole = role;
  return ownMaterial(root, created);
}

function materialWithSide(root, source, side = THREE.DoubleSide) {
  if (!source || source.side === side) return source;
  const clone = source.clone();
  clone.name = `${source.name || 'AfterlifePropMaterial'}_TwoSided`;
  clone.side = side;
  clone.userData = { ...(source.userData || {}), afterlifePropOwned: true };
  return ownMaterial(root, clone);
}

function initRoot(kind, options = {}) {
  const root = new THREE.Group();
  root.name = options.name || `AfterlifeProp_${kind}`;
  root.userData.afterlifeProp = kind;
  root.userData.afterlifePropVersion = AFTERLIFE_PROP_VERSION;
  root.userData.afterlifePropDimensions = { ...AFTERLIFE_PROP_DIMENSIONS[kind] };
  root.userData.afterlifePropOwned = { geometries: new Set(), materials: new Set() };
  root.userData.sculptRuntime = {
    version: 'afterlife-prop-v1',
    parts: Object.create(null),
    sockets: Object.create(null),
    colliders: [],
    destructionGroups: Object.create(null),
  };
  root.userData.afterlifePropDiagnostics = {
    kind,
    version: AFTERLIFE_PROP_VERSION,
    triangleBudget: AFTERLIFE_PROP_DIMENSIONS[kind].triangleBudget,
    source: options.reference || null,
    approximation: 'single-view image-guided, low-poly procedural reconstruction',
  };
  return root;
}

function makePart(root, id, options = {}) {
  const pivot = new THREE.Group();
  pivot.name = `${root.name}_${id}`;
  pivot.userData.afterlifePropPart = id;
  pivot.userData.actionProfile = {
    animationRole: options.animationRole || 'static-part',
    pivot: options.pivot || 'base',
    collider: options.collider || null,
    destructionGroup: options.destructionGroup || id,
  };
  root.add(pivot);
  root.userData.sculptRuntime.parts[id] = pivot;
  if (options.destructionGroup) {
    const list = root.userData.sculptRuntime.destructionGroups[options.destructionGroup] ||= [];
    list.push(id);
  }
  return pivot;
}

function addSocket(root, id, parent, position, options = {}) {
  const socket = new THREE.Object3D();
  socket.name = `${root.name}_Socket_${id}`;
  socket.position.fromArray(position);
  socket.userData.socket = id;
  socket.userData.parentPart = options.parentPart || parent?.userData?.afterlifePropPart || null;
  socket.userData.kind = options.kind || 'attachment';
  parent.add(socket);
  root.userData.sculptRuntime.sockets[id] = socket;
  return socket;
}

function addCollider(root, type, size, options = {}) {
  const collider = {
    type,
    size: size.slice(),
    offset: (options.offset || [0, 0, 0]).slice(),
    part: options.part || null,
    isTrigger: options.isTrigger === true,
  };
  root.userData.sculptRuntime.colliders.push(collider);
  return collider;
}

function tagMesh(mesh, role, part, options = {}) {
  mesh.name = options.name || mesh.name || 'AfterlifePropMesh';
  mesh.userData.afterlifeProp = true;
  mesh.userData.afterlifeSurfaceRole = role || mesh.userData.afterlifeSurfaceRole || null;
  mesh.userData.afterlifePropPart = part?.userData?.afterlifePropPart || null;
  if (options.explodeWithParent) mesh.userData.explodeWithParent = true;
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  part?.add(mesh);
  return mesh;
}

function mesh(root, part, name, geometry, mat, role, options = {}) {
  const item = new THREE.Mesh(geometry, mat);
  return tagMesh(item, role, part, { ...options, name });
}

function tubeGeometry(root, segments = 6) {
  const key = `tube${segments}`;
  const cache = root.userData.afterlifePropOwned.tubeGeometries ||= Object.create(null);
  if (!cache[key]) cache[key] = ownGeometry(root, new THREE.CylinderGeometry(1, 1, 1, segments, 1, false));
  return cache[key];
}

function addTube(root, part, name, start, end, radius, mat, role = 'roomMetal', options = {}) {
  TMP_A.fromArray(start);
  TMP_B.fromArray(end);
  TMP_C.subVectors(TMP_B, TMP_A);
  const length = TMP_C.length();
  if (length <= 1e-5) return null;
  const item = new THREE.Mesh(tubeGeometry(root, options.segments || 6), mat);
  item.position.copy(TMP_A).add(TMP_B).multiplyScalar(.5);
  item.quaternion.copy(TMP_Q.setFromUnitVectors(UP, TMP_C.normalize()));
  item.scale.set(radius, length, radius);
  return tagMesh(item, role, part, { ...options, name });
}

function addBox(root, part, name, size, position, mat, role, options = {}) {
  const geometry = ownGeometry(root, new THREE.BoxGeometry(size[0], size[1], size[2]));
  const item = new THREE.Mesh(geometry, mat);
  item.position.fromArray(position);
  return tagMesh(item, role, part, { ...options, name });
}

function addCylinder(root, part, name, radius, height, position, mat, role, options = {}) {
  const geometry = ownGeometry(root, new THREE.CylinderGeometry(radius, radius, height, options.segments || 8, 1, false));
  const item = new THREE.Mesh(geometry, mat);
  item.position.fromArray(position);
  if (options.rotation) item.rotation.fromArray(options.rotation);
  return tagMesh(item, role, part, { ...options, name });
}

function addTorus(root, part, name, major, tube, position, mat, role, options = {}) {
  const geometry = ownGeometry(root, new THREE.TorusGeometry(major, tube, options.radialSegments || 6, options.tubularSegments || 16));
  const item = new THREE.Mesh(geometry, mat);
  item.position.fromArray(position);
  if (options.rotation) item.rotation.fromArray(options.rotation);
  if (options.scale) item.scale.fromArray(options.scale);
  return tagMesh(item, role, part, { ...options, name });
}

function clothGrid(root, part, name, config, mat, role = 'roomGore') {
  const width = finite(config.width, .5);
  const height = finite(config.height, .3);
  const columns = Math.max(2, Math.floor(config.columns || 4));
  const rows = Math.max(2, Math.floor(config.rows || 2));
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let col = 0; col <= columns; col++) {
      const u = col / columns;
      const x = (u - .5) * width;
      if (config.orientation === 'back') {
        const center = 1 - Math.min(1, Math.abs(x / (width * .5)));
        const y = finite(config.bottom, .7) + v * height - finite(config.sag, .045) * center * (.82 + .18 * (1 - v));
        const z = finite(config.depth, 0) + finite(config.bow, .028) * center;
        positions.push(x, y, z);
      } else {
        const z = (u - .5) * height;
        const center = 1 - Math.min(1, Math.abs(x / (width * .5)));
        const y = finite(config.baseY, .55) - finite(config.sag, .035) * center * (.74 + .26 * (1 - Math.abs(z / (height * .5))));
        positions.push(x, y, z);
      }
      uvs.push(u, v);
    }
  }
  const rowStride = columns + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const a = row * rowStride + col;
      const b = a + 1;
      const d = (row + 1) * rowStride + col;
      const c = d + 1;
      // Winding is chosen for the visible side; DoubleSide is retained for
      // oblique map views where the cloth can be seen from behind.
      indices.push(a, d, b, b, d, c);
    }
  }
  const geometry = ownGeometry(root, new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const twoSided = materialWithSide(root, mat);
  return mesh(root, part, name, geometry, twoSided, role, { receiveShadow: true, castShadow: false });
}

function addSpokes(root, part, name, radius, count, wheelPosition, mat, role = 'roomMetal') {
  const geometry = root.userData.afterlifePropOwned.spokeGeometry ||= ownGeometry(root, new THREE.CylinderGeometry(.009, .009, radius, 5, 1, false));
  const spokes = new THREE.InstancedMesh(geometry, mat, count);
  spokes.name = name;
  spokes.position.fromArray(wheelPosition);
  spokes.userData.afterlifeProp = true;
  spokes.userData.afterlifeSurfaceRole = role;
  spokes.userData.afterlifePropPart = part.userData.afterlifePropPart;
  spokes.castShadow = true;
  spokes.receiveShadow = false;
  const direction = new THREE.Vector3();
  const midpoint = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2;
    direction.set(0, Math.cos(angle) * radius, Math.sin(angle) * radius);
    midpoint.copy(direction).multiplyScalar(.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
    TMP_M.compose(midpoint, quaternion, new THREE.Vector3(1, 1, 1));
    spokes.setMatrixAt(i, TMP_M);
  }
  spokes.instanceMatrix.needsUpdate = true;
  part.add(spokes);
  return spokes;
}

function addWheel(root, part, side, z, materials) {
  const wheel = new THREE.Group();
  wheel.name = `${root.name}_${side < 0 ? 'Left' : 'Right'}WheelAssembly`;
  wheel.position.set(side * .29, .34, z);
  wheel.userData.afterlifePropPart = side < 0 ? 'leftWheel' : 'rightWheel';
  part.add(wheel);
  const tire = new THREE.Mesh(root.userData.afterlifePropOwned.wheelTireGeometry ||= ownGeometry(root, new THREE.TorusGeometry(.285, .038, 6, 16)), materials.rubber);
  tire.name = `${wheel.name}_Tire`;
  tire.rotation.y = Math.PI / 2;
  tire.userData.afterlifeProp = true;
  tire.userData.afterlifeSurfaceRole = 'roomRecess';
  tire.userData.afterlifePropPart = wheel.userData.afterlifePropPart;
  tire.castShadow = tire.receiveShadow = true;
  wheel.add(tire);
  const rim = new THREE.Mesh(root.userData.afterlifePropOwned.wheelRimGeometry ||= ownGeometry(root, new THREE.TorusGeometry(.246, .018, 5, 14)), materials.metal);
  rim.name = `${wheel.name}_Rim`;
  rim.rotation.y = Math.PI / 2;
  rim.userData.afterlifeProp = true;
  rim.userData.afterlifeSurfaceRole = 'roomMetal';
  rim.userData.afterlifePropPart = wheel.userData.afterlifePropPart;
  rim.castShadow = rim.receiveShadow = true;
  wheel.add(rim);
  addSpokes(root, wheel, `${wheel.name}_Spokes`, .242, 10, [0, 0, 0], materials.metal);
  const hub = new THREE.Mesh(root.userData.afterlifePropOwned.hubGeometry ||= ownGeometry(root, new THREE.CylinderGeometry(.052, .052, .11, 8, 1, false)), materials.metal);
  hub.name = `${wheel.name}_Hub`;
  hub.rotation.z = Math.PI / 2;
  hub.userData.afterlifeProp = true;
  hub.userData.afterlifeSurfaceRole = 'roomMetal';
  hub.userData.afterlifePropPart = wheel.userData.afterlifePropPart;
  hub.castShadow = hub.receiveShadow = true;
  wheel.add(hub);
  return wheel;
}

function addCaster(root, part, side, materials) {
  const caster = new THREE.Group();
  caster.name = `${root.name}_${side < 0 ? 'Left' : 'Right'}CasterAssembly`;
  caster.position.set(side * .235, .13, .42);
  caster.userData.afterlifePropPart = side < 0 ? 'leftCaster' : 'rightCaster';
  part.add(caster);
  addTube(root, caster, `${caster.name}_Fork`, [0, .03, -.035], [0, -.02, .075], .027, materials.metal, 'roomMetal', { segments: 5 });
  const wheel = new THREE.Mesh(root.userData.afterlifePropOwned.casterGeometry ||= ownGeometry(root, new THREE.TorusGeometry(.075, .026, 5, 10)), materials.rubber);
  wheel.name = `${caster.name}_Wheel`;
  wheel.position.set(0, -.025, .08);
  wheel.rotation.y = Math.PI / 2;
  wheel.userData.afterlifeProp = true;
  wheel.userData.afterlifeSurfaceRole = 'roomRecess';
  wheel.userData.afterlifePropPart = caster.userData.afterlifePropPart;
  wheel.castShadow = wheel.receiveShadow = true;
  caster.add(wheel);
  return caster;
}

function finalizeRoot(root) {
  root.traverse(object => {
    if (object.isMesh && object.geometry) object.geometry.computeBoundingSphere?.();
  });
  root.updateMatrixWorld(true);
  let triangles = 0;
  let meshes = 0;
  root.traverse(object => {
    if (!object.isMesh || !object.geometry) return;
    meshes += 1;
    const index = object.geometry.index;
    const count = index ? index.count : object.geometry.attributes.position?.count || 0;
    triangles += object.isInstancedMesh ? count / 3 * object.count : count / 3;
  });
  root.userData.afterlifePropDiagnostics.meshes = meshes;
  root.userData.afterlifePropDiagnostics.triangles = Math.round(triangles);
  root.userData.afterlifePropDiagnostics.materials = root.userData.afterlifePropOwned.materials.size;
  root.userData.afterlifePropDiagnostics.bounds = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).toArray();
  return root;
}

/**
 * Build the image-guided antique wheelchair.  The reference is deliberately
 * treated as a silhouette/material guide; no image is loaded by the runtime.
 */
export function createAfterlifeWheelchair(options = {}) {
  const root = initRoot('wheelchair', { ...options, name: options.name || 'AfterlifeProp_Wheelchair' });
  const metal = material(root, options, 'metal', ['metal', 'roomMetal', 'steel', 'trim'], DEFAULTS.metal, 'roomMetal');
  const rubber = material(root, options, 'rubber', ['rubber', 'black', 'roomRecess', 'metalDark'], DEFAULTS.rubber, 'roomRecess');
  const fabric = material(root, options, 'fabric', ['fabric', 'oxblood', 'roomGore', 'gore'], DEFAULTS.fabric, 'roomGore');
  const materials = { metal, rubber, fabric };
  const frame = makePart(root, 'frame', { destructionGroup: 'frame', collider: { type: 'compound' } });
  const wheels = makePart(root, 'wheels', { destructionGroup: 'wheels', collider: { type: 'pair-of-cylinders' } });
  const seat = makePart(root, 'seat', { destructionGroup: 'cloth', collider: { type: 'box', size: [.5, .12, .55] } });
  const back = makePart(root, 'back', { destructionGroup: 'cloth', collider: { type: 'box', size: [.52, .42, .1] } });
  const footrests = makePart(root, 'footrests', { destructionGroup: 'frame', collider: { type: 'pair-of-boxes' } });
  const leftWheel = makePart(root, 'leftWheel', { destructionGroup: 'wheels', animationRole: 'hinge', pivot: 'axle' });
  const rightWheel = makePart(root, 'rightWheel', { destructionGroup: 'wheels', animationRole: 'hinge', pivot: 'axle' });
  const leftCaster = makePart(root, 'leftCaster', { destructionGroup: 'frame', animationRole: 'hinge', pivot: 'swivel' });
  const rightCaster = makePart(root, 'rightCaster', { destructionGroup: 'frame', animationRole: 'hinge', pivot: 'swivel' });

  // Rear uprights, push handles, arm supports, and the low front rails.  Each
  // member starts and ends in local coordinates so later break/hinge work has
  // a truthful attachment anchor.
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Left' : 'Right';
    addTube(root, frame, `${label}RearUpright`, [side * .235, .48, -.36], [side * .235, 1.0, -.36], .023, metal, 'roomMetal');
    addTube(root, frame, `${label}PushHandle`, [side * .235, 1.0, -.36], [side * .235, 1.08, -.27], .024, metal, 'roomMetal');
    addTube(root, frame, `${label}HandleGrip`, [side * .235, 1.08, -.27], [side * .235, 1.08, -.15], .032, rubber, 'roomRecess');
    addTube(root, frame, `${label}ArmFront`, [side * .235, .66, -.24], [side * .235, .66, .23], .022, metal, 'roomMetal');
    addTube(root, frame, `${label}ArmDrop`, [side * .235, .66, .23], [side * .235, .24, .46], .024, metal, 'roomMetal');
    addTube(root, frame, `${label}LowerFrontRail`, [side * .235, .24, .44], [side * .235, .12, .50], .022, metal, 'roomMetal');
    addTube(root, frame, `${label}RearLowerRail`, [side * .235, .2, -.36], [side * .235, .1, -.02], .021, metal, 'roomMetal');
    addTube(root, frame, `${label}FootrestArm`, [side * .235, .24, .44], [side * .235, .17, .55], .023, metal, 'roomMetal');
    addWheel(root, side < 0 ? leftWheel : rightWheel, side, -.06, materials);
    addCaster(root, side < 0 ? leftCaster : rightCaster, side, materials);
  }
  addTube(root, frame, 'CrossBraceA', [-.225, .31, -.11], [.225, .12, .32], .017, metal, 'roomMetal');
  addTube(root, frame, 'CrossBraceB', [.225, .31, -.11], [-.225, .12, .32], .017, metal, 'roomMetal');

  clothGrid(root, seat, 'SeatSling', { orientation: 'seat', width: .47, height: .57, baseY: .56, sag: .052, columns: 5, rows: 3 }, fabric);
  clothGrid(root, back, 'BackSling', { orientation: 'back', width: .49, height: .30, bottom: .72, depth: -.36, sag: .048, bow: .026, columns: 5, rows: 3 }, fabric);
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Left' : 'Right';
    addBox(root, seat, `${label}SeatEdge`, [.035, .035, .56], [side * .245, .545, -.045], metal, 'roomTrim', { castShadow: false });
    addBox(root, back, `${label}BackEdge`, [.035, .32, .035], [side * .255, .865, -.35], metal, 'roomTrim', { castShadow: false });
    addBox(root, frame, `${label}ArmPad`, [.075, .045, .38], [side * .235, .69, -.02], fabric, 'roomGore', { castShadow: false });
    addBox(root, footrests, `${label}FootPlate`, [.18, .035, .18], [side * .235, .105, .56], metal, 'roomMetal');
    addTube(root, footrests, `${label}FootPlateBrace`, [side * .235, .13, .50], [side * .235, .13, .56], .018, metal, 'roomMetal');
  }

  addSocket(root, 'seatCenter', seat, [0, .02, 0], { parentPart: 'seat', kind: 'interaction' });
  addSocket(root, 'backCenter', back, [0, .15, .03], { parentPart: 'back', kind: 'interaction' });
  addSocket(root, 'leftWheelAxle', leftWheel, [0, 0, 0], { parentPart: 'leftWheel', kind: 'hinge' });
  addSocket(root, 'rightWheelAxle', rightWheel, [0, 0, 0], { parentPart: 'rightWheel', kind: 'hinge' });
  addSocket(root, 'leftCasterSwivel', leftCaster, [0, .03, 0], { parentPart: 'leftCaster', kind: 'hinge' });
  addSocket(root, 'rightCasterSwivel', rightCaster, [0, .03, 0], { parentPart: 'rightCaster', kind: 'hinge' });
  addCollider(root, 'box', [.64, .72, 1.02], { offset: [0, .38, .03], part: 'frame' });
  addCollider(root, 'box', [.5, .12, .55], { offset: [0, .56, -.02], part: 'seat' });
  addCollider(root, 'cylinder-pair', [.32, .32, .10], { offset: [0, .34, -.08], part: 'wheels' });
  return finalizeRoot(root);
}

function cabinetPanel(root, part, name, size, position, mat, role, options = {}) {
  return addBox(root, part, name, size, position, mat, role, { ...options, castShadow: options.castShadow ?? true, receiveShadow: options.receiveShadow ?? true });
}

/** Build the narrow mourning cabinet/reliquary from the second reference. */
export function createAfterlifeReliquary(options = {}) {
  const root = initRoot('mourningCabinet', { ...options, name: options.name || 'AfterlifeProp_MourningCabinet' });
  const cabinet = material(root, options, 'cabinet', ['cabinet', 'roomPanel', 'wood', 'wall'], DEFAULTS.cabinet, 'roomPanel');
  const metal = material(root, options, 'metal', ['brass', 'metal', 'roomTrim', 'steel'], { color: 0x5a4c3a, roughness: .5, metalness: .74 }, 'roomTrim');
  const bone = material(root, options, 'bone', ['frosted', 'bone', 'roomBone'], DEFAULTS.bone, 'roomPanel');
  const recess = material(root, options, 'recess', ['recess', 'roomRecess', 'black'], DEFAULTS.recess, 'roomRecess');
  const frame = makePart(root, 'case', { destructionGroup: 'case', collider: { type: 'box' } });
  const door = makePart(root, 'door', { destructionGroup: 'door', animationRole: 'hinge', pivot: 'hinge' });
  const upper = makePart(root, 'upperFrostedPanel', { destructionGroup: 'door' });
  const lower = makePart(root, 'lowerInsetPanel', { destructionGroup: 'door' });
  const pulls = makePart(root, 'pulls', { destructionGroup: 'hardware' });
  const plinth = makePart(root, 'plinth', { destructionGroup: 'case' });

  cabinetPanel(root, frame, 'CaseBody', [.62, 1.88, .25], [0, .99, .01], cabinet, 'roomPanel');
  cabinetPanel(root, frame, 'LeftCasePost', [.07, 1.94, .30], [-.325, .99, .0], cabinet, 'roomPanel');
  cabinetPanel(root, frame, 'RightCasePost', [.07, 1.94, .30], [.325, .99, .0], cabinet, 'roomPanel');
  cabinetPanel(root, frame, 'CaseTopCap', [.72, .08, .31], [0, 1.985, .0], cabinet, 'roomPanel');
  cabinetPanel(root, plinth, 'ThinPlinth', [.72, .1, .28], [0, .05, .0], cabinet, 'roomPanel');
  cabinetPanel(root, plinth, 'PlinthShadow', [.64, .035, .28], [0, .115, .015], recess, 'roomRecess', { castShadow: false });
  cabinetPanel(root, door, 'DoorRecess', [.50, 1.60, .035], [0, 1.04, -.13], recess, 'roomRecess', { castShadow: false });
  // The reference has two leaves with a narrow dark meeting seam.  Keep the
  // seam as real geometry so it survives the low-light three-quarter view.
  cabinetPanel(root, upper, 'LeftFrostedUpperPanel', [.205, .90, .026], [-.115, 1.43, -.15], bone, 'roomPanel', { castShadow: false });
  cabinetPanel(root, upper, 'RightFrostedUpperPanel', [.205, .90, .026], [.115, 1.43, -.15], bone, 'roomPanel', { castShadow: false });
  cabinetPanel(root, door, 'UpperMuntin', [.035, .91, .035], [0, 1.43, -.16], cabinet, 'roomPanel', { castShadow: false });
  cabinetPanel(root, lower, 'LeftLowerRecessedPanel', [.205, .70, .026], [-.115, .56, -.15], cabinet, 'roomPanel', { castShadow: false });
  cabinetPanel(root, lower, 'RightLowerRecessedPanel', [.205, .70, .026], [.115, .56, -.15], cabinet, 'roomPanel', { castShadow: false });
  cabinetPanel(root, door, 'LowerPanelRail', [.45, .035, .035], [0, .19, -.16], cabinet, 'roomPanel', { castShadow: false });
  cabinetPanel(root, door, 'LowerPanelRailTop', [.45, .035, .035], [0, .92, -.16], cabinet, 'roomPanel', { castShadow: false });
  cabinetPanel(root, door, 'LeftDoorStile', [.035, 1.72, .035], [-.245, 1.04, -.16], cabinet, 'roomPanel', { castShadow: false });
  cabinetPanel(root, door, 'RightDoorStile', [.035, 1.72, .035], [.245, 1.04, -.16], cabinet, 'roomPanel', { castShadow: false });
  cabinetPanel(root, door, 'DoorMeetingSeam', [.025, 1.72, .045], [0, 1.04, -.17], recess, 'roomRecess', { castShadow: false });
  cabinetPanel(root, frame, 'MakerPlaque', [.22, .10, .025], [0, 1.90, -.17], metal, 'roomTrim', { castShadow: false });

  // Two short tarnished pulls are the reference's strongest mid-height cue.
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Left' : 'Right';
    addCylinder(root, pulls, `${label}DoorPull`, .022, .11, [side * .095, .99, -.17], metal, 'roomTrim', { segments: 6 });
    addCylinder(root, pulls, `${label}DoorPullCap`, .032, .018, [side * .095, 1.055, -.17], metal, 'roomTrim', { segments: 6 });
  }
  addTube(root, frame, 'LeftHingeBar', [-.29, .35, -.145], [-.29, 1.78, -.145], .014, metal, 'roomTrim', { segments: 5 });
  addTube(root, frame, 'RightHingeBar', [.29, .35, -.145], [.29, 1.78, -.145], .014, metal, 'roomTrim', { segments: 5 });
  addSocket(root, 'doorHinge', door, [-.25, .9, 0], { parentPart: 'door', kind: 'hinge' });
  addSocket(root, 'doorCenter', door, [0, .95, -.22], { parentPart: 'door', kind: 'interaction' });
  addSocket(root, 'upperPanelCenter', upper, [0, 1.53, -.20], { parentPart: 'upperFrostedPanel', kind: 'surface' });
  addCollider(root, 'box', [.68, 2.0, .32], { offset: [0, 1.0, 0], part: 'case' });
  addCollider(root, 'box', [.5, 1.6, .06], { offset: [0, 1.04, -.16], part: 'door', isTrigger: true });
  return finalizeRoot(root);
}

export const createAfterlifeMourningCabinet = createAfterlifeReliquary;

/** Add a deterministic set of props from map-authored placement records. */
export function buildAfterlifeProps(root, placements = [], options = {}) {
  if (!root) throw new TypeError('buildAfterlifeProps requires a root group');
  const props = [];
  for (const placement of placements) {
    if (!placement || !placement.type) continue;
    const type = placement.type === 'wheelchair' ? 'wheelchair' : (placement.type === 'reliquary' || placement.type === 'mourning-cabinet' ? 'mourningCabinet' : null);
    if (!type) continue;
    const factory = type === 'wheelchair' ? createAfterlifeWheelchair : createAfterlifeReliquary;
    const prop = factory({ ...options, ...placement.options, name: placement.name || undefined, reference: placement.reference || options.reference });
    if (placement.position) prop.position.fromArray(placement.position);
    if (placement.rotation) prop.rotation.fromArray(placement.rotation);
    if (placement.scale) prop.scale.fromArray(placement.scale);
    prop.userData.afterlifePropPlacement = { ...placement, options: undefined };
    root.add(prop);
    props.push(prop);
  }
  return {
    root,
    props,
    diagnostics: {
      version: AFTERLIFE_PROP_VERSION,
      count: props.length,
      kinds: props.reduce((counts, prop) => { counts[prop.userData.afterlifeProp] = (counts[prop.userData.afterlifeProp] || 0) + 1; return counts; }, {}),
    },
  };
}

export function disposeAfterlifeProp(root) {
  if (!root?.userData?.afterlifePropOwned) return false;
  const owned = root.userData.afterlifePropOwned;
  for (const geometry of owned.geometries || []) geometry?.dispose?.();
  for (const mat of owned.materials || []) {
    for (const key of ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'aoMap', 'emissiveMap']) {
      const texture = mat?.[key];
      if (texture?.userData?.afterlifePropOwned) texture.dispose?.();
    }
    mat?.dispose?.();
  }
  root.userData.afterlifePropDisposed = true;
  root.removeFromParent();
  return true;
}

export function afterlifePropDiagnostics(root) {
  return root?.userData?.afterlifePropDiagnostics ? { ...root.userData.afterlifePropDiagnostics } : null;
}

export default Object.freeze({
  createAfterlifeWheelchair,
  createAfterlifeReliquary,
  createAfterlifeMourningCabinet,
  buildAfterlifeProps,
  disposeAfterlifeProp,
  afterlifePropDiagnostics,
});
