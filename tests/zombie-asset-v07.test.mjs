import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RUNTIME_FILES} from '../build.mjs';
import * as THREE from '../vendor/three.module.js';

function glb(name){
 const bytes=readFileSync(new URL('../assets/models/'+name,import.meta.url));
 const length=bytes.readUInt32LE(12);
 return {json:JSON.parse(bytes.subarray(20,20+length)),binary:bytes.subarray(28+length)};
}
function floats(asset,index){
 const a=asset.json.accessors[index],view=asset.json.bufferViews[a.bufferView];
 assert.equal(a.componentType,5126);
 const width={SCALAR:1,VEC3:3,VEC4:4}[a.type],offset=(view.byteOffset||0)+(a.byteOffset||0);
 return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,k)=>asset.binary.readFloatLE(offset+i*(view.byteStride||width*4)+k*4)));
}
const original=glb('afterlife-ash-witness-motion-v06.glb'),current=glb('afterlife-ash-witness-motion-v07.glb');
const parents=new Map();current.json.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
function restMatrix(i){
 const n=current.json.nodes[i],local=n.matrix?new THREE.Matrix4().fromArray(n.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));
 return parents.has(i)?restMatrix(parents.get(i)).multiply(local):local;
}

test('new zombie loops preserve the original six clips and all skin/texture/bind bytes',()=>{
 for(const name of ['nodes','skins','meshes','materials','images','textures'])assert.deepEqual(current.json[name],original.json[name],name);
 assert.deepEqual(current.json.animations.slice(0,6),original.json.animations);
 assert.deepEqual(current.binary.subarray(0,original.binary.length),original.binary);
 assert.equal(current.json.animations.length,10);
 assert(RUNTIME_FILES.includes('zombie-behavior.js'),'packaged simulation includes its social-memory module');
});

test('baked new clips loop exactly with finite unit rotations and no horizontal rig-root drift',()=>{
 for(const clip of current.json.animations.slice(6)){
  assert(clip.extras.loop);assert.equal(clip.extras.zombieMotionVersion,7);
  assert.equal(clip.channels.length,original.json.animations[0].channels.length);
  const input=new Set();
  for(const channel of clip.channels){
   const sampler=clip.samplers[channel.sampler],times=floats(current,sampler.input).flat(),values=floats(current,sampler.output);
   if(!input.has(sampler.input)){
    assert(times.every((v,i)=>Number.isFinite(v)&&(i===0||v>times[i-1])),'strictly increasing seconds');input.add(sampler.input);
   }
   assert(values.every(v=>v.every(Number.isFinite)));
   const path=channel.target.path;
   if(path==='rotation'){
    assert(values.every(q=>Math.abs(Math.hypot(...q)-1)<2e-6));
    assert(Math.abs(values[0].reduce((sum,v,i)=>sum+v*values.at(-1)[i],0))>1-2e-6,'same boundary rotation');
   }else assert.deepEqual(values[0],values.at(-1),'same boundary position/scale');
   const name=current.json.nodes[channel.target.node].name;
   if(path==='translation'&&name==='Hips'){
    const parent=restMatrix(parents.get(channel.target.node)),world=values.map(v=>new THREE.Vector3(...v).applyMatrix4(parent).toArray());
    for(let axis of [0,2])assert(Math.max(...world.map(v=>v[axis]))-Math.min(...world.map(v=>v[axis]))<.05,'in-place pelvis with bounded sway in metres');
   }
  }
 }
});
