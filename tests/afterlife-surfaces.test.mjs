import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { applyAfterlifeSurfaces } from '../afterlife-surfaces.js';

test('afterlife surfaces neutralize world roles while retaining readable gate cues', () => {
  const root = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3344,
    emissive: 0xff3344,
    emissiveIntensity: 2.4,
    roughness: .2,
    metalness: .9,
  });
  wallMaterial.userData.roomRole = 'roomWall';
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), wallMaterial);
  wall.name = 'Wall_Test';
  root.add(wall);

  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xf51d38, emissive: 0xf51d38, emissiveIntensity: 1.2 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2, .1, 2), floorMaterial);
  floor.name = 'FloorPanelSeams';
  root.add(floor);

  const seamGeometry = new THREE.BufferGeometry();
  seamGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
  const seamMaterial = new THREE.LineBasicMaterial({ color: 0xff2244, transparent: true, opacity: .47 });
  const seams = new THREE.LineSegments(seamGeometry, seamMaterial);
  seams.name = 'FloorPanelSeams';
  root.add(seams);

  const gate = new THREE.Group();
  gate.name = 'NorthPortal_Gate';
  gate.userData.roomGate = true;
  const signalMaterial = new THREE.MeshStandardMaterial({ color: 0xff2238, emissive: 0xff2238, emissiveIntensity: 2.2 });
  signalMaterial.userData.roomRole = 'roomSignal';
  const signal = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), signalMaterial);
  signal.name = 'NorthPortal_GateSignal';
  gate.add(signal);
  root.add(gate);

  const actor = new THREE.Group();
  actor.name = 'Enemy_Test';
  const actorMesh = new THREE.Mesh(new THREE.BoxGeometry(), wallMaterial);
  actor.add(actorMesh);
  root.add(actor);

  const light = new THREE.PointLight(0xff0000, 8);
  root.add(light);
  const geometry = wall.geometry;
  const diagnostics = applyAfterlifeSurfaces(root, { sector: 'bloodworks' });

  assert.equal(diagnostics.applied, true);
  assert.equal(diagnostics.changedMeshes, 4);
  assert.equal(diagnostics.preservedCues, 1);
  assert.ok(diagnostics.skipped >= 1);
  assert.equal(wall.geometry, geometry, 'surface pass must not replace geometry');
  assert.equal(actorMesh.material, wallMaterial, 'actor subtree must be untouched');
  assert.equal(light.intensity, 8, 'lights must be untouched');
  assert.notEqual(wall.material, wallMaterial, 'world role receives an owned clone');
  assert.ok(wall.material.color.getHex() !== wallMaterial.color.getHex(), 'wall loses saturated red tint');
  assert.notEqual(floor.material.color.getHex(), floorMaterial.color.getHex(), 'generic floor name is classified');
  assert.equal(seams.material.opacity, .1, 'line floor seams are reduced to a graphite trace');
  assert.equal(seams.material.transparent, true);
  assert.equal(seams.material.color.getHex(), 0x3b4547);
  assert.ok(signal.material.emissiveIntensity <= 1.35, 'gate cue retains bounded signal intensity');
  assert.ok(signal.material.color.r > signal.material.color.g, 'gate cue retains hue direction');

  const second = applyAfterlifeSurfaces(root, { sector: 'ossuary' });
  assert.equal(second.reused, true, 'second call is a no-op');
  assert.equal(second.changedMeshes, diagnostics.changedMeshes);
});

test('excludeRoots protects authored objective geometry', () => {
  const root = new THREE.Group();
  const objective = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xee4455 });
  material.userData.roomRole = 'roomBone';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  mesh.name = 'ObjectiveReliquary';
  objective.add(mesh);
  root.add(objective);
  const diagnostics = applyAfterlifeSurfaces(root, { excludeRoots: [objective] });
  assert.equal(mesh.material, material);
  assert.equal(diagnostics.changedMeshes, 0);
  assert.ok(diagnostics.skipped >= 1);
});
