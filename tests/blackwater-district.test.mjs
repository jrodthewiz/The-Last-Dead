import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
import {blackwaterObstacle} from '../blackwater-district-layout.js';
import {canStand,castRay,newRun} from '../engine.js';
import {collectScavengerPickup} from '../scavenger-pack.js';
import {lowTideSnapshot,restoreLowTide} from '../low-tide-save.js';

test('first Blackwater slice replaces sixteen lots and preserves every original footprint',()=>{
  const c=makeHarborCourse({openWorld:true}),slice=c.coastal.blackwaterSlice;
  const original=new Map(makeCoastalNeighborhoods().lots.map(p=>[p.id,p]));
  assert.equal(c.coastal.buildings.length,original.size);
  assert.equal(slice.buildings.length,94);
  assert.equal(slice.downtownBuildingIds.length,16);
  const downtown=slice.buildings.filter(p=>slice.downtownBuildingIds.includes(p.id));
  assert.equal(downtown.filter(p=>p.kind==='house').length,8);
  assert.equal(slice.buildings.filter(p=>p.enterable).length,94);
  assert.equal(downtown.filter(p=>p.kind==='house'&&p.enterable).length,8);
  for(const p of c.coastal.buildings){
    const prior=original.get(p.id);
    assert.deepEqual(p.collision,{minX:prior.x-prior.width/2,maxX:prior.x+prior.width/2,minZ:prior.z-prior.depth/2,maxZ:prior.z+prior.depth/2});
    if(p.kit==='blackwater'){
      assert.equal(p.width,prior.width);assert.equal(p.depth,prior.depth);
      assert.ok(slice.buildings.includes(p));
      if(p.kind==='house')assert.equal(p.height,6.4);
    }else{assert.equal(p.asset,prior.asset);assert.equal(p.height,prior.height);}
  }
  assert.equal(slice.shop.door.x,202);assert.equal(slice.shop.door.z,48);
});

test('Bell Pharmacy admits movement and sight through its front door while sides and back stay sealed',()=>{
  const c=makeHarborCourse({openWorld:true}),s=c.coastal.blackwaterSlice.shop;
  // Traverse from Main Street to the cache without the legacy room teleport.
  for(let z=55;z>=39;z-=.12)assert.ok(canStand(c,202/4,z/4,.16),`entrance path at ${z}`);
  assert.equal(castRay(c,202/4,55/4,-Math.PI/2,(55-39)/4).dist,(55-39)/4);
  for(const x of [194,198,206]){
    assert.equal(canStand(c,x/4,48/4,.1),false,`front wall at ${x}`);
    assert.equal(castRay(c,x/4,49/4,-Math.PI/2,2).dist,.25);
  }
  for(const z of [38,42,46]){
    assert.equal(canStand(c,192/4,z/4,.1),false);
    assert.equal(canStand(c,208/4,z/4,.1),false);
  }
  assert.equal(canStand(c,202/4,36/4,.1),false);
  for(let y=(s.z-s.depth/2)/4;y<(s.z+s.depth/2)/4;y++)for(let x=(s.x-s.width/2)/4;x<(s.x+s.width/2)/4;x++)
    assert.ok(!c.blocks.some(([bx,by])=>bx===x&&by===y),'ground floor has no solid block records');
  for(let y=0;y<c.h;y++)for(let x=0;x<c.w;x++){
    const cell=c.cells[y*c.w+x];
    if(x<c.w-1)assert.equal(cell[1],c.cells[y*c.w+x+1][3],`east reciprocal ${x},${y}`);
    if(y<c.h-1)assert.equal(cell[2],c.cells[(y+1)*c.w+x][0],`south reciprocal ${x},${y}`);
  }
});

test('pharmacy furnishings block movement and bullets while leaving the centre passage open',()=>{
  const c=makeHarborCourse({openWorld:true}),prefix='coast-lot-0-0-1-1-';
  const shelves=c.obstacles.filter(b=>b.id.startsWith(prefix));
  assert.equal(shelves.length,3);
  for(const shelf of shelves)assert.equal(canStand(c,(shelf.minX+shelf.maxX)/2,(shelf.minY+shelf.maxY)/2,.1),false);
  const leftHit=castRay(c,195/4,42/4,Math.PI,2);
  assert.equal(leftHit.obstacleId,`${prefix}left-wall-shelving`);
  const rearHit=castRay(c,202/4,40/4,-Math.PI/2,2);
  assert.equal(rearHit.obstacleId,`${prefix}rear-stock-shelf`);
  assert.ok(rearHit.dist<(40-36)/4,'visible shelf is hit before the back wall');
  const counterHit=castRay(c,202/4,44.5/4,0,2);
  assert.equal(counterHit.obstacleId,`${prefix}cash-counter`);
  for(let z=39;z<=48;z+=.15)assert.ok(canStand(c,202/4,z/4,.16),'door-to-cache corridor stays clear');
});

test('all houses open and roadside wrecks leave six metres of Main Street clear',()=>{
  const c=makeHarborCourse({openWorld:true}),slice=c.coastal.blackwaterSlice;
  assert.equal(slice.buildings.filter(p=>p.kind==='house'&&!p.enterable).length,0);
  for(let x=150;x<224;x+=.25)assert.ok(canStand(c,x/4,56/4,.75),`six metre driving clearance at ${x}`);
  for(const p of slice.props){
    const collider=c.obstacles.find(b=>b.id===p.id);
    if(p.solid){assert.deepEqual(collider,blackwaterObstacle(p));assert.equal(canStand(c,p.x/4,p.z/4,.1),false);}
    else assert.equal(collider,undefined,'small debris is visual scenery');
  }
  const rotated=blackwaterObstacle({x:20,z:40,width:4,depth:2,yaw:Math.PI/2},'rotated');
  assert.deepEqual(rotated,{id:'rotated',minX:4.75,maxX:5.25,minY:9.5,maxY:10.5});
});

test('one furnished family house has a reciprocal front-to-rear livingroom and kitchen route',()=>{
 const c=makeHarborCourse({openWorld:true}),s=c.coastal.blackwaterSlice.house;
 assert.equal(s.id,'coast-lot-1-0-0-2');assert.equal(s.door.x,194);assert.equal(s.door.z,64);assert.equal(s.rearDoor.x,194);assert.equal(s.rearDoor.z,80);
 for(let z=62;z<=84;z+=.10)assert.ok(canStand(c,194/4,z/4,.16),`house front/back walking path at${z}`);
 const relocated=s.relocatedProps;assert.equal(relocated.length,1);assert.equal(relocated[0].id,'coast-tree-27');
 const tree=c.coastal.neighborhoods.props.find(p=>p.id===relocated[0].id),treeCollider=c.obstacles.find(p=>p.id===tree.id);
 assert.deepEqual([tree.x,tree.z],relocated[0].to);assert.deepEqual(treeCollider,blackwaterObstacle(tree),'moved tree collider and visual share the same record');
 assert.equal(castRay(c,194/4,62/4,Math.PI/2,22/4).dist,22/4,'sight survives both real openings and interior corridor');
 for(const z of [64,80])for(const x of [186,190,198])assert.equal(canStand(c,x/4,z/4,.10),false,`sealed house boundary${x},${z}`);
 for(const z of [66,70,74,78])for(const x of [184,200])assert.equal(canStand(c,x/4,z/4,.10),false,'side wall remains sealed');
 const prefix=`${s.id}-`,furnishings=c.obstacles.filter(o=>o.id.startsWith(prefix));assert.equal(furnishings.length,12);
 for(const item of furnishings)assert.equal(canStand(c,(item.minX+item.maxX)/2,(item.minY+item.maxY)/2,.10),false,`${item.id} has authoritative collision`);
 const sofa=castRay(c,194/4,69/4,Math.PI,3);assert.equal(sofa.obstacleId,`${prefix}living-sofa`);
 const table=castRay(c,194/4,73.3/4,Math.PI,3);assert.equal(table.obstacleId,`${prefix}kitchen-dining-chair-west`);
 for(let y=0;y<c.h;y++)for(let x=0;x<c.w;x++){
  const cell=c.cells[y*c.w+x];if(x<c.w-1)assert.equal(cell[1],c.cells[y*c.w+x+1][3]);if(y<c.h-1)assert.equal(cell[2],c.cells[(y+1)*c.w+x][0]);
 }
});

test('pharmacy cache can be collected indoors and survives a Netmakers checkpoint',()=>{
  const r=newRun(makeHarborCourse({openWorld:true,lowTide:true}));
  const cache=r.course.scavengerPickups.find(p=>p.id==='coast-scrap-bell-pharmacy');
  assert.ok(cache);assert.ok(canStand(r.course,cache.x,cache.y,.16));
  Object.assign(r,{mode:'play',x:cache.x,y:cache.y,z:0});
  assert.equal(collectScavengerPickup(r,cache.id).ok,true);assert.equal(r.backpack.scrap,4);
  r.lowTide.shelter=true;
  const restored=newRun(makeHarborCourse({openWorld:true,lowTide:true}));
  assert.equal(restoreLowTide(restored,JSON.parse(JSON.stringify(lowTideSnapshot(r)))),true);
  assert.ok(restored.backpack.collected.includes(cache.id));assert.equal(restored.backpack.scrap,4);
});
