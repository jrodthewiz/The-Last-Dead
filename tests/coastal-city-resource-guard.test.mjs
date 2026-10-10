import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {propCollisionDiagnostics} from '../harbor-collision.js';
import {buildCoastalCityLife} from '../coastal-city-life-visuals.js';
import {createTownWoodMaterial} from '../coastal-town-wood.js';
import {ScavengerCaches,MAX_RENDERED_SCAVENGER_CACHES} from '../scavenger-pack-ui.js';
import {pickupReachable,createScavengerPack} from '../scavenger-pack.js';
import {createVehicleFleet} from '../harbor-vehicle-fleet.js';
import {createHarborVehicle} from '../harbor-vehicle.js';
const c=makeHarborCourse({openWorld:true,cityLootSeed:7317}),report={scope:'Read-only integrated CPU/resource guard; no native draws/FPS or visual-quality verdict',seed:7317,risks:[]};
test('completed seed7317 includes all solid records in immutable final index and loot replay',()=>{
 const d=propCollisionDiagnostics(c);assert(d.registered);assert(Object.isFrozen(c.obstacles));
 const ids=new Set(c.obstacles.map(p=>p.id));for(const o of c.coastal.cityLife.obstacles){assert(ids.has(o.id));assert(!canStand(c,(o.minX+o.maxX)/2,(o.minY+o.maxY)/2,.08),o.id);}
 const replay=makeHarborCourse({openWorld:true,cityLootSeed:7317});assert.deepEqual(c.coastal.cityLife,replay.coastal.cityLife);assert.deepEqual(c.scavengerPickups,replay.scavengerPickups);
 assert.equal(c.scavengerPickups.length,101);assert(c.scavengerPickups.length<=128&&c.scavengerPickups.length<=MAX_RENDERED_SCAVENGER_CACHES);
 for(const p of c.scavengerPickups.filter(p=>p.cityLoot)){assert(canStand(c,p.approach.x,p.approach.y,.16),p.id);assert(pickupReachable({course:c,mode:'play',health:100,z:0,...p.approach,backpack:createScavengerPack()},c,p),p.id);}
 report.collision=d;report.city=c.coastal.cityLife.diagnostics;report.loot=c.coastal.cityLoot;report.loot.total=c.scavengerPickups.length;
});
test('accepted court all25 routes remain clear at full three-lane samples',()=>{
 const coast=c.coastal,interiors=coast.blackwaterSlice.interiors.filter(p=>p.id.startsWith('coast-lot-4-1-'));
 const traces=[{id:'main',a:[383.5,268],b:[240.5,268]},...interiors.map(p=>({id:p.id,a:[p.rearDoor.x,p.rearDoor.z+(p.rearDoor.z<268?.5:-.5)],b:[p.rearDoor.x,268]})),...coast.neighborhoods.alleys.filter(a=>a.zone==='coastal-park'&&a.width===4&&a.x>240&&a.x<360&&a.z>=240&&a.z<=296).map((p,i)=>({id:'side-'+i,a:[p.x,p.z-p.depth/2+.5],b:[p.x,p.z+p.depth/2-.5]}))];
 assert.equal(traces.length,25);let samples=0;const blocked=[];
 for(const t of traces){const dx=t.b[0]-t.a[0],dz=t.b[1]-t.a[1],l=Math.hypot(dx,dz),n=Math.ceil(l*2);for(let i=0;i<=n;i++)for(const offset of[-1.5,0,1.5]){const x=t.a[0]+dx*i/n-dz/l*offset,z=t.a[1]+dz*i/n+dx/l*offset;samples++;if(!canStand(c,x/4,z/4,.08))blocked.push({id:t.id,x,z});}}
 report.court={routes:traces.length,samples,blocked};assert.deepEqual(blocked,[]);
});
test('borrowed real material owners and stationary instance resources survive repeated idle traversals',()=>{
 const town=new THREE.Group(),wood=createTownWoodMaterial(),holder=new THREE.Mesh();holder.name='TownDetails:wood:box';holder.material=wood;town.add(holder);
 const unitBox=new THREE.BoxGeometry(1,1,1),materials=Object.fromEntries(['coastGrass','coastWhite','rust','dark'].map(k=>[k,new THREE.MeshStandardMaterial()]));
 let borrowedDisposed=0;for(const m of[wood,...Object.values(materials)])m.addEventListener('dispose',()=>borrowedDisposed++);unitBox.addEventListener('dispose',()=>borrowedDisposed++);
 const art=buildCoastalCityLife({course:c,unitBox,materials,townDetails:{root:town}}),meshes=art.root.children;
 const versions=meshes.map(m=>m.instanceMatrix.version),arrays=meshes.map(m=>m.instanceMatrix.array);let matrixBytes=0,parameterBytes=0,triangles=0;
 for(const m of meshes){assert(m.material?.isMaterial);assert.equal(m.matrixAutoUpdate,false);assert(m.geometry.attributes.coastalMatrix0);matrixBytes+=m.instanceMatrix.array.byteLength;parameterBytes+=m.geometry.attributes.townWoodPiece?.array.byteLength||0;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3*m.count;}
 for(let i=0;i<120;i++)art.root.updateMatrixWorld();assert.deepEqual(meshes.map(m=>m.instanceMatrix.version),versions);meshes.forEach((m,i)=>assert.equal(m.instanceMatrix.array,arrays[i]));
 report.visual={...art.diagnostics,matrixBytes,parameterBytes,allVisibleTriangles:triangles,initialMatrixVersions:[...new Set(versions)],idleVersionChanges:0,shadowBins:meshes.filter(m=>m.castShadow).length};
 art.dispose();assert.equal(borrowedDisposed,0);wood.dispose();unitBox.dispose();Object.values(materials).forEach(m=>m.dispose());
});
test('pickup capacity is bounded and all records stay visible with no idle matrix uploads',()=>{
 const art=new ScavengerCaches(new THREE.Group(),c),versions=art.meshes.map(m=>m.instanceMatrix.version);assert.equal(art.items.length,101);
 for(let i=0;i<120;i++)art.update([]);assert.deepEqual(art.meshes.map(m=>m.instanceMatrix.version),versions);
 art.update([c.scavengerPickups.at(-1).id]);assert.equal(art.meshes[0].count,art.caseItems.length-1);art.dispose();
 assert.throws(()=>new ScavengerCaches(new THREE.Group(),{scavengerPickups:Array.from({length:257},(_,i)=>({id:String(i)}))}),RangeError);
 report.pickup={population:101,capacity:256,idleVersionChanges:0,draws:3};
});
test('fleet retains shared world fields and uses bounded retained query arrays; source allocations disclosed',()=>{
 const f=createVehicleFleet(c,createHarborVehicle(c));assert.equal(f.cars.length,16);assert.equal(f.vehicles.length,18);
 const source=fs.readFileSync('harbor-vehicle-fleet.js','utf8'),collision=fs.readFileSync('harbor-collision.js','utf8'),aerial=fs.readFileSync('helicopter-world-collision.js','utf8');
 assert(source.includes("Object.defineProperty(staticCourse,'activeInterior'"));assert(source.includes('get:()=>facade.activeInterior'));
 assert(collision.includes('stamps:new Uint32Array(obstacles.length),candidates:new Uint32Array(obstacles.length)'));assert(aerial.includes('const cache=new WeakMap()'));
 report.fleet={cars:16,wrecks:4,helicopters:1,vehicles:18,facadeReview:'staticCourse.activeInterior reads facade; shallow copied cells/coastal/structure fields, separate immutable obstacles/index',collisionScratchPolicy:'two Uint32Array per finalized index; source/facade/staticCourse indexes are distinct',aerialPolicy:'shared WeakMap construction volumes+buckets; one Uint32Array stamps per context'};
 report.risks.push('Fleet occupied update creates a small per-vehicle adapter object and input spread; aerial blocked queries create transient proxy objects. Source does not prove zero allocations or frame-time budget.','City props add shadow submissions;52bin CPU census is not actual native visible draw count.','Idle matrix versions begin at1 after initial upload; zero reported changes means unchanged versions, not initial version0.');
});
test('save independent CPU guard ledger',()=>fs.writeFileSync('output/island-city-resource-guard.json',JSON.stringify(report,null,2)+'\n'));
