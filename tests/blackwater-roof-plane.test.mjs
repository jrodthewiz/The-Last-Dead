import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {buildBlackwaterDistrict} from '../blackwater-district-visuals.js';
import {buildBlackwaterDistrict as oldDistrict} from '../output/qa-runtime/island-environment-v64/blackwater-district-visuals.js';
import {makeBlackwaterGraphicMaterial,makeBlackwaterBands} from '../blackwater-render-looks.js';
import {applyBlackwaterGraphicStyle} from '../blackwater-graphic-style.js';
const hash=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const meshes=root=>{const r=[];root.traverse(o=>{if(o.isMesh)r.push(o);});return r;};

test('legacy48m partition of actual94 buildings preserves every old buffer, batch, authority descriptor and ink',()=>{
 const slice=makeHarborCourse({openWorld:true}).coastal.blackwaterSlice;
 const before=oldDistrict(new THREE.Group(),slice),after=buildBlackwaterDistrict(new THREE.Group(),slice,{buildingChunkSize:48,nativeBundles:false,failedClosure:false,failedTransfer:false,groundCornerJoin:false});
 try{
  assert.equal(after.models.length,94);assert.deepEqual(after.diagnostics.buildingBatches,before.diagnostics.buildingBatches);
  const a=meshes(after.root),b=meshes(before.root);assert.equal(a.length,b.length);
  let bytes=0,targets=0,legacy=0;const kinds=new Map(),typedLabels=new Map();
  for(let j=0;j<a.length;j++){
   assert.equal(a[j].name,b[j].name);assert.equal(a[j].visible,b[j].visible);assert.deepEqual(a[j].matrix.elements,b[j].matrix.elements);
   assert.equal(a[j].geometry.index?hash(a[j].geometry.index.array):null,b[j].geometry.index?hash(b[j].geometry.index.array):null);
   for(const key of Object.keys(b[j].geometry.attributes))assert.equal(hash(a[j].geometry.attributes[key].array),hash(b[j].geometry.attributes[key].array),a[j].name+'/'+key);
   assert.deepEqual(a[j].geometry.boundingBox?.min.toArray(),b[j].geometry.boundingBox?.min.toArray());assert.deepEqual(a[j].geometry.boundingBox?.max.toArray(),b[j].geometry.boundingBox?.max.toArray());assert.deepEqual(a[j].geometry.boundingSphere?.center.toArray(),b[j].geometry.boundingSphere?.center.toArray());assert.equal(a[j].geometry.boundingSphere?.radius,b[j].geometry.boundingSphere?.radius);
   const frame=a[j].geometry.getAttribute('roofPlane');if(!frame)continue;
   bytes+=frame.array.byteLength;assert.ok(frame.array.every(Number.isFinite));
   for(let i=0;i<frame.count;i++){
    const type=frame.getW(i);assert.ok([0,1,1.25,2].includes(type));kinds.set(type,(kinds.get(type)||0)+1);
    if(type){targets++;assert.ok(frame.getZ(i)>0);assert.ok(frame.getY(i)>=-1e-5&&frame.getY(i)<=frame.getZ(i)+1e-5);}
    else {legacy++;assert.equal(frame.getX(i),0);assert.equal(frame.getY(i),0);assert.equal(frame.getZ(i),0);}
   }
   if(a[j].userData.blackwaterDressing)assert.ok(frame.array.every(v=>v===0),'dressing-owned defaults never gain physical finish');
  }
  assert.ok(targets>0&&legacy>0);
  for(let i=0;i<94;i++){
   const am=after.models[i],bm=before.models[i];assert.deepEqual(am.colliders,bm.colliders);assert.deepEqual(am.diagnostics.plan,bm.diagnostics.plan);
   for(const key of ['triangleCount','trianglesPerMaterial','drawCalls','materialSlots','moduleCounts','trianglesPerModule','structuralDamageBounds','placementCount','bounds'])assert.deepEqual(am.diagnostics[key],bm.diagnostics[key],key);
   const roofMeshes=meshes(am.root).filter(m=>m.geometry.getAttribute('roofPlane'));
   const types=new Set(roofMeshes.flatMap(m=>Array.from(m.geometry.getAttribute('roofPlane').array).filter((_,i)=>i%4===3)));
   if(types.has(2))typedLabels.set(am.diagnostics.plan.settings.label,2);
   if(types.has(1.25))assert.ok(['monitor','hangar-monitor'].includes(am.diagnostics.plan.anatomy.roof),'seat only on actual monitor descriptor');
   if(am.diagnostics.plan.anatomy.roof==='sawtooth')assert.ok(!types.has(1.25));
  }
  assert.equal(typedLabels.size,19);
  const budget=after.diagnostics.roofPlane.bytes;assert.equal(bytes,budget.source+budget.merged+budget.dressing);
  const inkBefore=applyBlackwaterGraphicStyle(before.root),inkAfter=applyBlackwaterGraphicStyle(after.root);
  try{assert.equal(inkAfter.diagnostics.inkTriangles,inkBefore.diagnostics.inkTriangles);const ai=meshes(after.root).filter(m=>m.userData.graphicInk),bi=meshes(before.root).filter(m=>m.userData.graphicInk);assert.equal(ai.length,bi.length);for(let i=0;i<ai.length;i++){for(const key of ['position','normal'])assert.equal(hash(ai[i].geometry.attributes[key].array),hash(bi[i].geometry.attributes[key].array));assert.equal(hash(ai[i].geometry.index.array),hash(bi[i].geometry.index.array));}}
  finally{inkAfter.dispose();inkBefore.dispose();}
  fs.writeFileSync(new URL('../output/island-roof-plane-resources.json',import.meta.url),JSON.stringify({buildings:94,roofPlane:after.diagnostics.roofPlane,typedVertexCounts:Object.fromEntries(kinds),residentialAddresses:[...typedLabels.keys()],baselineBuildingBatches:before.diagnostics.buildingBatches,candidateBuildingBatches:after.diagnostics.buildingBatches,scope:'CPU bit-exact roof comparison at unchanged legacy48m batching; runtime96m partition measured separately; no native shading/timing claim'},null,2)+'\n');
 }finally{after.dispose();before.dispose();}
});

test('every targeted roof triangle preserves plane metric, gravity and bounded runoff across all actual lots',()=>{
 const slice=makeHarborCourse({openWorld:true}).coastal.blackwaterSlice,district=buildBlackwaterDistrict(new THREE.Group(),slice);
 try{
  let triangles=0,targetedModels=0;const seen=new Set();
  for(const model of district.models){let targeted=false;
   for(const mesh of meshes(model.root)){
    const g=mesh.geometry,f=g.getAttribute('roofPlane'),p=g.getAttribute('position');if(!f)continue;
    for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)],types=ids.map(v=>f.getW(v));
     assert.ok(types.every(t=>t===types[0]),'a triangle never interpolates construction families');if(!types[0])continue;
     targeted=true;triangles++;seen.add(types[0]);
     const run=f.getZ(ids[0]);assert.ok(run>0);for(const v of ids){assert.equal(f.getZ(v),run);assert.ok(f.getY(v)>=-2e-5&&f.getY(v)<=run+2e-5,'runoff ends at actual eave/ridge');}
     for(let k=0;k<3;k++){
      const a=ids[k],b=ids[(k+1)%3],distance=Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b)),du=f.getY(a)-f.getY(b),fd=Math.hypot(f.getX(a)-f.getX(b),du),dy=p.getY(a)-p.getY(b);
      assert.ok(Math.abs(distance-fd)<2e-5,model.diagnostics.plan.settings.label+' plane metres preserve old physical edge '+distance+'/'+fd);
      if(Math.abs(du)>2e-5)assert.equal(Math.sign(dy),Math.sign(du),'uphill field follows physical rising roof, not opposite slope/ridge');
      else assert.ok(Math.abs(dy)<2e-5,'along-eave travel has no invented rise');
     }
    }
   }
   if(targeted)targetedModels++;
  }
  assert.deepEqual([...seen].sort(),[1,1.25,2]);assert.equal(targetedModels,41);assert.ok(triangles>100);
 }finally{district.dispose();}
});

test('only proven district provenance accesses physical attribute; legacy graph and owned disposal remain recoverable',()=>{
 const source=new THREE.MeshStandardMaterial();source.userData.lookRole='roof';const bands=makeBlackwaterBands([.075,.34,1]);
 const legacy=makeBlackwaterGraphicMaterial(source,bands);source.userData.blackwaterRoofPlane=true;const physical=makeBlackwaterGraphicMaterial(source,bands);
 try{assert.equal(legacy.userData.graphicSurface.coordinates,'world metres');assert.equal(physical.userData.graphicSurface.eaveBand,1.4);assert.equal(physical.userData.graphicSurface.seatBand,.6);assert.equal(physical.map,null);assert.equal(physical.userData.graphicSurface.zincSeatMax,.05);assert.equal(physical.userData.graphicSurface.residentialDrainMax,.08);assert.equal(physical.userData.graphicSurface.zincCleanMax,.05);}
 finally{physical.dispose();legacy.dispose();bands.dispose();source.dispose();}
});
