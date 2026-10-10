import {historicalRecords,historicalCourtCoastal,assertCourtTerrainTotals} from './coastal-court-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {capeGroundHeight,capeNaturalHeight,groundAt} from '../coastal-terrain.js';
import {CAPE_RESIDENTIAL_TRANSITION,capeResidentialNaturalFields} from '../coastal-residential-fields.js';
import {buildCapeTerrain} from '../coastal-terrain-visuals.js';
import {canStand,newRun,eye} from '../engine.js';

// Immutable v32 authoring digest: only authoritative ground Y may change.
test('front terrain grounds all original plant/tree records without changing authoring',()=>{
 const c=makeHarborCourse({openWorld:true});
 for(const [key,count,digest] of [
  ['forestPlacements',512,'45c3552c2b2c6e10b76b74bfb09fe449c448fcf14ed0ab3aab3ae5d8187ffa0b'],
  ['understoryPlacements',3895,'959bb60e3c987779edbcbf59d8c5859253e2ae2611f85b3f81b3c2b19781aead'],
 ]){
  const records=historicalRecords(c.coastal,key);assert.ok(records.length>=count+(key==='forestPlacements'?12:308),'original prefix and complete court community survive later authorized append cohorts');
  const authored=records.slice(0,count).map(({y,...p})=>p);
  assert.equal(createHash('sha256').update(JSON.stringify(authored)).digest('hex'),digest);
  for(const p of records)assert.ok(Math.abs(p.y-capeGroundHeight(p.x,p.z))<.136,'existing raised city verge exception remains bounded');
  for(const p of records.filter(p=>p.x>=384&&p.z<120))assert.equal(p.y,capeGroundHeight(p.x,p.z));
 }
});

test('unequal dune shoulders and peat hollows retain level traces, town edge and inland authority',()=>{
 // Preserve the accepted original dune-profile contract separately from the
 // authorized ridge, whose actual slopes/authority have their own tests.
 const originalProfile=(x,z)=>capeGroundHeight(x,z,{residentialRidge:false});
 let highest=0,lowest=0,slope=0;
 for(let x=385;x<448;x+=.5)for(let z=0;z<120;z+=.5){
  const h=originalProfile(x,z);assert.ok(Number.isFinite(h));highest=Math.max(highest,h);lowest=Math.min(lowest,h);
  slope=Math.max(slope,Math.hypot((originalProfile(x+.1,z)-h)/.1,(originalProfile(x,z+.1)-h)/.1));
 }
 assert.ok(highest>1.5&&highest<2);assert.ok(lowest<-.15&&lowest>-.3);assert.ok(slope<.65);
 for(let z=0;z<=119;z+=.25)assert.equal(capeGroundHeight(384,z),0);
 assert.equal(capeGroundHeight(384,120),capeNaturalHeight(384,120),'final metre meets unchanged inland edge');
 const c=makeHarborCourse({openWorld:true});
 for(const trace of CAPE_RESIDENTIAL_TRANSITION.traces)for(let x=390;x<=440;x+=.5){
  const dx=x-384,z=trace.z+dx*trace.slope+trace.bend*Math.sin(dx*trace.frequency);
  assert.equal(capeResidentialNaturalFields(x,z).height,0);
  assert.ok(Math.abs(capeGroundHeight(x,z))<.03,'one-metre triangulation retains a level trace');
  assert.ok(canStand(c,x/4,z/4,.16));
 }
 for(const [x,z,h] of [[384,120,.015167756545880026],[410,120,-.14672876332926418],[448,120,0],[430,145,.39134527552227016],[410,264,2.6451288926604444],[323,388,10.698286514533974],[410,382,21.552617041038026],[294,391,8.197460835253198]])assert.equal(capeNaturalHeight(x,z),h,'original inland relief is exact');
 const run=newRun(c);run.x=431/4;run.y=75/4;assert.equal(groundAt(c,run.x,run.y),capeGroundHeight(431,75)/4);assert.equal(eye(run),groundAt(c,run.x,run.y)+.4);
});

test('front mesh uses exact one-metre authority and eight chunks borrowing existing atlas material',()=>{
 const c=makeHarborCourse({openWorld:true}),world={course:c,root:new THREE.Group(),materials:{},diagnostics:{},box(){}};
 const art=buildCapeTerrain(world);
 try{
  const meshes=[];world.root.traverse(o=>{if(o.name.startsWith('CapeTerrain:')&&o.geometry.attributes.position.getZ(0)<120)meshes.push(o);});
  assert.equal(meshes.length,8);assert.equal(new Set(meshes.map(o=>o.material)).size,1);
  assert.equal(meshes.reduce((s,o)=>s+(o.geometry.index?.count??o.geometry.attributes.position.count)/3,0),15360);
  for(const o of meshes){const p=o.geometry.attributes.position,b=o.geometry.attributes.capeBiome;
   for(let i=0;i<p.count;i++){
    assert.ok(Math.abs(p.getY(i)-capeGroundHeight(p.getX(i),p.getZ(i),{bridges:false}))<1e-6);
    const sum=b.getX(i)+b.getY(i)+b.getZ(i)+b.getW(i);
    assert.ok(sum>=-1e-6&&sum<=1+1e-6,'neutral town turf transitions into weighted natural communities');
    if(p.getX(i)===384&&p.getZ(i)<=112)assert.equal(sum,0,'town edge borrows no atlas tint');
   }
  }
  const d=world.diagnostics.terrain;assertCourtTerrainTotals(d);
  assert.equal(d.court.chunks,1);assert.equal(d.court.triangles,640);
  assert.ok(d.front.temporaryUnderlayBytes<3*1024*1024);assert.equal(d.front.sharedMaterial,true);assert.equal(d.front.sharedTextures,true);
 }finally{art.dispose();}
 assert.equal(world.root.children.length,0);
});
