import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createAfterlifeModel,animateAfterlifeModel,disposeAfterlifeModel} from '../npc-afterlife-model.js';

function readGLB(file){const bytes=readFileSync(new URL('../assets/models/'+file,import.meta.url)),length=bytes.readUInt32LE(12);return{json:JSON.parse(bytes.subarray(20,20+length)),binary:bytes.subarray(28+length),bytes};}
const old=readGLB('afterlife-ash-witness-chase-v03.glb'),current=readGLB('afterlife-ash-witness-motion-v04.glb');
function accessor(asset,index){const a=asset.json.accessors[index],v=asset.json.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],stride=v.byteStride||width*size,start=(v.byteOffset||0)+(a.byteOffset||0),out=[];assert(!a.sparse,'test compares concrete preserved accessors');for(let i=0;i<a.count;i++)out.push(asset.binary.subarray(start+i*stride,start+i*stride+width*size));return Buffer.concat(out);}
function imageBytes(asset,image){const v=asset.json.bufferViews[image.bufferView];return asset.binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);}

test('v04 changes motion while preserving the exact character and textures',()=>{
 assert(current.bytes.length<5*1024*1024);
 assert.equal(current.json.meshes.length,1);assert.equal(current.json.skins.length,1);
 const a=old.json.meshes[0].primitives[0],b=current.json.meshes[0].primitives[0];
 for(const attribute of Object.keys(a.attributes))assert.deepEqual(accessor(current,b.attributes[attribute]),accessor(old,a.attributes[attribute]),attribute+' is unchanged');
 assert.deepEqual(accessor(current,b.indices),accessor(old,a.indices));
 assert.deepEqual(accessor(current,current.json.skins[0].inverseBindMatrices),accessor(old,old.json.skins[0].inverseBindMatrices),'original bind matrices retained');
 assert.deepEqual(current.json.materials,old.json.materials);
 assert.deepEqual(current.json.images.map(i=>imageBytes(current,i)),old.json.images.map(i=>imageBytes(old,i)));
 assert.deepEqual(current.json.skins[0].joints.map(i=>current.json.nodes[i].name),old.json.skins[0].joints.map(i=>old.json.nodes[i].name));
});

test('v04 clip contract carries measured gait, authoritative contact and authored death',()=>{
 const animations=current.json.animations,names=animations.map(a=>a.name);
 for(const suffix of ['Idle','Shuffle','Chase','AttackLunge','HitRecoil','Collapse'])assert(names.includes('AshWitness_'+suffix));
 const walk=animations.find(a=>a.name==='AshWitness_Shuffle'),run=animations.find(a=>a.name==='AshWitness_Chase'),attack=animations.find(a=>a.name==='AshWitness_AttackLunge'),death=animations.find(a=>a.name==='AshWitness_Collapse');
 assert(walk.extras.strideMeters>1&&walk.extras.strideMeters<1.8);
 assert(run.extras.strideMeters>1.8&&run.extras.strideMeters<2.5);
 assert.equal(attack.extras.contactSeconds,.375);assert.equal(death.extras.authoredFall,true);
 for(const animation of [walk,run])for(const sampler of animation.samplers){const values=accessor(current,sampler.output),a=current.json.accessors[sampler.output],width={VEC3:3,VEC4:4}[a.type],array=new Float32Array(values.buffer,values.byteOffset,values.byteLength/4);for(let i=0;i<width;i++)assert(Math.abs(array[i]-array[array.length-width+i])<1e-4,animation.name+' closes without a seam');}
});

test('captured clips use native root motion and never receive a second procedural fall',()=>{
 const template=new THREE.Group();template.add(new THREE.Mesh(new THREE.BoxGeometry(.4,1.86,.3),new THREE.MeshStandardMaterial()));
 for(const name of ['Hips','Head','LeftFoot','RightFoot']){const bone=new THREE.Bone();bone.name=name;template.add(bone);}
 const clips=current.json.animations.map(a=>{const duration=Math.max(...a.samplers.map(s=>current.json.accessors[s.input].max[0])),clip=new THREE.AnimationClip(a.name,duration,[new THREE.NumberKeyframeTrack('.rotation[y]',[0,duration],[0,.01])]);clip.userData=a.extras||{};return clip;});
 const root=createAfterlifeModel({template,clips},0,1),state=root.userData.afterlife;
 animateAfterlifeModel(root,{kind:0,variant:'stalker',attacking:true,windup:.28},10);
 animateAfterlifeModel(root,{kind:0,variant:'stalker',strike:.24},300);
 assert.equal(state.attackAction.time,.375);assert.equal(state.pivot.position.z,0,'authored hand reach needs no fake whole-character lunge');
 animateAfterlifeModel(root,{dead:true},350);animateAfterlifeModel(root,{dead:true},2000);
 assert.equal(state.pivot.rotation.x,0);assert.equal(state.pivot.rotation.z,0);assert(state.authoredFall);
 disposeAfterlifeModel(root);
});

test('canonical actor facing stays upright after a restored quaternion crosses ninety degrees',()=>{
 const template=new THREE.Group();template.add(new THREE.Mesh(new THREE.BoxGeometry(.4,1.86,.3),new THREE.MeshStandardMaterial()));
 const root=createAfterlifeModel({template,clips:[]}),yaw=2.7;
 for(let frame=0;frame<8;frame++){
  root.rotation.set(0,yaw,0);const saved=root.quaternion.clone();root.quaternion.copy(saved);
  assert(Math.abs(root.rotation.x)>3,'fixture exercises the alternate Euler representation');
  animateAfterlifeModel(root,{kind:0,variant:'stalker',facing:-yaw-Math.PI/2},100+frame*16);
  assert.equal(root.rotation.x,0);assert.equal(root.rotation.z,0);
  const direction=new THREE.Vector3(0,0,-1).applyQuaternion(root.quaternion);
  assert(direction.distanceTo(new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)))<1e-10);
 }
 disposeAfterlifeModel(root);
});
