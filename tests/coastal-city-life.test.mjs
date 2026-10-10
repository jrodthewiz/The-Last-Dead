import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {makeCoastalCityLife,cityLifeSiteClear} from '../coastal-city-life-layout.js';
import {buildCoastalCityLife} from '../coastal-city-life-visuals.js';
import {attachInteriorCityLoot} from '../coastal-scavenging.js';
import {pickupReachable,createScavengerPack,collectScavengerPickup} from '../scavenger-pack.js';
import {ScavengerCaches} from '../scavenger-pack-ui.js';
import {makeBurntVehicleKit,BURNT_VEHICLE_IDS} from '../assets/blackwater-kit/burnt-vehicle.js';
import {createBuildingPlan} from '../assets/blackwater-kit/architecture.js';
import {createTownWoodMaterial} from '../coastal-town-wood.js';

const course=makeHarborCourse({openWorld:true});
course.scavengerPickups=course.scavengerPickups.filter(p=>!p.cityLoot);course.obstacles=course.obstacles.filter(p=>!p.id?.startsWith('city-life-'));
const old=structuredClone(course.scavengerPickups);
const data=makeCoastalCityLife(course,{burntDrain:false,seed:7317}),loot=attachInteriorCityLoot(course,7317);
const report={scope:'Exact prior-nine fixture with burntDrain:false; integrated-default gutter coverage lives in coastal-burnt-estate-gutter.test.mjs',street:data.diagnostics,communities:data.communities,loot:{old:old.length,added:loot.length,total:course.scavengerPickups.length},wrecks:{}};
test('bounded address pockets replay and preserve actual clearance authority',()=>{
 assert.deepEqual(data,makeCoastalCityLife(course,{burntDrain:false,seed:7317}));assert.equal(data.communities.length,9);assert.equal(data.communities.filter(p=>p.story!=='abandoned-workshop-frontage').length,8);
 assert.ok(data.diagnostics.grass>=400&&data.diagnostics.grass<=544);assert.ok(data.diagnostics.props>=100&&data.diagnostics.props<=136);
 for(const p of data.parts){
  const radius=p.shape==='grass'?p.width/2:Math.hypot(p.width,p.depth)/2;
  if(p.role==='workshop-wall-seam-catch'){
   const owner=data.communities.find(c=>c.id===p.community),view={...course,coastal:{...course.coastal,buildings:course.coastal.buildings.filter(b=>b.id!==owner.address)}};
   assert(p.x-p.width/2>owner.authority.wall.maxX&&p.x+p.width/2<owner.authority.sidewalkLane.minX);assert.ok(cityLifeSiteClear(view,p.x,p.z,radius),p.id);
  }else if(p.role==='fallen-failed-closure-paper'){
   const owner=data.communities.find(c=>c.id===p.community),view={...course,coastal:{...course.coastal,buildings:course.coastal.buildings.filter(b=>b.id!==owner.address)}};
   assert(p.z-p.depth/2>owner.authority.wall.maxZ&&p.z+p.depth/2<owner.authority.wall.maxZ+.18);assert.ok(cityLifeSiteClear(view,p.x,p.z,radius),p.id);
  }else assert.ok(cityLifeSiteClear(course,p.x,p.z,radius,{solid:data.obstacles.some(o=>o.id===p.id)}),p.id);
 }
 const blocked=makeCoastalCityLife(course,{seed:7317,extraExclusions:[{minX:132,maxX:366,minZ:4,maxZ:308}]});assert.equal(blocked.parts.length,0);
});
test('all seeded supplies sit on actual support and can be collected from clear approach',()=>{
 assert.deepEqual(course.scavengerPickups.slice(0,old.length),old);assert.ok(loot.length>0&&loot.length<=72);
 for(const p of loot){
  const b=course.coastal.blackwaterSlice.buildings.find(b=>b.id===p.roomId),f=createBuildingPlan(b).furniture.find(f=>f.id===p.supportId);
  assert.equal(p.visualBaseY,(b.y||0)+.08+f.size[1]+(f.type==='counter'?.0485:0));assert.ok(canStand(course,p.approach.x,p.approach.y,.16),p.id);
  const r={course,mode:'play',health:60,...p.approach,z:0,weapon:0,ownedWeapons:[0],backpack:createScavengerPack(),events:[]};
  assert.ok(pickupReachable(r,course,p),p.id);assert.equal(pickupReachable({...r,x:r.x+10},course,p),false);
  assert.ok(collectScavengerPickup(r,p.id).ok,p.id);
 }
 const copy={...course,coastal:{...course.coastal},scavengerPickups:structuredClone(old)};
 assert.deepEqual(attachInteriorCityLoot(copy,7317),loot);
 const other={...course,coastal:{...course.coastal},scavengerPickups:structuredClone(old)};
 assert.notDeepEqual(attachInteriorCityLoot(other,8319),loot);assert.throws(()=>attachInteriorCityLoot(course,7317));
});
test('all101 visible pickups compact after collection and stay static between changes',()=>{
 const root=new THREE.Group(),renderer=new ScavengerCaches(root,course);assert.equal(renderer.items.length,course.scavengerPickups.length);
 assert.equal(renderer.meshes[0].count,renderer.caseItems.length);const versions=renderer.meshes.map(m=>m.instanceMatrix.version);
 renderer.update([]);assert.deepEqual(renderer.meshes.map(m=>m.instanceMatrix.version),versions);
 renderer.update([loot.at(-1).id]);assert.equal(renderer.meshes[0].count,renderer.caseItems.length-1);renderer.dispose();assert.equal(root.children.length,0);
});
test('city geometry borrows materials and box, owns the bounded seven templates and stationary bins',()=>{
 course.coastal.cityLife=data;const unitBox=new THREE.BoxGeometry(1,1,1),materials=Object.fromEntries(['foliage','wood','dark','paper','rust','fabric'].map(k=>[k,new THREE.MeshBasicMaterial()]));
 let boxDisposed=false;unitBox.addEventListener('dispose',()=>boxDisposed=true);
 const visuals=buildCoastalCityLife({course,unitBox,materials});report.visual=visuals.diagnostics;
 assert.equal(visuals.diagnostics.newMaterials,0);assert.equal(visuals.diagnostics.ownedGeometries,7);assert(visuals.diagnostics.newTemplateTriangles<=1536);
 report.visual.matrixBytes=visuals.root.children.reduce((n,m)=>n+m.instanceMatrix.array.byteLength,0);
 visuals.dispose();assert.equal(boxDisposed,false);unitBox.dispose();for(const m of Object.values(materials))m.dispose();
});
test('real HarborWorld material aliases retain wood parameters without allocating materials',()=>{
 const townWood=createTownWoodMaterial(),marker=new THREE.Mesh();marker.name='TownDetails:wood:box';marker.material=townWood;
 const townRoot=new THREE.Group();townRoot.add(marker);const unitBox=new THREE.BoxGeometry(1,1,1);
 const materials=Object.fromEntries(['coastGrass','coastWhite','rust','dark'].map(k=>[k,new THREE.MeshBasicMaterial()]));
 const v=buildCoastalCityLife({course,unitBox,materials,townDetails:{root:townRoot}});
 const wood=v.root.children.filter(m=>m.material===townWood);assert.ok(wood.length>0);
 report.visual.woodParameterBytes=wood.reduce((n,m)=>n+m.geometry.attributes.townWoodPiece.array.byteLength,0);
 report.visual.visibleTriangles=v.root.children.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3*m.count,0);
 for(const m of wood)assert.equal(m.geometry.attributes.townWoodPiece.count,m.instanceMatrix.count);
 v.dispose();townWood.dispose();unitBox.dispose();for(const m of Object.values(materials))m.dispose();
});
test('four existing wreck IDs carry wheels and an unequal collapsed roof without glass',()=>{
 assert.equal(BURNT_VEHICLE_IDS.length,4);for(const id of BURNT_VEHICLE_IDS)assert.ok(course.coastal.maritime.cars.some(p=>p.id===id),id);
 for(const kind of ['estate','van']){const slots=makeBurntVehicleKit(kind),parts=[...slots.values()].flat();assert.equal(slots.get('glass').length,0);assert.equal(parts.filter(p=>p.userData.part==='CarriedBurntWheel').length,4);
  let tris=0,bytes=0;for(const g of parts){g.computeBoundingBox();assert.ok(g.boundingBox.max.y<1.25);for(const a of Object.values(g.attributes)){assert.ok([...a.array].every(Number.isFinite));bytes+=a.array.byteLength;}if(g.index)bytes+=g.index.array.byteLength;tris+=(g.index?.count||g.attributes.position.count)/3;g.dispose();}report.wrecks[kind]={parts:parts.length,triangles:tris,attributeBytes:bytes};
 }
});
test('write truthful CPU census without native/FPS claims',()=>fs.writeFileSync('output/island-city-life-census.json',JSON.stringify(report,null,2)+'\n'));


