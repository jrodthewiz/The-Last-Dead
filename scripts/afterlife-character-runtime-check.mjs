// Runtime contract check for the authored Ash Witness clips.
// This uses a tiny synthetic template so it stays fast and does not need a
// browser, a server, or a second copy of the shipped GLB. It verifies the
// engine-facing flags, one-shot timing, blended handoff, and mixer disposal.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {
  createAfterlifeModel,
  disposeAfterlifeModel,
  animateAfterlifeModel,
} from '../npc-afterlife-model.js';

const clip = (name, duration, delta) => new THREE.AnimationClip(name, duration, [
  new THREE.NumberKeyframeTrack('.rotation[y]', [0, duration], [0, delta]),
]);

const template = new THREE.Group();
template.name = 'SyntheticAshWitnessTemplate';
const albedo = new THREE.Texture();
const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(.46, 1.86, .34),
  new THREE.MeshStandardMaterial({color: 0x999999, map:albedo, emissive:0xffffff, emissiveMap:albedo}),
);
mesh.position.y = .93;
template.add(mesh);
const asset = {
  template,
  clips: [
    clip('AshWitness_Idle', 2.416667, .02),
    clip('AshWitness_Shuffle', 1.5, .16),
    clip('AshWitness_AttackLunge', .833333, .35),
    clip('AshWitness_HitRecoil', .583333, -.28),
    clip('AshWitness_Collapse', 1.833333, 1.2),
  ],
};

const root = createAfterlifeModel(asset, 0, 7);
assert(root, 'model root created');
const state = root.userData.afterlife;
assert(state?.mixer, 'animation mixer created');
assert.equal(state.materials[0].map, albedo, 'the shared authored albedo is retained');
assert.equal(state.materials[0].emissive.getHex(), 0, 'exported full-strength emission is removed');
assert.equal(state.materials[0].emissiveMap, null, 'skin texture is not an emission map');
assert.equal(mesh.material.emissive.getHex(), 0xffffff, 'source template remains untouched');

const idle = {attacking:false, attack:0, strike:0, hits:0, flash:0, stagger:0, dead:false};
animateAfterlifeModel(root, idle, 0, 7);
assert.equal(state.attackActive, false, 'idle attack cooldown does not trigger lunge');
assert.equal(state.warningRing.visible, false, 'idle attack cooldown does not show telegraph');
assert.equal(state.actions.attack.getEffectiveWeight(), 0, 'idle attack weight remains zero');
assert.ok(state.actions.idle.getEffectiveWeight() > .9, 'idle action owns the initial pose');

const windup = {...idle, attacking:true, windup:.28};
animateAfterlifeModel(root, windup, 100, 7);
assert.equal(state.attackActive, true, 'explicit windup starts attack clip');
assert.equal(state.materials[0].emissiveIntensity, 0, 'windup does not restore full-body emission');
assert.equal(state.clipBlend?.key, 'attack', 'attack blend is identified');
assert.ok(state.actions.attack.getEffectiveWeight() < .2, 'attack enters through a blend envelope');
animateAfterlifeModel(root, windup, 160, 7);
assert.ok(state.actions.attack.getEffectiveWeight() > .2 && state.actions.attack.getEffectiveWeight() < 1.01, 'attack blend progresses');

// The engine clears attacking at strike, but the visual lunge remains live for
// the rest of its authored clip. This preserves contact/recovery timing.
const strike = {...idle, attacking:false, strike:.24};
animateAfterlifeModel(root, strike, 280, 7);
assert.equal(state.warning, true, 'strike keeps the telegraph readable');
assert.equal(state.attackActive, true, 'strike does not cancel the lunge');
for(let now=330; now<=1180; now+=50)animateAfterlifeModel(root, {...idle, strike:0}, now, 7);
assert.equal(state.attackActive, false, 'attack ends after clip duration');
assert.equal(state.actions.attack.getEffectiveWeight(), 0, 'attack action releases its weight');

animateAfterlifeModel(root, {...idle, hits:1, flash:.16, stagger:.12}, 1230, 7);
assert.equal(state.hitActive, true, 'hit edge starts recoil clip');
assert.equal(state.clipBlend?.key, 'hit', 'hit blend is identified');
assert.ok(state.actions.hit.getEffectiveWeight() < .2, 'hit enters through a blend envelope');
for(let now=1280; now<=1880; now+=50)animateAfterlifeModel(root, {...idle, hits:1}, now, 7);
assert.equal(state.hitActive, false, 'hit ends after clip duration');
assert.equal(state.actions.hit.getEffectiveWeight(), 0, 'hit action releases its weight');

animateAfterlifeModel(root, {...idle, dead:true}, 1930, 7);
assert.equal(state.collapseStarted, true, 'dead edge starts collapse');
assert.equal(state.actions.collapse.getEffectiveWeight(), 1, 'collapse owns the dead pose');

disposeAfterlifeModel(root);
assert.equal(state.mixer, null, 'mixer is released on disposal');
assert.deepEqual(state.actions, {}, 'actions are cleared on disposal');

console.log(JSON.stringify({
  ok:true,
  contract:'explicit attacking/strike only; attack .833s; hit .583s; collapse LoopOnce',
  blendInSeconds:state.shotBlendIn,
  blendOutSeconds:state.shotBlendOut,
  checks:['idle cooldown gate','attack windup/strike/recovery','hit recoil edge','collapse','mixer disposal'],
}, null, 2));
