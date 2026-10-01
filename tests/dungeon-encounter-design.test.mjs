import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { newRun, tick } from '../engine.js';
import { encounterRoster, encounterAliveCap, encounterStages, encounterRelief, roomRecoveryPolicy } from '../dungeon-encounter-design.js';
import { ENEMY_PROFILES } from '../campaign.js';

const roomFor = (course, id) => course.rooms.find(room => room.id === id);
const markersFor = (course, room) => course.waveSpawns.flat().filter(marker => marker.roomId === room.id);
const histogram = variants => variants.reduce((counts, variant) => {
  counts[variant] = (counts[variant] || 0) + 1;return counts;
}, {});

test('authored Story populations and enemy mixes replace generic padding without moving spawn markers or wave IDs', () => {
  const totals = [], requiredTotals = [];
  for (let floor = 0; floor < 5; floor++) {
    const course = makeDungeonCourse(floor), snapshot = JSON.stringify(course.waveSpawns);
    let total = 0;
    for (const room of course.rooms) {
      const markers = markersFor(course, room), roster = encounterRoster(course, room, markers);
      if (room.encounter.budget > 0) assert.ok(markers.length, `${room.id}: population needs authored staging markers`);
      assert.equal(roster.length, room.encounter.budget || 0, `${room.id}: authored population stays authoritative`);
      assert.deepEqual(encounterRoster(course, room, markers), roster, `${room.id}: deterministic composition`);
      assert.equal(encounterAliveCap(course, room), Math.min(10, room.encounter.maxAlive || 4),
        `${room.id}: dungeon depth cannot inflate the authored cap`);
      const weights = Object.keys(room.encounter.composition || {});
      const cycle = Object.entries(room.encounter.composition || {}).flatMap(([variant, count]) => Array(count).fill(variant));
      if (cycle.length) assert.deepEqual(histogram(roster.map(marker => marker.variant)),
        histogram(Array.from({ length: room.encounter.budget }, (_, index) => cycle[index % cycle.length])),
        `${room.id}: readable ordering preserves the exact authored composition`);
      for (const marker of roster) {
        assert.ok(markers.some(source => source.x === marker.x && source.y === marker.y
          && source.roomId === marker.roomId && source.id === marker.id), `${room.id}: retain an authored marker`);
        assert.ok(weights.includes(marker.variant), `${room.id}: reinforcements retain the room's authored enemy identity`);
        assert.equal(marker.seeded, false, 'resident staging stays owned by the engine');
      }
      for (const variant of weights) assert.ok(roster.some(marker => marker.variant === variant),
        `${room.id}: authored ${variant} cannot disappear behind generic fillers`);
      total += roster.length;
    }
    assert.equal(JSON.stringify(course.waveSpawns), snapshot, 'policy cannot mutate legacy gate-wave markers');
    const livePlan = newRun(course).dungeonProgression.encounterPlan;
    assert.equal(livePlan.reduce((sum, node) => sum + node.spawns.length, 0), total,
      `${course.id}: the live engine consumes the authoritative roster without population padding`);
    for (const node of livePlan) {
      const room = roomFor(course, node.roomId);
      assert.equal(node.spawns.length, room.encounter.budget);
      assert.deepEqual(histogram(node.spawns.map(marker => marker.variant)),
        histogram(encounterRoster(course, room, markersFor(course, room)).map(marker => marker.variant)),
        `${node.roomId}: the live queue retains the room's actual enemy mix`);
    }
    requiredTotals.push(livePlan.filter(node => !node.optional).reduce((sum, node) => sum + node.spawns.length, 0));
    totals.push(total);
  }
  assert.deepEqual(totals, [62, 66, 84, 92, 85]);
  assert.equal(totals.reduce((sum, count) => sum + count, 0), 389, 'five-floor authored population replaces the previous 701-member queue');
  assert.deepEqual(requiredTotals, [58, 52, 61, 81, 85]);
  assert.equal(requiredTotals.reduce((sum, count) => sum + count, 0), 337, 'mandatory encounters replace the previous 634-member queue');
});

test('crossfire interleaves fast and ranged roles while late guards reserve their strongest anchors for the final approach', () => {
  const course = { dungeonIndex: 0 }, markers = [{ id: 'authored', x: 2.5, y: 3.5, roomId: 'test' }];
  const ranged = variant => ['ranged', 'teleport'].includes(ENEMY_PROFILES[variant].role);
  const fast = variant => ['rush', 'hunter'].includes(ENEMY_PROFILES[variant].role);
  const crossing = { id: 'test', identity: { beat: 'crossfire' }, encounter: {
    budget: 14, composition: { stalker: 6, caster: 3, bloodhound: 3, brute: 2 }, maxAlive: 5,
  } };
  const crossRoster = encounterRoster(course, crossing, markers).map(marker => marker.variant);
  let offset = 0;
  for (const stage of encounterStages(course, crossing, crossRoster.length)) {
    const members = crossRoster.slice(offset, offset + stage.count);offset += stage.count;
    assert.ok(members.some(ranged) && members.some(fast), 'each crossfire approach retains both threat roles');
    assert.ok(fast(members[0]) && ranged(members[1]), 'the first readable pair introduces fast and ranged pressure');
  }
  assert.deepEqual(histogram(crossRoster), crossing.encounter.composition);
  for (const beat of ['holdout', 'finale', 'key-retrieval']) {
    const room = { id: 'test', identity: { beat }, encounter: {
      budget: 12, composition: { skitter: 4, caster: 4, brute: 2, warden: 2 }, maxAlive: 6,
    } };
    const roster = encounterRoster(course, room, markers).map(marker => marker.variant);
    const stages = encounterStages(course, room, roster.length), lastStart = roster.length - stages.at(-1).count;
    assert.deepEqual(histogram(roster), room.encounter.composition, 'ordering never adds or deletes a variant');
    assert.equal(roster.slice(0, lastStart).includes('warden'), false, `${beat}: strongest guards arrive in the final phase`);
    assert.equal(roster.at(-1), 'warden', `${beat}: the last arrival is a readable guard anchor`);
    assert.ok(roster.slice(lastStart).some(ranged) && roster.slice(lastStart).some(fast),
      `${beat}: late anchors retain support and movement pressure`);
    const cycle = Object.entries(room.encounter.composition).flatMap(([variant, count]) => Array(count).fill(variant));
    for (let budget = 1; budget <= 4; budget++) {
      const small = encounterRoster(course, { ...room, encounter: { ...room.encounter, budget } }, markers);
      assert.deepEqual(histogram(small.map(marker => marker.variant)), histogram(cycle.slice(0, budget)),
        `${beat}: reserving a late guard cannot introduce an unallocated variant into a small room`);
    }
  }
});

test('arrival, pursuit, crossfire, key and climax beats produce distinct complete stage structures', () => {
  const scenarios = [
    [0, 'f1-entry', 1], [0, 'f1-ward', 1], [0, 'f1-hall', 2], [0, 'f1-vault', 2], [0, 'f1-court', 3],
    [1, 'f2-wardD', 1], [1, 'f2-theater', 3], [2, 'f3-cryptE', 1], [2, 'f3-court', 3],
    [3, 'f4-nave', 2], [3, 'f4-chancel', 1], [4, 'f5-entry', 1], [4, 'f5-organ', 2], [4, 'f5-hall3', 3],
  ];
  for (const [floor, id, expected] of scenarios) {
    const course = makeDungeonCourse(floor), room = roomFor(course, id);
    const stages = encounterStages(course, room, room.encounter.budget, room.flow.optional);
    assert.equal(stages.length, expected, `${id}: authored beat determines its rhythm`);
    assert.equal(stages.reduce((sum, stage) => sum + stage.count, 0), room.encounter.budget);
    assert.equal(new Set(stages.map(stage => stage.label)).size, stages.length, `${id}: readable phase identities`);
    assert.equal(stages.at(-1).rest, 0, 'the last phase cannot defer encounter completion');
    for (const stage of stages) {
      assert.ok(stage.count >= 1 && Number.isInteger(stage.count));
      assert.ok(stage.lead >= .5, `${id}: warning lead remains mandatory`);
      assert.ok(stage.spacing >= .4 && stage.spacing <= .8, `${id}: bounded arrival cadence`);
      assert.ok(stage.minAge >= 2.8 && stage.minAge <= 3.6);
    }
    if (expected > 1) assert.ok(stages[0].rest > 0, `${id}: the next approach has a measured breathing interval`);
    for (let count = 1; count <= 4; count++) {
      const small = encounterStages(course, room, count, room.flow.optional);
      assert.equal(small.reduce((sum, stage) => sum + stage.count, 0), count);
      assert.ok(small.every(stage => stage.count > 0), 'small custom encounters cannot create empty phases');
    }
  }
  const foundry = makeDungeonCourse(0), crypt = makeDungeonCourse(2), finale = makeDungeonCourse(4);
  const cryptStage = encounterStages(crypt, roomFor(crypt, 'f3-hub'), 11)[0];
  const foundryStage = encounterStages(foundry, roomFor(foundry, 'f1-hall'), 9)[0];
  const finaleStage = encounterStages(finale, roomFor(finale, 'f5-hall3'), 22)[0];
  assert.ok(cryptStage.spacing > foundryStage.spacing, 'catacomb sentries arrive more deliberately than foundry pressure');
  assert.ok(finaleStage.spacing < foundryStage.spacing, 'the finale compresses the attack cadence');
  assert.deepEqual(encounterStages(foundry, roomFor(foundry, 'f1-court'), 0), []);
  assert.deepEqual(encounterRoster(foundry, roomFor(foundry, 'f1-court'), []), [], 'policy cannot invent a spawn position');
});

test('floor themes preserve their specialized enemies and release after key retrieval and climaxes', () => {
  for (const [floor, id, types] of [
    [2, 'f3-court', ['bellwraith', 'warden']],
    [3, 'f4-entry', ['bellwraithEcho']],
    [3, 'f4-court', ['bellwraith', 'mireSinger']],
    [4, 'f5-hall3', ['bellwraith', 'warden', 'mireSinger']],
  ]) {
    const course = makeDungeonCourse(floor), room = roomFor(course, id);
    const roster = encounterRoster(course, room, markersFor(course, room));
    for (const variant of types) assert.ok(roster.filter(marker => marker.variant === variant).length >= 2,
      `${id}: specialized ${variant} remains a sustained part of the room pressure`);
    assert.equal(roster.some(marker => marker.variant === 'stalker'), false,
      `${id}: specialized composition cannot collapse into generic stalkers`);
  }
  const course = makeDungeonCourse(0), hall = roomFor(course, 'f1-hall'), court = roomFor(course, 'f1-court');
  assert.ok(encounterRelief(course, court, 100) > encounterRelief(course, hall, 100), 'climax has a longer release than a crossing');
  assert.equal(encounterRelief(course, hall, 30), encounterRelief(course, hall, 100) + 3, 'low health adds explicit respite');
  assert.ok(encounterRelief(course, roomFor(course, 'f1-vault'), 100) >= 4.5, 'key retrieval has room for orientation and recovery');
});

test('defended equipment rooms advertise combat while quiet rooms and secret cache rewards match actual supplies', () => {
  for (const [floor, id] of [[0, 'f1-sluice'], [1, 'f2-wardC'], [2, 'f3-cryptW'], [3, 'f4-organ']]) {
    const course = makeDungeonCourse(floor), room = roomFor(course, id), policy = roomRecoveryPolicy(course, room);
    assert.equal(room.flow.role, 'combat', `${id}: a weapon pickup cannot disguise active defenders`);
    assert.equal(room.flow.optional, true);
    assert.equal(room.flow.safeRespite, false);
    assert.equal(room.flow.safeAfterClear, true);
    assert.equal(policy.safeAfterClear, true);
    assert.ok(course.supplies.some(item => item.roomId === id), 'the defended detour retains its actual recovery reward');
  }
  for (const [floor, id, health, energy] of [
    [0, 'f1-nook', 40, 35], [1, 'f2-drawer', 20, 65], [2, 'f3-tomb', 50, 25],
    [3, 'f4-niche', 40, 50], [4, 'f5-cache', 40, 100],
  ]) {
    const course = makeDungeonCourse(floor), room = roomFor(course, id), supply = course.supplies.find(item => item.roomId === id);
    assert.equal(room.flow.safeRespite, true, `${id}: quiet cache is a genuine release room`);
    assert.equal(supply.health, health);
    assert.equal(supply.energy, energy);
    assert.equal(room.reward, supply.label, 'declared reward matches the resource that can actually be collected');
    assert.ok(!/armor|coin|ammo|weapon|max health/.test(room.reward), 'cache cannot promise an unimplemented reward');
  }
  const choir = makeDungeonCourse(3), vestry = roomFor(choir, 'f4-vestry');
  assert.equal(vestry.flow.safeRespite, true, 'the abandoned vestry remains an explicit quiet pause');
});

test('the final recovery reserve restores real energy once without consuming a full-health pickup', () => {
  const course = makeDungeonCourse(4), supply = course.supplies.find(item => item.roomId === 'f5-cache');
  const run = newRun(course);
  run.mode = 'play';
  run.x = supply.x;
  run.y = supply.y;
  tick(run, 1 / 60, {});
  assert.equal(run.dungeonProgression.suppliesCollected.includes(supply.id), false);
  run.health = 10;
  run.energy = 0;
  tick(run, 1 / 60, {});
  assert.equal(run.health, 50);
  assert.equal(run.energy, 100, 'the advertised full reserve restores the game actual energy resource');
  assert.ok(run.dungeonProgression.suppliesCollected.includes(supply.id));
  run.health = 10;
  run.energy = 0;
  tick(run, 1 / 60, {});
  assert.equal(run.health, 10, 'the cache cannot be farmed for repeat health');
  assert.ok(run.energy < 1, 'the cache cannot be farmed for repeat energy');
});
