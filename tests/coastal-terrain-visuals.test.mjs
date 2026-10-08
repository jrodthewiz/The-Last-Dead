import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {capeGroundHeight,capeStreamZ,capeStreamLevel,capePathMask} from '../coastal-terrain.js';
import {buildCapeTerrain} from '../coastal-terrain-visuals.js';

test('terrain buffers match gameplay samples and stay separate from level building/road floors',()=>{
 const c=makeHarborCourse({openWorld:true}),world={course:c,root:new THREE.Group(),materials:{},diagnostics:{},box(){}};
 const terrain=buildCapeTerrain(world);let checked=0;
 try{
  terrain.root.traverse(o=>{if(!o.name.startsWith('CapeTerrain:'))return;
   const p=o.geometry.attributes.position;
   for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getY(i)));assert.ok(Math.abs(p.getY(i)-capeGroundHeight(p.getX(i),p.getZ(i),{bridges:false}))<1e-6);checked++;}
  });
  assert.ok(checked>40000);assert.ok(capeGroundHeight(410,386)>5);
  for(const b of c.coastal.buildings)for(const x of [b.x-b.width/2,b.x,b.x+b.width/2])for(const z of [b.z-b.depth/2,b.z,b.z+b.depth/2])assert.equal(capeGroundHeight(x,z),0);
  for(const r of c.coastal.roads)assert.equal(capeGroundHeight(r.x,r.z),0);
  for(const x of [222,340])assert.equal(capeGroundHeight(x,capeStreamZ(x)),capeStreamLevel(x)+.65);
  assert.ok(capeGroundHeight(280,capeStreamZ(280))<capeStreamLevel(280)-.6);
 }finally{terrain.dispose();}assert.equal(world.root.children.length,0);
});

test('seeded forest clears building approaches, footpaths and stream banks with solid trunk proxies',()=>{
 const a=makeHarborCourse({openWorld:true}),b=makeHarborCourse({openWorld:true});
 const forest=a.coastal.forestPlacements.filter(p=>p.id.startsWith('cape-forest-'));
 assert.deepEqual(a.coastal.forestPlacements,b.coastal.forestPlacements);assert.ok(forest.length>300);
 for(const p of forest){
  assert.equal(p.y,capeGroundHeight(p.x,p.z));assert.ok(capePathMask(p.x,p.z)<=.02);assert.equal(canStand(a,p.x/4,p.z/4,.1),false);
  for(const lot of a.coastal.buildings)assert.ok(Math.abs(p.x-lot.x)>=lot.width/2+4||Math.abs(p.z-lot.z)>=lot.depth/2+4);
 }
 for(const x of [222,340])for(let z=314;z<=406;z+=.5)assert.ok(canStand(a,x/4,z/4,.16),`open forest path ${x},${z}`);
});
