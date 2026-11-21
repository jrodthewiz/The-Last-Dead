import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialGrid, createWorldData, createColliders } from '../island/data.js';
import { freshState, stepPlayer, supportHeight, canStepUp, STEP_UP } from '../island/simulation.js';

const data = createWorldData();
const grid = new SpatialGrid(createColliders(data));
const forward = { forward: 1, strafe: 0, jump: false, sprint: false };

function run(state, frames, dt, input = forward) {
  let maxRise = 0;
  let maxDrop = 0;
  let last = state.y;
  for (let i = 0; i < frames; i++) {
    stepPlayer(state, input, data, grid, dt);
    maxRise = Math.max(maxRise, state.y - last);
    maxDrop = Math.min(maxDrop, state.y - last);
    last = state.y;
  }
  return { maxRise: +maxRise.toFixed(3), maxDrop: +maxDrop.toFixed(3) };
}

test('step guard accepts a stair riser and refuses anything above one step', () => {
  assert.equal(STEP_UP, 0.45);
  assert.equal(canStepUp(10, 10.4), true, '0.40 m ledge is a step');
  assert.equal(canStepUp(10, 10.45), false, 'exactly one step is already a wall');
  assert.equal(canStepUp(10, 10.5), false, '0.50 m ledge is a wall');
  assert.equal(canStepUp(10, 11.2), false, 'old 1.2 m climb is refused');
});

test('settlement stairs climb at 30, 60 and 120 Hz without a step above the limit', () => {
  for (const hz of [30, 60, 120]) {
    const s = { ...freshState(), x: 1258, z: 220, yaw: -Math.PI / 2 };
    s.y = supportHeight(data, s.x, s.z);
    const y0 = s.y;
    const runResult = run(s, hz * 3, 1 / hz);
    assert.ok(s.y - y0 > 5, `${hz}Hz: climbed ${(s.y - y0).toFixed(2)} m`);
    assert.ok(runResult.maxRise <= STEP_UP + 0.001, `${hz}Hz: max rise ${runResult.maxRise}`);
    assert.ok(s.x < 1250, `${hz}Hz: reached x=${s.x.toFixed(1)}`);
  }
});

test('walking down the stairs never teleports more than one tread in a frame', () => {
  for (const hz of [30, 60, 120]) {
    const s = { ...freshState(), x: 1258, z: 220, yaw: Math.PI / 2 };
    s.y = supportHeight(data, s.x, s.z);
    const y0 = s.y;
    const runResult = run(s, hz * 2, 1 / hz);
    assert.ok(s.y < y0 - 1, `${hz}Hz: descended ${(y0 - s.y).toFixed(2)} m`);
    assert.ok(runResult.maxDrop >= -0.36, `${hz}Hz: max drop ${runResult.maxDrop}`);
  }
});

test('a sprint down the stairs stays inside the same per-frame drop budget', () => {
  for (const hz of [30, 60, 120]) {
    const s = { ...freshState(), x: 1258, z: 220, yaw: Math.PI / 2 };
    s.y = supportHeight(data, s.x, s.z);
    const y0 = s.y;
    const runResult = run(s, hz * 2, 1 / hz, { ...forward, sprint: true });
    assert.ok(s.y < y0 - 1, `${hz}Hz: sprint descended ${(y0 - s.y).toFixed(2)} m`);
    assert.ok(runResult.maxDrop >= -0.36, `${hz}Hz: sprint max drop ${runResult.maxDrop}`);
  }
});

test('standing on the landing stays grounded with zero vertical jitter', () => {
  const s = { ...freshState(), x: 1274, z: 220 };
  s.y = supportHeight(data, s.x, s.z);
  const y0 = s.y;
  let worst = 0;
  for (let i = 0; i < 240; i++) {
    stepPlayer(s, { forward: 0, strafe: 0 }, data, grid, 1 / 60);
    worst = Math.max(worst, Math.abs(s.y - y0));
  }
  assert.ok(worst < 0.001, `drifted ${worst}`);
});


