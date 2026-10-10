import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {makeCoastalWorldPolish,buildCoastalWorldPolish} from '../coastal-world-polish.js';

const course=makeHarborCourse({openWorld:true,lowTide:true,cityLootSeed:7317});
test('street and shore furniture has exact collision while roads and entrances remain clear',()=>{
 const plan=course.coastal.polish;
 assert.ok(plan.stations.filter(p=>p.kind==='shore').length>=10);
 assert.ok(plan.stations.filter(p=>p.kind!=='shore').length>=20);
 assert.ok(plan.drains.length>=40);
 assert.deepEqual(makeCoastalWorldPolish(course),plan,'stable authored placements');
 for(const station of plan.stations)assert.equal(canStand(course,station.x/4,station.z/4,.12),false,station.id);
 for(const road of course.coastal.roads){
  const horizontal=road.width>road.depth,length=horizontal?road.width:road.depth;
  for(let t=-length/2+2;t<length/2-2;t+=2){
   const x=road.x+(horizontal?t:0),z=road.z+(horizontal?0:t);
   const close=plan.obstacles.some(o=>x/4>o.minX-.2&&x/4<o.maxX+.2&&z/4>o.minY-.2&&z/4<o.maxY+.2);
   assert.equal(close,false,'road center remains clear of new furniture');
  }
 }
 for(const interior of course.coastal.blackwaterSlice.interiors)for(const [a,b]of [[interior.route.frontApproach,interior.door],[interior.route.rearApproach,interior.rearDoor]].filter(pair=>pair.every(Boolean)))for(let t=0;t<=1;t+=.125)assert.ok(canStand(course,(a.x+(b.x-a.x)*t)/4,(a.z+(b.z-a.z)*t)/4,.16),interior.id);
 for(let z=28;z<118;z+=.5)assert.ok(canStand(course,43.4/4,z/4,.16),'customs street remains open');
});
test('extra detail stays bounded and reuses spatially grouped geometry',()=>{
 const materials=Object.fromEntries(['dark','rust','coastStone','coastWhite','coastRed'].map(k=>[k,new THREE.MeshStandardMaterial()]));
 const world={course,materials,root:new THREE.Group(),unitBox:new THREE.BoxGeometry(1,1,1),diagnostics:{}};
 const result=buildCoastalWorldPolish(world);
 assert.ok(result.drawCalls<100);assert.ok(result.triangles<50000);
 assert.equal(world.root.children.length,result.drawCalls);assert.ok(world.root.children.every(m=>m.isInstancedMesh));
 for(const mesh of world.root.children){assert.ok(Number.isFinite(mesh.boundingSphere.radius));mesh.dispose();}
 world.unitBox.dispose();Object.values(materials).forEach(m=>m.dispose());
});
test('six furnished service rooms retain their entry aisle and searchable cache',()=>{
 for(const room of course.harborRooms){
  course.activeInterior=room;
  assert.ok(room.details.parts.length>=40);assert.ok(canStand(course,room.spawn.x,room.spawn.y,.16));
  assert.ok(canStand(course,room.cache.x-.4,room.cache.y,.1));
  const rack=room.details.obstacles[0];assert.equal(canStand(course,(rack.minX+rack.maxX)/2,(rack.minY+rack.maxY)/2,.1),false);
 }
 course.activeInterior=null;
});
