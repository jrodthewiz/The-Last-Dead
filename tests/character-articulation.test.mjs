import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createCharacterArticulation,applyCharacterArticulation,restoreCharacterArticulation,applyBiteArticulation,biteArticulationPose,enemyArticulationPose} from '../character-articulation.js';
import {createAfterlifeModel,animateAfterlifeModel,disposeAfterlifeModel} from '../npc-afterlife-model.js';

function rig(){
  const model=new THREE.Group(),head=new THREE.Bone(),jaw=new THREE.Bone(),grip=new THREE.Bone();head.name='Head';jaw.name='Jaw';grip.name='LeftGrip';jaw.position.set(0,1.6,0);jaw.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),.2);jaw.userData.articulation={role:'jaw',axis:[1,0,0],maxAngleRadians:.58,sign:1};grip.userData.articulation={role:'grip',axis:[0,0,1],maxAngleRadians:1.1};head.add(jaw);model.add(head,grip);return{model,head,jaw,grip};
}

test('layered jaw/grip updates do not accumulate and restore the underlying pose',()=>{
  const {model,jaw}=rig(),state=createCharacterArticulation(model),base=jaw.quaternion.clone();
  applyCharacterArticulation(state,{jawOpen:.8,leftGrip:.9});const expected=jaw.quaternion.clone();
  for(let i=0;i<200;i++)applyCharacterArticulation(state,{jawOpen:.8,leftGrip:.9});assert(jaw.quaternion.angleTo(expected)<1e-7);
  applyCharacterArticulation(state,{jawOpen:.2});assert(jaw.quaternion.angleTo(base)<.13,'bite override replaces the previous overlay');
  restoreCharacterArticulation(state);assert(jaw.quaternion.angleTo(base)<1e-7);assert.equal(state.applied,false);
  jaw.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),.3);const animatedBase=jaw.quaternion.clone();
  applyCharacterArticulation(state,{jawOpen:.4});restoreCharacterArticulation(state);assert(jaw.quaternion.angleTo(animatedBase)<1e-7,'new base after mixer is retained');
});

test('jaw deformation is local, weighted and stable beneath scaled/rotated ancestors',()=>{
  const {model,jaw}=rig(),state=createCharacterArticulation(model);model.scale.setScalar(.01);model.rotation.y=1.3;jaw.position.y=160;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,160,10,1,160,10,0,161,10],3));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());model.add(mesh);model.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton([jaw]));
  const neutral=new THREE.Vector3(0,160,10),deformed=neutral.clone();applyCharacterArticulation(state,{jawOpen:1});model.updateMatrixWorld(true);mesh.skeleton.update();mesh.applyBoneTransform(0,deformed);
  assert(deformed.distanceTo(neutral)>1,'weighted tissue actually moves');assert(deformed.y<neutral.y,'hinge opens the lower mouth downward');assert(deformed.toArray().every(Number.isFinite));assert(Math.abs(jaw.quaternion.length()-1)<1e-7);
});

test('bite articulation opens before the authoritative bite and relaxes on release/death',()=>{
  const prepare=biteArticulationPose({phase:'held',elapsed:1.04,damageStage:0}),contact=biteArticulationPose({phase:'held',elapsed:1.25,damageStage:1});
  assert(prepare.jawOpen>contact.jawOpen+.4);assert.equal(prepare.leftGrip,prepare.rightGrip);assert(prepare.leftGrip>.8);
  assert(prepare.jawOpen<=.66&&biteArticulationPose({phase:'windup',elapsed:.65}).jawOpen<=.66,'combat stays within the reviewed cheek deformation range');
  assert.deepEqual(biteArticulationPose({phase:'released',elapsed:.55}),{jawOpen:0,tongueLift:0,lipCurl:0,leftGrip:0,rightGrip:0});
  assert(biteArticulationPose({phase:'terminal',elapsed:1}).leftGrip<.2);assert(biteArticulationPose({phase:'held',elapsed:1.04},true).jawOpen<=.42);
  assert(enemyArticulationPose({dead:true,bitePhase:'held'}).jawOpen<.2);
});

test('per-enemy support controls and shared material roles remain isolated',()=>{
  const {model}=rig(),material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry(.4,1.86,.3);
  model.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
  const a=createAfterlifeModel({template:model,clips:[]}),b=createAfterlifeModel({template:model,clips:[]});
  assert.equal(a.userData.afterlife.materials.length,1,'one owned clone per source material');assert.notEqual(a.userData.afterlife.materials[0],b.userData.afterlife.materials[0]);
  animateAfterlifeModel(a,{attacking:true,windup:.1},100);animateAfterlifeModel(b,{},100);
  assert(a.userData.afterlife.articulation.pose.jawOpen>b.userData.afterlife.articulation.pose.jawOpen);assert.notEqual(a.getObjectByName('Jaw'),b.getObjectByName('Jaw'));
  disposeAfterlifeModel(a);assert.equal(a.userData.afterlife.articulation.applied,false);disposeAfterlifeModel(b);
});

test('fallback actors without authored controls retain their original bones',()=>{
  const model=new THREE.Group(),head=new THREE.Bone();model.add(head);const before=head.quaternion.clone(),state=createCharacterArticulation(model);
  assert.equal(applyCharacterArticulation(state,{jawOpen:1,leftGrip:1}),false);restoreCharacterArticulation(state);assert.deepEqual(head.quaternion.toArray(),before.toArray());assert.equal(state.controls.length,0);
});

test('canonical terminal state with frozen elapsed releases the grip and resets on the next grab',()=>{
  const {model}=rig(),state=createCharacterArticulation(model),terminal={phase:'terminal',enemyId:3,sequence:5,elapsed:0};
  applyBiteArticulation(state,terminal,100);assert(state.pose.leftGrip>.8);applyBiteArticulation(state,terminal,1100);assert(state.pose.leftGrip<.2);assert.equal(terminal.elapsed,0,'presentation never changes simulation state');
  applyBiteArticulation(state,{phase:'held',elapsed:1.04,enemyId:3,sequence:6},1200);const pose={...state.pose};applyBiteArticulation(state,{phase:'held',elapsed:1.04,enemyId:3,sequence:6},3000);assert.deepEqual(state.pose,pose,'paused canonical bite time freezes articulation');
  applyBiteArticulation(state,{...terminal,sequence:6},3100);assert(state.pose.leftGrip>.8,'a new fatal event starts its own presentation');
});

test('early parry release blends from the pose actually reached instead of snapping into a full grip',()=>{
  const {model}=rig(),state=createCharacterArticulation(model),bite={phase:'windup',elapsed:.065,enemyId:3,sequence:1};
  applyBiteArticulation(state,bite,100);const early={...state.pose};assert(early.leftGrip<.2);
  const recover=enemyArticulationPose({stagger:1.1});applyCharacterArticulation(state,recover);
  applyBiteArticulation(state,{...bite,phase:'released',elapsed:0},120);assert.deepEqual(state.pose,early);
  applyCharacterArticulation(state,recover);applyBiteArticulation(state,{...bite,phase:'released',elapsed:.55},670);assert.deepEqual(state.pose,recover,'release rejoins the underlying recovery pose');
});

test('grapple reach follows locked aim through the latch transition before held AI facing updates',()=>{
  const {model}=rig();model.add(new THREE.Mesh(new THREE.BoxGeometry(.4,1.86,.3),new THREE.MeshStandardMaterial()));
  const root=createAfterlifeModel({template:model,clips:[]}),state=root.userData.afterlife;
  state.facingYaw=0;const enemy={bitePhase:'windup',attacking:true,windup:.5,aimAngle:Math.PI/2,facing:-Math.PI/2};
  for(let i=0;i<45;i++)animateAfterlifeModel(root,enemy,100+i*1000/60);
  const angleError=()=>Math.abs(Math.atan2(Math.sin(root.rotation.y+Math.PI),Math.cos(root.rotation.y+Math.PI)));
  assert(angleError()<.001,'body reaches toward the same locked angle as the grapple');
  animateAfterlifeModel(root,{...enemy,bitePhase:'held',attacking:false,biteProgress:0},900);assert(angleError()<.001,'first latch frame cannot turn back to stale AI facing');
  for(let i=0;i<45;i++)animateAfterlifeModel(root,{...enemy,bitePhase:'held',attacking:false,biteProgress:.3,facing:.2},920+i*1000/60);
  assert(Math.abs(root.rotation.y-(-.2-Math.PI/2))<.002,'later held steps follow the updated victim facing');disposeAfterlifeModel(root);
});
