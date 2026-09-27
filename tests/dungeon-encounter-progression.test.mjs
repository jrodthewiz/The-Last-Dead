import test from 'node:test';
import assert from 'node:assert/strict';

import { DUNGEON_LAYERS } from '../playground/map/dungeon-data.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { canStand } from '../engine.js';
import { newRun, tick } from '../engine.js';

function roomPoint(course, roomId, avoid = null) {
  const room = course.rooms.find(item => item.id === roomId);
  assert.ok(room, `${course.name}: missing encounter room ${roomId}`);
  const points = [];
  for (let y = room.bounds.minZ + .5; y < room.bounds.maxZ; y += 1) {
    for (let x = room.bounds.minX + .5; x < room.bounds.maxX; x += 1) {
      const row = room.footprint?.[Math.floor(y) - room.bounds.minZ];
      const cell = row?.[Math.floor(x) - room.bounds.minX];
      if (room.footprint && cell !== '1' && cell !== 1 && cell !== true) continue;
      if (canStand(course, x, y, .12)) points.push({ x, y });
    }
  }
  assert.ok(points.length, `${course.name}/${roomId}: no walkable room point`);
  if (avoid) points.sort((a, b) => Math.hypot(b.x - avoid.x, b.y - avoid.y) - Math.hypot(a.x - avoid.x, a.y - avoid.y));
  return points[0];
}

function enterEncounter(run, node) {
  const progression = run.dungeonProgression;
  const point = roomPoint(run.course, node.roomId, { x: run.x, y: run.y });
  run.x = point.x;
  run.y = point.y;
  tick(run, 1 / 60, {});
  if (!progression.currentEncounter) {
    const reentry = roomPoint(run.course, node.roomId, { x: run.x, y: run.y });
    run.x = reentry.x;
    run.y = reentry.y;
    tick(run, 1 / 60, {});
  }
  assert.ok(progression.currentEncounter, `${run.course.name}/${node.id}: room entry starts its encounter`);
  return progression.currentEncounter.id;
}

function clearNextEncounter(run) {
  const progression = run.dungeonProgression;
  const node = progression.encounterPlan[progression.nextEncounterIndex];
  const encounterId = enterEncounter(run, node);
  let frames = 0;
  while (progression.currentEncounter?.id === encounterId && frames < 720) {
    tick(run, 1 / 60, {});
    for (const enemy of run.course.enemies) {
      if (!enemy.dead && enemy.encounterId === encounterId) enemy.dead = true;
    }
    frames += 1;
  }
  assert.ok(frames < 720, `${run.course.name}/${node.id}: authored encounter should clear`);
  assert.equal(node.status, 'cleared');
  assert.equal(run.course.enemies.filter(enemy => enemy.encounterId === encounterId).length, node.spawns.length);
  return node;
}

function clearFloor(run, onClear = () => {}) {
  const progression = run.dungeonProgression;
  while (progression.nextEncounterIndex < progression.encounterPlan.length) onClear(clearNextEncounter(run));
  assert.equal(progression.completedEncounterIds.length, progression.encounterPlan.length);
  assert.equal(progression.currentEncounter, null);
}

test('Story floors wait for player entry instead of starting global timed waves', () => {
  for (let index = 0; index < DUNGEON_LAYERS.length; index += 1) {
    const run = newRun(makeDungeonCourse(index));
    run.mode = 'play';
    for (let frame = 0; frame < 900; frame += 1) tick(run, 1 / 60, {});
    assert.equal(run.wave, 0, `${run.course.name}: idle waiting must not increment wave`);
    assert.equal(run.course.enemies.length, 0, `${run.course.name}: idle waiting must not spawn enemies`);
    assert.equal(run.dungeonProgression.phase, 'exploration');
    assert.equal(run.dungeonProgression.encounter.state, 'exploration');
    assert.equal(run.dungeonProgression.exitReady, false);
    assert.equal(run.events.some(event => event.type === 'dungeon-encounter-start'), false);
  }
});

test('room entry telegraphs staggered threats with a cap and safe fallback points', () => {
  for (let index = 0; index < DUNGEON_LAYERS.length; index += 1) {
    const run = newRun(makeDungeonCourse(index));
    run.mode = 'play';
    run.health = 9999;
    // Stand on an authored point to exercise the body-blocked spawn fallback.
    const authored = run.course.waveSpawns[0][0];
    run.x = authored.x;
    run.y = authored.y;
    tick(run, 1 / 60, {});
    const progression = run.dungeonProgression;
    const encounter = progression.currentEncounter;
    assert.ok(encounter, `${run.course.name}: authored entry point should activate the first room`);
    assert.equal(progression.encounter.state, 'telegraph');
    assert.ok(run.events.some(event => event.type === 'dungeon-encounter-start' && event.roomId === encounter.roomId));
    tick(run, 1 / 60, {});
    assert.ok(run.events.some(event => event.type === 'spawn-telegraph' && event.encounterId === encounter.id));

    let maxActive = 0;
    for (let frame = 0; frame < 180; frame += 1) {
      tick(run, 1 / 60, {});
      maxActive = Math.max(maxActive, run.course.enemies.filter(enemy => !enemy.dead && enemy.encounterId === encounter.id).length);
    }
    assert.ok(maxActive <= encounter.aliveCap, `${run.course.name}: active threats stay below authored cap`);
    for (const enemy of run.course.enemies.filter(item => item.encounterId === encounter.id)) {
      assert.ok(Math.hypot(enemy.x - run.x, enemy.y - run.y) >= .89, `${run.course.name}: fallback spawn keeps contact clearance`);
    }
  }
});

test('all five Story floors clear their room queues, release gates, collect keys, descend, and restart cleanly', () => {
  const run = newRun(makeDungeonCourse(0));
  run.mode = 'play';

  for (let floorIndex = 0; floorIndex < DUNGEON_LAYERS.length; floorIndex += 1) {
    const course = run.course;
    const gateMilestones = [];
    clearFloor(run, node => {
      const opened = course.openings.filter(opening => opening.lockedBy === 'room-clear' && course.openingState[opening.id]).length;
      gateMilestones.push({ wave: node.waveIndex, opened });
    });
    assert.ok(gateMilestones.some(item => item.opened > 0), `${course.name}: clearing authored rooms should release a gate`);

    const key = course.keys[0];
    const keyGate = course.openings.find(opening => opening.keyId === key.id || key.opens?.includes(opening.id));
    assert.ok(keyGate, `${course.name}: key must own a lift gate`);
    assert.equal(course.openingState[keyGate.id], false, `${course.name}: lift stays closed until the key is collected`);
    run.x = key.x;
    run.y = key.y;
    tick(run, 1 / 60, {});
    assert.ok(run.dungeonProgression.keysCollected.includes(key.id));
    assert.equal(course.openingState[keyGate.id], true);
    assert.equal(run.dungeonProgression.exitReady, true);

    run.x = course.exit.x;
    run.y = course.exit.y;
    tick(run, 1 / 60, {});
    if (floorIndex < DUNGEON_LAYERS.length - 1) {
      assert.equal(run.course.dungeonIndex, floorIndex + 1);
      assert.equal(run.dungeonProgression.floorsCleared, floorIndex + 1);
      assert.equal(run.dungeonProgression.phase, 'exploration');
      assert.equal(run.dungeonProgression.completedEncounterIds.length, 0);
      assert.ok(canStand(run.course, run.x, run.y, .1));
    }
  }

  assert.equal(run.mode, 'win');
  assert.equal(run.dungeonProgression.floorsCleared, DUNGEON_LAYERS.length);
  assert.ok(run.events.some(event => event.type === 'win' && event.floorIndex === DUNGEON_LAYERS.length - 1));

  const restarted = newRun(makeDungeonCourse(0));
  restarted.mode = 'play';
  assert.equal(restarted.wave, 0);
  assert.equal(restarted.course.enemies.length, 0);
  assert.deepEqual(restarted.dungeonProgression.keysCollected, []);
  assert.deepEqual(restarted.dungeonProgression.lootCollected, []);
  assert.equal(restarted.dungeonProgression.phase, 'exploration');
  assert.equal(restarted.dungeonProgression.exitReady, false);
});
