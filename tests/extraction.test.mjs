import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCourse, newRun, tickPlayer, grapple } from '../engine.js';

const makeExtractionRun = (id = 701) => {
  const course = makeCourse(0);
  course.enemies = [{
    id,
    x: 6,
    y: 9.72,
    z: 0,
    hp: 0,
    maxHp: 5,
    kind: 0,
    variant: 'stalker',
    dead: true,
    meleeZ: 0,
    flash: 0,
    attack: 99,
    phase: 0,
  }];
  const run = newRun(course);
  run.mode = 'play';
  run.x = 6;
  run.y = 10.5;
  run.angle = -Math.PI / 2;
  run.settings = { gore: true };
  return { run, corpse: course.enemies[0] };
};

const step = (run, input = { harvest: true }, count = 1) => {
  for (let i = 0; i < count; i += 1) tickPlayer(run, .05, input);
};

const complete = (run) => {
  const phases = new Set();
  for (let i = 0; i < 100 && !run.course.enemies[0].extracted; i += 1) {
    step(run);
    if (run.extraction.phase !== 'idle') phases.add(run.extraction.phase);
  }
  return phases;
};

test('candidate requires a nearby corpse, facing, and an unobstructed ray', () => {
  const { run, corpse } = makeExtractionRun(711);
  step(run, {});
  assert.equal(run.extractCandidateId, corpse.id);

  run.angle = 0;
  step(run, {});
  assert.equal(run.extractCandidateId, null, 'a corpse behind the player is not a candidate');

  run.angle = -Math.PI / 2;
  corpse.y = 9.1;
  step(run, {});
  assert.equal(run.extractCandidateId, null, 'a corpse outside the kneeling range is not a candidate');

  corpse.y = 9.72;
  run.course.cells[10 * run.course.w + 6][0] = 1;
  step(run, {});
  assert.equal(run.extractCandidateId, null, 'a wall between player and corpse blocks extraction');
});

test('holding harvest advances draw, incise, and rip without scoring early', () => {
  const { run, corpse } = makeExtractionRun(712);
  const before = { style: run.style, styleTotal: run.styleTotal, pending: run.stylePending };
  step(run);
  assert.equal(run.extraction.phase, 'draw');
  assert.equal(run.style, before.style);
  assert.equal(run.styleTotal, before.styleTotal);
  assert.equal(run.stylePending, before.pending);

  const phases = complete(run);
  assert.deepEqual([...phases].sort(), ['draw', 'incise', 'rip']);
  assert.equal(corpse.extracted, true);
  assert.equal(run.extraction.phase, 'idle');
  assert.ok(run.style > before.style, 'only completion banks style');
  assert.ok(run.styleTotal > before.styleTotal, 'completion adds to lifetime points');
  assert.equal(run.stylePending, before.pending, 'the pending claim is consumed by the bank');
  const completed = run.events.filter(event => event.type === 'extract-complete');
  assert.equal(completed.length, 1);
  assert.deepEqual(run.events.filter(event => event.type.startsWith('extract-')).map(event => event.type), [
    'extract-start', 'extract-draw', 'extract-incise', 'extract-rip', 'extract-complete',
  ]);
  assert.equal(completed[0].points, run.extractionPoints);
  assert.ok(completed[0].banked >= 0 && completed[0].banked <= 180);
  assert.ok(completed[0].bonus >= 72 && completed[0].bonus <= 108);
  assert.ok(run.gore.length>0&&run.blood.length>=3,'a completed rip leaves bounded gore and floor blood');
});

test('combat claims remain unbanked until a heart is extracted', () => {
  const { run, corpse } = makeExtractionRun(715);
  corpse.dead = false;
  corpse.hp = 5;
  assert.equal(grapple(run), true);
  assert.ok(run.stylePending > 0);
  assert.equal(run.style, 0);
  assert.equal(run.styleTotal, 0, 'the lifetime point count is gated too');
  corpse.dead = true;
  corpse.hp = 0;
  run.hookTime = 0;
  complete(run);
  assert.equal(corpse.extracted, true);
  assert.equal(run.styleTotal, run.extractionPoints);
  assert.ok(run.stylePending < 35);
});

test('release, movement, damage, and firing cancel an extraction with no reward', () => {
  for (const [input, reason] of [
    [{ harvest: false }, 'released'],
    [{ harvest: true, forward: 1 }, 'movement'],
    [{ harvest: true, fire: true }, 'weapon'],
  ]) {
    const { run, corpse } = makeExtractionRun(720 + reason.length);
    step(run);
    const before = run.style;
    if (reason === 'damage') run.damage = 1;
    step(run, input);
    assert.equal(run.extraction.phase, 'idle');
    assert.equal(corpse.extracted, undefined);
    assert.equal(run.style, before);
    assert.equal(run.events.at(-1).type, 'extract-cancel');
    assert.equal(run.events.at(-1).reason, reason);
  }

  const damaged = makeExtractionRun(729);
  step(damaged.run);
  damaged.run.damage = 1;
  const beforeDamage = damaged.run.style;
  step(damaged.run);
  assert.equal(damaged.run.events.at(-1).reason, 'damage');
  assert.equal(damaged.run.style, beforeDamage);
});

test('each corpse gets a stable procedural seed and different bodies vary', () => {
  const first = makeExtractionRun(731);
  const second = makeExtractionRun(732);
  step(first.run);
  step(second.run);
  assert.ok(first.run.extraction.seed > 0);
  assert.notEqual(first.run.extraction.seed, second.run.extraction.seed);
  assert.notDeepEqual(first.run.extraction.variation, second.run.extraction.variation);

  const replay = makeExtractionRun(731);
  step(replay.run);
  assert.equal(replay.run.extraction.seed, first.run.extraction.seed);
  assert.deepEqual(replay.run.extraction.variation, first.run.extraction.variation);
});

test('a completed heart cannot be harvested or rewarded twice', () => {
  const { run, corpse } = makeExtractionRun(741);
  complete(run);
  const style = run.style;
  const total = run.styleTotal;
  step(run);
  step(run, { harvest: true }, 100);
  assert.equal(corpse.extracted, true);
  assert.equal(run.style, style);
  assert.equal(run.styleTotal, total);
  assert.equal(run.events.filter(event => event.type === 'extract-complete').length, 1);
  assert.equal(run.extractCandidateId, null);
});

test('gore preference suppresses gore decoration while keeping the score gate', () => {
  const { run, corpse } = makeExtractionRun(751);
  run.settings.gore = false;
  complete(run);
  const event = run.events.find(item => item.type === 'extract-complete');
  assert.equal(corpse.extracted, true);
  assert.ok(run.style > 0);
  assert.equal(event.gore, false);
  assert.equal(run.gore.length, 0);
});

test('guest prediction can show progress but cannot bank or consume a corpse', () => {
  const { run, corpse } = makeExtractionRun(761);
  for (let i = 0; i < 100; i += 1) step(run, { harvest: true, predictWeapons: true });
  assert.equal(corpse.extracted, undefined);
  assert.equal(run.style, 0);
  assert.equal(run.styleTotal, 0);
  assert.equal(run.stylePending, 0);
  assert.equal(run.extractions, 0);
  assert.equal(run.events.some(event => event.type === 'extract-complete'), false);
  assert.equal(run.extraction.predicted, true);
});

test('holding extraction overrides auto-run without allowing movement to harvest', () => {
  const {run,corpse}=makeExtractionRun(771);
  run.autoRun=true;
  complete(run);
  assert.equal(corpse.extracted,true);
  assert.ok(Math.hypot(run.x-6,run.y-10.5)<.025);
  const moving=makeExtractionRun(772);
  moving.run.autoRun=true;
  step(moving.run,{harvest:true,forward:1},12);
  assert.equal(moving.corpse.extracted,undefined);
  assert.equal(moving.run.extraction.phase,'idle');
});
