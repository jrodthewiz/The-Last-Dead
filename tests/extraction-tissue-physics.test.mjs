import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import * as CANNON from '../vendor/cannon-es.js';
import {CorpsePhysics,CORPSE_PHYSICS_LIMITS} from '../corpse-physics.js';

const course=()=>({w:3,h:3,cells:Array.from({length:9},()=>[0,0,0,0])});
const line=(count=28,y=.38)=>Array.from({length:count},(_,i)=>new THREE.Vector3(4+i*.035,y,4));
const coil=(count=32)=>Array.from({length:count},(_,i)=>{const f=i/(count-1),theta=f*Math.PI*5;return new THREE.Vector3(4+Math.sin(theta)*.14,.8+Math.sin(theta*.5)*.035,4+f*.22+Math.cos(theta)*.04);});
function physicsWorld(){const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0,mode:'play'});return physics;}
function advance(physics,seconds,rate=60,start=0){for(let i=1;i<=Math.round(seconds*rate);i++)physics.update({time:start+i/rate,mode:'play'});}
function finiteChain(handle){
  for(const body of handle.bodies){for(const value of [...body.position.toArray(),...body.velocity.toArray()])assert(Number.isFinite(value),'particle remains finite');assert(body.velocity.length()<=CORPSE_PHYSICS_LIMITS.maxTissueVelocity+1e-8,'particle speed bounded');}
  for(const joint of handle.constraints)assert(joint.bodyA.position.distanceTo(joint.bodyB.position)<joint.distance+.035,'neighbouring lengths remain bounded');
}

test('tissue chains share the bundled world, use static-only collision and preserve the initial contour lengths',()=>{
  const physics=physicsWorld(),points=line(),handle=physics.addTissueChain(points);
  assert(handle);assert.equal(handle.removed,false);assert.equal(handle.bodies.length,28);assert.equal(handle.constraints.length,27);
  assert.equal(handle.bodies[0].type,CANNON.Body.KINEMATIC);assert(handle.bodies.slice(1).every(b=>b.type===CANNON.Body.DYNAMIC));
  assert(handle.bodies.every(b=>b.shapes[0] instanceof CANNON.Sphere&&b.collisionFilterGroup===8&&b.collisionFilterMask===1));
  assert(physics.statics.every(b=>(b.collisionFilterMask&8)!==0),'floor and course walls accept tissue contacts');
  handle.constraints.forEach((joint,i)=>{assert(joint instanceof CANNON.DistanceConstraint);assert.equal(joint.collideConnected,false);assert(Math.abs(joint.distance-points[i].distanceTo(points[i+1]))<1e-10);});
  const output=[];assert.equal(physics.tissueChainPoints(handle,output),output);const reused=output.slice();physics.tissueChainPoints(handle,output);assert(output.every((p,i)=>p===reused[i]));
  assert.equal(physics.tissueChainPoints(handle),handle.points);assert.equal(physics.diagnostics().constraints,27);physics.dispose();
});

test('global two-chain and 32-point budgets evict the oldest complete chain without leaving its constraints',()=>{
  const physics=physicsWorld(),first=physics.addTissueChain(line(40)),second=physics.addTissueChain(line(28)),third=physics.addTissueChain(line(26),{maxChains:99});
  assert.equal(first.bodies.length,32);assert(first.removed);assert(!second.removed&&!third.removed);
  assert(first.bodies.every(b=>!physics.world.bodies.includes(b)));assert(first.constraints.every(c=>!physics.world.constraints.includes(c)));
  const d=physics.diagnostics();assert.equal(d.maxTissueChains,2);assert.equal(d.tissueChains,2);assert.equal(d.tissueBodies,54);assert.equal(d.tissueConstraints,52);assert.equal(d.culledTissueChains,1);
  assert.equal(physics.addTissueChain([]),null);assert.equal(physics.addTissueChain([new THREE.Vector3(),new THREE.Vector3(NaN,0,0)]),null);
  assert(physics.removeTissueChain(third));assert(!physics.removeTissueChain(third));assert.equal(physics.tissueChainPoints(third),null);physics.dispose();
});

test('unpulled intestine sags under gravity and lands above the shared floor',()=>{
  const physics=physicsWorld(),handle=physics.addTissueChain(line(32,.38));advance(physics,5);
  const points=physics.tissueChainPoints(handle);assert.equal(points[0].y,.38);assert(Math.min(...points.slice(1).map(p=>p.y))<.08,'free particles fall and pool on the floor');
  assert(points.every(p=>p.y>0),'tissue remains above the ground half-space');finiteChain(handle);assert(physics.diagnostics().sleeping>0,'settled particles can sleep');physics.dispose();
});

test('kinematic body anchor follows a posed abdomen, and the guided endpoint releases back to gravity',()=>{
  const physics=physicsWorld(),handle=physics.addTissueChain(line(28,1.1)),anchor=new THREE.Vector3(4.04,1.12,4.03),pull=new THREE.Vector3(4.5,1.28,4.1);
  assert(physics.setTissueChain(handle,{anchor,pull}));assert(handle.bodies[0].position.almostEquals(new CANNON.Vec3(anchor.x,anchor.y,anchor.z)));
  const last=handle.bodies.at(-1);assert.equal(last.type,CANNON.Body.KINEMATIC);assert(last.position.almostEquals(new CANNON.Vec3(pull.x,pull.y,pull.z)));
  advance(physics,.5);assert(last.position.almostEquals(new CANNON.Vec3(pull.x,pull.y,pull.z)));
  assert(physics.setTissueChain(handle,{anchor,pull:null}));assert.equal(last.type,CANNON.Body.DYNAMIC);assert.equal(last.mass,handle.mass);const heldHeight=last.position.y;
  advance(physics,.8,60,.5);assert(last.position.y<heldHeight-.05,'released end falls');finiteChain(handle);
  const before=last.position.clone();assert(!physics.setTissueChain(handle,{anchor:new THREE.Vector3(NaN,0,0)}));assert(last.position.almostEquals(before));physics.dispose();
});

test('pause advances the clock without moving chain particles or consuming fixed steps',()=>{
  const physics=physicsWorld(),handle=physics.addTissueChain(line());advance(physics,.25);const poses=handle.bodies.map(b=>b.position.clone()),steps=physics.steps;
  physics.update({time:1.25,mode:'pause'});assert.equal(physics.steps,steps);handle.bodies.forEach((b,i)=>assert(b.position.almostEquals(poses[i])));
  physics.update({time:1.25,mode:'play'});assert.equal(physics.steps,steps);physics.update({time:1.25+1/60,mode:'play'});assert.equal(physics.steps,steps+1);physics.dispose();
});

test('low-FPS anchor motion and an overreaching pull remain finite with bounded material extension',()=>{
  const physics=physicsWorld(),handle=physics.addTissueChain(line(32,.9));
  for(let i=1;i<=40;i++){
    const anchor=new THREE.Vector3(4+Math.sin(i*.12)*.08,.9+Math.cos(i*.16)*.035,4),pull=i<18?new THREE.Vector3(anchor.x+.5,anchor.y+.15,4.1):null;
    physics.setTissueChain(handle,{anchor,pull});physics.update({time:i/10,mode:'play'});finiteChain(handle);
  }
  physics.setTissueChain(handle,{anchor:new THREE.Vector3(4,.9,4),pull:new THREE.Vector3(40,40,40)});
  assert(handle.pull.distanceTo(handle.anchor)<=handle.totalLength+1e-8,'hand guide cannot stretch past the full contour length');
  advance(physics,.5,10,4);finiteChain(handle);physics.update({time:7,mode:'play'});assert(physics.diagnostics().clampedFrames>0);finiteChain(handle);physics.dispose();
});

test('fast chain particles contact the same course walls as corpses',()=>{
  const physics=new CorpsePhysics(),map=course();map.cells[4][1]=1;map.cells[5][3]=1;physics.rebuild(map);physics.update({time:0});
  const handle=physics.addTissueChain(Array.from({length:26},(_,i)=>new THREE.Vector3(7.45,.7,5.5+i*.025)));
  for(const body of handle.bodies.slice(1))body.velocity.set(80,0,0);advance(physics,2,30);finiteChain(handle);
  assert(handle.bodies.every(b=>b.position.x<7.95),'inner wall stops particles at the intended side');assert(handle.bodies.every(b=>b.position.y>0));physics.dispose();
});

test('reset, rebuild and dispose release all tissue particles and every distance constraint',()=>{
  const physics=physicsWorld(),first=physics.addTissueChain(line()),second=physics.addTissueChain(line());advance(physics,.2);physics.reset();
  assert(first.removed&&second.removed);assert.equal(physics.diagnostics().tissueBodies,0);assert.equal(physics.world.constraints.length,0);assert.equal(physics.world.bodies.length,physics.statics.length);assert.equal(physics.steps,0);
  const third=physics.addTissueChain(line());physics.rebuild(course());assert(third.removed);assert.equal(physics.world.constraints.length,0);
  const fourth=physics.addTissueChain(line());physics.dispose();assert(fourth.removed);assert.equal(physics.world.bodies.length,0);assert.equal(physics.world.constraints.length,0);assert.equal(physics.addTissueChain(line()),null);physics.dispose();
});

test('distributed mesentery support preserves a packed coil while particles remain physically compliant',()=>{
  const physics=physicsWorld(),rest=coil(),handle=physics.addTissueChain(rest,{supportPoints:rest});advance(physics,1);
  let points=physics.tissueChainPoints(handle);assert(points.every((p,i)=>p.distanceTo(rest[i])<.015),'supported coil does not turn into a hanging rod');
  const before=points[14].clone();handle.bodies[14].wakeUp();handle.bodies[14].velocity.set(.5,.15,.1);advance(physics,.1,60,1);
  points=physics.tissueChainPoints(handle);assert(points[14].distanceTo(before)>.001,'rest support allows physical movement');advance(physics,2,60,1.1);
  points=physics.tissueChainPoints(handle);assert(points.every((p,i)=>p.distanceTo(rest[i])<.045),'damped support returns displaced tissue into the cavity');
  const box=new THREE.Box3().setFromPoints(points);assert(box.getSize(new THREE.Vector3()).length()<.43,'packed silhouette stays bounded');finiteChain(handle);physics.dispose();
});

test('rest supports follow a rotated torso through spring forces without teleporting dynamic tissue',()=>{
  const physics=physicsWorld(),rest=coil(),handle=physics.addTissueChain(rest,{supportPoints:rest});advance(physics,.3);
  const old=handle.bodies.map(b=>b.position.clone()),origin=rest[0],rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.7),translation=new THREE.Vector3(.14,.06,-.09),next=rest.map(p=>p.clone().sub(origin).applyQuaternion(rotation).add(origin).add(translation));
  const supportVectors=handle.supportPoints.slice();assert(physics.setTissueChain(handle,{anchor:next[0],supportPoints:next,extractionProgress:0}));
  handle.bodies.slice(1).forEach((b,i)=>assert(b.position.almostEquals(old[i+1]),'pose update does not directly move dynamic particles'));
  assert(handle.supportPoints.every((p,i)=>p===supportVectors[i]),'support vectors reuse existing storage');advance(physics,2,60,.3);
  const points=physics.tissueChainPoints(handle);assert(points.slice(1).every((p,i)=>p.distanceTo(next[i+1])<.055),'spring attachments follow the new cavity frame');finiteChain(handle);physics.dispose();
});

test('extraction releases distal mesentery progressively, then lets the complete coil sag and contact the floor',()=>{
  const physics=physicsWorld(),rest=coil(),handle=physics.addTissueChain(rest,{supportPoints:rest});advance(physics,.2);
  physics.setTissueChain(handle,{extractionProgress:.4});advance(physics,1.5,60,.2);const partial=physics.tissueChainPoints(handle).map(p=>p.clone());
  assert(partial.slice(1,5).every((p,i)=>p.distanceTo(rest[i+1])<.055),'proximal coil remains attached while the end frees');
  assert(partial.at(-1).y<rest.at(-1).y-.08,'distal free portion sags while proximal support remains');
  physics.setTissueChain(handle,{extractionProgress:1});advance(physics,3,60,1.7);const released=physics.tissueChainPoints(handle);
  assert(Math.min(...released.slice(1).map(p=>p.y))<.04,'fully released coil falls to the shared floor');assert(released.every(p=>p.y>0));finiteChain(handle);
  assert.equal(handle.extractionProgress,1);assert(handle.bodies.slice(1).every(b=>b.type===CANNON.Body.DYNAMIC));physics.dispose();
});

test('support inputs reject invalid shape samples and can be cleared without changing the legacy free-chain API',()=>{
  const physics=physicsWorld(),rest=coil(),handle=physics.addTissueChain(rest,{supportPoints:rest});
  assert.equal(physics.addTissueChain(rest,{supportPoints:rest.slice(0,10)}),null);const prior=handle.supportPoints.map(p=>p.clone()),invalid=rest.map(p=>p.clone());invalid[4].x=NaN;
  assert(!physics.setTissueChain(handle,{supportPoints:invalid,extractionProgress:.5}));assert.equal(handle.extractionProgress,0);assert(handle.supportPoints.every((p,i)=>p.equals(prior[i])));
  assert(!physics.setTissueChain(handle,{extractionProgress:Infinity}));assert(physics.setTissueChain(handle,{supportPoints:null}));assert.equal(handle.supportPoints,null);
  advance(physics,3);assert(Math.min(...physics.tissueChainPoints(handle).slice(1).map(p=>p.y))<.05,'clearing support restores free gravity');finiteChain(handle);physics.dispose();
});

test('compliant extraction guide changes only its spring target after physics and never stretches the rendered endpoint',()=>{
  const physics=physicsWorld(),rest=coil(),handle=physics.addTissueChain(rest,{supportPoints:rest}),last=handle.bodies.at(-1),initial=last.position.clone();
  physics.setTissueChain(handle,{pull:rest.at(-1).clone().add(new THREE.Vector3(.5,.45,.3)),pullCompliance:true,extractionProgress:.6});
  assert.equal(last.type,CANNON.Body.DYNAMIC);assert.equal(last.mass,handle.mass);assert(last.position.almostEquals(initial),'setting a far guide does not teleport the final particle');
  assert.equal(physics.diagnostics().tissueCompliantGuides,1);
  for(let i=1;i<=36;i++){
    physics.update({time:i/12,mode:'play'});const before=last.position.clone();
    const pull=rest.at(-1).clone().add(new THREE.Vector3(2*Math.sin(i*.23),2+.2*Math.cos(i*.17),1.4));
    physics.setTissueChain(handle,{anchor:rest[0],pull,extractionProgress:.6});
    assert(last.position.almostEquals(before),'render-time guide updates preserve the endpoint physics pose');
    for(const joint of handle.constraints.slice(-8))assert(joint.bodyA.position.distanceTo(joint.bodyB.position)<=joint.distance*1.2+1e-8,'guide cannot create a rod by stretching its final links');
    finiteChain(handle);
  }
  assert(last.position.distanceTo(initial)>.025,'bounded spring traction moves dynamic tissue');assert(last.position.distanceTo(new CANNON.Vec3(handle.pull.x,handle.pull.y,handle.pull.z))>.025,'guide remains physically compliant');
  physics.setTissueChain(handle,{pull:null});assert.equal(last.type,CANNON.Body.DYNAMIC);assert.equal(physics.diagnostics().tissueCompliantGuides,0);physics.dispose();
});

test('compliant pull retains floor and wall collision and cleanup when its guide targets beyond a course wall',()=>{
  const physics=new CorpsePhysics(),map=course();map.cells[4][1]=1;map.cells[5][3]=1;physics.rebuild(map);physics.update({time:0});
  const points=Array.from({length:28},(_,i)=>new THREE.Vector3(7.25,.65,5.3+i*.032)),handle=physics.addTissueChain(points),last=handle.bodies.at(-1);
  physics.setTissueChain(handle,{pull:new THREE.Vector3(12,.3,6),pullCompliance:true});advance(physics,3,20);
  assert(handle.bodies.every(b=>b.position.x<7.95),'soft guide cannot drag particles through the inner wall');assert(handle.bodies.every(b=>b.position.y>0),'soft guide keeps shared floor contacts');finiteChain(handle);
  const guided=last.position.clone();physics.setTissueChain(handle,{pull:null});advance(physics,1,30,3);assert(!last.position.almostEquals(guided),'clearing the guide leaves free dynamic motion');
  assert(physics.removeTissueChain(handle));assert(handle.removed);assert.equal(physics.diagnostics().tissueCompliantGuides,0);assert.equal(physics.world.constraints.length,0);assert.equal(physics.world.bodies.length,physics.statics.length);physics.dispose();
});

test('hard endpoint behavior remains the default and can explicitly switch back from a compliant guide',()=>{
  const physics=physicsWorld(),handle=physics.addTissueChain(line(28,1.1)),last=handle.bodies.at(-1),hard=new THREE.Vector3(4.5,1.15,4.05);
  physics.setTissueChain(handle,{pull:hard});assert.equal(handle.pullCompliance,false);assert.equal(last.type,CANNON.Body.KINEMATIC);assert(last.position.almostEquals(new CANNON.Vec3(hard.x,hard.y,hard.z)));
  const prior=last.position.clone();physics.setTissueChain(handle,{pull:hard.clone().add(new THREE.Vector3(.1,.1,.1)),pullCompliance:true});assert.equal(last.type,CANNON.Body.DYNAMIC);assert(last.position.almostEquals(prior));
  physics.setTissueChain(handle,{pull:hard,pullCompliance:false});assert.equal(last.type,CANNON.Body.KINEMATIC);assert(last.position.almostEquals(new CANNON.Vec3(hard.x,hard.y,hard.z)));
  assert(!physics.setTissueChain(handle,{pull:hard,pullCompliance:'yes'}));physics.reset();assert(handle.removed);assert.equal(physics.diagnostics().tissueCompliantGuides,0);physics.dispose();
});
