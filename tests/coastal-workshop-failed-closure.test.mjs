import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeHarborCourse} from '../output/qa-runtime/island-environment-v82/harbor-course.js';
import {createModel as createBaselineModel} from '../output/qa-runtime/island-environment-v82/assets/blackwater-kit/architecture.js';
import {createModel,createFailedClosurePlan} from '../assets/blackwater-kit/architecture.js';
import {makeCoastalCityLife} from '../coastal-city-life-layout.js';
const c=makeHarborCourse({openWorld:true,cityLootSeed:7317}),index=c.coastal.blackwaterSlice.buildings.findIndex(b=>b.id==='coast-lot-3-0-1-0'),b=c.coastal.blackwaterSlice.buildings[index],
 options={kind:b.kind,width:b.width,depth:b.depth,height:b.height,districtProfile:b.districtProfile,seed:b.seed??1400+index,enterable:!!b.enterable,doorOffset:b.doorOffset??2,label:b.label},
 old=createBaselineModel(options),control=createModel({...options,failedClosure:false}),changed=createModel({...options,failedClosure:true}),
 bySlot=model=>Object.fromEntries(model.root.children.filter(m=>m.isMesh).map(m=>[m.userData.blackwaterSlot,m.geometry])),
 oldSlots=bySlot(old),controlSlots=bySlot(control),newSlots=bySlot(changed),
 report={scope:'Prepared CPU opt-in closure proof; original native views still required',owner:b.id,seed:options.seed,plan:createFailedClosurePlan(options)};
const equalGeometry=(a,b)=>{assert.deepEqual(a.index.array,b.index.array);assert.deepEqual(Object.keys(a.attributes),Object.keys(b.attributes));for(const key of Object.keys(a.attributes))assert.deepEqual(a.attributes[key].array,b.attributes[key].array);};
test('false opt-in is byteexact with frozen architecture and no other material-slot RNG changes',()=>{
 assert.deepEqual(control.colliders,old.colliders);assert.deepEqual(control.diagnostics.plan,old.diagnostics.plan);
 for(const slot of Object.keys(oldSlots))equalGeometry(controlSlots[slot],oldSlots[slot]);
 assert.deepEqual(changed.colliders,old.colliders);
 for(const slot of Object.keys(oldSlots).filter(s=>!['wood','fabric'].includes(s)))equalGeometry(newSlots[slot],oldSlots[slot]);
});
test('existing horizontal sash sags around its real right frame with attached gravity cloth',()=>{
 assert.equal(changed.diagnostics.moduleCounts['failed-attached-glazing-sash'],1);
 assert.equal(changed.diagnostics.moduleCounts['window-sash'],old.diagnostics.moduleCounts['window-sash']-1);
 assert.equal(changed.diagnostics.moduleCounts['board-nail'],old.diagnostics.moduleCounts['board-nail']);
 assert.equal(changed.diagnostics.trianglesPerModule['closure-caught-folded-cloth'],8);
 const p=changed.diagnostics.plan.failedClosure;assert(Math.abs(p.anchor[0]-11.59)<1e-9);assert(Math.abs(p.anchor[1]-1.83)<1e-9);assert(Math.abs(p.anchor[2]-5.81)<1e-9);
 assert.equal(p.roll,.05);assert.deepEqual(changed.diagnostics.plan.door,old.diagnostics.plan.door);assert.deepEqual(changed.diagnostics.plan.reservedZones,old.diagnostics.plan.reservedZones);
 const fabric=newSlots.fabric.attributes.position.array,points=[];
 for(let i=0;i<fabric.length;i+=3)if(fabric[i]>11.4&&fabric[i]<11.7&&fabric[i+1]>1.2&&fabric[i+1]<1.9&&fabric[i+2]>5.84&&fabric[i+2]<6.04)points.push([fabric[i],fabric[i+1],fabric[i+2]]);
 assert.equal(points.length,24,'eight real cloth triangles contain all authored vertices');
 const bounds={min:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...points.map(p=>p[k])))};
 assert(bounds.min[1]>1.2);assert(bounds.max[1]<1.9);assert(bounds.max[2]<=6.06);assert(bounds.min[0]>11.4&&bounds.max[0]<11.7);
 for(const g of Object.values(newSlots))for(const a of Object.values(g.attributes))assert([...a.array].every(Number.isFinite));
 report.geometry={oldTriangles:old.diagnostics.triangleCount,newTriangles:changed.diagnostics.triangleCount,clothBounds:bounds};
});
test('two supported front-seam papers append without changing roots, stock or any collider',()=>{
 const clean={...c,obstacles:c.obstacles.filter(p=>!p.id?.startsWith('city-life-'))},data=makeCoastalCityLife(clean,{burntDrain:false,seed:7317,extraExclusions:[{minX:85,maxX:108,minZ:100,maxZ:119}]}),
  community=data.communities.find(p=>p.story==='abandoned-workshop-frontage'),papers=data.parts.filter(p=>p.role==='fallen-failed-closure-paper');
 assert.equal(papers.length,2);assert.deepEqual(data.obstacles,c.coastal.cityLife.obstacles);
 assert.deepEqual(data.parts.filter(p=>p.role!=='fallen-failed-closure-paper'),c.coastal.cityLife.parts);
 for(const p of papers){assert(p.z-p.depth/2>224);assert(p.z+p.depth/2<224.18);assert(p.x+p.width/2<223.9);assert.equal(p.y-p.height/2,.135);}
 assert(data.diagnostics.grass<=544&&data.diagnostics.props<=136);assert(community.props<=8);report.city={...data.diagnostics,papers};
});
test('save closure CPU evidence and release all model ownership',()=>{
 fs.writeFileSync('output/island-workshop-failed-closure-census.json',JSON.stringify(report,null,2)+'\n');old.dispose();control.dispose();changed.dispose();
});



