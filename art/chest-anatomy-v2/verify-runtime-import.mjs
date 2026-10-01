// Offline CPU verification of the actual bundled Three.js/GLTFLoader path.
// Only image decoding is stubbed; PNG payloads are checked separately.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GLTFLoader} from '../../vendor/loaders/GLTFLoader.js';
import {Vector3} from '../../vendor/three.module.js';

const path=new URL('../../assets/models/chest-anatomy-v2.glb',import.meta.url);
const raw=readFileSync(path);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=attribute=>Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength);
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
const expected={ChestWound:{TissueTension:0},Heart:{GripCompress:0,VesselLagLeft:1,VesselLagRight:2}};
const report={status:'PASS',assetSha256:sha(raw),decoderStubOnly:true,components:[]};
const vertex=new Vector3();
function pose(mesh){
  const result=new Float64Array(mesh.geometry.attributes.position.count*3);
  for(let i=0;i<result.length/3;i++)mesh.getVertexPosition(i,vertex).toArray(result,i*3);
  return result;
}
for(const [name,dictionary] of Object.entries(expected)){
  const mesh=gltf.scene.getObjectByName(name);
  assert(mesh?.isMesh,`${name} imports as a mesh`);
  assert.deepEqual(mesh.morphTargetDictionary,dictionary);
  assert(mesh.geometry.morphTargetsRelative);
  assert(mesh.morphTargetInfluences.every(value=>value===0));
  const attributes=Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([key,value])=>[key,sha(bytes(value))]));
  const indexHash=sha(bytes(mesh.geometry.index));
  assert.equal(mesh.geometry.morphAttributes.position.length,Object.keys(dictionary).length);
  assert.equal(mesh.geometry.morphAttributes.normal.length,Object.keys(dictionary).length);
  const base=pose(mesh),targets=[];
  for(const [target,index] of Object.entries(dictionary)){
    mesh.morphTargetInfluences.fill(0);
    mesh.morphTargetInfluences[index]=1;
    const deformed=pose(mesh);let maximum=0,affected=0;
    for(let i=0;i<base.length;i+=3){
      const distance=Math.hypot(deformed[i]-base[i],deformed[i+1]-base[i+1],deformed[i+2]-base[i+2]);
      assert(Number.isFinite(distance));
      maximum=Math.max(maximum,distance);if(distance>1e-6)affected++;
    }
    assert(maximum>0.001&&maximum<0.012,`${target} has a bounded local deformation`);
    targets.push({name:target,maximumDisplacementMeters:maximum,affectedVertices:affected});
  }
  mesh.morphTargetInfluences.fill(0);
  assert.deepEqual(pose(mesh),base,`${name} relaxes exactly to the imported neutral pose`);
  const clone=mesh.clone();
  assert.notEqual(clone.morphTargetInfluences,mesh.morphTargetInfluences);
  clone.morphTargetInfluences[0]=1;
  assert(mesh.morphTargetInfluences.every(value=>value===0));
  assert.equal(clone.geometry,mesh.geometry);
  assert.equal(clone.material,mesh.material);
  assert.equal(sha(bytes(mesh.geometry.index)),indexHash);
  for(const [key,value] of Object.entries(mesh.geometry.attributes))assert.equal(sha(bytes(value)),attributes[key]);
  report.components.push({name,dictionary,vertexCount:base.length/3,targets,resetExact:true,independentCloneInfluences:true,
    geometryAndMaterialShared:true,attributesUnmodified:true,loadedMorphAttributes:Object.keys(mesh.geometry.morphAttributes),
    tangentLimit:'Bundled GLTFLoader ignores morph tangent deltas; GLB preserves them for interchange, while runtime uses base tangents and morphed normals.'});
}
assert.equal(sha(readFileSync(path)),report.assetSha256);
assert.equal(sha(readFileSync(new URL('../../assets/models/chest-anatomy-v1.glb',import.meta.url))),
 '896c71c578f6a6ff78b09b152ab9918e8e472d9ac5cda73fa7a3ea542f0685b5');
report.acceptedV1Preserved=true;
writeFileSync(new URL('./runtime-import-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
