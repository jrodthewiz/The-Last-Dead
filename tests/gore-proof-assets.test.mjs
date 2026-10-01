import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {RUNTIME_FILES,RUNTIME_DIRECTORIES} from '../build.mjs';

const file=new URL('../art/gore-proof/ash-witness-abdominal-proof-v1.glb',import.meta.url);
const raw=readFileSync(file),manifest=JSON.parse(readFileSync(new URL('../art/gore-proof/ash-witness-abdominal-proof-v1-manifest.json',import.meta.url),'utf8'));
assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
let document,binary;
for(let offset=12;offset<raw.length;){const length=raw.readUInt32LE(offset),type=raw.readUInt32LE(offset+4),chunk=raw.subarray(offset+8,offset+8+length);if(type===0x4e4f534a)document=JSON.parse(chunk.toString('utf8'));if(type===0x004e4942)binary=chunk;offset+=8+length;}
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},bytes={5121:1,5123:2,5125:4,5126:4};
function values(index){const a=document.accessors[index],view=document.bufferViews[a.bufferView],width=widths[a.type],size=bytes[a.componentType];assert(width&&size,'supported exported accessor');assert(!a.sparse,'proof needs no sparse decoder');const data=new DataView(binary.buffer,binary.byteOffset,binary.byteLength),result=[];for(let i=0;i<a.count;i++)for(let c=0;c<width;c++){const offset=(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||width*size)+c*size;result.push(a.componentType===5126?data.getFloat32(offset,true):a.componentType===5125?data.getUint32(offset,true):a.componentType===5123?data.getUint16(offset,true):data.getUint8(offset));}return result;}
const primitives=document.meshes.flatMap(mesh=>mesh.primitives);
function area2(position,indices,offset){const a=indices[offset]*3,b=indices[offset+1]*3,c=indices[offset+2]*3,u=[0,1,2].map(i=>position[b+i]-position[a+i]),v=[0,1,2].map(i=>position[c+i]-position[a+i]);return (u[1]*v[2]-u[2]*v[1])**2+(u[2]*v[0]-u[0]*v[2])**2+(u[0]*v[1]-u[1]*v[0])**2;}

test('exported proof stays within its geometry/material budget and has valid drawable surfaces',()=>{
  let triangles=0;
  for(const primitive of primitives){assert.equal(primitive.mode??4,4);const p=values(primitive.attributes.POSITION),n=values(primitive.attributes.NORMAL),uv=values(primitive.attributes.TEXCOORD_0),indices=values(primitive.indices);assert(p.every(Number.isFinite)&&n.every(Number.isFinite)&&uv.every(Number.isFinite));assert.equal(n.length,p.length);assert.equal(uv.length,p.length/3*2);assert(indices.every(i=>Number.isInteger(i)&&i>=0&&i<p.length/3));for(let i=0;i<n.length;i+=3)assert(Math.abs(Math.hypot(n[i],n[i+1],n[i+2])-1)<.002,'unit surface normals');for(let i=0;i<indices.length;i+=3)assert(area2(p,indices,i)>1e-18,'no collapsed exported base triangles');triangles+=indices.length/3;}
  assert.equal(triangles,manifest.geometry.triangles);assert(triangles<=15000);assert(document.materials.length<=3);assert.equal(document.images.length,1);assert(document.textures.every(t=>t.source===0));assert(document.materials.every(m=>Number.isInteger(m.pbrMetallicRoughness?.baseColorTexture?.index)));
});

test('spill shape exports finite positions and endpoint normals without animation or skeleton mutation',()=>{
  const morphMeshes=document.meshes.filter(mesh=>mesh.primitives.some(p=>p.targets?.length));assert.equal(morphMeshes.length,3);
  for(const mesh of morphMeshes){assert.deepEqual(mesh.extras.targetNames,['Floor_Spill_Reference']);for(const primitive of mesh.primitives){assert.equal(primitive.targets.length,1);const base=values(primitive.attributes.POSITION),delta=values(primitive.targets[0].POSITION),normal=values(primitive.targets[0].NORMAL);assert.equal(delta.length,base.length);assert(delta.every(Number.isFinite)&&normal.every(Number.isFinite));assert(delta.some(v=>Math.abs(v)>.03),'shape actually moves tissue');const endpoint=base.map((v,i)=>v+delta[i]),indices=values(primitive.indices);for(let i=0;i<indices.length;i+=3)assert(area2(endpoint,indices,i)>1e-18,'no collapsed endpoint triangles');}}
  assert.equal(document.animations?.length||0,0);assert.equal(document.skins?.length||0,0);assert.equal(manifest.integratedInGame,false);
});

test('atlas, authored closure checks and provenance remain reviewable',async()=>{
  const atlas=await readFile(new URL('../art/gore-proof/tissue-atlas-v1-1024.png',import.meta.url));assert.equal(atlas.readUInt32BE(16),1024);assert.equal(atlas.readUInt32BE(20),1024);assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.sha256.glb);
  const source=await readFile(new URL(`../${manifest.sourceFit.canonicalSource}`,import.meta.url));assert.equal(createHash('sha256').update(source).digest('hex'),manifest.sha256.source,'current character source matches read-only fitting input');
  for(const mesh of manifest.geometry.meshes){assert.equal(mesh.boundaryEdges,0);assert.equal(mesh.nonmanifoldEdges,0);assert.equal(mesh.inconsistentWindingEdges,0);assert.equal(mesh.degenerateTriangles,0);assert.equal(mesh.uvOutOfGutterRangeLoops,0);assert.equal(mesh.uvZeroAreaTriangles,0);}
});

test('default production build excludes the candidate viewer and offline art directory',()=>{
  assert(!RUNTIME_FILES.some(name=>name.startsWith('gore-proof')));assert(!RUNTIME_DIRECTORIES.includes('art'));assert(!RUNTIME_DIRECTORIES.includes('.art-source'));assert(!RUNTIME_FILES.includes('scripts/gore-anatomy-proof.py'));
});
