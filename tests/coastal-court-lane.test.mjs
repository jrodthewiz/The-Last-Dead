import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {makeCourse,canStand} from '../engine.js';
import {courtRectDistance,courtLaneSoilAt,courtSubtractRect} from '../coastal-court-lane.js';
import {buildCapeTerrain} from '../coastal-terrain-visuals.js';
import {buildCoastalNeighborhood} from '../coastal-neighborhood-visuals.js';
import {makeHarborCourse as makeOld} from '../output/qa-runtime/island-environment-v68/harbor-course.js';
import {buildCapeTerrain as buildOld} from '../output/qa-runtime/island-environment-v68/coastal-terrain-visuals.js';
const c=makeHarborCourse({...makeCourse(),openWorld:true}),old=makeOld({...makeCourse(),openWorld:true}),plan=c.coastal.courtLane;
test('exact authored overlay preserves unrelated forest, obstacle authority and real door access',()=>{
 assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.access));assert.equal(plan.access.length,26);assert.equal(c.coastal.forestPlacements.length,562);
 const changed=new Set(['coast-tree-108','coast-tree-109','coast-tree-110','coast-tree-111','coast-tree-112','coast-tree-113','cape-forest-court-3']);
 assert.deepEqual(c.coastal.forestPlacements.slice(0,554).filter(t=>!changed.has(t.id)),old.coastal.forestPlacements.filter(t=>!changed.has(t.id)));
 assert.deepEqual(c.coastal.forestPlacements.slice(554).map(t=>t.id),plan.trees.filter(t=>t.id.startsWith('cape-forest-court-lane-')).map(t=>t.id));
 const allIDs=new Set([...changed,...plan.trees.map(t=>t.id),...plan.benches.map(b=>b.id),...plan.retiredBenchIds]);
 assert.deepEqual(c.obstacles.filter(o=>!allIDs.has(o.id)),old.obstacles.filter(o=>!allIDs.has(o.id)));
 assert.equal(c.obstacles.length,old.obstacles.length+6);
 for(const t of [...plan.trees,plan.relocation]){assert.equal(c.obstacles.filter(o=>o.id===t.id).length,1);for(const r of plan.access)assert.ok(courtRectDistance(t.x,t.z,r)>=t.collisionRadius+.32);}
 for(const b of plan.benches){assert.equal(b.baseY+.05,0);assert.equal(c.coastal.neighborhoods.props.find(p=>p.id===b.id).baseY,-.05);}
 for(const id of plan.retiredBenchIds)assert.ok(!c.obstacles.some(o=>o.id===id));
 const ref=JSON.parse(fs.readFileSync(new URL('../output/island-court-lane-revised-preflight-v70.json',import.meta.url)));assert.deepEqual(plan.access,ref.routeRectangles);
 let n=0;const walk=(a,b)=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length*2),normal=[-(b[1]-a[1])/length,(b[0]-a[0])/length];for(let i=0;i<=count;i++)for(const offset of[-1.5,0,1.5]){const x=a[0]+(b[0]-a[0])*i/count+normal[0]*offset,z=a[1]+(b[1]-a[1])*i/count+normal[1]*offset;assert.ok(canStand(c,x/4,z/4,.08),'actual route '+x+','+z);n++;}};
 walk([240.5,268],[383.5,268]);for(const p of c.coastal.blackwaterSlice.interiors.filter(p=>p.id.startsWith('coast-lot-4-1-')))if(p.rearDoor)walk([p.rearDoor.x,p.rearDoor.z+(p.rearDoor.z<268?.5:-.5)],[p.rearDoor.x,268]);assert.equal(n,1653);
 assert.equal(courtLaneSoilAt(plan,318,273,.1),false);assert.equal(courtLaneSoilAt(plan,250,268,.1),false);
});
test('court ground is disjoint, borrows one owner, and all accepted terrain/bank buffers remain exact',()=>{
 const w=course=>({course,root:new THREE.Group(),materials:{},diagnostics:{},box(){}}),world=w(c),prior=w(old);let art,baseline;
 try{art=buildCapeTerrain(world);baseline=buildOld(prior);const meshes=art.root.children.filter(m=>m.name.startsWith('CapeTerrain:')),base=baseline.root.children.filter(m=>m.name.startsWith('CapeTerrain:'));
 assert.equal(world.diagnostics.terrain.courtLane.baseChunks,63);assert.equal(world.diagnostics.terrain.courtLane.baseTriangles,106112);
 for(const m of base){const next=meshes.find(n=>n.name===m.name);assert.ok(next);for(const [key,a]of Object.entries(m.geometry.attributes))assert.deepEqual(next.geometry.attributes[key].array,a.array,'unchanged accepted '+m.name+'/'+key);}
 const geometryLedger=root=>{const result=[];root.traverse(m=>{if(m.isMesh)result.push([m.name,Object.fromEntries(Object.entries(m.geometry.attributes).map(([k,a])=>[k,a.array]))]);});return result;};assert.deepEqual(geometryLedger(art.detail.root),geometryLedger(baseline.detail.root));
 const lane=meshes.filter(m=>m.userData.courtLaneGround);assert.equal(lane.length,4);
 for(const m of lane){assert.equal(m.material,meshes[0].material);const p=m.geometry.attributes.position;for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;assert.ok(![...plan.access,...plan.buildings].some(r=>courtRectDistance(x,z,r)===0),'soil triangle does not overlay access/building');for(let j=0;j<3;j++)assert.equal(p.getY(i+j),0);}}
 let materialDisposals=0;lane[0].material.addEventListener('dispose',()=>materialDisposals++);art.dispose();art.dispose();assert.equal(materialDisposals,1);
 fs.writeFileSync('output/island-v70-court-lane-ground-resources.json',JSON.stringify(world.diagnostics.terrain,null,2)+'\n');
 }finally{art?.dispose();baseline?.dispose();}
});
test('rectangle subtraction and actual bench matrices retain supported disjoint construction',()=>{
 const pieces=courtSubtractRect({minX:128,maxX:374,minZ:120,maxZ:314},plan.domain);assert.equal(pieces.reduce((a,r)=>a+(r.maxX-r.minX)*(r.maxZ-r.minZ),0),246*194-120*16);for(const r of pieces)assert.ok(!(r.minX<360&&r.maxX>240&&r.minZ<276&&r.maxZ>260));
 const materials=Object.fromEntries(['concrete','coastStone','rust','dark','coastWhite','coastLeaves'].map(k=>[k,new THREE.MeshStandardMaterial()]));const world={course:c,root:new THREE.Group(),unitBox:new THREE.BoxGeometry(1,1,1),materials,diagnostics:{}};buildCoastalNeighborhood(world);let bottoms=[];const mat=new THREE.Matrix4();for(const mesh of world.root.children)if(mesh.name==='CoastalStreet:bench')for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,mat);const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();mat.decompose(p,q,s);if(Math.abs(p.x-249.33)<.01&&Math.abs(p.z-273)<.01&&Math.abs(s.y-.5)<.01)bottoms.push(p.y-s.y/2);}assert.ok(bottoms.length);assert.ok(bottoms.every(y=>Math.abs(y)<1e-6));
 world.root.traverse(m=>{if(m.isMesh){m.geometry.dispose();}});Object.values(materials).forEach(m=>m.dispose());world.unitBox.dispose();
 const current=fs.readFileSync(new URL('../forest-vegetation.js',import.meta.url),'utf8').replace('const MAX_TREES = 562;','const MAX_TREES = 554;');assert.equal(current,fs.readFileSync(new URL('../output/qa-runtime/island-environment-v68/forest-vegetation.js',import.meta.url),'utf8'));
});
