import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AFTERLIFE_ASH_WITNESS_URL} from '../npc-afterlife-model.js';
import {RUNTIME_FILES} from '../build.mjs';
function glb(file){const raw=readFileSync(new URL(file,import.meta.url));assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(8),raw.length,'GLB length matches complete file');const length=raw.readUInt32LE(12);return{raw,json:JSON.parse(raw.subarray(20,20+length)),binary:raw.subarray(28+length)};}
const old=glb('../assets/models/afterlife-ash-witness-motion-v04.glb'),rigged=glb('../art/character-rig-v05/afterlife-ash-witness-rig-v05.glb');
test('runtime uses the polished motion rig and preserves the reviewed v05 candidate',()=>{assert(AFTERLIFE_ASH_WITNESS_URL.endsWith('afterlife-ash-witness-motion-v07.glb'));assert.deepEqual(glb('../assets/models/afterlife-ash-witness-rig-v05.glb').raw,rigged.raw);assert(RUNTIME_FILES.includes('character-articulation.js'));assert(!RUNTIME_FILES.includes('rig-review.html'));assert(!RUNTIME_FILES.includes('rig-review.js'));});
function data(asset,index){const a=asset.json.accessors[index],v=asset.json.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],bytes={5121:1,5123:2,5125:4,5126:4}[a.componentType],stride=v.byteStride||width*bytes,offset=(v.byteOffset||0)+(a.byteOffset||0),parts=[];assert(!a.sparse);for(let i=0;i<a.count;i++)parts.push(asset.binary.subarray(offset+i*stride,offset+i*stride+width*bytes));return Buffer.concat(parts);}
function numbers(asset,index){const a=asset.json.accessors[index],b=data(asset,index),size={5121:1,5123:2,5125:4,5126:4}[a.componentType],out=[];for(let i=0;i<b.length;i+=size)out.push(a.componentType===5126?b.readFloatLE(i):a.componentType===5125?b.readUInt32LE(i):a.componentType===5123?b.readUInt16LE(i):b.readUInt8(i));return out;}
function imageBytes(asset,i){const v=asset.json.bufferViews[i.bufferView];return asset.binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);}

test('support rig preserves original rest hierarchy, inverse binds, six clips and extras',()=>{
  const a=old.json.skins[0],b=rigged.json.skins[0];assert.deepEqual(b.joints.slice(0,a.joints.length).map(i=>rigged.json.nodes[i].name),a.joints.map(i=>old.json.nodes[i].name));
  for(const index of a.joints){const node=old.json.nodes[index],other=rigged.json.nodes.find(n=>n.name===node.name);for(const key of ['translation','rotation','scale','matrix'])assert.deepEqual(other[key],node[key],node.name+' '+key);const parents=asset=>asset.json.nodes.filter(n=>n.children?.some(i=>asset.json.nodes[i].name===node.name)).map(n=>n.name);assert.deepEqual(parents(rigged),parents(old));}
  assert.deepEqual(data(rigged,b.inverseBindMatrices).subarray(0,a.joints.length*64),data(old,a.inverseBindMatrices));
  assert.equal(rigged.json.animations.length,6);
  for(const clip of old.json.animations){const current=rigged.json.animations.find(c=>c.name===clip.name);assert(current);assert.deepEqual(current.extras,clip.extras);assert.equal(current.channels.length,clip.channels.length);for(let i=0;i<clip.channels.length;i++){const ca=clip.channels[i],cb=current.channels[i],sa=clip.samplers[ca.sampler],sb=current.samplers[cb.sampler];assert.equal(old.json.nodes[ca.target.node].name,rigged.json.nodes[cb.target.node].name);assert.equal(cb.target.path,ca.target.path);assert.equal(sb.interpolation,sa.interpolation);assert.deepEqual(data(rigged,sb.input),data(old,sa.input));assert.deepEqual(data(rigged,sb.output),data(old,sa.output));}}
});

test('jaw, tongue and grips have actual weighted influence and local control metadata',()=>{
  const skin=rigged.json.skins[0],counts=new Map();let triangles=0;
  for(const mesh of rigged.json.meshes)for(const p of mesh.primitives){triangles+=(p.indices!==undefined?rigged.json.accessors[p.indices].count:rigged.json.accessors[p.attributes.POSITION].count)/3;const positions=numbers(rigged,p.attributes.POSITION);assert(positions.every(Number.isFinite));if(p.attributes.JOINTS_0===undefined)continue;const joints=numbers(rigged,p.attributes.JOINTS_0),weights=numbers(rigged,p.attributes.WEIGHTS_0);assert.equal(joints.length,weights.length);for(let i=0;i<joints.length;i+=4){let sum=0;for(let c=0;c<4;c++){assert(joints[i+c]>=0&&joints[i+c]<skin.joints.length);assert(Number.isFinite(weights[i+c])&&weights[i+c]>=0);sum+=weights[i+c];if(weights[i+c]>.05){const name=rigged.json.nodes[skin.joints[joints[i+c]]].name;counts.set(name,(counts.get(name)||0)+1);}}assert(Math.abs(sum-1)<.002,'normalized skin weights');}}
  for(const name of ['Jaw','Tongue','LeftGrip','RightGrip']){const node=rigged.json.nodes.find(n=>n.name===name);assert(node,name+' exists');assert(node.extras.articulation.maxAngleRadians>0);assert.equal(node.extras.articulation.axis.length,3);assert((counts.get(name)||0)>8,name+' deforms meaningful geometry');}
  assert(triangles<=36000);assert(rigged.json.materials.length<=3);assert(rigged.raw.length<5*1024*1024);
});

test('original packed texture/material and named attachment sockets survive',()=>{
  assert.deepEqual(rigged.json.materials[0],old.json.materials[0]);assert.deepEqual(imageBytes(rigged,rigged.json.images[0]),imageBytes(old,old.json.images[0]));
  for(const name of ['Head','Neck','Chest','Abdomen','LeftWrist','RightWrist'])assert(rigged.json.nodes.some(n=>n.name==='Socket_'+name));
  const oral=rigged.json.materials.filter(m=>m.extras?.oralSurface);assert(oral.length>0,'oral material role exports to runtime');assert(rigged.json.images.every(i=>i.bufferView!==undefined),'no external image URLs');
});
