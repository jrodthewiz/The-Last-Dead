import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalIndustrialFrontage} from '../coastal-industrial-frontage.js';

const coastal=()=>({buildings:makeBlackwaterDistrict(makeCoastalNeighborhoods()).lots});
test('industrial sequence belongs to actual workshop and tall hall with an unobstructed receiving court',()=>{
 const world=coastal(),before=JSON.stringify(world),plan=makeCoastalIndustrialFrontage(world);
 assert.equal(JSON.stringify(world),before);assert.deepEqual(makeCoastalIndustrialFrontage(world),plan);
 assert.deepEqual(plan.spaces.map(s=>s.role),['receiving','covered-repair','tall-hall']);
 const court=plan.spaces[0],repair=plan.spaces[1],hall=plan.spaces[2];
 assert.deepEqual(court.bounds,{minX:288,maxX:292,minZ:118.25,maxZ:128});
 assert.equal(court.clearWidth,4);assert.equal(court.clearHeight,5.2);
 assert.equal(repair.bounds.maxX-repair.bounds.minX,10);assert.equal(hall.bounds.maxX-hall.bounds.minX,5);
 assert.ok(hall.clearHeight>repair.clearHeight);assert.equal(hall.height,12);
 assert.equal(plan.diagnostics.groundSupports,0);assert.equal(plan.diagnostics.newColliders,0);
 for(const p of plan.parts){
  assert.equal(p.geometry,'box');assert.ok(['metal','dark'].includes(p.slot));
  assert.ok([...p.position,...p.size,p.roll,p.yaw,p.tilt].every(Number.isFinite));
  assert.ok(p.size.every(v=>v>0));
  const box=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));
  const pose=new THREE.Object3D();pose.position.fromArray(p.position);pose.scale.fromArray(p.size);pose.rotation.set(p.roll,p.yaw,p.tilt);pose.updateMatrix();box.applyMatrix4(pose.matrix);
  assert.ok(box.min.z>118,'all structures stay outside the real road');
  if(box.min.x<292&&box.max.x>288)assert.ok(box.min.y>=5.2-1e-6,'the entire receiving passage retains overhead clearance');
  assert.ok(box.max.x<301,'the actual hall front door x306 remains clear');
  if(p.communityId===repair.id)assert.ok(box.max.x<275,'the workshop front door x278 remains clear');
 }
 assert.ok(plan.diagnostics.triangles<=1680);assert.equal(plan.diagnostics.triangles,plan.parts.length*12);
 const bins=new Set(plan.parts.map(p=>`${p.slot}/${Math.floor(p.position[0]/96)}/${Math.floor(p.position[2]/96)}`));assert.ok(bins.size<=4);
});

test('transfer truss and canopy have bearing anchors and unequal open roof bays',()=>{
 const plan=makeCoastalIndustrialFrontage(coastal());
 const webs=plan.parts.filter(p=>p.role==='transfer-diagonal-web');assert.equal(webs.length,8);
 for(const p of webs){
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3().fromArray(p.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(p.roll,p.yaw,p.tilt)),new THREE.Vector3().fromArray(p.size));
  const ends=[-.5,.5].map(y=>new THREE.Vector3(0,y,0).applyMatrix4(matrix));
  assert.ok(ends.every(v=>Math.abs(v.y-5.30)<1e-6||Math.abs(v.y-6.43)<1e-6),'diagonal ends meet the actual upper/lower chords');
 }
 const roofs=plan.parts.filter(p=>p.role==='repair-folded-roof-sheet');assert.equal(new Set(roofs.map(p=>p.size[0])).size,3);
 assert.equal(plan.parts.filter(p=>p.role==='repair-triangular-cantilever').length,3);
 assert.equal(plan.parts.filter(p=>p.role==='transfer-wall-bearing-plate').length,4);
 assert.equal(plan.parts.filter(p=>p.role==='hall-loading-knee').length,2);
 assert.deepEqual(makeCoastalIndustrialFrontage({buildings:[]}).parts,[]);
});
