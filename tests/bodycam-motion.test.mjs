import test from 'node:test';
import assert from 'node:assert/strict';
import { BodycamMotion } from '../bodycam-motion.js';

const makeRun = () => ({ course: {}, x: 0, y: 0, angle: 0, pitch: 0, vx: 0, vy: 0, z: 0, vz: 0, distance: 0, aim: 0 });
test('chest mount responds to travel and turn, then settles without changing aim', () => {
  const mount = new BodycamMotion(), run = makeRun();
  mount.update(run, 1 / 60);
  run.vx = 1.6; run.vy = .5; run.angle = .04; run.distance = .2;
  const pose = { ...mount.update(run, 1 / 60, { now: 16 }) };
  assert.ok(Math.abs(pose.x) > 0 && Math.abs(pose.roll) > .001);
  assert.equal(run.angle, .04); assert.equal(run.pitch, 0);
  run.vx = run.vy = 0;
  for (let i = 2; i < 240; i++) mount.update(run, 1 / 60, { now: i * 1000 / 60 });
  assert.ok(Math.abs(mount.pose.x) < 1e-8 && Math.abs(mount.pose.roll) < 1e-8);
  assert.ok(Math.abs(mount.pose.y + .14) < 1e-8);
});
test('mount motion has the same response at 30, 60 and 144 Hz', () => {
  const sample = hz => {
    const mount = new BodycamMotion(), run = makeRun();
    mount.update(run, 1 / hz);
    run.vx = 1.4; run.vy = .7;
    for (let i = 1; i <= hz; i++) {
      run.angle = i / hz * .5; run.distance = i / hz * 1.6;
      mount.update(run, 1 / hz, { now: i / hz * 1000 });
    }
    return mount.pose;
  };
  const reference = sample(144);
  for (const hz of [30, 60]) {
    const pose = sample(hz);
    for (const key of ['x', 'y', 'pitch', 'roll']) assert.ok(Math.abs(pose[key] - reference[key]) < .001, `${key} at ${hz} Hz`);
  }
});
test('landing responds once, cuts reset history, and accessibility removes mount motion', () => {
  const mount = new BodycamMotion(), run = makeRun();
  mount.update(run, .016);
  run.z = .4; run.vz = -2;
  mount.update(run, .016, { now: 16 });
  run.z = 0;
  mount.update(run, .016, { now: 32 });
  assert.ok(mount.update(run, .016, { now: 48 }).y < -.14);
  run.x = 10;
  const reset = mount.update(run, .016, { now: 64 });
  assert.equal(reset.roll, 0); assert.equal(reset.y, -.14);
  assert.deepEqual(mount.update(run, .016, { reducedMotion: true }), { x: 0, y: 0, pitch: 0, roll: 0 });
  assert.deepEqual(mount.update(run, .016, { enabled: false }), { x: 0, y: 0, pitch: 0, roll: 0 });
});
