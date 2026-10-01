import test from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEON_LAYERS, makeDungeonCourse, setDungeonOpeningOpen } from '../playground/map/dungeon-course.js';
import { compileLayer, roomContainsCell } from '../playground/map/dungeon-compiler.js';
import { shortestPath, pathMetrics } from '../playground/map/grid.js';
import { canStand, castRay, newRun, tick } from '../engine.js';
import * as THREE from '../vendor/three.module.js';
import { buildDungeonCover } from '../dungeon-cover-kit.js';

function allOpen(course) {
  for (const opening of course.openings) setDungeonOpeningOpen(course, opening.id, true);
  return course;
}

function previousColonnade() {
  const layer = DUNGEON_LAYERS[3];
  return compileLayer({ ...layer, rooms: layer.rooms.map(room => room.id === 'f4-nave'
    ? { ...room, cover: [], coverPatterns: ['colonnade'] } : room) });
}

function routeMetrics(world, start, end) {
  const path = shortestPath(world.cells, world.w ?? world.width, world.h ?? world.height, start, end);
  assert.ok(path, 'the measured approach must be traversable');
  return pathMetrics(path);
}

test('actual choir stalls clear both nave lanes with identical geometry and render budgets', () => {
  const course = makeDungeonCourse(3), old = previousColonnade();
  const before = buildDungeonCover(new THREE.Group(), {}, {
    ...course, blocks: old.coverBlocks.map(block => [block.x, block.y]),
  });
  const after = buildDungeonCover(new THREE.Group(), {}, course);
  const lanes = [
    new THREE.Box3(new THREE.Vector3(68.72, .15, 54), new THREE.Vector3(71.28, 2.5, 78)),
    new THREE.Box3(new THREE.Vector3(54, .15, 64.72), new THREE.Vector3(82, 2.5, 67.28)),
  ];
  const conflicts = kit => {
    const hits = [[], []], matrix = new THREE.Matrix4();
    for (const mesh of kit.children) {
      mesh.geometry.computeBoundingBox();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
        lanes.forEach((lane, n) => { if (lane.intersectsBox(bounds)) hits[n].push(`${mesh.name}:${i}`); });
      }
    }
    return hits;
  };
  assert.equal(conflicts(before)[0].length, 8, 'previous center stalls obstruct the actual standing corridor');
  assert.deepEqual(conflicts(before)[1], []);
  assert.deepEqual(conflicts(after), [[], []]);
  assert.equal(after.children.length, before.children.length);
  for (let i = 0; i < before.children.length; i++) {
    const a = before.children[i], b = after.children[i];
    assert.equal(b.name, a.name); assert.equal(b.count, a.count);
    for (const key of Object.keys(a.geometry.attributes))
      assert.deepEqual(b.geometry.attributes[key].array, a.geometry.attributes[key].array);
    assert.deepEqual(b.geometry.index?.array, a.geometry.index?.array);
    assert.equal(b.material.color.getHex(), a.material.color.getHex());
    assert.equal(b.material.roughness, a.material.roughness);
    assert.equal(b.material.metalness, a.material.metalness);
    assert.equal(b.material.map, a.material.map);
  }
});

test('Bell Nave leaves a continuous player-width aisle and both arrival views clear with gates sealed or open', () => {
  const course = makeDungeonCourse(3), compiled = course.dungeonCompiled;
  const nave = course.rooms.find(room => room.id === 'f4-nave');
  const before = previousColonnade();
  assert.equal(canStand({ w: before.width, h: before.height, cells: before.sealedCells }, 17.5, 17.5, .32), false,
    'the previous column pair must reproduce the processional obstruction');
  assert.equal(canStand({ w: before.width, h: before.height, cells: before.cells }, 17.5, 14.5, .32), false);
  assert.equal(nave.sightlines.length, 3);

  const sealed = { ...course, cells: compiled.sealedCells };
  const initial = { ...course, cells: course.cells };
  for (const [state, world] of [['sealed', sealed], ['initial', initial], ['open', allOpen(course)]]) {
    // Sample between cell centres: a centre-only shortest path misses body clipping.
    for (let y = 12.5; y <= 19.5; y += .125) {
      assert.ok(canStand(world, 17.5, y, .32), `${state}: processional aisle blocked at ${y}`);
    }
    for (let x = 13.5; x <= 20.5; x += .125) {
      assert.ok(canStand(world, x, 16.5, .32), `${state}: cross-aisle blocked at ${x}`);
    }
    for (const line of nave.sightlines) {
      const [x, y] = line.from, [tx, ty] = line.to;
      assert.ok(roomContainsCell(nave, x, y), `${line.purpose}: viewing point stays in the nave`);
      assert.ok(canStand(world, x, y, .32), `${state}: ${line.purpose}: player body fits`);
      assert.ok(canStand(world, tx, ty, .32), `${state}: ${line.purpose}: destination fits`);
      const distance = Math.hypot(tx - x, ty - y);
      assert.ok(castRay(world, x, y, Math.atan2(ty - y, tx - x), distance + .01).dist >= distance,
        `${state}: ${line.purpose}: cover cannot hide the next decision`);
    }
  }
  for (let y = 11.5; y <= 12.5; y += .125) {
    assert.ok(canStand(course, 17.5, y, .32), `released court threshold blocked at ${y}`);
  }
});

test('flank columns remove the processional detour while retaining the cross-aisle and four cover blocks', () => {
  const before = previousColonnade(), course = allOpen(makeDungeonCourse(3));
  const nave = course.rooms.find(room => room.id === 'f4-nave');
  assert.equal(before.coverBlocks.filter(({ x, y }) => roomContainsCell(nave, x, y)).length, 4);
  assert.equal(course.blocks.filter(([x, y]) => roomContainsCell(nave, x, y)).length, 4);

  // Measure from the vestry throat to the court doorstep, including the approach
  // before the first column: a detour at each end creates four direction changes.
  const start = { x: 17.5, y: 19.5 }, end = { x: 17.5, y: 12.5 };
  for (const cellsKey of ['sealedCells', 'cells']) {
    const oldRoute = routeMetrics({ ...before, cells: before[cellsKey] }, start, end);
    const newRoute = routeMetrics({ ...course, cells: course.dungeonCompiled[cellsKey] }, start, end);
    assert.equal(oldRoute.meters, 36, `${cellsKey}: previous processional distance`);
    assert.equal(oldRoute.turns, 4, `${cellsKey}: previous processional turns`);
    assert.equal(newRoute.meters, 28, `${cellsKey}: direct processional distance`);
    assert.equal(newRoute.turns, 0, `${cellsKey}: direct processional turns`);
  }
  const west = { x: 13.5, y: 16.5 }, east = { x: 20.5, y: 16.5 };
  for (const world of [before, course]) {
    const lateral = routeMetrics(world, west, east);
    assert.equal(lateral.meters, 28);
    assert.equal(lateral.turns, 0);
  }
  // Both flank refuges still fit a body and reconnect to the central junction.
  for (const point of [{ x: 15.5, y: 17.5 }, { x: 18.5, y: 17.5 }]) {
    assert.ok(canStand(course, point.x, point.y, .32));
    assert.ok(shortestPath(course.cells, course.w, course.h, point, { x: 17.5, y: 16.5 }));
  }
});

test('Bell Nave layout preserves floor, shell, encounter and room topology budgets', () => {
  const before = previousColonnade(), after = makeDungeonCourse(3).dungeonCompiled;
  for (const metric of ['widthCells', 'heightCells', 'areaSqMeters', 'walkableCells', 'solidCells',
    'coverCells', 'wallSegments', 'rooms', 'corridors', 'corridorMeters', 'openings', 'lockedOpenings',
    'keys', 'secrets', 'enemyBudget', 'routeMeters', 'routeTurns', 'loops', 'gridCycles', 'roomEdges', 'roomNodes']) {
    assert.equal(after.metrics[metric], before.metrics[metric], `${metric}: retain the authored floor budget`);
  }
  for (const key of ['openings', 'corridors', 'keys', 'landmarks', 'machinery', 'setpieces', 'props', 'lights',
    'scares', 'spots', 'evidence', 'loot', 'connections']) {
    assert.deepEqual(after[key], before[key], `${key}: retain authored progression and presentation`);
  }
  assert.deepEqual(after.rooms.map(room => [room.id, room.rect, room.shape, room.encounter]),
    before.rooms.map(room => [room.id, room.rect, room.shape, room.encounter]));
  assert.equal(after.reach.size, before.reach.size, 'all-open connected floor area stays intact');
  assert.equal(after.sealedReach.size, before.sealedReach.size, 'sealed entry reach stays intact');
});

test('the clear court approach respects the encounter gate and required-combat descent check', () => {
  const course = makeDungeonCourse(3);
  const doorway = { x: 17.5, y: 12.5 }, insideCourt = { x: 17.5, y: 11.5 };
  assert.equal(course.openingState['f4-o-court-s'], false);
  assert.equal(castRay(course, doorway.x, doorway.y, -Math.PI / 2, 1.1).dist, .5,
    'the direct court threshold stays physically sealed');
  assert.ok(shortestPath(course.cells, course.w, course.h, doorway, insideCourt),
    'the repaired western return supplies a deliberate lateral approach');
  assert.equal(canStand(course, 17.5, 12, .32), false, 'the closed gate still blocks the player body');
  for (const opening of course.openings) if (opening.lockedBy !== 'key') {
    setDungeonOpeningOpen(course, opening.id, true);
  }
  assert.ok(shortestPath(course.cells, course.w, course.h, course.playerSpawn, course.keys[0]),
    'the Bell Key remains obtainable before its gate opens');
  assert.equal(course.openingState['f4-o-chancel-n'], false);
  const run = newRun(course);
  run.mode = 'play';
  run.x = course.exit.x;
  run.y = course.exit.y;
  tick(run, 1 / 60, {});
  assert.equal(run.dungeonProgression.exitReady, false);
  assert.equal(run.course.dungeonIndex, 3, 'reaching the descent cannot skip the key and required encounters');
  run.x = course.keys[0].x;
  run.y = course.keys[0].y;
  tick(run, 1 / 60, {});
  assert.ok(run.dungeonProgression.keysCollected.includes(course.keys[0].id));
  assert.ok(run.dungeonProgression.encounterPlan.some(node => !node.optional && node.status !== 'cleared'));
  assert.equal(run.dungeonProgression.exitReady, false, 'the Bell Key cannot complete unplayed combat beats');
});
