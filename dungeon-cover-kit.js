import * as THREE from './vendor/three.module.js';

const CELL = 4;
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_PIPE = new THREE.CylinderGeometry(.5, .5, 1, 8);
UNIT_BOX.userData.sharedAsset = true;
UNIT_PIPE.userData.sharedAsset = true;

function material(name, color, metalness = .15) {
  const value = new THREE.MeshStandardMaterial({ color, roughness: .82, metalness });
  value.name = `StoryCover_${name}`;
  return value;
}

function palette(course, materials) {
  const floor = course.id;
  if (floor === 'f1-intake-foundry') return {
    body: materials.metalDark, face: material('foundry-crate', 0x65554b, .38), trim: materials.rust,
  };
  if (floor === 'f2-graft-galleries') return {
    body: material('ward-cabinet', 0x72817d, .24), face: material('ward-drawer', 0x9ba9a0, .18), trim: materials.steel,
  };
  if (floor === 'f3-catacombs') return {
    body: material('crypt-stone', 0x65616a), face: material('crypt-bone', 0xa79d8a), trim: materials.metalDark,
  };
  if (floor === 'f4-resonance') return {
    body: material('choir-timber', 0x58483d), face: material('choir-brass', 0x917251, .44), trim: materials.rust,
  };
  return {
    body: material('throat-basalt', 0x45363b), face: material('throat-bone', 0x8b7971), trim: materials.rust,
  };
}

function meshInstances(name, geometry, mat, entries) {
  if (!entries.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, mat, entries.length);
  const matrix = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  entries.forEach((entry, index) => {
    p.set(entry.x, entry.y, entry.z);
    q.setFromAxisAngle(up, entry.yaw || 0);
    s.set(entry.w, entry.h, entry.d);
    matrix.compose(p, q, s);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = `StoryCover_${name}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.noBatch = true;
  mesh.computeBoundingSphere?.();
  return mesh;
}

export function buildDungeonCover(root, materials, course) {
  const group = new THREE.Group();
  group.name = 'DungeonCoverKit';
  if (!course?.dungeon) return group;
  const entries = { body: [], face: [], trim: [], pipes: [] };
  const put = (layer, x, y, z, w, h, d, yaw = 0) => entries[layer].push({ x, y, z, w, h, d, yaw });
  const variant = (x, z) => (x * 13 + z * 7) % 3;
  for (const [cx, cz] of course.blocks || []) {
    const x = (cx + .5) * CELL, z = (cz + .5) * CELL;
    const turn = variant(cx, cz) % 2 ? Math.PI / 2 : 0;
    const v = variant(cx, cz);
    const offset = (dx, dz) => ({
      x: x + Math.cos(turn) * dx + Math.sin(turn) * dz,
      z: z - Math.sin(turn) * dx + Math.cos(turn) * dz,
    });
    const local = (layer, dx, y, dz, w, h, d) => {
      const p = offset(dx, dz);
      put(layer, p.x, y, p.z, w, h, d, turn);
    };
    if (course.id === 'f1-intake-foundry') {
      // Reclaimed shipping bins and boiler hoppers rather than glowing cover cubes.
      local('body', 0, 1.2, 0, 3.4, 2.4, 3.2);
      local('face', 0, 2.48, 0, 3.6, .23, 3.35);
      local('trim', 0, .46, -1.68, 3.25, .12, .12);
      for (const dx of [-1.4, 1.4]) {
        local('trim', dx, 1.2, -1.7, .12, 2.35, .13);
        if (v === 2) local('pipes', dx * .78, 3.12, .55, .17, 1.1, .17);
      }
    } else if (course.id === 'f2-graft-galleries') {
      // Drawer banks read as stored instruments and bodies, with a quiet pale face.
      local('body', 0, 1.38, 0, 3.35, 2.75, 3.0);
      local('face', 0, 1.43, -1.54, 3.12, 2.53, .12);
      for (const y of [.78, 1.43, 2.08]) {
        local('trim', 0, y, -1.64, 3.18, .065, .1);
        local('body', 0, y + .28, -1.67, .42, .055, .13);
      }
      local('trim', 0, 2.84, 0, 3.5, .15, 3.15);
    } else if (course.id === 'f3-catacombs') {
      // Mismatched sarcophagus courses form a load-bearing pile.
      local('body', 0, .58, 0, 3.4, 1.16, 3.25);
      local('face', -.28, 1.41, .15, 3.0, .48, 2.7);
      local('body', .2, 2.13, -.2, 3.1, .95, 3.05);
      local('face', .18, 2.69, -.2, 3.25, .18, 3.2);
      for (const dx of [-1.1, 1.1]) local('trim', dx, 1.98, -1.77, .16, .64, .13);
    } else if (course.id === 'f4-resonance') {
      // Broken choir stalls stack across the combat lanes like abandoned pews.
      local('body', 0, .45, 0, 3.4, .9, 3.0);
      local('face', 0, 1.66, 1.31, 3.25, 2.05, .22);
      local('trim', 0, 2.75, 1.31, 3.4, .15, .36);
      local('body', 0, 1.16, -1.17, 3.18, .22, .55);
      for (const dx of [-1.32, 1.32]) local('face', dx, 1.13, 0, .18, 1.68, 2.9);
    } else {
      // The last floor is crushed into dark rock and exposed rib edges.
      local('body', 0, 1.2, 0, 3.42, 2.4, 3.42);
      local('body', .16, 2.57, -.2, 3.05, .42, 3.0);
      for (const dx of [-1.18, 1.18]) {
        local('face', dx, 1.64, -1.77, .22, 2.6, .14);
        local('face', dx, 2.95, -.12, .2, .56, 2.8);
      }
    }
  }
  const mats = palette(course, materials);
  for (const layer of ['body', 'face', 'trim']) {
    const mesh = meshInstances(layer, UNIT_BOX, mats[layer], entries[layer]);
    if (mesh) group.add(mesh);
    else if (!Object.values(materials).includes(mats[layer])) mats[layer].dispose();
  }
  const pipes = meshInstances('pipes', UNIT_PIPE, mats.trim, entries.pipes);
  if (pipes) group.add(pipes);
  group.userData.blocks = course.blocks?.length || 0;
  group.userData.floorId = course.id;
  root.add(group);
  return group;
}
