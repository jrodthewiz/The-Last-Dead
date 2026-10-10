import {historicalRecords,historicalCourtCoastal,assertCourtTerrainTotals} from './coastal-court-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {capeGroundHeight,capeNaturalHeight,groundAt} from '../coastal-terrain.js';
import {CAPE_RESIDENTIAL_TRANSITION} from '../coastal-residential-fields.js';
import {buildCapeTerrain} from '../coastal-terrain-visuals.js';
import {canStand,newRun,eye,castGroundRay} from '../engine.js';
import {RIDGE_Y_RECORDS,preRidgeRecords} from './coastal-ridge-authority.mjs';

test('exact measured support IDs re-ground while full immutable authoring and all trunk proxies stay intact',()=>{
 const c=makeHarborCourse({openWorld:true});
 for(const [key,count,changed,digest]of [['forestPlacements',554,56,'ef653fa16895751b8742433ff5b76ea44724c9cc325569781da654ef6ad672f7'],['understoryPlacements',4403,1075,'0566b8f5868d5be2e60c53c758b6c92bdd7951fda93168c6d5eca352bc3008bb']]){
  assert.ok(c.coastal[key].length>=count);const old=preRidgeRecords(historicalRecords(c.coastal,key).slice(0,count)),ids=old.flatMap((p,i)=>p===historicalRecords(c.coastal,key)[i]?[]:[p.id]);
  assert.equal(ids.length,changed);assert.deepEqual(ids,RIDGE_Y_RECORDS[key]);
  assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),digest,'FULL original records exact after only listed Y updates');
 }
 for(const t of c.coastal.forestPlacements)assert.ok(c.obstacles.some(o=>o.id===t.id));
 for(const id of RIDGE_Y_RECORDS.understoryPlacements)assert.ok(!c.obstacles.some(o=>o.id===id),'soft support changes create no proxy');
});

test('one unequal raised bank shelters two actual lower lee basins without a town/shore retaining wall',()=>{
 const height=(x,z)=>capeGroundHeight(x,z),delta=(x,z)=>height(x,z)-capeGroundHeight(x,z,{residentialRidge:false});
 assert.ok(height(432,24)>5&&height(432,84)>3.5&&height(432,24)>height(432,84)+1,'two unequal shoulders remain geographic hierarchy');
 assert.ok(delta(412,24)<-.35&&delta(412,84)<-.15&&delta(407,84)<-.44,'two unequal lee basins retain a deeper western toe');
 assert.ok(height(412,24)<0&&height(412,84)<0);
 assert.ok(height(420,24)>height(412,24)+1,'town-facing lee grade supports the old canopy rather than a flat pedestal');
 assert.ok(height(442,65)===capeGroundHeight(442,65,{residentialRidge:false}),'original coastal camera remains in the existing low access');
 for(const [x,z]of [[394,24],[446,24],[432,6],[432,111],[448,25],[384,25],[410,120],[335,387],[410,382],[327,169]])assert.equal(capeNaturalHeight(x,z),capeNaturalHeight(x,z,{residentialRidge:false}));
 let peak=0,low=0,grade=0;
 for(let x=393;x<=447;x+=.5)for(let z=5;z<=112;z+=.5){
  const d=delta(x,z);assert.ok(Number.isFinite(d));peak=Math.max(peak,d);low=Math.min(low,d);
  const h=height(x,z);grade=Math.max(grade,Math.hypot((height(x+.25,z)-h)/.25,(height(x,z+.25)-h)/.25));
 }
 assert.ok(peak>4&&peak<=4.2+1e-12);assert.ok(low<-.44&&low>=-.45-1e-12);assert.ok(grade<.75,'no cliff-like step or unsupported vertical retaining face');
});

test('entire bent access stays at old canonical height and actual traversal/eye/ray authority follows new slopes',()=>{
 const c=makeHarborCourse({openWorld:true});
 for(const p of CAPE_RESIDENTIAL_TRANSITION.traces)for(let x=393;x<=447;x+=.5){
  const dx=x-384,centre=p.z+dx*p.slope+p.bend*Math.sin(dx*p.frequency);
  for(let offset=-3;offset<=3;offset+=.25){const z=centre+offset*Math.sqrt(1+p.slope*p.slope);
   assert.equal(capeGroundHeight(x,z),capeGroundHeight(x,z,{residentialRidge:false}),'full route is protected through actual one-metre interpolation');
   if(Math.abs(offset)<1&&x<=443)assert.ok(canStand(c,x/4,z/4,.10),'existing access stays traversable');
  }
 }
 for(const [x,z]of [[438,24],[438,84],[438,40]]){
  assert.ok(canStand(c,x/4,z/4,.1));const r=newRun(c);r.x=x/4;r.y=z/4;
  assert.equal(eye(r),groundAt(c,r.x,r.y)+.4);assert.ok(Number.isFinite(castGroundRay(c,r.x,r.y,eye(r),0,-1,2)));
 }
});

test('ridge changes existing front vertices/normals only and retains pooled resources and exact render/query ground',()=>{
 const c=makeHarborCourse({openWorld:true}),world={course:c,root:new THREE.Group(),materials:{},diagnostics:{},box(){}},art=buildCapeTerrain(world);
 try{
  const front=art.root.children.filter(o=>o.name.startsWith('CapeTerrain:')&&o.geometry.attributes.position.getZ(0)<120);
  assert.equal(front.length,8);assert.equal(front.reduce((s,o)=>s+o.geometry.attributes.position.count/3,0),15360);assert.equal(new Set(front.map(o=>o.material)).size,1);
  let affected=0;
  for(const mesh of front){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
   for(let i=0;i<p.count;i++){
    assert.ok(Math.abs(p.getY(i)-capeGroundHeight(p.getX(i),p.getZ(i),{bridges:false}))<1e-6);
    assert.ok([n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite));
    if(Math.abs(p.getY(i)-capeGroundHeight(p.getX(i),p.getZ(i),{residentialRidge:false}))>.1)affected++;
   }
  }
  assert.ok(affected>1000,'one broad existing mesh body changes, not a few decorative vertices');
  assert.equal(world.diagnostics.terrain.chunks,67);assert.equal(world.diagnostics.terrain.triangles,108416);
  assert.equal(world.diagnostics.terrain.bankDetail.triangles,45438);assert.equal(world.diagnostics.terrain.bankDetail.batches,43);
  assert.equal(c.coastal.forestPlacements.length,562);assert.equal(c.coastal.understoryPlacements.slice(0,4403).length,4403);
 }finally{art.dispose();art.dispose();}assert.equal(world.root.children.length,0);
});
