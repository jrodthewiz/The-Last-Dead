import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalTownDetails,buildCoastalTownDetails} from '../coastal-town-details.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
const coastal=()=>({buildings:makeBlackwaterDistrict(makeCoastalNeighborhoods()).lots});
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const pose=p=>new THREE.Matrix4().compose(new THREE.Vector3(...p.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(p.roll,p.yaw,p.tilt||0)),new THREE.Vector3(...p.size));
test('cable jig appends without changing any frozen-v38 part, community or collider',()=>{
 const p=makeCoastalTownDetails(coastal());
 assert.equal(digest(p.parts.slice(0,575)),'8f231156520a9a2e7b7da08f828ccbf13735c54aa1475513c1e2def8c9039677');
 assert.equal(digest(p.communities),'062661bc9e6f71ffc6e5672f4a7da5893ee8a1fd9a6dd904b29dc94b0a805703');
 assert.equal(digest(p.obstacles),'b8a491e8ea49d73ffaed4d791735081a334894042b793f87e94862a7ec601693');
 assert.deepEqual(p.parts.slice(575),p.cableRepair.parts);assert.equal(p.cableRepair.diagnostics.newColliders,0);
});
test('jig bears on actual pallet planks and winding feeds meet carried compression sleeve mouths',()=>{
 const p=makeCoastalTownDetails(coastal()),jig=p.cableRepair;
 const community=p.communities.find(c=>c.buildingId==='coast-lot-2-1-0-2'&&c.kind==='repair'),o=community.obstacle;
 const oldBoards=p.parts.slice(0,575).filter(p=>p.communityId===community.id&&p.role==='pallet-top-plank');
 for(const foot of jig.parts.filter(p=>p.role==='splice-jig-pallet-foot')){
  const bottom=foot.position[1]-foot.size[1]/2;assert.ok(Math.abs(bottom-.475)<1e-9);
  assert.ok(oldBoards.some(b=>{const box=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(pose(b));return Math.abs(box.max.y-bottom)<1e-9&&foot.position[0]>=box.min.x&&foot.position[0]<=box.max.x&&foot.position[2]>=box.min.z&&foot.position[2]<=box.max.z;}),'each jig foot bears on an existing board');
 }
 for(const part of jig.parts){
  const box=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(pose(part));
  assert.ok(box.min.x>=o.minX*4&&box.max.x<=o.maxX*4&&box.min.z>=o.minY*4&&box.max.z<=o.maxY*4,'all added structure remains inside existing proxy');
  assert.ok([...part.position,...part.size,part.roll,part.tilt].every(Number.isFinite));
 }
 const leads=jig.parts.filter(p=>p.role==='reel-to-splice-cable');assert.equal(leads.length,2);
 leads.forEach((p,i)=>{const m=pose(p),a=new THREE.Vector3(0,-.5,0).applyMatrix4(m),b=new THREE.Vector3(0,.5,0).applyMatrix4(m);assert.ok(a.distanceTo(new THREE.Vector3(...jig.feeds[i].from))<1e-8);assert.ok(b.distanceTo(new THREE.Vector3(...jig.feeds[i].to))<1e-8);});
 const sleeve=jig.parts.find(p=>p.role==='splice-jig-compression-sleeve'),m=pose(sleeve);
 const mouths=[-.5,.5].map(y=>new THREE.Vector3(0,y,0).applyMatrix4(m));
 jig.sleeve.mouths.forEach(a=>assert.ok(mouths.some(b=>b.distanceTo(new THREE.Vector3(...a))<1e-8)));
});
test('same original camera sees an ordinary-sized carried operation within unchanged town resource budget',()=>{
 const c=coastal();c.townDetails=makeCoastalTownDetails(c);
 const camera=new THREE.PerspectiveCamera(75,1.6,.01,1000);camera.position.set(299,1.7,114);camera.lookAt(293.8,.9,119.2);camera.updateMatrixWorld();
 const ends=[[292.7,1.65,119.68],[294.9,1.65,119.68]].map(v=>new THREE.Vector3(...v).project(camera));assert.ok(Math.abs(ends[0].x-ends[1].x)*640>100,'frame spans over100 original-view pixels');
 assert.ok(ends.every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1));
 const box=new THREE.BoxGeometry(),rust=new THREE.MeshStandardMaterial(),dark=new THREE.MeshStandardMaterial(),world={course:{coastal:c},unitBox:box,materials:{rust,dark},root:new THREE.Group(),diagnostics:{}};
 const kit=buildCoastalTownDetails(world);assert.equal(kit.diagnostics.triangles,39612+c.townDetails.cableRepair.diagnostics.triangles);assert.ok(kit.diagnostics.triangles<=40000&&kit.diagnostics.draws<=30);assert.equal(kit.diagnostics.ownedMaterials,2);assert.equal(kit.diagnostics.ownedPrimitives,5);
 kit.dispose();box.dispose();rust.dispose();dark.dispose();
});
test('all existing shop routes and basement return remain reachable',()=>{
 const c=makeHarborCourse({openWorld:true});assert.equal(c.coastal.townDetails.obstacles.length,15);
 for(const i of c.coastal.blackwaterSlice.interiors)for(const [a,b]of [[i.route.frontApproach,i.door],[i.route.rearApproach,i.rearDoor]].filter(p=>p.every(Boolean)))for(let t=0;t<=1;t+=.125)assert.ok(canStand(c,(a.x+(b.x-a.x)*t)/4,(a.z+(b.z-a.z)*t)/4,.16),i.id);
 for(let z=28;z<=117;z+=.25)assert.ok(canStand(c,43.4/4,z/4,.16));
});
