import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeCourse, newRun, parry, shoot, tick } from '../engine.js';
import {
  createAfterlifeModel,
  animateAfterlifeModel,
  disposeAfterlifeModel,
} from '../npc-afterlife-model.js';

const clip = (name, duration, delta) => new THREE.AnimationClip(name, duration, [
  new THREE.NumberKeyframeTrack('.rotation[y]', [0, duration], [0, delta]),
]);

function syntheticAsset() {
  const template = new THREE.Group();
  template.name = 'SyntheticAshWitnessTemplate';
  const albedo = new THREE.Texture();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(.46, 1.86, .34),
    new THREE.MeshStandardMaterial({
      color: 0x999999,
      map: albedo,
      emissive: 0xffffff,
      emissiveMap: albedo,
    }),
  );
  mesh.position.y = .93;
  template.add(mesh);
  return {
    template,
    clips: [
      clip('AshWitness_Idle', 2.416667, .02),
      clip('AshWitness_Shuffle', 1.5, .16),
      clip('AshWitness_AttackLunge', .833333, .35),
      clip('AshWitness_HitRecoil', .583333, -.28),
      clip('AshWitness_Collapse', 1.833333, 1.2),
    ],
  };
}

function encounter({hp = 100, attack = 20, y = 4.72} = {}) {
  const course = makeCourse(0);
  const run = newRun(course);
  Object.assign(run, {
    mode: 'play',
    x: 6,
    y: 5,
    angle: -Math.PI / 2,
    pitch: 0,
    weapon: 0,
  });
  run.cooldowns.fill(0);
  const enemy = {
    id: 93011,
    x: 6,
    y,
    z: 0,
    hp,
    maxHp: hp,
    kind: 0,
    variant: 'stalker',
    attack,
    attacking: false,
    windup: 0,
    strike: 0,
    hits: 0,
    flash: 0,
    stagger: 0,
    dead: false,
    phase: 0,
  };
  course.enemies = [enemy];
  return {run, enemy};
}

function modelFor(asset) {
  const root = createAfterlifeModel(asset, 0, 7);
  assert(root, 'synthetic Ash Witness root created');
  assert(root.userData.afterlife?.mixer, 'synthetic Ash Witness mixer created');
  return root;
}

test('a real hit during windup keeps attack contact paired with the attack clip', () => {
  const asset = syntheticAsset();
  const root = modelFor(asset);
  const state = root.userData.afterlife;
  const {run, enemy} = encounter({attack: 0});
  let now = 0;
  const frame = () => {
    tick(run, 1 / 60, {});
    now += 1000 / 60;
    animateAfterlifeModel(root, enemy, now, 7);
  };

  try {
    frame();
    assert.equal(enemy.attacking, true, 'the first frame enters the real windup');
    assert.equal(state.attackActive, true, 'windup starts the attack clip');

    assert.equal(shoot(run), true, 'Ossuary fires during the real windup');
    now += 1000 / 60;
    animateAfterlifeModel(root, enemy, now, 7);
    assert.equal(enemy.hits, 1, 'the shot applies real damage');
    assert.equal(state.attackActive, true, 'a committed attack remains visually active');
    assert.equal(state.hitActive, false, 'ordinary committed damage does not replace the lunge with recoil');

    for (let i = 0; i < 24; i++) frame();
    assert.equal(enemy.slashHit, true, 'the authoritative swing reaches its contact test');
    assert.ok(run.events.some(event => event.type === 'enemy-attack'), 'the authoritative attack event is retained');
    assert.ok(run.health < 100, 'the authoritative swing damages the player');
    assert.equal(state.attackActive, true, 'the attack clip still owns the contact window');
    assert.equal(state.hitActive, false, 'HitRecoil stays out of the committed contact window');
  } finally {
    disposeAfterlifeModel(root);
  }
});

test('a real idle hit activates recoil, while a lethal real shot starts collapse', () => {
  const asset = syntheticAsset();
  const idleRoot = modelFor(asset);
  const idleState = idleRoot.userData.afterlife;
  const idle = encounter({hp: 100, attack: 20});
  try {
    animateAfterlifeModel(idleRoot, idle.enemy, 0, 7);
    assert.equal(shoot(idle.run), true, 'the idle Ossuary fires');
    animateAfterlifeModel(idleRoot, idle.enemy, 1000 / 60, 7);
    assert.equal(idle.enemy.dead, false, 'the idle shot is nonlethal');
    assert.equal(idle.enemy.hits, 1, 'the idle shot applies real damage');
    assert.equal(idleState.attackActive, false, 'idle damage has no attack clip to preserve');
    assert.equal(idleState.hitActive, true, 'idle damage starts the real hit recoil clip');
  } finally {
    disposeAfterlifeModel(idleRoot);
  }

  const lethalRoot = modelFor(asset);
  const lethalState = lethalRoot.userData.afterlife;
  const lethal = encounter({hp: 1, attack: 20});
  try {
    animateAfterlifeModel(lethalRoot, lethal.enemy, 0, 7);
    assert.equal(shoot(lethal.run), true, 'the lethal Ossuary shot fires');
    animateAfterlifeModel(lethalRoot, lethal.enemy, 1000 / 60, 7);
    assert.equal(lethal.enemy.dead, true, 'the real lethal shot marks the enemy dead');
    assert.equal(lethalState.collapseStarted, true, 'the dead edge starts the collapse clip');
    assert.equal(lethalState.actions.collapse.getEffectiveWeight(), 1, 'collapse owns the corpse pose');
    assert.equal(lethalState.attackActive, false, 'a corpse has no active attack clip');
    assert.equal(lethalState.hitActive, false, 'a lethal shot transitions directly to collapse');
  } finally {
    disposeAfterlifeModel(lethalRoot);
  }
});

test('a real parry cancels windup contact and leaves recoil as the visible response', () => {
  const asset = syntheticAsset();
  const root = modelFor(asset);
  const state = root.userData.afterlife;
  const {run, enemy} = encounter({attack: 0, y: 4.72});
  let now = 0;
  try {
    tick(run, 1 / 60, {});
    now += 1000 / 60;
    animateAfterlifeModel(root, enemy, now, 7);
    assert.equal(enemy.attacking, true, 'the enemy is in a real windup before parry');
    assert.equal(state.attackActive, true, 'the windup owns the attack clip before parry');

    assert.equal(parry(run), true, 'the player parry reaches the real enemy');
    now += 1000 / 60;
    animateAfterlifeModel(root, enemy, now, 7);
    assert.equal(enemy.attacking, false, 'parry clears the authoritative windup');
    assert.ok(enemy.stagger > 0, 'parry leaves a real stagger window');
    assert.equal(state.attackActive, false, 'parry removes the attack clip');
    assert.equal(state.hitActive, true, 'parry damage starts the recoil clip');

    const healthBefore = run.health;
    tick(run, 1 / 60, {});
    assert.equal(run.health, healthBefore, 'a parried windup cannot reach player contact');
    assert.equal(run.events.some(event => event.type === 'enemy-attack'), false, 'a parried windup emits no attack release');
  } finally {
    disposeAfterlifeModel(root);
  }
});
