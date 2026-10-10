import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {createAfterlifeModel,animateAfterlifeModel,disposeAfterlifeModel,AFTERLIFE_ASH_WITNESS_CLIPS} from '../npc-afterlife-model.js';
import {applyCharacterArticulation,restoreCharacterArticulation} from '../character-articulation.js';

const ids=['drowned-dockworker','fever-runner','crooked-crawler'];
const custom=process.env.ZOMBIE_VARIANT_FIXTURE;
const entries=custom?[{id:'fixture',file:custom}]:ids.map(id=>({id,file:new URL(`../assets/models/zombie-variants/${id}.glb`,import.meta.url)}));
const loaded=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const vec=new THREE.Vector3();
function glb(file){const bytes=readFileSync(file),length=bytes.readUInt32LE(12);return{bytes,json:JSON.parse(bytes.subarray(20,20+length)),binary:bytes.subarray(28+length)};}
function accessorBytes(asset,index){
 const entry=asset.json.accessors[index],view=asset.json.bufferViews[entry.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[entry.type],size={5121:1,5123:2,5125:4,5126:4}[entry.componentType];
 assert(!entry.sparse,'geometry remains ordinary vertex data');const stride=view.byteStride||width*size,offset=(view.byteOffset||0)+(entry.byteOffset||0),parts=[];
 for(let vertex=0;vertex<entry.count;vertex++)parts.push(asset.binary.subarray(offset+vertex*stride,offset+vertex*stride+width*size));return Buffer.concat(parts);
}
test.before(async()=>{
 const bitmap=globalThis.createImageBitmap,self=globalThis.self;
 globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 try{
  for(const entry of entries){
   const bytes=readFileSync(entry.file),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
   const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
   loaded.push({...entry,bytes,json,template:gltf.scene,clips:gltf.animations});
  }
 }finally{
  if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;
  if(self===undefined)delete globalThis.self;else globalThis.self=self;
 }
});
const fixture=asset=>createAfterlifeModel(asset,0,7);
function meshes(root){const result=[];root.traverse(o=>{if(o.isSkinnedMesh)result.push(o);});return result;}
function skinBounds(root){
 root.updateMatrixWorld(true);const bound=new THREE.Box3();
 for(const mesh of meshes(root)){mesh.skeleton.update();for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++)bound.expandByPoint(mesh.getVertexPosition(vertex,vec).applyMatrix4(mesh.matrixWorld));}
 return bound;
}
function oneClip(root,key,time){
 const state=root.userData.afterlife;
 restoreCharacterArticulation(state.articulation);
 for(const action of Object.values(state.actions)){action.setEffectiveWeight(0);action.enabled=true;}
 const action=state.actions[key];assert(action,key);action.play();action.paused=true;action.setEffectiveWeight(1);action.time=time;state.mixer.update(0);
 root.updateMatrixWorld(true);
}
const enemy=(locomotion,extra={})=>({id:7,kind:0,locomotion,variant:locomotion==='crawler'?'skitter':locomotion==='runner'?'bloodhound':'stalker',facing:-Math.PI/2,attack:99,attacking:false,strike:0,stagger:0,hits:0,flash:0,...extra});

test('all generated variants have ten canonical actions, independent geometry, PBR maps and runtime anatomical chains',()=>{
 const geometry=new Set();
 for(const asset of loaded){
  assert.equal(asset.clips.length,10,asset.id);
  for(const name of Object.values(AFTERLIFE_ASH_WITNESS_CLIPS))assert(asset.clips.some(c=>c.name===name),`${asset.id} ${name}`);
  const root=fixture(asset),state=root.userData.afterlife;
  for(const side of ['Left','Right'])for(const [parent,child] of [['Arm','ForeArm'],['ForeArm','Hand'],['Hand','Grip'],['UpLeg','Leg'],['Leg','Foot']])assert.equal(state.model.getObjectByName(side+child)?.parent.name,side+parent,`${asset.id} ${side}${child}`);
  assert.equal(state.model.getObjectByName('Jaw')?.parent.name,'Head');
  for(const socket of ['Socket_Head','Socket_Neck','Socket_Chest','Socket_Abdomen','Socket_LeftWrist','Socket_RightWrist'])assert(state.model.getObjectByName(socket),`${asset.id} ${socket}`);
  assert(state.articulation.hasJaw);assert.equal(state.articulation.gripControls,2);
  assert(asset.json.materials.some(m=>m.pbrMetallicRoughness?.baseColorTexture),'textured provider albedo');
  assert(asset.json.images.length>0);assert(asset.json.images.every(i=>i.bufferView!==undefined),'self-contained image data');
  const positions=meshes(root).map(m=>Buffer.from(m.geometry.attributes.position.array.buffer));
  geometry.add(hash(Buffer.concat(positions)));disposeAfterlifeModel(root);
 }
 assert.equal(geometry.size,loaded.length,'new variants are independently generated geometry');
});

test('preparation and final packing preserve each paid model’s mesh shape, normals and UVs',()=>{
 if(custom)return;
 for(const asset of loaded){
  const raw=glb(new URL(`../.art-source/zombie-variants-meshy/${asset.id}/rig.glb`,import.meta.url));
  const packed=glb(asset.file);
  assert.equal(packed.json.meshes.length,raw.json.meshes.length);
  for(let mesh=0;mesh<raw.json.meshes.length;mesh++){
   const original=raw.json.meshes[mesh].primitives,delivered=packed.json.meshes[mesh].primitives;assert.equal(delivered.length,original.length);
   for(let primitive=0;primitive<original.length;primitive++)for(const semantic of ['POSITION','NORMAL','TEXCOORD_0']){
    const a=original[primitive].attributes[semantic],b=delivered[primitive].attributes[semantic];
    if(a===undefined){assert.equal(b,undefined);continue;}
    assert.equal(hash(accessorBytes(raw,a)),hash(accessorBytes(packed,b)),`${asset.id} original ${semantic} data retained`);
   }
  }
 }
});

test('every retargeted action preserves target limb lengths and finite, grounded complete skin bounds',t=>{
 const evidence=[];
 for(const asset of loaded){
  const root=fixture(asset),state=root.userData.afterlife;
  const bindLengths=new Map();
  state.model.traverse(bone=>{if(bone.isBone&&bone.name!=='Hips')bindLengths.set(bone.name,bone.position.length());});
  for(const [key,action] of Object.entries(state.actions)){
   let minimum=Infinity,maximumHeight=0;
   for(let phase=0;phase<=8;phase++){
    oneClip(root,key,action.getClip().duration*phase/8);
    state.model.traverse(bone=>{if(bindLengths.has(bone.name))assert(Math.abs(bone.position.length()-bindLengths.get(bone.name))<.0005,`${asset.id} ${key} ${bone.name} does not stretch`);});
    const bound=skinBounds(root);assert([...bound.min.toArray(),...bound.max.toArray()].every(Number.isFinite));
    minimum=Math.min(minimum,bound.min.y);maximumHeight=Math.max(maximumHeight,bound.max.y-bound.min.y);
    assert(bound.max.y-bound.min.y>.1&&bound.max.y-bound.min.y<2.7,`${asset.id} ${key} keeps coherent skinned proportions`);
   }
   assert(minimum>=-.035,`${asset.id} ${key} lowest full skin ${minimum.toFixed(4)}m`);
   evidence.push({id:asset.id,key,minimumSkinY:minimum,maximumHeight});
  }
  const contact=state.attackAction.getClip();assert.equal(contact.userData.contactSeconds,.375);
  assert(contact.tracks.some(tr=>Array.from(tr.times).some(time=>Math.abs(time-.375)<1e-7)),'exact .375s contact sample survives export');
  disposeAfterlifeModel(root);
 }
 t.diagnostic(JSON.stringify({retargetedFullSkin:evidence}));
});

test('weighted jaw and grips visibly deform their own skin through bounded articulation',t=>{
 const evidence=[];
 for(const asset of loaded){
  const root=fixture(asset),state=root.userData.afterlife;oneClip(root,'idle',0);
  const support=meshes(root),samples=[];
  for(const name of ['Jaw','LeftGrip','RightGrip']){
   const before=[];
   for(const mesh of support){
    const joint=mesh.skeleton.bones.findIndex(b=>b.name===name),indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
    for(let vertex=0;vertex<indices.count;vertex++){
     let amount=0;for(let slot=0;slot<4;slot++)if(indices.getComponent(vertex,slot)===joint)amount+=weights.getComponent(vertex,slot);
     if(amount>.05){mesh.skeleton.update();before.push({mesh,vertex,point:mesh.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).clone()});}
    }
   }
   assert(before.length>=20,`${asset.id} ${name} has meaningful weighted influence`);
   applyCharacterArticulation(state.articulation,{jawOpen:name==='Jaw'?1:0,leftGrip:name==='LeftGrip'?1:0,rightGrip:name==='RightGrip'?1:0});
   root.updateMatrixWorld(true);let maximum=0;
   for(const sample of before){sample.mesh.skeleton.update();maximum=Math.max(maximum,sample.point.distanceTo(sample.mesh.getVertexPosition(sample.vertex,vec).applyMatrix4(sample.mesh.matrixWorld)));}
   assert(maximum>.002,`${asset.id} ${name} moves actual skin`);assert(maximum<.18,`${asset.id} ${name} stays anatomically bounded`);
   samples.push({name,vertices:before.length,maximumSkinMotion:maximum});restoreCharacterArticulation(state.articulation);
  }
  evidence.push({id:asset.id,controls:samples});disposeAfterlifeModel(root);
 }
 t.diagnostic(JSON.stringify({weightedArticulation:evidence}));
});

test('the retargeted Run keeps a real airborne interval and planted support',t=>{
 const evidence=[];
 for(const asset of loaded){
  const root=fixture(asset),state=root.userData.afterlife,support=[];
  for(const mesh of meshes(root)){
   const sides={left:[],right:[]},indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
   for(let vertex=0;vertex<indices.count;vertex++){
    let largest=0,bone=-1;for(let slot=0;slot<4;slot++){const w=weights.getComponent(vertex,slot);if(w>largest){largest=w;bone=indices.getComponent(vertex,slot);}}
    const name=mesh.skeleton.bones[bone]?.name;if(/^Left(Foot|ToeBase)$/.test(name))sides.left.push(vertex);if(/^Right(Foot|ToeBase)$/.test(name))sides.right.push(vertex);
   }
   support.push({mesh,...sides});
  }
  let flight=0,planted=0,peak=0;
  for(let frame=0;frame<60;frame++){
   oneClip(root,'run',state.runAction.getClip().duration*frame/60);let left=Infinity,right=Infinity;
   for(const sample of support){sample.mesh.skeleton.update();for(const vertex of sample.left)left=Math.min(left,sample.mesh.getVertexPosition(vertex,vec).applyMatrix4(sample.mesh.matrixWorld).y);for(const vertex of sample.right)right=Math.min(right,sample.mesh.getVertexPosition(vertex,vec).applyMatrix4(sample.mesh.matrixWorld).y);}
   assert(Number.isFinite(left)&&Number.isFinite(right),'full skin from both foot chains');const clear=Math.min(left,right);peak=Math.max(peak,clear);if(clear>.015)flight++;if(clear<.025)planted++;
  }
  const receipt={id:asset.id,flightFrames:flight,supportFrames:planted,peakClearance:peak};t.diagnostic(JSON.stringify(receipt));
  assert(flight>0,`${asset.id} running includes both feet in the air`);assert(planted>10,`${asset.id} running retains planted support`);evidence.push(receipt);disposeAfterlifeModel(root);
 }
 t.diagnostic(JSON.stringify({runningFlight:evidence}));
});

test('low crawlers rise to the original contact time and settle without skin crossing the floor',t=>{
 const evidence=[];
 for(const asset of loaded){
  const root=fixture(asset),state=root.userData.afterlife,e=enemy('crawler');
  for(let frame=0;frame<=30;frame++){root.position.z=-frame*.012;animateAfterlifeModel(root,e,1000+frame*1000/60,7);}
  root.position.set(0,0,0);const samples=[];
  for(let frame=31;frame<=170;frame++){
   if(frame===40)Object.assign(e,{attacking:true,windupTime:.5,windup:.5});
   if(frame>=40&&frame<70)e.windup=(70-frame)/60;
   if(frame===70)Object.assign(e,{attacking:false,windup:0,strike:.24});
   if(frame>70)e.strike=Math.max(0,.24-(frame-70)/60);
   animateAfterlifeModel(root,e,1000+frame*1000/60,7);
   if(frame===70){assert(Math.abs(state.attackAction.time-.375)<1e-7);assert(state.attackAction.getEffectiveWeight()>.999);}
   if(frame%8===0||frame===70){const bound=skinBounds(root);samples.push({frame,minimumSkinY:bound.min.y,height:bound.max.y-bound.min.y});assert(bound.min.y>=-.035,`${asset.id} crawler transition frame${frame} ${bound.min.y}`);}
  }
  assert(samples.at(-1).height<1.1,`${asset.id} settles into a low silhouette`);evidence.push({id:asset.id,samples});disposeAfterlifeModel(root);
 }
 t.diagnostic(JSON.stringify({crawlerRiseAndRecovery:evidence}));
});
