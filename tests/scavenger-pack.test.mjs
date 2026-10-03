import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeDungeonCourse} from '../playground/map/dungeon-course.js';
import {canStand} from '../engine.js';
import {attachScavengerPickups, createScavengerPack, validateBackpack, collectScavengerPickup,
  tickScavengerPack, upgradeWeapon, weaponDamageMultiplier, PACK_CAPACITY,
  WEAPON_FITTING, MAX_PICKUP_HISTORY} from '../scavenger-pack.js';

function fresh() {
  const cells = Array.from({length: 25}, () => [0, 0, 0, 0]);
  return {mode: 'play', health: 100, x: 1.5, y: 1.5, z: 0, weapon: 0,
    ownedWeapons: [0, 1, 6], events: [], backpack: createScavengerPack(),
    course: {dungeon: true, w: 5, h: 5, cells, scavengerPickups: [
      {id: 'floor-0:a', x: 1.5, y: 1.5, amount: 4},
      {id: 'floor-0:b', x: 2.5, y: 1.5, amount: 4},
      {id: 'floor-0:c', x: 3.5, y: 1.5, amount: 4},
      {id: 'floor-0:d', x: 3.5, y: 2.5, amount: 4},
    ]}};
}

test('scrap collection is one-time and respects bounded backpack capacity', () => {
  const run = fresh();
  assert.equal(collectScavengerPickup(run, 'floor-0:a').ok, true);
  assert.equal(run.backpack.scrap, 4);
  assert.equal(collectScavengerPickup(run, 'floor-0:a').ok, false);
  for (const id of ['b', 'c']) {
    run.x = id === 'b' ? 2.5 : 3.5;
    tickScavengerPack(run);
  }
  assert.equal(run.backpack.scrap, PACK_CAPACITY);
  run.y = 2.5;
  assert.deepEqual(collectScavengerPickup(run, 'floor-0:d'), {ok: false, reason: 'full'});
  assert.equal(run.backpack.collected.length, 3);
  assert.equal(run.events.length, 3);
});

test('one fitting consumes once and changes only the chosen owned weapon', () => {
  const run = fresh(); run.mode = 'pause'; run.backpack.scrap = 12;
  assert.equal(upgradeWeapon(run, 6).ok, true);
  assert.equal(run.backpack.scrap, 12 - WEAPON_FITTING.cost);
  assert.equal(weaponDamageMultiplier(run, 6), 1.25);
  assert.equal(weaponDamageMultiplier(run, 0), 1);
  assert.equal(weaponDamageMultiplier(run, 1), 1);
  assert.deepEqual(upgradeWeapon(run, 6), {ok: false, reason: 'already-fitted'});
  assert.equal(run.backpack.scrap, 4);
  assert.deepEqual(upgradeWeapon(run, 4), {ok: false, reason: 'unowned'});
  assert.deepEqual(upgradeWeapon(run, 1), {ok: false, reason: 'scrap'});
  assert.equal(run.events.length, 1);
});

test('caches remain available when full and can be collected after fitting', () => {
  const run = fresh(); run.backpack.scrap = 12; run.x = 3.5; run.y = 2.5;
  assert.equal(collectScavengerPickup(run, 'floor-0:d').reason, 'full');
  upgradeWeapon(run, 0);
  tickScavengerPack(run);
  assert.equal(run.backpack.scrap, 8);
  assert.ok(run.backpack.collected.includes('floor-0:d'));
});

test('pickup cannot cross a sealed wall and dead or airborne players do not scavenge', () => {
  const run = fresh(); run.x = 1.98;
  run.course.scavengerPickups[1].x = 2.02;
  run.course.cells[1 * 5 + 1][1] = 1;
  assert.equal(collectScavengerPickup(run, 'floor-0:b').reason, 'out-of-reach');
  run.x = 1.5; run.health = 0;
  tickScavengerPack(run); assert.equal(run.backpack.scrap, 0);
  run.health = 100; run.z = .4;
  tickScavengerPack(run); assert.equal(run.backpack.scrap, 0);
});

test('co-op pickup and fittings use the host shared backpack', () => {
  const run = fresh(); run.x = .5; run.y = .5;
  const peer = {world: run, course: run.course, mode: 'play', health: 100, x: 1.5, y: 1.5,
    z: 0, weapon: 1, ownedWeapons: [0, 1], playerId: 'peer'};
  run.peer = peer;
  tickScavengerPack(run);
  assert.equal(peer.backpack, run.backpack);
  assert.equal(run.backpack.scrap, 4);
  assert.equal(run.events[0].playerId, 'peer');
  run.backpack.scrap = 8;
  assert.equal(upgradeWeapon(peer, 1).ok, true);
  assert.equal(weaponDamageMultiplier(peer, 1), 1.25);
  assert.equal(weaponDamageMultiplier(run, 1), 1.25);
});

test('floor transitions preserve resource and upgrade state with distinct pickup IDs', () => {
  const run = fresh(); tickScavengerPack(run); run.backpack.scrap = 8; upgradeWeapon(run, 0);
  const pack = run.backpack;
  run.course = {...run.course, scavengerPickups: [{id: 'floor-1:a', x: 1.5, y: 1.5, amount: 4}]};
  tickScavengerPack(run);
  assert.equal(run.backpack, pack);
  assert.equal(run.backpack.scrap, 4);
  assert.equal(weaponDamageMultiplier(run, 0), 1.25);
  assert.deepEqual(run.backpack.collected, ['floor-0:a', 'floor-1:a']);
});

test('snapshot validation bounds scrap, history, and recognized weapon mods', () => {
  const value = validateBackpack({capacity: 999, scrap: 99, collected: Array.from({length: 200}, (_, i) => `id-${i}`),
    weaponMods: {0: WEAPON_FITTING.id, 1: 'nonsense', 99: WEAPON_FITTING.id}});
  assert.equal(value.capacity, PACK_CAPACITY); assert.equal(value.scrap, PACK_CAPACITY);
  assert.equal(value.collected.length, MAX_PICKUP_HISTORY);
  assert.deepEqual(value.weaponMods, {0: WEAPON_FITTING.id});
  assert.equal(validateBackpack({scrap: -4}).scrap, 0);
  assert.equal(validateBackpack({scrap: Infinity}).scrap, PACK_CAPACITY);
});

test('real floor caches are deterministic clear points separated from other loot and landmarks', () => {
  for (let floor = 0; floor < 5; floor++) {
    const course = makeDungeonCourse(floor), copy = makeDungeonCourse(floor);
    const caches = attachScavengerPickups(course);
    assert.deepEqual(caches, attachScavengerPickups(copy));
    assert.ok(caches.length >= 3 && caches.length <= 12, `floor ${floor} has ${caches.length} caches`);
    assert.equal(new Set(caches.map(cache => cache.id)).size, caches.length);
    for (const cache of caches) {
      assert.ok(canStand(course, cache.x, cache.y, .1), `${cache.id} sits on a clear floor`);
      assert.ok(course.dungeonCompiled.reach.has(`${Math.floor(cache.x)},${Math.floor(cache.y)}`));
      for (const other of [...course.keys, ...course.loot, ...course.evidence, ...course.supplies]) {
        assert.ok(Math.hypot(cache.x - other.x, cache.y - other.y) >= .8, `${cache.id} overlaps ${other.id}`);
      }
      for (const other of [...course.landmarks, ...course.machinery, ...course.setpieces]) {
        if (!other.anchor) continue;
        assert.ok(Math.hypot(cache.x - other.anchor[0], cache.y - other.anchor[1]) >= .8);
      }
    }
    assert.equal(attachScavengerPickups(course), caches, 'attachment is idempotent');
  }
});

test('extended five floors distribute clear scrap caches over original and annex routes', () => {
  for (let floor = 0; floor < 5; floor++) {
    const course = makeDungeonCourse(floor, {extended: true});
    const caches = attachScavengerPickups(course);
    assert.ok(caches.some(cache => !cache.roomId.startsWith('annex-')), `floor ${floor} retains original caches`);
    assert.ok(caches.some(cache => cache.roomId.startsWith('annex-')), `floor ${floor} has annex caches`);
    assert.ok(caches.length <= 12);
    for (const cache of caches) {
      assert.ok(canStand(course, cache.x, cache.y, .1), `${cache.id} sits on clear extended floor`);
      for (const other of [...course.keys, ...course.loot, ...course.evidence, ...course.supplies]) {
        assert.ok(Math.hypot(cache.x - other.x, cache.y - other.y) >= .8);
      }
    }
    const copy = makeDungeonCourse(floor, {extended: true});
    assert.deepEqual(caches, attachScavengerPickups(copy));
  }
});
