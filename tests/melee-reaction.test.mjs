import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {
  createMeleeReaction,
  getMeleeReactionDiagnostics,
  resetMeleeReaction,
  restoreMeleeReaction,
  updateMeleeReaction,
} from '../melee-reaction.js';

function makeRig(names = [
  'Hips', 'Spine01', 'Spine02', 'Neck', 'Head',
  'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
  'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg',
]) {
  const root = new THREE.Group();
  let parent = root;
  const bones = {};
  for (const name of names) {
    const bone = new THREE.Bone();
    bone.name = name;
    parent.add(bone);
    bones[name] = bone;
    parent = bone;
  }
  root.updateMatrixWorld(true);
  return {root, bones};
}

function quatSnapshot(rig) {
  const result = {};
  rig.root.traverse(object => {
    if (object.isBone) result[object.name] = object.quaternion.clone();
  });
  return result;
}

function maxQuaternionDelta(before, after) {
  let maximum = 0;
  for (const name of Object.keys(before)) maximum = Math.max(maximum, 1 - Math.abs(before[name].dot(after[name])));
  return maximum;
}

test('creates a bounded overlay from the authored named bones and restores exactly', () => {
  const rig = makeRig();
  const state = createMeleeReaction(rig.root, {seed: 7});
  assert.equal(state.diagnostics.boneCount, 13);
  assert.ok(state.bones.spine01);
  assert.ok(state.bones.spine02);
  const bind = quatSnapshot(rig);

  updateMeleeReaction(state, {meleeHitId: 1, meleeHitAngle: 0, meleeKind: 'bat', meleePower: 1}, 1 / 60, 0);
  const hit = quatSnapshot(rig);
  assert.ok(maxQuaternionDelta(bind, hit) > 1e-8, 'bat impact should visibly offset at least one joint');
  assert.equal(getMeleeReactionDiagnostics(state).finite, true);
  restoreMeleeReaction(state);
  assert.ok(maxQuaternionDelta(bind, quatSnapshot(rig)) < 1e-10, 'restore removes the additive overlay without touching the mixer pose');
});

test('repeated mixer and reaction frames do not accumulate quaternion drift', () => {
  const rig = makeRig();
  const state = createMeleeReaction(rig.root, {seed: 12});
  const bind = quatSnapshot(rig);
  for (let frame = 0; frame < 240; frame++) {
    // Simulate the animation mixer changing a pose before the reaction pass.
    rig.bones.Spine02.rotation.x = Math.sin(frame * .08) * .08;
    rig.bones.Head.rotation.z = Math.cos(frame * .05) * .05;
    rig.root.updateMatrixWorld(true);
    updateMeleeReaction(state, {
      meleeHitId: frame === 8 ? 1 : 1,
      meleeHitAngle: .4,
      meleeKind: 'bat',
      meleePower: 1,
    }, 1 / 60, .1);
    restoreMeleeReaction(state);
  }
  const final = quatSnapshot(rig);
  // Compare only the bones that were never part of the overlay and verify the
  // two animation driven bones remain finite and in the expected small range.
  assert.ok(Number.isFinite(final.Spine02.x));
  assert.ok(Number.isFinite(final.Head.z));
  assert.ok(maxQuaternionDelta(bind, final) < .02, 'idle pose should return without additive drift');
});

test('bat whip is stronger than chainsaw chatter while both remain clamped', () => {
  const batRig = makeRig();
  const bat = createMeleeReaction(batRig.root);
  let batOffset = 0;
  let headPeak = 0;
  let spinePeak = 0;
  for (let frame = 0; frame < 150; frame++) {
    updateMeleeReaction(bat, {meleeHitId: 1, meleeHitAngle: Math.PI / 2, meleeKind: 'bat', meleePower: 1}, 1 / 60, 0);
    batOffset = Math.max(batOffset, getMeleeReactionDiagnostics(bat).maxOffset);
    headPeak = Math.max(headPeak, ...bat.entries.filter(entry => entry.group === 'head').map(entry => Math.abs(entry.x) + Math.abs(entry.y) + Math.abs(entry.z)));
    spinePeak = Math.max(spinePeak, ...bat.entries.filter(entry => entry.group.startsWith('spine')).map(entry => Math.abs(entry.x) + Math.abs(entry.y) + Math.abs(entry.z)));
  }
  assert.ok(headPeak >= .12, `bat head lag should read at ${headPeak} radians`);
  assert.ok(spinePeak >= .12, `bat spine whip should read at ${spinePeak} radians`);
  assert.ok(batOffset <= .72, 'bat remains inside the reaction angle clamp');
  for (let frame = 0; frame < 180; frame++) updateMeleeReaction(bat, {meleeHitId: 1, meleeKind: 'bat', meleePower: 1}, 1 / 60, 0);
  assert.ok(getMeleeReactionDiagnostics(bat).maxOffset < .01, 'living bat reaction settles back into the authored pose');

  const sawRig = makeRig();
  const saw = createMeleeReaction(sawRig.root);
  updateMeleeReaction(saw, {meleeHitId: 1, meleeHitAngle: Math.PI / 2, meleeKind: 'chainsaw', meleePower: .25, meleeActive: true}, 1 / 60, 0);
  const sawOffset = getMeleeReactionDiagnostics(saw).maxOffset;
  assert.ok(batOffset > sawOffset, `bat ${batOffset} should throw more than saw ${sawOffset}`);
  for (let i = 0; i < 180; i++) {
    updateMeleeReaction(saw, {meleeHitId: 1, meleeKind: 'chainsaw', meleePower: .25, meleeActive: true}, .2, 0);
    const diagnostics = getMeleeReactionDiagnostics(saw);
    assert.equal(diagnostics.finite, true);
    assert.ok(diagnostics.maxOffset <= .72, 'reaction angles stay bounded under frame hitches');
  }
});

test('dead hit produces a deterministic asymmetric settled pose', () => {
  const firstRig = makeRig();
  const first = createMeleeReaction(firstRig.root, {seed: 91});
  updateMeleeReaction(first, {dead: true, meleeHitId: 4, meleeHitAngle: -.8, meleeKind: 'bat', meleePower: 1.5}, .5, .2);
  for (let i = 0; i < 180; i++) updateMeleeReaction(first, {dead: true, meleeHitId: 4, meleeKind: 'bat', meleePower: 1.5}, 1 / 60, .2);
  const firstPose = quatSnapshot(firstRig);
  assert.equal(getMeleeReactionDiagnostics(first).dead, true);
  assert.ok(getMeleeReactionDiagnostics(first).maxOffset > .03, 'dead actor keeps a readable flop pose');
  assert.notEqual(firstPose.LeftArm.z, firstPose.RightArm.z, 'death pose is asymmetric');

  const secondRig = makeRig();
  const second = createMeleeReaction(secondRig.root, {seed: 91});
  updateMeleeReaction(second, {dead: true, meleeHitId: 4, meleeHitAngle: -.8, meleeKind: 'bat', meleePower: 1.5}, .5, .2);
  for (let i = 0; i < 180; i++) updateMeleeReaction(second, {dead: true, meleeHitId: 4, meleeKind: 'bat', meleePower: 1.5}, 1 / 60, .2);
  assert.equal(firstPose.Head.x, quatSnapshot(secondRig).Head.x, 'same hit id and seed produce the same settled pose');
});

test('reset clears death pose and handles a partial rig', () => {
  const rig = makeRig(['Hips', 'Spine', 'Head']);
  const state = createMeleeReaction(rig.root);
  assert.equal(state.diagnostics.boneCount, 3);
  updateMeleeReaction(state, {dead: true, meleeHitId: 2, meleeKind: 'chainsaw', meleePower: .25}, .1, 0);
  assert.equal(state.diagnostics.dead, true);
  assert.equal(resetMeleeReaction(state), true);
  assert.equal(getMeleeReactionDiagnostics(state).active, false);
  assert.equal(getMeleeReactionDiagnostics(state).maxOffset, 0);
  assert.equal(state.entries.every(entry => !entry.applied), true);
});

test('ordinary bullet death does not invent a melee flop', () => {
  const rig = makeRig();
  const state = createMeleeReaction(rig.root);
  updateMeleeReaction(state, {dead: true}, .05, 0);
  assert.equal(state.deathArmed, false);
  assert.equal(getMeleeReactionDiagnostics(state).maxOffset, 0);
  assert.equal(getMeleeReactionDiagnostics(state).finite, true);
});
