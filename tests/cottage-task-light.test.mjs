import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {createBuildingPlan} from '../assets/blackwater-kit/architecture.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';
import {buildBlackwaterPracticals} from '../assets/blackwater-kit/practicals.js';

test('five scavenging task fixtures stay anchored to ceilings and aim inside supported surfaces without shadow maps',()=>{
 const slice=makeHarborCourse({openWorld:true}).coastal.blackwaterSlice,parent=new THREE.Group(),materials=createBlackwaterMaterials();
 const lamps=buildBlackwaterPracticals(parent,slice,materials);
 try{
  const records=lamps.diagnostics.lights.filter(r=>r.scavengingTask);assert.equal(records.length,5);
  assert.equal(lamps.diagnostics.drawCalls,2);assert.equal(lamps.diagnostics.additionalShadowMaps,0);
  for(const record of records){
   const b=slice.buildings.find(b=>b.id===record.buildingId),f=createBuildingPlan(b).furniture.find(f=>f.id===record.supportId),light=lamps.lights.find(l=>l.name===record.name);
   const frame=new THREE.Matrix4().makeRotationY(b.yaw||0);frame.setPosition(b.x,b.y??.13,b.z);
   const target=new THREE.Vector3(...record.target).applyMatrix4(frame.clone().invert());
   assert.ok(Math.abs(target.x-f.position[0])<1e-7&&Math.abs(target.z-f.position[2])<1e-7);
   assert.ok(Math.abs(record.mountPosition[1]+.025-record.ceilingWorldY)<1e-7);
   assert.ok(record.fixtureLowestY>record.supportTopWorld+.6);
   assert.ok(light.position.distanceTo(light.target.position)<light.distance);assert.equal(light.castShadow,false);
  }
 }finally{lamps.dispose();materials.dispose();}
});

test('task lamp is supported and aimed at the real repair surface through house translation/yaw',()=>{
 const original=makeHarborCourse({openWorld:true}).coastal.blackwaterSlice.buildings.find(p=>p.label==='CAPE LODGE 75');
 for(const yaw of [0,Math.PI/2,Math.PI]){
  const house={...original,yaw},parent=new THREE.Group(),materials=createBlackwaterMaterials(),p=buildBlackwaterPracticals(parent,{buildings:[house]},materials);
  try{
   const light=p.lights[0],record=p.diagnostics.lights[0],desk=createBuildingPlan(house).furniture.find(d=>d.id==='resident-work-station');
   const frame=new THREE.Matrix4().makeRotationY(yaw);frame.setPosition(house.x,house.y,house.z);
   const localBase=new THREE.Vector3(...record.basePosition).applyMatrix4(frame.clone().invert());
   assert.ok(Math.abs(localBase.y-.022-(.08+desk.size[1]))<1e-8,'base bottom actually touches desk');
   for(const axis of [0,2])assert.ok(Math.abs(localBase.getComponent(axis)-desk.position[axis])+record.baseRadius<desk.size[axis]/2);
   const localTarget=light.target.position.clone().applyMatrix4(frame.clone().invert());
   for(const axis of [0,2])assert.ok(Math.abs(localTarget.getComponent(axis)-desk.position[axis])<desk.size[axis]/2,'beam target lies over actual desktop');
   assert.ok(light.position.distanceTo(light.target.position)<light.distance);assert.equal(light.castShadow,false);
   assert.equal(p.diagnostics.additionalShadowMaps,0);assert.equal(p.diagnostics.drawCalls,2);
   assert.equal(light.target.parent,p.root);assert.equal(p.diagnostics.lightCount,2);
   assert.ok(p.diagnostics.triangles<750);
  }finally{p.dispose();materials.dispose();}
 }
});

test('one authored address adds a light but no fixture batch; borrowed materials survive repeat teardown',()=>{
 const slice=makeHarborCourse({openWorld:true}).coastal.blackwaterSlice,parent=new THREE.Group(),materials=createBlackwaterMaterials();
 let borrowed=0;for(const m of Object.values(materials))m.addEventListener('dispose',()=>borrowed++);
 const all=buildBlackwaterPracticals(parent,slice,materials),base=buildBlackwaterPracticals(parent,{buildings:slice.buildings.filter(p=>p.label!=='CAPE LODGE 75')},materials);
 assert.equal(all.diagnostics.lightCount,base.diagnostics.lightCount+2);assert.equal(all.diagnostics.lightCount,12);
 assert.equal(all.diagnostics.drawCalls,base.diagnostics.drawCalls);assert.equal(all.diagnostics.additionalShadowMaps,0);
 assert.equal(all.diagnostics.lights.filter(l=>l.name.includes('radio repair')).length,1);
 all.dispose();all.dispose();base.dispose();assert.equal(parent.children.length,0);assert.equal(borrowed,0);materials.dispose();
});

test('hardware task lamp touches the real bench and lights the repair card, vise and tool board through yaw',()=>{
 const original=makeHarborCourse({openWorld:true}).coastal.blackwaterSlice.buildings.find(p=>/hardware/i.test(p.label));
 for(const yaw of [0,Math.PI/2,Math.PI]){
  const house={...original,yaw},parent=new THREE.Group(),materials=createBlackwaterMaterials(),p=buildBlackwaterPracticals(parent,{buildings:[house]},materials);
  try{
   const record=p.diagnostics.lights.find(l=>l.name.includes('HARDWARE')),light=p.lights.find(l=>l.name===record?.name),bench=createBuildingPlan(house).furniture.find(d=>d.id==='repair-bench');assert.ok(light);
   const frame=new THREE.Matrix4().makeRotationY(yaw);frame.setPosition(house.x,house.y,house.z);
   const base=new THREE.Vector3(...record.basePosition).applyMatrix4(frame.clone().invert()),top=.08+bench.size[1];
   assert.ok(Math.abs(base.y-.022-top)<1e-8);
   for(const axis of [0,2])assert.ok(Math.abs(base.getComponent(axis)-bench.position[axis])+record.baseRadius<bench.size[axis]/2);
   const beam=light.target.position.clone().sub(light.position).normalize(),[x,,z]=bench.position;
   for(const point of [[x+.02,top+.012,z+.12],[x+bench.size[0]*.28,top+.235,z+.03],[x-bench.size[0]*.30,top+.30,z-bench.size[2]/2+.12]]){
    const delta=new THREE.Vector3(...point).applyMatrix4(frame).sub(light.position);assert.ok(delta.length()<light.distance);assert.ok(delta.normalize().angleTo(beam)<light.angle-.05);
   }
   assert.equal(light.castShadow,false);assert.equal(p.diagnostics.additionalShadowMaps,0);assert.equal(p.diagnostics.drawCalls,2);
  }finally{p.dispose();materials.dispose();}
 }
});

test('upper listening lamp touches the desk, includes map and folio cues and cannot reach the lower floor',()=>{
 const original=makeHarborCourse({openWorld:true}).coastal.blackwaterSlice.buildings.find(p=>p.label==='CAPE LODGE 75');
 for(const yaw of [0,Math.PI/2,Math.PI]){
  const house={...original,yaw},plan=createBuildingPlan(house),parent=new THREE.Group(),materials=createBlackwaterMaterials(),p=buildBlackwaterPracticals(parent,{buildings:[house]},materials);
  try{
   const record=p.diagnostics.lights.find(l=>l.name.includes('upstairs listening')),light=p.lights.find(l=>l.name===record?.name);assert.ok(light);
   const frame=new THREE.Matrix4().makeRotationY(yaw);frame.setPosition(house.x,house.y,house.z);const inverse=frame.clone().invert();
   const localBase=new THREE.Vector3(...record.basePosition).applyMatrix4(inverse),desk=plan.structure.solids.find(s=>s.id===record.supportId),top=desk.position[1]+desk.size[1]/2;
   assert.ok(Math.abs(localBase.y-.018-top)<1e-8,'the actual36mm base bottom touches the shared finite desktop');
   for(const axis of [0,2])assert.ok(Math.abs(localBase.getComponent(axis)-desk.position[axis])+record.baseRadius<desk.size[axis]/2);
   const localTarget=light.target.position.clone().applyMatrix4(inverse);
   assert.ok(localTarget.distanceTo(new THREE.Vector3(...plan.upstairsArt.workstation.lightingTarget))<1e-8);
   const beam=light.target.position.clone().sub(light.position).normalize();
   for(const localPoint of [plan.upstairsArt.workstation.listeningSurfaceCenter,plan.upstairsArt.routeFolio.interactionPoint]){
    const delta=new THREE.Vector3(...localPoint).applyMatrix4(frame).sub(light.position);
    assert.ok(delta.length()<light.distance,'both supported cues are inside the finite lamp range');
    assert.ok(delta.normalize().angleTo(beam)<light.angle-.05,'both centres are within the actual cone with angular margin');
   }
   assert.ok(light.position.distanceTo(light.target.position)<light.distance);
   assert.ok(light.position.y-((house.y??.13)+plan.structure.floors[0].top)>light.distance,'the finite range excludes the lower floor');
   assert.equal(light.castShadow,false);assert.equal(p.diagnostics.additionalShadowMaps,0);assert.equal(p.diagnostics.drawCalls,2);
  }finally{p.dispose();materials.dispose();}
 }
});
