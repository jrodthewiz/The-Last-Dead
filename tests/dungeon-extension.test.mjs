import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDungeonCourse, setDungeonOpeningOpen, DUNGEON_LAYERS } from '../playground/map/dungeon-course.js';
import { DUNGEON_ROUTES } from '../playground/map/dungeon-data.js';
import { shortestPath, pathMetrics } from '../playground/map/grid.js';
import { reachableCells } from '../campaign.js';
import { validateProgression, roomContainsCell } from '../playground/map/dungeon-compiler.js';
import { newRun, tick, canStand, angleDiff } from '../engine.js';
import { upgradeWeapon, WEAPON_FITTING } from '../scavenger-pack.js';

function clearEncounterFixture(run) {
  const progress = run.dungeonProgression;
  progress.currentEncounter = null;
  progress.encounterPlan.forEach(node => node.status = 'cleared');
  progress.nextEncounterIndex = progress.encounterPlan.length;
  run.course.enemies = [];
  for (const opening of run.course.openings) {
    if (opening.lockedBy === 'room-clear') setDungeonOpeningOpen(run.course, opening.id);
  }
  tick(run, 1 / 60, {});
}

function walkWithInput(run, target, visited) {
  const course = run.course;
  const path = shortestPath(course.cells, course.w, course.h, run, target);
  assert.ok(path, `${course.id}: a real collision path reaches ${target.id || 'exit'}`);
  const points = [...path.slice(1).map(point => ({ x: point.x + .5, y: point.y + .5 })), target];
  for (const point of points) {
    let frames = 0;
    while (Math.hypot(run.x - point.x, run.y - point.y) > .13) {
      const turn = angleDiff(Math.atan2(point.y - run.y, point.x - run.x), run.angle);
      tick(run, 1 / 60, Math.abs(turn) > .035 ? { turn: Math.sign(turn) } : { forward: 1 });
      for (const enemy of run.course.enemies) enemy.dead = true;
      if (run.y < course.extension.annexBounds.maxZ) visited.annex = true;
      if (run.course !== course || run.mode === 'win') return;
      assert.ok(canStand(course, run.x, run.y, .1));
      assert.ok(++frames < 720, `${course.id}: forward input reached the next path point`);
    }
  }
  for (let frame = 0; frame < 18; frame++) tick(run, 1 / 60, {});
}

test('the deterministic annex doubles the traversable route and shares the collision grid on every floor', () => {
  for (let floor = 0; floor < DUNGEON_LAYERS.length; floor++) {
    const course = makeDungeonCourse(floor, { extended: true, journey: true });
    const before = makeDungeonCourse(floor, { journey: true });
    const { extension } = course;
    assert.ok(extension.routeRatio >= 2 && extension.routeRatio <= 2.4,
      `${course.id}: expected approximately twice the route, measured ${extension.routeRatio}`);
    assert.equal(course.rooms.length, before.rooms.length * 2);
    assert.deepEqual(course.route.slice(0, before.route.length), DUNGEON_ROUTES[floor]);
    assert.deepEqual(course.route.slice(before.route.length), before.route.map(id => `annex-${id}`));
    assert.deepEqual(course.keys.map(item => item.id), before.keys.map(item => item.id));
    assert.deepEqual(course.evidence.map(item => item.id), before.evidence.map(item => item.id));
    assert.deepEqual(course.journeyStations.map(item => item.id), before.journeyStations.map(item => item.id));
    if (floor === 4) {
      const shutdown = course.journeyStations[0];
      assert.equal(shutdown.roomId, 'annex-f5-hall3');
      assert.ok(roomContainsCell(course.rooms.find(room => room.id === shutdown.roomId), shutdown.x, shutdown.y));
      assert.ok(canStand(course, shutdown.x, shutdown.y, .18));
    }
    assert.ok(course.rooms.every(room => room.reachable), `${course.id}: every generated room is reachable`);
    const progression = validateProgression(course.dungeonCompiled, course.dungeonCompiled);
    assert.equal(progression.exitReachable, true);
    assert.deepEqual(progression.diagnostics.filter(item => item.severity === 'error'), []);
    for (const opening of course.openings) setDungeonOpeningOpen(course, opening.id);
    const path = shortestPath(course.cells, course.w, course.h, course.playerSpawn, course.exit);
    assert.ok(path);
    assert.equal(pathMetrics(path).meters, extension.routeMeters);
    for (const point of path) assert.ok(canStand(course, point.x + .5, point.y + .5, .18));
    assert.ok(path.some(point => point.y < extension.annexBounds.maxZ));
    // One owner per floor cell and one rendered face per boundary; a reflected
    // model does not add an overlapping second floor or coplanar wall face.
    assert.equal(course.cells.length, course.w * course.h);
    const walls = course.wallSlots.map(wall => `${wall.horizontal ? 'h' : 'v'}:${wall.x}:${wall.z}`);
    assert.equal(new Set(walls).size, walls.length);
    assert.deepEqual(makeDungeonCourse(floor, { extended: true }).extension, extension);
  }
});

test('annex fights have room-owned spawns and the final descent remains after the added route', () => {
  for (let floor = 0; floor < DUNGEON_LAYERS.length; floor++) {
    const course = makeDungeonCourse(floor, { extended: true });
    const run = newRun(course);
    const required = run.dungeonProgression.encounterPlan.filter(node => !node.optional);
    const annexRequired = required.filter(node => node.roomId.startsWith('annex-'));
    assert.ok(annexRequired.length >= 5);
    assert.ok(required.slice(-annexRequired.length).every(node => node.roomId.startsWith('annex-')));
    assert.equal(run.dungeonProgression.exitReady, false);
    assert.ok(roomContainsCell(course.rooms.find(room => room.id === course.route.at(-1)), course.exit.x, course.exit.y));
    for (const node of annexRequired) {
      const room = course.rooms.find(item => item.id === node.roomId);
      assert.ok(room.encounter.budget > 0);
      assert.ok(room.encounter.maxAlive <= 4);
      for (const spawn of node.spawns) {
        assert.ok(roomContainsCell(room, spawn.x, spawn.y), `${node.roomId}: marker escaped its owner`);
        assert.ok(course.dungeonCompiled.reach.has(`${Math.floor(spawn.x)},${Math.floor(spawn.y)}`));
      }
    }
    for (const key of course.keys) {
      assert.ok(key.opens.some(id => id.startsWith('annex-')));
      assert.ok(key.opens.every(id => course.openings.some(opening => opening.id === id)));
    }
  }
});

test('the original key opens the real annex approach through gameplay and does not finish the floor', () => {
  const course = makeDungeonCourse(0, { extended: true });
  const run = newRun(course);
  run.mode = 'play';
  run.health = 1e9;
  // Isolate the physical threshold/pickup check from combat timing. Required
  // annex encounters remain pending, which must continue to block the exit.
  for (const opening of course.openings) if (opening.lockedBy === 'room-clear') setDungeonOpeningOpen(course, opening.id);
  const key = course.keys[0];
  const annexEntry = course.rooms.find(room => room.id === 'annex-f1-entry');
  const entryPoint = { x: annexEntry.center.x, y: annexEntry.center.y };
  assert.equal(shortestPath(course.cells, course.w, course.h, run, entryPoint), null);
  assert.ok(shortestPath(course.cells, course.w, course.h, run, key));
  Object.assign(run, { x: key.x, y: key.y });
  tick(run, 1 / 60, {});
  assert.ok(run.dungeonProgression.keysCollected.includes(key.id));
  assert.ok(key.opens.every(id => course.openingState[id]));
  const reach = reachableCells(course.cells, course.w, course.h, run);
  assert.ok(reach.has(`${Math.floor(entryPoint.x)},${Math.floor(entryPoint.y)}`));
  assert.equal(run.dungeonProgression.exitReady, false);
  assert.equal(run.course, course);
});

test('all five extended floors support actual movement, key proximity, held signatures, persistent fittings and the final exit', () => {
  const run = newRun(makeDungeonCourse(0, { extended: true, journey: true }));
  run.mode = 'play';
  run.health = 1e9;
  const pack = run.backpack;
  let firstCacheId;
  for (let floor = 0; floor < 5; floor++) {
    const course = run.course, visited = { annex: false };
    assert.equal(course.dungeonIndex, floor);
    assert.equal(course.extended, true);
    clearEncounterFixture(run);
    assert.equal(run.dungeonProgression.exitReady, false);
    if (floor === 0) {
      const caches = course.scavengerPickups.filter(item => !item.roomId.startsWith('annex-')
        && shortestPath(course.cells, course.w, course.h, run, item)).slice(0, 2);
      assert.equal(caches.length, 2);
      for (const cache of caches) {
        walkWithInput(run, cache, visited);
        assert.ok(pack.collected.includes(cache.id), 'forward movement collects scrap by proximity');
      }
      firstCacheId = caches[0].id;
      assert.equal(upgradeWeapon(run, 0).ok, true);
    }
    for (const key of course.keys) {
      walkWithInput(run, key, visited);
      assert.ok(run.dungeonProgression.keysCollected.includes(key.id));
      assert.ok(run.events.some(event => event.type === 'dungeon-key' && event.keyId === key.id));
    }
    if (floor === 4) assert.equal(run.journey.target.roomId, 'annex-f5-hall3');
    while (run.journey.target) {
      const station = run.journey.target;
      walkWithInput(run, station, visited);
      const previousStep = run.journey.step;
      for (let frame = 0; frame < 66; frame++) tick(run, 1 / 60, { interact: true });
      assert.ok(run.journey.step > previousStep, `${station.id}: held interaction advances its signature`);
    }
    if (floor === 4) {
      assert.equal(run.journey.phase, 'shutdown');
      assert.equal(run.dungeonProgression.exitReady, false);
    }
    for (let frame = 0; frame < 306; frame++) tick(run, 1 / 60, {});
    assert.equal(run.journey.phase, 'complete');
    assert.equal(run.dungeonProgression.exitReady, true);
    assert.equal(run.mode, 'play', 'the signature cannot win or descend before reaching the exit');
    walkWithInput(run, course.exit, visited);
    assert.equal(visited.annex, true, `${course.id}: the live input route traversed the added wing`);
    assert.equal(run.backpack, pack);
    assert.ok(pack.collected.includes(firstCacheId));
    assert.equal(pack.weaponMods[0], WEAPON_FITTING.id);
    if (floor < 4) {
      assert.equal(run.course.dungeonIndex, floor + 1);
      assert.equal(run.course.extended, true);
      assert.equal(run.mode, 'play');
    }
  }
  assert.equal(run.mode, 'win');
  assert.equal(run.journey.completed.length, 5);
  assert.equal(run.dungeonProgression.floorsCleared, 5);
});
