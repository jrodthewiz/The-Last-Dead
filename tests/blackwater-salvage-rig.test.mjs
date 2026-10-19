import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {installFPSArms,advanceFPSClip,fpsGripDiagnostics} from '../assets/survivor/fps-arms.js';
import {createSalvageMelee} from '../island/salvage-melee.js';
import {animateSalvageMelee,fitSalvageHands,salvageFraming} from '../island/salvage-motion.js';
import {WEAPONS} from '../island/armory-state.js';
let groups,camera;
test.before(async()=>{
 globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 const b=readFileSync(new URL('../assets/survivor/fps-arms-v5.glb',import.meta.url)),asset=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 camera=new T.PerspectiveCamera(74,1.6,.02,100);const rig=new T.Group();camera.add(rig);
 groups=['sword','hammer','pipe'].map(id=>{const group=new T.Group(),model=createSalvageMelee(id);group.name=id;group.userData.model=model;group.position.set(.32,-.34,-.85);group.scale.setScalar(.58);model.rotation.set(.92,-.32,-.22);group.add(model);rig.add(group);return group;});
 installFPSArms({weaponGroups:groups,fpsSourceIndices:[6,6,6],weaponRig:rig,camera,_findWeaponSocket:(m,name)=>m.userData[name]},asset);
 for(const group of groups){group.userData.authoredFPS.gripDriven=true;fitSalvageHands(group,group.name);}
});
test('actual weighted hands use bounded grasp turns rather than a hidden extra revolution',()=>{
 for(const group of groups)for(const arm of group.userData.authoredFPS.arms)assert.ok(Math.abs(arm.salvageRoll)<=Math.PI+1e-7,group.name+'/'+arm.side+' grasp turn '+arm.salvageRoll);
});
test('actual skinned grips stay seated with bounded wrists through each dedicated motion at different frame rates',()=>{
 for(const aspect of [1.6,390/844,844/390])for(const rate of [30,60,120])for(const group of groups){const id=group.name,model=group.userData.model,w=WEAPONS.find(w=>w.id===id),f=salvageFraming(id,aspect,{});group.position.set(f.x,f.y,f.z);group.scale.setScalar(f.scale);camera.aspect=aspect;camera.updateProjectionMatrix();
  for(let i=0;i<=Math.ceil(w.interval*rate)+2;i++){const age=i/rate;animateSalvageMelee(model,{id,age,contact:w.contact,duration:w.interval,active:age<w.interval,group,aspect});advanceFPSClip(group,'idle',0,1/rate);const d=fpsGripDiagnostics(group);for(const a of d.arms){assert.ok(a.gap<.0001,id+' detached palm');assert.ok(a.wristDegrees<=a.wristLimitDegrees+.05,id+' broken wrist');assert.ok(Number.isFinite(a.upperMetres)&&Number.isFinite(a.forearmMetres));}}
 }
});
