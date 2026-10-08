import test from 'node:test';
import assert from 'node:assert/strict';
import { newRun, makeCourse, tick, tickPlayer, shoot, switchWeapon, eye, castGroundRay, canStand, brutalCandidate, chestCandidate } from '../engine.js';
import { groundAt, capeGroundHeight, capeStreamZ, capeStreamLevel, CAPE_TERRAIN } from '../coastal-terrain.js';
import { traceEnemyBody, applyAnatomyDamage, locateBodyPart, setEnemyBodyPose } from '../enemy-anatomy.js';

function openTerrain() {
  const course = makeCourse(), w = 112, h = 104;
  course.w = w; course.h = h; course.blocks = [];
  course.cells = Array.from({ length: w * h }, (_, i) => [i < w ? 1 : 0, i % w === w - 1 ? 1 : 0, i >= w * (h - 1) ? 1 : 0, i % w === 0 ? 1 : 0]);
  course.coastal = { terrain: true }; course.playerSpawn = { x: 410 / 4, y: 386 / 4, angle: 0 }; course.enemies = [];
  const r = newRun(course); Object.assign(r, { mode: 'play', wave: 3, waveDelay: 999 }); return r;
}
const infected = changes => ({ id: 81, x: 410 / 4, y: 385 / 4, kind: 0, variant: 'stalker', hp: 100, maxHp: 100, dead: false, phase: 0, flash: 0, attack: 99, facing: Math.PI / 2, wounds: { arm: false, leg: false }, ...changes });
const near = (actual, expected, tolerance = .00001) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} near ${expected}`);

test('player feet follow the terrain while eye samples fresh absolute ground; flat legacy eye stays unchanged', () => {
  const r = openTerrain(), g = groundAt(r.course, r.x, r.y); assert.ok(g > 1.3);
  near(eye(r), g + .4); r.groundZ = -100; near(eye(r), g + .4);
  r.angle = 0;
  for (let i = 0; i < 24; i++) tickPlayer(r, 1 / 120, { forward: 1 });
  assert.equal(r.z, 0); assert.ok(canStand(r.course, r.x, r.y)); near(eye(r), groundAt(r.course, r.x, r.y) + .4);
  const flat = newRun(makeCourse()); flat.z = .2; flat.slide = .5; near(eye(flat), .4 + .2 - .09);
});

test('airborne movement over an uphill grade preserves absolute ballistic foot height rather than adding hill rise', () => {
  const r = openTerrain(); Object.assign(r, { x: 400 / 4, y: 386 / 4, z: .25, vz: .5, vx: 1, vy: 0, dashTime: .18, angle: 0 });
  const groundBefore = groundAt(r.course, r.x, r.y), absoluteBefore = groundBefore + r.z;
  tickPlayer(r, .05, { forward: 1 }); const groundAfter = groundAt(r.course, r.x, r.y);
  assert.ok(groundAfter > groundBefore); near(groundAfter + r.z, absoluteBefore + .5 * .05);
  near(eye(r), absoluteBefore + .5 * .05 + .4); assert.ok(r.z > 0);
  r.dashTime = 0; for (let i = 0; i < 180; i++) tickPlayer(r, 1 / 120, {});
  assert.equal(r.z, 0); assert.equal(r.vz, 0); near(eye(r), groundAt(r.course, r.x, r.y) + .4);
});

test('real elevated marksman hit cuts the aimed leg and emits blood at absolute ray contact', () => {
  const r = openTerrain(), e = infected(); r.course.enemies = [e];
  r.x = e.x - .035; r.y = e.y + .5; r.angle = -Math.PI / 2;
  const enemyGround = groundAt(r.course, e.x, e.y); r.pitch = Math.atan2(enemyGround + .12 - eye(r), .5);
  switchWeapon(r, 5); assert.equal(shoot(r), true);
  near(e.groundZ, enemyGround); assert.equal(e.anatomy?.cuts[0]?.part, 'leftLeg'); assert.equal(e.locomotion, 'crawl');
  assert.ok(e.hp < 100 && e.hp > 0); assert.ok(r.gore.every(p => p.z > 1.4));
  assert.equal(r.tracers[0].surface, 'flesh'); near(r.tracers[0].z, eye(r));
});

test('anatomy fallback hit, part selection and cut fraction are invariant under ground/base translation', () => {
  const flat = infected({ x: 6, y: 6, groundZ: 0 }), high = infected({ x: 6, y: 6, groundZ: 1.4, meleeZ: .15 });
  const ray = { x: 5.965, y: 7, z: .10 }, direction = { x: 0, y: -1, z: 0 };
  const a = traceEnemyBody(flat, ray, direction, 2), b = traceEnemyBody(high, { ...ray, z: ray.z + 1.55 }, direction, 2);
  assert.equal(a.part, 'leftLeg'); assert.equal(b.part, a.part); near(b.distance, a.distance); near(b.fraction, a.fraction);
  assert.equal(traceEnemyBody(high, ray, direction, 2), null, 'zero-plane ray misses raised body');
  const hitA = { x: 5.965, y: 6, z: .12, angle: -Math.PI / 2, pitch: 0 }, hitB = { ...hitA, z: 1.67 };
  assert.equal(locateBodyPart(high, hitB), locateBodyPart(flat, hitA));
  const cutA = applyAnatomyDamage(flat, 7, hitA), cutB = applyAnatomyDamage(high, 7, hitB);
  assert.equal(cutB.part, cutA.part); near(cutB.fraction, cutA.fraction); assert.deepEqual(cutB.tilt, cutA.tilt);
});

test('cached posed capsules shift with authoritative enemy ground and bounce height without mutating pose input', () => {
  const e = infected({ x: 6, y: 6, groundZ: .8, meleeZ: .05 });
  const segments = [{ part: 'torso', a: [6, 1.10, 6], b: [6, 1.205, 6], radius: .06, start: 0, end: 1 }];
  const original = structuredClone(segments); setEnemyBodyPose(e, segments);
  e.x += .2; e.y -= .1; e.groundZ = 1.3; e.meleeZ = .15;
  const result = traceEnemyBody(e, { x: e.x, y: e.y + 1, z: 1.75 }, { x: 0, y: -1, z: 0 }, 2);
  assert.equal(result?.part, 'torso'); near(result.hit.z, 1.75); assert.deepEqual(segments, original);
  assert.equal(traceEnemyBody(e, { x: e.x, y: e.y + 1, z: 1.15 }, { x: 0, y: -1, z: 0 }, 2), null);
});

test('a horizontal shot is stopped by a rising hillside before a target behind the crest', () => {
  const r = openTerrain(); Object.assign(r, { x: 380 / 4, y: 386 / 4, angle: 0, pitch: 0 });
  const e = infected({ x: 412 / 4, y: 386 / 4, kind: 1, variant: 'caster' }); r.course.enemies = [e];
  const distance = castGroundRay(r.course, r.x, r.y, eye(r), 0, 0, 12);
  assert.ok(Number.isFinite(distance) && distance > 0 && distance < e.x - r.x);
  near(eye(r), groundAt(r.course, r.x + distance, r.y) + .01, .000002);
  assert.equal(shoot(r), true); assert.equal(e.hp, 100); assert.equal(r.tracers[0].surface, 'floor'); near(r.tracers[0].tx, r.x + distance, .000002);
  assert.equal(castGroundRay(makeCourse(), 6, 6, .4, 0, 0, 12), Infinity);
  near(castGroundRay(makeCourse(), 6, 6, .4, 0, -.5, 12), .78);
});

test('footbridge deck is ground authority for feet, floor rays and downward rocket impact', () => {
  const r = openTerrain(), x = CAPE_TERRAIN.bridges[0], z = capeStreamZ(x), deck = capeStreamLevel(x) + .65;
  r.x = x / 4; r.y = z / 4; near(groundAt(r.course, r.x, r.y), deck / 4); near(eye(r), deck / 4 + .4);
  assert.ok(capeGroundHeight(x, z, { bridges: false }) < deck - .5);
  const distance = castGroundRay(r.course, r.x, r.y, eye(r), Math.PI / 2, -1, 1); near(distance, .39);
  r.projectiles.push({ id: 201, kind: 'rocket', x: r.x, y: r.y, z: deck / 4 + .12, vx: 0, vy: 0, vz: -1, life: 3, radius: .1, damage: 1, ownerId: 'none' });
  for (let i = 0; i < 24; i++) tick(r, 1 / 120, {});
  assert.equal(r.projectiles.length, 0); const blast = r.explosions.find(p => p.id === 201); assert.ok(blast); near(blast.z, deck / 4);
});

test('raised rockets survive beyond the old absolute ceiling, and floor glob/limb/gore deposits land on the hill', () => {
  const r = openTerrain(), ground = groundAt(r.course, r.x, r.y);
  r.projectiles.push({ id: 301, kind: 'rocket', x: r.x, y: r.y, z: ground + .4, vx: .3, vy: 0, vz: .1, life: 3, radius: .1, damage: 1, ownerId: 'none' });
  tick(r, 1 / 120, {}); assert.ok(r.projectiles.some(p => p.id === 301)); assert.ok(r.projectiles[0].z > 1.5);
  const x = r.x + .6, y = r.y, localGround = groundAt(r.course, x, y);
  r.projectiles.push({ id: 302, kind: 'enemy', glob: true, x, y, z: localGround + .02, vx: 0, vy: 0, vz: -1, life: 3, age: 0, wobAmp: 0, splashRadius: 0, damage: 1 });
  r.gore.push({ id: 303, x, y, z: localGround + .015, vx: 0, vy: 0, vz: -1, life: 1 });
  r.limbs.push({ id: 304, kind: 'head', x, y, z: localGround + .015, vx: 0, vy: 0, vz: -1, life: 3, spin: 0, rest: false });
  for (let i = 0; i < 8; i++) tick(r, 1 / 120, {});
  assert.equal(r.projectiles.some(p => p.id === 302), false); near(r.pools.find(p => p.id === 302).z, localGround);
  near(r.gore.find(p => p.id === 303).z, localGround); const limb = r.limbs.find(p => p.id === 304); assert.equal(limb.rest, true); near(limb.z, localGround);
  assert.ok(r.blood.every(b => Math.abs(b.z - groundAt(r.course, b.x, b.y)) < .000001));
});

test('enemy base refresh follows authoritative movement, and an uphill caster produces a finite grounded glob', () => {
  const r = openTerrain(); Object.assign(r, { x: 410 / 4, y: 386 / 4 });
  const e = infected({ x: 400 / 4, y: 386 / 4, kind: 1, variant: 'caster', groundZ: -5, moveSpeed: .6, attack: 99 }); r.course.enemies = [e];
  const originalX = e.x; tick(r, .05, {}); assert.ok(e.x !== originalX); near(e.groundZ, groundAt(r.course, e.x, e.y));
  Object.assign(e, { attacking: true, windup: 0, attack: 0, strike: 0 }); tick(r, 1 / 120, {});
  const glob = r.projectiles.find(p => p.glob); assert.ok(glob);
  assert.ok([glob.x, glob.y, glob.z, glob.vx, glob.vy, glob.vz].every(Number.isFinite));
  assert.ok(glob.z > e.groundZ + .3); assert.ok(r.events.some(event => event.type === 'enemy-attack' && event.z > e.groundZ + .3));
});

test('melee and bite cannot connect across the bridge-to-ford vertical gap despite close horizontal distance', () => {
  const r = openTerrain(), bx = CAPE_TERRAIN.bridges[0], z = capeStreamZ(bx);
  r.x = (bx + 1.9) / 4; r.y = z / 4; r.angle = 0;
  const e = infected({ x: (bx + 2.2) / 4, y: r.y, attack: 0, kind: 0, variant: 'stalker' }); r.course.enemies = [e];
  const difference = groundAt(r.course, r.x, r.y) - groundAt(r.course, e.x, e.y);
  assert.ok(difference > .3 && Math.hypot(e.x - r.x, e.y - r.y) < .34);
  tick(r, 1 / 120, {}); assert.equal(e.attacking, false); assert.equal(r.health, 100);
  switchWeapon(r, 6); shoot(r); for (let i = 0; i < 80; i++) tickPlayer(r, 1 / 120, {});
  assert.equal(e.hp, 100, 'bat contact is above the lower enemy body');
});

test('an overhead rocket detonation uses vertical blast distance and cannot give a ground player a remote rocket jump', () => {
  const r = openTerrain(), e = infected({ x: r.x, y: r.y }); r.course.enemies = [e];
  switchWeapon(r, 3);
  r.projectiles.push({ id: 401, kind: 'rocket', x: r.x, y: r.y, z: groundAt(r.course, r.x, r.y) + 2, vx: 0, vy: 0, vz: 0, life: 3, radius: .5, damage: 24, ownerId: 'host', selfBoost: true });
  assert.equal(shoot(r, true), true); assert.equal(e.hp, 100); assert.equal(r.vz, 0);
  assert.equal(r.events.some(event => event.type === 'rocket-jump'), false);
});

test('elevated combat readiness samples fresh ground and posed capsules without modifying cached authority', () => {
  const r = openTerrain(), e = infected({ x: r.x + .24, y: r.y, groundZ: -4, hp: 60, maxHp: 100, stagger: .3 });
  r.course.enemies = [e]; r.angle = 0;
  // A previously cached rig pose is deliberately based on the stale base.
  // The selector must keep the WeakMap identity and shift it to fresh terrain.
  setEnemyBodyPose(e, [{ part: 'head', a: [e.x, -3.57, e.y], b: [e.x, -3.54, e.y], radius: .07, start: .8, end: 1 }]);
  const before = JSON.stringify(r);
  assert.equal(brutalCandidate(r), null, 'crown aim remains a directed slice after the fresh-ground shift');
  assert.deepEqual(chestCandidate(r), { enemyId: e.id, kind: 'pierce', side: 'right' });
  assert.equal(JSON.stringify(r), before, 'readiness leaves the complete run unchanged');
  assert.equal(e.groundZ, -4);
});
