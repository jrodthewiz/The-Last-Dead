import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWarden,animateWarden,resetWarden} from '../npc-warden.js';

const makeClip=(name,duration,angle)=>new THREE.AnimationClip(name,duration,[
 new THREE.NumberKeyframeTrack('.rotation[x]',[0,duration],[angle,angle]),
]);

function motionWarden(){
 const template=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.6,1.9,.5),new THREE.MeshStandardMaterial());body.position.y=.95;template.add(body);
 const clips=[makeClip('TLD_Idle',2.5,.01),makeClip('TLD_Walk',1.375,.04),makeClip('TLD_Windup',.833,.3),makeClip('TLD_Strike',.79,.5),makeClip('TLD_Hit',.75,-.3),makeClip('TLD_Collapse',1.833,1.2)];
 return createWarden(template,clips,2,'warden',0);
}

test('Warden contact owns the pose through ordinary flash and releases through a normalized recovery',()=>{
 const root=motionWarden(),w=root.userData.warden;
 const step=(e,now)=>{animateWarden(root,e,now,0);assert(Math.abs(Object.values(w.actions).reduce((sum,a)=>sum+a.getEffectiveWeight(),0)-1)<1e-8);};
 step({},0);step({attacking:true,windup:.2,windupTime:.65,flash:.16},100);
 assert.equal(w.actions.windup.getEffectiveWeight(),1);assert.equal(w.actions.hit.getEffectiveWeight(),0);
 step({strike:.24,flash:.15},200);assert.equal(w.actions.strike.getEffectiveWeight(),1);assert.equal(w.actions.strike.time,.79*.34);
 step({strike:.001},439);const lastContact=w.actions.strike.time;
 step({},440);assert.equal(w.actions.strike.getEffectiveWeight(),1);assert.equal(w.actions.strike.time,lastContact,'strike end joins the same pose before blending');
 for(let frame=1;frame<=15;frame++){root.position.x+=.025;step({},440+frame*1000/60);}
 assert(w.actions.strike.getEffectiveWeight()<.01,'movement promptly takes back the feet');assert(w.actions.walk.getEffectiveWeight()>.6);
 step({attacking:true,windup:.2,windupTime:.65,flash:.16,stagger:.4},800);assert.equal(w.actions.hit.getEffectiveWeight(),1,'real stagger may interrupt the windup');
});

test('Warden retreat reverses its distance gait, duplicate time freezes, and reset preserves front alignment',()=>{
 const root=motionWarden(),w=root.userData.warden;root.rotation.y=-Math.PI/2;
 animateWarden(root,{},0,0);for(let i=0;i<10;i++)animateWarden(root,{},0,0);assert.equal(w.mixer.time,0);
 root.position.x=.1;animateWarden(root,{},50,0);const forward=w.gaitPhase;assert.equal(w.gaitDirection,1);
 root.position.x=0;animateWarden(root,{},100,0);assert.equal(w.gaitDirection,-1);assert(Math.abs(w.gaitPhase)<1e-9||Math.abs(w.gaitPhase-1)<1e-9);assert(forward>0);
 const phase=w.gaitPhase,time=w.mixer.time;for(let i=0;i<10;i++)animateWarden(root,{},100,0);assert.equal(w.gaitPhase,phase);assert.equal(w.mixer.time,time);
 const initial=w.pivot.quaternion.clone();resetWarden(root,'warden',0);assert(w.pivot.quaternion.angleTo(initial)<1e-8,'reset never reverses the imported model front');
 animateWarden(root,{},0,0);assert.equal(w.gaitPhase,0);root.position.x=12;animateWarden(root,{},20,0);assert.equal(w.motion,0,'teleport is not sprint motion');
});

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
