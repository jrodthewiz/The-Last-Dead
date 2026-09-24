import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {newRun,makeCourse,tick,shoot} from '../engine.js';
import {ENEMY_PROFILES} from '../campaign.js';
import {createAfterlifeModel,animateAfterlifeModel,disposeAfterlifeModel} from '../npc-afterlife-model.js';
import {ImpactVFX} from '../impact-vfx.js';
import {CombatVFX} from '../combat-vfx.js';

function model(){
 const template=new THREE.Group();template.add(new THREE.Mesh(new THREE.BoxGeometry(.4,1.86,.3),new THREE.MeshStandardMaterial()));
 const clips=[['Idle',2.416667],['Shuffle',1.5],['Chase',1.5],['AttackLunge',.833333],['HitRecoil',.583333],['Collapse',1.833333]]
  .map(([name,duration])=>new THREE.AnimationClip('AshWitness_'+name,duration,[new THREE.NumberKeyframeTrack('.rotation[y]',[0,duration],[0,.1])]));
 return createAfterlifeModel({template,clips},0,1);
}
function encounter(variant='stalker'){
 const run=newRun(makeCourse()),profile=ENEMY_PROFILES[variant];
 Object.assign(run,{mode:'play',x:6,y:5,angle:-Math.PI/2,pitch:0,health:100,weapon:0});
 const enemy={id:4301,x:6,y:4.72,hp:100,kind:profile.kind,variant,attack:0,attacking:false,windup:0,strike:0,phase:0,dead:false};
 run.course.enemies=[enemy];return{run,enemy};
}
test('fast, normal and heavy zombies show the contact pose on the damage frame',()=>{
 for(const variant of ['skitter','stalker','brute','wardenColossus']){
  const {run,enemy}=encounter(variant),root=model(),state=root.userData.afterlife;
  let frame=0;
  while(run.health===100&&frame<100){tick(run,1/60);animateAfterlifeModel(root,enemy,++frame*1000/60);}
  assert.ok(run.health<100,variant+' reaches actual damage');
  assert.equal(state.attackPhase,'contact');
  assert.ok(Math.abs(state.attackAction.time-.375)<.002,variant+' damage matches authored frame 9');
  assert.ok(state.attackAction.getEffectiveWeight()>.95,variant+' has full contact weight');
  disposeAfterlifeModel(root);
 }
});
test('chase cadence follows traveled distance and stops stepping against obstacles',()=>{
 const root=model(),state=root.userData.afterlife,enemy={kind:0,variant:'stalker',attack:10};
 animateAfterlifeModel(root,enemy,1);
 for(let i=1;i<=60;i++){root.position.x=i*.06;animateAfterlifeModel(root,enemy,1+i*1000/60);}
 assert.ok(state.chaseBlend>.95,'fast travel selects the authored chase');
 assert.ok(new THREE.Vector3(0,0,-1).applyQuaternion(root.quaternion).x>.99,'body faces its travel direction');
 const phase=state.gaitPhase;
 for(let i=61;i<=120;i++)animateAfterlifeModel(root,enemy,1+i*1000/60);
 assert.equal(state.gaitPhase,phase,'stationary root cannot moonwalk');
 assert.ok(state.shuffleAction.getEffectiveWeight()<.01&&state.chaseAction.getEffectiveWeight()<.01,'blocked movement settles to idle');
 disposeAfterlifeModel(root);
});
test('zombies must chase inside arm reach before committing a swipe',()=>{
 const {run,enemy}=encounter();enemy.y=4.3;
 tick(run,1/60);assert.equal(!!enemy.attacking,false);
 assert.equal(run.health,100,'a zombie almost three metres away cannot swipe the player');
 for(let i=0;i<120&&run.health===100;i++)tick(run,1/60);
 assert.ok(run.health<100);
 assert.ok(Math.hypot(enemy.x-run.x,enemy.y-run.y)<=.34,'contact occurs within 1.36 metres');
});
test('leaving a windup cancels the swipe instead of playing a phantom contact',()=>{
 const root=model(),enemy={kind:0,variant:'brute',attacking:true,windup:.5};
 animateAfterlifeModel(root,enemy,10);animateAfterlifeModel(root,enemy,70);
 enemy.attacking=false;enemy.windup=0;
 for(let now=90;now<=250;now+=20)animateAfterlifeModel(root,enemy,now);
 assert.equal(root.userData.afterlife.attackActive,false);
 disposeAfterlifeModel(root);
});
test('blood jets follow the hit direction and ordinary rounds do not eject large chunks',()=>{
 const {run,enemy}=encounter();enemy.attack=20;
 shoot(run);
 assert.equal(run.gore.length,12);
 assert.equal(run.gore.some(p=>p.chunk),false);
 assert.ok(run.gore.filter(p=>p.vy<0).length>=7,'majority of jet carries bullet momentum');
 assert.ok(run.gore.every(p=>p.size<=.011),'droplets stay smaller than flesh chunks');
});
test('airborne droplets leave small grounded stains, respect gore and reset within a fixed budget',()=>{
 const fx=new ImpactVFX(new THREE.Group());
 fx.burst({id:7,x:6,y:5,z:.4,tx:6,ty:4.3,tz:.2,weapon:0,surface:'flesh'});
 for(let i=0;i<80;i++)fx.update(1/60,null);
 assert.ok(fx.deposits.active>0);
 assert.ok(fx.deposits.slots.filter(p=>p.age<p.duration).every(p=>p.position.y<.03&&p.size<.2));
 fx.update(.01,null,false,false);assert.equal(fx.deposits.mesh.count,0);
 for(let i=0;i<300;i++)fx.deposits.add(new THREE.Vector3(),new THREE.Vector3(0,1,0),.1,3,i);
 fx.update(.01,null);assert.equal(fx.deposits.active,64);
 fx.clear();assert.equal(fx.deposits.active,0);
});
test('bullet trails remain short and expire before their gameplay hit metadata',()=>{
 const fx=new CombatVFX(new THREE.Group()),trace={id:1,x:0,y:0,z:.4,tx:0,ty:10,tz:.4,life:.085,duration:.085,weapon:4,surface:'air'};
 const run={time:1,course:{enemies:[]},tracers:[trace]};
 fx.update(run,1/60);const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();fx.beams.getMatrixAt(0,matrix);matrix.decompose(p,q,s);
 assert.ok(s.y<=2.11,'ordinary rifle fire is a streak, not a forty-metre beam');
 trace.life=.02;fx.update(run,1/60);fx.beams.getMatrixAt(0,matrix);matrix.decompose(p,q,s);
 assert.equal(Math.hypot(...matrix.elements.slice(0,3)),0,'streak disappears promptly');
});
test('forward blood spatter attaches to a nearby wall and never invents a distant surface',()=>{
 const fx=new ImpactVFX(new THREE.Group()),course={w:3,h:3,cells:Array.from({length:9},()=>[0,0,0,0])};
 course.cells[4][1]=1;
 const trace={id:12,x:1,y:1.5,z:.3,tx:1.6,ty:1.5,tz:.3,weapon:0,surface:'flesh'};
 fx.burst(trace,true,[],course);fx.update(.01,null);
 assert.equal(fx.deposits.active,1);const stain=fx.deposits.slots[0];
 assert.ok(stain.position.x<8&&stain.position.x>7.97,'stain sits just in front of the actual wall at x=8m');
 assert.ok(new THREE.Vector3(0,0,1).applyQuaternion(stain.rotation).x<-.99,'stain faces out from the wall');
 fx.clear();course.cells[4][1]=0;fx.burst(trace,true,[],course);fx.update(.01,null);
 assert.equal(fx.deposits.active,0,'open space gets no floating wall decal');
});
