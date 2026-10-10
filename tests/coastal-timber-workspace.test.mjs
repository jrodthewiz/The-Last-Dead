import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalTimberWorkspace,TIMBER_WORKSPACE_BOUNDS,TIMBER_WORKSPACE_CONTACTS,TIMBER_BOARD_DRAG} from '../coastal-timber-workspace.js';
import {makeCoastalTownDetails,buildCoastalTownDetails} from '../coastal-town-details.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
const coastal=()=>({buildings:makeBlackwaterDistrict(makeCoastalNeighborhoods()).lots});
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
test('workspace appends to exact original town records and retains original industrial parts',()=>{
 const c=coastal(),before=JSON.stringify(c),p=makeCoastalTownDetails(c);
 assert.equal(JSON.stringify(c),before);
 // These pre-change hashes protect every original pose, ID and proxy in order,
 // including the 65 accepted industrial parts; new geometry is appended only.
 assert.equal(digest(p.parts.slice(0,534)),'466e5c30f50f109f954708d3f8a5b826cb65bead0d9c3b6e2a0f8364acb8a1a2');
 assert.equal(digest(p.communities.slice(0,14)),'8d97477b58793ffe5c9b3420c105169c5ef24384e90e1c70c28de6f2e8f10b42');
 assert.equal(digest(p.obstacles.slice(0,14)),'23491e0e3a6fe15e220beb4963f03c46543f438d25199e729ac1f1bfa3812497');
 assert.deepEqual(p.parts.slice(534,575),p.timberWorkspace.parts);assert.equal(p.industrialFrontage.parts.length,65);
 assert.equal(p.communities.length,15);assert.equal(p.obstacles.length,15);
 assert.ok(Object.isFrozen(TIMBER_WORKSPACE_BOUNDS)&&Object.isFrozen(TIMBER_WORKSPACE_CONTACTS)&&TIMBER_WORKSPACE_CONTACTS.every(Object.isFrozen)&&TIMBER_BOARD_DRAG.every(Object.isFrozen));
 assert.deepEqual(makeCoastalTimberWorkspace({buildings:[]}).parts,[]);
});
test('bench is carried by actual ground feet and canopy terminates in the existing wall',()=>{
 const p=makeCoastalTimberWorkspace(coastal()),proxy=p.bounds;
 for(const part of p.parts){
  assert.equal(part.geometry,'box');assert.ok([...part.position,...part.size,part.roll,part.tilt].every(Number.isFinite));
  const pose=new THREE.Object3D();pose.position.fromArray(part.position);pose.scale.fromArray(part.size);pose.rotation.set(part.roll,part.yaw,part.tilt);pose.updateMatrix();
  const box=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(pose.matrix);
  assert.ok(box.max.z<170,'outside road');assert.ok(box.max.x<332,'clear adjoining four metre passage');
  if(part.role.startsWith('cutting-bench')){
   assert.ok(box.min.x>=proxy.minX-1e-6&&box.max.x<=proxy.maxX+1e-6&&box.min.z>=proxy.minZ-1e-6&&box.max.z<=proxy.maxZ+1e-6,'all bench surfaces fit authoritative proxy');
   assert.ok(box.min.y>=.135-1e-6,'supported above actual paving');
  }
  if(part.role==='timber-threshold-wall-bearing')assert.ok(box.max.z<168,'bearing embeds inside original wall');
 }
 const feet=p.parts.filter(p=>p.role==='cutting-bench-ground-foot');assert.equal(feet.length,4);
 assert.deepEqual(feet.map(p=>[p.position[0],p.position[2]]),TIMBER_WORKSPACE_CONTACTS);
 for(const f of feet)assert.ok(Math.abs(f.position[1]-f.size[1]/2-.135)<1e-9);
 assert.equal(p.parts.filter(p=>p.role==='timber-threshold-braced-knee').length,3);
 assert.ok(p.parts.length<=55&&p.diagnostics.triangles<=660);
});
test('new bench blocks its real footprint while every shop approach and passing lane remains clear',()=>{
 const course=makeHarborCourse({openWorld:true}),workspace=course.coastal.townDetails.timberWorkspace;
 assert.equal(course.obstacles.filter(o=>o.id==='town-detail-works-56-cutting-bench').length,1);
 assert.ok(!canStand(course,327.15/4,168.725/4,.16));
 assert.deepEqual(course.obstacles.find(o=>o.id==='town-detail-works-56-cutting-bench'),workspace.obstacles[0]);
 for(const interior of course.coastal.blackwaterSlice.interiors)for(const [a,b]of [[interior.route.frontApproach,interior.door],[interior.route.rearApproach,interior.rearDoor]].filter(pair=>pair.every(Boolean)))
  for(let t=0;t<=1;t+=.125)assert.ok(canStand(course,(a.x+(b.x-a.x)*t)/4,(a.z+(b.z-a.z)*t)/4,.16),interior.id+' route stays open');
 for(let z=168;z<174;z+=.25)assert.ok(canStand(course,334/4,z/4,.16),'neighbor passage axis');
 for(let x=324;x<336;x+=.25)assert.ok(canStand(course,x/4,170.4/4,.16),'roadside passing strip');
});
test('workspace reuses town batches within the unchanged resource budget',()=>{
 const c=coastal();c.townDetails=makeCoastalTownDetails(c);
 const box=new THREE.BoxGeometry(),rust=new THREE.MeshStandardMaterial(),dark=new THREE.MeshStandardMaterial();
 const world={course:{coastal:c},unitBox:box,materials:{rust,dark},root:new THREE.Group(),diagnostics:{}};
 const kit=buildCoastalTownDetails(world);assert.ok(kit.diagnostics.draws<=30);assert.ok(kit.diagnostics.triangles<=40000);
 assert.equal(kit.diagnostics.triangles,39120+c.townDetails.timberWorkspace.diagnostics.triangles+c.townDetails.cableRepair.diagnostics.triangles);
 assert.equal(kit.diagnostics.ownedMaterials,2);assert.equal(kit.diagnostics.ownedPrimitives,5);
 let borrowed=0;for(const r of [box,rust,dark])r.addEventListener('dispose',()=>borrowed++);
 kit.dispose();kit.dispose();assert.equal(borrowed,0);
 for(const r of [box,rust,dark])r.dispose();
});
