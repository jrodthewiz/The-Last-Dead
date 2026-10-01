import test from 'node:test';
import assert from 'node:assert/strict';

import { DUNGEON_LAYERS } from '../playground/map/dungeon-data.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { canStand, castRay } from '../engine.js';
import { newRun, tick } from '../engine.js';
import { reachableCells } from '../campaign.js';
import { seenByPlayers, findPath } from '../enemy-ai.js';

function roomPoint(course, roomId, avoid = null) {
  const room = course.rooms.find(item => item.id === roomId);
  assert.ok(room, `${course.name}: missing encounter room ${roomId}`);
  const points = [];
  for (let y = room.bounds.minZ + .5; y < room.bounds.maxZ; y += 1) {
    for (let x = room.bounds.minX + .5; x < room.bounds.maxX; x += 1) {
      const row = room.footprint?.[Math.floor(y) - room.bounds.minZ];
      const cell = row?.[Math.floor(x) - room.bounds.minX];
      if (room.footprint && cell !== '1' && cell !== 1 && cell !== true) continue;
      if (canStand(course, x, y, .12) && course.dungeonCompiled.reach.has(`${Math.floor(x)},${Math.floor(y)}`)
        &&course.keys.every(key=>Math.hypot(key.x-x,key.y-y)>.8)) points.push({ x, y });
    }
  }
  assert.ok(points.length, `${course.name}/${roomId}: no walkable room point`);
  const reach=avoid?reachableCells(course.cells,course.w,course.h,avoid):null;
  const routed=reach?points.filter(point=>reach.has(`${Math.floor(point.x)},${Math.floor(point.y)}`)):points;
  if (avoid) routed.sort((a, b) => Math.hypot(b.x - avoid.x, b.y - avoid.y) - Math.hypot(a.x - avoid.x, a.y - avoid.y));
  return routed[0]||null;
}

function enterEncounter(run, node) {
  const progression = run.dungeonProgression;
  const point = roomPoint(run.course, node.roomId, { x: run.x, y: run.y });
  run.x = point.x;
  run.y = point.y;
  // A short authored relief interval may still be running after the last room.
  for(let frame=0;frame<660&&!progression.currentEncounter;frame++)tick(run,1/60,{});
  assert.ok(progression.currentEncounter, `${run.course.name}/${node.id}: room entry starts its encounter`);
  return progression.currentEncounter;
}

function clearNextEncounter(run) {
  const progression = run.dungeonProgression;
  const node = progression.encounterPlan.find(node=>!node.optional&&node.status==='pending'&&roomPoint(run.course,node.roomId,run));
  assert.ok(node,'a required pending room remains reachable through open gates');
  const encounter = enterEncounter(run, node), encounterId=encounter.id;
  let frames = 0;
  while (progression.currentEncounter?.id === encounterId && frames < 1800) {
    tick(run, 1 / 60, {});
    for (const enemy of run.course.enemies) {
      enemy.dead = true;
    }
    frames += 1;
    if(frames%180===0)run.angle+=Math.PI/2;
  }
  assert.ok(frames < 1800, `${run.course.name}/${node.id}: safe encounter queue should clear`);
  assert.equal(node.status, 'cleared');
  assert.equal(encounter.queue.filter(item=>item.status==='spawned').length,encounter.queue.length,'every queued threat including seeded residents was accounted for');
  return node;
}

function clearFloor(run, onClear = () => {}) {
  const progression = run.dungeonProgression;
  while (progression.encounterPlan.some(node=>!node.optional&&node.status!=='cleared')) onClear(clearNextEncounter(run));
  assert.ok(progression.encounterPlan.filter(node=>!node.optional).every(node=>progression.completedEncounterIds.includes(node.id)));
  assert.equal(progression.currentEncounter, null);
}

test('Story floors allow a short orientation beat then start local pressure', () => {
  for (let index = 0; index < DUNGEON_LAYERS.length; index += 1) {
    const run = newRun(makeDungeonCourse(index));
    run.mode = 'play';
    for (let frame = 0; frame < 90; frame += 1) tick(run, 1 / 60, {});
    assert.equal(run.wave, 0, `${run.course.name}: orientation beat starts quietly`);
    assert.equal(run.dungeonProgression.phase, 'exploration');
    assert.equal(run.dungeonProgression.encounter.state, 'exploration');
    assert.equal(run.dungeonProgression.exitReady, false);
    assert.equal(run.events.some(event => event.type === 'dungeon-encounter-start'), false);
    for(let frame=90;frame<250;frame++)tick(run,1/60,{});
    assert.equal(run.wave,1,`${run.course.name}: first room starts within five seconds`);
    assert.equal(run.dungeonProgression.currentEncounter?.roomId,run.dungeonProgression.entryRoomId);
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
    let maxActive = 0;
    let seenEvents=run.events.length,spawns=0;
    for (let frame = 0; frame < 600; frame += 1) {
      tick(run, 1 / 60, {});
      for(const event of run.events.slice(seenEvents).filter(e=>e.type==='spawn'&&!e.resident)){
        spawns++;
        assert.ok(Math.hypot(event.x-run.x,event.y-run.y)>=3.49);
        assert.equal(seenByPlayers({canStand,castRay},run.course,[run],event.x,event.y,{fov:1.4,range:45,near:2.65}),false);
        assert.ok(findPath({canStand,castRay},run.course,event,run,run.course.w*run.course.h));
      }
      seenEvents=run.events.length;
      if(frame%120===0)run.angle+=Math.PI/2;
      maxActive = Math.max(maxActive, run.course.enemies.filter(enemy => !enemy.dead && enemy.encounterId === encounter.id).length);
    }
    assert.ok(maxActive <= encounter.aliveCap, `${run.course.name}: active threats stay below authored cap`);
    assert.ok(spawns>0,`${run.course.name}: safe entrance produces pressure`);
    assert.ok(run.events.some(event=>event.type==='spawn-telegraph'&&event.encounterId===encounter.id));
  }
});

test('all five Story floors clear their room queues, release gates, collect keys, descend, and restart cleanly', () => {
  const run = newRun(makeDungeonCourse(0));
  run.mode = 'play';
  run.health=9999;

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
