import * as THREE from './vendor/three.module.js';

// Story architecture is compiled from the same rooms and surviving wall panels
// as collision. All pieces are wall-mounted, overhead, or flush with the floor;
// the route remains owned by dungeon-compiler, including live door changes.
const CELL = 4;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PIPE = new THREE.CylinderGeometry(.5, .5, 1, 8);
BOX.userData.sharedAsset = true;
PIPE.userData.sharedAsset = true;

const roomStyle = (floorId, room) => {
  if (room.kind === 'secret' || room.kind === 'exit') return null;
  if (floorId === 'f1-intake-foundry') return 'foundry';
  if (floorId === 'f2-graft-galleries') return 'surgical';
  if (floorId === 'f3-catacombs') return 'crypt';
  if (floorId === 'f4-resonance') return 'choir';
  // The final floor already has a bespoke route-scale rib sequence.
  return null;
};

const belongsToRoom = (room, x, z) => {
  const { minX, minZ, maxX, maxZ } = room.bounds;
  if (x < minX || x >= maxX || z < minZ || z >= maxZ) return false;
  return room.footprint?.[z - minZ]?.[x - minX] === '1';
};

export function planDungeonPlaceKit(course) {
  if (!course?.dungeon) return { walls: [], beams: [], ceilings: [], rooms: [] };
  const walls = [], beams = [], ceilings = [], rooms = [];
  const cover = new Set((course.blocks || []).map(([x, z]) => `${x},${z}`));
  for (const key of course.dungeonCompiled?.reach || []) {
    if (cover.has(key)) continue;
    const [x, z] = key.split(',').map(Number);
    if (course.rooms?.some(room => room.kind === 'arena' && belongsToRoom(room, x, z))) continue;
    ceilings.push({ x, z });
  }
  for (const room of course.rooms || []) {
    const style = roomStyle(course.id, room);
    if (!style) continue;
    const { minX, minZ, maxX, maxZ } = room.bounds;
    const candidates = (course.walls || []).filter(wall => belongsToRoom(room, wall.cx, wall.cy));
    // A few intact panels per room read as built infrastructure. Avoid door
    // jambs, corner cuts and an uninterrupted wall of repeated details.
    const chosen = candidates.filter(wall => ((wall.cx * 7 + wall.cy * 11 + wall.direction * 3) % 5) < 2)
      .slice(0, room.kind === 'hub' || room.kind === 'arena' ? 10 : 5);
    for (const wall of chosen) walls.push({ roomId: room.id, style, ...wall });
    if (room.kind === 'hub' || room.kind === 'arena' || room.kind === 'hall' || room.kind === 'loop') {
      const longX = maxX - minX >= maxZ - minZ;
      const span = longX ? maxX - minX : maxZ - minZ;
      const count = Math.max(1, Math.floor(span / 3));
      for (let i = 1; i <= count; i++) {
        const at = (longX ? minX : minZ) + span * i / (count + 1);
        beams.push({ roomId: room.id, style, longX, at,
          x0: minX + .45, x1: maxX - .45, z0: minZ + .45, z1: maxZ - .45 });
      }
    }
    rooms.push({ id: room.id, style, wallCount: chosen.length });
  }
  return { walls, beams, ceilings, rooms };
}

function palette(materials, art) {
  const make = (name, color, emissive = 0) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: .66, metalness: .34,
      emissive, emissiveIntensity: emissive ? .8 : 0 });
    material.name = `DungeonPlace_${name}_${art?.id || 'story'}`;
    return material;
  };
  const roofColors = {
    'f1-intake-foundry': 0x282320,
    'f2-graft-galleries': 0x303b38,
    'f3-catacombs': 0x29272e,
    'f4-resonance': 0x2e261f,
    'f5-last-descent': 0x221c20,
  };
  const ceiling = new THREE.MeshStandardMaterial({
    color: roofColors[art?.id] || 0x282729, roughness: 1, metalness: 0,
  });
  ceiling.name = `DungeonPlace_ceiling_${art?.id || 'story'}`;
  return {
    frame: materials.metalDark || make('frame', 0x35363a),
    trim: materials.floorTrim || materials.rust || make('trim', 0x826c5f),
    recess: materials.wallDeep || materials.black || make('recess', 0x15191c),
    pale: make('pale', art?.wallSurface || 0xa2a69e),
    signal: make('signal', art?.accent2 || 0xcf8050, art?.accent2 || 0xcf8050),
    glass: make('observation-glass', 0x354b48),
    bone: make('burial-stone', art?.panelSurface || 0x8c8378),
    ceiling,
  };
}

function addInstanced(group, name, geometry, material, entries) {
  if (!entries.length) return;
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    position.set(e.x, e.y, e.z);
    quaternion.setFromAxisAngle(up, e.ry || 0);
    scale.set(e.sx, e.sy, e.sz);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = `DungeonPlace_${name}`;
  mesh.userData.noBatch = true;
  mesh.computeBoundingSphere?.();
  group.add(mesh);
}

export function buildDungeonPlaceKit(root, materials, course) {
  const group = new THREE.Group();
  group.name = 'DungeonPlaceKit';
  if (!course?.dungeon) return group;
  const plan = planDungeonPlaceKit(course);
  const layers = Object.fromEntries(['frame', 'trim', 'recess', 'pale', 'signal', 'glass', 'bone', 'ceiling']
    .map(key => [key, { box: [], pipe: [] }]));
  const put = (layer, shape, x, y, z, sx, sy, sz, ry = 0) =>
    layers[layer][shape].push({ x, y, z, sx, sy, sz, ry });
  const wallBox = (wall, layer, x, y, depth, width, height, thickness) => {
    const yaw = [0, -Math.PI / 2, Math.PI, Math.PI / 2][wall.direction];
    const cx = wall.x * CELL, cz = wall.z * CELL;
    put(layer, 'box', cx + Math.sin(yaw) * depth + Math.cos(yaw) * x,
      y, cz + Math.cos(yaw) * depth - Math.sin(yaw) * x,
      width, height, thickness, yaw);
  };
  const wallPipe = (wall, layer, x, y, depth, radius, height) => {
    const yaw = [0, -Math.PI / 2, Math.PI, Math.PI / 2][wall.direction];
    const cx = wall.x * CELL, cz = wall.z * CELL;
    put(layer, 'pipe', cx + Math.sin(yaw) * depth + Math.cos(yaw) * x,
      y, cz + Math.cos(yaw) * depth - Math.sin(yaw) * x,
      radius * 2, height, radius * 2);
  };

  for (const wall of plan.walls) {
    if (wall.style === 'foundry') {
      wallBox(wall, 'recess', 0, 2.75, .17, 2.7, 4.4, .12);
      wallBox(wall, 'frame', 0, 5.05, .33, 3.05, .24, .24);
      for (const x of [-.75, .75]) {
        wallPipe(wall, 'trim', x, 2.85, .42, .12, 3.75);
        wallBox(wall, 'frame', x, 1.1, .5, .4, .28, .35);
      }
      wallBox(wall, 'signal', 0, 3.9, .42, .65, .12, .1);
    } else if (wall.style === 'surgical') {
      wallBox(wall, 'pale', 0, 2.6, .18, 3.05, 3.5, .12);
      wallBox(wall, 'recess', 0, 3.22, .27, 2.65, 1.5, .12);
      wallBox(wall, 'glass', 0, 3.22, .35, 2.3, 1.15, .07);
      wallBox(wall, 'trim', 0, 2.61, .43, 2.8, .12, .12);
      wallBox(wall, 'signal', 0, 4.48, .34, 1.0, .09, .1);
    } else if (wall.style === 'crypt') {
      wallBox(wall, 'bone', 0, 2.85, .15, 3.0, 4.65, .16);
      wallBox(wall, 'recess', 0, 2.75, .28, 2.35, 3.7, .12);
      for (const y of [1.65, 2.8, 3.95]) {
        wallBox(wall, 'bone', 0, y, .39, 2.45, .13, .32);
        wallBox(wall, 'trim', 0, y - .33, .4, 1.58, .12, .2);
      }
      wallBox(wall, 'bone', 0, 5.1, .34, 3.2, .25, .34);
    } else if (wall.style === 'choir') {
      wallBox(wall, 'recess', 0, 2.9, .17, 2.7, 4.4, .11);
      for (let i = 0; i < 5; i++) {
        const height = 2.0 + (2 - Math.abs(i - 2)) * .54;
        wallPipe(wall, i === 2 ? 'signal' : 'trim', (i - 2) * .48,
          1.15 + height / 2, .39, .15, height);
      }
      wallBox(wall, 'bone', 0, 1.16, .49, 3.05, .25, .35);
    }
  }

  for (const beam of plan.beams) {
    const x = (beam.x0 + beam.x1) * CELL / 2;
    const z = (beam.z0 + beam.z1) * CELL / 2;
    const along = beam.at * CELL;
    const bx = beam.longX ? along : x;
    const bz = beam.longX ? z : along;
    const width = beam.longX ? (beam.z1 - beam.z0) * CELL : (beam.x1 - beam.x0) * CELL;
    const yaw = beam.longX ? Math.PI / 2 : 0;
    const layer = beam.style === 'crypt' ? 'bone' : beam.style === 'surgical' ? 'pale' : 'frame';
    put(layer, 'box', bx, 5.75, bz, width, .42, .42, yaw);
    put('trim', 'box', bx, 5.45, bz, width - .2, .1, .18, yaw);
    if (beam.style === 'surgical') put('signal', 'box', bx, 5.36, bz, Math.min(3.6, width - .4), .06, .11, yaw);
  }
  for (const cell of plan.ceilings) {
    put('ceiling', 'box', (cell.x + .5) * CELL, 6.47, (cell.z + .5) * CELL,
      3.96, .12, 3.96);
  }
  const mats = palette(materials, course.artDirection);
  for (const [key, shapes] of Object.entries(layers)) {
    if (!shapes.box.length && !shapes.pipe.length) {
      if (!Object.values(materials).includes(mats[key])) mats[key].dispose();
      continue;
    }
    addInstanced(group, `${key}_box`, BOX, mats[key], shapes.box);
    addInstanced(group, `${key}_pipe`, PIPE, mats[key], shapes.pipe);
  }
  group.userData.plan = plan;
  group.userData.wallPanels = plan.walls.length;
  group.userData.overheadBeams = plan.beams.length;
  group.userData.ceilingCells = plan.ceilings.length;
  root.add(group);
  return group;
}
