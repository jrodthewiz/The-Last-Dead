import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createBellwraith, animateBellwraith } from '../npc-bellwraith.js';
import { createReliquary, animateReliquary } from '../weapon-reliquary.js';

// The factories are deliberately DOM-free. Keep instantiation explicit here so
// the smoke test remains usable in CI and does not silently acquire browser
// globals through a renderer helper.
function instantiateNode(factory, options = {}) {
  const root = factory(options);
  assert.ok(root?.isObject3D, 'factory should return a Three.js Object3D');
  root.updateWorldMatrix(true, true);
  return root;
}

function finiteVector(vector, label) {
  for (const value of vector.toArray()) {
    assert.ok(Number.isFinite(value), `${label} contains a non-finite value`);
  }
}

function inspectModel(root, label) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  finiteVector(bounds.min, `${label} bounds.min`);
  finiteVector(bounds.max, `${label} bounds.max`);
  finiteVector(size, `${label} bounds.size`);
  assert.ok(size.x > 0 && size.y > 0 && size.z > 0, `${label} should occupy a 3D volume`);

  let meshes = 0;
  let triangles = 0;
  let vertices = 0;
  root.traverse(node => {
    if (!node.isMesh) return;
    meshes++;
    const position = node.geometry?.attributes?.position;
    assert.ok(position, `${label} mesh ${node.name} is missing a position attribute`);
    vertices += position.count;
    triangles += (node.geometry.index?.count || position.count) / 3;
    for (const value of position.array) {
      assert.ok(Number.isFinite(value), `${label} has a non-finite vertex`);
    }
    for (const attribute of Object.values(node.geometry.attributes)) {
      for (const value of attribute.array) {
        assert.ok(Number.isFinite(value), `${label} has a non-finite geometry attribute`);
      }
    }
  });
  assert.ok(meshes > 0, `${label} should contain meshes`);
  assert.ok(triangles > 0, `${label} should contain triangles`);
  assert.ok(meshes < 128, `${label} mesh count should stay bounded`);
  assert.ok(triangles < 100_000, `${label} triangle count should stay bounded`);
  return {
    meshes,
    triangles,
    vertices,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    size: size.toArray(),
  };
}

function assertTransformsFinite(root, label) {
  root.traverse(node => {
    finiteVector(node.position, `${label} ${node.name} position`);
    finiteVector(node.scale, `${label} ${node.name} scale`);
    for (const value of node.quaternion.toArray()) {
      assert.ok(Number.isFinite(value), `${label} ${node.name} quaternion is non-finite`);
    }
  });
}

test('Bellwraith factory is Node-instantiable, bounded, finite, and animatable', () => {
  const root = instantiateNode(createBellwraith, { variant: 'mourning-bell', phase: .37 });
  const stats = inspectModel(root, 'Bellwraith');
  const meta = root.userData.bellwraith;
  assert.equal(meta.kind, 'bellwraith');
  assert.ok(meta.sockets.pulseOrigin && meta.sockets.attackOrigin && meta.sockets.deathBurst);
  assert.deepEqual(root.userData.sculptRuntime.collider.size, [.9, 1.9, .9]);

  for (let frame = 0; frame < 120; frame++) {
    const attacking = frame % 20 >= 8 && frame % 20 < 16;
    animateBellwraith(root, {
      attacking,
      attack: attacking ? .24 : 999,
      windup: attacking ? .38 : 0,
      strike: frame % 20 >= 13 && frame % 20 < 15 ? 1 : 0,
      flash: frame % 17 === 0 ? .16 : 0,
    }, frame * 16, 2.4);
    assertTransformsFinite(root, 'Bellwraith');
  }
  assert.equal(root.visible, true);
  animateBellwraith(root, { dead: true }, 2_000, 2.4);
  animateBellwraith(root, { dead: true }, 2_600, 2.4);
  assert.equal(root.visible, false, 'death animation should eventually hide the Bellwraith');
  animateBellwraith(root, { dead: false }, 2_700, 2.4);
  assert.equal(root.visible, true, 'Bellwraith should reset to visible after death state clears');
  assertTransformsFinite(root, 'Bellwraith reset');

  console.log(JSON.stringify({ model: 'Bellwraith', ...stats }));
});

test('Reliquary factory is bounded and repeated shot pulses reset muzzle flash', () => {
  const root = instantiateNode(createReliquary, { variant: 'bone-rocket' });
  const stats = inspectModel(root, 'Reliquary');
  const meta = root.userData.reliquary;
  assert.equal(meta.kind, 'reliquary');
  assert.ok(meta.sockets.muzzle && meta.sockets.projectileOrigin && meta.sockets.muzzleFlash);
  assert.deepEqual(root.userData.sculptRuntime.collider.size, [.42, .82, 1.48]);

  animateReliquary(root, 1, 0, .016);
  assert.equal(meta.lastShot, 1);
  assert.ok(meta.flash > .1, 'first shot should raise flash intensity');
  assert.equal(meta.sockets.muzzleFlash.visible, true);
  assertTransformsFinite(root, 'Reliquary first shot');

  for (let frame = 1; frame <= 48; frame++) {
    animateReliquary(root, 0, frame * .016, .016);
    assertTransformsFinite(root, 'Reliquary decay');
  }
  assert.equal(meta.lastShot, 0, 'shot pulse should reset after the trigger is released');
  assert.equal(meta.flash, 0, 'muzzle flash should fully decay after the trigger is released');
  assert.equal(meta.sockets.muzzleFlash.visible, false);

  animateReliquary(root, 1, .8, .016);
  assert.equal(meta.lastShot, 1, 'second shot should be detected after a reset');
  assert.ok(meta.flash > .1, 'second shot should raise a fresh flash');
  assert.equal(meta.sockets.muzzleFlash.visible, true);
  for (let frame = 0; frame < 64; frame++) {
    animateReliquary(root, 0, .816 + frame * .016, .016, { inspect: true });
  }
  assert.equal(meta.sockets.muzzleFlash.visible, false);
  assertTransformsFinite(root, 'Reliquary final');

  console.log(JSON.stringify({ model: 'Reliquary', ...stats }));
});
