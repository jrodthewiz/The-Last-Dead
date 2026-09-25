// Guards the map playground data: the story dungeon must always compile into
// reachable, keyed, dressed floors, and the arena sectors must keep building.
import test from 'node:test';
import assert from 'node:assert/strict';

import { DUNGEON_LAYERS } from '../playground/map/dungeon-data.js';
import { compileLayer, validateProgression, layerDiagnostics } from '../playground/map/dungeon-compiler.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { angleDiff, canStand, makeCampaignCourse, newRun, shoot, switchWeapon, nextOwnedWeapon, tick } from '../engine.js';
import { reachableCells } from '../campaign.js';
import { setDungeonOpeningOpen } from '../playground/map/dungeon-course.js';
import { roomProgression } from '../ui.js';
import { shortestPath } from '../playground/map/grid.js';
import { planDungeonPlaceKit } from '../dungeon-place-kit.js';
import {
  buildCampaignScene,
  buildDungeonOverview,
  buildDungeonScene,
  buildSectorScene,
  dungeonSummary,
} from '../playground/map/map-model.js';

const CELL_STEPS = [
  { dx: 0, dy: -1, wall: 0, opposite: 2 },
  { dx: 1, dy: 0, wall: 1, opposite: 3 },
  { dx: 0, dy: 1, wall: 2, opposite: 0 },
  { dx: -1, dy: 0, wall: 3, opposite: 1 },
];

function routeThroughWalkableCells(course, start, target) {
  const startCell = { x: Math.floor(start.x), y: Math.floor(start.y) };
  const targetCell = { x: Math.floor(target.x), y: Math.floor(target.y) };
  const key = ({ x, y }) => `${x},${y}`;
  const visited = new Map([[key(startCell), null]]);
  const queue = [startCell];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    if (cell.x === targetCell.x && cell.y === targetCell.y) break;
    const edges = course.cells[cell.y * course.w + cell.x];
    for (const step of CELL_STEPS) {
      const next = { x: cell.x + step.dx, y: cell.y + step.dy };
      if (next.x < 0 || next.y < 0 || next.x >= course.w || next.y >= course.h) continue;
      const nextEdges = course.cells[next.y * course.w + next.x];
      if (edges[step.wall] || nextEdges[step.opposite]) continue;
      if (!canStand(course, next.x + .5, next.y + .5, .1)) continue;
      if (visited.has(key(next))) continue;
      visited.set(key(next), cell);
      queue.push(next);
    }
  }

  assert.ok(visited.has(key(targetCell)), `${course.name}: collision cells must connect entry to ${target.x},${target.y}`);
  const cells = [];
  for (let cell = targetCell; cell; cell = visited.get(key(cell))) cells.push(cell);
  return cells.reverse();
}

function walkToDungeonPoint(run, target, label, { allowFloorTransition = false } = {}) {
  const originalCourse = run.course;
  const route = routeThroughWalkableCells(originalCourse, run, target);
  const waypoints = route.slice(1).map(cell => ({ x: cell.x + .5, y: cell.y + .5 }));
  waypoints.push(target);
  let frameCount = 0;

  for (const waypoint of waypoints) {
    let waypointFrames = 0;
    while (Math.hypot(waypoint.x - run.x, waypoint.y - run.y) > .16) {
      const dx = waypoint.x - run.x;
      const dy = waypoint.y - run.y;
      const heading = Math.atan2(dy, dx);
      const turn = angleDiff(heading, run.angle);
      const input = Math.abs(turn) > .035 ? { turn: Math.sign(turn) } : { forward: 1 };
      tick(run, 1 / 60, input);
      frameCount += 1;
      waypointFrames += 1;

      if (run.course !== originalCourse || run.mode === 'win') {
        assert.equal(allowFloorTransition, true, `${label}: route changed floors before reaching its destination`);
        return { transitioned: run.course !== originalCourse, won: run.mode === 'win', frameCount };
      }
      assert.ok(canStand(originalCourse, run.x, run.y, .1), `${label}: live movement left walkable collision cells`);
      assert.ok(run.health > 0, `${label}: route check should not kill the player`);
      assert.ok(waypointFrames < 720, `${label}: player stalled before waypoint ${waypoint.x},${waypoint.y} at ${run.x.toFixed(3)},${run.y.toFixed(3)} (speed ${run.speed.toFixed(3)}, mode ${run.mode})`);
      assert.ok(frameCount < 30000, `${label}: route exceeded its movement frame budget`);
    }
  }

  return { transitioned: false, frameCount };
}

function clearDungeonWavesThroughEngine(run) {
  const course = run.course;
  for (let waveIndex = 0; waveIndex < course.waveCount; waveIndex += 1) {
    const priorCount = course.enemies.length;
    run.waveDelay = 0;
    tick(run, 1 / 60, {});
    assert.equal(run.wave, waveIndex + 1, `${course.name}: live progression should start wave ${waveIndex + 1}`);
    const spawned = course.enemies.slice(priorCount);
    assert.equal(spawned.length, course.waveSpawns[waveIndex].length, `${course.name}: every scheduled enemy should appear in its engine wave`);
    for (const spawn of course.waveSpawns[waveIndex]) {
      assert.ok(spawned.some(enemy => enemy.variant === spawn.variant && enemy.x === spawn.x && enemy.y === spawn.y), `${course.name}/${spawn.id}: the authored enemy should spawn at its resolved cell`);
    }

    // Keep this route QA deterministic: validate each live wave, then clear it
    // so the engine's normal progression logic can release the next gates.
    for (const enemy of spawned) enemy.dead = true;
    run.waveDelay = 2;
    tick(run, 1 / 60, {});
  }
  assert.ok(course.openings.filter(opening => opening.lockedBy === 'room-clear').every(opening => course.openingState[opening.id]), `${course.name}: cleared engine waves should open all scheduled encounter gates`);
}

test('every story floor compiles into a sealed-until-opened, reachable level', () => {
  assert.ok(DUNGEON_LAYERS.length >= 5, 'story mode keeps at least five floors');
  for (const layer of DUNGEON_LAYERS) {
    const compiled = compileLayer(layer);
    const progression = validateProgression(layer, compiled);
    const diagnostics = [...layerDiagnostics(layer, compiled), ...progression.diagnostics];
    const errors = diagnostics.filter(item => item.severity === 'error');
    assert.deepEqual(errors, [], `${layer.id} has design errors: ${errors.map(item => item.code).join(', ')}`);
    assert.ok(compiled.rooms.length >= 8, `${layer.id} keeps a full room count`);
    assert.ok(compiled.metrics.routeMeters >= 80, `${layer.id} route is long enough to explore`);
    assert.ok(progression.exitReachable, `${layer.id} exit is reachable after its keys`);
    assert.ok(compiled.reach.size > 0, `${layer.id} carves walkable floor`);
    for (const room of compiled.rooms) {
      assert.ok(room.reachable, `${layer.id}/${room.id} must be reachable`);
      assert.ok(room.openings.length > 0, `${layer.id}/${room.id} must have an authored opening`);
    }
    for (const opening of compiled.openings) {
      const outer = opening.outerCells[Math.floor(opening.outerCells.length / 2)];
      assert.ok(outer, `${layer.id}/${opening.id} needs outer cells`);
      assert.ok(compiled.reach.has(`${outer.x},${outer.y}`), `${layer.id}/${opening.id} must reach walkable floor`);
    }
  }
});

test('story floors stay long, looped, keyed and dressed', () => {
  const summary = dungeonSummary();
  assert.equal(summary.layers, DUNGEON_LAYERS.length);
  assert.ok(summary.routeMeters >= 400, `campaign route should be long (got ${summary.routeMeters} m)`);
  assert.ok(summary.corridors >= 40, 'story mode keeps a corridor network');
  assert.ok(summary.openings >= 90, 'story mode keeps authored thresholds');
  assert.ok(summary.keys === DUNGEON_LAYERS.length, 'each floor carries one progression key');
  assert.ok(summary.secrets === DUNGEON_LAYERS.length, 'each floor hides one secret');
  for (const layer of DUNGEON_LAYERS) {
    assert.ok(layer.props?.length >= 5, `${layer.id} needs dressing clusters`);
    assert.ok(layer.scares?.length >= 5, `${layer.id} needs authored scare beats`);
    assert.ok(layer.setpieces?.length >= 4, `${layer.id} needs structural setpieces`);
    assert.ok(layer.lights?.length >= 8, `${layer.id} needs lighting cues`);
    const compiled = compileLayer(layer);
    assert.ok(compiled.metrics.loops >= 2, `${layer.id} should loop back on itself (got ${compiled.metrics.loops})`);
  }
});

test('side district arrivals create distinct journeys through each main hall', () => {
  for (const [index, minimum] of [[0, 24], [1, 18], [2, 35], [3, 18]]) {
    const course = makeDungeonCourse(index);
    const hub = course.rooms.find(room => room.kind === 'hub');
    const path = shortestPath(course.cells, course.w, course.h,
      { x: course.playerSpawn.x, y: course.playerSpawn.y },
      { x: hub.center.x, y: hub.center.y });
    assert.ok(path?.length >= minimum, `${course.name} must approach the hub through its side district`);
  }
});

test('Resonance side aisles cannot bypass the sealed choir court', () => {
  const course = makeDungeonCourse(3);
  const courtDoors = course.openings.filter(opening => opening.roomId === 'f4-court'
    && ['s', 'w', 'e'].includes(opening.side));
  assert.equal(courtDoors.length, 3);
  assert.ok(courtDoors.every(opening => opening.kind === 'door' && opening.lockedBy === 'room-clear'));
  const court = course.rooms.find(room => room.id === 'f4-court');
  const insideCourt = cells => [...cells].some(key => {
    const [x, z] = key.split(',').map(Number);
    return x >= court.bounds.minX && x < court.bounds.maxX
      && z >= court.bounds.minZ && z < court.bounds.maxZ;
  });
  assert.equal(insideCourt(reachableCells(course.cells, course.w, course.h, course.playerSpawn)), false);
  for (const opening of courtDoors) setDungeonOpeningOpen(course, opening.id, true);
  assert.equal(insideCourt(reachableCells(course.cells, course.w, course.h, course.playerSpawn)), true);
});

test('Story weapon finds unlock a persistent arsenal while arena weapons remain available', () => {
  const run = newRun(makeDungeonCourse(0));
  run.mode = 'play';
  run.waveDelay = 999;
  assert.deepEqual(run.ownedWeapons, [0]);
  assert.equal(switchWeapon(run, 1), false, 'unfound shotgun cannot be selected');
  assert.equal(nextOwnedWeapon(run, 1), 0, 'cycling skips locked weapons');
  const shotgun = run.course.loot.find(item => item.weaponIndex === 1);
  walkToDungeonPoint(run, shotgun, 'receiving dock to shotgun');
  assert.ok(run.dungeonProgression.lootCollected.includes(shotgun.id));
  assert.ok(run.ownedWeapons.includes(1));
  assert.equal(run.weapon, 1, 'finding a weapon equips it');
  assert.equal(nextOwnedWeapon(run, 1), 0, 'cycling wraps across only owned slots');

  for (const item of run.course.loot.filter(item => item.id !== shotgun.id)) {
    run.x = item.x; run.y = item.y;
    tick(run, 1 / 60, {});
  }
  const ownedBeforeDescent = [...run.ownedWeapons];
  clearDungeonWavesThroughEngine(run);
  walkToDungeonPoint(run, run.course.keys[0], 'foundry loot-to-key');
  walkToDungeonPoint(run, run.course.exit, 'foundry loot-to-lift', { allowFloorTransition: true });
  assert.equal(run.course.dungeonIndex, 1);
  assert.deepEqual(run.ownedWeapons, ownedBeforeDescent, 'found weapons survive floor transitions');
  assert.deepEqual(run.dungeonProgression.lootCollected, [], 'only floor pickup state resets');

  for (let index = 0; index < DUNGEON_LAYERS.length; index++) {
    const course = makeDungeonCourse(index);
    const pickupRun = newRun(course);
    pickupRun.mode = 'play';
    pickupRun.waveDelay = 999;
    const reserved = new Set(course.blocks.map(([x, z]) => `${x},${z}`));
    for (const item of course.loot) {
      assert.ok(canStand(course, item.x, item.y, .1), `${item.id} is collectable`);
      assert.equal(reserved.has(`${Math.floor(item.x)},${Math.floor(item.y)}`), false, `${item.id} clears cover and other pickups`);
      reserved.add(`${Math.floor(item.x)},${Math.floor(item.y)}`);
      assert.ok(course.rooms.some(room => room.id === item.roomId && item.x >= room.bounds.minX && item.x < room.bounds.maxX && item.y >= room.bounds.minZ && item.y < room.bounds.maxZ));
      pickupRun.x = item.x; pickupRun.y = item.y;
      tick(pickupRun, 1 / 60, {});
      assert.ok(pickupRun.ownedWeapons.includes(item.weaponIndex), `${item.id} unlocks its actual weapon`);
      assert.ok(pickupRun.dungeonProgression.lootCollected.includes(item.id), `${item.id} is recorded on its floor`);
      assert.equal(pickupRun.weapon, item.weaponIndex, `${item.id} equips the find`);
    }
  }
  const arena = newRun(makeCampaignCourse(0));
  assert.equal(arena.ownedWeapons.length, 8, 'arena keeps its full loadout');
  assert.equal(switchWeapon(arena, 7), true);
});

test('optional records live in distinct reachable rooms and survive the descent', () => {
  let total = 0;
  for (let index = 0; index < DUNGEON_LAYERS.length; index++) {
    const course = makeDungeonCourse(index);
    const run = newRun(course);
    run.mode = 'play';run.waveDelay = 999;
    const reserved = new Set([...course.blocks.map(([x, z]) => `${x},${z}`),
      ...course.keys.map(item => `${Math.floor(item.x)},${Math.floor(item.y)}`),
      ...course.loot.map(item => `${Math.floor(item.x)},${Math.floor(item.y)}`)]);
    assert.ok(course.evidence.length >= 1, `${course.name} has a discoverable story record`);
    for (const item of course.evidence) {
      total++;
      const cell = `${Math.floor(item.x)},${Math.floor(item.y)}`;
      assert.ok(canStand(course, item.x, item.y, .1), `${item.id} can be reached`);
      assert.equal(reserved.has(cell), false, `${item.id} has its own pickup cell`);
      reserved.add(cell);
      assert.ok(course.rooms.some(room => room.id === item.roomId
        && item.x >= room.bounds.minX && item.x < room.bounds.maxX
        && item.y >= room.bounds.minZ && item.y < room.bounds.maxZ));
      run.x = item.x;run.y = item.y;
      tick(run, 1 / 60, {});
      assert.ok(run.storyRecords.some(record => record.id === item.id && record.text === item.text));
      assert.ok(run.events.some(event => event.type === 'dungeon-evidence' && event.evidenceId === item.id));
      const count = run.storyRecords.length;
      tick(run, 1 / 60, {});
      assert.equal(run.storyRecords.length, count, `${item.id} is archived once`);
    }
    assert.equal(buildDungeonScene(index).evidence.length, course.evidence.length, 'map playground marks every record');
  }
  const run = newRun(makeDungeonCourse(0));run.mode = 'play';run.waveDelay = 999;
  const record = run.course.evidence[0];run.x = record.x;run.y = record.y;tick(run, 1 / 60, {});
  clearDungeonWavesThroughEngine(run);
  const key = run.course.keys[0];run.x = key.x;run.y = key.y;tick(run, 1 / 60, {});
  assert.ok(run.storyRecords.some(item => item.id === key.id && item.kind === 'key'), 'key clues stay in the archive');
  run.x = run.course.exit.x;run.y = run.course.exit.y;tick(run, 1 / 60, {});
  assert.equal(run.course.dungeonIndex, 1);
  assert.ok(run.storyRecords.some(item => item.id === record.id), 'optional discovery survives the lift');
  assert.equal(run.course.evidenceTotal, total);
});

test('Story architecture follows real walkable cells and leaves encounter courts open above', () => {
  for (let index = 0; index < DUNGEON_LAYERS.length; index++) {
    const course = makeDungeonCourse(index);
    const plan = planDungeonPlaceKit(course);
    const cover = new Set(course.blocks.map(([x, z]) => `${x},${z}`));
    assert.ok(plan.ceilings.length >= 100, `${course.name} needs a roof over its passages`);
    assert.ok(plan.ceilings.every(cell => course.dungeonCompiled.reach.has(`${cell.x},${cell.z}`)
      && !cover.has(`${cell.x},${cell.z}`)), `${course.name} ceiling must follow reachable floor, clear of cover`);
    assert.ok(plan.ceilings.every(cell => !course.rooms.some(room => room.kind === 'arena'
      && cell.x >= room.bounds.minX && cell.x < room.bounds.maxX
      && cell.z >= room.bounds.minZ && cell.z < room.bounds.maxZ)),
    `${course.name} encounter courts need a scale change`);
    if (index < 4) assert.ok(plan.walls.length >= 20, `${course.name} needs functional wall architecture`);
  }
});

test('playground scenes expose the dungeon for the browser renderer', () => {
  for (let index = 0; index < DUNGEON_LAYERS.length; index += 1) {
    const scene = buildDungeonScene(index);
    assert.equal(scene.kind, 'dungeon');
    assert.equal(scene.depth, index + 1);
    assert.ok(scene.rooms.length >= 8);
    assert.ok(scene.corridors.length >= 6);
    assert.ok(scene.openings.length >= 12);
    assert.ok(scene.props.length >= 30, `${scene.id} should ship gore/dressing marks`);
    assert.equal(scene.loot.length, makeDungeonCourse(index).loot.length, `${scene.id} playground should show live weapon finds`);
    assert.ok(scene.scares.length >= 5);
    assert.ok(scene.setpieces.length >= 4);
    assert.ok(scene.path.designed.length >= 10, `${scene.id} needs a drawable route trace`);
    assert.ok(scene.walls.length > 100, `${scene.id} needs carved boundaries`);
    assert.ok(scene.blocks.length < scene.width * scene.height * 0.2, `${scene.id} cover stays readable`);
  }
  const stack = buildDungeonOverview();
  assert.equal(stack.kind, 'dungeon-stack');
  assert.equal(stack.panels.length, DUNGEON_LAYERS.length);
  assert.ok(stack.stats.keys >= 5);
});

test('the five Story floors adapt into collision-safe live FPS courses', () => {
  assert.equal(DUNGEON_LAYERS.length, 5);
  for (let index = 0; index < DUNGEON_LAYERS.length; index += 1) {
    const course = makeDungeonCourse(index);
    const run = newRun(course);
    assert.equal(course.dungeon, true);
    assert.equal(course.dungeonIndex, index);
    assert.equal(course.w, DUNGEON_LAYERS[index].width);
    assert.equal(course.h, DUNGEON_LAYERS[index].height);
    assert.equal(run.waveCount, course.waveSpawns.length);
    assert.ok(canStand(course, course.playerSpawn.x, course.playerSpawn.y, .1), `${course.name} entry must be walkable`);
    assert.ok(course.walls.length > 100, `${course.name} needs authored carved wall segments`);
    assert.ok(course.waveSpawns.every(wave => wave.length > 0), `${course.name} must populate every authored wave`);
    assert.ok(course.waveSpawns.flat().every(spawn => canStand(course, spawn.x, spawn.y, .1)), `${course.name} has a blocked enemy spawn`);
    const entryRoom = course.rooms.find(room => course.playerSpawn.x >= room.bounds.minX && course.playerSpawn.x < room.bounds.maxX && course.playerSpawn.y >= room.bounds.minZ && course.playerSpawn.y < room.bounds.maxZ);
    assert.ok(course.waveSpawns[0].every(spawn => spawn.roomId === entryRoom?.id && Math.hypot(spawn.x - course.playerSpawn.x, spawn.y - course.playerSpawn.y) >= 3), `${course.name} opening enemies must stay in the entry room and outside opening melee range`);
    assert.equal(course.keys.length, 1, `${course.name} carries one exit key`);
  }
});

test('every Story wave spawns on the reachable side of its still-locked gates', () => {
  for (let floorIndex = 0; floorIndex < DUNGEON_LAYERS.length; floorIndex += 1) {
    const course = makeDungeonCourse(floorIndex);
    for (let waveIndex = 0; waveIndex < course.waveSpawns.length; waveIndex += 1) {
      for (const opening of course.openings.filter(item => item.lockedBy === 'room-clear')) {
        const releaseWave = course.roomClearWaveByOpening[opening.id];
        if (Number.isInteger(releaseWave) && releaseWave <= waveIndex) setDungeonOpeningOpen(course, opening.id, true);
      }
      const reachable = reachableCells(course.cells, course.w, course.h, course.playerSpawn);
      for (const spawn of course.waveSpawns[waveIndex]) {
        assert.ok(reachable.has(`${Math.floor(spawn.x)},${Math.floor(spawn.y)}`), `${course.name}/${spawn.id} must be reachable before wave ${waveIndex + 1}`);
      }
      for (const opening of course.openings.filter(item => item.lockedBy === 'room-clear')) {
        const releaseWave = course.roomClearWaveByOpening[opening.id];
        if (Number.isInteger(releaseWave) && releaseWave > waveIndex) {
          assert.equal(course.openingState[opening.id], false, `${course.name}/${opening.id} stays sealed before its local encounter`);
        }
      }
    }
  }
});

test('Story spawns stay clear of keys and the playground shows their live positions', () => {
  for (let floorIndex = 0; floorIndex < DUNGEON_LAYERS.length; floorIndex += 1) {
    const course = makeDungeonCourse(floorIndex);
    const scene = buildDungeonScene(floorIndex);
    const liveSpawns = course.waveSpawns.flatMap((wave, waveIndex) => wave.map(spawn => ({ spawn, waveIndex })));
    assert.equal(scene.spawns.length, liveSpawns.length, `${course.name}: the playground shows every live spawn`);
    for (const { spawn, waveIndex } of liveSpawns) {
      assert.ok(course.keys.every(key => Math.hypot(spawn.x - key.x, spawn.y - key.y) >= 1), `${course.name}/${spawn.id} stays one cell from each key`);
      assert.ok(scene.spawns.some(marker => marker.wave === waveIndex && marker.x === spawn.x && marker.y === spawn.y && marker.usage[0]?.variant === spawn.variant), `${course.name}/${spawn.id} map marker matches its runtime position`);
    }
  }

  const course = makeDungeonCourse(4);
  const run = newRun(course);
  run.wave = 3;
  run.waveDelay = 1.25;
  const progression = roomProgression(run);
  assert.equal(progression.objective, 'WAVE 04 / 05 IN 2s');
  assert.match(progression.subtitle, /NEXT THREAT ZONE: WARDEN VAULT \/ ORGAN CHAMBER/);
});

test('all five Story floors support a live-input route from entry through key pickup to the lift', () => {
  const run = newRun(makeDungeonCourse(0));
  run.mode = 'play';
  for (let index = 0; index < DUNGEON_LAYERS.length; index += 1) {
    const course = run.course;
    assert.equal(course.dungeonIndex, index, `route should enter Story floor ${index + 1}`);
    const start = { x: run.x, y: run.y };
    clearDungeonWavesThroughEngine(run);
    const key = course.keys[0];
    const keyGate = course.openings.find(opening => opening.keyId === key.id || key.opens?.includes(opening.id));
    assert.ok(keyGate, `${course.name} has a gate linked to its key`);
    assert.equal(course.openingState[keyGate.id], false, `${course.name} keeps the lift sealed before key pickup`);

    walkToDungeonPoint(run, key, `${course.name} entry-to-key`);
    assert.ok(Math.hypot(run.x - start.x, run.y - start.y) > .5, `${course.name} movement should leave the spawn anchor`);
    assert.ok(run.dungeonProgression.keysCollected.includes(key.id), `${course.name} should collect its key through proximity`);
    assert.equal(course.openingState[keyGate.id], true, `${course.name} key pickup should open its linked lift gate`);
    tick(run, 1 / 60, {});
    assert.equal(run.dungeonProgression.exitReady, true, `${course.name} should activate the lift after its cleared waves and key pickup`);

    const result = walkToDungeonPoint(run, course.exit, `${course.name} key-to-lift`, { allowFloorTransition: true });
    if (index < DUNGEON_LAYERS.length - 1) {
      assert.equal(result.transitioned, true, `${course.name} should reach and use the lift through player movement`);
      assert.equal(run.course.dungeonIndex, index + 1, `${course.name} lift should descend from floor ${index + 1} to ${index + 2}, got ${run.course.id} after ${result.frameCount} movement frames`);
      assert.equal(run.dungeonProgression.floorsCleared, index + 1, `${course.name} descent should track floors cleared so far`);
      assert.ok(canStand(run.course, run.x, run.y, .1), `${course.name} descent should land in walkable geometry`);
    } else {
      assert.equal(result.won, true, 'the final lift should complete the Story descent');
      assert.equal(run.mode, 'win', 'the final lift should complete the Story descent');
      assert.equal(run.dungeonProgression.floorsCleared, DUNGEON_LAYERS.length);
    }
  }
});

test('the opening wave gives players time to orient and survives a short no-input check', () => {
  for (let index = 0; index < DUNGEON_LAYERS.length; index += 1) {
    const run = newRun(makeDungeonCourse(index));
    run.mode = 'play';
    for (let frame = 0; frame < 100; frame += 1) tick(run, 1 / 60, {});
    assert.equal(run.wave, 0, `${run.course.name} should keep its first wave back during the opening beat`);
    assert.equal(run.course.enemies.length, 0, `${run.course.name} should start with a safe entry window`);
    for (let frame = 100; frame < 408; frame += 1) tick(run, 1 / 60, {});
    assert.ok(run.health > 0, `${run.course.name} should remain survivable while the first wave approaches`);
  }
});

test('F5 opening supports aimed fire and strafing through the first two wave gates', () => {
  const run = newRun(makeDungeonCourse(4));
  run.mode = 'play';
  let shots = 0;
  for (let frame = 0; frame < 1500 && run.mode === 'play'; frame += 1) {
    const target = run.course.enemies
      .filter(enemy => !enemy.dead)
      .sort((a, b) => Math.hypot(a.x - run.x, a.y - run.y) - Math.hypot(b.x - run.x, b.y - run.y))[0];
    if (target) run.angle = Math.atan2(target.y - run.y, target.x - run.x);
    if (run.cooldowns[run.weapon] <= 0 && shoot(run)) shots += 1;
    tick(run, 1 / 60, { forward: 1, strafe: frame % 120 < 60 ? 1 : -1 });
  }
  assert.ok(shots > 50, 'the opening route should exercise the live fire loop');
  assert.equal(run.mode, 'play', 'an active opening route should remain playable for the check window');
  assert.ok(run.health > 0, 'aimed strafing should survive the first pressure beats');
  assert.ok(run.kills >= 5, `aimed fire should clear waves one and two (got ${run.kills} kills)`);
  assert.ok(run.wave >= 3, `the route should advance beyond the second wave (got wave ${run.wave})`);
  assert.equal(run.course.openingState['f5-o-hall1-n'], true, 'clearing the first throat should open its north gate');
});

test('Story encounter gates release on their own wave, keys open the lift, and exits descend', () => {
  const course = makeDungeonCourse(0);
  const run = newRun(course);
  run.mode = 'play';
  run.wave = 1;
  run.waveDelay = 2;
  const key = course.keys[0];
  const keyGate = course.openings.find(opening => opening.keyId === key.id);
  assert.ok(keyGate);
  assert.equal(course.openingState[keyGate.id], false);

  tick(run, 1 / 120, {});
  assert.ok(course.openings.filter(opening => opening.lockedBy === 'room-clear').every(opening => !course.openingState[opening.id]), 'the entry wave must not release gates for later encounters');
  assert.equal(course.openingState[keyGate.id], false, 'the key gate stays sealed during the entry encounter');

  run.wave = 3;
  tick(run, 1 / 120, {});
  assert.ok(course.openings.filter(opening => opening.lockedBy === 'room-clear').every(opening => course.openingState[opening.id]), 'the court opens before its authored fourth-wave encounter');
  assert.equal(course.openingState[keyGate.id], false, 'the key gate remains separate from encounter gates');

  run.x = key.x;
  run.y = key.y;
  tick(run, 1 / 120, {});
  assert.ok(run.dungeonProgression.keysCollected.includes(key.id));
  assert.equal(course.openingState[keyGate.id], true, 'collecting the authored key opens its linked lift gate');

  run.wave = run.waveCount;
  run.course.enemies.length = 0;
  run.x = course.exit.x;
  run.y = course.exit.y;
  tick(run, 1 / 120, {});
  assert.equal(run.course.dungeonIndex, 1, 'the cleared floor transitions into the next Story map');
  assert.equal(run.dungeonProgression.floorsCleared, 1);
  assert.ok(canStand(run.course, run.x, run.y, .1), 'the next floor transition lands inside its entry bay');

  for (let floorIndex = 1; floorIndex < DUNGEON_LAYERS.length; floorIndex += 1) {
    const floor = run.course;
    const nextKey = floor.keys[0];
    run.x = nextKey.x;
    run.y = nextKey.y;
    tick(run, 1 / 120, {});
    assert.ok(run.dungeonProgression.keysCollected.includes(nextKey.id), `${floor.name} key should unlock its lift`);
    run.wave = run.waveCount;
    floor.enemies.length = 0;
    run.x = floor.exit.x;
    run.y = floor.exit.y;
    tick(run, 1 / 120, {});
    if (floorIndex < DUNGEON_LAYERS.length - 1) {
      assert.equal(run.course.dungeonIndex, floorIndex + 1, `${floor.name} exit should descend to the next floor`);
      assert.ok(canStand(run.course, run.x, run.y, .1), 'each descent transition should land in the next entry bay');
    }
  }
  assert.equal(run.mode, 'win', 'the fifth floor should complete the Story descent');
  assert.equal(run.course.dungeonIndex, DUNGEON_LAYERS.length - 1);
  assert.equal(run.dungeonProgression.floorsCleared, DUNGEON_LAYERS.length);
});

test('arena sectors and campaign overview still build', () => {
  for (let index = 0; index < 3; index += 1) {
    const scene = buildSectorScene(index);
    assert.equal(scene.kind, 'sector');
    assert.equal(scene.rooms.length, 4);
    assert.ok(scene.path.designed.length > 0);
  }
  const campaign = buildCampaignScene();
  assert.equal(campaign.panels.length, 3);
});
