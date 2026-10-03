import test from 'node:test';
import assert from 'node:assert/strict';
import { DevFlight } from '../dev-flight.js';
const player = { x: 2, y: 3, z: 0, slide: 0, angle: 0, pitch: 0 };
test('hover remains fixed and Q/E altitude keys cancel even with duplicate bindings held',()=>{
  const flight=new DevFlight();flight.enter(player);const origin={...flight.pose};
  flight.update(.1,new Set());assert.deepEqual(flight.pose,origin);
  flight.update(.1,new Set(['KeyE','Space','KeyQ']));assert.deepEqual(flight.pose,origin);
  flight.update(.1,new Set(['KeyE']));assert.ok(Math.abs(flight.pose.y-origin.y-1.2)<1e-9);
  flight.update(.1,new Set(['KeyQ']));assert.ok(Math.abs(flight.pose.y-origin.y)<1e-9);
});
test('flight moves independently in world metres with no collision or gravity', () => {
  const run = structuredClone(player), flight = new DevFlight();
  flight.enter(run);
  assert.deepEqual(flight.pose, { x: 8, y: 1.6, z: 12, angle: 0, pitch: 0 });
  flight.update(.1, new Set(['KeyW', 'Space']));
  assert.ok(flight.pose.x > 8 && flight.pose.y > 1.6);
  assert.ok(Math.abs(Math.hypot(flight.pose.x - 8, flight.pose.y - 1.6) - 1.2) < 1e-9);
  flight.update(.1, new Set(['ControlLeft', 'ShiftLeft']));
  assert.ok(flight.pose.y < 0, 'can inspect below the floor');
  assert.deepEqual(run, player, 'player simulation is untouched');
  flight.reset(); assert.equal(flight.pose.x, 8);
  flight.leave(); flight.update(.1, new Set(['KeyW'])); assert.equal(flight.pose.x, 8);
});
test('look is clamped, speeds bounded, and movement is frame-rate independent', () => {
  const a = new DevFlight(), b = new DevFlight(); a.enter(player); b.enter(player);
  a.look(0, -10000); assert.ok(a.pose.pitch < Math.PI / 2);
  a.reset(); for (let i = 0; i < 60; i++) a.update(1 / 60, new Set(['KeyW']));
  for (let i = 0; i < 120; i++) b.update(1 / 120, new Set(['KeyW']));
  assert.ok(Math.abs(a.pose.x - b.pose.x) < 1e-9);
  for (let i = 0; i < 100; i++) a.changeSpeed(1); assert.equal(a.speed, 96);
  for (let i = 0; i < 100; i++) a.changeSpeed(-1); assert.equal(a.speed, 1);
});
