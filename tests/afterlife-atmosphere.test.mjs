import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { AfterlifeAtmosphere, CELL } from '../afterlife-atmosphere.js';

test('afterlife atmosphere is deterministic and bounded to authored rooms', () => {
  const course = makeDungeonCourse(4);
  const first = new AfterlifeAtmosphere(new THREE.Group(), course);
  const second = new AfterlifeAtmosphere(new THREE.Group(), course);
  const a = first.diagnostics();
  const b = second.diagnostics();

  assert.equal(CELL, 4);
  assert.equal(a.seed, b.seed);
  assert.equal(a.courseId, 'f5-last-descent');
  assert.ok(a.roomCount > 0);
  assert.ok(a.mistPatches > 0 && a.mistPatches <= 42);
  assert.ok(a.mistPatches < course.dungeonCompiled.metrics.walkableCells);
  assert.ok(a.drawCalls <= 3);
  assert.ok(a.practicalGlowPoints > 0 && a.practicalGlowPoints <= a.coldSources + 48);
  assert.equal(first.root.getObjectByName('AfterlifePracticalGlow')?.isPoints, true);
  const foundry = new AfterlifeAtmosphere(new THREE.Group(), makeDungeonCourse(0));
  const entry = foundry.course.lights.find(light => light.role === 'entry').anchor;
  const positions = foundry.root.getObjectByName('AfterlifePracticalGlow').geometry.getAttribute('position');
  assert.equal(Array.from({ length: positions.count }, (_, index) => index)
    .some(index => positions.getX(index) === entry[0] * CELL && positions.getZ(index) === entry[1] * CELL), false);
  assert.equal(a.beams, 0);
  assert.equal(a.noSceneFogMutation, true);
  assert.equal(a.noDynamicLights, true);

  first.dispose();
  second.dispose();
  foundry.dispose();
  assert.equal(first.diagnostics().disposed, true);
});

test('mobile and reduced-motion updates keep the contract stable', () => {
  const course = makeDungeonCourse(2);
  const parent = new THREE.Group();
  const atmosphere = new AfterlifeAtmosphere(parent, course, { mobile: true, reducedMotion: true });
  const before = atmosphere.diagnostics();
  atmosphere.update({ course }, 1500, new THREE.PerspectiveCamera(), { reducedMotion: true });
  const after = atmosphere.diagnostics();

  assert.ok(before.mistPatches <= 20);
  assert.ok(before.specks <= 24);
  assert.ok(before.practicalGlowPoints <= before.coldSources + 18);
  assert.ok(before.beams <= 2);
  assert.equal(after.reducedMotion, true);
  assert.equal(atmosphere.root.getObjectByName('AfterlifePracticalGlow')?.material.uniforms.uMotion.value, 0);
  assert.equal(parent.children.includes(atmosphere.root), true);
  atmosphere.dispose();
  assert.equal(parent.children.includes(atmosphere.root), false);
});

test('glow requires a modeled fixture style', () => {
  const course = {
    id: 'unadorned-room', w: 3, h: 3,
    rooms: [{ id: 'room', bounds: { minX: 0, minZ: 0, maxX: 3, maxZ: 3 } }],
    lights: [{ anchor: [1, 1], intensity: 2, role: 'entry' }],
  };
  const atmosphere = new AfterlifeAtmosphere(new THREE.Group(), course);
  assert.equal(atmosphere.diagnostics().practicalGlowPoints, 0);
  assert.equal(atmosphere.root.getObjectByName('AfterlifePracticalGlow'), undefined);
  atmosphere.dispose();
});
