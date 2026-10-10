import {historicalRecords,historicalCourtCoastal,assertCourtTerrainTotals} from './coastal-court-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {capeGroundHeight,capeNaturalHeight,groundAt} from '../coastal-terrain.js';
import {capeGroveCourtRelief} from '../coastal-grove-court-fields.js';
import {COASTAL_LEVEL_LAND} from '../coastal-world-visuals.js';
import {buildCapeTerrain} from '../coastal-terrain-visuals.js';
import {canStand,newRun,eye,castGroundRay} from '../engine.js';
import {preRidgeRecords} from './coastal-ridge-authority.mjs';

test('sheltered court bank and lee hollow are actual ground with an uncapped level-land hole',()=>{
 const c=makeHarborCourse({openWorld:true}),hasSlab=(x,z)=>COASTAL_LEVEL_LAND.some(p=>Math.abs(x-p.x)<p.width/2&&Math.abs(z-p.z)<p.depth/2);
 for(const [key,n,expectedChanged,digest]of [['forestPlacements',524,3,'96852881b3090f9d041cbf223c4859f1e5dd849182b2c230fd3f53209c19a983'],['understoryPlacements',4203,101,'a7399078264a239eedc171e536fc6b442c182d5ea4aea34a339f7b733b3e25fc']]){
  let changed=0;const original=preRidgeRecords(historicalRecords(c.coastal,key).slice(0,n)).map(p=>{
   const oldY=capeGroundHeight(p.x,p.z,{courtRelief:false,residentialRidge:false}),now=capeGroundHeight(p.x,p.z,{residentialRidge:false});if(Math.abs(now-oldY)<1e-10)return p;
   assert.ok(p.x>=375&&p.x<=401&&p.z>=247&&p.z<=281);assert.equal(p.y,now);changed++;return{...p,y:oldY};
  });
  assert.equal(changed,expectedChanged);assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),digest,'FULL v35 prefix including court records preserves every field outside declared local Y');
 }
 assert.equal(hasSlab(381,273),false);assert.ok(capeGroundHeight(381,273)<-.15,'native hollow descends below the previous slab');
 for(let x=363;x<373;x+=.5)for(let z=248;z<=280;z+=.5){assert.ok(hasSlab(x,z));assert.equal(capeGroveCourtRelief(x,z).height,0);}
 let peak=0,low=0;for(let x=374;x<=401;x+=.25)for(let z=247;z<=281;z+=.25){const f=capeGroveCourtRelief(x,z);peak=Math.max(peak,f.height);low=Math.min(low,f.height);assert.ok(Object.values(f).every(Number.isFinite));assert.ok(Math.abs(f.litter+f.moss+f.mineral-1)<1e-12);}
 assert.ok(peak>.60&&peak<=.65);assert.ok(low<-.19&&low>=-.20);
 for(let x=374;x<=400;x+=.125)for(let z=266.5;z<=269.5;z+=.125){assert.equal(capeGroundHeight(x,z),capeGroundHeight(x,z,{courtRelief:false}));if(x<=389)assert.ok(canStand(c,x/4,z/4,.1),'new planting/terrain preserves real route width to the grove edge');}
 for(const [x,z]of [[374,264],[384,248],[384,280],[400,264],[410,264],[335,387]])assert.equal(capeNaturalHeight(x,z),capeNaturalHeight(x,z,{courtRelief:false}));
 const r=newRun(c);r.x=381/4;r.y=273/4;assert.equal(eye(r),groundAt(c,r.x,r.y)+.4);assert.ok(Number.isFinite(castGroundRay(c,r.x,r.y,eye(r),0,-1,2)));
});

test('one native extension shares terrain topology, seam samples and borrowed material without a new map',()=>{
 const c=makeHarborCourse({openWorld:true}),world={course:c,root:new THREE.Group(),materials:{},diagnostics:{},box(){}},art=buildCapeTerrain(world);
 try{
  const ext=art.root.children.find(o=>o.name==='CapeTerrain:374:248');assert.ok(ext);assert.equal(ext.geometry.attributes.position.count/3,640);
  const native=art.root.children.find(o=>o.name==='CapeTerrain:384:248')||art.root.children.find(o=>o.name.startsWith('CapeTerrain:384:'));assert.equal(ext.material,native.material);
  const p=ext.geometry.attributes.position,b=ext.geometry.attributes.capeBiome;
  for(let i=0;i<p.count;i++){
   assert.ok(Math.abs(p.getY(i)-capeGroundHeight(p.getX(i),p.getZ(i)))<1e-6);
   const sum=b.getX(i)+b.getY(i)+b.getZ(i)+b.getW(i);assert.ok(Number.isFinite(sum)&&sum>=0&&sum<=1+1e-6);
   if(p.getX(i)===374||p.getZ(i)===248||p.getZ(i)===280)if(p.getX(i)<384)assert.equal(sum,0,'native habitat feathers into borrowed turf at exposed slab edges');
  }
  assert.equal(world.diagnostics.terrain.chunks,67);assert.equal(world.diagnostics.terrain.triangles,108416);assert.equal(world.diagnostics.terrain.court.triangles,640);
  assert.equal(world.diagnostics.terrain.court.sharedMaterial,true);assert.equal(world.diagnostics.terrain.court.sharedTextures,true);
 }finally{art.dispose();}assert.equal(world.root.children.length,0);
});
