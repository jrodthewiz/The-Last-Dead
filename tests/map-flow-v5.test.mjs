import test from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEON_LAYERS, makeDungeonCourse, setDungeonOpeningOpen } from '../playground/map/dungeon-course.js';
import { compileLayer, roomContainsCell } from '../playground/map/dungeon-compiler.js';
import { shortestPath, pathMetrics } from '../playground/map/grid.js';
import { canStand, castRay, newRun, tick } from '../engine.js';
import * as THREE from '../vendor/three.module.js';
import { buildWorldLifeKit } from '../world-polish.js';

function allOpen(course) {
  for (const opening of course.openings) setDungeonOpeningOpen(course, opening.id, true);
  return course;
}

function v4Colonnade() {
  const layer = DUNGEON_LAYERS[2];
  return compileLayer({ ...layer, rooms: layer.rooms.map(room => room.id === 'f3-hub'
    ? { ...room, cover: [], coverPatterns: ['colonnade'] } : room) });
}

test('catacomb crossing exposes its next decision from both authored arrivals', () => {
  const course = allOpen(makeDungeonCourse(2));
  const hub = course.rooms.find(room => room.id === 'f3-hub');
  assert.equal(hub.sightlines.length, 2);
  for (const line of hub.sightlines) {
    const [x, y] = line.from, [tx, ty] = line.to;
    assert.ok(roomContainsCell(hub, x, y), 'viewing point is inside the crossing');
    assert.ok(canStand(course, x, y, .32), `${line.purpose}: player body fits`);
    assert.ok(canStand(course, tx, ty, .32), `${line.purpose}: destination fits`);
    const distance = Math.hypot(tx - x, ty - y);
    assert.ok(castRay(course, x, y, Math.atan2(ty - y, tx - x), distance + .01).dist >= distance,
      `${line.purpose}: cover cannot hide the threshold or junction`);
  }
  // Test the entire body-width path, including samples between cell centres.
  // This is stronger than a centre-only BFS when cover touches an aisle.
  for (let y = 11.5; y <= 17.5; y += .125) {
    assert.ok(canStand(course, 19.5, y, .32), `processional aisle blocked at ${y}`);
  }
  for (let x = 19.5; x <= 23.5; x += .125) {
    assert.ok(canStand(course, x, 15.5, .32), `east arrival blocked at ${x}`);
  }
});

test('flank cover reduces local retracing within the existing topology and object budget', () => {
  const before = v4Colonnade(), course = allOpen(makeDungeonCourse(2));
  const after = course.dungeonCompiled, hub = course.rooms.find(room => room.id === 'f3-hub');
  assert.equal(course.blocks.filter(([x, y]) => roomContainsCell(hub, x, y)).length, 7);
  for (const key of ['walkableCells', 'coverCells', 'rooms', 'corridors', 'openings',
    'lockedOpenings', 'keys', 'enemyBudget', 'routeMeters']) {
    assert.equal(after.metrics[key], before.metrics[key], `${key}: retain the floor budget`);
  }
  assert.ok(after.metrics.wallSegments <= before.metrics.wallSegments);
  assert.deepEqual(after.openings, before.openings, 'all authored gate and portal data stays intact');
  assert.deepEqual(after.landmarks, before.landmarks, 'the rib stacks and hero anchors stay intact');

  const start = { x: 19.5, y: 17.5 }, end = { x: 19.5, y: 11.5 };
  const oldRoute = pathMetrics(shortestPath(before.cells, before.width, before.height, start, end));
  const newRoute = pathMetrics(shortestPath(course.cells, course.w, course.h, start, end));
  assert.equal(oldRoute.meters, 32);
  assert.equal(newRoute.meters, 24);
  assert.equal(newRoute.turns, 0);
  // Retain both flank refuges and a connected way back to the aisle.
  for (const point of [{ x: 18.5, y: 16.5 }, { x: 21.5, y: 16.5 }]) {
    assert.ok(canStand(course, point.x, point.y, .32));
    assert.ok(shortestPath(course.cells, course.w, course.h, point, start));
  }
});

test('clear colonnade cannot bypass the reliquary key or required encounter descent check', () => {
  const course = makeDungeonCourse(2);
  for (const opening of course.openings) if (opening.lockedBy !== 'key') {
    setDungeonOpeningOpen(course, opening.id, true);
  }
  assert.ok(shortestPath(course.cells, course.w, course.h, course.playerSpawn, course.keys[0]),
    'the key remains obtainable before opening its own gate');
  assert.equal(shortestPath(course.cells, course.w, course.h, course.playerSpawn, course.exit), null);
  assert.equal(course.openingState['f3-o-court-n'], false);

  const run = newRun(course);
  run.mode = 'play';
  run.x = course.keys[0].x;
  run.y = course.keys[0].y;
  tick(run, 1 / 60, {});
  assert.ok(run.dungeonProgression.encounterPlan.some(node => !node.optional && node.status !== 'cleared'));
  assert.equal(run.dungeonProgression.exitReady, false, 'taking the key cannot finish unplayed combat beats');
});

test('actual instanced floor-scatter bounds leave both crossing lanes clear without increasing the render budget', () => {
  const course = makeDungeonCourse(2);
  newRun(course);
  const sourceRoot = new THREE.Group(), fixedRoot = new THREE.Group();
  // Same deterministic recipe/field/seed, with only the F3 authored banking
  // disabled. The synthetic id is a test fixture, never a runtime course.
  const source = buildWorldLifeKit(sourceRoot, {}, { ...course, id: 'f3-unbanked-test' });
  const fixed = buildWorldLifeKit(fixedRoot, {}, course);
  assert.equal(fixedRoot.userData.worldLife.relocatedScatter.length, 5);
  assert.equal(fixedRoot.userData.worldLife.propCount, sourceRoot.userData.worldLife.propCount);
  assert.deepEqual(fixedRoot.userData.worldLife.counts, sourceRoot.userData.worldLife.counts);
  assert.equal(fixed.children.length, source.children.length);
  const lanes = [
    new THREE.Box3(new THREE.Vector3(76.72, .15, 46), new THREE.Vector3(79.28, 2, 70)),
    new THREE.Box3(new THREE.Vector3(78, .15, 60.72), new THREE.Vector3(94, 2, 63.28)),
  ];
  const conflicts = group => {
    const found = [], matrix = new THREE.Matrix4();
    for (const mesh of group.children) {
      mesh.geometry.computeBoundingBox();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
        if (lanes.some(lane => lane.intersectsBox(bounds))) found.push(`${mesh.name}:${i}`);
      }
    }
    return found;
  };
  assert.ok(conflicts(source).length >= 5, 'fixture must reproduce the visually obstructing scatter');
  assert.deepEqual(conflicts(fixed), [], 'whole transformed mesh bounds must clear the body/view corridor');
  for (let i = 0; i < source.children.length; i++) {
    const before = source.children[i], after = fixed.children[i];
    assert.equal(after.name, before.name);
    assert.equal(after.count, before.count);
    assert.equal(after.geometry, before.geometry, 'reuse the exact geometry object and triangle count');
    assert.equal(after.material.color.getHex(), before.material.color.getHex());
    assert.equal(after.material.roughness, before.material.roughness);
    assert.equal(after.material.metalness, before.material.metalness);
    for (let instance = 0; instance < before.count; instance++) {
      const offset = instance * 16;
      // Translation X/Z are the only permitted transform edits.
      for (let element = 0; element < 16; element++) if (element !== 12 && element !== 14) {
        assert.equal(after.instanceMatrix.array[offset + element], before.instanceMatrix.array[offset + element]);
      }
    }
  }
  for (const { to: [x, z] } of fixedRoot.userData.worldLife.relocatedScatter) {
    assert.ok(canStand(course, x / 4, z / 4, .16), 'flank placement cannot put its centre in solid room shell');
  }
});
