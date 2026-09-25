import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { createCampaignCourse } from '../campaign.js';
import { buildDungeonCover } from '../dungeon-cover-kit.js';
import { setDressingMaterials } from '../world-setdressing.js';

function materials() {
  const names = ['wornSteel', 'steel', 'metalDark', 'wall', 'floor', 'bone', 'afterlifeWood', 'black', 'flesh'];
  const result = Object.fromEntries(names.map(name => [name, new THREE.MeshStandardMaterial()]));
  for (const name of ['wornSteel', 'wall', 'afterlifeWood']) result[name].map = new THREE.Texture();
  return result;
}

test('every Story floor uses a distinct instanced cover model inside its original cover cells', () => {
  const signatures = new Set();
  for (let floor = 0; floor < 5; floor++) {
    const course = makeDungeonCourse(floor);
    const originalBlocks = JSON.stringify(course.blocks);
    const root = new THREE.Group();
    const kit = buildDungeonCover(root, materials(), course);
    assert.equal(root.children.includes(kit), true);
    assert.equal(JSON.stringify(course.blocks), originalBlocks, `${course.id}: course collision cells stay unchanged`);
    assert.equal(kit.userData.visualModel, 'authored-cover-v2');
    assert.equal(kit.userData.blocks, course.blocks.length);
    assert.ok(kit.children.length >= 4, `${course.id}: silhouette has separate material roles`);
    assert.ok(kit.children.every(mesh => mesh.isInstancedMesh && mesh.count === course.blocks.length));
    assert.ok(kit.children.every(mesh => mesh.geometry.attributes.normal && mesh.geometry.attributes.uv));
    for (const mesh of kit.children) {
      mesh.geometry.computeBoundingBox();
      const { min, max } = mesh.geometry.boundingBox;
      assert.ok(min.x >= -2.1 && max.x <= 2.1 && min.z >= -2.1 && max.z <= 2.1,
        `${course.id}: ${mesh.name} stays within the cover footprint`);
      assert.ok(min.y >= -.01 && max.y <= 3.3, `${course.id}: ${mesh.name} stays grounded`);
    }
    assert.ok(kit.getObjectByName('StoryCover_shell').material.map, `${course.id}: primary surface uses a loaded texture map`);
    if (floor === 0) {
      const normals = kit.getObjectByName('StoryCover_shell').geometry.attributes.normal;
      assert.ok(normals.getZ(0) < -.9, 'foundry hopper front face points outward and remains visible from the lane');
    }
    signatures.add(kit.children.map(mesh => mesh.geometry.attributes.position.count).join(','));
  }
  assert.equal(signatures.size, 5, 'all five floors have different model geometry');
});

test('large set dressing surfaces inherit the existing wood, steel and stone maps', () => {
  const source = materials();
  const props = setDressingMaterials(source, 'choir');
  assert.equal(props.wood.map, source.afterlifeWood.map);
  assert.equal(props.steel.map, source.wornSteel.map);
  assert.equal(props.metal.map, source.wornSteel.map);
  assert.equal(props.stone.map, source.wall.map);
  assert.notEqual(props.wood, source.afterlifeWood, 'prop finish can be tuned without recoloring other map surfaces');
});

test('campaign cover uses the same authored families without changing combat cells', () => {
  const expected = ['f1-intake-foundry', 'f3-catacombs', 'f4-resonance'];
  for (let sector = 0; sector < 3; sector++) {
    const course = createCampaignCourse(sector);
    const before = JSON.stringify(course.blocks);
    const kit = buildDungeonCover(new THREE.Group(), materials(), course);
    assert.equal(kit.name, 'CampaignCoverKit');
    assert.equal(kit.userData.modelFamily, expected[sector]);
    assert.equal(kit.userData.blocks, course.blocks.length);
    assert.equal(JSON.stringify(course.blocks), before);
    assert.ok(kit.children.every(mesh => mesh.isInstancedMesh && mesh.count === course.blocks.length));
  }
});
