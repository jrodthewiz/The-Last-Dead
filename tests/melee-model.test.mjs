import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createMeleeWeapon, animateMeleeWeapon } from '../weapon-melee.js';
import { batchStaticWeaponMeshes } from '../weapon-batching.js';
import { Renderer } from '../renderer.js';

function triangles(root) {
  let total = 0;
  root.traverse(node => {
    if (!node.isMesh) return;
    total += Math.round((node.geometry.index?.count || node.geometry.attributes.position?.count || 0) / 3) * (node.count || 1);
  });
  return total;
}

for (const variant of ['bat', 'chainsaw']) {
  test(`${variant} has readable first-person sockets, protected mechanisms, and a bounded authored silhouette`, () => {
    const root = createMeleeWeapon({ variant });
    const meta = root.userData.melee;
    assert.ok(root instanceof THREE.Group);
    assert.equal(meta.variant, variant);
    assert.ok(root.userData.resourcesReady instanceof Promise);
    for (const name of ['grip', 'supportGrip', 'impactTip']) {
      assert.ok(root.userData[name]?.isObject3D, `${name} socket is present`);
    }
    assert.ok(meta.diagnostics.meshes > 10);
    assert.ok(triangles(root) <= 12000, `${variant} stays below the 12k first-person target`);
    root.updateMatrixWorld(true);
    const grip = new THREE.Vector3();
    root.userData.grip.getWorldPosition(grip);
    assert.ok(grip.length() < .6, `${variant} grip remains close to the origin for arm fitting`);
    for (const pivot of Object.values(root.userData.meleeMechanisms)) {
      assert.equal(pivot.userData.weaponMechanism !== undefined, true, `${pivot.name} remains a protected animation pivot`);
    }
  });
}

test('bat has a full windup, cross-screen strike, contact pulse, and clean return', () => {
  const root = createMeleeWeapon({ variant: 'bat' });
  const base = root.rotation.clone();
  animateMeleeWeapon(root, { active: true, progress: .16, sequence: 1 }, 0, .016);
  const windup = root.rotation.y;
  animateMeleeWeapon(root, { active: true, progress: .4, contact: 1, sequence: 1 }, .1, .016);
  const strike = root.rotation.y;
  assert.ok(Math.abs(windup - base.y) > .25, 'windup visibly pulls the bat across the body');
  assert.ok(strike - windup > .6, 'strike sweeps across the screen instead of only bobbing');
  assert.ok(root.userData.melee.impactPulse.visible, 'contact state is exposed at the hit window');
  assert.ok(root.userData.melee.materials.glow.emissiveIntensity > .5, 'contact uses a restrained material flash');
  animateMeleeWeapon(root, { active: false, progress: 0, sequence: 1 }, 1.2, .016);
  for (let i = 0; i < 50; i++) animateMeleeWeapon(root, { active: false, progress: 0, sequence: 1 }, 1.2 + i * .016, .016);
  assert.ok(Math.abs(root.rotation.y - base.y) < .06, 'bat returns to its held pose after followthrough');
});

test('bat impact tip crosses the reticle in the authored FPS wrapper', () => {
  const root = createMeleeWeapon({ variant: 'bat' });
  root.rotation.set(.92, -.32, -.22);
  const wrapper = new THREE.Group();
  wrapper.position.set(.32, -.34, -.85);
  wrapper.scale.setScalar(.64);
  wrapper.add(root);
  const camera = new THREE.PerspectiveCamera(92, 16 / 9, .1, 100);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld(true);
  const projected = (progress, contact = 0) => {
    animateMeleeWeapon(root, { active: progress > 0 && progress < 1, progress, contact }, 0, .016);
    wrapper.updateMatrixWorld(true);
    return root.userData.impactTip.getWorldPosition(new THREE.Vector3()).project(camera);
  };
  const windup = projected(.24);
  const contact = projected(.4, 1);
  const followthrough = projected(.58);
  const held = projected(0);
  assert.ok(windup.x > .4, 'windup pulls the impact tip to screen right');
  assert.ok(contact.x < -.08 && Math.abs(contact.y) < .25, 'contact crosses near the reticle');
  assert.ok(followthrough.x < -.1 && followthrough.y < -.2, 'follow-through continues left and down');
  assert.ok(held.x > .2 && held.y > 0, 'held pose returns to the diagonal right-side frame');
});

test('chainsaw moves its individual teeth around a closed guide path and keeps vibration bounded', () => {
  const root = createMeleeWeapon({ variant: 'chainsaw' });
  const meta = root.userData.melee;
  const tooth = meta.chainTeeth[0];
  animateMeleeWeapon(root, { active: false, sawActive: false, sawRev: 0 }, 0, .016);
  const first = tooth.position.clone();
  const idlePhase=meta.chainPhase;
  for(let i=0;i<60;i++)animateMeleeWeapon(root,{sawActive:false,sawRev:0},i/60,1/60);
  assert.equal(meta.chainPhase,idlePhase,'a stopped saw does not creep around its guide');
  animateMeleeWeapon(root, { active: true, sawActive: true, sawRev: 1, contact: .5, progress: .4 }, .2, .5);
  const second = tooth.position.clone();
  assert.ok(first.distanceTo(second) > .005, 'chain teeth advance around the bar when the saw is revved');
  assert.ok(meta.chainPhase > 0 && meta.chainPhase < 1, 'chain phase remains wrapped');
  assert.equal(meta.chainLoop.userData.teethMesh.count, 22, 'teeth share one instanced draw');
  assert.equal(meta.chainLoop.userData.linksMesh.count, 22, 'links share one instanced draw');
  assert.ok(Math.abs(root.position.x - meta.restPosition.x) < .02, 'motor vibration remains a small first-person detail');
  const bar = meta.mechanisms.guide;
  assert.ok(Math.abs(bar.rotation.x) < .02, 'guide vibration remains bounded');
  const phase=meta.chainPhase;
  animateMeleeWeapon(root,{sawActive:false,sawRev:0},1,.016);
  assert.equal(meta.chainPhase,phase,'teeth stop when the rev ramp has reached zero');
});

test('melee hands stay on moving grips while sleeve roots remain below the camera', () => {
  const renderer=Object.create(Renderer.prototype);renderer.materials={};
  const camera=new THREE.PerspectiveCamera(92,16/9,.1,100);camera.updateMatrixWorld(true);
  for(const [variant,index] of [['bat',6],['chainsaw',7]]){
    const group=renderer._makeMelee(variant,index);group.scale.setScalar(.64);
    for(const progress of [0,.24,.4,.48,.72,1]){
      animateMeleeWeapon(group.userData.model,{active:progress>0&&progress<1,progress,heavy:true},0,.016);
      renderer._fitMeleeArms(group);group.updateMatrixWorld(true);
      for(const state of group.userData.meleeArms){
        const target=group.userData.model.localToWorld(state.handPosition.clone());
        assert.ok(state.hand.getWorldPosition(new THREE.Vector3()).distanceTo(target)<1e-6,'palm follows its authored grip');
        assert.ok(state.limb.getWorldPosition(new THREE.Vector3()).project(camera).y<-1,'sleeve end stays outside the frame');
        assert.deepEqual(state.hand.scale.toArray(),state.handScale.toArray(),'hands never stretch with the sleeve');
        assert.ok(Number.isFinite(state.sleeve.scale.y)&&state.sleeve.scale.y>0);
      }
    }
  }
});

test('static batching leaves melee animation pivots and chain teeth intact', () => {
  for (const variant of ['bat', 'chainsaw']) {
    const root = createMeleeWeapon({ variant });
    const meta = root.userData.melee;
    const mechanisms = { ...root.userData.meleeMechanisms };
    const before = triangles(root);
    batchStaticWeaponMeshes(root, { preserve: ['MeleeRig'] });
    assert.ok(triangles(root) <= before, `${variant} batching does not add geometry`);
    for (const [name, pivot] of Object.entries(mechanisms)) {
      assert.equal(root.userData.meleeMechanisms[name], pivot, `${variant} keeps ${name} identity`);
      assert.ok(pivot.userData.weaponMechanism, `${variant} keeps ${name} protected`);
    }
    if (variant === 'chainsaw') assert.equal(meta.chainTeeth.length, 22);
  }
});
