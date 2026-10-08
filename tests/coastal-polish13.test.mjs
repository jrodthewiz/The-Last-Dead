import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand,newRun,tick} from '../engine.js';
import {createBuildingPlan} from '../assets/blackwater-kit/architecture.js';
import {makeCoastalUnderstory,understoryClear} from '../coastal-understory-layout.js';
import {capeGroundHeight,capePathMask} from '../coastal-terrain.js';
import {createCoastalUnderstory} from '../coastal-understory.js';
import {ScavengerCaches} from '../scavenger-pack-ui.js';
import {createUtilityPickup} from '../assets/blackwater-kit/utility-pickup.js';
import {upgradeWeapon,workbenchAccess,weaponDamageMultiplier,tickScavengerPack} from '../scavenger-pack.js';

const course=()=>makeHarborCourse({openWorld:true});
const setup=()=>{const c=course(),s=c.coastal.workbenches.find(s=>s.name==='HARBOR HARDWARE');
  return{c,s,r:{course:c,...s.approach,z:0,health:100,mode:'play',ownedWeapons:[0,4,5,6,7],weapon:0,backpack:{scrap:12,collected:[],weaponMods:{},weaponPickups:[]},events:[]}};};

test('all 46 repair stations come from their actual furniture and have walkable approaches',()=>{
  const c=course();assert.equal(c.coastal.workbenches.length,46);
  for(const s of c.coastal.workbenches){const b=c.coastal.blackwaterSlice.buildings.find(b=>b.id===s.buildingId);
    const item=createBuildingPlan(b).furniture.find(f=>`${b.id}:${f.id}`===s.id);
    assert.equal(item.type,'workbench');assert.ok(canStand(c,s.approach.x,s.approach.y,.16),s.id);
    assert.ok(Math.abs(s.itemZ*4-(b.y+.08+item.size[1]))<1e-7);}
  assert.ok(c.coastal.landmarks.some(p=>p.id==='hardware-bench'));
});
test('fittings reject distance, walls, jumping and another floor without spending scrap',()=>{
  const {r,s}=setup();r.x=2;r.y=2;assert.equal(upgradeWeapon(r).reason,'workbench');
  r.x=220.2/4;r.y=s.y;assert.ok(Math.hypot(r.x-s.x,r.y-s.y)<s.reach);assert.equal(upgradeWeapon(r).reason,'workbench');
  Object.assign(r,s.approach,{z:.20});assert.equal(upgradeWeapon(r).reason,'workbench');
  r.z=0;s.floorZ+=1;assert.equal(upgradeWeapon(r).reason,'workbench');
  assert.equal(r.backpack.scrap,12);assert.deepEqual(r.backpack.weaponMods,{});assert.equal(r.events.length,0);
  r.x=NaN;assert.equal(workbenchAccess(r).available,false);
});
test('repair transaction is exactly once, uses actual damage and works with the paused backpack',()=>{
  const {r,s}=setup();r.mode='pause';assert.equal(workbenchAccess(r).station.id,s.id);
  assert.equal(upgradeWeapon(r,4).ok,true);assert.equal(r.backpack.scrap,4);assert.equal(weaponDamageMultiplier(r,4),1.25);
  assert.equal(upgradeWeapon(r,4).reason,'already-fitted');assert.equal(r.backpack.scrap,4);
  assert.equal(upgradeWeapon(r,3).reason,'unowned');assert.equal(r.events.length,1);
  assert.equal(weaponDamageMultiplier(r,5),1);
});
test('legacy fitting remains available and station discovery only fires on entering a station',()=>{
  const {r}=setup();r.course.scavengerPickups=[];tickScavengerPack(r);tickScavengerPack(r);
  assert.equal(r.events.filter(e=>e.type==='workbench-prompt').length,1);
  r.x=2;r.y=2;tickScavengerPack(r);Object.assign(r,r.course.coastal.workbenches.find(s=>s.name==='HARBOR HARDWARE').approach);tickScavengerPack(r);
  assert.equal(r.events.filter(e=>e.type==='workbench-prompt').length,2);
  r.course={};r.backpack.scrap=8;assert.equal(upgradeWeapon(r,5).ok,true);
});
test('overgrowth covers all four zones with seeded roots and clear roads, portals and paths',()=>{
  const c=course(),p=c.coastal.understoryPlacements;
  assert.deepEqual(p,makeCoastalUnderstory(c.coastal));assert.ok(p.length>2000&&p.length<=2600);
  assert.deepEqual(new Set(p.map(p=>p.zone)),new Set(['building-verge','forest-floor','river-bank','eastern-slope']));
  assert.ok(p.some(p=>p.z>390));assert.ok(p.some(p=>p.x>425));
  for(const plant of p){assert.ok(understoryClear(c.coastal,plant.x,plant.z),plant.id);assert.ok(capePathMask(plant.x,plant.z)<=.025);
    const ground=capeGroundHeight(plant.x,plant.z);assert.ok(Math.abs(plant.y-(plant.zone==='building-verge'?Math.max(ground,.135):ground))<1e-8);}
});
test('understory shares two geometry/material resources, culls and releases each once',()=>{
  const c=course(),art=createCoastalUnderstory({placements:c.coastal.understoryPlacements}),camera=new THREE.PerspectiveCamera();
  assert.equal(art.diagnostics.sharedGeometries,2);assert.equal(art.diagnostics.materials,2);assert.equal(art.diagnostics.addedShadowMaps,0);
  const resources=new Set();art.root.traverse(o=>{if(o.isMesh){assert.equal(o.castShadow,false);o.geometry.computeBoundingBox();assert.equal(o.geometry.boundingBox.min.y,0,'actual plant spine starts at ground');resources.add(o.geometry);resources.add(o.material);}});
  const counts=new Map();for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)||0)+1));
  camera.position.set(214,1.6,26);art.update(camera,3);assert.ok(art.diagnostics.visibleBatches>0&&art.diagnostics.visibleBatches<art.diagnostics.batches);
  camera.position.set(-2000,1.6,-2000);art.update(camera,4);assert.equal(art.diagnostics.visibleBatches,0);
  art.dispose();art.dispose();for(const resource of resources)assert.equal(counts.get(resource),1);
});
test('original pickup stays within driving bounds, shares wheels and releases owned resources once',()=>{
  const art=createUtilityPickup(),d=art.diagnostics;
  assert.equal(d.original,true);assert.ok(d.triangles<2500);assert.ok(d.drawCalls<=16);
  assert.ok(d.bounds.min[0]>=-2.6&&d.bounds.max[0]<=2.6);assert.ok(d.bounds.min[2]>=-1.2&&d.bounds.max[2]<=1.2);assert.ok(Math.abs(d.bounds.min[1])<1e-6);
  const wheels=art.root.children.filter(o=>o.name.startsWith('PickupWheel'));assert.equal(wheels.length,4);
  assert.equal(wheels[0].children[0].geometry,wheels[3].children[0].geometry);
  art.update({distance:1,speed:1});assert.ok(wheels.every(w=>w.rotation.z<0));
  const resources=new Set(),counts=new Map();art.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});
  for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)||0)+1));art.dispose();art.dispose();for(const r of resources)assert.equal(counts.get(r),1);
});
test('residents now start inside three distinct buildings and at a forest edge, with the same population',()=>{
  const c=course();assert.equal(c.harborSpawns.length,8);assert.equal(c.harborSpawns.filter(p=>p.buildingId).length,3);
  for(const p of c.harborSpawns)assert.ok(canStand(c,p.x,p.y,.16),p.location||'harbor');
  const r=newRun(c);r.mode='play';tick(r,{},1/120);assert.equal(c.enemies.filter(e=>e.resident).length,8);
  assert.ok(c.enemies.every(e=>Number.isFinite(e.groundZ)));
});

test('every coastal cache is represented, including the new case exactly supported on its bench',()=>{
 const c=course(),art=new ScavengerCaches(new THREE.Group(),c);assert.equal(art.items.length,c.scavengerPickups.length);
 const index=art.caseItems.findIndex(p=>p.id==='coast-scrap-saltwind');assert.ok(index>=0);
 const item=art.caseItems[index],matrix=new THREE.Matrix4();art.meshes[0].getMatrixAt(index,matrix);art.meshes[0].geometry.computeBoundingBox();
 assert.ok(Math.abs(matrix.elements[13]+art.meshes[0].geometry.boundingBox.min.y-item.itemZ*4)<1e-6);
 art.update([item.id]);assert.equal(art.meshes[0].count,art.caseItems.length-1);art.dispose();
});
