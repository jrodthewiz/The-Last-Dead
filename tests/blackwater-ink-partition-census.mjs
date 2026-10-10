// Test-only reconstruction. Never imports or mutates the working runtime.
// Run only after the root releases CPU: node tests/blackwater-ink-partition-census.mjs [camera-report.json]
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../output/qa-runtime/island-environment-v86/vendor/three.module.js';
import {makeHarborCourse} from '../output/qa-runtime/island-environment-v86/harbor-course.js';
import {buildBlackwaterDistrict} from '../output/qa-runtime/island-environment-v86/blackwater-district-visuals.js';
import {applyBlackwaterGraphicStyle} from '../output/qa-runtime/island-environment-v86/blackwater-graphic-style.js';

const base=new URL('../',import.meta.url),sourceURL=new URL('output/qa-runtime/island-environment-v86/blackwater-graphic-style.js',base);
const source=fs.readFileSync(sourceURL,'utf8');
const start=source.indexOf('function indexInkCorners('),end=source.indexOf('\n// Ground',start);
assert.ok(start>=0&&end>start,'frozen unchanged indexInkCorners source boundary');
const indexInkCorners=new Function('THREE',source.slice(start,end)+';return indexInkCorners;')(THREE);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const camerasPath=process.argv[2]||'output/playwright/island-art-v87/report.json';
const native=fs.existsSync(new URL(camerasPath,base))?JSON.parse(fs.readFileSync(new URL(camerasPath,base),'utf8')):null;
const poses=[...(native?.views||[])];
const profile=native?.cityFrameProfile;
if(profile?.cameraProjection){
 const m=profile.cameraProjection.matrixWorld;
 poses.push({name:'fixed232-city-profile',cameraProjection:profile.cameraProjection,camera:m.slice(12,15),cameraQuaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().fromArray(m)).toArray(),fov:2*Math.atan(1/profile.cameraProjection.projectionMatrix[5])*180/Math.PI,canvas:[native.inspectionViewport.width,native.inspectionViewport.height],metadataScope:'Exact native profile camera matrices; FOV/quaternion descriptive fields derived from those matrices. Canvas from owned native inspectionViewport.'});
}
const district=buildBlackwaterDistrict(new THREE.Group(),makeHarborCourse({openWorld:true}).coastal.blackwaterSlice);
const style=applyBlackwaterGraphicStyle(district.root);
const baseline=[];district.root.traverse(o=>{if(o.userData.graphicInk)baseline.push(o);});
assert.equal(district.models.length,94);
const total=baseline.reduce((n,o)=>n+o.geometry.index.count/3,0);
assert.equal(total,style.diagnostics.inkTriangles);

// Canonical records contain every expanded corner position+normal FLOAT32 BIT,
// including signed zero. Original triangle IDs are a bijection certificate:
// each candidate emits each original exactly once, with all18 words equal.
const words=new Uint32Array(total*18),floats=new Float32Array(words.buffer);
let cursor=0,maxTriangleSpan=0,maxNormal=0;
for(const mesh of baseline){
 const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,ix=g.index.array;
 const pb=new Uint32Array(p.array.buffer,p.array.byteOffset,p.array.length),nb=new Uint32Array(n.array.buffer,n.array.byteOffset,n.array.length);
 for(let k=0;k<ix.length;k+=3){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let c=0;c<3;c++){
   const i=ix[k+c]*3,offset=cursor*18+c*6;
   for(let a=0;a<3;a++){words[offset+a]=pb[i+a];words[offset+3+a]=nb[i+a];min[a]=Math.min(min[a],p.array[i+a]);max[a]=Math.max(max[a],p.array[i+a]);}
   maxNormal=Math.max(maxNormal,Math.hypot(n.array[i],n.array[i+1],n.array[i+2]));
  }
  maxTriangleSpan=Math.max(maxTriangleSpan,max[0]-min[0],max[2]-min[2]);cursor++;
 }
}
assert.equal(cursor,total);
const originalDigest=hash(Buffer.from(words.buffer));
const baselineFlags={layers:baseline[0].layers.mask,castShadow:baseline[0].castShadow,receiveShadow:baseline[0].receiveShadow,frustumCulled:baseline[0].frustumCulled,side:baseline[0].material.side,depthWrite:baseline[0].material.depthWrite,transparent:baseline[0].material.transparent};
for(const m of baseline)assert.deepEqual({layers:m.layers.mask,castShadow:m.castShadow,receiveShadow:m.receiveShadow,frustumCulled:m.frustumCulled,side:m.material.side,depthWrite:m.material.depthWrite,transparent:m.material.transparent},baselineFlags);

function envelope(mesh){const g=mesh.geometry,b=g.boundingBox,s=g.boundingSphere;return {name:mesh.name,triangles:g.index.count/3,bytes:g.index.array.byteLength+g.attributes.position.array.byteLength+g.attributes.normal.array.byteLength,bounds:{min:b.min.toArray(),max:b.max.toArray()},span:b.getSize(new THREE.Vector3()).toArray(),sphere:{center:s.center.toArray(),radius:s.radius},frustumCulled:mesh.frustumCulled,layers:mesh.layers.mask};}
function cameraCensus(meshes){return poses.map(v=>{
 const meta=v.cameraProjection;
 if(!meta?.projectionMatrix||!meta?.matrixWorld)return {name:v.name,authoritative:false,reason:'No exact native cameraProjection matrices; no GL/native-equivalence assumption.'};
 const camera=new THREE.PerspectiveCamera();camera.coordinateSystem=meta.coordinateSystem;
 camera.projectionMatrix.fromArray(meta.projectionMatrix);camera.matrixWorld.fromArray(meta.matrixWorld);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),meta.coordinateSystem,meta.reversedDepth);
 const height=v.canvas[1],f=meta.projectionMatrix[5],k=2*style.diagnostics.inkPixels*maxNormal/(height*f);
 assert.ok(k>=0&&k<1);assert.ok(Number.isFinite(meta.far));
 // All in-frustum vertices have |viewZ| <= far. Add the fixed-point margin
 // so even an extrusion initially beyond far that enters remains enclosed.
 // Large crossing triangles may extend beyond far; the global vertex bound
 // below includes them, rather than assuming every source vertex is clipped.
 let maximumViewZ=0;
 for(const mesh of meshes){const s=mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);const c=s.center.clone().applyMatrix4(camera.matrixWorldInverse);maximumViewZ=Math.max(maximumViewZ,Math.abs(c.z)+s.radius);}
 const pad=k*Math.max(meta.far,maximumViewZ)/(1-k);
 const count=padding=>{let draws=0,triangles=0;const names=[];
  for(const mesh of meshes){if(!mesh.visible||!(mesh.layers.mask&2))continue;const sphere=mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);sphere.radius+=padding;if(!mesh.frustumCulled||frustum.intersectsSphere(sphere)){draws++;triangles+=mesh.geometry.index.count/3;names.push(mesh.name);}}
  return {draws,triangles,names};};
 return {name:v.name,authoritativeGeometryFrustum:true,cameraProjection:meta,position:v.camera,quaternion:v.cameraQuaternion,fov:v.fov,canvas:v.canvas,originalBounds:count(0),conservativeExtrusionBounds:count(pad),paddingMetres:pad,scope:'CPU whole-geometry sphere-frustum submission estimate; not clipped fragment count, native draw/FPS proof, or wall occlusion.'};
 });}
function partition(size){
 const groups=new Map();
 for(let t=0;t<total;t++){const o=t*18,x=(floats[o]+floats[o+6]+floats[o+12])/3,z=(floats[o+2]+floats[o+8]+floats[o+14])/3,key=`${Math.floor(x/size)}/${Math.floor(z/size)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
 const visited=new Uint8Array(total),meshes=[];let verified=0;
 try{
  for(const [key,ids]of groups){
   const p=new Float32Array(ids.length*9),n=new Float32Array(ids.length*9),pb=new Uint32Array(p.buffer),nb=new Uint32Array(n.buffer);
   ids.forEach((id,i)=>{assert.equal(visited[id]++,0);for(let c=0;c<3;c++)for(let a=0;a<3;a++){pb[i*9+c*3+a]=words[id*18+c*6+a];nb[i*9+c*3+a]=words[id*18+c*6+3+a];}});
   const g=indexInkCorners(p,n),gp=new Uint32Array(g.attributes.position.array.buffer),gn=new Uint32Array(g.attributes.normal.array.buffer),indices=g.index.array;
   ids.forEach((id,i)=>{for(let c=0;c<3;c++)for(let a=0;a<3;a++){const at=indices[i*3+c]*3+a;assert.equal(gp[at],words[id*18+c*6+a]);assert.equal(gn[at],words[id*18+c*6+3+a]);}verified++;});
   g.computeBoundingBox();g.computeBoundingSphere();const m=new THREE.Mesh(g,baseline[0].material);m.name=`CPUInk${size}:${key}`;m.layers.mask=baselineFlags.layers;m.castShadow=baselineFlags.castShadow;m.receiveShadow=baselineFlags.receiveShadow;m.frustumCulled=baselineFlags.frustumCulled;meshes.push(m);
  }
  assert.equal(verified,total);for(const n of visited)assert.equal(n,1);
  const bins=meshes.map(envelope);return {centroidBinMetres:size,triangles:total,bins:bins.length,bytes:bins.reduce((n,b)=>n+b.bytes,0),maxXZEnvelopeSpan:Math.max(...bins.flatMap(b=>[b.span[0],b.span[2]])),triangleSpanEnvelopeCeiling:size+2*maxTriangleSpan,allTrianglesExactlyOnce:true,allExpandedFloat32BitsEqual:true,windingAndWithinBinEncounterOrderEqual:true,globalDrawOrderPreserved:false,flags:baselineFlags,cameras:cameraCensus(meshes),geometry:bins};
 }finally{for(const m of meshes)m.geometry.dispose();}
}
try{
 const original=baseline.map(envelope),result={scope:'Read-only frozenv86 actual94-building ink reconstruction. Candidate16/32m partitions exist only in CPU-owned temporary geometry. No runtime source mutation or native/FPS/VRAM claim. v87 mechanics captured but overall report failed live health guard; camera evidence remains actual.',frozenGraphicSHA256:hash(source),cameraReport:camerasPath,nativeCameraViews:poses.length,sourceRoot:'BlackwaterMainStreet only',sourceTriangles:total,sourceExpandedTriangleBitsSHA256:originalDigest,maxTriangleXZSpan:maxTriangleSpan,maxNormalLength:maxNormal,original:{bins:original.length,bytes:original.reduce((n,b)=>n+b.bytes,0),maxXZEnvelopeSpan:Math.max(...original.flatMap(b=>[b.span[0],b.span[2]])),flags:baselineFlags,cameras:cameraCensus(baseline),geometry:original},candidates:[partition(32),partition(16)]};
 for(const c of result.candidates)c.bufferByteDelta=c.bytes-result.original.bytes;
 assert.equal(hash(Buffer.from(words.buffer)),originalDigest,'canonical source words were immutable');
 fs.writeFileSync(new URL('output/island-ink-partition-findings.json',base),JSON.stringify(result,null,2)+'\n');
 const counts=c=>c.conservativeExtrusionBounds?`${c.conservativeExtrusionBounds.draws}/${c.conservativeExtrusionBounds.triangles}`:'unavailable';
 const cameraRows=result.original.cameras.map((c,i)=>`|${c.name}|${counts(c)}|${counts(result.candidates[0].cameras[i])}|${counts(result.candidates[1].cameras[i])}|`).join('\n');
 fs.writeFileSync(new URL('output/island-ink-partition-findings.md',base),`# Read-only ink partition census\n\nFrozenv86 district: ${total.toLocaleString()} triangles / ${original.length} bins / ${result.original.bytes.toLocaleString()} indexed buffer bytes. Exact expanded triangle Float32 words preserved by both test-only partitions, with every original triangle emitted once.\n\n${result.candidates.map(c=>`${c.centroidBinMetres}m: ${c.bins} bins, ${c.bytes.toLocaleString()} bytes (${c.bufferByteDelta>=0?'+':''}${c.bufferByteDelta}), maximum x/z span ${c.maxXZEnvelopeSpan.toFixed(3)}m.`).join('\n\n')}\n\nActual v87 overall report failed its live health guard; captured matrices remain real evidence. Camera report: ${camerasPath}; ${poses.length} requested poses available. Each row gives conservative extrusion-padded sphere-frustum draws/triangles.\n\n|Camera|Original|32m|16m|\n|---|---|---|---|\n${cameraRows}\n\nDetailed unpadded counts, exact native metadata and conservative shader-extrusion padding are in the JSON. Geometry sphere intersections estimate submitted geometry and do not measure alpha visibility, fragment occupancy, occlusion, GPU queue cost, FPS or physical VRAM. Global draw ordering can change and requires native art rejection checks. No runtime candidate is authorized by this census alone.\n`);
 console.log(JSON.stringify({sourceTriangles:total,sourceBins:original.length,poses:poses.length,candidates:result.candidates.map(c=>({metres:c.centroidBinMetres,bins:c.bins,bytes:c.bytes})),output:'output/island-ink-partition-findings.json'},null,2));
}finally{style.dispose();district.dispose();}
