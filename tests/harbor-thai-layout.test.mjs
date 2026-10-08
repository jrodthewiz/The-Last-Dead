import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {makeHarborThaiLayout,footprintFor} from '../harbor-thai-layout.js';
test('Thai district is deterministic, bounded and keeps existing interaction points clear',()=>{
 const course=makeHarborCourse(),a=makeHarborThaiLayout(course),b=makeHarborThaiLayout(course);
 assert.deepEqual(a,b);assert.equal(a.buildings.length,7);assert.ok(a.props.length>=40&&a.props.length<=70);
 assert.equal(new Set([...a.props,...a.buildings].map(p=>p.id)).size,a.props.length+a.buildings.length);
 const points=[course.playerSpawn,course.exit,course.vehicle,...course.scavengerPickups,...course.weaponPickups,...course.harborSpawns];
 for(const f of a.colliders){
  assert.ok(f.minX>0&&f.maxX<128&&f.minZ>0&&f.maxZ<120,f.id);
  for(const p of points){const x=p.x*4,z=p.y*4;assert.ok(x<f.minX-.6||x>f.maxX+.6||z<f.minZ-.6||z>f.maxZ+.6,`${f.id} obstructs interaction ${x},${z}`);}
 }
 for(const z of [73,80,86,92,96])for(const x of [61,64,67])for(const f of a.colliders)assert.ok(x<f.minX||x>f.maxX||z<f.minZ||z>f.maxZ,'Power Cut remains open');
 for(const x of [21,24,27])for(const f of a.colliders)assert.ok(x<f.minX||x>f.maxX||96<f.minZ||96>f.maxZ,'Netmakers gate remains open');
});
test('quarter-turn bounds rotate vehicle length into road axis',()=>{
 const f=footprintFor({id:'test',x:10,z:20,width:2,depth:6,yaw:Math.PI/2});
 assert.equal(f.minX,7);assert.equal(f.maxX,13);assert.equal(f.minZ,19);assert.equal(f.maxZ,21);
});
