import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialGrid,createWorldData,createColliders} from '../island/data.js';
import {freshState,stepPlayer,supportHeight,viewCeiling} from '../island/simulation.js';
import {createLookSway} from '../island/look-sway.js';
import {findVault,bodyClear,vaultPoint,advanceVault,locomotion,resetLocomotion} from '../island/traversal.js';
import {SHOVE,shoveTarget,interruptEnemy,stepEnemyImpulse} from '../island/shove.js';
import {surfaceHit} from '../island/surface-hit.js';
import * as T from '../vendor/three.module.js';
import {createFeedback} from '../island/feedback.js';
import {createFirstPersonMotion} from '../island/first-person-motion.js';
import {freezeLocalTransforms,sleepHiddenBranch} from '../island/render-lifecycle.js';
const player=()=>({x:0,y:10,z:0,yaw:0,vy:0,stamina:100});
const fence={x:0,y:10,z:-1.1,w:4,d:.25,h:.9};
const gridFor=(boxes)=>{const grid=new SpatialGrid(boxes);grid.floorAt=()=>10;return grid;};
test('vault travels the full body corridor at 30, 60 and 120 Hz without a second jump',()=>{
 for(const hz of [30,60,120]){const s=player(),grid=gridFor([fence]),v=findVault(s,grid,grid.floorAt);assert.ok(v);locomotion(s).vault=v;for(let i=0;i<hz;i++){advanceVault(s,1/hz);assert.ok(bodyClear(grid,s.x,s.y,s.z));}assert.equal(s.y,10);assert.ok(s.z<-1.6);assert.equal(locomotion(s).vault,null);assert.equal(locomotion(s).buffer,0);}
 const s={...player(),z:-2.2,yaw:Math.PI};assert.ok(findVault(s,gridFor([fence]),()=>10),'reverse approach');
});
test('vault refuses deep obstacles, ceilings, occupied landings, cliffs and high walls',()=>{
 const obstacles=[[{...fence,z:-1.8,d:3.1}],[fence,{x:0,z:-1,y:12,w:4,d:4,h:.3}],[fence,{x:0,z:-2.5,y:10,w:4,d:2,h:3}],[{...fence,h:2}]];
 for(const boxes of obstacles){const g=gridFor(boxes);assert.equal(findVault(player(),g,g.floorAt),null);}
 const g=gridFor([fence]);assert.equal(findVault(player(),g,(x,z)=>z<-1.3?6:10),null);
 const p=player();locomotion(p).buffer=.1;resetLocomotion(p);assert.equal(locomotion(p).buffer,0);
});
test('jump press is buffered for landing but cannot bounce a second time',()=>{
 const data=createWorldData(),grid=new SpatialGrid(createColliders(data)),s=freshState();s.y=supportHeight(data,s.x,s.z)+.12;s.vy=-3;
 stepPlayer(s,{forward:0,strafe:0,jump:true,sprint:false},data,grid,1/60);
 let jumped=false;for(let i=0;i<8;i++){stepPlayer(s,{forward:0,strafe:0,jump:false},data,grid,1/60);if(s.vy>0)jumped=true;}assert.ok(jumped);
 for(let i=0;i<90;i++)stepPlayer(s,{forward:0,strafe:0,jump:false},data,grid,1/60);assert.equal(s.vy,0);assert.equal(locomotion(s).buffer,0);
});
test('shove selects one visible front target, interrupts before contact, and stops at walls',()=>{
 const s=player(),e={id:'front',x:0,z:-1.3,y:10,alive:true,attackTimer:.001,hit:0,cooldown:0},behind={...e,id:'behind',z:1},side={...e,id:'side',x:2,z:0},grid=gridFor([]);
 assert.equal(shoveTarget(s,[behind,side,e],grid),e);interruptEnemy(e,s);assert.equal(e.attackTimer,0);assert.ok(e.hit>=SHOVE.stagger);assert.equal(e.crimsonWindow,undefined);
 const wall=gridFor([{x:0,y:10,z:-2.1,w:4,d:.2,h:3}]);for(let i=0;i<60;i++)stepEnemyImpulse(e,wall,1/60);assert.ok(e.z>-1.66);assert.ok(!wall.blocked(e.x,e.z,10,.35));
 const cover=gridFor([{x:0,y:10,z:-.6,w:4,d:.1,h:3}]);assert.equal(shoveTarget(s,[e],cover),null);
});
test('contact marks use the actual surface normal and stay inside face edges',()=>{
 const g=gridFor([{x:0,y:10,z:-2,w:2,d:.2,h:3}]),hit=surfaceHit({x:0,y:11,z:0},{x:0,y:0,z:-1},3,g);assert.deepEqual(hit.normal,[0,0,1]);assert.ok(Math.abs(hit.point[2]+1.9)<1e-6);assert.ok(hit.radius<=.32);
 const edge=surfaceHit({x:.94,y:11,z:0},{x:0,y:0,z:-1},3,g);assert.ok(edge.radius<.05);assert.equal(surfaceHit({x:1.2,y:11,z:0},{x:0,y:0,z:-1},3,g),null);
});
test('effects retain bounded pools and blood reaches the floor before making stains',()=>{
 const scene=new T.Scene(),f=createFeedback(scene,()=>0),point=new T.Vector3(0,1.2,0),dir=new T.Vector3(0,0,-1);
 const variants=()=>scene.children.filter(o=>o.isInstancedMesh).map(o=>!!o.instanceColor),before=variants();
 f.impact(point,true,dir,true);f.eject(point,dir);f.surface({point:[0,1,0],normal:[0,0,1],radius:.2},true);
 assert.deepEqual(variants(),before,'First blood, casing and wall mark retain their prepared shader variants');assert.equal(f.active.stains,0);
 for(let i=0;i<65;i++)f.update(1/60);assert.ok(f.active.stains>0);
 for(let i=0;i<200;i++){f.impact(point,true,dir,true);f.surface({point:[0,1,0],normal:[0,0,1],radius:.2},true,true);}
 assert.equal(f.active.particles,96);assert.equal(f.active.surfaces,32);assert.ok(f.active.stains<=40);f.clear();assert.deepEqual(f.active,{particles:0,stains:0,surfaces:0,cases:0});
});
test('reduced motion removes sprint, landing and look sway while wall clearance remains functional',()=>{
 const m=createFirstPersonMotion(),rifle=new T.Group(),arsenal=new T.Group();for(let i=0;i<20;i++){rifle.position.set(0,0,0);rifle.rotation.set(0,0,0);m.update(rifle,arsenal,{dt:1/60,yaw:i*.1,pitch:.2,sprinting:true,landing:1,aim:0,reload:0,wallDistance:2,motion:false});}
 assert.equal(rifle.position.length(),0);assert.equal(arsenal.position.length(),0);assert.equal(arsenal.rotation.x,0);
 m.update(rifle,arsenal,{dt:.05,yaw:2,pitch:0,sprinting:false,landing:0,aim:0,reload:0,wallDistance:.3,motion:false});assert.ok(arsenal.position.y<0);assert.ok(arsenal.position.z>0);
});
test('acceleration and braking agree across frame rates; blocked travel cannot report running',()=>{
 const data=createWorldData(),ends=[];
 for(const hz of [30,60,120]){const s={...freshState(),x:469,z:6,y:14,yaw:Math.PI/2},grid=new SpatialGrid([]);let m;
  for(let i=0;i<hz;i++)m=stepPlayer(s,{forward:1,strafe:0},data,grid,1/hz);
  assert.ok(m.speed>5.1);const stop=s.x;
  for(let i=0;i<hz/2;i++)m=stepPlayer(s,{forward:0,strafe:0},data,grid,1/hz);
  assert.ok(s.x-stop<.15);assert.equal(m.moving,false);ends.push(s.x);
 }
 assert.ok(Math.max(...ends)-Math.min(...ends)<.002);
 const s={...freshState(),x:469,z:6,y:14,yaw:Math.PI/2},grid=new SpatialGrid([{x:471,z:6,y:14,w:.3,d:10,h:4}]);let m;
 for(let i=0;i<180;i++)m=stepPlayer(s,{forward:1,strafe:0,sprint:true},data,grid,1/60);
 assert.equal(m.moving,false);assert.equal(m.sprinting,false);assert.equal(m.distance,0);
 const z=s.z;for(let i=0;i<30;i++)m=stepPlayer(s,{forward:1,strafe:1,sprint:true},data,grid,1/60);
 assert.ok(s.z-z>2);assert.ok(m.speed>5);assert.ok(s.x<470.45);
});
test('stride settles on obstruction and stair smoothing never raises the eye through a ceiling',()=>{
 const m=createFirstPersonMotion();for(let i=0;i<20;i++)m.advance({distance:.1,speed:6,onGround:true},1/60);
 const phase=m.stride.phase;for(let i=0;i<40;i++)m.advance({distance:0,speed:0,onGround:true},1/60);
 assert.equal(m.stride.phase,phase);assert.ok(m.stride.weight<.001);
 m.eyeHeight(14,true,1/60);const eye=m.eyeHeight(14.35,true,1/60);assert.ok(eye>15.7&&eye<16.05);
 assert.equal(m.eyeHeight(15,false,1/60),16.7);m.reset();assert.equal(m.stride.phase,0);
});
test('sleeping render branches reveal at the current transform and preserve explicit queries',()=>{
 const scene=new T.Scene(),root=new T.Group(),child=new T.Object3D();scene.add(root);root.add(child);child.position.set(2,3,4);freezeLocalTransforms(child);sleepHiddenBranch(root);
 scene.updateMatrixWorld(true);root.visible=false;root.position.x=10;scene.updateMatrixWorld(true);
 assert.equal(child.matrixWorld.elements[12],2);assert.equal(child.getWorldPosition(new T.Vector3()).x,12);
 root.position.x=20;root.visible=true;scene.updateMatrixWorld(true);assert.equal(child.matrixWorld.elements[12],22);
});
test('look sway has the same turn response at 30, 60 and 120 Hz and no hidden-turn kick',()=>{
 for(const options of [{},{response:9,xGain:-.3/60,yGain:-.3/60,maxRate:4.8}]){
  const samples=[];for(const hz of [30,60,120]){const sway=createLookSway(options),dt=1/hz;let out;sway.update(0,0,dt);
   for(let i=1;i<=hz;i++)out=sway.update(i*dt,i*dt*.5,dt);samples.push({...out});
   for(let i=0;i<hz/2;i++)out=sway.update(1,.5,dt);assert.ok(Math.abs(out.x)<.00006);
   sway.update(1,.5,dt,true,false);out=sway.update(2.8,-.4,dt);assert.deepEqual(out,{x:0,y:0});
   out=sway.update(2.9,-.3,dt,false);assert.deepEqual(out,{x:0,y:0});
  }
  for(const key of ['x','y'])assert.ok(Math.max(...samples.map(s=>s[key]))-Math.min(...samples.map(s=>s[key]))<.000001);
 }
 const wrap=createLookSway();wrap.update(Math.PI-.005,0,1/60);assert.ok(wrap.update(-Math.PI+.005,0,1/60).x>0,'yaw wrapping retains the small turn direction');
});
test('descending real stairs stays supported while ledges, jumps and camera ceilings remain physical',()=>{
 const data=createWorldData(),grid=new SpatialGrid(createColliders(data));
 for(const hz of [30,60,120])for(const [x,z,yaw,seconds]of [[1210,220,Math.PI/2,10],[-406,-286,-Math.PI/2,5]]){
  const s={...freshState(),x,z,yaw,y:supportHeight(data,x,z)},m=createFirstPersonMotion();let eye=m.eyeHeight(s.y,true,1/hz);
  for(let i=0;i<seconds*hz;i++){const oldEye=eye,step=stepPlayer(s,{forward:1,strafe:0},data,grid,1/hz);assert.ok(step.onGround);eye=m.eyeHeight(s.y,step.onGround,1/hz,viewCeiling(grid,s.x,s.y,s.z));assert.ok(oldEye-eye<.15);}
 }
 const s={...freshState(),x:469,z:6,y:14};stepPlayer(s,{forward:0,strafe:0,jump:true},data,grid,1/60);assert.ok(s.vy>5&&s.y>14);
 s.y=16;s.vy=0;const fall=stepPlayer(s,{forward:0,strafe:0},data,grid,1/60);assert.equal(fall.onGround,false);assert.ok(s.y>15.9&&s.vy<0);
 const ceilingGrid=new SpatialGrid([{x:0,z:0,w:4,d:4,y:12,h:.2}]),m=createFirstPersonMotion();m.eyeHeight(10.3,true,1/60);assert.ok(m.eyeHeight(10,true,1/60,viewCeiling(ceilingGrid,0,10,0))<=11.9);
 assert.equal(m.eyeHeight(9,false,1/60),10.7,'unsupported falls clear step compensation');
});
