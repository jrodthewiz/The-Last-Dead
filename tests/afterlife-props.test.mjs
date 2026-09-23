import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {
  AFTERLIFE_PROP_DIMENSIONS,
  buildAfterlifeProps,
  createAfterlifeReliquary,
  createAfterlifeWheelchair,
  disposeAfterlifeProp,
} from '../afterlife-props.js';

function triangleCount(root) {
  let triangles = 0;
  root.traverse(object => {
    if (!object.isMesh || !object.geometry) return;
    const count = object.geometry.index?.count || object.geometry.attributes.position?.count || 0;
    triangles += object.isInstancedMesh ? count / 3 * object.count : count / 3;
  });
  return triangles;
}

function meshNames(root) {
  const names = [];
  root.traverse(object => { if (object.isMesh) names.push(object.name); });
  return names;
}

function assertFiniteGeometry(root, label) {
  root.traverse(object => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value), `${label}:${object.name} has finite positions`);
  });
}

test('afterlife props keep the reference silhouettes inside the lightweight budget', () => {
  const cases = [
    ['wheelchair', createAfterlifeWheelchair, AFTERLIFE_PROP_DIMENSIONS.wheelchair],
    ['mourningCabinet', createAfterlifeReliquary, AFTERLIFE_PROP_DIMENSIONS.mourningCabinet],
  ];
  for (const [kind, factory, budget] of cases) {
    const prop = factory({ reference: `docs/afterlife-iteration/references/${kind === 'wheelchair' ? 'wheelchair' : 'mourning-cabinet'}.png` });
    const bounds = new THREE.Box3().setFromObject(prop);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x > budget.width * .9 && size.x < budget.width * 1.08, `${kind}: width stays near the authored metre envelope`);
    assert.ok(size.y > budget.height * .94 && size.y < budget.height * 1.08, `${kind}: height stays near the authored metre envelope`);
    assert.ok(size.z > budget.depth * .82 && size.z < budget.depth * 1.16, `${kind}: depth stays near the authored metre envelope`);
    assert.ok(triangleCount(prop) <= budget.triangleBudget, `${kind}: triangle budget is bounded`);
    assert.ok(prop.userData.afterlifePropDiagnostics.materials <= 5, `${kind}: material slots stay bounded`);
    assertFiniteGeometry(prop, kind);
  }
});

test('wheelchair preserves the visual identity systems and action-ready sockets', () => {
  const prop = createAfterlifeWheelchair();
  const names = meshNames(prop);
  assert.ok(names.some(name => name.includes('LeftWheelAssembly_Tire')));
  assert.ok(names.some(name => name.includes('RightWheelAssembly_Spokes')));
  assert.ok(names.includes('SeatSling'));
  assert.ok(names.includes('BackSling'));
  assert.ok(names.includes('LeftFootPlate') && names.includes('RightFootPlate'));
  assert.ok(prop.userData.sculptRuntime.sockets.leftWheelAxle);
  assert.ok(prop.userData.sculptRuntime.sockets.rightCasterSwivel);
  assert.ok(prop.userData.sculptRuntime.colliders.length >= 3);
  assert.ok(prop.userData.sculptRuntime.destructionGroups.cloth.includes('seat'));
  const side = prop.clone();
  side.rotation.y = Math.PI * .5;
  side.updateMatrixWorld(true);
  const sideBounds = new THREE.Box3().setFromObject(side);
  assert.ok(sideBounds.getSize(new THREE.Vector3()).z > .5, 'wheelchair remains a volume from a side orbit');
});

test('mourning cabinet carries twin door cues, hardware, and future hinge metadata', () => {
  const prop = createAfterlifeReliquary();
  const names = meshNames(prop);
  assert.ok(names.includes('LeftFrostedUpperPanel') && names.includes('RightFrostedUpperPanel'));
  assert.ok(names.includes('LeftLowerRecessedPanel') && names.includes('RightLowerRecessedPanel'));
  assert.ok(names.includes('DoorMeetingSeam'));
  assert.ok(names.includes('MakerPlaque'));
  assert.ok(names.includes('LeftDoorPull') && names.includes('RightDoorPull'));
  assert.equal(prop.userData.sculptRuntime.parts.door.userData.actionProfile.animationRole, 'hinge');
  assert.ok(prop.userData.sculptRuntime.sockets.doorHinge);
  assert.ok(prop.userData.sculptRuntime.colliders.some(collider => collider.isTrigger && collider.part === 'door'));
  const front = new THREE.Box3().setFromObject(prop);
  prop.rotation.y = Math.PI * .5;
  prop.updateMatrixWorld(true);
  const side = new THREE.Box3().setFromObject(prop);
  const frontSize = front.getSize(new THREE.Vector3());
  const sideSize = side.getSize(new THREE.Vector3());
  assert.ok(sideSize.z > frontSize.z && sideSize.x < frontSize.x, 'cabinet exposes a shallow depth from the front and a broader side silhouette after orbit');
});

test('map placement helper composes props without taking collision ownership', () => {
  const root = new THREE.Group();
  const built = buildAfterlifeProps(root, [
    { type: 'wheelchair', name: 'AfterlifeChair_A', position: [2, 0, -3], rotation: [0, .4, 0] },
    { type: 'mourning-cabinet', name: 'AfterlifeCabinet_A', position: [-2, 0, 1] },
  ]);
  assert.equal(built.props.length, 2);
  assert.deepEqual(built.diagnostics.kinds, { wheelchair: 1, mourningCabinet: 1 });
  assert.deepEqual(built.props[0].position.toArray(), [2, 0, -3]);
  assert.equal(root.children[1].name, 'AfterlifeCabinet_A');
  assert.equal(root.userData.collisionOwner, undefined);
  assert.equal(disposeAfterlifeProp(built.props[0]), true);
  assert.equal(built.props[0].userData.afterlifePropDisposed, true);
});
