import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createOssuary, animateOssuary } from '../weapon-ossuary.js';
import { createBreach, animateBreach } from '../weapon-breach.js';
import { createArc, animateArc } from '../weapon-arc.js';
import { createReliquary, animateReliquary } from '../weapon-reliquary.js';

function inspect(root, label) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 0 && size.y > 0 && size.z > 0, `${label} should occupy volume`);
  let meshes = 0, triangles = 0;
  root.traverse(node => {
    if (!node.isMesh) return;
    meshes++;
    triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3;
    for (const value of node.geometry.attributes.position.array) assert.ok(Number.isFinite(value), `${label} has a non-finite vertex`);
  });
  assert.ok(meshes > 0 && meshes < 128, `${label} mesh count should stay bounded`);
  assert.ok(triangles > 0 && triangles < 100_000, `${label} triangle count should stay bounded`);
  assert.ok(root.userData.muzzle?.isObject3D, `${label} needs a muzzle socket`);
  assert.ok(root.userData.projectileOrigin?.isObject3D, `${label} needs a projectile socket`);
  assert.ok(root.userData.sculptRuntime?.parts, `${label} needs named sculpt parts`);
  return { meshes, triangles, size: size.toArray() };
}

function finiteTransforms(root, label) {
  root.traverse(node => {
    for (const value of [...node.position.toArray(), ...node.scale.toArray(), ...node.quaternion.toArray()]) assert.ok(Number.isFinite(value), `${label} transform is not finite`);
  });
}

test('Build08 procedural weapon factories stay bounded, socketed and animatable', () => {
  const cases = [
    ['Ossuary', createOssuary, animateOssuary, (a, root, frame) => a(root, frame ? 0 : 1, frame * .016, .016)],
    ['Breach', createBreach, animateBreach, (a, root, frame) => a(root, frame * .016, frame ? 0 : 1, .016)],
    ['Arc', createArc, animateArc, (a, root, frame) => a(root, frame * .016, frame ? 0 : 1, .016)],
    ['Reliquary', createReliquary, animateReliquary, (a, root, frame) => a(root, frame ? 0 : 1, frame * .016, .016)],
  ];
  const results = [];
  for (const [label, factory, animate, call] of cases) {
    const root = factory({ variant: label.toLowerCase() });
    const stats = inspect(root, label);
    call(animate, root, 0);
    assert.equal(root.userData.sculptRuntime.sockets.muzzle, root.userData.muzzle, `${label} muzzle metadata should agree`);
    for (let frame = 1; frame <= 64; frame++) {
      call(animate, root, frame);
      finiteTransforms(root, label);
    }
    assert.equal(root.userData[ label.toLowerCase() ]?.lastShot ?? root.userData.reliquary?.lastShot, 0, `${label} shot pulse should reset`);
    results.push({ label, ...stats, parts: Object.keys(root.userData.sculptRuntime.parts).length });
  }
  console.log(JSON.stringify(results));
});
