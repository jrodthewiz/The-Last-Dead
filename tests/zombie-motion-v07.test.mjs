import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {AFTERLIFE_ASH_WITNESS_URL,AFTERLIFE_ASH_WITNESS_CLIPS,createAfterlifeModel,animateAfterlifeModel,disposeAfterlifeModel} from '../npc-afterlife-model.js';

let asset;
test.before(async()=>{
 const bitmap=globalThis.createImageBitmap,self=globalThis.self;
 globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 try{
  const bytes=readFileSync(new URL('../'+AFTERLIFE_ASH_WITNESS_URL,import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  asset={template:gltf.scene,clips:gltf.animations};
 }finally{
  if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;
  if(self===undefined)delete globalThis.self;else globalThis.self=self;
 }
});
const enemy=(locomotion='shambler',extra={})=>({id:19,kind:0,variant:locomotion==='crawler'?'skitter':locomotion==='runner'?'bloodhound':'stalker',locomotion,facing:-Math.PI/2,attack:99,attacking:false,strike:0,stagger:0,hits:0,flash:0,...extra});
const fixture=seed=>createAfterlifeModel(asset,0,seed);
const weights=state=>Object.values(state.actions).reduce((sum,a)=>sum+a.getEffectiveWeight(),0);
function pose(root){root.updateMatrixWorld(true);return ['Hips','Head','LeftHand','RightHand','LeftFoot','RightFoot'].map(name=>{const bone=root.getObjectByName(name);return [...bone.getWorldPosition(new THREE.Vector3()).toArray(),...bone.getWorldQuaternion(new THREE.Quaternion()).toArray()];});}
function nearPose(a,b,tolerance=1e-6){for(let i=0;i<a.length;i++)for(let j=0;j<a[i].length;j++)assert(Math.abs(a[i][j]-b[i][j])<tolerance,`bone ${i} component ${j}`);}
function normalized(state){assert(Math.abs(weights(state)-1)<1e-6);for(const a of Object.values(state.actions))assert(Number.isFinite(a.getEffectiveWeight())&&a.getEffectiveWeight()>=0&&a.getEffectiveWeight()<=1);}

test('the real v07 library preserves six original clips and adds four complete seamless rig loops',()=>{
 assert.match(AFTERLIFE_ASH_WITNESS_URL,/motion-v07\.glb$/);
 assert.equal(asset.clips.length,10);
 for(const name of Object.values(AFTERLIFE_ASH_WITNESS_CLIPS))assert(asset.clips.some(c=>c.name===name),name);
 for(const [name,duration,stride] of [['run',.9,1.8],['crawl',1.4,.72],['crawlIdle',2.4,.72],['contort',1.8,.72]]){
  const clip=asset.clips.find(c=>c.name===AFTERLIFE_ASH_WITNESS_CLIPS[name]);
  assert(Math.abs(clip.duration-duration)<1e-5);assert.equal(clip.userData.strideMeters,stride);
  assert(clip.tracks.length>=60,'hips, limbs, spine and hands all have authored channels');
  for(const track of clip.tracks){
   const width=track.getValueSize();
   for(let i=0;i<width;i++)assert(Math.abs(track.values[i]-track.values[track.values.length-width+i])<1e-4,`${clip.name} ${track.name} closes`);
  }
 }
});

test('actual runners and crawlers use traveled gait phase at varied speeds and 30/60/120 Hz',t=>{
 const samples=[];
 for(const locomotion of ['runner','crawler'])for(const speed of locomotion==='runner'?[.4,1.2,3.6]:[.25,.72,1.4]){
  const phases=[];
  for(const hz of [30,60,120]){
   const root=fixture(4),state=root.userData.afterlife,e=enemy(locomotion);
   animateAfterlifeModel(root,e,1000,4);
   for(let frame=1;frame<=hz*2;frame++){root.position.z=-speed*frame/hz;animateAfterlifeModel(root,e,1000+frame*1000/hz,4);}
   const began=state.gaitPhase;let expected=0;
   for(let frame=1;frame<=hz;frame++){
    root.position.z=-speed*(2+frame/hz);animateAfterlifeModel(root,e,3000+frame*1000/hz,4);
    expected+=speed/hz/state.gaitTransferMeters;normalized(state);
    for(const action of state.gaitActions)assert(Math.abs(action.time/action.getClip().duration-state.gaitPhase)<1e-6);
   }
   const phase=(state.gaitPhase-began+1)%1;
   const error=Math.atan2(Math.sin((phase-expected%1)*Math.PI*2),Math.cos((phase-expected%1)*Math.PI*2))/(Math.PI*2);
   assert(Math.abs(error)<1e-6,`${locomotion} ${speed}m/s ${hz}Hz follows its measured stride`);phases.push(phase);
   if(locomotion==='runner'&&speed>2)assert(state.runAction.getEffectiveWeight()>.99);
   if(locomotion==='crawler'&&speed>=.72)assert(state.crawlAction.getEffectiveWeight()>.94);
   const frozen=state.gaitPhase;
   for(let frame=1;frame<=hz;frame++)animateAfterlifeModel(root,e,4000+frame*1000/hz,4);
   assert.equal(state.gaitPhase,frozen,'a blocked actor settles without moonwalking');
   assert(state.motion<.001);normalized(state);disposeAfterlifeModel(root);
  }
  for(const p of phases)assert(Math.abs(Math.atan2(Math.sin((p-phases[0])*Math.PI*2),Math.cos((p-phases[0])*Math.PI*2)))<1e-5,'frame rate does not change distance cadence');
  samples.push({locomotion,speed,cyclePhase:phases[0]});
 }
 t.diagnostic(JSON.stringify({distanceCadence:samples}));
});

test('all weighted skin vertices stay above the floor throughout the new authored motion loops',t=>{
 const root=fixture(2),state=root.userData.afterlife,meshes=[],point=new THREE.Vector3(),samples=[];
 state.model.traverse(mesh=>{if(mesh.isSkinnedMesh)meshes.push(mesh);});assert(meshes.length>0);
 for(const action of Object.values(state.actions))action.setEffectiveWeight(0);
 for(const key of ['run','crawl','crawlIdle','contort']){
  const action=state.actions[key];action.paused=true;action.setEffectiveWeight(1);let minimum=Infinity,minimumFrame=0,minimumVertex=0,minimumMesh=null;
  for(let frame=0;frame<=24;frame++){
   action.time=action.getClip().duration*frame/24;state.mixer.update(0);root.updateMatrixWorld(true);
   for(const mesh of meshes){
    mesh.skeleton.update();
    for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){
     mesh.getVertexPosition(vertex,point).applyMatrix4(mesh.matrixWorld);
     if(point.y<minimum){minimum=point.y;minimumFrame=frame;minimumVertex=vertex;minimumMesh=mesh;}
    }
   }
  }
  const influences=[];
  for(let slot=0;slot<4;slot++){const weight=minimumMesh.geometry.attributes.skinWeight.getComponent(minimumVertex,slot);if(weight>.001)influences.push({bone:minimumMesh.skeleton.bones[minimumMesh.geometry.attributes.skinIndex.getComponent(minimumVertex,slot)].name,weight});}
  samples.push({clip:action.getClip().name,minimumSkinY:minimum,phase:minimumFrame/24,vertex:minimumVertex,influences});
  action.setEffectiveWeight(0);
 }
 t.diagnostic(JSON.stringify({weightedSkinFloor:samples}));disposeAfterlifeModel(root);
 for(const sample of samples)assert(sample.minimumSkinY>=-.035,`${sample.clip} lowest weighted skin ${sample.minimumSkinY.toFixed(4)}m stays above the floor tolerance`);
});

test('the imported Run has brief flight with both complete skinned feet above the floor',t=>{
 const root=fixture(2),state=root.userData.afterlife,supports=[],point=new THREE.Vector3();
 state.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const left=[],right=[],indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){
   let boneIndex=-1,largest=0;
   for(let slot=0;slot<4;slot++){const weight=weights.getComponent(vertex,slot);if(weight>largest){largest=weight;boneIndex=indices.getComponent(vertex,slot);}}
   const name=mesh.skeleton.bones[boneIndex].name;
   if(name==='LeftFoot'||name==='LeftToeBase')left.push(vertex);
   if(name==='RightFoot'||name==='RightToeBase')right.push(vertex);
  }
  if(left.length||right.length)supports.push({mesh,left,right});
 });
 assert(supports.some(s=>s.left.length>100&&s.right.length>100),'flight uses full foot and toe skin, including the sole');
 for(const action of Object.values(state.actions))action.setEffectiveWeight(0);
 const run=state.runAction;run.setEffectiveWeight(1);run.paused=true;
 let peak=0,flightFrames=0,supportFrames=0;const flightSamples=[];
 for(let frame=0;frame<120;frame++){
  run.time=run.getClip().duration*frame/120;state.mixer.update(0);root.updateMatrixWorld(true);
  let leftMinimum=Infinity,rightMinimum=Infinity;
  for(const support of supports){
   support.mesh.skeleton.update();
   for(const vertex of support.left){support.mesh.getVertexPosition(vertex,point).applyMatrix4(support.mesh.matrixWorld);leftMinimum=Math.min(leftMinimum,point.y);}
   for(const vertex of support.right){support.mesh.getVertexPosition(vertex,point).applyMatrix4(support.mesh.matrixWorld);rightMinimum=Math.min(rightMinimum,point.y);}
  }
  const clearance=Math.min(leftMinimum,rightMinimum);peak=Math.max(peak,clearance);
  if(clearance>.015){flightFrames++;flightSamples.push({phase:frame/120,leftMinimum,rightMinimum});}
  if(clearance<.006)supportFrames++;
 }
 assert(peak>.015&&flightFrames>=2,'both sole meshes lift clear during a real flight phase');
 assert(flightFrames<120*.25&&supportFrames>120*.5,'a brief run flight alternates with readable support');
 t.diagnostic(JSON.stringify({runFlight:{peakBothFeetClearanceMeters:peak,approximateFlightSeconds:flightFrames/120*run.getClip().duration,samples:flightSamples}}));
 disposeAfterlifeModel(root);
});

test('the actual crawler supports a low body through locomotion and stationary contortion',()=>{
 const root=fixture(7),state=root.userData.afterlife,e=enemy('crawler',{contortion:0});
 animateAfterlifeModel(root,e,1000,7);
 assert(pose(root)[1][1]<.9,'natural crawler has a low authored head, independent of injury tilt');
 for(let frame=1;frame<=100;frame++){
  root.position.z=-frame*.9/60;animateAfterlifeModel(root,e,1000+frame*1000/60,7);
  const p=pose(root);assert(p[1][1]<1.05);for(const anchor of p.slice(2))assert(anchor[1]>.045,'hand/foot anchors remain above the floor');
  assert.equal(state.pivot.rotation.x,0);normalized(state);
 }
 e.contortion=1;
 for(let frame=1;frame<=100;frame++)animateAfterlifeModel(root,e,2700+frame*1000/60,7);
 assert(state.contortAction.getEffectiveWeight()>.99);assert(state.crawlIdleAction.getEffectiveWeight()<.01);
 for(const bone of pose(root))for(const component of bone)assert(Number.isFinite(component));
 assert(pose(root)[1][1]<1.05);normalized(state);disposeAfterlifeModel(root);
});

test('runner, crawl and contortion channels freeze at the same canonical time including zero',()=>{
 for(const locomotion of ['runner','crawler']){
  const root=fixture(5),state=root.userData.afterlife,e=enemy(locomotion,{contortion:1});
  animateAfterlifeModel(root,e,0,5);
  for(let frame=1;frame<=60;frame++){root.position.z=-frame*(locomotion==='runner'?3:.8)/60;animateAfterlifeModel(root,e,frame*1000/60,5);}
  for(let frame=1;frame<=60;frame++)animateAfterlifeModel(root,e,1000+frame*1000/60,5);
  const expected=pose(root),actionTimes=Object.values(state.actions).map(a=>a.time),oral={...state.articulation.pose},phase=state.gaitPhase,contort=state.contortBlend;
  for(let i=0;i<120;i++)animateAfterlifeModel(root,e,2000,5);
  nearPose(pose(root),expected);assert.deepEqual(Object.values(state.actions).map(a=>a.time),actionTimes);assert.deepEqual(state.articulation.pose,oral);assert.equal(state.contortBlend,contort);assert.equal(state.gaitPhase,phase);
  disposeAfterlifeModel(root);
 }
});

test('crawlers rise through windup to the exact original .375 contact pose and return low in recovery',()=>{
 const contacts=[];
 for(const locomotion of ['shambler','runner','crawler']){
  const root=fixture(3),state=root.userData.afterlife,e=enemy(locomotion);
  animateAfterlifeModel(root,e,1000,3);const initial=pose(root);
  Object.assign(e,{attacking:true,windupTime:.28,windup:.28});animateAfterlifeModel(root,e,1001,3);
  if(locomotion==='crawler'){assert(state.attackAction.getEffectiveWeight()<.001);nearPose(pose(root),initial,.001);}
  for(let frame=1;frame<=16;frame++){e.windup=Math.max(0,.28-frame/60);animateAfterlifeModel(root,e,1001+frame*1000/60,3);normalized(state);}
  Object.assign(e,{attacking:false,windup:0,strike:.24});animateAfterlifeModel(root,e,1281,3);
  assert.equal(state.attackAction.time,.375);assert.equal(state.attackAction.getEffectiveWeight(),1);contacts.push(pose(root));normalized(state);
  e.strike=.001;animateAfterlifeModel(root,e,1520,3);e.strike=0;
  for(let frame=1;frame<=60;frame++){animateAfterlifeModel(root,e,1520+frame*1000/60,3);normalized(state);}
  assert.equal(state.attackActive,false);
  if(locomotion==='crawler')assert(pose(root)[1][1]<.9,'recovery returns to floor posture while stationary');
  disposeAfterlifeModel(root);
 }
 nearPose(contacts[0],contacts[1]);nearPose(contacts[1],contacts[2]);
});

test('natural crawler death starts low, freezes its bridge, and reuses safely after revival or grapple',()=>{
 const root=fixture(6),state=root.userData.afterlife,e=enemy('crawler');
 animateAfterlifeModel(root,e,1000,6);const low=pose(root);
 e.dead=true;animateAfterlifeModel(root,e,1001,6);nearPose(pose(root),low,.0002);assert.equal(state.collapseAction.getEffectiveWeight(),1);
 animateAfterlifeModel(root,e,1201,6);const paused=pose(root);
 for(let i=0;i<50;i++)animateAfterlifeModel(root,e,1201,6);nearPose(pose(root),paused);normalized(state);
 for(let frame=1;frame<=150;frame++)animateAfterlifeModel(root,e,1201+frame*1000/60,6);
 assert.equal(state.crawlAction.getEffectiveWeight(),0);assert.equal(state.contortAction.getEffectiveWeight(),0);
 e.dead=false;animateAfterlifeModel(root,e,3800,6);assert.equal(state.collapseAction.getEffectiveWeight(),0);assert(pose(root)[1][1]<.9);normalized(state);
 Object.assign(e,{bitePhase:'windup',biteProgress:0,aimAngle:-Math.PI/2});animateAfterlifeModel(root,e,3801,6);
 for(let frame=1;frame<=30;frame++){e.biteProgress=frame/30;animateAfterlifeModel(root,e,3801+frame*1000/60,6);normalized(state);}
 Object.assign(e,{bitePhase:'held',biteProgress:.2});animateAfterlifeModel(root,e,4320,6);assert.equal(state.grappleRise,1);assert(state.idleAction.getEffectiveWeight()>.99);assert.equal(state.crawlIdleAction.getEffectiveWeight(),0);
 e.bitePhase=null;for(let frame=1;frame<=60;frame++)animateAfterlifeModel(root,e,4320+frame*1000/60,6);
 assert(pose(root)[1][1]<.9);normalized(state);disposeAfterlifeModel(root);
});

test('weighted crawler skin remains grounded through runtime articulation and the rise into combat',t=>{
 const root=fixture(3),state=root.userData.afterlife,e=enemy('crawler'),meshes=[],point=new THREE.Vector3(),samples=[];
 state.model.traverse(mesh=>{if(mesh.isSkinnedMesh)meshes.push(mesh);});
 const sample=label=>{
  root.updateMatrixWorld(true);let minimum=Infinity;
  for(const mesh of meshes){mesh.skeleton.update();for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){mesh.getVertexPosition(vertex,point).applyMatrix4(mesh.matrixWorld);minimum=Math.min(minimum,point.y);}}
  samples.push({label,minimumSkinY:minimum,attackWeight:state.attackAction.getEffectiveWeight()});
 };
 animateAfterlifeModel(root,e,1000,3);sample('idle');
 for(let frame=1;frame<=60;frame++){root.position.z=-frame*.9/60;animateAfterlifeModel(root,e,1000+frame*1000/60,3);if(frame%15===0)sample('crawl-'+frame);}
 Object.assign(e,{attacking:true,windupTime:.28,windup:.28});animateAfterlifeModel(root,e,2001,3);sample('windup-start');
 for(let frame=1;frame<=16;frame++){e.windup=Math.max(0,.28-frame/60);animateAfterlifeModel(root,e,2001+frame*1000/60,3);if(frame%4===0)sample('windup-'+frame);}
 Object.assign(e,{attacking:false,strike:.24,windup:0});animateAfterlifeModel(root,e,2281,3);sample('contact');
 e.strike=.001;animateAfterlifeModel(root,e,2520,3);e.strike=0;
 for(let frame=1;frame<=60;frame++){animateAfterlifeModel(root,e,2520+frame*1000/60,3);if(frame%15===0)sample('recovery-'+frame);}
 t.diagnostic(JSON.stringify({runtimeWeightedSkinFloor:samples}));disposeAfterlifeModel(root);
 for(const sample of samples)assert(sample.minimumSkinY>=-.035,`${sample.label} weighted crawler skin ${sample.minimumSkinY.toFixed(4)}m stays grounded`);
});

test('injured crawl and legacy six-clip fixtures preserve their own locomotion ownership',()=>{
 const root=fixture(8),state=root.userData.afterlife,e=enemy('crawl',{wounds:{leftLeg:{removed:true}}});
 animateAfterlifeModel(root,e,1000,8);for(let frame=1;frame<=60;frame++)animateAfterlifeModel(root,e,1000+frame*1000/60,8);
 assert.equal(state.motionClass,'shambler');assert.equal(state.crawlAction.getEffectiveWeight(),0);assert(state.pivot.rotation.x<-1.2);normalized(state);disposeAfterlifeModel(root);
 const legacy={template:asset.template,clips:asset.clips.slice(0,6)};
 for(const locomotion of ['runner','crawler']){
  const fallback=createAfterlifeModel(legacy,0,2),s=fallback.userData.afterlife,frame=enemy(locomotion);
  animateAfterlifeModel(fallback,frame,1000,2);fallback.position.z=-.05;animateAfterlifeModel(fallback,frame,1050,2);
  assert.equal(s.motionClass,'shambler');normalized(s);disposeAfterlifeModel(fallback);
 }
});
