import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {createAfterlifeModel,animateAfterlifeModel,disposeAfterlifeModel} from '../npc-afterlife-model.js';

const assets=[];
test.before(async()=>{
 const bitmap=globalThis.createImageBitmap,self=globalThis.self;
 globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 try{
  for(const file of ['assets/models/afterlife-ash-witness-motion-v07.glb',...['drowned-dockworker','fever-runner','crooked-crawler'].map(id=>`assets/models/zombie-variants/${id}.glb`)]){
   const bytes=readFileSync(new URL('../'+file,import.meta.url));
   const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
   assets.push({id:file,template:gltf.scene,clips:gltf.animations});
  }
 }finally{
  if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;
  if(self===undefined)delete globalThis.self;else globalThis.self=self;
 }
});
const enemy=extra=>({id:13,kind:0,variant:'stalker',locomotion:'shambler',facing:-Math.PI/2,attacking:false,strike:0,attack:99,hits:0,flash:0,stagger:0,...extra});
const head=root=>root.getObjectByName('Head').getWorldQuaternion(new THREE.Quaternion());
function skinPoint(root,name){
 root.updateMatrixWorld(true);const result=[];
 root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const bone=mesh.skeleton.bones.findIndex(b=>b.name===name);
  const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count&&result.length<24;i++){let weight=0;for(let k=0;k<4;k++)if(indices.getComponent(i,k)===bone)weight+=weights.getComponent(i,k);
   if(weight>.3)result.push(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));}
 });return result;
}
function compareContact(a,b){
 a.updateMatrixWorld(true);b.updateMatrixWorld(true);
 for(const name of ['Hips','neck','Head','Jaw','LeftHand','RightHand','LeftFoot','RightFoot']){
  const x=a.getObjectByName(name),y=b.getObjectByName(name);
  assert(x.getWorldPosition(new THREE.Vector3()).distanceTo(y.getWorldPosition(new THREE.Vector3()))<1e-6,name+' contact position');
  assert(x.getWorldQuaternion(new THREE.Quaternion()).normalize().angleTo(y.getWorldQuaternion(new THREE.Quaternion()).normalize())<1e-6,name+' contact rotation');
 }
}

test('AI head look deforms every actual imported face while leaving foot support and source rigs intact',()=>{
 for(const asset of assets){
  const baseline=createAfterlifeModel(asset,0,13),watch=createAfterlifeModel(asset,0,13);
  const source=asset.template.getObjectByName('Head').quaternion.clone();
  for(let i=0;i<=60;i++){
   animateAfterlifeModel(baseline,enemy(),i*1000/60,13);
   animateAfterlifeModel(watch,enemy({state:'notice',look:.7,lookPitch:.08,noticeStrength:1}),i*1000/60,13);
  }
  assert(head(baseline).normalize().angleTo(head(watch).normalize())>.5,asset.id+' visible head direction');
  const delta=head(watch).multiply(head(baseline).invert());
  assert(new THREE.Euler().setFromQuaternion(delta,'YXZ').y<-.5,asset.id+' positive simulation look turns toward its target');
  const neutral=skinPoint(baseline,'Head'),posed=skinPoint(watch,'Head');assert(neutral.length>8);
  assert(Math.max(...neutral.map((point,i)=>point.distanceTo(posed[i])))>.025,asset.id+' actual weighted face motion');
  for(const name of ['LeftFoot','RightFoot'])assert(baseline.getObjectByName(name).getWorldPosition(new THREE.Vector3()).distanceTo(watch.getObjectByName(name).getWorldPosition(new THREE.Vector3()))<1e-6);
  assert(asset.template.getObjectByName('Head').quaternion.equals(source),asset.id+' immutable shared template');
  const frozen=head(watch).clone();for(let i=0;i<10;i++)animateAfterlifeModel(watch,enemy({look:-.9}),1000,13);
  assert(frozen.normalize().angleTo(head(watch).normalize())<1e-6,'paused clock freezes attention');
  disposeAfterlifeModel(baseline);disposeAfterlifeModel(watch);
 }
});

test('watching yields completely to windup/contact and cannot corrupt the authored .375-second strike',()=>{
 for(const asset of assets){
  const a=createAfterlifeModel(asset,0,13),b=createAfterlifeModel(asset,0,13);
  for(let i=0;i<=40;i++){animateAfterlifeModel(a,enemy(),i*1000/60,13);animateAfterlifeModel(b,enemy({look:.8,noticeStrength:1}),i*1000/60,13);}
  for(let i=41;i<=58;i++){
   const attack=enemy({attacking:true,windupTime:.3,windup:(58-i)/60});
   animateAfterlifeModel(a,attack,i*1000/60,13);animateAfterlifeModel(b,{...attack,look:.8,noticeStrength:1},i*1000/60,13);
  }
  const contact=enemy({attacking:false,strike:.24});
  animateAfterlifeModel(a,contact,59*1000/60,13);animateAfterlifeModel(b,{...contact,look:.8,noticeStrength:1},59*1000/60,13);
  assert(Math.abs(b.userData.afterlife.attackAction.time-.375)<.002);assert.equal(b.userData.afterlife.attention.applied,false);
  compareContact(a,b);disposeAfterlifeModel(a);disposeAfterlifeModel(b);
 }
});

test('injured Shuffle adds asymmetric upper-body carry on all real rigs, preserves feet and yields exact strike',()=>{
 for(const asset of assets){
  const a=createAfterlifeModel(asset,0,13),b=createAfterlifeModel(asset,0,13);
  const source=asset.template.getObjectByName('LeftArm').quaternion.clone();
  for(let frame=0;frame<=60;frame++){
   a.position.z=b.position.z=-frame*.008;
   animateAfterlifeModel(a,enemy(),frame*1000/60,13);
   animateAfterlifeModel(b,enemy({locomotion:'injured'}),frame*1000/60,13);
  }
  assert.equal(b.userData.afterlife.motionClass,'shambler');assert.equal(b.userData.afterlife.injuredGait.applied,true);
  assert(a.getObjectByName('LeftArm').getWorldQuaternion(new THREE.Quaternion()).angleTo(b.getObjectByName('LeftArm').getWorldQuaternion(new THREE.Quaternion()))>.025);
  for(const name of ['LeftFoot','RightFoot'])assert(a.getObjectByName(name).getWorldPosition(new THREE.Vector3()).distanceTo(b.getObjectByName(name).getWorldPosition(new THREE.Vector3()))<1e-6,name+' stays authored');
  assert(asset.template.getObjectByName('LeftArm').quaternion.equals(source));
  for(let frame=61;frame<=80;frame++){
   const attack=enemy({attacking:true,windupTime:.3,windup:Math.max(0,(79-frame)/60)});
   animateAfterlifeModel(a,attack,frame*1000/60,13);animateAfterlifeModel(b,{...attack,locomotion:'injured'},frame*1000/60,13);
  }
  const contact=enemy({strike:.24});animateAfterlifeModel(a,contact,81*1000/60,13);animateAfterlifeModel(b,{...contact,locomotion:'injured'},81*1000/60,13);
  assert.equal(b.userData.afterlife.injuredGait.applied,false);compareContact(a,b);
  disposeAfterlifeModel(a);disposeAfterlifeModel(b);
 }
});

test('low crawlers retain finite grounded skin while scanning and listening',()=>{
 for(const asset of assets){
  const root=createAfterlifeModel(asset,0,13);let minimum=Infinity;
  for(let i=0;i<=90;i++){
   animateAfterlifeModel(root,enemy({variant:'skitter',locomotion:'crawler',state:'notice',look:Math.sin(i*.09)*.8,lookPitch:.1,noticeStrength:1,contortion:.5}),i*1000/60,13);
   if(i%15)continue;root.updateMatrixWorld(true);
   root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let v=0;v<mesh.geometry.attributes.position.count;v++){
    const point=mesh.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
    assert(point.toArray().every(Number.isFinite));minimum=Math.min(minimum,point.y);
   }});
  }
  assert(minimum>=-.035,asset.id+' scan stays grounded');disposeAfterlifeModel(root);
 }
});
