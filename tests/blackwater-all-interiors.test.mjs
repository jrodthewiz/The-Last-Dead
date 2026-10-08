import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
import {createModel,createBuildingPlan,architectureColliders} from '../assets/blackwater-kit/architecture.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';
import {canStand,castRay} from '../engine.js';

test('all ninety-four coast lots retain the sixteen named Blackwater plans and serialized openings',()=>{
 const slice=makeBlackwaterDistrict(makeCoastalNeighborhoods()),saved=JSON.parse(JSON.stringify(slice.interiors));
 assert.equal(saved.length,94);assert.equal(new Set(saved.map(b=>b.id)).size,94);assert.equal(slice.downtownBuildingIds.length,16);
 const purposes=slice.buildings.filter(b=>slice.downtownBuildingIds.includes(b.id)).map(b=>createBuildingPlan(b).purpose.id);
 assert.equal(new Set(purposes).size,16,'each commercial/residential address has its own intended use');
 for(const b of saved){
  assert.equal(b.door.width,4);assert.equal((b.door.x-2)%4,0,'front door is one authoritative cell wide');assert.equal(b.door.z%4,0);
  assert.equal(Boolean(b.rearDoor),b.id!==slice.shop.id);
  if(b.rearDoor){assert.equal((b.rearDoor.x-2)%4,0);assert.equal(b.rearDoor.z%4,0);}
 }
});

test('every coastal ground-floor route moves and sees through reciprocal engine openings',()=>{
 const c=makeHarborCourse({openWorld:true}),slice=c.coastal.blackwaterSlice;
 for(const b of slice.interiors){
  const start=b.route.frontApproach,end=b.route.rearApproach||b.route.backRoom,dx=end.x-start.x,dz=end.z-start.z,length=Math.hypot(dx,dz),steps=Math.ceil(length/.10);
  for(let i=0;i<=steps;i++){
   const x=start.x+dx*i/steps,z=start.z+dz*i/steps;
   assert.ok(canStand(c,x/4,z/4,.16),`${b.label} route blocked at ${x.toFixed(2)},${z.toFixed(2)}`);
  }
  const distance=length/4,hit=castRay(c,start.x/4,start.z/4,Math.atan2(dz,dx),distance);
  assert.ok(Math.abs(hit.dist-distance)<.00001,`${b.label} has uninterrupted doorway sight`);
  const minX=(b.x-b.width/2)/4,maxX=(b.x+b.width/2)/4,minY=(b.z-b.depth/2)/4,maxY=(b.z+b.depth/2)/4;
  for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++)assert.ok(!c.blocks.some(([bx,by])=>bx===x&&by===y),`${b.label} has no residual filled building cells`);
   const obstacles=c.obstacles.filter(o=>o.id.startsWith(`${b.id}-`)),source=slice.buildings.find(p=>p.id===b.id),planned=architectureColliders(source);
   const structure=c.coastal.structures.find(s=>s.id===b.id);
   if(structure){
    assert.equal(obstacles.length,0,'finite furniture replaces the scoped infinite proxies');
    const furniture=structure.solids.filter(s=>s.kind==='lower-furniture');
    assert.equal(furniture.length,planned.length-1,'shared stair/landing guard replaces the old left partition');
    for(const solid of furniture)assert.equal(canStand(c,(solid.minX+solid.maxX)/2,(solid.minY+solid.maxY)/2,.1),false,`${b.label} ${solid.id} remains solid downstairs`);
    const sofa=furniture.find(s=>s.id==='cape75-lower-living-sofa'),z=(sofa.minZ+sofa.maxZ)/2;
    const shot=castRay(c,b.x/4,(sofa.minY+sofa.maxY)/2,Math.atan2(0,(sofa.minX+sofa.maxX)/2-b.x/4),3,z);
    assert.equal(shot.solidId,sofa.id,'finite furniture stops shots at its real height');
    for(const sideX of [b.x-b.width/2,b.x+b.width/2])assert.equal(canStand(c,sideX/4,b.z/4,.1),false,`${b.label} finite side walls stay closed`);
    continue;
   }
  assert.equal(obstacles.length,planned.length,`${b.label} furniture authority count`);
  for(const local of planned){
   const obstacle=obstacles.find(o=>o.id===`${b.id}-${local.id}`);assert.ok(obstacle,`${b.label} ${local.id} exists`);
   assert.equal(canStand(c,(obstacle.minX+obstacle.maxX)/2,(obstacle.minY+obstacle.maxY)/2,.1),false,`${b.label} visible furniture is solid`);
  }
  const furnishing=planned.find(item=>!item.id.includes('partition')),cos=Math.cos(b.yaw),sin=Math.sin(b.yaw);
  const origin={x:b.x+b.doorOffset*cos+furnishing.z*sin,z:b.z-b.doorOffset*sin+furnishing.z*cos},toward={x:b.x+furnishing.x*cos+furnishing.z*sin,z:b.z-furnishing.x*sin+furnishing.z*cos};
  const furnitureShot=castRay(c,origin.x/4,origin.z/4,Math.atan2(toward.z-origin.z,toward.x-origin.x),Math.hypot(toward.x-origin.x,toward.z-origin.z)/4+.20);
  assert.equal(furnitureShot.obstacleId,`${b.id}-${furnishing.id}`,`${b.label} furnished surface stops the engine bullet ray`);
  // Clearing interiors must not silently turn their side walls into exits.
  for(const sideX of [b.x-b.width/2,b.x+b.width/2])assert.equal(canStand(c,sideX/4,b.z/4,.1),false,`${b.label} side boundary stays closed`);
 }
 for(let y=0;y<c.h;y++)for(let x=0;x<c.w;x++){
  const cell=c.cells[y*c.w+x];if(x<c.w-1)assert.equal(cell[1],c.cells[y*c.w+x+1][3]);if(y<c.h-1)assert.equal(cell[2],c.cells[(y+1)*c.w+x][0]);
 }
});

test('ninety-four furnished model apertures agree with plans, remain finite and preserve ownership budgets',()=>{
 const slice=makeBlackwaterDistrict(makeCoastalNeighborhoods()),shared=createBlackwaterMaterials();let borrowedDisposals=0,totalTriangles=0,totalDraws=0;
 for(const material of Object.values(shared))material.addEventListener('dispose',()=>borrowedDisposals++);
 try{
  for(const [i,b]of slice.buildings.entries()){
   const model=createModel({...b,seed:1400+i,materials:shared});
   try{
    assert.deepEqual(model.colliders,architectureColliders(b));
    assert.equal(model.diagnostics.plan.rooms.length,2);assert.ok(model.colliders.length>=3);
     const triangleBudget=model.diagnostics.plan.upstairsArt?45000:(slice.downtownBuildingIds.includes(b.id)?24000:36000);
     assert.ok(model.diagnostics.drawCalls<=15,`${b.label} merged draw budget`);assert.ok(model.diagnostics.triangleCount<triangleBudget,`${b.label} bounded detail with additional apartment storeys`);
    totalTriangles+=model.diagnostics.triangleCount;totalDraws+=model.diagnostics.drawCalls;
    const {min,max}=model.diagnostics.bounds;
    assert.ok(min[0]>=-b.width/2-.001&&max[0]<=b.width/2+.001,`${b.label} keeps its horizontal lot width`);
    assert.ok(min[2]>=-b.depth/2-.001,`${b.label} new rear door stays inside lot`);
    if(b.kind==='house')assert.ok(max[2]<=b.depth/2+.001,`${b.label} porch remains inside lot`);
    model.root.traverse(mesh=>{if(mesh.isMesh)for(const attribute of Object.values(mesh.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));});
    model.root.updateMatrixWorld(true);
    for(const x of [b.doorOffset-.6,b.doorOffset,b.doorOffset+.6])for(const y of [.6,1.4,2.10]){
     const distance=model.diagnostics.plan.rearDoor?b.depth+4:b.depth-2.7;
     const ray=new THREE.Raycaster(new THREE.Vector3(x,y,b.depth/2+2),new THREE.Vector3(0,0,-1),0,distance);
     assert.equal(ray.intersectObject(model.root,true).length,0,`${b.label} real front passage at ${x},${y}`);
     if(model.diagnostics.plan.rearDoor){const rear=new THREE.Raycaster(new THREE.Vector3(x,y,-b.depth/2-2),new THREE.Vector3(0,0,1),0,b.depth+4);assert.equal(rear.intersectObject(model.root,true).length,0,`${b.label} real rear passage`);}
    }
    const sideWall=new THREE.Raycaster(new THREE.Vector3(b.width/2+1,1.4,0),new THREE.Vector3(-1,0,0),0,2);
    assert.ok(sideWall.intersectObject(model.root,true).length>0,`${b.label} visually retains its solid side wall`);
   }finally{model.dispose();model.dispose();}
  }
  assert.ok(totalTriangles<2100000,`whole-coast geometry: ${totalTriangles}`);assert.ok(totalDraws<=1300,`whole-coast source batches before spatial culling: ${totalDraws}`);assert.equal(borrowedDisposals,0);
 }finally{shared.dispose();}
 assert.equal(borrowedDisposals,Object.keys(shared).length);
});
