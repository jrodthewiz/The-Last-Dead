import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { dungeonSurfaceProfile, applyAfterlifeSurfaces } from '../afterlife-surfaces.js';
import { routeGuidancePoints } from '../dungeon-wayfinding.js';
import { directDungeonLandmarks } from '../dungeon-landmarks.js';

test('floor surface identities remain distinct through the final material pass', () => {
  const foundry = dungeonSurfaceProfile('f1-intake-foundry');
  const ward = dungeonSurfaceProfile('f2-graft-galleries');
  assert.notEqual(foundry.roomWall.color, ward.roomWall.color);
  assert.notEqual(foundry.roomWall.color, foundry.roomPanel.color);
  assert.equal(dungeonSurfaceProfile('campaign'), null);
});

test('portal structure follows the floor palette while its signal keeps its cue', () => {
  const world = new THREE.Group(); world.userData.dungeonArtIdentity = 'f2-graft-galleries';
  const gate = new THREE.Group(); gate.name = 'WardPortal_Gate'; world.add(gate);
  const arch = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  arch.name = 'PortalArch'; arch.userData.afterlifeSurfaceRole = 'roomWall'; gate.add(arch);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0xff6633, emissive: 0xff6633, emissiveIntensity: 2 }));
  lens.userData.afterlifeSurfaceRole = 'roomSignal'; gate.add(lens);
  applyAfterlifeSurfaces(world, { moisture: false });
  assert.equal(arch.material.color.getHex(), dungeonSurfaceProfile('f2-graft-galleries').roomWall.color);
  assert.ok(lens.material.color.r > lens.material.color.g);
});

test('steel tunnel crown and jamb retain the same material role', () => {
  const world = new THREE.Group(); world.userData.dungeonArtIdentity = 'f1-intake-foundry';
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff }); material.name = 'TunnelFrame_f1-intake-foundry';
  const crown = new THREE.Mesh(new THREE.BoxGeometry(), material); crown.name = 'TunnelRib_entry_0';
  const jamb = new THREE.Mesh(new THREE.BoxGeometry(), material); world.add(crown, jamb);
  applyAfterlifeSurfaces(world, { moisture: false });
  assert.equal(crown.material, jamb.material);
  assert.equal(crown.material.userData.afterlifeRole, 'roomTrim');
});

test('guidance follows a turning open-grid path and disappears when blocked', () => {
  const navigation = { waypoint: { x: 2, y: 1 }, path: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }] };
  const points = routeGuidancePoints(navigation, { x: 1, y: 1 });
  assert.deepEqual(points.map(p => [p.x, p.z]), [[8, 4], [8, 8]]);
  assert.equal(points[0].yaw, 0);
  assert.deepEqual(routeGuidancePoints({ ...navigation, blocked: true }, { x: 1, y: 1 }), []);
});

test('landmark practical and moving face change after clearing its owning room', () => {
  const world = new THREE.Group(), rig = new THREE.Group(); rig.name = 'StoryLandmark_pump'; world.add(rig);
  const source = new THREE.MeshStandardMaterial();
  const face = new THREE.Mesh(new THREE.BoxGeometry(), source); face.name = 'CrucibleEmberCore'; face.userData.noBatch = true; rig.add(face);
  const directed = directDungeonLandmarks(world, { dungeon: true, landmarks: [{ id: 'pump', roomId: 'ward' }] });
  directed.update({ dungeonProgression: { currentEncounterRoomId: 'ward', roomsCompleted: [] } });
  const light = rig.getObjectByName('LandmarkPractical_pump');
  assert.equal(light.userData.landmarkState, 'pressure');
  const activeColor = face.material.color.getHex();
  directed.update({ dungeonProgression: { roomsCompleted: ['ward'] } });
  assert.equal(light.userData.landmarkState, 'restored');
  assert.notEqual(face.material.color.getHex(), activeColor);
  assert.notEqual(face.material, source);
  assert.equal(directed.diagnostics.addedDraws, 0);
});
