import {historicalRecords,historicalCourtCoastal,assertCourtTerrainTotals} from './coastal-court-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {residentialGroundHierarchy,outerBankGroundHierarchy,CAPE_OUTER_WASH} from '../coastal-ground-hierarchy.js';
import {capeGroundHierarchy} from '../coastal-terrain-fields.js';
import {capeGroundHeight} from '../coastal-terrain.js';
import {makeHarborCourse} from '../harbor-course.js';
import {buildCapeTerrain} from '../coastal-terrain-visuals.js';
import {preRidgeRecords} from './coastal-ridge-authority.mjs';

const partition=f=>{assert.ok(f.weights.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(Math.abs(f.weights.reduce((a,b)=>a+b,0)-1)<1e-12);};
test('front surface grows from rooted saltwood through damp toe and exposed slate, rather than a uniform coast role',()=>{
 const base={coast:{bedrock:0,trace:0,exposure:.8},natural:{wetness:0,heath:.5},saltwood:{canopy:0},canopy:{},slope:.04,curvature:0};
 const bare=residentialGroundHierarchy(base),root=residentialGroundHierarchy({...base,canopy:{pine:.85,cover:.8}});
 const toe=residentialGroundHierarchy({...base,natural:{wetness:.9,heath:.4},curvature:.1});
 const slate=residentialGroundHierarchy({...base,coast:{bedrock:.95,trace:0,exposure:.8}});
 for(const f of [bare,root,toe,slate])partition(f);
 assert.ok(root.weights[0]>bare.weights[0]&&root.weights[3]<bare.weights[3],'actual roots accumulate duff and shelter mineral');
 assert.ok(toe.weights[1]>root.weights[1]&&toe.weights[1]>.55,'a damp actual toe has a distinct moss role');
 assert.ok(slate.weights[3]>.8&&slate.weights[3]>bare.weights[3],'only the existing slate source dominates mineral');
 assert.ok(bare.weights[2]>root.weights[2],'windward heath yields to a sheltered canopy floor');
 const c=makeHarborCourse({openWorld:true});
 const p=c.coastal.forestPlacements.find(p=>p.id.startsWith('cape-forest-saltwood-'));
 const field=capeGroundHierarchy(p.x,p.z,{pine:1,cover:1});partition(field);assert.equal(field.region,'front');assert.ok(field.shelter>.95);
 assert.equal(capeGroundHierarchy(335,387,{pine:1}),null,'accepted original footing material is outside this pass');
});

test('mineral wash stays connected to its outcrop, runs downhill and is interrupted by root retention',()=>{
 const bare={canopy:{},slope:.25,curvature:-.04,gx:1,gz:-1};
 const length=Math.hypot(17,20),ux=-17/length,uz=20/length;
 const at=d=>[399+ux*d,393+uz*d];
 const [x,z]=at(10),middle=outerBankGroundHierarchy(x,z,bare),root=outerBankGroundHierarchy(x,z,{...bare,canopy:{pine:1}});
 partition(middle);partition(root);assert.ok(middle.cover>.9&&middle.downhill>.9);assert.ok(root.mineral<middle.mineral*.25);
 const [tx,tz]=at(22),toe=outerBankGroundHierarchy(tx,tz,{...bare,curvature:.08});partition(toe);
 assert.ok(toe.moss>middle.moss&&toe.weights[1]>middle.weights[1],'actual concave coastal toe retains organic moisture');
 assert.equal(outerBankGroundHierarchy(370,402,bare).cover,0);
 assert.equal(outerBankGroundHierarchy(399,416,bare).cover,0,'wash tapers at exact shoreline instead of a rectangular paint boundary');
 assert.equal(outerBankGroundHierarchy(x+uz*13,z-ux*13,bare).cover,0,'steep adjacent soil is not automatically mineral');
 const uphill=outerBankGroundHierarchy(x,z,{...bare,gx:-1,gz:1});assert.ok(uphill.mineral<middle.mineral,'erosion responds to authoritative downhill direction');
 assert.deepEqual(CAPE_OUTER_WASH.source,[399,393]);
 for(let d=3;d<24;d+=2){const [a,b]=at(d),f=capeGroundHierarchy(a,b,{});partition(f);assert.ok(f.cover>.35,'one continuous source-to-toe body');}
});

test('hierarchy changes only existing terrain attributes and retains pooled geometry, maps, authority and disposal',()=>{
 const c=makeHarborCourse({openWorld:true}),before=JSON.stringify([c.coastal.forestPlacements,c.coastal.understoryPlacements]);
 const world={course:c,root:new THREE.Group(),materials:{},diagnostics:{},box(){}},art=buildCapeTerrain(world);
 try{
  assert.equal(world.diagnostics.terrain.chunks,67);assert.equal(world.diagnostics.terrain.triangles,108416);
 assert.equal(c.coastal.forestPlacements.length,562);assert.equal(c.coastal.understoryPlacements.slice(0,4403).length,4403);
  for(const [key,digest]of [['forestPlacements','ef653fa16895751b8742433ff5b76ea44724c9cc325569781da654ef6ad672f7'],['understoryPlacements','0566b8f5868d5be2e60c53c758b6c92bdd7951fda93168c6d5eca352bc3008bb']])
   assert.equal(createHash('sha256').update(JSON.stringify(preRidgeRecords(historicalRecords(c.coastal,key).slice(0,key==='forestPlacements'?554:4403)))).digest('hex'),digest,'FULL immutable v37 records preserve every field outside exact declared ridge support IDs');
  assert.equal(JSON.stringify([c.coastal.forestPlacements,c.coastal.understoryPlacements]),before);
  const materials=new Set();let washVertices=0;
  for(const mesh of art.root.children.filter(o=>o.name.startsWith('CapeTerrain:'))){
   materials.add(mesh.material);const p=mesh.geometry.attributes.position,b=mesh.geometry.attributes.capeBiome;
   for(let i=0;i<p.count;i++){
    assert.ok(Math.abs(p.getY(i)-capeGroundHeight(p.getX(i),p.getZ(i),{bridges:false}))<1e-6,'unchanged shared actual triangles');
    const sum=b.getX(i)+b.getY(i)+b.getZ(i)+b.getW(i);assert.ok(Number.isFinite(sum)&&sum>=0&&sum<=1.000001);
    if(p.getX(i)>=382&&p.getX(i)<=398&&p.getZ(i)>=396&&p.getZ(i)<=412)washVertices++;
   }
  }
  assert.equal(materials.size,1);assert.ok(washVertices>100);assert.ok(art.atlas.albedo.isTexture&&art.atlas.normal.isTexture);
  assert.equal(world.diagnostics.terrain.bankDetail.triangles,45438);assert.equal(world.diagnostics.terrain.bankDetail.batches,43);
 }finally{art.dispose();art.dispose();}assert.equal(world.root.children.length,0);
});
