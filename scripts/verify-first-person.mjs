import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {createFirstPersonBody} from '../island/first-person-body.js';
import {createPresentation} from '../island/presentation.js';

// Keep the real mesh, skin and animation binary. Omit JPEG decoding for this
// Node-only rig check; image appearance still requires an in-browser review.
const bytes=fs.readFileSync(new URL('../assets/survivor/tld-survivor-v02.glb',import.meta.url));
const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength));
for(const m of json.materials||[]){if(m.pbrMetallicRoughness)delete m.pbrMetallicRoughness.baseColorTexture;delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;}
delete json.images;delete json.textures;
let meta=Buffer.from(JSON.stringify(json));meta=Buffer.concat([meta,Buffer.alloc((4-meta.length%4)%4,32)]);
const bin=bytes.subarray(20+jsonLength),header=Buffer.alloc(20);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+meta.length+bin.length,8);header.writeUInt32LE(meta.length,12);header.writeUInt32LE(0x4e4f534a,16);
const glb=Buffer.concat([header,meta,bin]);
const asset=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
const source=asset.scene.getObjectByName('TLD_Local_Torso_Legs'),original=Array.from(source.geometry.attributes.position.array);
const scene=new T.Scene(),local=createFirstPersonBody(scene,asset),rig=local.actor.userData;
assert.deepEqual(Array.from(source.geometry.attributes.position.array),original,'Local tailoring must not change the shared survivor asset');
assert.notEqual(rig.body.geometry,source.geometry);
assert.equal(rig.head.visible,false);assert.equal(rig.arms.visible,false);
const state={x:0,y:0,z:0,yaw:0},stride={phase:0};
const p=new T.Vector3(),camera=new T.PerspectiveCamera(74,16/9,.06,4800);
function sample(){local.actor.updateMatrixWorld(true);rig.body.skeleton.update();return Array.from({length:rig.body.geometry.attributes.position.count},(_,i)=>rig.body.getVertexPosition(i,new T.Vector3()).applyMatrix4(rig.body.matrixWorld));}
function floor(){return Math.min(...rig.soleSamples.map(i=>rig.body.getVertexPosition(i,p).applyMatrix4(rig.body.matrixWorld).y));}
local.update(state,{onGround:true,speed:0},stride,1/60,{visible:true});
const idle=sample();assert.ok(Math.abs(floor())<1e-5);
// At maximum down-look both the trousers and boots enter the camera frustum,
// including portrait framing. At level view no jacket triangle covers aim.
let checkedViews=0;
for(const aspect of [16/9,9/16])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 state.yaw=yaw;local.update(state,{onGround:true,speed:0},stride,0,{visible:true});
 camera.aspect=aspect;camera.updateProjectionMatrix();camera.position.set(state.x,state.y+1.7,state.z);camera.rotation.set(-1.35,-yaw,0,'YXZ');camera.updateMatrixWorld(true);
 let boots=0,trousers=0;
 for(const v of sample()){const projected=v.clone().project(camera);if(Math.abs(projected.x)<.95&&Math.abs(projected.y)<.95&&Math.abs(projected.z)<1){if(v.y<.25)boots++;if(v.y>.4&&v.y<1.05)trousers++;}}
 assert.ok(boots>10,`Boots missing at aspect ${aspect}, yaw ${yaw}`);assert.ok(trousers>10);
 camera.rotation.x=0;camera.updateMatrixWorld(true);
 const nearAim=sample().filter(v=>{const n=v.clone().project(camera);return Math.abs(n.x)<.12&&Math.abs(n.y)<.12&&Math.abs(n.z)<1;});
 assert.equal(nearAim.length,0,'Local torso must not obstruct level aim');checkedViews++;
}
state.yaw=0;let maxFloorError=0,walking=null,running=null;
for(let i=0;i<120;i++){
 stride.phase=i*.11;state.x=i*.04;state.y=i<60?0:.4;
 local.update(state,{onGround:true,speed:i<60?5.2:9.3,sprinting:i>=60},stride,1/60,{visible:true});
 maxFloorError=Math.max(maxFloorError,Math.abs(floor()-state.y));
 if(i===30)walking=sample();if(i===90)running=sample();
}
assert.ok(maxFloorError<1e-5,'Animated soles must stay on player support height');
assert.ok(walking.some((v,i)=>v.clone().sub(new T.Vector3(1.2,0,0)).distanceTo(idle[i])>.04),'Walking must animate the body');
assert.ok(rig.actions.Run_Forward.getEffectiveWeight()>.95);
state.y=2;local.update(state,{onGround:false,speed:8},stride,1/60,{visible:true});assert.ok(Math.abs(floor()-2)<1e-5,'Airborne body must follow player height');
local.update(state,{},stride,0,{visible:false});assert.equal(local.actor.visible,false);
// Verify render configuration for desktop/mobile dimensions and low-MSAA GPUs.
for(const maxSamples of [0,4]){
 const renderer={capabilities:{maxSamples},info:{},getDrawingBufferSize:v=>v.set(853,480)};
 const presentation=createPresentation(renderer);presentation.resize('balanced');
 assert.equal(presentation.target.height,480);assert.equal(presentation.target.samples,Math.min(2,maxSamples));
 assert.equal(presentation.target.texture.magFilter,T.LinearFilter);assert.equal(presentation.uniforms.strength.value,.10);
 presentation.resize('retro');assert.equal(presentation.uniforms.strength.value,.16);
 presentation.resize('native');assert.equal(presentation.uniforms.strength.value,.06);
 presentation.target.dispose();
}
const shell=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.ok(shell.includes('value="balanced" selected>Retro film · HD'));
console.log(JSON.stringify({passed:true,cameraViews:checkedViews,animatedFrames:120,maxFloorError,sharedSourceIntact:true,renderProfiles:3}));
