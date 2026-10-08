import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import { createForestVegetation } from '../forest-vegetation.js';
import { TreeGeometry } from '../assets/forest-kit/ez-tree/tree.js';
import TreeOptions from '../assets/forest-kit/ez-tree/options.js';
import { ASH_MEDIUM } from '../assets/forest-kit/presets.js';

const placement = (id, changes = {}) => ({ id, species: 'deciduous', x: 180, y: .22, z: 265, height: 12, seed: 0, ...changes });
function uniqueBuffers(forest) { return new Set(forest.root.children.map(mesh => mesh.geometry)); }
function assertGeometry(geometry) {
  const p = geometry.attributes.position;
  for (const attribute of Object.values(geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite), `${geometry.name} finite ${attribute.name || 'attribute'}`);
  for (let i = 0; i < geometry.index.count; i += 3) {
    const a = geometry.index.getX(i), b = geometry.index.getX(i + 1), c = geometry.index.getX(i + 2);
    assert.ok(a < p.count && b < p.count && c < p.count, 'index inside vertex range');
    const u = new THREE.Vector3(p.getX(b) - p.getX(a), p.getY(b) - p.getY(a), p.getZ(b) - p.getZ(a));
    const v = new THREE.Vector3(p.getX(c) - p.getX(a), p.getY(c) - p.getY(a), p.getZ(c) - p.getZ(a));
    assert.ok(u.cross(v).lengthSq() > 1e-18, `${geometry.name} triangle has measurable area`);
  }
}

test('pinned Ash Medium retains its structured growth contract before forest adaptations', () => {
  const options = new TreeOptions(); options.copy(ASH_MEDIUM);
  const generator = new TreeGeometry(options), pair = generator.createGeometry();
  assert.equal(pair.branches.attributes.position.count, 6639);
  assert.equal(pair.branches.index.count / 3, 9120);
  assert.equal(pair.leaves.attributes.position.count, 21760);
  assert.equal(pair.leaves.index.count / 3, 10880);
  pair.leaves.computeBoundingBox();
  assert.ok(Math.abs(pair.leaves.boundingBox.max.y - 83.6901703) < .00001);
  assert.equal(generator.skeleton.branches.length, 209);
  assert.equal(generator.skeleton.leaves.length, 2720);
  for (const leaf of generator.skeleton.leaves) assert.ok(Number.isFinite(leaf.origin.x + leaf.origin.y + leaf.origin.z));
  for (const geometry of Object.values(pair)) geometry.dispose();
});

test('both species use finite nondegenerate branch rings and crossed cutout cards, with bounded LOD cost', () => {
  const forest = createForestVegetation({ placements: Array.from({ length: 12 }, (_, index) => placement(`tree-${index}`, { species: index % 2 ? 'conifer' : 'deciduous', seed: index, x: index * 8 })), loadTextures: false });
  const d = forest.diagnostics();
  assert.equal(d.templates, 6); assert.equal(d.geometries, 36); assert.equal(d.materials, 3); assert.equal(d.textures, 4);
  assert.equal(d.maxDraws, 36); assert.ok(d.geometryBytes < 6_000_000);
  for (const template of d.triangleCostPerTree) {
    assert.ok(template.lod[0] <= 9400 && template.lod[1] <= 4800 && template.lod[2] <= 2800);
    assert.ok(template.lod[0] > template.lod[1] && template.lod[1] > template.lod[2]);
    assert.ok(template.branches > 80 && template.leafClusters > 2400);
  }
  for (const geometry of uniqueBuffers(forest)) {
    assert.equal(geometry.type, 'BufferGeometry'); assertGeometry(geometry);
    if (geometry.userData.part === 'branches') assert.equal(geometry.boundingBox.min.y, 0);
    else {
      assert.ok(geometry.attributes.uv.array.some(value => value === 0));
      assert.ok(geometry.attributes.uv.array.some(value => value === 1));
    }
  }
  for (const mesh of forest.root.children) {
    assert.ok(mesh.isInstancedMesh); assert.ok(mesh.material.isNodeMaterial);
    if (mesh.userData.part === 'leaves') {
      assert.equal(mesh.material.side, THREE.DoubleSide); assert.equal(mesh.material.transparent, false);
      assert.ok(mesh.material.alphaTest >= .3); assert.equal(mesh.material.map.userData.alphaCutout, true);
      assert.ok(mesh.material.positionNode); assert.equal(mesh.material.userData.branchWind, false);
    }
    assert.equal(mesh.material.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
  }
  forest.dispose();
});

test('seeded placements reuse templates and keep exact world ground contact inside trunk proxies', () => {
  const placements = [placement('one'), placement('two', { x: 197, y: 1.75, z: 273, height: 24, yaw: .8, collisionRadius: .4 }), placement('three', { x: 214, height: 8 })];
  const a = createForestVegetation({ placements, loadTextures: false }), b = createForestVegetation({ placements, loadTextures: false });
  assert.equal(a.diagnostics().templates, 1); assert.equal(a.root.children.length, 6);
  assert.equal(a.diagnostics().draws, 2); assert.equal(a.root.children[0].count, 3); assert.equal(uniqueBuffers(a).size, 6);
  assert.deepEqual(a.bounds, b.bounds); assert.deepEqual(a.trunkProxies, b.trunkProxies);
  for (const pair of a.trunkProxies.entries()) {
    const [index, proxy] = pair;
    assert.equal(proxy.y, placements[index].y); assert.equal(proxy.minY, placements[index].y);
    assert.equal(proxy.maxY, placements[index].y + placements[index].height);
    assert.ok(proxy.radius <= .55 && proxy.visualRootRadius <= proxy.radius + 1e-7);
    assert.equal(proxy.shape, 'cylinder'); assert.equal(proxy.decorativeBranchesNonSolid, true);
    const matrix = new THREE.Matrix4(); a.root.children[0].getMatrixAt(index, matrix);
    const ground = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix);
    assert.ok(ground.distanceTo(new THREE.Vector3(placements[index].x, placements[index].y, placements[index].z)) < .00002);
  }
  for (const geometry of uniqueBuffers(a)) {
    const counterpart = [...uniqueBuffers(b)].find(g => g.name === geometry.name);
    assert.deepEqual(geometry.attributes.position.array, counterpart.attributes.position.array);
  }
  a.dispose(); b.dispose();
});

test('camera LOD and crown culling reuse instance buffers, with hysteresis and only near shadows', () => {
  const forest = createForestVegetation({ placements: [15, 60, 130, -100, 280].map((z, index) => placement(`lod-${index}`, { x: 0, y: 0, z, height: 10 })), loadTextures: false });
  const camera = new THREE.PerspectiveCamera(70, 1, .1, 240); camera.position.set(0, 1.75, 0); camera.lookAt(0, 3, 150);
  const buffers = forest.root.children.map(mesh => [mesh.geometry, mesh.material, mesh.instanceMatrix, mesh.instanceColor]);
  forest.update(camera, 1, true);
  const d = forest.diagnostics(); assert.deepEqual(d.lodTrees, [1, 1, 1]); assert.equal(d.culledTrees, 2);
  assert.equal(d.draws, 6); assert.equal(d.shadowDraws, 2);
  for (let frame = 0; frame < 80; frame++) forest.update(camera, 1 + frame / 60);
  forest.root.children.forEach((mesh, index) => assert.deepEqual([mesh.geometry, mesh.material, mesh.instanceMatrix, mesh.instanceColor], buffers[index]));
  assert.ok(forest.diagnostics().updateCount < 14, 'stable camera updates are throttled');
  forest.setVisible(false); assert.equal(forest.diagnostics().visibleTrees, 0);
  forest.setVisible(true); forest.update(camera, 4); assert.deepEqual(forest.diagnostics().lodTrees, [1, 1, 1]);
  for (const mesh of forest.root.children) if (mesh.userData.lod > 0) assert.equal(mesh.castShadow, false);
  forest.dispose();
});

test('owned disposal is idempotent and borrowed materials/textures remain usable', async () => {
  const borrowedMap = new THREE.DataTexture(new Uint8Array([90, 80, 70, 255]), 1, 1);
  const borrowedNormal = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  const borrowed = new THREE.MeshStandardMaterial({ color: '#50483b', map: borrowedMap, normalMap: borrowedNormal });
  const originalColor = borrowed.color.clone(), originalWrapping = borrowedMap.wrapS;
  let borrowedDisposals = 0; for (const resource of [borrowed, borrowedMap, borrowedNormal]) resource.addEventListener('dispose', () => borrowedDisposals++);
  const forest = createForestVegetation({ placements: [placement('owned')], materials: { bark: borrowed }, loadTextures: false });
  const owned = new Set([...uniqueBuffers(forest), ...forest.root.children.map(mesh => mesh.material)]);
  for (const mesh of forest.root.children) if (mesh.material.map !== borrowedMap) owned.add(mesh.material.map);
  const counts = new Map(); for (const resource of owned) { counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1)); }
  assert.equal(forest.root.children.find(mesh => mesh.userData.part === 'branches').material.map, borrowedMap);
  const loading = await forest.ready; assert.equal(loading.fallback, 3);
  const scene = new THREE.Scene(); scene.add(forest.root);
  forest.dispose(); forest.dispose(); forest.update(new THREE.PerspectiveCamera(), 10); forest.setVisible(true);
  assert.equal(forest.root.parent, null); assert.equal(forest.root.children.length, 0);
  assert.equal(forest.diagnostics().disposed, true); assert.equal(borrowedDisposals, 0);
  assert.ok([...counts.values()].every(value => value === 1));
  assert.ok(borrowed.color.equals(originalColor)); assert.equal(borrowedMap.wrapS, originalWrapping);
  borrowed.dispose(); borrowedMap.dispose(); borrowedNormal.dispose();
});

test('empty forests allocate nothing and invalid placement/distance inputs fail before allocation', async () => {
  const empty = createForestVegetation({ loadTextures: false }); const d = empty.diagnostics();
  assert.equal(d.materials + d.geometries + d.textures + d.draws, 0); assert.equal((await empty.ready).loaded, 0); empty.dispose();
  assert.throws(() => createForestVegetation({ placements: [placement('bad', { y: NaN })] }), /Invalid forest placement/);
  assert.throws(() => createForestVegetation({ placements: [placement('bad', { height: Infinity })] }), /Invalid forest dimensions/);
  assert.throws(() => createForestVegetation({ placements: [placement('bad', { collisionRadius: .8 })] }), /Invalid forest dimensions/);
  assert.throws(() => createForestVegetation({ placements: [placement('duplicate'), placement('duplicate')] }), /Invalid forest placement/);
  assert.throws(() => createForestVegetation({ placements: [placement('bad', { species: 'sphere' })] }), /Invalid forest placement/);
  assert.throws(() => createForestVegetation({ lodDistances: [0, 80, 35] }), /LOD distances/);
  assert.throws(() => createForestVegetation({ cullDistance: NaN }), /distance limits/);
  assert.throws(() => createForestVegetation({ placements: Array.from({ length: 513 }, (_, index) => placement(`limit-${index}`)) }), /at most 512/);
});

test('bundled texture and vendor hashes match the pinned provenance manifest', () => {
  const directory = new URL('../assets/forest-kit/', import.meta.url), manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', directory), 'utf8'));
  assert.equal(manifest.commit, 'dcf309bd86bd521083d9c70f01f2de45fdc7c457'); assert.equal(manifest.version, '1.1.0');
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(new URL(file.path, directory));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.vendoredSha256, file.path);
    assert.equal(bytes.length, file.vendoredBytes, file.path);
  }
  for (const file of ['ez-tree/tree.js', 'ez-tree/options.js', 'ez-tree/branch.js']) {
    const source = fs.readFileSync(new URL(file, directory), 'utf8');
    assert.doesNotMatch(source, /from ['"]three['"]|onBeforeCompile|ShaderMaterial/);
  }
  assert.match(fs.readFileSync(new URL('LICENSE.ez-tree.txt', directory), 'utf8'), /Copyright \(c\) 2024 Daniel Greenheck/);
});
