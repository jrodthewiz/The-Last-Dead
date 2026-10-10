// Test-only reversible extraction of the explicitly authorized court overlay.
import assert from 'node:assert/strict';
import {makeHarborCourse as makeAccepted} from '../output/qa-runtime/island-environment-v68/harbor-course.js';
const accepted=makeAccepted({openWorld:true}).coastal;
const treeIds=new Set(['coast-tree-108','coast-tree-109','coast-tree-110','coast-tree-111','coast-tree-112','coast-tree-113','cape-forest-court-3']);
const plantIds=new Set(["understory-975","understory-1079","understory-1040","understory-1120","understory-1191","grove-court-shrub-3","grove-court-shrub-9","grove-court-shrub-12","grove-court-shrub-15","grove-court-shrub-24","grove-court-shrub-27","grove-court-shrub-30","grove-court-shrub-33","grove-court-shrub-45","grove-court-shrub-48","grove-court-shrub-51","grove-court-shrub-54","grove-court-shrub-63","grove-court-shrub-66","grove-court-shrub-69","grove-court-shrub-75","grove-court-shrub-87","grove-court-shrub-90","grove-court-shrub-93","grove-court-shrub-96","grove-court-shrub-105","grove-court-shrub-111","grove-court-shrub-114","grove-court-shrub-117","grove-court-shrub-126","grove-court-grass-3","grove-court-grass-9","grove-court-grass-12","grove-court-grass-24","grove-court-grass-27","grove-court-grass-30","grove-court-grass-45","grove-court-grass-48","grove-court-grass-51","grove-court-grass-54","grove-court-grass-63","grove-court-grass-66","grove-court-grass-75","grove-court-grass-96","grove-court-grass-114","grove-court-grass-126","grove-court-grass-129","grove-court-grass-132","grove-court-grass-144","grove-court-grass-147","grove-court-grass-150","grove-court-grass-153","grove-court-grass-168","grove-court-grass-171","grove-court-grass-177"]);
const cached=new WeakMap();
export function historicalRecords(coastal,key){
 let data=cached.get(coastal);if(data?.[key])return data[key];if(!data){data={};cached.set(coastal,data);}
 const prior=accepted[key],priorIds=new Set(prior.map(p=>p.id)),ids=key==='forestPlacements'?treeIds:plantIds,live=new Map(coastal[key].map(p=>[p.id,p]));
 const additions=coastal[key].filter(p=>!priorIds.has(p.id));
 if(key==='forestPlacements')assert.deepEqual(additions.map(p=>p.id),Array.from({length:8},(_,i)=>'cape-forest-court-lane-'+i));else assert.ok(additions.every(p=>p.id.startsWith('court-lane-')));
 assert.deepEqual(coastal[key].filter(p=>priorIds.has(p.id)&&!ids.has(p.id)).map(p=>p.id),prior.filter(p=>!ids.has(p.id)).map(p=>p.id),'unrelated record order remains exact');
 for(const p of prior)if(!ids.has(p.id))assert.deepEqual(live.get(p.id),p,'unrelated accepted record '+p.id+' remains exact');
 return data[key]=prior.map(p=>ids.has(p.id)?p:live.get(p.id));
}
export function historicalCourtCoastal(coastal){
 const forestPlacements=historicalRecords(coastal,'forestPlacements'),understoryPlacements=historicalRecords(coastal,'understoryPlacements');
 const propIDs=new Set(['coast-tree-108','coast-tree-109','coast-tree-110','coast-tree-111','coast-tree-112','coast-tree-113','coast-bench-114','coast-bench-115','coast-bench-116','coast-bench-117']),live=new Map(coastal.neighborhoods.props.map(p=>[p.id,p]));
 assert.deepEqual(coastal.neighborhoods.props.filter(p=>!propIDs.has(p.id)).map(p=>p.id),accepted.neighborhoods.props.filter(p=>!propIDs.has(p.id)).map(p=>p.id));
 const props=accepted.neighborhoods.props.map(p=>{if(propIDs.has(p.id))return p;assert.deepEqual(live.get(p.id),p);return live.get(p.id);});
 return {...coastal,forestPlacements,understoryPlacements,neighborhoods:{...coastal.neighborhoods,props}};
}
export function assertCourtTerrainTotals(d){assert.equal(d.chunks,67);assert.equal(d.triangles,108416);assert.equal(d.courtLane.baseChunks,63);assert.equal(d.courtLane.baseTriangles,106112);assert.equal(d.courtLane.chunks,4);assert.equal(d.courtLane.triangles,2304);}
