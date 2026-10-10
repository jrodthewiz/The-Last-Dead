import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as old from '../output/qa-runtime/island-environment-v84/coastal-terrain.js';
import * as live from '../coastal-terrain.js';
import {makeHarborCourse} from '../harbor-course.js';
import {harborRoomAt,roomCollision} from '../harbor-interiors.js';
import {propCanStand} from '../harbor-collision.js';

const source=fs.readFileSync(new URL('../coastal-terrain.js',import.meta.url),'utf8');
let measured=source.replace(/from '(\.\/[^']+)';/g,(_,p)=>`from ${JSON.stringify(new URL('../'+p.slice(2),import.meta.url).href)};`);
measured=measured.replace('export function capeNaturalHeight(x,z,{rootFooting=true,courtRelief=true,residentialRidge=true}={}){','export const cacheWork={natural:0,cornerRequests:0,hits:0};export function capeNaturalHeight(x,z,{rootFooting=true,courtRelief=true,residentialRidge=true}={}){cacheWork.natural++;');
measured=measured.replace('const index=z*CAPE_CORNER_WIDTH+x-128;','const index=z*CAPE_CORNER_WIDTH+x-128;cacheWork.cornerRequests++;if(capeCornerValid[index])cacheWork.hits++;');
measured+='\nexport function retainedCache(){return {heightBytes:capeCornerHeights?.byteLength||0,validBytes:capeCornerValid?.byteLength||0,entries:capeCornerValid?.reduce((n,v)=>n+v,0)||0};}';
assert.notEqual(measured,source);
const next=await import('data:text/javascript;base64,'+Buffer.from(measured).toString('base64'));
const pair=new Float64Array(2),bits=new BigUint64Array(pair.buffer);
let gridComparisons=0,fractionComparisons=0,optionComparisons=0,authorityComparisons=0;
function same(a,b,context){pair[0]=a;pair[1]=b;assert.equal(bits[0],bits[1],context);}

test('lazy bounded default integer corners preserve every frozen Float64 bit over full grid',()=>{
 assert.deepEqual(next.retainedCache(),{heightBytes:0,validBytes:0,entries:0});
 // Option/outside probes must not allocate the default cache.
 for(const [x,z,o]of [[410,380,{rootFooting:false}],[127,380,{}],[410,-1,{}],[448,416,{}]])same(next.capeGroundHeight(x,z,o),old.capeGroundHeight(x,z,o));
 assert.equal(next.retainedCache().heightBytes,0);
 for(let x=128;x<=448;x++)for(let z=0;z<=416;z++){same(next.capeGroundHeight(x,z),old.capeGroundHeight(x,z),`grid ${x}/${z}`);gridComparisons++;}
 assert.deepEqual(next.retainedCache(),{heightBytes:1070856,validBytes:133857,entries:133857});
});

test('triangle fractions, field option variants and borders retain exact frozen authority',()=>{
 for(let x=128;x<448;x+=5)for(let z=0;z<416;z+=7)for(const [u,v]of [[.125,.25],[.5,.5],[.8125,.625]]){
  same(next.capeGroundHeight(x+u,z+v),old.capeGroundHeight(x+u,z+v));fractionComparisons++;
 }
 const sites=[[335.97,387.34],[382.2,262.8],[381.4,273.5],[434.2,25.4],[416.25,110.5],[394,120],[448,416],[127.999,120],[448.001,415.999],[384,-0],[-0,-0],[NaN,380],[410,NaN],[Infinity,Infinity],[-Infinity,-Infinity]];
 const options=[undefined,{}, {bridges:false},...['rootFooting','courtRelief','residentialRidge'].flatMap(key=>[false,null,0,1,'true',NaN].map(value=>({[key]:value}))),{rootFooting:false,courtRelief:false,residentialRidge:false}];
 for(const [x,z]of sites)for(const o of options){same(next.capeGroundHeight(x,z,o),old.capeGroundHeight(x,z,o),`option ${x}/${z}`);optionComparisons++;}
});

test('bridge mutable array overrides stay live after cached exact interpolation',()=>{
 const a=[...old.CAPE_TERRAIN.bridges],b=[...next.CAPE_TERRAIN.bridges];
 try{
  for(const bridge of [222,340,333.25]){
   old.CAPE_TERRAIN.bridges.splice(0,old.CAPE_TERRAIN.bridges.length,bridge);next.CAPE_TERRAIN.bridges.splice(0,next.CAPE_TERRAIN.bridges.length,bridge);
   for(const dx of [-2.151,-2.15,0,2.15,2.151])for(const dz of [-11,-5.3,-5.299,0,5.299,5.3,10.999,11])for(const bridges of [true,false]){
    const x=bridge+dx,z=old.capeStreamZ(bridge)+dz;same(next.capeGroundHeight(x,z,{bridges}),old.capeGroundHeight(x,z,{bridges}));optionComparisons++;
   }
  }
 }finally{old.CAPE_TERRAIN.bridges.splice(0,old.CAPE_TERRAIN.bridges.length,...a);next.CAPE_TERRAIN.bridges.splice(0,next.CAPE_TERRAIN.bridges.length,...b);}
});

async function structuresFor(terrain){
 const body=fs.readFileSync(new URL('../coastal-structures.js',import.meta.url),'utf8').replace("import {groundAt} from './coastal-terrain.js';",'const groundAt=globalThis.__terrainCornerOracleGround;');
 globalThis.__terrainCornerOracleGround=terrain.groundAt;
 const module=await import('data:text/javascript;base64,'+Buffer.from(body+'\n// '+(terrain===old?'old':'new')).toString('base64'));
 delete globalThis.__terrainCornerOracleGround;return module;
}
const oldSupport=await structuresFor(old),newSupport=await structuresFor(next);
function standOracle(terrain,support){
 const line=fs.readFileSync(new URL('../engine.js',import.meta.url),'utf8').match(/^export function canStand\([^\r\n]+/m)?.[0];assert(line);
 return new Function('harborRoomAt','roomCollision','propCanStand','supportAt','groundAt','canStandStructure','structureAt','isStructureWall','STRUCTURE_BODY_HEIGHT','clamp',`return (${line.replace(/^export /,'')});`)(harborRoomAt,roomCollision,propCanStand,support.supportAt,terrain.groundAt,support.canStandStructure,support.structureAt,support.isStructureWall,support.STRUCTURE_BODY_HEIGHT,(x,a,b)=>Math.max(a,Math.min(b,x)));
}
test('actual engine support and stand authority preserve old field values at legal terrain and structure sites',()=>{
 const course=makeHarborCourse({openWorld:true}),before=standOracle(old,oldSupport),after=standOracle(next,newSupport);
 const points=[[58,58],[335.97/4,387.34/4],[382.2/4,262.8/4],[381.4/4,273.5/4],[434.2/4,25.4/4],[222/4,old.capeStreamZ(222)/4],[448/4,416/4],...course.coastal.structures.map(s=>[s.x/4,s.z/4])];
 for(const active of [null,course.harborRooms[0]]){course.activeInterior=active;
  for(const [x,y]of points)for(const feet of [undefined,null,NaN,-Infinity,Infinity,0,old.groundAt(course,x,y),old.groundAt(course,x,y)+.05])for(const radius of [.075,.16,.22]){
   same(next.groundAt(course,x,y),old.groundAt(course,x,y));assert.deepEqual(newSupport.supportAt(course,x,y,feet,{radius,terrainFeet:true}),oldSupport.supportAt(course,x,y,feet,{radius,terrainFeet:true}));assert.equal(after(course,x,y,radius,feet),before(course,x,y,radius,feet));authorityComparisons++;
  }
 }course.activeInterior=null;
});

test('warm repeated default footprint queries remove natural evaluations without adding cache allocations',()=>{
 const start={...next.cacheWork},retained=next.retainedCache();let queryCount=0;
 for(let tick=0;tick<120;tick++)for(let actor=0;actor<56;actor++){
  const x=410+(actor%7)*.125,z=382+Math.floor(actor/7)*.125;same(next.capeGroundHeight(x,z),old.capeGroundHeight(x,z));queryCount++;
 }
 const work={queries:queryCount,baselineDirectCornerEvaluations:queryCount*4,candidateNaturalEvaluations:next.cacheWork.natural-start.natural,cornerRequests:next.cacheWork.cornerRequests-start.cornerRequests,hits:next.cacheWork.hits-start.hits};
 assert.equal(work.candidateNaturalEvaluations,0);assert.equal(work.hits,queryCount*4);assert.deepEqual(next.retainedCache(),retained);
 const report={scope:'CPU exact frozenv84 natural/interpolation oracle; repeated footprint workload is bounded synthetic operation evidence, not native elapsed cost/FPS/VRAM.',gridComparisons,fractionComparisons,optionComparisons,authorityComparisons,work,retainedCache:retained,sourceSHA256:createHash('sha256').update(source).digest('hex')};
 fs.writeFileSync('output/island-terrain-corner-cache-findings.json',JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync('output/island-terrain-corner-cache-findings.md',`# Exact terrain corner cache\n\nFrozenv84 Float64 authority: ${gridComparisons} full-grid, ${fractionComparisons} fraction, ${optionComparisons} option/bridge and ${authorityComparisons} actual engine support/stand comparisons passed. Default warm queries: ${queryCount}, direct corner evaluations ${work.baselineDirectCornerEvaluations} versus ${work.candidateNaturalEvaluations}, cache hits ${work.hits}.\n\nLazy module-local typed arrays retain ${retained.heightBytes+retained.validBytes} bytes maximum. Natural options require stricttrue and all four corners in bounds; other calls use the old direct path. Mutable bridges are read after unchanged interpolation. No native timing/FPS gain claimed.\n`);
});
