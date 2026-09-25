import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWarden,animateWarden,resetWarden} from '../npc-warden.js';

const makeClip=(name,duration,angle)=>new THREE.AnimationClip(name,duration,[
 new THREE.NumberKeyframeTrack('.rotation[x]',[0,duration],[angle,angle]),
]);

test('authored Warden clips follow windup, strike, hit and death simulation states',()=>{
 const template=new THREE.Group();
 const body=new THREE.Mesh(new THREE.BoxGeometry(.6,1.9,.5),new THREE.MeshStandardMaterial());
 body.position.y=.95;template.add(body);
 const clips=[makeClip('TLD_Idle',2.5,.01),makeClip('TLD_Walk',1.375,.04),
  makeClip('TLD_Windup',.833,.3),makeClip('TLD_Strike',.79,.5),
  makeClip('TLD_Hit',.75,-.3),makeClip('TLD_Collapse',1.833,1.2)];
 const root=createWarden(template,clips,2,'warden',0);
 const w=root.userData.warden;
 const idle={attacking:false,strike:0,flash:0,dead:false,windup:0,windupTime:.65};
 animateWarden(root,idle,0,0);
 assert.equal(w.actions.idle.getEffectiveWeight(),1);
 assert.equal(w.actions.windup.getEffectiveWeight(),0);
 animateWarden(root,{...idle,attacking:true,windup:.325},100,0);
 assert.equal(w.actions.windup.getEffectiveWeight(),1);
 assert.ok(w.actions.windup.time>.35&&w.actions.windup.time<.5);
 assert.ok(w.model.rotation.x>.25,'paused authored action must actually pose the model');
 animateWarden(root,{...idle,strike:.24},200,0);
 assert.equal(w.actions.strike.getEffectiveWeight(),1);
 assert.ok(w.actions.strike.time>.2,'strike starts near authored contact');
 animateWarden(root,{...idle,flash:.16},300,0);
 assert.equal(w.actions.hit.getEffectiveWeight(),1);
 animateWarden(root,{...idle},600,0);
 assert.ok(w.actions.hit.getEffectiveWeight()>0,'hit response outlasts flash');
 animateWarden(root,{...idle,dead:true},1000,0);
 assert.equal(w.actions.collapse.getEffectiveWeight(),1);
 assert.equal(root.visible,true);
 animateWarden(root,{...idle,dead:true},2100,0);
 assert.ok(w.actions.collapse.time>1);
 resetWarden(root,'warden',0);
 assert.equal(w.actions.collapse.getEffectiveWeight(),0);
 assert.equal(root.visible,true);
});
