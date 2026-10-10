import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {portFrontagePlan,buildCoastalPortFrontage,dispatchFrontageFrame,DISPATCH_SOURCE_SIZE} from '../coastal-port-frontage.js';
import {createModel} from '../assets/thai-kit/bangkok-apartment-block.js';

test('dispatch awning bears on the uniformly fitted rendered facade',()=>{
 const value=createModel(),model=value.root||value.group||value;model.updateMatrixWorld(true);
 const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
 assert.deepEqual(size.toArray(),DISPATCH_SOURCE_SIZE);
 const course=makeHarborCourse({openWorld:true}),frame=dispatchFrontageFrame(course);
 const b=course.buildings.find(b=>b.name==='DOCK OFFICES');
 assert.ok(frame.z>b.y*4+4,'source facade is inset from collision lot');
 const parts=portFrontagePlan(course),bearing=parts.find(p=>p.role==='dispatch-awning-bearing');
 assert.equal(bearing.position[2],frame.z-.04);assert.ok(frame.width>=bearing.size[0]);
});

test('port handling frontage follows actual depot bearing, preserves course and keeps return/quay routes clear',()=>{
 const course=makeHarborCourse({openWorld:true}),saved=JSON.stringify(course),plan=portFrontagePlan(course);
 assert.ok(plan.length>0);assert.equal(JSON.stringify(course),saved);
 const power=course.buildings.find(b=>b.passage),frontZ=power.y*4,center=(power.passage.x+power.passage.w/2)*4;
 for(const p of plan){
  assert.ok([...p.position,...p.size,p.roll].every(Number.isFinite));
  assert.ok(p.size.every(v=>v>0));
  // Ground-attached raised equipment hugs existing solid building clearance;
  // suspended machinery remains above the playable standing/vehicle corridor.
  if(p.position[1]+p.size[1]/2>.3 && p.position[1]-p.size[1]/2<3.4){
   assert.equal(canStand(course,p.position[0]/4,p.position[2]/4,.16),false,`${p.role} is grounded in existing solid frontage`);
  }
 }
 const rail=plan.find(p=>p.role==='depot-hoist-rail');assert.equal(rail.position[0],center);assert.equal(rail.size[0],power.passage.w*4);
 const threshold=plan.find(p=>p.role==='depot-steel-threshold');assert.equal(threshold.position[2],frontZ-.5);
 for(let z=28;z<=117;z+=.2)assert.ok(canStand(course,43.4/4,z/4,.16),'original basement-return through-route');
 for(let z=frontZ+.8;z<96;z+=.2)assert.ok(canStand(course,center/4,z/4,.16),'original depot through-passage remains clear');
 assert.equal(JSON.stringify(course),saved);
});

test('frontage batches borrow original palette and geometry while disposing only owned instance views once',()=>{
 const materials=Object.fromEntries(['concrete','rust','dark','asphalt'].map(s=>[s,new THREE.MeshStandardMaterial()]));
 const unitBox=new THREE.BoxGeometry(),world={course:makeHarborCourse({openWorld:true}),root:new THREE.Group(),unitBox,materials,diagnostics:{}};
 let borrowed=0,views=0;unitBox.addEventListener('dispose',()=>borrowed++);for(const m of Object.values(materials))m.addEventListener('dispose',()=>borrowed++);
 const front=buildCoastalPortFrontage(world);
 assert.equal(front.diagnostics.draws,15);assert.equal(front.diagnostics.triangles,1428);
 for(const mesh of front.root.children){
  assert.ok(mesh.isInstancedMesh);assert.ok(Object.values(materials).includes(mesh.material));
  assert.equal(mesh.geometry.attributes.position,unitBox.attributes.position);
  assert.ok(mesh.boundingBox&&mesh.boundingSphere,'bounded chunks support native culling');
  mesh.geometry.addEventListener('dispose',()=>views++);
 }
 front.dispose();front.dispose();assert.equal(borrowed,0);assert.equal(views,15);assert.equal(front.root.parent,null);
 for(const m of Object.values(materials))m.dispose();unitBox.dispose();
});
