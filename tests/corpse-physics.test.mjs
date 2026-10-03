import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import * as CANNON from '../vendor/cannon-es.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {createAfterlifeModel,animateAfterlifeModel} from '../npc-afterlife-model.js';
import {CorpsePhysics,CORPSE_PHYSICS_LIMITS} from '../corpse-physics.js';

const raw=readFileSync(new URL('../assets/models/afterlife-ash-witness-rig-v05.glb',import.meta.url));
const asset=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
function actualRig(){
  const objects=asset.nodes.map((node,index)=>{const object=asset.skins[0].joints.includes(index)?new THREE.Bone():new THREE.Group();object.name=node.name||'';
    if(node.matrix)new THREE.Matrix4().fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);
    else{if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);if(node.scale)object.scale.fromArray(node.scale);}return object;
  });
  asset.nodes.forEach((node,index)=>node.children?.forEach(child=>objects[index].add(objects[child])));
  const root=new THREE.Group();for(const index of asset.scenes[asset.scene||0].nodes)root.add(objects[index]);root.position.set(4,0,4);root.rotation.y=.7;root.updateMatrixWorld(true);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.1,0,0,0,.1,0],3));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  const material=new THREE.MeshStandardMaterial(),mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='ExistingVisibleSkin';root.add(mesh);mesh.bind(new THREE.Skeleton(asset.skins[0].joints.map(i=>objects[i])));root.updateMatrixWorld(true);
  return{root,mesh,geometry,material,bones:asset.skins[0].joints.map(i=>objects[i])};
}
function course(){return{w:3,h:3,cells:Array.from({length:9},()=>[0,0,0,0])};}
function advance(physics,seconds,rate=120,start=0){for(let i=1;i<=Math.round(seconds*rate);i++){physics.update({time:start+i/rate,mode:'play'});physics.sync();}}
function pose(root,name){return root.getObjectByName(name).getWorldPosition(new THREE.Vector3());}
function finiteRig(state){for(const node of state.nodes){for(const value of [...node.body.position.toArray(),...node.body.quaternion.toArray(),...node.body.velocity.toArray()])assert(Number.isFinite(value),node.key+' remains finite');}}
function simpleDrop(){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.18,.14,.3),new THREE.MeshStandardMaterial());mesh.position.set(4,2,4);return mesh;}

test('empty cosmetic world skips idle steps and a new drop starts without an accumulated backlog',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0,mode:'play'});
  advance(physics,2);
  assert.equal(physics.steps,0);assert.equal(physics.accumulator,0);assert.equal(physics.lastTime,2);
  const drop=physics.addDrop(simpleDrop());physics.update({time:2+CORPSE_PHYSICS_LIMITS.timestep,mode:'play'});physics.sync();
  assert.equal(physics.steps,1);assert(drop.body.position.y<2,'new bodies still fall on their first live step');
  physics.dispose();
});

test('official cannon-es JS distribution and MIT license are bundled with no runtime dependency',()=>{
  const vendor=readFileSync(new URL('../vendor/cannon-es.js',import.meta.url)),license=readFileSync(new URL('../vendor/CANNON-ES-LICENSE.txt',import.meta.url),'utf8');
  assert.equal(vendor.length,346256);assert(license.includes('Copyright (c) 2015 cannon.js Authors'));assert(license.includes('Permission is hereby granted, free of charge'));assert.equal(typeof CANNON.World,'function');
  assert.equal(createHash('sha256').update(vendor).digest('hex'),'f0700cbd3a482954949b9d58c1b0f76dcc74767750297647a39d8c40dd63d37c');
});

test('course wall proxies use 4m cells, merge duplicate edge segments, and rebuild cleans old colliders',()=>{
  const physics=new CorpsePhysics(),map=course();physics.rebuild(map);assert.equal(physics.statics.length,5);
  map.cells[4][1]=1;map.cells[5][3]=1;physics.rebuild(map);assert.equal(physics.statics.length,6);
  const inner=physics.statics.find(b=>Math.abs(b.position.x-8)<1e-9&&Math.abs(b.position.z-6)<1e-9);assert(inner);assert.equal(inner.shapes[0].halfExtents.z,2.015);
  physics.rebuild(course());assert.equal(physics.world.bodies.length,5);physics.dispose();assert.equal(physics.world.bodies.length,0);
});

test('actual imported hierarchy binds 15 dynamic proxies and 14 posed cone joints while preserving all skin assets',()=>{
  const physics=new CorpsePhysics(),rig=actualRig();physics.rebuild(course());const hierarchy=rig.bones.map(b=>b.parent),geometry=rig.mesh.geometry,skeleton=rig.mesh.skeleton,material=rig.mesh.material;
  const state=physics.ensureRagdoll(rig.root,{id:3,dead:true});assert.equal(state.nodes.length,15);assert.equal(state.constraints.length,14);assert.equal(state.bindings.length,rig.bones.length);
  assert(state.constraints.every(c=>c instanceof CANNON.ConeTwistConstraint));assert.equal(physics.diagnostics().dynamicBodies,15);
  const chest=state.nodes.find(n=>n.key==='chest');assert(chest.length>.3&&chest.length<.45,'uses real metre-scale source joint positions');
  physics.update({time:0,mode:'play'});advance(physics,.5);finiteRig(state);
  assert.equal(rig.mesh.geometry,geometry);assert.equal(rig.mesh.skeleton,skeleton);assert.equal(rig.mesh.material,material);assert.deepEqual(rig.bones.map(b=>b.parent),hierarchy);
  assert(rig.root.position.equals(new THREE.Vector3(4,0,4)),'root anchor remains owned by renderer');physics.dispose();
});

test('head removal and a severed arm exclude disconnected source-bone proxies and constraints',()=>{
  for(const[type,side,count]of[['twist','right',14],['chop','left',12],['chop','right',12]]){
    const physics=new CorpsePhysics(),rig=actualRig();physics.rebuild(course());const state=physics.ensureRagdoll(rig.root,{id:7,dead:true,brutalWound:{type,side}});
    assert.equal(state.nodes.length,count);assert.equal(state.constraints.length,count-1);assert(!state.nodes.some(n=>type==='twist'?n.key==='head':n.key.startsWith(side)&&/Arm|Hand/.test(n.key)));
    physics.update({time:0});advance(physics,1);finiteRig(state);physics.dispose();
  }
});

test('kinematic chest hold follows authored bones and releases once with inherited motion and one impulse',()=>{
  const physics=new CorpsePhysics(),rig=actualRig();physics.rebuild(course());physics.update({time:0});const state=physics.ensureRagdoll(rig.root,{id:5,dead:true},{held:true});
  assert(state.nodes.every(n=>n.body.type===CANNON.Body.KINEMATIC));const initial=pose(rig.root,'LeftHand');rig.root.position.x+=.1;
  const original=rig.root.getObjectByName('LeftArm').quaternion.clone();rig.root.getObjectByName('LeftArm').rotateZ(.1);rig.root.updateMatrixWorld(true);
  physics.update({time:.025});physics.sync();assert(pose(rig.root,'LeftHand').distanceTo(initial)>.05,'authored animation retains ownership while held');
  const before=state.nodes.find(n=>n.key==='chest').body.position.clone();physics.ensureRagdoll(rig.root,{id:5,dead:true},{held:false,impulse:new THREE.Vector3(0,1,2)});
  assert(!state.held);assert(state.nodes.every(n=>n.body.type===CANNON.Body.DYNAMIC));const v=state.nodes.find(n=>n.key==='chest').body.velocity.clone();
  physics.ensureRagdoll(rig.root,{id:5,dead:true},{held:false,impulse:new THREE.Vector3(0,10,100)});assert(state.nodes.find(n=>n.key==='chest').body.velocity.almostEquals(v));
  physics.ensureRagdoll(rig.root,{id:5,dead:true},{held:true});assert(!state.held,'released bodies cannot re-enter hold');advance(physics,.5,120,.025);
  assert(state.nodes.find(n=>n.key==='chest').body.position.distanceTo(before)>.05);finiteRig(state);physics.dispose();assert(rig.root.getObjectByName('LeftArm').quaternion.angleTo(original)<.11);
});

test('articulated fall reaches the floor without stretching source bone chains or unstable impulses',()=>{
  const physics=new CorpsePhysics(),rig=actualRig();physics.rebuild(course());physics.update({time:0});const state=physics.ensureRagdoll(rig.root,{id:2,dead:true},{impulse:new THREE.Vector3(1,.1,-4)});
  const translations=new Map(state.bindings.filter(b=>b.bone.name!=='Hips').map(b=>[b.bone,b.bone.position.clone()]));
  const high=pose(rig.root,'Head').y;advance(physics,5);finiteRig(state);assert(pose(rig.root,'Head').y<high-.5,'head physically falls');
  for(const[bone,translation]of translations)assert(bone.position.distanceTo(translation)<1e-8,bone.name+' source translation preserved');
  for(const node of state.nodes){assert(node.body.position.y>-.05,node.key+' body stays above floor');assert(node.body.velocity.length()<2,node.key+' settles instead of exploding: '+node.body.velocity.length());}
  for(const joint of state.constraints){const a=joint.bodyA.pointToWorldFrame(joint.pivotA),b=joint.bodyB.pointToWorldFrame(joint.pivotB);assert(a.distanceTo(b)<.045,'joint contact tolerance bounded');}
  physics.dispose();
});

test('fixed elapsed clock produces equal 30/60/120 Hz results and pause consumes no simulation time',()=>{
  const snapshots=[];
  for(const rate of[30,60,120]){const physics=new CorpsePhysics(),rig=actualRig();physics.rebuild(course());physics.update({time:0});const state=physics.ensureRagdoll(rig.root,{id:8,dead:true},{impulse:new THREE.Vector3(1,.3,2)});advance(physics,2,rate);
    const before=state.nodes.map(n=>n.body.position.clone());physics.update({time:3,mode:'pause'});physics.sync();assert.equal(physics.steps,120);state.nodes.forEach((n,i)=>assert(n.body.position.almostEquals(before[i])));
    physics.update({time:3});assert.equal(physics.steps,120,'duplicate render clock does not step');snapshots.push(state.nodes.map(n=>n.body.position.toArray()));physics.dispose();
  }
  for(const snapshot of snapshots.slice(1))snapshot.forEach((v,i)=>v.forEach((n,j)=>assert(Math.abs(n-snapshots[0][i][j])<1e-7)));
});

test('fast dropped object hits course walls and floor rather than tunneling',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});const map=course();map.cells[4][1]=1;map.cells[5][3]=1;physics.rebuild(map);physics.update({time:0});
  const mesh=simpleDrop();mesh.position.set(7.5,1.5,6);const handle=physics.addDrop(mesh,{velocity:new THREE.Vector3(80,0,0),angularVelocity:new THREE.Vector3(0,8,1),lifetime:8});
  assert.equal(handle.body.velocity.length(),8,'explicit launch speed bounded');advance(physics,3,30);assert(handle.body.position.x<7.95);assert(handle.body.position.y>.03);assert(mesh.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(handle.body.position.x,handle.body.position.y,handle.body.position.z))<1e-6);
  physics.dispose();
});

test('non-centered item geometry and transformed parent retain exact world origin, orientation and scale',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});const parent=new THREE.Group();parent.position.set(3,.1,3);parent.rotation.y=.45;parent.scale.setScalar(1.4);
  const mesh=new THREE.Group(),child=new THREE.Mesh(new THREE.BoxGeometry(.12,.2,.4),new THREE.MeshStandardMaterial());child.position.set(.15,.05,.28);child.rotation.y=.2;mesh.add(child);mesh.position.set(.3,1,.1);mesh.rotation.set(.1,-.6,.2);mesh.scale.set(.8,.9,1.1);parent.add(mesh);parent.updateMatrixWorld(true);
  const world=mesh.matrixWorld.clone(),bounds=new THREE.Box3().setFromObject(mesh,true);const handle=physics.addDrop(mesh,{velocity:new THREE.Vector3(0,0,0)});physics.sync();
  mesh.updateWorldMatrix(true,true);world.elements.forEach((v,i)=>assert(Math.abs(v-mesh.matrixWorld.elements[i])<1e-7,'adding a drop does not teleport the original origin'));
  const center=handle.centerLocal.clone().applyMatrix4(mesh.matrixWorld);assert(center.distanceTo(new THREE.Vector3(handle.body.position.x,handle.body.position.y,handle.body.position.z))<1e-7);
  handle.body.position.y+=.4;handle.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0),1);physics.sync();
  assert(handle.centerLocal.clone().applyMatrix4(mesh.matrixWorld).distanceTo(new THREE.Vector3(handle.body.position.x,handle.body.position.y,handle.body.position.z))<1e-6,'sync tracks centroid offset after rotation');
  const actualScale=mesh.getWorldScale(new THREE.Vector3());assert(actualScale.distanceTo(handle.worldScale)<1e-7);assert(!bounds.isEmpty());physics.dispose();
});

test('bounded pools freeze old skeletons, expire drops, and reset removes every dynamic body and joint',()=>{
  const physics=new CorpsePhysics({maxRagdolls:2,maxDrops:2,lifetime:.5});physics.rebuild(course());physics.update({time:0});const first=actualRig(),second=actualRig(),third=actualRig();
  const old=physics.ensureRagdoll(first.root,{id:1,dead:true});physics.ensureRagdoll(second.root,{id:2,dead:true});advance(physics,.1);physics.ensureRagdoll(third.root,{id:3,dead:true});
  assert.equal(physics.rigs.size,2);assert(physics.has(first.root));assert(old.frozen);assert.equal(physics.ensureRagdoll(first.root,{id:1,dead:true}),old,'frozen old corpse never rebinds');
  const handles=[physics.addDrop(simpleDrop(),{lifetime:.1}),physics.addDrop(simpleDrop(),{lifetime:.1}),physics.addDrop(simpleDrop(),{lifetime:.1})];assert(handles[0].removed);assert.equal(physics.drops.size,2);
  advance(physics,1,120,.1);assert.equal(physics.drops.size,0);assert.equal(physics.rigs.size,0);assert.equal(physics.world.constraints.length,0);assert.equal(physics.world.bodies.length,physics.statics.length);
  physics.reset();assert.equal(physics.frozen.size,0);assert(!physics.has(first.root));assert(!first.root.userData.corpsePhysics);assert.equal(physics.steps,0);physics.dispose();assert.equal(physics.world.bodies.length,0);
});

test('batched weapon pieces use every instance transform for physical bounds without editing source instances',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});
  const weapon=new THREE.Group(),geometry=new THREE.BoxGeometry(.1,.2,.3),instances=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial(),3),m=new THREE.Matrix4();
  instances.setMatrixAt(0,m.makeTranslation(1,0,0));instances.setMatrixAt(1,m.makeTranslation(2,.2,.4));instances.setMatrixAt(2,m.compose(new THREE.Vector3(-.5,0,.2),new THREE.Quaternion(),new THREE.Vector3(2,1,.5)));
  instances.position.set(.25,0,.2);weapon.add(instances);weapon.position.set(4,2,4);weapon.rotation.y=.5;weapon.scale.setScalar(1.2);weapon.updateMatrixWorld(true);
  const originalInstances=instances.instanceMatrix.array.slice(),originalVertices=geometry.attributes.position.array.slice();
  const handle=physics.addDrop(weapon);assert(Math.abs(handle.centerLocal.x-.975)<1e-6,'far instance placements affect centroid');
  assert(Math.abs(handle.body.shapes[0].halfExtents.x-1.59)<1e-6,'collider spans every far-offset instance');assert(Math.abs(handle.body.shapes[0].halfExtents.y-.24)<1e-6);assert(Math.abs(handle.body.shapes[0].halfExtents.z-.42)<1e-6);
  physics.sync();assert.deepEqual(instances.instanceMatrix.array,originalInstances);assert.deepEqual(geometry.attributes.position.array,originalVertices);
  assert.equal(physics.addDrop(weapon),handle,'duplicate binding does not create another body');physics.dispose();
});

test('drop expiry writes the final physics pose before leaving its cosmetic mesh behind',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});const mesh=simpleDrop(),initial=mesh.position.clone();
  const handle=physics.addDrop(mesh,{velocity:new THREE.Vector3(2,0,1),lifetime:.025});physics.update({time:.05});assert(handle.removed);assert.equal(physics.drops.size,0);
  assert(mesh.position.distanceTo(initial)>.05,'expired drop receives its final motion');
  assert(handle.centerLocal.clone().applyMatrix4(mesh.matrixWorld).distanceTo(new THREE.Vector3(handle.body.position.x,handle.body.position.y,handle.body.position.z))<1e-7);
  const final=mesh.matrixWorld.clone();physics.sync();assert.deepEqual(mesh.matrixWorld.elements,final.elements,'unowned mesh retains final transform');physics.dispose();
});

test('small guest clock rollback retains body IDs, pose and constraints until monotonic time catches up',()=>{
  const physics=new CorpsePhysics(),rig=actualRig();physics.rebuild(course());physics.update({time:5});const state=physics.ensureRagdoll(rig.root,{id:1,dead:true}),drop=physics.addDrop(simpleDrop());physics.update({time:5.1});physics.sync();
  const bodies=state.nodes.map(n=>n.body.id),poses=state.nodes.map(n=>n.body.position.clone()),joints=state.constraints.slice(),steps=physics.steps;physics.update({time:5.07});physics.sync();
  assert.equal(physics.lastTime,5.1);assert.equal(physics.steps,steps);assert.deepEqual(state.nodes.map(n=>n.body.id),bodies);assert.deepEqual(state.constraints,joints);state.nodes.forEach((n,i)=>assert(n.body.position.almostEquals(poses[i])));assert(physics.drops.has(drop.id));
  physics.update({time:5.12});assert(physics.steps>steps);physics.rebuild(course());assert.equal(physics.rigs.size,0);assert.equal(physics.drops.size,0);assert.equal(physics.world.constraints.length,0);assert.equal(physics.world.bodies.length,physics.statics.length);assert.equal(physics.lastTime,null);assert(!physics.has(rig.root));physics.dispose();
});

test('opening course gates replaces static colliders while retaining live ragdolls, drops and the elapsed clock',()=>{
  const physics=new CorpsePhysics(),map=course(),rig=actualRig();map.dungeonRevision=0;map.cells[4][1]=1;map.cells[5][3]=1;physics.rebuild(map);physics.update({time:0});
  const state=physics.ensureRagdoll(rig.root,{id:4,dead:true},{held:true}),mesh=simpleDrop();mesh.position.set(7,1.5,6);const drop=physics.addDrop(mesh,{velocity:new THREE.Vector3(3,0,0)}),bodyIds=state.nodes.map(n=>n.body.id),joints=state.constraints.slice();
  physics.update({time:.1});const last=physics.lastTime;assert.equal(physics.statics.length,6);assert(!physics.syncCourseWalls(map));map.cells[4][1]=0;map.cells[5][3]=0;map.dungeonRevision++;
  assert(physics.syncCourseWalls(map));assert.equal(physics.statics.length,5);assert.equal(physics.lastTime,last);assert.deepEqual(state.nodes.map(n=>n.body.id),bodyIds);assert.deepEqual(state.constraints,joints);assert(physics.drops.has(drop.id));
  advance(physics,1,120,.1);assert(drop.body.position.x>8.1,'drop passes through the newly opened gate');assert.equal(physics.isHeld(rig.root),true);physics.dispose();
});

test('full imported skin and normalized runtime frames fall with the skeleton and stay within bounded floor clearance',async t=>{
  const oldSelf=globalThis.self,oldBitmap=globalThis.createImageBitmap,oldProgress=globalThis.ProgressEvent;
  let gltf;
  try{
    globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
    globalThis.ProgressEvent=class{constructor(type,properties){this.type=type;Object.assign(this,properties);}};
    gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  }finally{
    if(oldSelf===undefined)delete globalThis.self;else globalThis.self=oldSelf;
    if(oldBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=oldBitmap;
    if(oldProgress===undefined)delete globalThis.ProgressEvent;else globalThis.ProgressEvent=oldProgress;
  }
  const root=createAfterlifeModel({template:gltf.scene,clips:gltf.animations},0,2);root.position.set(6,0,6);root.rotation.y=-.8;
  const enemy={id:4,kind:0,x:1.5,y:1.5,facing:.6,hp:0,dead:false,attacking:false};animateAfterlifeModel(root,enemy,100,2);root.updateMatrixWorld(true);
  const before=new THREE.Box3().setFromObject(root.userData.afterlife.model,true),skins=[];root.traverse(o=>{if(o.isSkinnedMesh)skins.push({mesh:o,geometry:o.geometry,skeleton:o.skeleton,material:o.material});});
  assert(skins.length>0);assert(before.max.y>1.65&&before.max.y<2,'uses exact runtime normalization and imported vertices');
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});assert(physics.prepare(root)>0,'warmup prepares source envelopes');assert.equal(physics.prepare(root),0,'prepared geometry is cached');
  const clonedGeometry=[];for(const saved of skins){const copy=saved.geometry.clone();copy.userData.corpseSourceGeometry=saved.geometry.uuid;saved.mesh.geometry=copy;clonedGeometry.push({saved,copy,guard:t.mock.method(saved.mesh,'getVertexPosition',()=>{throw new Error('hot corpse bind must not scan visible skin vertices');})});}
  root.rotation.y=.3;root.scale.setScalar(.92);root.updateMatrixWorld(true);
  const state=physics.ensureRagdoll(root,{...enemy,dead:true},{held:true});for(const entry of clonedGeometry){assert.equal(entry.guard.mock.calls.length,0);entry.guard.mock.restore();entry.saved.geometry=entry.copy;}
  const bodyIds=state.nodes.map(n=>n.body.id),contactShapes=state.nodes.map(n=>n.body.shapes[0]),joints=state.constraints.slice(),oldBounds=state.nodes.find(n=>n.key==='leftUpperArm').skinBounds.center.clone();
  root.getObjectByName('LeftArm').rotateX(.3);root.getObjectByName('RightArm').rotateX(-.3);root.updateMatrixWorld(true);physics.update({time:.1});
  const releaseGuards=skins.map(saved=>t.mock.method(saved.mesh,'getVertexPosition',()=>{throw new Error('release refit must use prepared source envelopes');}));
  physics.ensureRagdoll(root,{...enemy,dead:true},{held:false,impulse:new THREE.Vector3(0,.25,3)});for(const guard of releaseGuards){assert.equal(guard.mock.calls.length,0);guard.mock.restore();}
  assert.deepEqual(state.nodes.map(n=>n.body.id),bodyIds);assert.deepEqual(state.constraints,joints);assert(state.nodes.every((n,i)=>n.body.shapes[0]!==contactShapes[i]),'release replaces only contact-time proxy shapes');
  assert(state.nodes.find(n=>n.key==='leftUpperArm').skinBounds.center.distanceTo(oldBounds)>.001,'changed hold pose refits current source envelope offsets');
  advance(physics,5,120,.1);finiteRig(state);
  const after=new THREE.Box3().setFromObject(root.userData.afterlife.model,true);assert(after.max.y<1,'whole visible skin falls with the articulated pose');assert(after.min.y>-.04,'imported skin floor penetration bounded: '+after.min.y);
  t.diagnostic('Measured full imported skin Y after 5s: '+after.min.y.toFixed(4)+'m to '+after.max.y.toFixed(4)+'m; physics collides simplified proxies, not every cloth vertex.');
  const below=new Map(),v=new THREE.Vector3();for(const saved of skins){const mesh=saved.mesh,g=mesh.geometry;for(let i=0;i<g.attributes.position.count;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);if(v.y>=0)continue;let slot=0;for(let j=1;j<4;j++)if(g.attributes.skinWeight.getComponent(i,j)>g.attributes.skinWeight.getComponent(i,slot))slot=j;const name=mesh.skeleton.bones[g.attributes.skinIndex.getComponent(i,slot)].name;below.set(name,Math.min(below.get(name)??0,v.y));}}
  t.diagnostic('Lowest weighted source regions: '+JSON.stringify([...below].sort((a,b)=>a[1]-b[1]).slice(0,8)));
  for(const saved of skins){assert.equal(saved.mesh.geometry,saved.geometry);assert.equal(saved.mesh.skeleton,saved.skeleton);assert.equal(saved.mesh.material,saved.material);}
  physics.dispose();root.userData.afterlife.mixer?.stopAllAction();
});

// Exact source-local transforms captured after the real PC chest release at
// elapsed 1.0s (already a few physics steps past the .95s release boundary).
// This is a deliberate deformed-pose replay, not a rest-pose floor fixture.
const PC_CHEST_RELEASE_POSE=[{"name":"AshWitnessAfterlife","type":"Group","p":[25.56,0,97.2378976446697],"q":[0,0.9659258262890683,0,-0.25881904510252063],"s":[1,1,1]},{"name":"","type":"Group","p":[0,0,0],"q":[0,1,0,6.123233995736766e-17],"s":[1,1,1]},{"name":"","type":"Group","p":[-0.0005036153499453318,-0.000004099489783776311,-0.00024046837366863133],"q":[0,0,0,1],"s":[1.0000016447734936,1.0000016447734936,1.0000016447734936]},{"name":"AshWitnessModel","type":"Group","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1]},{"name":"AshWitness_Rig","type":"Object3D","p":[0,0,0],"q":[0,0,0,1],"s":[0.009999999776482582,0.009999999776482582,0.009999999776482582]},{"name":"char1","type":"Group","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1]},{"name":"Ash_Witness_Articulated_Exterior_And_Oral_Anatomy","type":"SkinnedMesh","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1]},{"name":"Ash_Witness_Articulated_Exterior_And_Oral_Anatomy_1","type":"SkinnedMesh","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1]},{"name":"Ash_Witness_Articulated_Exterior_And_Oral_Anatomy_2","type":"SkinnedMesh","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1]},{"name":"Hips","type":"Bone","p":[-0.9162016427048911,92.85935425912217,1.3145756646663358],"q":[0.9852310415059784,0.07495393236073868,-0.08223896733925454,0.13014782029553834],"s":[1.0000001192092896,1.0000001192092896,1.0000001192092896]},{"name":"LeftUpLeg","type":"Bone","p":[8.759716987609863,12.055598258972168,0.48285743594169617],"q":[-0.33017631751010795,0.003936695435602681,0.06250749059979614,0.941839113332754],"s":[0.9999998211860657,0.9999998211860657,0.9999997615814209]},{"name":"LeftLeg","type":"Bone","p":[0.000012354081263765694,42.19719314575195,-0.0000015168791378528115],"q":[0.6034996159142053,-0.022263110776735165,-0.06279758885079353,0.7945747481039632],"s":[1,1,1.0000001192092896]},{"name":"LeftFoot","type":"Bone","p":[0.00002029370079981163,44.15186309814453,0.0000032630946407152805],"q":[-0.5222451155201321,-0.02165662697591728,0.10777562872441886,0.8456804619219047],"s":[1,1.000000238418579,1.0000001192092896]},{"name":"LeftToeBase","type":"Bone","p":[0.000013347460480872542,13.211698532104494,0.0000012371311868264456],"q":[-0.4109796325686605,-0.04224258697785033,0.011062821549646364,0.9105981108252467],"s":[1.0000001192092896,0.9999998807907106,1]},{"name":"RightUpLeg","type":"Bone","p":[-10.684157371520996,8.7410888671875,3.3398897647857666],"q":[-0.3147899274494431,0.18854447625931112,0.08155915971014766,0.9266641168815436],"s":[0.9999998211860657,1,0.9999998807907106]},{"name":"RightLeg","type":"Bone","p":[-0.000021354315322241746,42.97134017944336,-0.000003427455794735579],"q":[0.6164382001041617,0.019171262316696788,0.06512328640579582,0.7844713925448362],"s":[1.0000001192092896,0.9999998807907106,0.9999998807907106]},{"name":"RightFoot","type":"Bone","p":[-0.00001560931013955269,42.25436782836914,0.000004575684215524234],"q":[-0.5634749525717947,0.014818540702896735,-0.13785818324144833,0.8144148267246968],"s":[0.9999999403953552,0.9999999403953552,1.0000001192092896]},{"name":"RightToeBase","type":"Bone","p":[0.000007791611096763518,13.848423957824707,-0.000002521978103686706],"q":[-0.4309223560301852,0.045598870820246905,-0.010506476393889746,0.9011749441740474],"s":[1,0.9999999403953552,0.9999998211860657]},{"name":"Spine02","type":"Bone","p":[1.924433946609497,-12.881287574768066,-3.822772741317749],"q":[-0.9888165798997063,-0.07355334108061096,0.08226022512792752,0.10032413813848627],"s":[0.9999997615814209,0.9999999403953552,1]},{"name":"Spine01","type":"Bone","p":[0.0000037720649288530694,13.573631286621094,-0.0000019145975329593057],"q":[1.951563910509002e-17,8.364619760876084e-17,-1.3877787808064014e-17,1],"s":[1,1,1]},{"name":"Spine","type":"Bone","p":[1.5695776767188363e-7,13.573606491088867,0.000002202736141043715],"q":[-0.08042336150889523,0.001134764595560942,-0.0020247190091245123,0.99675809289208],"s":[1.0000001192092896,0.9999998807907106,1]},{"name":"LeftShoulder","type":"Bone","p":[3.365437269210816,2.0108835697174072,-0.7734581232070923],"q":[0.5586351668165399,0.42209625247699994,-0.2458367019095055,0.6703177008217718],"s":[0.9999999403953552,0.9999999403953552,1.0000001192092896]},{"name":"LeftArm","type":"Bone","p":[-0.0000012180455541965785,13.556837081909181,0.000033226835512323305],"q":[0.9219624616976461,-0.17683822709764038,0.1817640526324709,0.292703416153622],"s":[0.9999998211860657,0.9999998211860657,1]},{"name":"LeftForeArm","type":"Bone","p":[0.000028683789423666894,25.442085266113285,-0.00014490302419289947],"q":[0.0935098125977969,0.23257468158347322,0.1904917577066032,-0.9491458384674717],"s":[1.0000001192092896,0.9999999403953552,0.9999999403953552]},{"name":"LeftHand","type":"Bone","p":[-0.00000668245002088952,23.994325637817386,0.0001506003609392792],"q":[-0.032378388899935516,-0.1478740191596448,0.10123278089736944,-0.9832786169044879],"s":[1,0.9999999403953552,1]},{"name":"LeftGrip","type":"Bone","p":[-15.302971839904785,9.517844200134277,-4.52967643737793],"q":[0.127322769593034,0.6356001321499736,-0.7592457317576864,0.05785588268992887],"s":[0.9999998807907104,0.9999998211860657,0.9999997019767761]},{"name":"Socket_LeftWrist","type":"Object3D","p":[-16.5613956451416,1.2752113342285156,-4.599944591522217],"q":[-0.6469342708587646,-0.46359309554100037,0.4635959565639496,0.38940510153770447],"s":[0.9999997615814209,0.9999998211860657,0.9999999403953552]},{"name":"RightShoulder","type":"Bone","p":[-3.4181866645812993,2.7943806648254395,-0.7731887102127075],"q":[0.5376280643201041,-0.49636764056724336,0.3423232327500406,0.589398026950114],"s":[1.0000001192092896,1.0000001192092896,1.0000001192092896]},{"name":"RightArm","type":"Bone","p":[0.0000010414613598186406,13.614315032958984,0.000011470012395875528],"q":[0.6703063761964508,-0.08830292786511093,-0.6714004943932756,0.3035017810315058],"s":[0.9999999403953552,0.9999999403953552,0.9999998211860657]},{"name":"RightForeArm","type":"Bone","p":[-0.00005215803685132414,25.75508689880371,-0.00019191757019143552],"q":[0.1597156294735894,0.012106258198058911,0.14672673686976856,0.976122748890654],"s":[1.0000001192092896,1.0000001192092896,1.0000001192092896]},{"name":"RightHand","type":"Bone","p":[0.00002407928514003288,23.298696517944336,0.0001967550051631406],"q":[0.15779608243590484,0.4722485381967964,0.023519293462785754,-0.8669074675960989],"s":[0.9999998807907106,0.9999998807907106,1]},{"name":"RightGrip","type":"Bone","p":[15.024856567382812,9.208032608032227,-5.498140811920166],"q":[0.7675385546307758,-0.06249314070374837,-0.14584856745741837,-0.6210534356163727],"s":[0.9999994039535522,0.9999997615814209,0.9999997019767761]},{"name":"Socket_RightWrist","type":"Object3D","p":[16.355329513549805,1.4638299942016602,-5.191497325897217],"q":[-0.6655870079994202,0.4557959735393524,-0.45579710602760315,0.37615564465522766],"s":[0.9999997615814209,0.9999997615814209,0.9999995231628418]},{"name":"neck","type":"Bone","p":[0.05274888500571251,10.048507690429688,1.5466642379760742],"q":[0.09635465491224414,0.003290495153528859,-0.0029407439860438056,0.995337282102502],"s":[1.0000001192092896,1.0000001192092896,1.000000238418579]},{"name":"Head","type":"Bone","p":[-0.0000012635797475013533,11.332507133483888,-0.000027026037059840746],"q":[0.3005243856735447,-0.0005514720577941694,0.006501966991038861,0.9537518093924413],"s":[1.0000001192092896,0.9999999403953552,1]},{"name":"head_end","type":"Bone","p":[0.16987274587154388,12.58652400970459,-9.464197158813477],"q":[-0.316800183639993,-4.1099614194342306e-7,-0.005684758263161982,0.9484752643949063],"s":[0.9999998211860657,1,0.9999997615814209]},{"name":"headfront","type":"Bone","p":[-0.16987338662147522,7.149379730224609,9.464159965515137],"q":[0.4456288116339002,0.0000011730208049535712,0.008000477516528472,0.8951820790207372],"s":[0.9999998807907106,0.9999998807907106,1.0000001192092896]},{"name":"Jaw","type":"Bone","p":[0.9653035402297974,3.606494426727295,-2.3592278957366943],"q":[-0.284701703777663,-0.005455815682506361,0.005849280749249847,0.9585827871686675],"s":[0.9999999403953552,0.9999998807907104,0.9999997615814209]},{"name":"Tongue","type":"Bone","p":[1.1999996900558472,-4.700011730194092,5.0999956130981445],"q":[-2.3498767737668963e-8,1.1975640135439085e-8,-1.1726064519995388e-8,0.9999999999999996],"s":[1,1,1.000000238418579]},{"name":"Socket_Head","type":"Object3D","p":[-0.02956569194793701,3.2322845458984375,-2.3450698852539062],"q":[-0.3178812861442566,-0.005656002089381218,0.005655884277075529,0.9480968117713928],"s":[0.9999999403953552,0.9999998807907104,0.9999997615814209]},{"name":"Socket_Neck","type":"Object3D","p":[0.1679370403289795,-0.07153228670358658,2.9967124462127686],"q":[-0.018220026046037674,-0.009683877229690552,0.009683742187917233,0.9997403025627136],"s":[0.9999998807907104,0.9999997615814209,0.9999997019767761]},{"name":"Socket_Chest","type":"Object3D","p":[0.39449310302734375,-9.284680366516113,10.354318618774414],"q":[0.058121807873249054,-0.006664949003607035,0.006664816290140152,0.9982650279998779],"s":[1,0.9999997615814209,0.9999997615814209]},{"name":"Socket_Abdomen","type":"Object3D","p":[-0.2589581310749054,-15.840888023376465,13.08716106414795],"q":[-0.02235637977719307,-0.005092218983918428,0.005092065781354904,0.9997241497039795],"s":[1,1,0.9999998807907104]},{"name":"","type":"Mesh","p":[0,0.028,0],"q":[-0.7071067811865475,0,0,0.7071067811865476],"s":[1,1,1]}];

test('fresh unrendered normalized skin prepares valid hand bounds and captured chest pose settles above the floor',async t=>{
  const oldSelf=globalThis.self,oldBitmap=globalThis.createImageBitmap,oldProgress=globalThis.ProgressEvent;
  let gltf;
  try{
    globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
    globalThis.ProgressEvent=class{constructor(type,properties){Object.assign(this,properties);}};
    gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  }finally{
    if(oldSelf===undefined)delete globalThis.self;else globalThis.self=oldSelf;
    if(oldBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=oldBitmap;
    if(oldProgress===undefined)delete globalThis.ProgressEvent;else globalThis.ProgressEvent=oldProgress;
  }
  const root=createAfterlifeModel({template:gltf.scene,clips:gltf.animations},0,2),physics=new CorpsePhysics();
  // Match renderer warmup: prepare is called before the clone's first render,
  // with its normalization and native-facing half-turn already in place.
  const skin=root.getObjectByName('Ash_Witness_Articulated_Exterior_And_Oral_Anatomy'),oldInverse=skin.bindMatrixInverse.clone();
  assert(physics.prepare(root)>0);assert(!skin.bindMatrixInverse.equals(oldInverse),'prepare refreshes the attached skin bind frame without requiring a renderer');
  const objects=[];root.traverse(o=>objects.push(o));assert.equal(objects.length,PC_CHEST_RELEASE_POSE.length);
  objects.forEach((o,i)=>{const saved=PC_CHEST_RELEASE_POSE[i];assert.equal(o.name,saved.name);assert.equal(o.type,saved.type);o.position.fromArray(saved.p);o.quaternion.fromArray(saved.q);o.scale.fromArray(saved.s);});
  const geometries=objects.filter(o=>o.isSkinnedMesh).map(mesh=>({mesh,geometry:mesh.geometry,skeleton:mesh.skeleton}));
  physics.rebuild({w:34,h:27,cells:Array.from({length:34*27},()=>[0,0,0,0])});physics.update({time:0});
  const state=physics.ensureRagdoll(root,{id:2,dead:true},{held:true});assert.equal(state.nodes.filter(n=>n.skinBounds).length,15,'all actual imported source regions have fitted contact shapes');
  const hand=state.nodes.find(n=>n.key==='rightHand'),frame=new THREE.Matrix4().compose(new THREE.Vector3(...hand.body.position.toArray()),new THREE.Quaternion(...hand.body.quaternion.toArray()),new THREE.Vector3(1,1,1));
  const vertex=skin.getVertexPosition(120,new THREE.Vector3()).applyMatrix4(skin.matrixWorld).applyMatrix4(frame.invert()).sub(hand.skinBounds.center);
  assert(Math.abs(vertex.x)<hand.skinBounds.half.x&&Math.abs(vertex.y)<hand.skinBounds.half.y&&Math.abs(vertex.z)<hand.skinBounds.half.z,'previously submerged RightGrip vertex120 lies inside its prepared hand collider');
  const bodyIds=state.nodes.map(n=>n.body.id),joints=state.constraints.slice(),rootAnchor=root.position.clone();
  physics.ensureRagdoll(root,{id:2,dead:true},{held:false,impulse:new THREE.Vector3(Math.cos(7*Math.PI/6)*1.15,.16,Math.sin(7*Math.PI/6)*1.15)});advance(physics,5);root.updateMatrixWorld(true);
  let minY=Infinity;const point=new THREE.Vector3();for(const saved of geometries){assert.equal(saved.mesh.geometry,saved.geometry);assert.equal(saved.mesh.skeleton,saved.skeleton);for(let i=0;i<saved.geometry.attributes.position.count;i++){saved.mesh.getVertexPosition(i,point);point.applyMatrix4(saved.mesh.matrixWorld);minY=Math.min(minY,point.y);}}
  assert(minY>-.04,'captured deformed source skin floor penetration is bounded: '+minY);assert(root.position.equals(rootAnchor),'no source actor root lift');assert.deepEqual(state.nodes.map(n=>n.body.id),bodyIds);assert.deepEqual(state.constraints,joints);finiteRig(state);
  t.diagnostic('Captured PC release-pose replay visible minimum: '+minY.toFixed(4)+'m; exact browser contacts still require parent GPU acceptance.');physics.dispose();root.userData.afterlife.mixer?.stopAllAction();
});
