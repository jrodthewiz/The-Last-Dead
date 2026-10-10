import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {canStand,castRay} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';
import {groundAt} from '../coastal-terrain.js';
import {harborRoomAt,roomCollision} from '../harbor-interiors.js';
import {propCanStand} from '../harbor-collision.js';
import {createVehicleFleet,createVehiclePhysicsContext} from '../harbor-vehicle-fleet.js';
import {createHarborVehicle} from '../harbor-vehicle.js';

const frozen='output/qa-runtime/island-environment-v81/',url=new URL('../coastal-terrain.js',import.meta.url).href;
async function countedModule(source){
 const measured=source.replace("import {groundAt} from './coastal-terrain.js';",`import {groundAt as terrainGroundAt} from ${JSON.stringify(url)};export let groundSamples=0;function groundAt(...a){groundSamples++;return terrainGroundAt(...a);}`);
 return import('data:text/javascript;base64,'+Buffer.from(measured).toString('base64'));
}
const oldSource=fs.readFileSync(frozen+'coastal-structures.js','utf8'),newSource=fs.readFileSync('coastal-structures.js','utf8');
const old=await countedModule(oldSource),next=await countedModule(newSource);
function functionOracle(source,structures,ground){
 const line=source.match(/^export function canStand\([^\r\n]+/m)?.[0];assert(line,'exact frozen canStand declaration required');
 return new Function('harborRoomAt','roomCollision','propCanStand','supportAt','groundAt','canStandStructure','structureAt','isStructureWall','STRUCTURE_BODY_HEIGHT','clamp',`return (${line.replace(/^export /,'')});`)(harborRoomAt,roomCollision,propCanStand,structures.supportAt,ground,structures.canStandStructure,structures.structureAt,structures.isStructureWall,structures.STRUCTURE_BODY_HEIGHT,(x,a,b)=>Math.max(a,Math.min(b,x)));
}
let oldExtra=0,newExtra=0;
const before=functionOracle(fs.readFileSync(frozen+'engine.js','utf8'),old,(...a)=>{oldExtra++;return groundAt(...a);});
const after=functionOracle(fs.readFileSync('engine.js','utf8'),next,(...a)=>{newExtra++;return groundAt(...a);});
const course=makeHarborCourse({openWorld:true,cityLootSeed:7317});
const points=[[58,58],[20,20],[39.5,62],[83.99,96.83],[95,66],[97,20],[102,96],[55.5,89],[85,89],[110,100],[31.99,30],[112.01,104.01]];
for(const structure of course.coastal.structures)for(const solid of structure.solids.filter(s=>s.support))points.push([(solid.minX+solid.maxX)/2,(solid.minY+solid.maxY)/2]);
let supportComparisons=0,standComparisons=0,fleetComparisons=0;
test('support reuse matches frozen old coalescing and preserves every direct/default exceptional feet behavior',()=>{
 for(const [x,y]of points){const height=groundAt(course,x,y);for(const feet of[undefined,null,NaN,-Infinity,Infinity,-.1,0,height,height+.05,height+1])for(const options of[{}, {stepHeight:0}, {stepHeight:.05,radius:.16}, {minimum:height+.01,ceiling:height+.04}, {stepHeight:NaN,ceiling:NaN}]){
  assert.deepEqual(next.supportAt(course,x,y,feet,options),old.supportAt(course,x,y,feet,options));
  assert.deepEqual(next.supportAt(course,x,y,feet,{...options,terrainFeet:true}),old.supportAt(course,x,y,feet??height,options));supportComparisons+=2;
 }}
});
test('actual engine collisions equal exact frozen function across terrain, supports, interiors and exceptional heights',()=>{
 for(const active of[null,course.harborRooms[0]]){course.activeInterior=active;const samples=active?[...points,[active.x/4,active.z/4],[(active.x-active.width/2)/4,active.z/4]]:points;
  for(const [x,y]of samples)for(const radius of[.075,.16,.22])for(const feet of[undefined,null,NaN,-Infinity,Infinity,0,groundAt(course,x,y)+.05]){
   const expected=before(course,x,y,radius,feet);assert.equal(after(course,x,y,radius,feet),expected);assert.equal(canStand(course,x,y,radius,feet),expected);standComparisons++;
  }
 }course.activeInterior=null;
});
test('real moving fleet and active interior delegation retain exact frozen collision decisions',()=>{
 const fleet=createVehicleFleet(course,createHarborVehicle(course)),a=createVehiclePhysicsContext(course,fleet,{canStand:before,castRay,groundAt}),b=createVehiclePhysicsContext(course,fleet,{canStand,castRay,groundAt});
 try{for(const active of[null,course.harborRooms[0]]){a.facade.activeInterior=b.facade.activeInterior=active;
  for(const moving of[false,true]){if(moving){fleet.cars[0].x+=.13;fleet.cars[0].angle+=.21;}
   const samples=[...points,...fleet.vehicles.flatMap(v=>[[v.x,v.y],[v.x+(v.halfLength||.65)+.15,v.y]])];
   for(const [x,y]of samples)for(const feet of[undefined,null,NaN,0,.2]){assert.equal(canStand(b.facade,x,y,.16,feet),before(a.facade,x,y,.16,feet));fleetComparisons++;}
  }
 }}finally{a.dispose();b.dispose();}
});
test('nullish support query removes exactly one terrain evaluation without weakening explicit-height authority',()=>{
 const plain={w:112,h:104,cells:Array.from({length:112*104},()=>[0,0,0,0]),coastal:{terrain:true,structures:[]}};
 const costs=[];
 for(const feet of[undefined,null,0,NaN]){const a=old.groundSamples+oldExtra,b=next.groundSamples+newExtra;assert.equal(after(plain,58,58,.16,feet),before(plain,58,58,.16,feet));const baseline=old.groundSamples+oldExtra-a,candidate=next.groundSamples+newExtra-b;assert.equal(baseline,feet==null?2:1);assert.equal(candidate,1);costs.push({feet:feet===undefined?'undefined':feet===null?'null':Number.isNaN(feet)?'NaN':feet,baselineGroundAtCalls:baseline,candidateGroundAtCalls:candidate});}
 fs.writeFileSync('output/island-terrain-support-performance-findings.json',JSON.stringify({scope:'Exact frozenv81 function/module CPU oracle using identical current terrain/collision dependencies; no native performance claim',supportComparisons,standComparisons,fleetComparisons,actualAuthoredStructures:course.coastal.structures.length,costs,sourceHashes:{frozenStructures:createHash('sha256').update(oldSource).digest('hex'),candidateStructures:createHash('sha256').update(newSource).digest('hex')}},null,2)+'\n');
});
