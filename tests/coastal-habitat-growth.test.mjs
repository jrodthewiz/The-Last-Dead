import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {capeGroundHeight} from '../coastal-terrain.js';
import {makeCoastalUnderstory,understoryClear} from '../coastal-understory-layout.js';
import {capeBilberryBedField,capeRootShoulderField,makeCapeRootShoulders,capeTrailCentreDistance,capeSurfaceFields} from '../coastal-terrain-fields.js';
import {createCoastalUnderstory} from '../coastal-understory.js';

test('additional low habitat communities preserve every old record and fill actual sheltered ground with shared resources',()=>{
 const course=makeHarborCourse({openWorld:true}),plants=course.coastal.understoryPlacements;
 const preTransect={...course.coastal,forestPlacements:course.coastal.forestPlacements.filter(p=>!p.community?.startsWith('saltwood-'))};
 const original=makeCoastalUnderstory(preTransect,{expandHabitat:false}),added=plants.filter(p=>p.habitatExpansion&&!p.coastalExpansion&&!p.courtExpansion),shoulders=makeCapeRootShoulders(preTransect.forestPlacements);
 assert.equal(original.length,2433);assert.deepEqual(plants.filter(p=>!p.habitatExpansion),original,'append growth without relocating or deleting any earlier plants');
 assert.deepEqual(plants.filter(p=>!p.courtExpansion&&!p.community?.startsWith('saltwood-')),makeCoastalUnderstory(preTransect),'stable seed preserves every pre-court community');
 assert.equal(course.coastal.forestPlacements.length,554);
 assert.ok(added.length>=650&&added.length<=720);assert.ok(added.filter(p=>p.kind==='shrub').length>=100);assert.ok(added.filter(p=>p.kind==='grass').length>=550);
 assert.equal(new Set(added.map(p=>p.community)).size,13,'root and lee communities span the existing habitat, not one camera patch');
 assert.ok(added.filter(p=>p.x>=315&&p.x<=355&&p.z>=370&&p.z<=400).length>260,'ordinary woodland floor receives a substantial actual rooted population increase');
 for(const p of added){
  assert.equal(p.y,capeGroundHeight(p.x,p.z));assert.ok(understoryClear(course.coastal,p.x,p.z,{softShoulder:true}));
  assert.ok(Math.max(capeBilberryBedField(p.x,p.z),capeRootShoulderField(p.x,p.z,shoulders).cover)>=.22);
  assert.ok(capeSurfaceFields(p.x,p.z).slope<=.28);assert.ok(!course.obstacles.some(o=>o.id===p.id),'low plants have no solid collision entries');
  const envelope=p.kind==='shrub'?.47*p.scale+.02:.26*p.scale+.01;assert.ok(capeTrailCentreDistance(p.x,p.z)-envelope>=1.5,'complete growth and wind envelope preserves the clear route');
  assert.ok(p.kind==='shrub'?p.scale<=1:p.scale<=.64,'low cohorts sit beneath the retained fern layer');
 }
 const art=createCoastalUnderstory({placements:plants});
 try{
  assert.equal(art.diagnostics.sharedGeometries,3);assert.equal(art.diagnostics.materials,2);assert.ok(art.diagnostics.batches<=80);assert.equal(art.diagnostics.addedShadowMaps,0);
  const total=plants.filter(p=>!p.coastalExpansion&&!p.courtExpansion).reduce((n,p)=>n+art.diagnostics[`${p.kind}Triangles`],0);assert.ok(total<850000,'retained woodland growth cost is tracked separately from coast and courtyard growth');
  const resources=new Set(),counts=new Map();art.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);assert.equal(o.castShadow,false);}});for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)||0)+1));
  const camera=new THREE.PerspectiveCamera();camera.position.set(-2000,1.6,-2000);art.update(camera,0);assert.equal(art.diagnostics.visibleBatches,0);art.dispose();art.dispose();for(const r of resources)assert.equal(counts.get(r),1);
 }finally{art.dispose();}
});
