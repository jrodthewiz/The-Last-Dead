import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {installFPSArms,advanceFPSClip,fpsGripDiagnostics} from '../assets/survivor/fps-arms.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
import {createRifle,animateRifle} from '../weapon-rifles.js';
import {createRifleReload} from '../island/rifle-reload.js';
import {createFeedback} from '../island/feedback.js';
let asset;
test.before(async()=>{globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});const b=readFileSync(new URL('../assets/survivor/fps-arms-v5.glb',import.meta.url));asset=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');});
test('real skinned charging grasps follow their own moving knobs, return and cancel across frame rates',()=>{
 for(const index of [4,5])for(const hz of [30,60,120]){
  const hold=FIRST_PERSON_HOLD_POSES[index],camera=new T.PerspectiveCamera(74,1.6,.02,100),rig=new T.Group(),group=new T.Group(),model=createRifle({variant:hold.name});camera.add(rig);rig.add(group);group.add(model);group.userData.model=model;group.position.fromArray(hold.position);group.rotation.fromArray(hold.rotation);group.scale.setScalar(hold.scale);
  installFPSArms({weaponGroups:[group],fpsSourceIndices:[index],weaponRig:rig,camera,_findWeaponSocket:(m,name)=>m.userData[name]},asset);const reload=createRifleReload(group,model,index),home=reload.state.left.grip,rest=reload.state.left.hand.getWorldPosition(new T.Vector3());
  for(let i=0;i<=hz*2;i++){const p=i/(hz*2);animateRifle(model,0,i/hz,1/hz,{shotSequence:0});reload.update(p);advanceFPSClip(group,'idle',0,1/hz);const d=reload.diagnostics();if(d.pull>.00001)assert.ok(d.grasp>.999,hold.name+' bolt moved before hook closure/after release');if(d.reach<.999&&p>.9)assert.ok(d.grasp<.001,hold.name+' hand withdrew before release');const arms=fpsGripDiagnostics(group).arms;if(d.engaged>.999)assert.ok(d.gap<.001,hold.name+' control contact '+d.gap);assert.ok(arms.every(a=>a.gap<.0001&&a.wristDegrees<=a.wristLimitDegrees+.05));}
  assert.ok(reload.state.left.hand.getWorldPosition(new T.Vector3()).distanceTo(rest)<.0001,hold.name+' end pose must settle on foregrip');
  for(const p of [.4,.83,-1]){animateRifle(model,0,3,1/hz);reload.update(p);advanceFPSClip(group,'idle',0,1/hz);}assert.equal(reload.state.left.grip,home);assert.equal(reload.state.engaged,0);assert.equal(reload.state.pull,0);
 }
});
test('impact births replace pooled transforms immediately without a physics advance',()=>{
 const scene=new T.Scene(),f=createFeedback(scene,()=>0),matrix=new T.Matrix4(),point=new T.Vector3(7,3,-2),direction=new T.Vector3(0,0,-1),particles=scene.children.find(o=>o.count===96),fans=scene.children.find(o=>o.count===12&&o.isInstancedMesh);
 f.impact(new T.Vector3(0,1,0),true,direction);f.update(.1);for(let i=0;i<12;i++)f.impact(point,true,direction);
 for(let i=0;i<96;i++){particles.getMatrixAt(i,matrix);assert.ok(new T.Vector3().setFromMatrixPosition(matrix).distanceTo(point)<1e-6);assert.ok(matrix.determinant()>0);}
 fans.getMatrixAt(0,matrix);assert.ok(matrix.determinant()>0,'contact fan has no visible birth');assert.ok(new T.Vector3().setFromMatrixPosition(matrix).distanceTo(point)<1e-6);const before=matrix.clone();f.update(0);fans.getMatrixAt(0,matrix);assert.ok(matrix.equals(before),'render preparation must not integrate physics');
});
