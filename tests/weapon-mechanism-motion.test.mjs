import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOssuary, animateOssuary } from '../weapon-ossuary.js';
import { createBreach, animateBreach } from '../weapon-breach.js';
import { createArc, animateArc } from '../weapon-arc.js';
import { createReliquary, animateReliquary } from '../weapon-reliquary.js';
import { batchStaticWeaponMeshes } from '../weapon-batching.js';

const step = (animate, root, shot, time = 0, dt = .016) => animate(root, shot, time, dt);
const ossuaryStep = (root, shot, time, dt) => animateOssuary(root, shot, time, dt);
const breachStep = (root, shot, time, dt) => animateBreach(root, time, shot, dt);
const arcStep = (root, shot, time, dt) => animateArc(root, time, shot, dt);
const reliquaryStep = (root, shot, time, dt) => animateReliquary(root, shot, time, dt);

test('weapon mechanisms give each shot a distinct lightweight motion cue', () => {
  const ossuary = createOssuary();
  const jawIdle = ossuary.userData.ossuary.jaw.rotation.x;
  const jawGapIdle = Math.abs(ossuary.userData.ossuary.jawRight.position.x - ossuary.userData.ossuary.jawLeft.position.x);
  step(ossuaryStep, ossuary, 1, 0, .016);
  assert.notEqual(ossuary.userData.ossuary.jaw.rotation.x, jawIdle, 'Ossuary jaw should tension on a shot');
  assert.ok(ossuary.userData.ossuary.jawTension > 0, 'Ossuary jaw tension should be stateful');
  const jawGapShot = Math.abs(ossuary.userData.ossuary.jawRight.position.x - ossuary.userData.ossuary.jawLeft.position.x);
  assert.ok(jawGapShot > jawGapIdle + .1, 'Ossuary jaw members should physically open around the bore');
  assert.ok(ossuary.userData.ossuary.jawOpening > .8, 'Ossuary aperture opening should be immediate on a shot');

  const breach = createBreach();
  step(breachStep, breach, 0, 0, .016);
  const valveRest = breach.userData.breach.pressureValve.position.y;
  step(breachStep, breach, 1, .016, .016);
  assert.ok(breach.userData.breach.pressureValve.position.y > valveRest, 'Breach pressure valves should lift on a shot');
  assert.ok(breach.userData.breach.ribcage.scale.x > 1, 'Breach rib cage should expand under pressure');

  const arc = createArc();
  step(arcStep, arc, 0, 0, .016);
  const cageRest = arc.userData.arc.baffles.scale.x;
  step(arcStep, arc, 1, .016, .016);
  assert.ok(arc.userData.arc.baffles.scale.x > cageRest, 'Arc charge cage should open on a shot');
  assert.ok(arc.userData.arc.cagePulse > 0, 'Arc cage pulse should be stateful');

  const reliquary = createReliquary();
  step(reliquaryStep, reliquary, 0, 0, .016);
  const clawRest = reliquary.userData.reliquary.muzzleClaws.scale.x;
  const clawGapIdle = Math.abs(reliquary.userData.reliquary.clawRight.position.x - reliquary.userData.reliquary.clawLeft.position.x);
  step(reliquaryStep, reliquary, 1, .016, .016);
  assert.ok(reliquary.userData.reliquary.muzzleClaws.scale.x > clawRest, 'Reliquary claws should part on a shot');
  assert.ok(reliquary.userData.reliquary.ritualPulse > 0, 'Reliquary ritual pulse should be stateful');
  const clawGapShot = Math.abs(reliquary.userData.reliquary.clawRight.position.x - reliquary.userData.reliquary.clawLeft.position.x);
  assert.ok(clawGapShot > clawGapIdle + .1, 'Reliquary claw members should reveal the muzzle aperture');
  assert.ok(reliquary.userData.reliquary.clawOpening > .8, 'Reliquary aperture opening should be immediate on a shot');

  for (let i = 0; i < 120; i++) {
    step(ossuaryStep, ossuary, 0, .032 + i * .016, .016);
    step(breachStep, breach, 0, .032 + i * .016, .016);
    step(arcStep, arc, 0, .032 + i * .016, .016);
    step(reliquaryStep, reliquary, 0, .032 + i * .016, .016);
  }
  assert.ok(ossuary.userData.ossuary.jawTension < .02, 'Ossuary jaw should return to idle');
  assert.ok(breach.userData.breach.pressurePulse < .02, 'Breach pressure should bleed off');
  assert.ok(arc.userData.arc.cagePulse < .02, 'Arc cage pulse should settle');
  assert.ok(reliquary.userData.reliquary.ritualPulse < .02, 'Reliquary ritual should return');
  assert.ok(ossuary.userData.ossuary.jawOpening < .02, 'Ossuary jaw opening should return to rest');
  assert.ok(reliquary.userData.reliquary.clawOpening < .02, 'Reliquary claw opening should return to rest');
});

test('batched runtime weapons keep live Ossuary and Reliquary mechanism meshes', () => {
  const ossuary = createOssuary();
  const ossuaryJaw = ossuary.userData.ossuary.jawLeft;
  const ossuaryJawParent = ossuaryJaw.parent;
  const reliquary = createReliquary();
  const reliquaryClaw = reliquary.userData.reliquary.clawLeft;
  const reliquaryHinge = reliquary.userData.reliquary.clawHingeLeft;
  const reliquaryClawParent = reliquaryClaw.parent;
  const reliquaryHingeRest = reliquaryHinge.position.clone();

  batchStaticWeaponMeshes(ossuary);
  batchStaticWeaponMeshes(reliquary);

  assert.equal(ossuary.getObjectByName('jaw-left'), ossuaryJaw, 'Ossuary jaw mesh should remain attached after batching');
  assert.equal(ossuaryJaw.parent, ossuaryJawParent, 'Ossuary jaw pivot should remain the animation parent');
  assert.equal(reliquary.getObjectByName('aperture-claw-left'), reliquaryClaw, 'Reliquary claw mesh should remain attached after batching');
  assert.equal(reliquaryClaw.parent, reliquaryClawParent, 'Reliquary claw pivot should remain the animation parent');

  ossuaryStep(ossuary, 1, 0, .016);
  reliquaryStep(reliquary, 1, 0, .016);
  assert.ok(ossuaryJaw.visible && Math.abs(ossuaryJaw.position.x) > .06, 'active Ossuary jaw mesh should travel after batching');
  assert.ok(reliquaryClaw.visible && Math.abs(reliquaryClaw.position.x) > .06, 'active Reliquary claw mesh should travel after batching');
  assert.equal(reliquaryHinge.position.x, reliquaryHingeRest.x - .082, 'Reliquary hinge should preserve authored base x plus shot travel');
  assert.equal(reliquaryHinge.position.y, reliquaryHingeRest.y + .018, 'Reliquary hinge should preserve authored base y plus shot travel');
});
