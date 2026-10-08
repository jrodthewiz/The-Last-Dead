import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function glb(name){
 const bytes=readFileSync(new URL('../assets/models/'+name,import.meta.url));
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const length=bytes.readUInt32LE(12);
 return {json:JSON.parse(bytes.subarray(20,20+length)),binary:bytes.subarray(28+length),bytes};
}
function data(asset,index){
 const a=asset.json.accessors[index],v=asset.json.bufferViews[a.bufferView];
 const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType];
 const stride=v.byteStride||width*size,start=(v.byteOffset||0)+(a.byteOffset||0);
 return Buffer.concat(Array.from({length:a.count},(_,i)=>asset.binary.subarray(start+i*stride,start+i*stride+width*size)));
}
function values(asset,index){
 const bytes=data(asset,index),width={SCALAR:1,VEC3:3,VEC4:4}[asset.json.accessors[index].type],out=[];
 for(let i=0;i<bytes.length;i+=width*4)out.push(Array.from({length:width},(_,n)=>bytes.readFloatLE(i+n*4)));
 return out;
}
const before=glb('afterlife-ash-witness-rig-v05.glb'),after=glb('afterlife-ash-witness-motion-v06.glb');
const changedBones=new Set(['Spine','Spine01','neck','Head','LeftShoulder','RightShoulder']);
const changedClips=new Set(['AshWitness_Idle','AshWitness_Shuffle','AshWitness_Chase']);

test('headless motion polish preserves weighted anatomy, sockets, geometry, binds and packed materials',()=>{
 assert(after.bytes.length<5*1024*1024);
 assert.deepEqual(after.json.nodes,before.json.nodes);
 assert.deepEqual(after.json.materials,before.json.materials);
 assert.deepEqual(after.json.textures,before.json.textures);
 for(let i=0;i<before.json.meshes.length;i++)for(let p=0;p<before.json.meshes[i].primitives.length;p++){
  const a=before.json.meshes[i].primitives[p],b=after.json.meshes[i].primitives[p];
  for(const name of Object.keys(a.attributes))assert.deepEqual(data(after,b.attributes[name]),data(before,a.attributes[name]),name);
  assert.deepEqual(data(after,b.indices),data(before,a.indices));
 }
 assert.deepEqual(data(after,after.json.skins[0].inverseBindMatrices),data(before,before.json.skins[0].inverseBindMatrices));
 for(let i=0;i<before.json.images.length;i++){
  const a=before.json.bufferViews[before.json.images[i].bufferView],b=after.json.bufferViews[after.json.images[i].bufferView];
  assert.deepEqual(after.binary.subarray(b.byteOffset,b.byteOffset+b.byteLength),before.binary.subarray(a.byteOffset,a.byteOffset+a.byteLength));
 }
});

test('combat timing and all lower-body channels remain byte exact while secondary motion is bounded',()=>{
 let changed=0,preserved=0;
 for(let i=0;i<before.json.animations.length;i++){
  const a=before.json.animations[i],b=after.json.animations[i];
  assert.equal(a.name,b.name);assert.deepEqual(a.extras,b.extras);assert.equal(a.channels.length,b.channels.length);
  for(let n=0;n<a.channels.length;n++){
   const ca=a.channels[n],cb=b.channels[n],sa=a.samplers[ca.sampler],sb=b.samplers[cb.sampler];
   assert.deepEqual(ca.target,cb.target);
   const bone=before.json.nodes[ca.target.node].name;
   if(changedClips.has(a.name)&&changedBones.has(bone)&&ca.target.path==='rotation'){
    const old=values(before,sa.output),current=values(after,sb.output),times=values(after,sb.input).flat();
    assert(times.every((t,j)=>Number.isFinite(t)&&(j===0||t>times[j-1])));
    assert.equal(times.at(-1),values(before,sa.input).at(-1)[0]);
    assert(current.every(q=>q.every(Number.isFinite)&&Math.abs(Math.hypot(...q)-1)<2e-6));
    for(const [qa,qb] of [[old[0],current[0]],[old.at(-1),current.at(-1)]])
     assert(Math.abs(qa.reduce((s,x,j)=>s+x*qb[j],0))>1-2e-6,'original loop endpoints retained');
    assert.notDeepEqual(data(before,sa.output),data(after,sb.output),'authored motion changed');
    changed++;
   }else{
    assert.deepEqual(data(before,sa.input),data(after,sb.input),a.name+'/'+bone+' timing');
    assert.deepEqual(data(before,sa.output),data(after,sb.output),a.name+'/'+bone+' pose');
    preserved++;
   }
  }
 }
 assert.equal(changed,18);assert.equal(preserved,414);
 const report=JSON.parse(readFileSync(new URL('../docs/character-motion-polish/validation.json',import.meta.url)));
 for(const r of report){assert(r.geometryBindTextureAndCombatExact);assert(r.changes.every(c=>c.maxOffsetRadians<.1));}
});

test('Warden still ships six normalized authored clips on the original 24 joint skeleton',()=>{
 const warden=glb('bloodworks-warden.glb');
 assert.equal(warden.json.skins[0].joints.length,24);
 assert.deepEqual(warden.json.animations.map(c=>c.name).sort(),['TLD_Collapse','TLD_Hit','TLD_Idle','TLD_Strike','TLD_Walk','TLD_Windup']);
 assert.equal(warden.json.asset.extras.secondaryMotionVersion,6);
 for(const clip of warden.json.animations)for(const channel of clip.channels)if(channel.target.path==='rotation')
  assert(values(warden,clip.samplers[channel.sampler].output).every(q=>q.every(Number.isFinite)&&Math.abs(Math.hypot(...q)-1)<2e-5));
});
