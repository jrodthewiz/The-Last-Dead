import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createEvacuationFolio,EVACUATION_FOLIO_SIZE} from '../assets/blackwater-kit/evacuation-folio.js';
import {ScavengerCaches} from '../scavenger-pack-ui.js';
import {makeHarborCourse} from '../harbor-course.js';
import {createBuildingPlan} from '../assets/blackwater-kit/architecture.js';
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('folded route booklet has finite outward faces, real UV density and a bounded two-slot envelope',()=>{
 const folio=createEvacuationFolio();
 try{
  assert.equal(folio.materials.length,2);assert.equal(folio.diagnostics.additionalLights,0);assert.equal(folio.diagnostics.additionalColliders,0);
  assert.ok(folio.diagnostics.triangles<250);assert.equal(folio.diagnostics.uvMetresPerTile,.20);
  for(let i=0;i<3;i++)close(folio.diagnostics.bounds.max[i]-folio.diagnostics.bounds.min[i],EVACUATION_FOLIO_SIZE[i]);
  for(const g of folio.geometries){
   const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
   assert.equal(n.count,p.count);assert.equal(uv.count,p.count);
   for(const buffer of [p.array,n.array,uv.array])assert.ok(buffer.every(Number.isFinite));
   for(let i=0;i<p.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    const geometric=b.sub(a).cross(c.sub(a));assert.ok(geometric.length()>.00000001,'no degenerate emitted triangle');
    assert.ok(geometric.normalize().dot(new THREE.Vector3().fromBufferAttribute(n,i))>.9999,'declared normal agrees with actual winding');
   }
  }
  assert.ok(folio.materials.every(m=>m.emissiveIntensity===1&&m.emissive.getHex()===0&&m.roughness>.9));
  const mesh=new THREE.Mesh(folio.geometries[0],folio.materials[0]);mesh.updateMatrixWorld();
  const hit=new THREE.Raycaster(new THREE.Vector3(.079,.1,.058),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
  assert.ok(hit&&hit.point.y>.013,'the raised corner has actual volume above the cover');
 }finally{folio.dispose();}
});

test('supported folio placement and yaw stay separate from fittings and collection retires only the booklet',()=>{
 const course=makeHarborCourse({openWorld:true}),parent=new THREE.Group(),pool=new ScavengerCaches(parent,course);
 const item=pool.folioItems[0],house=course.coastal.blackwaterSlice.buildings.find(b=>b.id===item.roomId),source=createBuildingPlan(house).routeFolio;
 try{
  assert.equal(pool.caseItems.length,11);assert.equal(pool.folioItems.length,1);assert.equal(pool.meshes.length,3);assert.equal(pool.folioMeshes.length,2);
  assert.equal(pool.meshes[0].count,11);assert.equal(pool.folioMeshes[0].count,1);
  const m=new THREE.Matrix4();pool.folioMeshes[0].getMatrixAt(0,m);
  const bottom=new THREE.Vector3(0,-.016,0).applyMatrix4(m);close(bottom.y,house.y+source.bottom);close(bottom.x,item.x*4,5e-5);close(bottom.z,item.y*4,5e-5);
  close(m.elements[0],Math.cos(item.visualYaw));close(m.elements[2],-Math.sin(item.visualYaw));
  pool.update([item.id]);assert.equal(pool.folioMeshes[0].count,0);assert.equal(pool.folioMeshes[1].count,0);assert.equal(pool.meshes[0].count,11);
  const caseId=pool.caseItems[0].id;pool.update([item.id,caseId]);assert.equal(pool.meshes[0].count,10);assert.equal(pool.folioMeshes[0].count,0);
  assert.equal(source.sourceSolidId,'cape75-upper-writing-desk-top');assert.equal(createBuildingPlan(house).upstairsArt.routeMap.persistent,true);
 }finally{pool.dispose();}
 assert.equal(parent.children.length,0);
});

test('ordinary caches add no folio draws and pooled ownership disposes each resource once',()=>{
 const parent=new THREE.Group(),course={scavengerPickups:[{id:'plain',x:1,y:2}]},pool=new ScavengerCaches(parent,course);
 assert.equal(pool.folioMeshes.length,0);assert.equal(pool.root.children.length,3);
 let retired=0;for(const mesh of pool.meshes){mesh.geometry.addEventListener('dispose',()=>retired++);mesh.material.addEventListener('dispose',()=>retired++);}
 pool.dispose();pool.dispose();assert.equal(retired,6);assert.equal(parent.children.length,0);
 const folio=createEvacuationFolio();let owned=0;[...folio.geometries,...folio.materials].forEach(r=>r.addEventListener('dispose',()=>owned++));
 folio.dispose();folio.dispose();assert.equal(owned,4);
});
