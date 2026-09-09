import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createBreach} from '../weapon-breach.js';
import {createArc} from '../weapon-arc.js';
import {createOssuary} from '../weapon-ossuary.js';
import {createReliquary} from '../weapon-reliquary.js';
import {batchStaticWeaponMeshes, weaponBatchingContract} from '../weapon-batching.js';

function meshList(root) {
  const list = [];
  root.traverse(node => { if (node.isMesh) list.push(node); });
  return list;
}

function bounds(root) {
  root.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(root, true);
}

test('batches static sibling surfaces without flattening animated pivots or pooled FX', () => {
  const root = new THREE.Group();
  root.position.set(1.8, -.45, .7);
  root.rotation.set(.17, -.24, .08);
  const pivot = new THREE.Group();
  pivot.name = 'recoil-pivot';
  pivot.position.set(.22, .31, -.4);
  pivot.rotation.y = .33;
  root.add(pivot);
  const steel = new THREE.MeshStandardMaterial({color: 0x334455, roughness: .6});
  const hidden = new THREE.MeshStandardMaterial({color: 0x112233});
  const hook = () => {};
  const first = new THREE.Mesh(new THREE.BoxGeometry(.2, .3, .4), steel);
  first.name = 'plate-a';
  first.position.set(-.26, .05, -.11);
  first.onBeforeRender = hook;
  first.onAfterRender = hook;
  const second = new THREE.Mesh(new THREE.BoxGeometry(.12, .16, .2), steel);
  second.name = 'plate-b';
  second.position.set(.3, -.08, .12);
  second.onBeforeRender = hook;
  second.onAfterRender = hook;
  pivot.add(first, second);

  const pooled = new THREE.Group();
  pooled.name = 'muzzle-flash';
  pooled.userData.pooled = true;
  const puff = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), hidden);
  puff.name = 'smoke-puff';
  puff.userData.smokeSize = .1;
  pooled.add(puff);
  root.add(pooled);

  const before = bounds(root);
  const report = batchStaticWeaponMeshes(root);
  const after = bounds(root);
  const merged = pivot.children.find(node => node.isMesh && node.userData.weaponBatch);

  assert.equal(report.mergedMeshes, 1);
  assert.equal(report.mergedSources, 2);
  assert.equal(report.meshesBefore - report.meshesAfter, 1);
  assert.ok(merged, 'the two static plates should become one mesh');
  assert.equal(merged.material, steel, 'the original material object is retained');
  assert.equal(merged.onBeforeRender, hook, 'shared depth hooks are retained');
  assert.equal(merged.onAfterRender, hook, 'shared after hooks are retained');
  assert.equal(merged.parent, pivot, 'the animated parent pivot is preserved');
  assert.equal(pivot.parent, root, 'the root hierarchy is preserved');
  assert.equal(pooled.children[0], puff, 'pooled smoke geometry stays individually animated');
  const epsilon = 1e-5;
  assert.ok(Math.abs(before.min.x - after.min.x) < epsilon);
  assert.ok(Math.abs(before.max.x - after.max.x) < epsilon);
  assert.ok(Math.abs(before.min.y - after.min.y) < epsilon);
  assert.ok(Math.abs(before.max.y - after.max.y) < epsilon, JSON.stringify({before: before.max.y, after: after.max.y}));
  assert.ok(Math.abs(before.min.z - after.min.z) < epsilon);
  assert.ok(Math.abs(before.max.z - after.max.z) < epsilon);
});

test('reduces the un-compacted Breach factory while preserving its animation contract', () => {
  const model = createBreach();
  const recoil = model.userData.breach.recoilCarriage;
  const breech = model.userData.breach.breechBlock;
  const muzzleFlash = model.userData.breach.sockets.muzzleFlash;
  const heat = model.userData.breach.sockets.heat;
  const before = meshList(model).length;
  const report = batchStaticWeaponMeshes(model);
  const after = meshList(model).length;

  assert.ok(report.mergedMeshes > 0, `expected Breach batching to merge static surfaces (${before} meshes)`);
  assert.equal(report.meshesBefore, before);
  assert.equal(report.meshesAfter, after);
  assert.ok(after < before, `expected fewer Breach meshes (${before} -> ${after})`);
  assert.equal(model.userData.breach.recoilCarriage, recoil);
  assert.equal(model.userData.breach.breechBlock, breech);
  assert.equal(model.userData.breach.sockets.muzzleFlash, muzzleFlash);
  assert.equal(model.userData.breach.sockets.heat, heat);
  assert.equal(breech.userData.weaponMechanism, 'sliding-breech');
  assert.equal(muzzleFlash.visible, false);
});

test('keeps the existing factory reductions monotonic and reports no unsafe flattening', () => {
  for (const factory of [createOssuary, createArc, createReliquary]) {
    const model = factory();
    const before = meshList(model).length;
    const pivots = Object.values(model.userData[model.userData.ossuary ? 'ossuary' : model.userData.arc ? 'arc' : 'reliquary'] || {})
      .filter(value => value?.isObject3D);
    const report = batchStaticWeaponMeshes(model);
    const after = meshList(model).length;
    assert.ok(after <= before, `${model.name} batching must not increase meshes`);
    assert.equal(report.meshesBefore, before);
    assert.equal(report.meshesAfter, after);
    for (const pivot of pivots) assert.ok(pivot.parent, `${model.name} pivot should remain attached`);
  }
});

test('publishes the conservative weapon batching contract', () => {
  assert.deepEqual(weaponBatchingContract, {
    preservesParentPivots: true,
    preservesMaterialIdentity: true,
    protectsTaggedMechanisms: true,
    protectsPooledEffects: true,
  });
});
