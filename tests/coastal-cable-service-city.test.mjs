import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeHarborCourse} from '../output/qa-runtime/island-environment-v75/harbor-course.js';
import {makeCoastalCityLife,cityLifeSiteClear} from '../coastal-city-life-layout.js';
import {registerImmutablePropObstacles} from '../harbor-collision.js';
import {canStand} from '../engine.js';
const prior=makeHarborCourse({openWorld:true,cityLootSeed:7317}),old=prior.coastal.cityLife;
const clean={...prior,obstacles:prior.obstacles.filter(p=>!p.id?.startsWith('city-life-'))};
const next=makeCoastalCityLife(clean,{burntDrain:false,seed:7317,extraExclusions:[{minX:85,maxX:108,minZ:100,maxZ:119}]}),group=old.communities.find(p=>p.address==='coast-lot-2-1-0-2').id;
const own=next.parts.filter(p=>p.community===group),world={...clean,coastal:{...clean.coastal,cityLife:next},obstacles:[...clean.obstacles,...next.obstacles]};registerImmutablePropObstacles(world);
const report={scope:'Only receiving-hall city community reauthored; immutablev75 baseline. CPU tests earn no art-score credit.',baseline:old.diagnostics,current:next.diagnostics,community:next.communities.find(p=>p.id===group),parts:own,walkSamples:0};
test('all other seven original communities and records remain byteexact including IDs/order',()=>{
 const original=new Set(old.communities.map(c=>c.id));
 assert.deepEqual(next.parts.filter(p=>p.community!==group&&original.has(p.community)),old.parts.filter(p=>p.community!==group));
 assert.deepEqual(next.communities.filter(p=>p.id!==group&&original.has(p.id)),old.communities.filter(p=>p.id!==group));
 const oldIDs=new Set(old.parts.filter(p=>p.community===group).map(p=>p.id)),newIDs=new Set(own.map(p=>p.id));
 assert.deepEqual(next.obstacles.filter(p=>!newIDs.has(p.id)),old.obstacles.filter(p=>!oldIDs.has(p.id)));
 assert.deepEqual(prior.coastal.forestPlacements,world.coastal.forestPlacements);assert.deepEqual(prior.coastal.townDetails,world.coastal.townDetails);
 assert.deepEqual(next,makeCoastalCityLife(clean,{burntDrain:false,seed:7317,extraExclusions:[{minX:85,maxX:108,minZ:100,maxZ:119}]}));
 assert(next.diagnostics.grass>=400&&next.diagnostics.grass<=544);assert(next.diagnostics.props<=136);
});
test('service loads are carried by unequal bases and every new envelope clears existing authority',()=>{
 const bases=own.filter(p=>p.role==='cable-service-carried-load'),tops=own.filter(p=>p.role==='unequal-splice-parts-load');assert.equal(bases.length,2);assert.equal(tops.length,2);
 assert.notEqual(bases[0].height,bases[1].height);
 for(const p of own){const radius=p.shape==='grass'?p.width/2:Math.hypot(p.width,p.depth)/2;assert(cityLifeSiteClear(clean,p.x,p.z,radius,{solid:next.obstacles.some(o=>o.id===p.id)}),p.id);assert(p.x-radius>=292||p.x+radius<=288,'entire receiving4m remains free of this community');}
 for(const [i,p]of tops.entries()){const base=bases[i];assert(Math.abs(p.y-p.height/2-(base.y+base.height/2))<1e-9);assert(Math.abs(p.x-base.x)+p.width/2<=base.width/2);assert(Math.abs(p.z-base.z)+p.depth/2<=base.depth/2);}
 const grass=own.filter(p=>p.shape==='grass');assert(grass.length>0);assert(grass.every(p=>p.role==='cable-service-wall-root-seam'));
 assert(own.some(p=>p.role==='fallen-cable-maintenance-board'));assert(own.some(p=>p.shape==='barrier'));
});
test('actual receiving centre has2m clear corridor and accepted25court routes remain unblocked',()=>{
 for(let z=114;z<=132;z+=.25)for(const x of[289.5,290,290.5]){assert(canStand(world,x/4,z/4,.125),'receiving2m capsule lane '+x+','+z);report.walkSamples++;}
 const interiors=world.coastal.blackwaterSlice.interiors.filter(p=>p.id.startsWith('coast-lot-4-1-')),traces=[[[240.5,268],[383.5,268]],...interiors.map(p=>[[p.rearDoor.x,p.rearDoor.z+(p.rearDoor.z<268?.5:-.5)],[p.rearDoor.x,268]]),...world.coastal.neighborhoods.alleys.filter(p=>p.zone==='coastal-park'&&p.width===4&&p.x>240&&p.x<360&&p.z>=240&&p.z<=296).map(p=>[[p.x,p.z-p.depth/2+.5],[p.x,p.z+p.depth/2-.5]])];assert.equal(traces.length,25);
 let n=0;for(const[a,b]of traces){const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),count=Math.ceil(length*2);for(let i=0;i<=count;i++)for(const o of[-1.5,0,1.5]){assert(canStand(world,(a[0]+dx*i/count-dz/length*o)/4,(a[1]+dz*i/count+dx/length*o)/4,.08));n++;}}report.court={routes:25,samples:n,blocked:0};
});
test('save experiment CPU ledger',()=>fs.writeFileSync('output/island-cable-service-city-census.json',JSON.stringify(report,null,2)+'\n'));

