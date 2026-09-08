import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeCampaignCourse } from '../engine.js';
import { batchStaticWorld, buildCathedralKit } from '../world-polish.js';

const EPSILON = 1e-5;

function triangleCount(mesh) {
  const position = mesh.geometry?.attributes?.position;
  if (!position) return 0;
  return mesh.geometry.index ? mesh.geometry.index.count / 3 : position.count / 3;
}

function meshesUnder(root) {
  const meshes = [];
  root.traverse((object) => {
    if (object.isMesh) meshes.push(object);
  });
  return meshes;
}

function assertFiniteGeometry(mesh, label) {
  for (const name of ['position', 'normal', 'uv']) {
    const attribute = mesh.geometry?.attributes?.[name];
    assert.ok(attribute, label + ' is missing ' + name);
    for (const value of attribute.array) {
      assert.ok(Number.isFinite(value), label + ' ' + name + ' contains a non-finite value');
    }
  }
  assert.ok(Number.isFinite(triangleCount(mesh)), label + ' triangle count is not finite');
  assert.ok(triangleCount(mesh) > 0, label + ' has no triangles');
}

function materialHex(material) {
  return material?.color?.getHex?.() ?? -1;
}

function materialTriangleTotals(meshes) {
  const totals = new Map();
  for (const mesh of meshes) {
    const key = materialHex(mesh.material);
    totals.set(key, (totals.get(key) || 0) + triangleCount(mesh));
  }
  return totals;
}

function vertexBounds(object) {
  const position = object.geometry?.attributes?.position;
  if (!position) return new THREE.Box3().makeEmpty();
  const bounds = new THREE.Box3().makeEmpty();
  const point = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
    bounds.expandByPoint(point);
  }
  return bounds;
}

function unionBounds(objects) {
  const bounds = new THREE.Box3();
  for (const object of objects) bounds.union(vertexBounds(object));
  return bounds;
}

function assertBoundsEqual(actual, expected, label) {
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(
      Math.abs(actual.min[axis] - expected.min[axis]) <= EPSILON,
      label + ' min.' + axis + ' changed (' + actual.min[axis] + ' vs ' + expected.min[axis] + ')',
    );
    assert.ok(
      Math.abs(actual.max[axis] - expected.max[axis]) <= EPSILON,
      label + ' max.' + axis + ' changed (' + actual.max[axis] + ' vs ' + expected.max[axis] + ')',
    );
  }
}

function worldMaterials() {
  return {
    metalDark: new THREE.MeshStandardMaterial({ color: 0x293136, roughness: 0.82, metalness: 0.35 }),
    black: new THREE.MeshStandardMaterial({ color: 0x090b0d, roughness: 0.8, metalness: 0.1 }),
    violet: new THREE.MeshStandardMaterial({ color: 0x55406f, roughness: 0.75, metalness: 0.2 }),
    gold: new THREE.MeshStandardMaterial({ color: 0x9a6c2d, roughness: 0.58, metalness: 0.7 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xa84f28, roughness: 0.7, metalness: 0.25 }),
  };
}

test('cathedral kit stays finite and batchable in every campaign sector', () => {
  const sectorStats = [];

  for (let sectorIndex = 0; sectorIndex < 3; sectorIndex += 1) {
    const root = new THREE.Group();
    const kit = buildCathedralKit(root, worldMaterials(), makeCampaignCourse(sectorIndex));
    assert.equal(kit.name, 'CathedralArchitecture');
    assert.ok(kit.children.length > 0, 'sector ' + sectorIndex + ' has no cathedral geometry');

    root.updateMatrixWorld(true);
    const beforeMeshes = meshesUnder(root);
    const beforeBounds = unionBounds(beforeMeshes);
    const beforeTriangles = beforeMeshes.reduce((sum, mesh) => sum + triangleCount(mesh), 0);
    const beforeRoles = materialTriangleTotals(beforeMeshes);
    assert.ok(beforeBounds.min.toArray().every(Number.isFinite), 'sector ' + sectorIndex + ' bounds are invalid');
    assert.ok(beforeBounds.max.toArray().every(Number.isFinite), 'sector ' + sectorIndex + ' bounds are invalid');
    assert.ok(beforeTriangles > 0, 'sector ' + sectorIndex + ' has no triangles');

    for (const mesh of beforeMeshes) {
      assertFiniteGeometry(mesh, 'sector ' + sectorIndex + '/' + mesh.name);
    }
    assert.ok((beforeRoles.get(0x242b2b) || 0) > 0, 'sector ' + sectorIndex + ' has no stone role');
    assert.ok((beforeRoles.get(0x76604a) || 0) > 0, 'sector ' + sectorIndex + ' has no brass role');

    const result = batchStaticWorld(root);
    assert.ok(result.removed > 0, 'sector ' + sectorIndex + ' did not remove static meshes');
    assert.ok(result.batches > 0, 'sector ' + sectorIndex + ' did not create a static batch');

    root.updateMatrixWorld(true);
    const afterMeshes = meshesUnder(root);
    const afterBounds = unionBounds(afterMeshes);
    const afterTriangles = afterMeshes.reduce((sum, mesh) => sum + triangleCount(mesh), 0);
    const afterRoles = materialTriangleTotals(afterMeshes);
    assertBoundsEqual(afterBounds, beforeBounds, 'sector ' + sectorIndex + ' world bounds');
    assert.equal(afterTriangles, beforeTriangles, 'sector ' + sectorIndex + ' triangle count');
    assert.equal(afterRoles.get(0x242b2b), beforeRoles.get(0x242b2b), 'sector ' + sectorIndex + ' stone triangles');
    assert.equal(afterRoles.get(0x76604a), beforeRoles.get(0x76604a), 'sector ' + sectorIndex + ' brass triangles');
    for (const mesh of afterMeshes) {
      assertFiniteGeometry(mesh, 'batched sector ' + sectorIndex + '/' + mesh.name);
    }

    sectorStats.push({
      sectorIndex,
      sourceMeshes: beforeMeshes.length,
      sourceTriangles: beforeTriangles,
      removed: result.removed,
      batches: result.batches,
    });
  }

  assert.equal(sectorStats.length, 3);
  assert.ok(sectorStats.every((stats) => stats.sourceTriangles > 1000));
  process.stdout.write('world-polish sectors: ' + JSON.stringify(sectorStats) + '\n');
});

test('batchStaticWorld preserves transformed bounds and material roles while excluding protected and instanced meshes', () => {
  const root = new THREE.Group();
  const architecture = new THREE.Group();
  architecture.position.set(2.5, 0.7, -1.2);
  architecture.rotation.y = 0.31;
  architecture.scale.set(1.1, 0.95, 1.4);
  root.add(architecture);

  const stone = new THREE.MeshStandardMaterial({ color: 0x1c2528, roughness: 0.86, metalness: 0.18 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x967044, roughness: 0.54, metalness: 0.76 });
  const transparentMaterial = new THREE.MeshStandardMaterial({
    color: 0x64869b,
    roughness: 0.42,
    transparent: true,
    opacity: 0.4,
  });

  const staticStone = [];
  for (let index = 0; index < 4; index += 1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2 + index * 0.08, 0.8, 0.65), stone);
    mesh.name = 'StaticStone_' + index;
    mesh.position.set(-2 + index * 1.7, 0.5 + (index % 2) * 0.2, Math.sin(index) * 0.6);
    mesh.rotation.y = index * 0.17;
    mesh.scale.set(1, 1 + index * 0.05, 1 - index * 0.03);
    mesh.receiveShadow = true;
    mesh.userData.role = 'static-stone';
    architecture.add(mesh);
    staticStone.push(mesh);
  }

  const staticBrass = [];
  for (let index = 0; index < 3; index += 1) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.34, 1.3 + index * 0.2, 8), brass);
    mesh.name = 'StaticBrass_' + index;
    mesh.position.set(-1 + index * 1.9, 1.1, -1.4 + index * 0.5);
    mesh.rotation.z = index * 0.13;
    mesh.receiveShadow = true;
    mesh.userData.role = 'static-brass';
    architecture.add(mesh);
    staticBrass.push(mesh);
  }

  const protectedGroup = new THREE.Group();
  protectedGroup.name = 'AnimatedExit';
  protectedGroup.position.set(-2, 0, 3);
  const protectedGeometry = new THREE.TorusGeometry(0.7, 0.12, 8, 16);
  const protectedMesh = new THREE.Mesh(protectedGeometry, stone);
  protectedMesh.name = 'AnimatedExitRing';
  protectedMesh.castShadow = true;
  protectedGroup.add(protectedMesh);
  root.add(protectedGroup);

  const instancedGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const instanced = new THREE.InstancedMesh(instancedGeometry, stone, 2);
  instanced.name = 'AnimatedFlock';
  const instanceMatrix = new THREE.Matrix4();
  instanceMatrix.setPosition(1, 0.4, 3);
  instanced.setMatrixAt(0, instanceMatrix);
  instanceMatrix.setPosition(1.7, 0.7, 3.4);
  instanced.setMatrixAt(1, instanceMatrix);
  instanced.instanceMatrix.needsUpdate = true;
  root.add(instanced);

  const transparentGeometry = new THREE.BoxGeometry(0.8, 1.5, 0.8);
  const transparentMesh = new THREE.Mesh(transparentGeometry, transparentMaterial);
  transparentMesh.name = 'GlassWindow';
  transparentMesh.position.set(3, 0.8, 2);
  root.add(transparentMesh);

  root.updateMatrixWorld(true);
  const staticMeshes = [...staticStone, ...staticBrass];
  const beforeBounds = unionBounds(staticMeshes);
  const beforeTriangles = staticMeshes.reduce((sum, mesh) => sum + triangleCount(mesh), 0);
  const protectedBounds = vertexBounds(protectedMesh);
  const protectedGeometryRef = protectedMesh.geometry;
  const instancedGeometryRef = instanced.geometry;
  const transparentGeometryRef = transparentMesh.geometry;

  const result = batchStaticWorld(root, [protectedGroup]);
  assert.equal(result.removed, staticMeshes.length);
  assert.equal(result.batches, 2);
  assert.equal(architecture.children.length, 0, 'static child meshes should be removed from their source group');

  root.updateMatrixWorld(true);
  const batches = meshesUnder(root).filter((mesh) => mesh.name.startsWith('WorldBatch_'));
  assert.equal(batches.length, 2);
  assertBoundsEqual(unionBounds(batches), beforeBounds, 'batched world-space bounds');
  assert.equal(
    batches.reduce((sum, mesh) => sum + triangleCount(mesh), 0),
    beforeTriangles,
    'batched triangle count',
  );
  assert.equal(batches.filter((mesh) => mesh.material === stone).length, 1, 'stone role was not preserved');
  assert.equal(batches.filter((mesh) => mesh.material === brass).length, 1, 'brass role was not preserved');
  for (const mesh of batches) assertFiniteGeometry(mesh, mesh.name);

  assert.equal(protectedMesh.parent, protectedGroup, 'protected mesh was detached');
  assert.equal(protectedMesh.geometry, protectedGeometryRef, 'protected geometry was replaced');
  assertBoundsEqual(vertexBounds(protectedMesh), protectedBounds, 'protected geometry bounds');
  assert.equal(instanced.parent, root, 'instanced mesh was batched or removed');
  assert.equal(instanced.count, 2);
  assert.equal(instanced.geometry, instancedGeometryRef, 'instanced geometry was replaced');
  assert.equal(transparentMesh.parent, root, 'transparent mesh was batched or removed');
  assert.equal(transparentMesh.geometry, transparentGeometryRef, 'transparent geometry was replaced');
});
