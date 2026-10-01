import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {createAfterlifeModel,animateAfterlifeModel,disposeAfterlifeModel} from '../npc-afterlife-model.js';
import {enemyArticulationPose,biteArticulationPose,applyCharacterArticulation,restoreCharacterArticulation} from '../character-articulation.js';
import {enemyFxBegin,enemyFxEnd} from '../enemy-fx.js';

// Real v05 skeleton/skin/six clips; only PNG bitmap decoding is stubbed. Keep
// parsing in the test hook so Node's shared Windows runner finishes loading.
const url=new URL('../assets/models/afterlife-ash-witness-rig-v05.glb',import.meta.url),bytes=readFileSync(url);
const digest=value=>createHash('sha256').update(value).digest('hex');
const attributeBytes=a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
let asset,sourceMesh,sourceFields,clipFields,bindFields,sourceHash;
test.before(async()=>{
 const bitmap=globalThis.createImageBitmap,self=globalThis.self;
 globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 let gltf;
 try{gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
 finally{if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;if(self===undefined)delete globalThis.self;else globalThis.self=self;}
 asset={template:gltf.scene,clips:gltf.animations};asset.template.traverse(o=>{if(o.isSkinnedMesh&&!sourceMesh)sourceMesh=o;});
 sourceFields=Object.fromEntries(Object.entries(sourceMesh.geometry.attributes).map(([name,a])=>[name,digest(attributeBytes(a))]));
 clipFields=JSON.stringify(asset.clips.map(c=>({name:c.name,duration:c.duration,userData:c.userData,tracks:c.tracks.map(t=>({name:t.name,times:[...t.times],values:[...t.values]}))})));
 bindFields=sourceMesh.skeleton.boneInverses.map(m=>m.toArray());sourceHash=digest(bytes);
});
const fixture=seed=>createAfterlifeModel(asset,0,seed);
const enemy=extra=>({id:42,kind:0,variant:'stalker',facing:-Math.PI/2,hp:5,maxHp:5,attack:99,attacking:false,strike:0,flash:0,stagger:0,hits:0,...extra});
const totalWeight=state=>Object.values(state.actions).reduce((sum,a)=>sum+a.getEffectiveWeight(),0);
function pose(root){root.updateMatrixWorld(true);return ['LeftHand','RightHand','Head','neck'].map(name=>{const node=root.getObjectByName(name);return{name,position:node.getWorldPosition(new THREE.Vector3()).toArray(),rotation:node.getWorldQuaternion(new THREE.Quaternion()).toArray()};});}
function nearPose(a,b,tolerance=1e-6){for(let i=0;i<a.length;i++)for(const field of ['position','rotation'])for(let j=0;j<a[i][field].length;j++)assert(Math.abs(a[i][field][j]-b[i][field][j])<tolerance,`${a[i].name} ${field} ${j}`);}

test('actual imported actors have deterministic independent idle timing and never alter source rig, skin or clips',()=>{
 const a=fixture(3),b=fixture(3),c=fixture(7),sa=a.userData.afterlife,sb=b.userData.afterlife,sc=c.userData.afterlife;
 assert.equal(sa.idleAction.time,sb.idleAction.time);assert.equal(sa.idleRate,sb.idleRate);
 assert(Math.abs(sa.idleAction.time-sc.idleAction.time)>.1,'different enemies do not breathe on one idle key');
 assert(sa.idleRate>=.96&&sa.idleRate<=1.04);assert.notEqual(sa.idleRate,sc.idleRate);nearPose(pose(a),pose(b));
 for(const root of [a,b,c]){animateAfterlifeModel(root,enemy(),1000,root===c?7:3);disposeAfterlifeModel(root);}
 assert.equal(asset.clips.length,6);assert.equal(JSON.stringify(asset.clips.map(c=>({name:c.name,duration:c.duration,userData:c.userData,tracks:c.tracks.map(t=>({name:t.name,times:[...t.times],values:[...t.values]}))}))),clipFields);
 for(const [name,a] of Object.entries(sourceMesh.geometry.attributes))assert.equal(digest(attributeBytes(a)),sourceFields[name],name);
 assert.deepEqual(sourceMesh.skeleton.boneInverses.map(m=>m.toArray()),bindFields);assert.equal(digest(readFileSync(url)),sourceHash);
});

test('actual swipe anticipation, contact and recovery retain one authored damage pose across 30/60/120 Hz',t=>{
 const contacts=[],samples=[];
 for(const hz of [30,60,120]){
  const root=fixture(3),state=root.userData.afterlife,e=enemy({attacking:true,windupTime:.28,windup:.28}),origin=root.position.clone();
  animateAfterlifeModel(root,e,1000,3);const preparation=pose(root);
  for(let elapsed=1/hz;elapsed<.28;elapsed+=1/hz){e.windup=.28-elapsed;const before=JSON.stringify(e);animateAfterlifeModel(root,e,1000+elapsed*1000,3);assert.equal(JSON.stringify(e),before);assert(Math.abs(totalWeight(state)-1)<1e-6);}
  Object.assign(e,{attacking:false,windup:0,strike:.24});animateAfterlifeModel(root,e,1280,3);
  assert.equal(state.attackAction.time,.375);assert.equal(state.attackPhase,'contact');assert.equal(state.pivot.position.z,0);assert(Math.abs(totalWeight(state)-1)<1e-6);
  const contact=pose(root);contacts.push(contact);
  const travel=Math.hypot(...contact[1].position.map((value,i)=>value-preparation[1].position[i]));assert(travel>.1,'the actual imported hand commits a meaningful reach');
  Object.assign(e,{strike:.001});animateAfterlifeModel(root,e,1519,3);const contactEnd={...state.articulation.pose};
  e.strike=0;animateAfterlifeModel(root,e,1520,3);assert.equal(state.attackPhase,'recovery');assert(Math.abs(state.articulation.pose.jawOpen-contactEnd.jawOpen)<.02,'jaw rejoins recovery without a strike-end snap');
  for(let step=1;step<=hz;step++)animateAfterlifeModel(root,e,1520+step*1000/hz,3);
  assert.equal(state.attackActive,false);assert(root.position.equals(origin));assert(Math.abs(totalWeight(state)-1)<1e-6);
  samples.push({hz,contactSeconds:.375,rightWristMeters:contact[1].position.map(n=>+n.toFixed(4)),rightWristTravelMeters:+travel.toFixed(4),contactJawDegrees:+THREE.MathUtils.radToDeg((state.articulation.controls.find(c=>c.role==='jaw')?.angle||0)*.54).toFixed(2)});
  disposeAfterlifeModel(root);
 }
 nearPose(contacts[0],contacts[1]);nearPose(contacts[1],contacts[2]);t.diagnostic(JSON.stringify({swipeSamples:samples}));
});

test('rapid real hit cues carry the captured recoil forward instead of repeatedly restarting its first key',()=>{
 const root=fixture(3),state=root.userData.afterlife,e=enemy();animateAfterlifeModel(root,e,1000,3);
 e.hits=1;e.flash=.16;e.stagger=.2;animateAfterlifeModel(root,e,1001,3);const began=state.hitStartedAt,initialTime=state.hitAction.time;
 for(let frame=1;frame<=30;frame++){
  if(frame===11||frame===22)e.hits++;
  e.stagger=Math.max(0,.2-frame*.01);animateAfterlifeModel(root,e,1001+frame*10,3);
  assert.equal(state.hitStartedAt,began);assert(Math.abs(totalWeight(state)-1)<1e-6);
 }
 assert(Math.abs(state.hitAction.time-initialTime-.3)<1e-6);assert(state.hitAction.getEffectiveWeight()>.9);
 for(let frame=31;frame<=75;frame++)animateAfterlifeModel(root,e,1001+frame*10,3);
 assert.equal(state.hitActive,false);e.hits++;animateAfterlifeModel(root,e,1761,3);assert(state.hitStartedAt>began,'a later contact gets a new recoil');
 disposeAfterlifeModel(root);
});

test('rendering the same canonical time freezes all clip, gait and mouth channels including time zero',()=>{
 const root=fixture(3),state=root.userData.afterlife,e=enemy();animateAfterlifeModel(root,e,0,3);
 const expected=pose(root),idleTime=state.idleAction.time,gait=state.gaitPhase,oral={...state.articulation.pose};
 for(let i=0;i<150;i++)animateAfterlifeModel(root,e,0,3);
 nearPose(pose(root),expected);assert.equal(state.idleAction.time,idleTime);assert.equal(state.gaitPhase,gait);assert.deepEqual(state.articulation.pose,oral);
 root.position.x=.3;animateAfterlifeModel(root,e,0,3);assert.equal(state.gaitPhase,gait,'a paused presentation correction cannot invent a footstep');
 disposeAfterlifeModel(root);
});

test('restored simulation movement fades full-body recoil into phase-aligned locomotion without moving the actor',()=>{
 const root=fixture(3),state=root.userData.afterlife,e=enemy();animateAfterlifeModel(root,e,1000,3);
 e.hits=1;e.flash=.16;e.stagger=.2;animateAfterlifeModel(root,e,1001,3);
 for(let frame=1;frame<=12;frame++){e.stagger=Math.max(0,.2-frame/60);animateAfterlifeModel(root,e,1001+frame*1000/60,3);}
 assert(state.hitAction.getEffectiveWeight()>.9);const recoilTime=state.hitAction.time;
 for(let frame=13;frame<=26;frame++){
  root.position.x=(frame-12)*2/60;const source=root.position.clone();animateAfterlifeModel(root,e,1001+frame*1000/60,3);
  assert(root.position.equals(source));assert(Math.abs(totalWeight(state)-1)<1e-6);
  const walkPhase=state.shuffleAction.time/state.shuffleAction.getClip().duration,runPhase=state.chaseAction.time/state.chaseAction.getClip().duration;
  assert(Math.abs(walkPhase-runPhase)<1e-6,'shuffle/chase preserve one traveled gait phase');
 }
 assert(state.hitAction.time>recoilTime);assert(state.hitAction.getEffectiveWeight()<.01);assert(state.shuffleAction.getEffectiveWeight()+state.chaseAction.getEffectiveWeight()>.9);
 assert.equal(state.clipBlend.phase,'out');disposeAfterlifeModel(root);
});

test('sixteen actual imported actors retain finite normalized poses in a measured CPU animation sample',t=>{
 const roots=Array.from({length:16},(_,i)=>fixture(i+1)),enemies=roots.map((_,i)=>enemy({id:i+1}));
 const step=frame=>{for(let i=0;i<roots.length;i++){const root=roots[i];root.position.set(i*2,0,-frame*2/60);animateAfterlifeModel(root,enemies[i],1000+frame*1000/60,i+1);root.updateMatrixWorld(true);}};
 for(let frame=0;frame<25;frame++)step(frame);
 const start=performance.now();for(let frame=25;frame<145;frame++)step(frame);const elapsed=performance.now()-start;
 for(const root of roots){const state=root.userData.afterlife;assert(Math.abs(totalWeight(state)-1)<1e-6);for(const entry of pose(root))for(const value of [...entry.position,...entry.rotation])assert(Number.isFinite(value));disposeAfterlifeModel(root);}
 t.diagnostic(JSON.stringify({environment:'Node CPU only; no WebGL/GPU',actors:16,frames:120,meanCpuMilliseconds:+(elapsed/120).toFixed(3)}));
});

test('oral and hand tension are bounded, seed-specific and release through the authored recovery',()=>{
 const preparing=enemyArticulationPose(enemy({attacking:true,windupTime:.28,windup:0}),{seed:3,time:1}),contact=enemyArticulationPose(enemy({strike:.24}),{seed:3,time:1.28});
 assert(preparing.jawOpen>.58&&preparing.jawOpen<=.66);assert(contact.leftGrip>.8&&contact.rightGrip>.8);
 const recoverStart=enemyArticulationPose(enemy(),{seed:3,time:1.52,attackRecovery:0}),recoverEnd=enemyArticulationPose(enemy(),{seed:3,time:1.92,attackRecovery:1}),idle=enemyArticulationPose(enemy(),{seed:3,time:1.92});
 assert(Math.abs(recoverStart.jawOpen-.18)<1e-8);assert.deepEqual(recoverEnd,idle);assert(recoverEnd.leftGrip<recoverStart.leftGrip);
 assert.notDeepEqual(enemyArticulationPose(enemy(),{seed:3,time:1}),enemyArticulationPose(enemy(),{seed:7,time:1}));
 for(const pose of [preparing,contact,recoverStart,recoverEnd])for(const value of Object.values(pose))assert(Number.isFinite(value)&&value>=0&&value<=1);
 const before=biteArticulationPose({phase:'held',elapsed:1.24,damageStage:0}),bite=biteArticulationPose({phase:'held',elapsed:1.25,damageStage:1}),settled=biteArticulationPose({phase:'held',elapsed:1.41,damageStage:1});
 assert(bite.jawOpen<before.jawOpen&&bite.leftGrip>before.leftGrip);assert(Math.abs(bite.jawOpen-.10)<1e-8);assert(settled.jawOpen>bite.jawOpen);
 assert.equal(bite.leftGrip,bite.rightGrip);assert.equal(biteArticulationPose({phase:'held',elapsed:2.15,damageStage:2}).jawOpen,bite.jawOpen,'compression follows the next canonical damage beat');
});

test('actual weighted mouth skin moves in a bounded combat range and restores exactly',t=>{
 const root=fixture(3),state=root.userData.afterlife,jaw=state.articulation.controls.find(c=>c.role==='jaw'),mesh=state.model.getObjectByName(sourceMesh.name),boneIndex=mesh.skeleton.bones.indexOf(jaw.bone),weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
 const vertices=[];for(let vertex=0;vertex<weights.count;vertex++)for(let slot=0;slot<4;slot++)if(indices.getComponent(vertex,slot)===boneIndex&&weights.getComponent(vertex,slot)>.35){vertices.push(vertex);break;}
 assert(vertices.length>10);root.updateMatrixWorld(true);mesh.skeleton.update();
 const points=vertices.map(i=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
 applyCharacterArticulation(state.articulation,{jawOpen:.61});root.updateMatrixWorld(true);mesh.skeleton.update();
 let maximum=0;for(let j=0;j<vertices.length;j++)maximum=Math.max(maximum,mesh.getVertexPosition(vertices[j],new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(points[j]));
 assert(maximum>.003&&maximum<.09,`real lower-mouth travel ${maximum}m stays anatomical`);
 restoreCharacterArticulation(state.articulation);root.updateMatrixWorld(true);mesh.skeleton.update();
 for(let j=0;j<vertices.length;j++)assert(mesh.getVertexPosition(vertices[j],new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(points[j])<1e-7);
 t.diagnostic(JSON.stringify({weightedJawVertices:vertices.length,maxCombatTravelMeters:+maximum.toFixed(5),combatJawDegrees:+THREE.MathUtils.radToDeg(jaw.angle*.61).toFixed(2)}));disposeAfterlifeModel(root);
});

test('actual swipe recovery releases planted feet into walking within a short blend at 30/60/120Hz',()=>{
 for(const hz of [30,60,120]){
  const root=fixture(3),state=root.userData.afterlife,e=enemy({attacking:true,windupTime:.28,windup:.28});
  animateAfterlifeModel(root,e,1000,3);e.windup=.001;animateAfterlifeModel(root,e,1279,3);
  Object.assign(e,{attacking:false,strike:.24});animateAfterlifeModel(root,e,1280,3);
  assert.equal(state.attackAction.time,.375);assert.equal(state.attackAction.getEffectiveWeight(),1);
  e.strike=.001;animateAfterlifeModel(root,e,1519,3);e.strike=0;
  for(let frame=1;frame<=Math.ceil(.24*hz);frame++){
   root.position.z=frame*1.2/hz;animateAfterlifeModel(root,e,1520+frame*1000/hz,3);
   assert(Math.abs(totalWeight(state)-1)<1e-6);
  }
  assert(state.attackAction.getEffectiveWeight()<.01,'no full-body recovery sliding after movement resumes');
  assert(state.shuffleAction.getEffectiveWeight()+state.chaseAction.getEffectiveWeight()>.95);
  disposeAfterlifeModel(root);
 }
});

test('retreat reverses the distance-driven gait and a stationary turn has a shuffle',()=>{
 const root=fixture(3),state=root.userData.afterlife,e=enemy({facing:0});animateAfterlifeModel(root,e,1000,3);
 const phase=state.gaitPhase;root.position.x=.03;animateAfterlifeModel(root,e,1020,3);
 assert.equal(state.gaitDirection,1);assert(Math.abs(((state.gaitPhase-phase+1)%1)-.03/state.gaitTransferMeters)<1e-6);
 const forwardPhase=state.gaitPhase;root.position.x=0;animateAfterlifeModel(root,e,1040,3);
 assert.equal(state.gaitDirection,-1);assert(Math.abs(((forwardPhase-state.gaitPhase+1)%1)-.03/state.gaitTransferMeters)<1e-6);
 const turnPhase=state.gaitPhase;e.facing=1.8;
 for(let frame=1;frame<=12;frame++)animateAfterlifeModel(root,e,1040+frame*1000/60,3);
 assert(Math.abs(state.gaitPhase-turnPhase)>.02);assert(state.shuffleAction.getEffectiveWeight()>.3);assert(root.position.length()<1e-9,'visual turning never changes simulation position');
 const frozen=state.gaitPhase;for(let i=0;i<10;i++)animateAfterlifeModel(root,e,1240,3);assert.equal(state.gaitPhase,frozen);disposeAfterlifeModel(root);
});

test('procedural life stays active in quiet AI states, freezes at a canonical time, and yields to the contact pose',()=>{
 for(const name of ['dormant','wander','investigate','stalk','flank','recover','emerge']){
  const root=fixture(3),e=enemy({state:name,look:.2}),run={time:0};
  const step=now=>{enemyFxBegin(root);animateAfterlifeModel(root,e,now,3);enemyFxEnd(root,e,run,now);};
  step(1000);const first=pose(root);for(let i=1;i<=30;i++)step(1000+i*1000/60);
  const second=pose(root);assert(first.some((p,i)=>p.rotation.some((v,j)=>Math.abs(v-second[i].rotation[j])>.001)),`${name} has visible, bounded life`);
  for(let i=0;i<100;i++)step(1500);nearPose(pose(root),second,1e-5);
  Object.assign(e,{state:'attack',attacking:true,windupTime:.28,windup:.28});step(1501);
  Object.assign(e,{attacking:false,strike:.24});step(1781);
  const contact=pose(root);enemyFxBegin(root);nearPose(pose(root),contact,1e-6);
  assert.equal(root.userData.enemyFx.applied.length,0,'full-weight contact owns the authored body pose');
  assert(root.scale.equals(new THREE.Vector3(1,1,1)));disposeAfterlifeModel(root);
 }
});

test('diagonal footwork uses world vertical despite the actual imported pelvis having an inverted local Y axis',()=>{
 for(const facing of [0,1.7,-2.4]){
  const root=fixture(3),e=enemy({facing}),run={time:0};
  animateAfterlifeModel(root,e,1000,3);enemyFxEnd(root,e,run,1000);enemyFxBegin(root);
  const fx=root.userData.enemyFx,hips=root.getObjectByName('Hips'),before=hips.getWorldQuaternion(new THREE.Quaternion()).normalize();
  assert(new THREE.Vector3(0,1,0).applyQuaternion(before).y<-.9,'fixture retains the original inverted pelvis axis');
  fx.speed=2.2;fx.travelYaw=.35;enemyFxEnd(root,e,run,1000);
  const delta=hips.getWorldQuaternion(new THREE.Quaternion()).normalize().multiply(before.clone().invert()).normalize();
  assert(delta.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.35))<1e-6,'feet swivel toward travel without a roll or opposite turn');
  enemyFxBegin(root);assert(hips.getWorldQuaternion(new THREE.Quaternion()).normalize().angleTo(before)<1e-6,'world-frame twist restores the exact underlying pose');disposeAfterlifeModel(root);
 }
});
