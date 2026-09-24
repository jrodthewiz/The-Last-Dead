import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createRifle, animateRifle } from '../weapon-rifles.js';

function triangles(root) {
  let total = 0;
  root.traverse(node => {
    if (!node.isMesh) return;
    total += Math.round((node.geometry.index?.count || node.geometry.attributes.position?.count || 0) / 3) * (node.count || 1);
  });
  return total;
}

for (const variant of ['carrion', 'mourning']) {
  test(`${variant} rifle exposes first-person sockets, mechanism pivots, and bounded geometry`, () => {
    const root = createRifle({ variant });
    const meta = root.userData.rifle;
    assert.ok(root instanceof THREE.Group);
    assert.equal(meta.variant, variant);
    for (const name of ['muzzle', 'projectileOrigin', 'grip', 'supportGrip']) {
      assert.ok(root.userData[name]?.isObject3D, `${name} socket is present`);
      assert.ok(meta.sockets[name]?.isObject3D, `${name} metadata socket is present`);
    }
    assert.ok(root.userData.resourcesReady instanceof Promise);
    assert.ok(root.userData.diagnostics.mechanisms.length >= 5);
    assert.ok(triangles(root) <= 12000, `${variant} stays below the 12k first-person target`);
    root.updateMatrixWorld(true);
    const muzzleBrake = root.getObjectByName('muzzle-brake');
    const muzzleBounds = new THREE.Box3().setFromObject(muzzleBrake);
    const muzzleWorld = new THREE.Vector3();
    root.userData.muzzle.getWorldPosition(muzzleWorld);
    assert.ok(muzzleWorld.z <= muzzleBounds.min.z + .06, `${variant} muzzle socket sits at the visible brake tip`);
    assert.ok(muzzleWorld.z >= muzzleBounds.min.z - .08, `${variant} muzzle socket does not float beyond the brake`);
    for (const pivot of Object.values(root.userData.rifleMechanisms)) {
      assert.equal(pivot.userData.weaponMechanism !== undefined, true, `${pivot.name} remains a protected animation pivot`);
    }
  });
}

test('Carrion cycles its bolt on a live shot and ignores a hidden global sequence', () => {
  const root = createRifle({ variant: 'carrion' });
  const bolt = root.userData.rifleMechanisms.boltCarrier;
  animateRifle(root, 0, 0, .016, { shotSequence: 8 });
  assert.equal(bolt.position.z, 0, 'a hidden rifle does not consume another slot’s sequence');
  animateRifle(root, 1, 0, .016, { shotSequence: 8 });
  assert.ok(bolt.position.z > 0, 'a live shot moves the reciprocating bolt rearward');
  for (let i = 0; i < 80; i++) animateRifle(root, 0, i * .016, .016, { shotSequence: 8 });
  assert.ok(Math.abs(bolt.position.z) < .01, 'the bolt returns to battery');
});

test('Mourning charge indicator follows charge and the exposed lever cycles', () => {
  const root = createRifle({ variant: 'mourning' });
  const meta = root.userData.rifle;
  const lever = meta.rifleMechanisms?.chargingLever || meta.mechanisms.chargingLever;
  const chargeBar = meta.rifleMechanisms?.chargeBar || meta.mechanisms.chargeBar;
  assert.ok(lever && chargeBar);
  animateRifle(root, 0, 0, .016, { shotSequence: 0, charge: .9 });
  const chargeScale = chargeBar.scale.z;
  animateRifle(root, 1, .016, .016, { shotSequence: 1, charge: .9 });
  assert.ok(lever.rotation.x < 0, 'the charging lever has an observable action pose');
  assert.ok(chargeBar.scale.z >= chargeScale, 'the charge bar remains readable while charged');
});
