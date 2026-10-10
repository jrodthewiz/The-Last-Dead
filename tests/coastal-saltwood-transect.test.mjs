import {historicalRecords,historicalCourtCoastal,assertCourtTerrainTotals} from './coastal-court-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {makeCapeForestPlacements,capeGroundHeight} from '../coastal-terrain.js';
import {makeCoastalUnderstory,appendCapeGroveCourt,understoryClear} from '../coastal-understory-layout.js';
import {saltwoodTransectFields} from '../coastal-saltwood-transect.js';
import {CAPE_RESIDENTIAL_TRANSITION} from '../coastal-residential-fields.js';
import {canStand} from '../engine.js';
import {createForestVegetation} from '../forest-vegetation.js';
import {createCoastalUnderstory} from '../coastal-understory.js';

function baseline(coastal){
 const c={...coastal,forestPlacements:makeCapeForestPlacements(coastal.neighborhoods,coastal.buildings,coastal.roads)};
 c.understoryPlacements=makeCoastalUnderstory(c);
 const court=appendCapeGroveCourt(c);c.forestPlacements.push(...court.trees);c.understoryPlacements.push(...court.plants);return c;
}
test('saltwood is an additive connected lee-to-heath transect with all original authoring and approaches intact',()=>{
 const course=makeHarborCourse({openWorld:true}),c=historicalCourtCoastal(course.coastal),old=baseline(c);
 const trees=c.forestPlacements.slice(old.forestPlacements.length),plants=c.understoryPlacements.slice(old.understoryPlacements.length,old.understoryPlacements.length+200);
 assert.deepEqual(c.forestPlacements.slice(0,old.forestPlacements.length),old.forestPlacements,'every old tree field including authoritative Y is unchanged');
 assert.deepEqual(c.understoryPlacements.slice(0,old.understoryPlacements.length),old.understoryPlacements,'every old low plant field is unchanged');
 assert.equal(trees.length,30);assert.equal(plants.length,200);assert.equal(c.forestPlacements.length,554);
 assert.equal(trees.filter(p=>p.community==='saltwood-south-lee').length,18);assert.equal(trees.filter(p=>p.community==='saltwood-north-lee').length,12);
 assert.equal(plants.filter(p=>p.kind==='shrub').length,72);assert.equal(plants.filter(p=>p.kind==='grass').length,128);
 assert.ok(trees.some(p=>p.species==='deciduous')&&trees.some(p=>p.species==='conifer'));
 for(const p of [...trees,...plants]){
  const field=saltwoodTransectFields(p.x,p.z);assert.equal(p.y,capeGroundHeight(p.x,p.z));
  assert.ok(field.bedrock<.18&&field.trace<.02&&p.x>394&&p.x<440&&p.z>3&&p.z<111);
  if(!p.kind){
   assert.ok(p.height>=10&&p.height<=17&&field.canopy>=.18&&field.accessDistance>=6.5);
   assert.ok(course.obstacles.some(o=>o.id===p.id)&&!canStand(course,p.x/4,p.z/4,.1),'visible trunk owns real solid proxy');
   for(const t of c.forestPlacements)if(t!==p)assert.ok(Math.hypot(t.x-p.x,t.z-p.z)>=4.2);
  }else{assert.ok(field.lowCover>=.18);assert.ok(!course.obstacles.some(o=>o.id===p.id));}
  const clear={...c,forestPlacements:c.forestPlacements.filter(t=>t!==p)};
  assert.ok(understoryClear(clear,p.x,p.z,{softShoulder:true}));
 }
 // Connected crowns bridge young regeneration into an unequal larger mass;
 // explicit crown gaps retain the two worn cross-shore accesses and slate.
 for(const group of ['saltwood-south-lee','saltwood-north-lee']){
  const cohort=trees.filter(t=>t.community===group),reached=new Set([cohort[0]]);
  for(let pass=0;pass<cohort.length;pass++)for(const t of cohort)if([...reached].some(q=>Math.hypot(t.x-q.x,t.z-q.z)<10))reached.add(t);
  assert.equal(reached.size,cohort.length,'each new canopy cohort forms one connected body at ten-metre crown reach');
 }
 for(const trace of CAPE_RESIDENTIAL_TRANSITION.traces)for(let x=396;x<=441;x+=.5){
  const dx=x-384,z=trace.z+dx*trace.slope+trace.bend*Math.sin(dx*trace.frequency);
  if(z>=120)continue;assert.equal(saltwoodTransectFields(x,z).canopy,0);assert.ok(canStand(course,x/4,z/4,.16),'real worn cross-shore route remains usable');
 }
 for(const i of c.blackwaterSlice.interiors)for(const q of [i.route.frontApproach,i.route.rearApproach].filter(Boolean))
  assert.ok(!trees.some(t=>Math.hypot(t.x-q.x,t.z-q.z)<4.4),'all original portal approaches retain canopy clearance');
});

test('saltwood borrows the existing six-template forest and rooted understory pools with bounded costs',()=>{
 const c=historicalCourtCoastal(makeHarborCourse({openWorld:true}).coastal),old=baseline(c),trees=c.forestPlacements.slice(old.forestPlacements.length);
 const runtime={loadTextures:false,lodDistances:[0,28,65],cullDistance:900,shadowDistance:35};
 const forest=createForestVegetation({placements:c.forestPlacements,...runtime});
 const oldForest=createForestVegetation({placements:old.forestPlacements,...runtime});
 const art=createCoastalUnderstory({placements:c.understoryPlacements.slice(0,4403)});
 const oldArt=createCoastalUnderstory({placements:old.understoryPlacements});
 try{
  const d=forest.diagnostics();assert.equal(d.templates,6);assert.equal(d.geometries,36);assert.equal(d.materials,3);assert.equal(d.textures,4);assert.equal(d.pooledMeshes,36);assert.equal(d.maxDraws,36);
  const before=oldForest.diagnostics();assert.equal(d.geometryBytes,before.geometryBytes);assert.equal(d.instanceBytes-before.instanceBytes,13680);
  const hash=value=>{let state=2166136261;for(const c of String(value))state=Math.imul(state^c.charCodeAt(0),16777619);return state>>>0;};
  const costs=[0,0,0];for(const t of trees){const template=d.triangleCostPerTree.find(k=>k.species===t.species&&k.templateIndex===hash(t.seed)%3);for(let lod=0;lod<3;lod++)costs[lod]+=template.lod[lod];}
  assert.ok(costs[0]<=282000&&costs[1]<=144000&&costs[2]<=84000);assert.equal(trees.length*6*(64+12),13680,'three LOD branch/crown matrix and tint pools');
  assert.equal(art.diagnostics.materials,2);assert.equal(art.diagnostics.sharedGeometries,3);assert.equal(art.diagnostics.addedShadowMaps,0);
  assert.equal(art.diagnostics.batches,oldArt.diagnostics.batches,'transect occupies existing spatial/material plant bins');
  const plantTriangles=72*art.diagnostics.shrubTriangles+128*art.diagnostics.grassTriangles;assert.ok(plantTriangles<40000);
  // Native fixed overview will decide composition; this records all-LOD costs
  // separately rather than presenting the far-cost as a universal claim.
  console.log(JSON.stringify({saltwoodTrees:trees.length,lodAddedTriangles:costs,addedInstanceBytes:13680,plantTriangles,forestGeometryBytes:d.geometryBytes,forestInstanceBytes:d.instanceBytes,understoryBatches:art.diagnostics.batches}));
  const cam=new THREE.PerspectiveCamera(75,1.6,.05,1800);cam.position.set(25,210,-30);cam.lookAt(225,0,200);cam.updateMatrixWorld();forest.update(cam,0);oldForest.update(cam,0);const overview=forest.diagnostics(),oldOverview=oldForest.diagnostics();
  assert.equal(overview.draws,oldOverview.draws);assert.equal(overview.lodTrees[2]-oldOverview.lodTrees[2],30);
  console.log(JSON.stringify({overviewLodTrees:overview.lodTrees,overviewTriangles:overview.triangles,overviewDraws:overview.draws,overviewAddedTriangles:overview.triangles-oldOverview.triangles}));
 }finally{forest.dispose();forest.dispose();oldForest.dispose();art.dispose();art.dispose();oldArt.dispose();}
});
