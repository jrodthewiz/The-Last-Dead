import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { buildRoomKit } from '../room-kit.js';

const materials = {
  wall: new THREE.MeshStandardMaterial(),
  wallPanel: new THREE.MeshStandardMaterial(),
  metal: new THREE.MeshStandardMaterial(),
  floor: new THREE.MeshStandardMaterial(),
  black: new THREE.MeshStandardMaterial(),
  hazard: new THREE.MeshStandardMaterial(),
  metalDark: new THREE.MeshStandardMaterial(),
  steel: new THREE.MeshStandardMaterial(),
  red: new THREE.MeshStandardMaterial(),
  violet: new THREE.MeshStandardMaterial(),
  orange: new THREE.MeshStandardMaterial(),
};

const root = new THREE.Group();
const fallback = buildRoomKit(root, materials, { sectorId: 'bloodworks' });
assert.equal(fallback.rooms.length, 4, 'fallback graph keeps the four room beats');
assert.equal(fallback.route.length, 4, 'route has one ordered spine');
assert.equal(fallback.moving.length, 8, 'fallback exposes two animated portals per room');
for (const room of fallback.rooms) {
  assert.match(room.name, /^RoomChunk_bloodworks_/);
  assert.equal(room.userData.staticBatchEligible, true);
  assert.equal(room.userData.noBatch, false);
  assert.ok(room.userData.roomBounds instanceof THREE.Box3);
  assert.ok(room.userData.roomBounds.min.x < room.userData.roomBounds.max.x);
  assert.ok(room.userData.roomBounds.min.z < room.userData.roomBounds.max.z);
}
assert.ok(fallback.moving.every(item => item.root.userData.noBatch && item.root.userData.roomGate));

const contractRoot = new THREE.Group();
const contract = buildRoomKit(contractRoot, materials, {
  sectorId: 'ossuary',
  rooms: [{
    id: 'band-a', role: 'crossfire',
    bounds: { minX: 1, minZ: 8, maxX: 11, maxZ: 11 },
    portals: [
      { kind: 'door', axis: 'horizontal', at: 8, span: [5.1, 6.9] },
      { kind: 'flank', axis: 'vertical', at: 1, span: [9.2, 10.4] },
    ],
  }],
});
assert.equal(contract.rooms.length, 1, 'progression bounds override fallback rooms');
assert.equal(contract.rooms[0].userData.roomBoundsCells.min[0], 1);
assert.equal(contract.rooms[0].userData.roomBoundsCells.max[1], 11);
assert.equal(contract.moving.length, 2, 'provided door/flank boundaries produce matching portal roots');
const portalNames = contract.moving.map(item => item.root.name).join(' ');
assert.match(portalNames, /NorthPortal/);
assert.match(portalNames, /WestPortal/);

const pairedRoot = new THREE.Group();
const paired = buildRoomKit(pairedRoot, materials, {
  sectorId: 'choir',
  rooms: [
    { id: 'band-a', bounds: { minX: 1, minZ: 8, maxX: 11, maxZ: 11 }, portals: [
      { id: 'a-to-b-0', kind: 'door', axis: 'horizontal', at: 8, span: [1.55, 2.65], to: 'band-b' },
      { id: 'a-to-b-1', kind: 'door', axis: 'horizontal', at: 8, span: [9.35, 10.45], to: 'band-b' },
    ] },
    { id: 'band-b', bounds: { minX: 1, minZ: 4, maxX: 11, maxZ: 7 }, portals: [{ id: 'b-to-exit', kind: 'door', axis: 'horizontal', at: 4, span: [5.1, 6.9], to: 'sector-exit' }] },
  ],
});
assert.equal(paired.rooms.length, 2, 'disjoint combat bands stay separate room chunks');
assert.equal(paired.moving.length, 5, 'all source door spans are mirrored on the destination wall');
assert.equal(pairedRoot.children.filter(child => child.userData.roomRouteLink).length, 1, 'only declared room transitions receive a route link');
paired.setProgression({ gates: { 'a-to-b-0': { open: true }, 'a-to-b-1': { open: true }, 'b-to-exit': { open: false } } });
assert.equal(paired.moving.filter(item => item.portalId.startsWith('a-to-b-')).every(item => item.open), true);
assert.equal(paired.moving.find(item => item.portalId === 'b-to-exit').open, false);

console.log(JSON.stringify({
  fallbackRooms: fallback.rooms.length,
  fallbackMovingPortals: fallback.moving.length,
  contractRooms: contract.rooms.length,
  contractPortals: contract.moving.length,
  pairedRooms: paired.rooms.length,
  pairedRouteLinks: pairedRoot.children.filter(child => child.userData.roomRouteLink).length,
  meshes: (() => { let n = 0; contractRoot.traverse(o => { if (o.isMesh) n++; }); return n; })(),
}));
