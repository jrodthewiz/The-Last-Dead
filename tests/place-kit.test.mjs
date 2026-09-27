import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { buildDungeonPlaceKit } from '../dungeon-place-kit.js';

function materials() {
  const wall = new THREE.MeshStandardMaterial();
  const wornSteel = new THREE.MeshStandardMaterial();
  wall.map = new THREE.Texture();
  wornSteel.map = new THREE.Texture();
  return {
    wall, wornSteel,
    steel: wornSteel,
    metalDark: wornSteel,
    black: new THREE.MeshStandardMaterial(),
    glass: new THREE.MeshPhysicalMaterial({ transparent: true, opacity: .85 }),
  };
}

test('crypt panels use an open stone arch and mapped surfaces', () => {
  const source = materials();
  const course = makeDungeonCourse(2);
  const root = new THREE.Group();
  const kit = buildDungeonPlaceKit(root, source, course);
  const arch = kit.getObjectByName('DungeonPlace_bone_arch');
  assert.ok(arch?.isInstancedMesh);
  assert.ok(arch.count > 0);
  assert.equal(arch.material.map, source.wall.map);
  assert.ok(arch.geometry.attributes.uv && arch.geometry.attributes.normal);
  const sample = new THREE.Mesh(arch.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = x => new THREE.Raycaster(new THREE.Vector3(x, 0, 2), new THREE.Vector3(0, 0, -1)).intersectObject(sample);
  assert.equal(ray(0).length, 0, 'the niche center stays open');
  assert.ok(ray(.44).length > 0, 'the arch has a solid jamb');
});

test('graft wall panels inherit the plaster map while metal details retain worn steel', () => {
  const source = materials();
  const kit = buildDungeonPlaceKit(new THREE.Group(), source, makeDungeonCourse(1));
  assert.equal(kit.getObjectByName('DungeonPlace_pale_box').material.map, source.wall.map);
  assert.equal(kit.getObjectByName('DungeonPlace_trim_box').material.map, source.wornSteel.map);
  assert.equal(kit.getObjectByName('DungeonPlace_ceiling_box').material.map, source.wall.map);
});
