import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WeaponPresentation, WEAPON_HANDLING } from '../weapon-presentation.js';
import { createSurvivorViewArm } from '../assets/survivor/player-survivor.js';

const run = (weapon = 0) => ({ weapon, angle: 0, pitch: 0, x: 0, y: 0, z: 0,
  vx: 0, vy: 0, vz: 0, speed: 0, distance: 0, shot: 0, shotSequence: 0, aim: 0 });
const values = pose => [...Object.values(pose.position), ...Object.values(pose.rotation)];
const snapshot = pose => JSON.parse(JSON.stringify(pose));
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

test('recoil is distinct by weapon, immediate, and settles at 30/60/120 Hz', () => {
  const pitches = new Set();
  for (let weapon = 0; weapon < 6; weapon++) {
    const samples = [];
    for (const fps of [30, 60, 120]) {
      const state = run(weapon), driver = new WeaponPresentation();
      driver.update(state, 1 / fps);
      state.shot = 1;
      const fire = driver.update(state, 1 / fps);
      assert.ok(fire.position.z > .05);
      assert.equal(fire.trigger, 1);
      pitches.add(fire.rotation.x);
      state.shot = 0;
      for (let i = 0; i < fps / 5; i++) driver.update(state, 1 / fps);
      samples.push([driver.pose.position.z, driver.pose.rotation.x]);
      for (let i = 0; i < fps * 2; i++) driver.update(state, 1 / fps);
      assert.ok(Math.abs(driver.pose.recoil) < 1e-6);
    }
    for (const sample of samples.slice(1)) sample.forEach((v, i) => close(v, samples[0][i]));
  }
  assert.equal(pitches.size, 6);
});

test('look lag follows at matched rates and stabilizes while aiming', () => {
  const samples = [];
  for (const fps of [30, 60, 120]) {
    const state = run(), driver = new WeaponPresentation();
    driver.update(state, 1 / fps);
    for (let i = 1; i <= fps / 2; i++) {
      state.angle = i / fps;
      driver.update(state, 1 / fps);
    }
    samples.push(driver.pose.rotation.y);
    const hip = Math.abs(driver.pose.rotation.y);
    state.aim = 1; state.angle += 1 / fps;
    driver.update(state, 1 / fps);
    assert.ok(Math.abs(driver.pose.rotation.y + .02) < hip * .3);
  }
  samples.forEach(v => close(v, samples[0]));
});

test('start/stop drag reverses and settles without persistent idle bob', () => {
  for (const fps of [30, 60, 120]) {
    const state = run(), driver = new WeaponPresentation();
    driver.update(state, 1 / fps);
    state.vx = state.speed = 1.6;
    assert.ok(driver.update(state, 1 / fps).position.z > 0);
    for (let i = 0; i < fps; i++) driver.update(state, 1 / fps);
    state.vx = state.speed = 0;
    assert.ok(driver.update(state, 1 / fps).position.z < 0);
    for (let i = 0; i < fps * 2; i++) driver.update(state, 1 / fps);
    assert.ok(Math.abs(driver.pose.position.z) < 1e-7);
    close(driver.pose.position.x, .02);
  }
});

test('landing produces one bounded dip and settles', () => {
  const samples = [];
  for (const fps of [30, 60, 120]) {
    const state = run(), driver = new WeaponPresentation();
    driver.update(state, 1 / fps);
    state.z = .2; state.vz = -2;
    driver.update(state, 1 / fps);
    state.z = state.vz = 0;
    driver.update(state, 1 / fps);
    for (let i = 0; i < fps / 10; i++) driver.update(state, 1 / fps);
    assert.ok(driver.pose.landing > .1);
    samples.push(driver.pose.landing);
    for (let i = 0; i < fps * 2; i++) driver.update(state, 1 / fps);
    assert.ok(Math.abs(driver.pose.landing) < 1e-9);
  }
  samples.forEach(v => close(v, samples[0]));
});

test('zero/invalid dt does not advance or consume a pending shot', () => {
  const state = run(), driver = new WeaponPresentation();
  driver.update(state, 1 / 60);
  const before = snapshot(driver.pose);
  state.shot = 1;
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(driver.update(state, dt), before);
  assert.equal(driver.update(state, 1 / 60).trigger, 1);
});

test('new run, switch, teleport and long pause clear recoil and look momentum', () => {
  const state = run(4), driver = new WeaponPresentation();
  driver.update(state, 1 / 60, false, 0);
  state.shot = 1; state.shotSequence = 1; state.angle = .05;
  driver.update(state, 1 / 60, false, 16);
  assert.ok(driver.pose.recoil > 0);
  state.weapon = 1; state.shot = 0;
  const switched = driver.update(state, 1 / 60, false, 32);
  assert.equal(switched.equip, 0); assert.equal(switched.recoil, 0); assert.equal(switched.lookLag, 0);
  for (let i = 0; i < 60; i++) driver.update(state, 1 / 60);
  assert.equal(driver.pose.equip, 1);
  assert.equal(driver.update(run(), 1 / 60).recoil, 0);
  driver.update(state, 1 / 60, false, 100);
  state.shot = 1; state.angle += .03;
  driver.update(state, 1 / 60, false, 116);
  assert.ok(driver.pose.recoil > 0);
  // Renderer dt is capped: wall time still identifies a background-tab pause.
  driver.update(state, 1 / 60, false, 2000);
  assert.equal(driver.pose.recoil, 0); assert.equal(driver.pose.lookLag, 0);
  state.x = 100; state.angle = 2;
  driver.update(state, 1 / 60, false, 2016);
  assert.ok(values(driver.pose).every(Number.isFinite));
  assert.equal(driver.pose.lookLag, 0);
});

test('automatic sequence edges repeat without replaying shots on hidden guns', () => {
  const state = run(4), driver = new WeaponPresentation();
  driver.update(state, 1 / 60);
  state.shot = .8; state.shotSequence = 1;
  driver.update(state, 1 / 60);
  for (let i = 0; i < 5; i++) driver.update(state, 1 / 60);
  state.shotSequence = 2;
  assert.ok(driver.update(state, 1 / 60).recoil >= 1);
  state.weapon = 5;
  assert.equal(driver.update(state, 1 / 60).recoil, 0);
  assert.equal(driver.update(state, 1 / 60).recoil, 0);
});

test('reduced motion scales secondary motion while retaining readable firing', () => {
  const results = [];
  for (const reduced of [false, true]) {
    const state = run(1), driver = new WeaponPresentation();
    driver.update(state, 1 / 60, reduced);
    state.angle = .06; state.shot = 1;
    results.push(snapshot(driver.update(state, 1 / 60, reduced)));
  }
  assert.ok(results[1].position.z > 0);
  close(results[1].position.z, results[0].position.z * .5);
  close(results[1].lookLag, results[0].lookLag);
  assert.ok(Math.abs(results[1].position.x - .02) < Math.abs(results[0].position.x - .02) * .2);
});

test('trigger finger articulates without moving palm, socket, or support fingers', () => {
  const right = createSurvivorViewArm(1), left = createSurvivorViewArm(-1);
  const finger = right.userData.triggerFinger;
  assert.ok(finger?.isGroup);
  assert.equal(left.userData.triggerFinger, undefined);
  right.updateMatrixWorld(true);
  const socket = right.userData.gripSocket.matrixWorld.clone();
  const otherFinger = right.getObjectByName('GripFinger1').matrixWorld.clone();
  const index = right.getObjectByName('GripFingertip0');
  const initial = index.matrixWorld.clone();
  finger.rotation.x = -.22;
  right.updateMatrixWorld(true);
  assert.deepEqual(right.userData.gripSocket.matrixWorld.elements, socket.elements);
  assert.deepEqual(right.getObjectByName('GripFinger1').matrixWorld.elements, otherFinger.elements);
  assert.notDeepEqual(index.matrixWorld.elements, initial.elements);
  assert.equal(WEAPON_HANDLING.length, 8);
});
