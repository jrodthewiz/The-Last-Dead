import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeHarborCourse} from '../harbor-course.js';
import {capeGroundHeight} from '../coastal-terrain.js';
import {capeGroveCourtFields} from '../coastal-terrain-fields.js';
import {understoryClear} from '../coastal-understory-layout.js';
import {canStand} from '../engine.js';
import {createCoastalUnderstory} from '../coastal-understory.js';
import {preRidgeRecords} from './coastal-ridge-authority.mjs';

test('one sheltered grove-to-court community appends rooted growth without changing any v34 record',()=>{
 const c=makeHarborCourse({openWorld:true}),allTrees=c.coastal.forestPlacements,allPlants=c.coastal.understoryPlacements;
 for(const [records,n,digest]of [[allTrees,512,'3b829f5f9d10303d2062d7644b59e174d2b63b609ecb5db3bcfc46db224716c9'],[allPlants,3895,'caea352ae397a91a400e1f970a05728d76649a811542baac78115cce1f5323eb']]){
  const original=preRidgeRecords(records.slice(0,n)).map(p=>{
   const now=capeGroundHeight(p.x,p.z,{residentialRidge:false}),oldY=capeGroundHeight(p.x,p.z,{rootFooting:false,courtRelief:false,residentialRidge:false}),delta=now-oldY;
   if(Math.abs(delta)<1e-10)return p;
   const root=p.x>=330&&p.x<=342&&p.z>=381&&p.z<=394,court=p.x>=375&&p.x<=401&&p.z>=247&&p.z<=281;
   assert.ok(root||court,'ONLY declared footing/court one-metre grid-support envelopes permit Y re-grounding');
   assert.equal(p.y,now);return{...p,y:oldY};
  });
  assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),digest,'exact full v34 prefix after ONLY declared local authoritative Y re-grounding');
 }
 const trees=allTrees.filter(t=>t.community==='grove-court-regeneration'),plants=allPlants.filter(p=>p.courtExpansion);assert.equal(trees.length,12);assert.equal(plants.length,308);
 assert.equal(plants.filter(p=>p.kind==='shrub').length,128);assert.equal(plants.filter(p=>p.kind==='grass').length,180);
 for(const t of trees){
  assert.equal(t.y,capeGroundHeight(t.x,t.z));assert.ok(t.height>=5&&t.height<9);
  assert.ok(!canStand(c,t.x/4,t.z/4,.1));assert.ok(c.obstacles.some(o=>o.id===t.id),'new visible trunk has its own solid proxy');
  for(const other of allTrees)if(other!==t)assert.ok(Math.hypot(t.x-other.x,t.z-other.z)>=4.2);
 }
 for(const p of [...trees,...plants]){
  assert.equal(p.y,capeGroundHeight(p.x,p.z));assert.ok(capeGroveCourtFields(p.x,p.z).cover>=.2);
  const clearance=p.kind?c.coastal:{...c.coastal,forestPlacements:allTrees.filter(t=>t!==p)};
  assert.ok(understoryClear(clearance,p.x,p.z,{softShoulder:true}),'clear other trunks and entrances; a tree owns its own solid footing');
  assert.ok(!(p.x>415&&p.z>282),'wind-exposed adjacent gap is retained');
 }
 for(const p of plants){const radius=p.scale*(p.kind==='shrub'?.47:.26)+.03;assert.ok(Math.abs(p.z-268)>=1.5+radius);assert.ok(!c.obstacles.some(o=>o.id===p.id));}
 // The connection reaches the grove edge. Farther inside, two retained v34
 // trunks already interrupt a straight line; this pass does not move them.
 for(let x=342;x<=389;x+=.25){assert.equal(capeGroveCourtFields(x,268).cover,0);assert.ok(canStand(c,x/4,268/4,.16),'real court-to-street-to-grove-edge walking centre remains usable');}
 for(let z=258;z<=278;z+=.5)assert.equal(capeGroveCourtFields(368,z).cover,0);
 assert.ok(trees.filter(p=>p.x<362).length>=4&&trees.filter(p=>p.x>374).length>=8,'both real court and woodland receive the connecting cohort');
 const oldBins=new Set(allPlants.slice(0,3895).map(p=>`${Math.floor(p.x/64)}:${Math.floor(p.z/64)}`)),newBins=new Set(plants.map(p=>`${Math.floor(p.x/64)}:${Math.floor(p.z/64)}`));
 assert.ok([...newBins].filter(k=>!oldBins.has(k)).length<=2);
 const art=createCoastalUnderstory({placements:allPlants});
 try{assert.equal(art.diagnostics.materials,2);assert.equal(art.diagnostics.sharedGeometries,3);assert.equal(art.diagnostics.addedShadowMaps,0);assert.ok(art.diagnostics.batches<=80);assert.equal(128*art.diagnostics.shrubTriangles+180*art.diagnostics.grassTriangles,50928);}finally{art.dispose();}
});
