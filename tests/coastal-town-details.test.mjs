import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {makeCoastalTownDetails,buildCoastalTownDetails,townPlantGeometry,townReelFlangeGeometry} from '../coastal-town-details.js';

test('address communities append exact collision proxies and retain all door and road routes',()=>{
 const course=makeHarborCourse({openWorld:true}),before=JSON.stringify(course),plan=makeCoastalTownDetails(course.coastal);
 assert.equal(JSON.stringify(course),before,'planning is read only');
 assert.deepEqual(plan,course.coastal.townDetails);assert.equal(plan.communities.length,15);
 assert.equal(new Set(plan.communities.map(p=>p.kind)).size,9);
 assert.deepEqual(course.obstacles.filter(p=>p.id.startsWith('town-detail-')),plan.obstacles,'append shared authoritative plan');
 for(const community of plan.communities){
  assert.equal(canStand(course,community.x/4,community.z/4,.16),false,'new solid frontage community blocks its footprint');
  const lot=course.coastal.buildings.find(b=>b.id===community.buildingId);
  const p=plan.parts.find(p=>p.communityId===community.id);
  if(lot&&community.kind!=='timber-cutting'){const s=Math.sin(lot.yaw),c=Math.cos(lot.yaw),localFront=(community.x-lot.x)*s+(community.z-lot.z)*c;
   assert.ok(Math.abs(localFront-(lot.depth/2+.8))<1e-9,'actual authored wall owns frontage depth');}
  assert.ok(p);
  const obstacle=community.obstacle;
  for(const road of course.coastal.roads){
   assert.ok(obstacle.maxX*4<=road.x-road.width/2||obstacle.minX*4>=road.x+road.width/2||obstacle.maxY*4<=road.z-road.depth/2||obstacle.minY*4>=road.z+road.depth/2,'community stays out of carriageway');
  }
 }
 for(const interior of course.coastal.blackwaterSlice.interiors){
  for(const [a,b] of [[interior.route.frontApproach,interior.door],[interior.route.rearApproach,interior.rearDoor]].filter(pair=>pair.every(Boolean))){
   for(let t=0;t<=1;t+=.125)assert.ok(canStand(course,(a.x+(b.x-a.x)*t)/4,(a.z+(b.z-a.z)*t)/4,.16),`${interior.id} doorway stays reachable`);
  }
 }
 for(let z=28;z<=117;z+=.5)assert.ok(canStand(course,43.4/4,z/4,.16),'basement return preserved');
 for(let z=62;z<=108;z+=.5)for(const x of [61,64,67])assert.ok(canStand(course,x/4,z/4,.16),'Power Depot mouth and loading axis preserved');
 for(const part of plan.parts)assert.ok([...part.position,...part.size,part.yaw,part.roll].every(Number.isFinite));
});

test('town kit has bounded shared batches and releases owned resources exactly once',()=>{
 const box=new THREE.BoxGeometry(),rust=new THREE.MeshStandardMaterial(),dark=new THREE.MeshStandardMaterial();
 const world={course:makeHarborCourse({openWorld:true}),root:new THREE.Group(),unitBox:box,materials:{rust,dark},diagnostics:{}};
 let borrowed=0,owned=0;for(const r of [box,rust,dark])r.addEventListener('dispose',()=>borrowed++);
 const kit=buildCoastalTownDetails(world);
 assert.equal(kit.diagnostics.communities,15);assert.equal(kit.diagnostics.colliders,15);
 assert.ok(kit.diagnostics.draws<=30);assert.ok(kit.diagnostics.triangles<=40000);
 const ownedResources=new Set();
 for(const mesh of kit.root.children){
  assert.ok(mesh.boundingBox&&mesh.boundingSphere);assert.ok(mesh.userData.coastalInstanceCapacity>=mesh.count);
  ownedResources.add(mesh.geometry);if(![rust,dark].includes(mesh.material))ownedResources.add(mesh.material);
 }
 for(const r of ownedResources)r.addEventListener('dispose',()=>owned++);
 kit.dispose();kit.dispose();assert.equal(borrowed,0);assert.equal(owned,ownedResources.size);assert.equal(kit.root.parent,null);
 for(const r of [box,rust,dark])r.dispose();
});

test('garden growth has rooted stems and thin folded leaves, with constructed reel boards',()=>{
 for(const factory of [townPlantGeometry,townReelFlangeGeometry]){
  const geometry=factory();assert.ok(geometry.boundingBox&&geometry.boundingSphere);
  for(const attribute of Object.values(geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
  const normals=geometry.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))>.99);
  geometry.dispose();
 }
 const flange=townReelFlangeGeometry(),material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(flange,material);
 mesh.updateMatrixWorld(true);
 for(const side of [-1,1]){
  const ray=new THREE.Raycaster(new THREE.Vector3(.28,side*2,.1),new THREE.Vector3(0,-side,0));
  const hit=ray.intersectObject(mesh)[0];assert.ok(hit,'both external board faces remain visible with ordinary front-face culling');assert.ok(hit.face.normal.y*side>.99);
 }
 flange.dispose();material.dispose();
 const course=makeHarborCourse({openWorld:true}),p=course.coastal.townDetails;
 for(const community of p.communities.filter(c=>c.kind==='garden')){
  const growth=p.parts.filter(part=>part.communityId===community.id&&part.geometry==='leaf');
  assert.ok(growth.length>=10);for(const plant of growth)assert.ok(Math.abs(plant.position[1]-plant.size[1]/2-.32)<1e-9,'all growth stems root in actual soil surface');
 }
 for(const reel of p.parts.filter(part=>part.role==='reel-board-flange'))assert.equal(reel.geometry,'flange');
 assert.ok(p.parts.some(part=>part.geometry==='cable'));
 const net=p.communities.find(c=>c.kind==='net-repair');assert.equal(net.x,27);assert.equal(net.z,69.3);
 assert.ok(p.parts.some(part=>part.communityId===net.id&&part.role==='net-frame-heading'&&part.position[1]>2.6),'working net frame reads above Netmakers low north wall');
});
