import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {makeMaritimeKit} from '../assets/blackwater-kit/maritime-vehicles.js';
import {buildCoastalMaritime} from '../coastal-maritime-visuals.js';

test('parked vehicles retain open approaches and moorings meet real quay bollards',()=>{
 const course=makeHarborCourse({openWorld:true}),layout=course.coastal.maritime;
 assert.equal(layout.boats.length,3);assert.equal(layout.cars.length,8);
 assert.doesNotThrow(()=>JSON.stringify(layout));
 for(const p of layout.boats){assert.ok(p.bounds.minZ>120);for(const m of p.mooring){assert.equal(m.z,119.3);assert.equal((m.x-5)%8,0);}}
 for(const p of layout.cars){const b=p.bounds;assert.deepEqual(course.obstacles.find(o=>o.id===p.id),{id:p.id,minX:b.minX/4,maxX:b.maxX/4,minY:b.minZ/4,maxY:b.maxZ/4});for(const o of course.obstacles.filter(o=>o.id!==p.id))assert.ok(b.maxX<=o.minX*4||b.minX>=o.maxX*4||b.maxZ<=o.minY*4||b.minZ>=o.maxY*4);for(let z=Math.floor(b.minZ/4);z<=Math.floor(b.maxZ/4);z++)for(let x=Math.floor(b.minX/4);x<=Math.floor(b.maxX/4);x++)assert.ok(!course.cells[z*course.w+x].every(v=>v===1));assert.ok(Math.hypot(p.x-course.vehicle.x*4,p.z-course.vehicle.y*4)>8);}
});
test('hull profiles taper to their bows and face outward with closed deck',()=>{
 for(const kind of ['trawler','launch','skiff']){
  const parts=makeMaritimeKit(kind),hull=parts.get(kind==='trawler'?'red':'paint')[0];
  const p=hull.attributes.position,n=hull.attributes.normal;
  assert.ok(n.getZ(0)>0,'port hull faces the water');assert.ok(n.getY(5)<0,'keel faces down');
  assert.ok(Math.abs(p.getZ(55))<Math.abs(p.getZ(22))*.08,'fine bow compared with broad midship');
  const deck=parts.get('wood')[0];assert.ok(deck.attributes.normal.getY(0)>.7,'deck faces sky');
  for(const list of parts.values())for(const g of list){for(const value of g.attributes.position.array)assert.ok(Number.isFinite(value));g.dispose();}
 }
});
test('all eleven detailed static props share nine submissions and release owned resources exactly once',()=>{
 const course=makeHarborCourse({openWorld:true});assert.ok(course.coastal.maritime);
 const world={course,root:new THREE.Group(),diagnostics:{}},art=buildCoastalMaritime(world);
 assert.equal(art.diagnostics.drawCalls,9);assert.ok(art.diagnostics.triangles<40000);assert.equal(art.diagnostics.cars,8);
 let gd=0,md=0;for(const mesh of art.root.children){mesh.geometry.addEventListener('dispose',()=>gd++);mesh.material.addEventListener('dispose',()=>md++);assert.ok(mesh.geometry.boundingSphere.radius>0);}
 art.dispose();art.dispose();assert.equal(gd,9);assert.equal(md,9);assert.equal(world.root.children.length,0);
});
