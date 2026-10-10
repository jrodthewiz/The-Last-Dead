import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {capeGroundHeight,capeNaturalHeight,groundAt} from '../coastal-terrain.js';
import {CAPE_ROOT_FOOTING,capeRootFootingFields} from '../coastal-root-footing.js';
import {canStand,newRun,eye,castGroundRay} from '../engine.js';

test('one existing visible footing has real shared convex shoulder and sheltered lee hollow',()=>{
 const c=makeHarborCourse({openWorld:true}),p=CAPE_ROOT_FOOTING,t=c.coastal.forestPlacements.find(t=>t.id===p.treeId);
 assert.equal(t.x,p.x);assert.equal(t.z,p.z);assert.equal(t.y,capeGroundHeight(t.x,t.z));
 let peak=0,low=0;
 for(let x=330;x<=342;x+=.25)for(let z=381;z<=394;z+=.25){
  const delta=capeGroundHeight(x,z)-capeGroundHeight(x,z,{rootFooting:false}),f=capeRootFootingFields(x,z);
  peak=Math.max(peak,delta);low=Math.min(low,delta);
  assert.ok([f.height,f.cover,f.litter,f.moss,f.mineral].every(Number.isFinite));assert.ok(Math.abs(f.litter+f.moss+f.mineral-1)<1e-12);
 }
 assert.ok(peak>=.45&&peak<=.55);assert.ok(low<=-.20&&low>=-.25);
 const flankX=p.x+.1*p.upX-.85*p.upZ,flankZ=p.z+.1*p.upZ+.85*p.upX;
 assert.ok(capeRootFootingFields(flankX,flankZ).mineral>.6,'mineral reveals the existing asymmetric root-bearing flank');
 assert.ok((flankX-p.x)*(340-p.x)+(flankZ-p.z)*(376-p.z)>0,'mineral face is ahead of the stem from the unchanged camera');
 assert.ok(capeRootFootingFields(flankX,flankZ).height>0,'exposed flank is convex actual ground rather than the hollow floor');
 assert.ok(capeRootFootingFields(337,386).moss>.6,'moss belongs to the physical lee hollow');
 assert.ok(capeRootFootingFields(p.x-2*p.upX-.65*p.upZ,p.z-2*p.upZ+.65*p.upX).moss>.6,'retention apron reaches beyond the one-square-metre hollow');
 for(let x=338.5;x<=341.5;x+=.125)for(let z=380;z<=395;z+=.125){assert.equal(capeGroundHeight(x,z),capeGroundHeight(x,z,{rootFooting:false}));assert.ok(canStand(c,x/4,z/4,.16));}
 for(const [x,z]of [[330,387],[342,387],[336,381],[336,394],[323,388],[410,382],[395,264]])assert.equal(capeNaturalHeight(x,z),capeNaturalHeight(x,z,{rootFooting:false}),'no relief outside the one-footing support');
 const changedTrees=c.coastal.forestPlacements.filter(t=>Math.abs(capeGroundHeight(t.x,t.z)-capeGroundHeight(t.x,t.z,{rootFooting:false}))>1e-8);assert.deepEqual(changedTrees.map(t=>t.id),[p.treeId]);
 const changedPlants=c.coastal.understoryPlacements.filter(t=>Math.abs(capeGroundHeight(t.x,t.z)-capeGroundHeight(t.x,t.z,{rootFooting:false}))>1e-8);assert.equal(changedPlants.length,48);for(const t of changedPlants)assert.equal(t.y,capeGroundHeight(t.x,t.z));
 const r=newRun(c);r.x=337/4;r.y=386/4;assert.equal(eye(r),groundAt(c,r.x,r.y)+.4);assert.ok(Number.isFinite(castGroundRay(c,r.x,r.y,eye(r),0,-1,2)),'ground rays see the same local hollow');
});
