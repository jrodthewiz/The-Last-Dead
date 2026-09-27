import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { Renderer } from '../renderer.js';
import { makeDungeonCourse, setDungeonOpeningOpen, DUNGEON_LAYERS } from '../playground/map/dungeon-course.js';

const wallKey = wall => `${wall.horizontal ? 'h' : 'v'}:${wall.x}:${wall.z}`;
for (let floor = 0; floor < DUNGEON_LAYERS.length; floor++) {
  test(`floor ${floor + 1}: doors update existing instances, including reopening and closing`, () => {
    const course = makeDungeonCourse(floor);
    const renderer = Object.create(Renderer.prototype);
    renderer.worldRoot = new THREE.Group();
    renderer.materials = new Proxy({}, { get(target, key) { return target[key] ||= new THREE.MeshStandardMaterial(); } });
    renderer._buildWalls(course);
    const children = [...renderer.worldRoot.children];
    const buffers = children.map(mesh => mesh.instanceMatrix.array);
    const slots = new Set(course.wallSlots.map(wallKey));
    const matrix = new THREE.Matrix4();
    const verify = () => {
      const active = new Set(course.walls.map(wallKey));
      for (const key of active) assert.ok(slots.has(key), `missing wall slot ${key}`);
      for (const slot of renderer._dungeonWallInstances) {
        slot.pool.getMatrixAt(slot.index, matrix);
        assert.equal(slot.visible, active.has(slot.key));
        assert.equal(Math.abs(matrix.determinant()) > .01, active.has(slot.key), 'rendered wall matches collision wall');
      }
      assert.deepEqual(renderer.worldRoot.children, children);
      children.forEach((mesh, index) => assert.equal(mesh.instanceMatrix.array, buffers[index]));
    };
    verify();
    for (const opening of course.openings) {
      if (course.openingState[opening.id]) continue;
      const before = course.walls.length;
      setDungeonOpeningOpen(course, opening.id, true);
      renderer._syncDungeonWalls(course);
      assert.ok(course.walls.length <= before);
      verify();
      setDungeonOpeningOpen(course, opening.id, false);
      renderer._syncDungeonWalls(course);
      verify();
      setDungeonOpeningOpen(course, opening.id, true);
      renderer._syncDungeonWalls(course);
    }
    assert.deepEqual(new Set(course.permanentWalls.map(wallKey)), new Set(course.walls.map(wallKey)), 'permanent dressing uses walls that survive every opening');
  });
}
