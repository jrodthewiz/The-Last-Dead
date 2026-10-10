import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {capeGroundHeight} from '../coastal-terrain.js';
import {makeCoastalUnderstory,understoryClear} from '../coastal-understory-layout.js';
import {capeWindwardHeathFields,capeResidentialCoastFields,CAPE_RESIDENTIAL_SCALAR_OPS,CAPE_WINDWARD_HEATH_BEDS} from '../coastal-terrain-fields.js';
import {createCoastalUnderstory} from '../coastal-understory.js';

test('windward margins retain every prior plant and grow four unequal communities with open worn traces',()=>{
 const course=makeHarborCourse({openWorld:true}),plants=course.coastal.understoryPlacements,old=makeCoastalUnderstory(course.coastal,{expandCoast:false}),added=plants.filter(p=>p.coastalExpansion);
 assert.equal(old.length,3114);assert.deepEqual(plants.slice(0,old.length),old,'all earlier tree-foot, forest, city and320 coast records remain in their exact prefix');
 assert.equal(course.coastal.forestPlacements.length,524);assert.equal(new Set(added.map(p=>p.community)).size,4);
 assert.ok(added.filter(p=>p.kind==='grass').length>=550&&added.filter(p=>p.kind==='grass').length<=720);
 assert.ok(added.filter(p=>p.kind==='shrub').length>=110&&added.filter(p=>p.kind==='shrub').length<=144);
 for(const p of added){
  assert.equal(p.y,capeGroundHeight(p.x,p.z));assert.ok(understoryClear(course.coastal,p.x,p.z,{softShoulder:true}));assert.ok(capeWindwardHeathFields(p.x,p.z).cover>=.24);
  const f=capeResidentialCoastFields(p.x,p.z);assert.ok(f.trace<=.025&&f.bedrock<=.35);assert.ok(!course.obstacles.some(o=>o.id===p.id));
  const r=p.kind==='shrub'?.47*p.scale+.02:.26*p.scale+.012;
  for(const [dx,dz]of [[-r,0],[r,0],[0,-r],[0,r]]){assert.ok(understoryClear(course.coastal,p.x+dx,p.z+dz,{softShoulder:true}));assert.ok(capeResidentialCoastFields(p.x+dx,p.z+dz).trace<=.045,'whole growth envelope leaves worn access open');}
 }
 const art=createCoastalUnderstory({placements:plants});try{
  const increment=added.reduce((n,p)=>n+art.diagnostics[`${p.kind}Triangles`],0);assert.ok(increment<=113184,'measured coast budget:720 folded tufts plus144 leafy shrubs');
  assert.equal(art.diagnostics.sharedGeometries,3);assert.equal(art.diagnostics.materials,2);assert.ok(art.diagnostics.batches<=80);assert.equal(art.diagnostics.addedShadowMaps,0);
 }finally{art.dispose();}
});

test('shared windward algebra retains scalar parity and exact gaps at the existing slate exposures',()=>{
 const calls={};const ops=Object.fromEntries(Object.entries(CAPE_RESIDENTIAL_SCALAR_OPS).map(([name,fn])=>[name,(...args)=>{calls[name]=(calls[name]||0)+1;return fn(...args);} ]));
 for(let x=421;x<=445;x+=2)for(let z=2;z<=116;z+=3){const a=capeWindwardHeathFields(x,z),b=capeWindwardHeathFields(x,z,ops);assert.deepEqual(a,b);assert.ok(a.cover>=0&&a.cover<=1);}
 assert.ok(calls.sin>0&&calls.smooth>0&&calls.max>0);assert.equal(CAPE_WINDWARD_HEATH_BEDS.length,4);
 for(const p of [[438,28],[441,94]])assert.ok(capeWindwardHeathFields(...p).cover<.2,'bare slate interrupts the heath instead of receiving uniform vegetation');
 assert.equal(capeWindwardHeathFields(448,60).cover,0);assert.equal(capeWindwardHeathFields(433,0).cover,0);
});
