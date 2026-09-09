import * as THREE from './vendor/three.module.js';
import { getRoomPalette, CELL } from './room-materials.js';

const ROOM_CELL = CELL;
const GEOMETRY_CACHE = new WeakMap();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const DEFAULT_PLANS = Object.freeze({
  bloodworks: [
    { id: 'intake', center: [6, 9.15], size: [5.1, 3.25], style: 0, role: 'entry' },
    { id: 'sterile-wing', center: [3.35, 6.25], size: [3.4, 3.1], style: 1, role: 'flank' },
    { id: 'furnace', center: [8.75, 6.05], size: [3.5, 3.25], style: 2, role: 'flank' },
    { id: 'pulse-vault', center: [6, 2.55], size: [5.25, 2.9], style: 3, role: 'exit' },
  ],
  ossuary: [
    { id: 'bone-intake', center: [6, 9.2], size: [4.8, 3.1], style: 0, role: 'entry' },
    { id: 'east-catacomb', center: [8.9, 6.35], size: [3.45, 3.0], style: 1, role: 'flank' },
    { id: 'west-catacomb', center: [3.1, 6.15], size: [3.35, 3.0], style: 2, role: 'flank' },
    { id: 'load-bearing-vault', center: [6, 2.7], size: [5.0, 3.0], style: 3, role: 'exit' },
  ],
  choir: [
    { id: 'vestry', center: [6, 9.1], size: [4.8, 3.0], style: 0, role: 'entry' },
    { id: 'west-aisle', center: [3.15, 6.25], size: [3.45, 3.0], style: 1, role: 'flank' },
    { id: 'east-aisle', center: [8.85, 6.15], size: [3.45, 3.0], style: 2, role: 'flank' },
    { id: 'throat', center: [6, 2.65], size: [5.1, 3.0], style: 3, role: 'exit' },
  ],
});

function geometryLibrary(materials) {
  let lib = GEOMETRY_CACHE.get(materials);
  if (lib) return lib;
  const shared = geometry => { geometry.userData.sharedAsset = true; return geometry; };
  lib = {
    box: shared(new THREE.BoxGeometry(1, 1, 1)),
    tile: shared(new THREE.BoxGeometry(3.72, .065, 3.72)),
    pillar: shared(new THREE.CylinderGeometry(.34, .43, 5.7, 8)),
    pillarCap: shared(new THREE.CylinderGeometry(.48, .48, .13, 8)),
    pipe: shared(new THREE.CylinderGeometry(.075, .075, 1, 8)),
    rib: shared(new THREE.TorusGeometry(.8, .075, 8, 20)),
    portalRing: shared(new THREE.TorusGeometry(1.08, .055, 8, 24)),
    grate: shared(new THREE.BoxGeometry(1.05, .08, .22)),
    bell: shared(new THREE.TorusGeometry(.47, .12, 9, 22)),
    orb: shared(new THREE.SphereGeometry(.18, 12, 8)),
  };
  GEOMETRY_CACHE.set(materials, lib);
  return lib;
}

function mesh(parent, geometry, material, position, scale = [1, 1, 1], name = '', options = {}) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(position[0] || 0, position[1] || 0, position[2] || 0);
  object.scale.set(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1);
  object.name = name;
  object.castShadow = !!options.castShadow;
  object.receiveShadow = options.receiveShadow !== false;
  object.userData.roomStatic = options.static !== false;
  parent.add(object);
  return object;
}

function instance(parent, geometry, material, transforms, name, options = {}) {
  const result = new THREE.InstancedMesh(geometry, material, Math.max(1, transforms.length));
  result.name = name;
  result.castShadow = !!options.castShadow;
  result.receiveShadow = options.receiveShadow !== false;
  result.userData.roomStatic = options.static !== false;
  const matrix = new THREE.Matrix4();
  transforms.forEach((t, i) => {
    matrix.compose(new THREE.Vector3(t[0], t[1], t[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(t[3] || 0, t[4] || 0, t[5] || 0)), new THREE.Vector3(t[6] ?? 1, t[7] ?? 1, t[8] ?? 1));
    result.setMatrixAt(i, matrix);
  });
  result.instanceMatrix.needsUpdate = true;
  parent.add(result);
  return result;
}

function readRooms(course = {}) {
  const layout = course.layout || course.world || {};
  const candidates = course.rooms || course.roomPlan?.rooms || course.roomPlan || layout.rooms || layout.roomPlan?.rooms;
  if (Array.isArray(candidates) && candidates.length) return candidates;
  const id = String(course.sectorId || course.id || 'bloodworks').toLowerCase();
  return DEFAULT_PLANS[id] || DEFAULT_PLANS.bloodworks;
}

function normalizeRoom(raw, index) {
  const center = raw.center || raw.anchor || raw.position || [6, 6];
  const bounds = raw.bounds;
  let x = Number(center[0] ?? center.x ?? 6), z = Number(center[1] ?? center.y ?? center.z ?? 6);
  let width = Number(raw.size?.[0] ?? raw.dimensions?.[0] ?? raw.width ?? 4.5);
  let depth = Number(raw.size?.[1] ?? raw.dimensions?.[1] ?? raw.depth ?? 3);
  if (bounds && bounds.min && bounds.max) {
    x = (Number(bounds.min[0] ?? bounds.min.x) + Number(bounds.max[0] ?? bounds.max.x)) / 2;
    z = (Number(bounds.min[1] ?? bounds.min.y ?? bounds.min.z) + Number(bounds.max[1] ?? bounds.max.y ?? bounds.max.z)) / 2;
    width = Math.abs(Number(bounds.max[0] ?? bounds.max.x) - Number(bounds.min[0] ?? bounds.min.x));
    depth = Math.abs(Number(bounds.max[1] ?? bounds.max.y ?? bounds.max.z) - Number(bounds.min[1] ?? bounds.min.y ?? bounds.min.z));
  } else if (bounds && bounds.minX !== undefined && bounds.maxX !== undefined) {
    x = (Number(bounds.minX) + Number(bounds.maxX)) * .5;
    z = (Number(bounds.minZ) + Number(bounds.maxZ)) * .5;
    width = Math.abs(Number(bounds.maxX) - Number(bounds.minX));
    depth = Math.abs(Number(bounds.maxZ) - Number(bounds.minZ));
  }
  return {
    id: String(raw.id || raw.name || `room-${index + 1}`),
    center: [x, z], size: [clamp(width, 2.5, 12), clamp(depth, 2.2, 8)],
    style: Number(raw.style ?? raw.themeIndex ?? index) % 4,
    role: raw.role || (index === 0 ? 'entry' : index === 3 ? 'exit' : 'flank'),
    orientation: Number(raw.orientation || 0),
    portals: Array.isArray(raw.portals || raw.exits) ? [...(raw.portals || raw.exits)] : [],
  };
}

function addPortalAt(room, lib, palette, axis, side, localOffset, moving, label = '', openingWidth = 3.2, portalId = '', initialOpen = undefined) {
  const [width, depth] = room.size.map(v => v * ROOM_CELL);
  const z = axis === 'z' ? side * depth * .5 : localOffset;
  const x = axis === 'x' ? side * width * .5 : localOffset;
  const portal = new THREE.Group();
  const edgeName = axis === 'z' ? (side < 0 ? 'North' : 'South') : (side < 0 ? 'West' : 'East');
  portal.name = `${room.id}_${edgeName}Portal${label ? '_' + label : ''}`;
  portal.position.set(x, 0, z);
  if (axis === 'x') portal.rotation.y = Math.PI / 2;
  const halfOpening = clamp(openingWidth * .5, 1.25, Math.max(1.25, (axis === 'z' ? width : depth) * .5 - .18));
  portal.userData.noBatch = true;
  portal.userData.roomGate = true;
  portal.userData.portalId = portalId;
  // One instanced frame draw replaces separate jamb/crown meshes. The root is
  // still a dynamic portal boundary, but its static frame remains cheap to
  // render when several room portals are visible at once.
  instance(portal, lib.box, palette.metal, [
    [-halfOpening, 2.72, 0, 0, 0, 0, .32, 5.55, .36],
    [halfOpening, 2.72, 0, 0, 0, 0, .32, 5.55, .36],
    [0, 5.5, 0, 0, 0, 0, halfOpening * 2 + .65, .35, .42],
  ], `${portal.name}_Frame`, { castShadow: true });
  const ring = mesh(portal, lib.portalRing, palette.signal, [0, 2.65, -.04], [1.36, 1.36, 1.36], `${portal.name}_SignalRing`);
  ring.rotation.x = Math.PI / 2;
  const gate = new THREE.Group();
  gate.name = `${portal.name}_Gate`; gate.position.z = -.08; gate.userData.noBatch = true; gate.userData.roomGate = true;
  const gateCore = mesh(gate, lib.box, palette.shadow, [0, 2.65, .02], [halfOpening * 2 - .24, 4.5, .08], `${portal.name}_GateCore`, { castShadow: false });
  gateCore.material.side = THREE.DoubleSide;
  mesh(gate, lib.box, palette.signal, [0, 2.65, -.04], [halfOpening * 1.78, .055, .045], `${portal.name}_GateSignal`);
  portal.add(gate); room.group.add(portal);
  moving.push({ root: portal, ring, gate, portalId, open: initialOpen ?? !portalId, phase: (side + 1) * .7 + room.style * .33 + (axis === 'x' ? .19 : 0) });
  return portal;
}

function portalSpecs(room) {
  const specs = [];
  const [cx, cz] = room.center;
  const [halfW, halfD] = room.size.map(v => v * .5);
  const portals = Array.isArray(room.portals) ? room.portals : [];
  for (const portal of portals) {
    if (!portal || portal.kind === 'cross-court') continue;
    const span = portal.span || [];
    if (portal.axis === 'horizontal') {
      const side = Number(portal.at) >= cz ? 1 : -1;
      if (Math.abs(Number(portal.at) - (cz + side * halfD)) > .42) continue;
      const spanCenter = span.length >= 2 ? (Number(span[0]) + Number(span[1])) * .5 : cx;
      specs.push({ axis: 'z', side, offset: (spanCenter - cx) * ROOM_CELL, width: span.length >= 2 ? Math.abs(Number(span[1]) - Number(span[0])) * ROOM_CELL : 3.2, label: portal.kind || 'door', portalId: portal.id || '', initialOpen: portal.lockedBy !== 'room-clear' });
    } else if (portal.axis === 'vertical') {
      const side = Number(portal.at) >= cx ? 1 : -1;
      if (Math.abs(Number(portal.at) - (cx + side * halfW)) > .42) continue;
      const spanCenter = span.length >= 2 ? (Number(span[0]) + Number(span[1])) * .5 : cz;
      specs.push({ axis: 'x', side, offset: (spanCenter - cz) * ROOM_CELL, width: span.length >= 2 ? Math.abs(Number(span[1]) - Number(span[0])) * ROOM_CELL : 3.2, label: portal.kind || 'flank', portalId: portal.id || '', initialOpen: portal.lockedBy !== 'room-clear' });
    }
  }
  if (!specs.length) {
    specs.push({ axis: 'z', side: -1, offset: 0, width: 3.2, label: 'entry', portalId: '' });
    specs.push({ axis: 'z', side: 1, offset: 0, width: 3.2, label: 'exit', portalId: '' });
  }
  return specs;
}

function addRoomFeature(room, lib, palette, sector) {
  const [width, depth] = room.size.map(v => v * ROOM_CELL);
  const feature = new THREE.Group();
  feature.name = `${room.id}_FeatureBay`;
  const x = width * .5 - 1.1, z = depth * .1;
  if (sector === 'ossuary') {
    mesh(feature, lib.pillar, palette.bone, [x, 2.9, z], [1, 1, 1], `${room.id}_BoneSpine`, { castShadow: true });
    for (let i = 0; i < 4; i++) { const rib = mesh(feature, lib.rib, palette.bone, [x, 1.1 + i * .95, z - .05], [.95 - i * .08, .95 - i * .08, .95 - i * .08], `${room.id}_Rib_${i}`); rib.rotation.x = Math.PI / 2; }
    mesh(feature, lib.orb, palette.signal, [x, 4.9, z - .12], [1.5, 1.5, 1.5], `${room.id}_SoulLamp`);
  } else if (sector === 'choir') {
    const bell = mesh(feature, lib.bell, palette.trim, [x, 4.75, z], [1.45, 1.45, 1.45], `${room.id}_Bell`, { castShadow: true }); bell.rotation.x = Math.PI / 2;
    mesh(feature, lib.pipe, palette.metal, [x, 5.6, z], [.8, 2.4, .8], `${room.id}_BellCable`);
    mesh(feature, lib.orb, palette.signal, [x, 4.18, z - .1], [1.2, 1.2, 1.2], `${room.id}_BellCore`);
  } else {
    mesh(feature, lib.box, palette.metal, [x, 1.65, z], [1.75, 2.7, 1.35], `${room.id}_RecoveryCabinet`, { castShadow: true });
    for (let i = 0; i < 3; i++) mesh(feature, lib.pipe, palette.trim, [x - .47 + i * .47, 3.35, z - .66], [.85, 3.0 + i * .35, .85], `${room.id}_Pipe_${i}`);
    mesh(feature, lib.orb, palette.signal, [x, 1.75, z - .72], [1.25, .8, .42], `${room.id}_Indicator`);
  }
  room.group.add(feature);
}

function buildRoom(room, materials, course, lib, moving) {
  const sector = String(course.sectorId || course.id || 'bloodworks').toLowerCase();
  const palette = getRoomPalette(materials, course, room.style);
  const [width, depth] = room.size.map(v => v * ROOM_CELL);
  const group = new THREE.Group();
  const worldX = room.center[0] * ROOM_CELL, worldZ = room.center[1] * ROOM_CELL;
  group.name = `RoomChunk_${sector}_${room.id}`;
  group.position.set(worldX, 0, worldZ);
  group.rotation.y = room.orientation;
  group.userData.roomChunk = true;
  group.userData.roomId = room.id;
  group.userData.sectorId = sector;
  group.userData.streamRadius = Math.max(width, depth) * 1.7;
  group.userData.roomBatchBoundary = true;
  group.userData.preserveBatchBoundary = true;
  group.userData.roomBoundsCells = { min: [room.center[0] - room.size[0] * .5, room.center[1] - room.size[1] * .5], max: [room.center[0] + room.size[0] * .5, room.center[1] + room.size[1] * .5] };
  group.userData.staticBatchEligible = true;
  group.userData.noBatch = false;

  const floorTilesA = [], floorTilesB = [];
  const cols = Math.max(2, Math.floor(width / 3.8)), rows = Math.max(2, Math.floor(depth / 3.8));
  for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
    const px = (x - (cols - 1) * .5) * 3.76, pz = (z - (rows - 1) * .5) * 3.76;
    (x % 2 === z % 2 ? floorTilesA : floorTilesB).push([px, .03, pz, 0, 0, 0, 1, 1, 1]);
  }
  instance(group, lib.tile, palette.floor, floorTilesA, `${group.name}_FloorA`, { receiveShadow: true });
  instance(group, lib.tile, palette.floorInset, floorTilesB, `${group.name}_FloorInset`, { receiveShadow: true });

  const halfW = width * .5, halfD = depth * .5, wallH = 5.85, wallT = .34;
  const sideSegment = (z, x, segmentW) => {
    if (segmentW <= .2) return;
    mesh(group, lib.box, palette.wall, [x, wallH * .5, z], [segmentW, wallH, wallT], `${group.name}_Wall`, { receiveShadow: true });
    mesh(group, lib.box, palette.trim, [x, wallH - .18, z - Math.sign(z) * .02], [segmentW, .18, .48], `${group.name}_WallCrown`);
  };
  const addWallRuns = (total, gaps, at, horizontal = true) => {
    const sorted = gaps.slice().sort((a, b) => a[0] - b[0]);
    let cursor = -total * .5;
    for (const gap of sorted) {
      const lo = clamp(gap[0], -total * .5 + .12, total * .5 - .12);
      const hi = clamp(gap[1], lo + .2, total * .5 - .12);
      const length = lo - cursor;
      if (length > .2) {
        if (horizontal) sideSegment(at, cursor + length * .5, length);
        else mesh(group, lib.box, palette.wall, [at, wallH * .5, cursor + length * .5], [wallT, wallH, length], `${group.name}_SideWall`, { receiveShadow: true });
      }
      cursor = hi;
    }
    const tail = total * .5 - cursor;
    if (tail > .2) {
      if (horizontal) sideSegment(at, cursor + tail * .5, tail);
      else mesh(group, lib.box, palette.wall, [at, wallH * .5, cursor + tail * .5], [wallT, wallH, tail], `${group.name}_SideWall`, { receiveShadow: true });
    }
  };
  const specs = portalSpecs(room);
  for (const side of [-1, 1]) {
    const gaps = specs.filter(spec => spec.axis === 'z' && spec.side === side).map(spec => [spec.offset - spec.width * .5, spec.offset + spec.width * .5]);
    addWallRuns(width, gaps, side * halfD, true);
    if (gaps.length) for (const gap of gaps) {
      const mid = (gap[0] + gap[1]) * .5;
      mesh(group, lib.box, palette.trim, [mid, wallH - .18, side * halfD - side * .02], [gap[1] - gap[0], .18, .48], `${group.name}_DoorCrown`);
    }
  }
  for (const side of [-1, 1]) {
    const gaps = specs.filter(spec => spec.axis === 'x' && spec.side === side).map(spec => [spec.offset - spec.width * .5, spec.offset + spec.width * .5]);
    addWallRuns(depth, gaps, side * halfW, false);
    if (gaps.length) for (const gap of gaps) {
      const mid = (gap[0] + gap[1]) * .5;
      mesh(group, lib.box, palette.trim, [side * halfW - side * .02, wallH - .18, mid], [.48, .18, gap[1] - gap[0]], `${group.name}_DoorCrown`);
    }
  }

  // Shallow relief panels keep a long wall readable at play distance. They are
  // one instanced draw per material and skip the carved door spans, so their
  // silhouette still agrees with the progression barrier geometry.
  const relief = [], reliefTrim = [], reliefSignals = [];
  const panelWidth = Math.min(3.05, Math.max(1.8, width * .18)), panelHeight = 1.12;
  const hitsGap = (center, half, gaps) => gaps.some(gap => center + half > gap[0] && center - half < gap[1]);
  const addPanel = (axis, side, along, gaps) => {
    const panelHalf = panelWidth * .5;
    if (hitsGap(along, panelHalf, gaps)) return;
    const yRows = [1.02, 2.58, 4.14];
    for (const y of yRows) {
      const normalOffset = axis === 'z' ? side * halfD - side * .215 : side * halfW - side * .215;
      const position = axis === 'z' ? [along, y, normalOffset] : [normalOffset, y, along];
      const rotationY = axis === 'z' ? 0 : Math.PI / 2;
      relief.push([...position, 0, rotationY, 0, panelWidth, panelHeight, .085]);
      reliefTrim.push([...position.map((value, index) => index === 1 ? value - panelHeight * .5 : value), 0, rotationY, 0, panelWidth + .16, .055, .12]);
      reliefTrim.push([...position.map((value, index) => index === 1 ? value + panelHeight * .5 : value), 0, rotationY, 0, panelWidth + .16, .055, .12]);
      if (y === 2.58) reliefSignals.push([...position.map((value, index) => index === 1 ? value : value), 0, rotationY, 0, panelWidth * .62, .045, .035]);
    }
  };
  for (const side of [-1, 1]) {
    const gaps = specs.filter(spec => spec.axis === 'z' && spec.side === side).map(spec => [spec.offset - spec.width * .5, spec.offset + spec.width * .5]);
    for (let along = -halfW + panelWidth * .65; along <= halfW - panelWidth * .65; along += panelWidth + .7) addPanel('z', side, along, gaps);
  }
  for (const side of [-1, 1]) {
    const gaps = specs.filter(spec => spec.axis === 'x' && spec.side === side).map(spec => [spec.offset - spec.width * .5, spec.offset + spec.width * .5]);
    for (let along = -halfD + panelWidth * .65; along <= halfD - panelWidth * .65; along += panelWidth + .7) addPanel('x', side, along, gaps);
  }
  instance(group, lib.box, palette.panel, relief, `${group.name}_ReliefPanels`, { receiveShadow: true });
  instance(group, lib.box, palette.trim, reliefTrim, `${group.name}_ReliefTrim`, { receiveShadow: false });
  instance(group, lib.box, palette.signal, reliefSignals, `${group.name}_ReliefSignals`, { receiveShadow: false });
  const floorRelief = [];
  for (let along = -halfW + 1.8; along <= halfW - 1.8; along += 3.6) {
    floorRelief.push([along, .12, 0, 0, 0, 0, .92, .035, .06]);
    floorRelief.push([along, .121, -1.05, 0, 0, 0, .46, .035, .045]);
    floorRelief.push([along, .121, 1.05, 0, 0, 0, .46, .035, .045]);
  }
  instance(group, lib.box, palette.trim, floorRelief, `${group.name}_FloorRelief`, { receiveShadow: false });

  const coffer = [];
  for (let x = -halfW + 2; x <= halfW - 2; x += 3.5) coffer.push([x, 6.15, 0, 0, 0, 0, .16, .22, depth]);
  instance(group, lib.box, palette.metal, coffer, `${group.name}_CeilingCoffers`, { receiveShadow: false });
  const border = [];
  for (let x = -halfW + 1; x <= halfW - 1; x += 2.8) border.push([x, .105, -halfD + .66, 0, 0, 0, 1.55, 1, .16], [x, .107, halfD - .66, 0, 0, 0, 1.55, 1, .16]);
  instance(group, lib.grate, palette.hazard, border, `${group.name}_HazardBorder`, { receiveShadow: false });

  for (const x of [-halfW + .45, halfW - .45]) {
    for (const z of [-halfD + .45, halfD - .45]) {
      mesh(group, lib.pillar, palette.metal, [x, 2.85, z], [1, 1, 1], `${group.name}_CornerPillar`, { castShadow: true });
      mesh(group, lib.pillarCap, palette.trim, [x, 5.72, z], [1.2, 1, 1.2], `${group.name}_PillarCap`);
    }
  }
  for (const spec of specs) addPortalAt({ ...room, group }, lib, palette, spec.axis, spec.side, spec.offset, moving, spec.label, spec.width, spec.portalId, spec.initialOpen);
  addRoomFeature({ ...room, group }, lib, palette, sector);

  const min = new THREE.Vector3(worldX - halfW, 0, worldZ - halfD);
  const max = new THREE.Vector3(worldX + halfW, 6.35, worldZ + halfD);
  group.userData.roomBounds = new THREE.Box3(min, max);
  group.userData.roomBoundsArray = { min: min.toArray(), max: max.toArray() };
  return group;
}

function addRouteLink(root, from, to, materials, course, index, lib) {
  const declared = Array.isArray(from.portals) && from.portals.length;
  if (!declared) return null;
  const routePortal = declared ? from.portals.find(portal => portal && portal.kind !== 'flank' && portal.kind !== 'cross-court' && (!portal.to || portal.to === to.id)) : null;
  if (declared && !routePortal) return null;
  const direction = Math.sign(to.center[1] - from.center[1]) || 1;
  const incomingPortal = Array.isArray(to.portals) ? to.portals.find(portal => portal && portal.kind !== 'flank' && portal.kind !== 'cross-court' && (!portal.from || portal.from === from.id)) : null;
  const spanCenter = portal => portal?.span?.length >= 2 ? (Number(portal.span[0]) + Number(portal.span[1])) * .5 : null;
  const fromX = spanCenter(routePortal) ?? from.center[0];
  const toX = spanCenter(incomingPortal) ?? to.center[0];
  const start = { x: fromX, z: from.center[1] + direction * from.size[1] * .5 };
  const end = { x: toX, z: to.center[1] - direction * to.size[1] * .5 };
  const dx = (end.x - start.x) * ROOM_CELL;
  const dz = (end.z - start.z) * ROOM_CELL;
  const length = Math.hypot(dx, dz);
  if (length < 2) return null;
  const midX = (start.x + end.x) * ROOM_CELL * .5;
  const midZ = (start.z + end.z) * ROOM_CELL * .5;
  const group = new THREE.Group(); group.name = `RoomRouteLink_${index}`; group.position.set(midX, 0, midZ); group.userData.roomRouteLink = true; group.userData.sectorId = course.sectorId || course.id || 'bloodworks';
  const palette = getRoomPalette(materials, course, (from.style + to.style + index) % 4);
  const angle = Math.atan2(dx, dz);
  const linkGeo = lib?.box || new THREE.BoxGeometry(1, 1, 1); linkGeo.userData.sharedAsset = true;
  const deck = mesh(group, linkGeo, palette.shadow, [0, .015, 0], [3.25, .055, length], `RoomRouteLink_${index}_Deck`, { receiveShadow: true });
  deck.rotation.y = angle;
  const railA = mesh(group, linkGeo, palette.trim, [-1.72, .38, 0], [.11, .7, length], `RoomRouteLink_${index}_RailA`); railA.rotation.y = angle;
  const railB = mesh(group, linkGeo, palette.trim, [1.72, .38, 0], [.11, .7, length], `RoomRouteLink_${index}_RailB`); railB.rotation.y = angle;
  root.add(group);
  return group;
}

export function buildRoomKit(root, materials, course = {}) {
  if (!root || !materials) return { rooms: [], roomChunks: [], moving: [], animate: () => {} };
  const rawRooms = readRooms(course).map(normalizeRoom);
  // Progression usually authors the outgoing threshold on the source room.
  // Mirror that opening onto the destination boundary so the visible shell has
  // a real doorway on both sides of the same transition.
  for (let i = 1; i < rawRooms.length; i++) {
    const from = rawRooms[i - 1], to = rawRooms[i];
    const outgoing = from.portals.filter(portal => portal && portal.kind !== 'flank' && portal.kind !== 'cross-court' && (!portal.to || portal.to === to.id));
    if (!outgoing.length) continue;
    const direction = Math.sign(from.center[1] - to.center[1]) || 1;
    const targetBoundary = to.center[1] + direction * to.size[1] * .5;
    for (const portal of outgoing) {
      const mirrorId = portal.id || `${from.id}-to-${to.id}-${portal.span?.join('-') || 'door'}`;
      const alreadyMirrored = to.portals.some(candidate => candidate && candidate.from === from.id && candidate.id === mirrorId && candidate.kind !== 'flank');
      if (alreadyMirrored) continue;
      to.portals.push({ id: mirrorId, kind: portal.kind || 'door', axis: 'horizontal', at: targetBoundary, span: portal.span, from: from.id, to: to.id, lockedBy: portal.lockedBy, barrierId: portal.barrierId, mirrored: true });
    }
  }
  const lib = geometryLibrary(materials);
  const rooms = [], moving = [];
  for (const room of rawRooms) {
    const chunk = buildRoom(room, materials, course, lib, moving);
    root.add(chunk);
    rooms.push(chunk);
  }
  // The primary route remains short, while flank rooms create the Doom-style
  // choice of advancing through the spine or clearing a side pocket first.
  const ordered = rawRooms.slice();
  for (let i = 0; i < ordered.length - 1; i++) addRouteLink(root, ordered[i], ordered[i + 1], materials, course, i, lib);
  for (const item of moving) item.root.userData.roomChunkMoving = true;
  const setProgression = progression => {
    for (const item of moving) {
      item.open = item.portalId ? progression?.gates?.[item.portalId]?.open === true : true;
      item.root.userData.portalOpen = item.open;
    }
  };
  const animate = time => {
    for (const item of moving) {
      item.ring.rotation.z = time * .8 + item.phase;
      const pulse = 1 + Math.sin(time * 2.2 + item.phase) * .035;
      item.ring.scale.setScalar(pulse);
      const target = item.open ? 0.035 : 1;
      item.gate.scale.y += (target - item.gate.scale.y) * .12;
      item.gate.position.z = -.08 + Math.sin(time * 1.4 + item.phase) * .025;
    }
  };
  return { rooms, roomChunks: rooms, moving, animate, setProgression, plan: rawRooms, route: ordered.map(room => room.id) };
}

export { DEFAULT_PLANS };
