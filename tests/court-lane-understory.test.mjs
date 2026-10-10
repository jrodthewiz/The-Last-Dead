import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeCourse as historicalCourse} from '../output/qa-runtime/island-environment-v68/engine.js';
import {makeHarborCourse as historicalHarbor} from '../output/qa-runtime/island-environment-v68/harbor-course.js';
import {makeCourtLanePlan,courtLaneSoilAt,courtLaneCanopyAt} from '../coastal-court-lane.js';
import {makeCourtLaneUnderstory,COURT_LANE_REANCHOR_IDS,COURT_LANE_PLANT_CEILINGS,courtLanePlantEnvelope} from '../coastal-understory-layout.js';
import {createCoastalUnderstory} from '../coastal-understory.js';
import {capeGroundHeight} from '../coastal-terrain.js';
import {makeCourse} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';

const historical=historicalHarbor({...historicalCourse(),openWorld:true}).coastal;
const prior=historical.understoryPlacements,plan=makeCourtLanePlan(historical);
const authority={trees:plan.trees,communities:plan.communities,clearCircle:(x,z,r)=>courtLaneSoilAt(plan,x,z,r),sampleCommunity:(id,x,z)=>courtLaneCanopyAt(plan,x,z,id),groundHeight:capeGroundHeight};
const result=makeCourtLaneUnderstory(prior,authority),oldById=new Map(prior.map(p=>[p.id,p])),nextById=new Map(result.plants.map(p=>[p.id,p]));
const report={scope:'One authorized court-lane plant overlay; immutable historical v68 input. CPU counts are not native submissions or a performance pass.',census:result.census};

test('historical5745 records retain order and all metadata except explicit53 reanchors/retirements and two ground samples',()=>{
 assert.equal(prior.length,5745);assert.equal(COURT_LANE_REANCHOR_IDS.length,53);
 const permitted=new Set([...COURT_LANE_REANCHOR_IDS,'understory-975','understory-1079']);
 const retired=new Set(result.census.retired);
 assert.deepEqual(result.plants.filter(p=>oldById.has(p.id)).map(p=>p.id),prior.filter(p=>!retired.has(p.id)).map(p=>p.id));
 let outside=0,safeCourt=0;
 for(const p of prior){const q=nextById.get(p.id);if(!permitted.has(p.id)){assert.deepEqual(q,p,p.id);if(p.x<240||p.x>360||p.z<260||p.z>276)outside++;else safeCourt++;}
  else if(q){const a={...p},b={...q};for(const key of ['x','z','y']){delete a[key];delete b[key];}assert.deepEqual(b,a,p.id+' metadata');}
  else assert.ok(COURT_LANE_REANCHOR_IDS.includes(p.id));
 }
 assert.equal(outside,5645);assert.equal(safeCourt,45);assert.equal(result.census.reanchored.length+result.census.retired.length,53);
 for(const id of ['understory-975','understory-1079']){const a=oldById.get(id),b=nextById.get(id);assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.equal(b.y,capeGroundHeight(a.x,a.z));}
 assert.equal(prior.filter(p=>p.community==='cape-forest-court-3').length,0);
});

test('bounded deterministic cohorts and named reanchors use actual soil/access/duff with full plant envelopes',()=>{
 const repeated=makeCourtLaneUnderstory(prior,authority);assert.deepEqual(repeated,result);
 assert.equal(result.census.candidateLimit,32);assert.ok(result.census.added<=280);
 const changed=new Set([...result.census.reanchored,...result.census.regrounded]);
 for(const p of result.plants){if(oldById.has(p.id)&&!changed.has(p.id))continue;assert.ok(courtLaneSoilAt(plan,p.x,p.z,courtLanePlantEnvelope(p)),p.id);assert.equal(p.y,capeGroundHeight(p.x,p.z));
  if(!oldById.has(p.id)){assert.ok(p.id.startsWith('court-lane-'));const f=courtLaneCanopyAt(plan,p.x,p.z,p.community);assert.ok(Math.max(f.cover,f.duff)>.06);}
 }
 for(const q of COURT_LANE_PLANT_CEILINGS){const c=result.census.communities.find(c=>c.id===q.id);for(const k of ['grass','fern','shrub'])assert.ok(c[k]<=q[k]);assert.equal(c.grass+c.fern+c.shrub+c.rejected,q.grass+q.fern+q.shrub);}
 assert.equal(new Set(result.plants.map(p=>p.id)).size,result.plants.length);
});

test('actual world integration constructs the historical population before final tree and plant overlay',()=>{
 const actual=makeHarborCourse({...makeCourse(),openWorld:true}).coastal;
 assert.deepEqual(actual.courtLaneUnderstory,result.census);
 assert.deepEqual(actual.understoryPlacements,result.plants);
 assert.equal(actual.forestPlacements.length,562);
 assert.equal(actual.forestPlacements.filter(t=>t.id.startsWith('cape-forest-court-lane-')).length,8);
 assert.equal(actual.courtLaneUnderstory.before,5745);
});

test('existing geometry/material/wind ownership persists; actual population/bin/instance triangle census is explicit',()=>{
 const before=createCoastalUnderstory({placements:prior}),after=createCoastalUnderstory({placements:result.plants});
 try{
  for(const [kind,triangles]of [['grass',108],['fern',504],['shrub',246]])assert.equal(after.diagnostics[kind+'Triangles'],triangles);
  assert.equal(before.diagnostics.sharedGeometries,3);assert.equal(after.diagnostics.sharedGeometries,3);assert.equal(after.diagnostics.materials,2);assert.equal(after.diagnostics.addedShadowMaps,0);
  const stats=f=>({plants:f.diagnostics.plants,batches:f.diagnostics.batches,instanceBytes:f.root.children.reduce((n,m)=>n+m.instanceMatrix.array.byteLength+m.instanceColor.array.byteLength,0),allVisibleTriangles:f.root.children.reduce((n,m)=>n+m.count*m.geometry.attributes.position.count/3,0)});
  report.before=stats(before);report.after=stats(after);report.delta=Object.fromEntries(Object.keys(report.before).map(k=>[k,report.after[k]-report.before[k]]));
  assert.ok(report.delta.batches<=2);assert.equal(report.delta.instanceBytes,report.delta.plants*76);
  const oldBins=new Set(before.root.children.map(m=>m.name));report.newBins=after.root.children.filter(m=>!oldBins.has(m.name)).map(m=>m.name);
  for(const m of after.root.children){assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,false);assert.ok(m.material.userData.rootedWind);assert.equal(m.instanceMatrix.array.length,m.count*16);}
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,import.meta.url))).digest('hex');
  assert.equal(hash('../coastal-understory.js'),hash('../output/qa-runtime/island-environment-v68/coastal-understory.js'));
 }finally{before.dispose();after.dispose();}
 fs.writeFileSync(new URL('../output/island-court-understory-census.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
});
