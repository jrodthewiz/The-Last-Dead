import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { previewGeometry } from '../enemy-cut-preview.js';

function fixture() {
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0], 3));
  source.setAttribute('normal', new THREE.Float32BufferAttribute([0,0,1, 0,0,1, 0,0,1], 3));
  source.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0,0,0,0, 1,0,0,0, 0,1,0,0], 4));
  source.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1,0,0,0, 1,0,0,0, .8,.2,0,0], 4));
  source.setIndex([0,1,2]); source.addGroup(0,3,0); source.computeBoundingBox(); source.computeBoundingSphere();
  source.userData.sharedAsset = true;
  return { source, mesh: { skeleton: { bones: [{ name: 'Head' }, { name: 'LeftArm' }] } } };
}

test('independent cut previews reuse source vertices and retain distinct region masks and draw metadata', () => {
  const { source, mesh } = fixture(), a = previewGeometry(source, mesh), b = previewGeometry(source, mesh);
  assert.equal(a.index, source.index); assert.equal(a.attributes.position, source.attributes.position);
  assert.equal(a.attributes.skinIndex, source.attributes.skinIndex); assert.equal(a.attributes.skinWeight, source.attributes.skinWeight);
  assert.equal(b.attributes.position, source.attributes.position);
  assert.notEqual(a.attributes.anatomyA, b.attributes.anatomyA);
  assert.deepEqual([...a.attributes.anatomyA.array], [...b.attributes.anatomyA.array]);
  assert.deepEqual(a.groups, source.groups); assert.notEqual(a.groups[0], source.groups[0]);
  assert(a.boundingSphere.equals(source.boundingSphere)); assert.notEqual(a.boundingSphere, source.boundingSphere);
  assert.equal(a.userData.corpseSourceGeometry, source.uuid); assert.equal(a.userData.sharedAsset, undefined);
  a.attributes.anatomyA.setX(0, .25);
  assert.notEqual(a.attributes.anatomyA.getX(0), b.attributes.anatomyA.getX(0), 'one preview cannot alter another mask');
  assert.equal(source.attributes.anatomyA, undefined);
});

test('preview disposal only exposes owned mask buffers to the renderer and remains idempotent', () => {
  const { source, mesh } = fixture(), a = previewGeometry(source, mesh), b = previewGeometry(source, mesh);
  const original = [...source.attributes.position.array], masks = [a.attributes.anatomyA, a.attributes.anatomyB];
  let events = 0;
  a.addEventListener('dispose', () => { events++; assert.equal(a.index, null); assert.deepEqual(Object.values(a.attributes), masks); assert.deepEqual(a.morphAttributes, {}); });
  a.dispose(); a.dispose();
  assert.equal(events, 1);
  assert.equal(b.attributes.position, source.attributes.position); assert.deepEqual([...source.attributes.position.array], original);
  assert.equal(source.index.count, 3); assert.equal(source.userData.sharedAsset, true);
  b.dispose(); source.dispose();
});
