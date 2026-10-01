import test from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEON_LAYERS, makeDungeonCourse, setDungeonOpeningOpen } from '../playground/map/dungeon-course.js';
import { compileLayer, roomContainsCell, validateProgression } from '../playground/map/dungeon-compiler.js';
import { shortestPath, pathMetrics } from '../playground/map/grid.js';
import { canStand, castRay } from '../engine.js';

const originalReturn = index => {
  const layer = DUNGEON_LAYERS[index];
  return compileLayer({
    ...layer,
    corridors: layer.corridors.map(corridor => corridor.id === 'f2-c-scrub'
      ? { ...corridor, points: [[23, 7], [24, 7]] }
      : corridor.id === 'f4-c-aisle-w-n'
        ? { ...corridor, points: [[9, 11], [11, 11]] } : corridor),
    openings: layer.openings.map(opening => opening.id === 'f2-o-scrub-w'
      ? { ...opening, at: 7 }
      : opening.id === 'f4-o-court-w' ? { ...opening, at: 11 }
        : opening.id === 'f4-o-aisleW-n' ? { ...opening, side: 'n' } : opening),
  });
};

function bodyClearPath(course, path) {
  for (let i = 0; i < path.length; i++) {
    const current = { x: path[i].x + .5, y: path[i].y + .5 };
    assert.ok(canStand(course, current.x, current.y, .32), `body fits ${current.x},${current.y}`);
    if (!i) continue;
    const previous = { x: path[i - 1].x + .5, y: path[i - 1].y + .5 };
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    for (let step = 0; step <= 8; step++) {
      const t = step / 8;
      assert.ok(canStand(course, previous.x + (current.x - previous.x) * t,
        previous.y + (current.y - previous.y) * t, .32), 'continuous body clearance through repaired return');
    }
    assert.ok(castRay(course, previous.x, previous.y,
      Math.atan2(current.y - previous.y, current.x - previous.x), distance + .01).dist >= distance,
    'the rendered/collision opening spans every route segment');
  }
}

test('scrub and tower returns save 200 metres without moving their keys or changing encounters', () => {
  let saved = 0;
  for (const [index, start, end, oldMeters, oldTurns, newMeters, newTurns] of [
    [1, { x: 27.5, y: 4.5 }, { x: 17.5, y: 7.5 }, 180, 18, 52, 3],
    [3, { x: 4.5, y: 4.5 }, { x: 16.5, y: 7.5 }, 148, 11, 76, 5],
  ]) {
    const before = originalReturn(index), after = compileLayer(DUNGEON_LAYERS[index]);
    const oldPath = shortestPath(before.cells, before.width, before.height, start, end);
    const newPath = shortestPath(after.cells, after.width, after.height, start, end);
    assert.deepEqual([pathMetrics(oldPath).meters, pathMetrics(oldPath).turns], [oldMeters, oldTurns]);
    assert.deepEqual([pathMetrics(newPath).meters, pathMetrics(newPath).turns], [newMeters, newTurns]);
    saved += oldMeters - newMeters;
    bodyClearPath({ cells: after.cells, w: after.width, h: after.height }, newPath);
    for (const key of ['rooms', 'corridors', 'openings', 'keys', 'enemyBudget', 'routeMeters']) {
      assert.equal(after.metrics[key], before.metrics[key], `${after.id}: retain ${key}`);
    }
    assert.deepEqual(after.keys, before.keys);
    assert.deepEqual(after.landmarks, before.landmarks);
    assert.deepEqual(validateProgression(DUNGEON_LAYERS[index], after).diagnostics, []);
  }
  assert.equal(saved, 200);
});

test('repaired thresholds land on their own room floor and preserve a body-width crossing', () => {
  for (const [index, ids] of [
    [1, ['f2-o-scrub-w']],
    [3, ['f4-o-aisleW-n', 'f4-o-court-w']],
  ]) {
    const course = makeDungeonCourse(index);
    for (const opening of course.openings) setDungeonOpeningOpen(course, opening.id, true);
    for (const id of ids) {
      const opening = course.openings.find(item => item.id === id);
      const room = course.rooms.find(item => item.id === opening.roomId);
      assert.equal(opening.widthCells, 1);
      for (const cell of opening.edgeCells) {
        assert.ok(roomContainsCell(room, cell.x + .5, cell.y + .5), `${id}: portal belongs to its room`);
      }
      const along = (opening.span[0] + opening.span[1] + 1) / 2;
      for (let offset = -.5; offset <= .5; offset += .125) {
        const x = opening.axis === 'h' ? along : opening.at + offset;
        const y = opening.axis === 'h' ? opening.at + offset : along;
        assert.ok(canStand(course, x, y, .32), `${id}: opening gives continuous body clearance`);
      }
    }
  }
});

test('every floor keeps its key reachable while the physical descent stays sealed without it', () => {
  for (let index = 0; index < DUNGEON_LAYERS.length; index++) {
    const course = makeDungeonCourse(index);
    for (const opening of course.openings) if (opening.lockedBy !== 'key') {
      setDungeonOpeningOpen(course, opening.id, true);
    }
    for (const key of course.keys) {
      assert.ok(shortestPath(course.cells, course.w, course.h, course.playerSpawn, key), `${course.id}: reachable key`);
    }
    assert.equal(shortestPath(course.cells, course.w, course.h, course.playerSpawn, course.exit), null,
      `${course.id}: an opposite-side arch cannot reopen the key gate`);
    for (const opening of course.openings.filter(item => item.lockedBy === 'key')) {
      const along = (opening.span[0] + opening.span[1] + 1) / 2;
      const x = opening.axis === 'h' ? along : opening.at - .35;
      const y = opening.axis === 'h' ? opening.at - .35 : along;
      const angle = opening.axis === 'h' ? Math.PI / 2 : 0;
      if (canStand(course, x, y, .1)) assert.ok(castRay(course, x, y, angle, .8).dist <= .351);
    }
    for (const key of course.keys) for (const opening of course.openings) {
      if (opening.keyId === key.id || key.opens.includes(opening.id)) {
        setDungeonOpeningOpen(course, opening.id, true);
      }
    }
    assert.ok(shortestPath(course.cells, course.w, course.h, course.playerSpawn, course.exit), `${course.id}: unlocked descent`);
    for (const room of course.rooms) {
      for (let y = room.bounds.minZ + .5; y < room.bounds.maxZ; y++) {
        for (let x = room.bounds.minX + .5; x < room.bounds.maxX; x++) {
          if (roomContainsCell(room, x, y) && canStand(course, x, y, .16)) {
            assert.ok(course.dungeonCompiled.reach.has(`${Math.floor(x)},${Math.floor(y)}`), `${room.id}: no isolated floor pocket`);
          }
        }
      }
    }
  }
});

test('old exit-side arches reproduce both shared-edge key bypasses', () => {
  for (const [index, counterpart] of [[3, 'f4-o-exit-s'], [4, 'f5-o-exit-s']]) {
    const layer = DUNGEON_LAYERS[index];
    const original = compileLayer({
      ...layer,
      openings: layer.openings.map(opening => opening.id === counterpart
        ? { ...opening, kind: 'arch', key: null, lockedBy: null } : opening),
    });
    const course = {
      ...makeDungeonCourse(index), dungeonCompiled: original, openings: original.openings,
      openingState: Object.fromEntries(original.openings.map(opening => [opening.id, false])),
    };
    for (const opening of course.openings) if (opening.lockedBy !== 'key') {
      setDungeonOpeningOpen(course, opening.id, true);
    }
    assert.ok(shortestPath(course.cells, course.w, course.h, course.playerSpawn, course.exit),
      `${course.id}: fixture must reproduce the previous physical key bypass`);
    const fixed = makeDungeonCourse(index);
    const counterpartOpening = fixed.openings.find(opening => opening.id === counterpart);
    assert.equal(counterpartOpening.kind, 'gate');
    assert.ok(fixed.keys.find(key => key.id === counterpartOpening.keyId).opens.includes(counterpart));
  }
});
