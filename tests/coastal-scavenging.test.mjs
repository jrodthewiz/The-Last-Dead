import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand,castRay,newRun,tick} from '../engine.js';
import {createBuildingPlan} from '../assets/blackwater-kit/architecture.js';
import {coastalLootBlocked,MAX_COASTAL_SUPPLY_CASES} from '../coastal-scavenging.js';
import {createScavengerPack,validateBackpack,pickupReachable,collectScavengerPickup,tickScavengerPack,
  craftBandage,useBandage,discardSupply,supplyCount,SUPPLY_CAPACITY,upgradeWeapon} from '../scavenger-pack.js';
import {collectWeaponPickup} from '../weapon-inventory.js';
import {ScavengerCaches} from '../scavenger-pack-ui.js';
import {buildDungeonWeaponLoot,updateDungeonWeaponLoot} from '../dungeon-weapon-loot.js';
import {coastalMapSvg,coastalTarget} from '../coastal-world-map.js';
import {harborNavigation} from '../harbor-navigation.js';
import {lowTideSnapshot,restoreLowTide} from '../low-tide-save.js';

const course=makeHarborCourse({openWorld:true,lowTide:true,cityLootSeed:7317});
const cases=course.scavengerPickups.filter(p=>p.visualKind==='supply-case'&&!p.cityLoot);
const setup=p=>({course,mode:'play',health:60,...p.approach,z:0,weapon:0,ownedWeapons:[0],
  backpack:createScavengerPack(),events:[]});

test('supply stops and rifles are deterministic supported finds with walkable, reachable approaches',()=>{
  assert.ok(cases.length>=15&&cases.length<=MAX_COASTAL_SUPPLY_CASES);
  assert.deepEqual(course,makeHarborCourse({openWorld:true,lowTide:true,cityLootSeed:7317}));
  assert.equal(new Set(cases.map(p=>p.id)).size,cases.length);
  for(const p of [...cases,...course.weaponPickups.filter(p=>p.displayKind==='stowed')]){
    assert.ok(canStand(course,p.approach.x,p.approach.y,.2),p.id);
    assert.ok(pickupReachable(setup(p),course,p,p.weaponIndex==null?.55:.65),p.id);
    const b=course.coastal.blackwaterSlice.buildings.find(b=>b.id===p.roomId),f=createBuildingPlan(b).furniture.find(f=>f.id===p.supportId);
    assert.ok(f,p.id);assert.ok(p.itemZ>p.floorZ);assert.deepEqual(JSON.parse(JSON.stringify(p)),p);
    if(p.displayKind==='stowed')assert.equal(f.lootSurface,true,'weapon deck has no conflicting stock/radio props');
  }
  for(const p of cases)assert.ok(!course.weaponPickups.some(w=>w.roomId===p.roomId&&w.supportId===p.supportId),'separate support for cases and guns');
});

test('engine Q searches a case once; proximity prompts without collecting and resources stay separate',()=>{
  const p=cases.find(p=>p.contents.antiseptic===2),r=newRun(makeHarborCourse({openWorld:true}));
  Object.assign(r,setup(p));r.course.enemies=[];
  const idle={forward:0,strafe:0};tick(r,1/120,idle);
  assert.equal(supplyCount(r.backpack.supplies),0);
  assert.equal(r.events.filter(e=>e.type==='scavenger-search-prompt').length,1);
  r.events=[];tick(r,1/120,idle);assert.equal(r.events.filter(e=>e.type==='scavenger-search-prompt').length,0);
  tick(r,1/120,{...idle,interact:true});
  assert.equal(r.backpack.supplies.cloth,1);assert.equal(r.backpack.supplies.antiseptic,2);
  assert.equal(r.backpack.scrap,0);assert.ok(r.backpack.collected.includes(p.id));
  assert.equal(collectScavengerPickup(r,p.id).reason,'collected');
});

test('full supplies retain the case; discarding a spare material frees space without deleting other loot',()=>{
  const p=cases.find(p=>p.contents.cloth===3),r=setup(p);
  r.backpack.supplies.cloth=SUPPLY_CAPACITY;
  assert.equal(collectScavengerPickup(r,p.id).reason,'supplies-full');
  assert.ok(!r.backpack.collected.includes(p.id));
  assert.equal(craftBandage(r).ok,false);
  for(let i=0;i<3;i++)assert.equal(discardSupply(r,'cloth').ok,true);
  assert.equal(discardSupply(r,'scrap').reason,'invalid');
  assert.equal(collectScavengerPickup(r,p.id).ok,true);
  assert.equal(supplyCount(r.backpack.supplies),SUPPLY_CAPACITY);
});

test('reach rejects the other floor, sealed cells, furniture occlusion and dead players',()=>{
  const p=cases[0],r=setup(p);
  assert.ok(pickupReachable(r,course,p));
  assert.equal(pickupReachable(r,course,{...p,floorZ:p.floorZ+1}),false);
  r.health=0;assert.equal(collectScavengerPickup(r,p.id).reason,'out-of-reach');
  const c={coastal:{lootSpaces:[{id:'partition',x:0,z:0,y:0,yaw:Math.PI/2,width:8,depth:8,
    furniture:[{position:[0,1,0],size:[.2,2,4]}]}]}};
  assert.equal(coastalLootBlocked(c,{x:0,y:-.4,z:.4},{x:0,y:.4,z:.4}),true);
  assert.equal(coastalLootBlocked(c,{x:0,y:-.4,z:.6},{x:0,y:.4,z:.6}),false);
});

test('paused workshop craft and bandage use are transactional, bounded and do not revive the dead',()=>{
  const station=course.coastal.workbenches.find(p=>p.name==='HARBOR HARDWARE');
  const r=setup(station);r.mode='pause';r.backpack.scrap=8;
  r.backpack.supplies={cloth:6,antiseptic:3,bandage:0};
  const original={...r.backpack.supplies};r.x=2;r.y=2;
  assert.equal(craftBandage(r).reason,'workbench');assert.deepEqual(r.backpack.supplies,original);
  Object.assign(r,station.approach);
  for(let i=0;i<3;i++)assert.equal(craftBandage(r).ok,true);
  assert.equal(craftBandage(r).reason,'bandages-full');
  assert.deepEqual(r.backpack.supplies,{cloth:0,antiseptic:0,bandage:3});
  assert.equal(r.backpack.scrap,8);assert.equal(upgradeWeapon(r,0).ok,true);
  assert.equal(useBandage(r).amount,35);assert.equal(r.health,95);
  assert.equal(useBandage(r).amount,5);assert.equal(r.health,100);
  assert.equal(useBandage(r).reason,'healthy');assert.equal(r.backpack.supplies.bandage,1);
  r.health=0;assert.equal(useBandage(r).reason,'inactive');assert.equal(r.backpack.supplies.bandage,1);
});

test('shared player search, crafting and healing use the shared pouch but heal only the actor',()=>{
  const p=cases[0],r=setup(p),peer={...setup(p),playerId:'peer',world:r};r.x=2;r.y=2;r.peer=peer;
  tickScavengerPack(r,{peerInteract:true});assert.equal(peer.backpack,r.backpack);
  assert.deepEqual(r.backpack.supplies,p.contents.bandage? p.contents:{...p.contents,bandage:0});
  const station=course.coastal.workbenches[0];Object.assign(peer,station.approach);
  r.backpack.supplies={cloth:2,antiseptic:1,bandage:0};
  assert.equal(craftBandage(peer).ok,true);assert.equal(useBandage(peer).ok,true);
  assert.equal(peer.health,95);assert.equal(r.health,60);
});

test('rifles require Q and become owned without changing the current gun; floor mismatch retains them',()=>{
  for(const p of course.weaponPickups.filter(p=>p.displayKind==='stowed')){
    const r=setup(p);
    assert.equal(collectWeaponPickup(r,p.id,{castRay}).reason,'interact');
    p.floorZ+=1;assert.equal(collectWeaponPickup(r,p.id,{castRay,interact:true}).reason,'blocked');p.floorZ-=1;
    assert.equal(collectWeaponPickup(r,p.id,{castRay,interact:true}).ok,true);
    assert.ok(r.ownedWeapons.includes(p.weaponIndex));assert.equal(r.weapon,0);
    assert.equal(collectWeaponPickup(r,p.id,{castRay,interact:true}).reason,'collected');
  }
});

test('one engine Q stashes the indicated rifle without also searching a neighbouring supply case',()=>{
  const c=makeHarborCourse({openWorld:true}),p=c.weaponPickups.find(p=>p.id==='coast-weapon-works'),r=newRun(c);
  Object.assign(r,setup(p),{course:c});c.enemies=[];
  const neighbours=c.scavengerPickups.filter(p=>p.visualKind==='supply-case'&&pickupReachable(r,c,p));
  assert.ok(neighbours.length>0,'real warehouse case overlaps the rifle interaction radius');
  tick(r,1/120,{forward:0,strafe:0,interact:true});assert.ok(r.backpack.weaponPickups.includes(p.id));
  for(let i=0;i<5;i++)tick(r,1/120,{forward:0,strafe:0,interact:true});
  assert.equal(r.backpack.collected.length,0);assert.equal(supplyCount(r.backpack.supplies),0);
  tick(r,1/120,{forward:0,strafe:0,interact:false});tick(r,1/120,{forward:0,strafe:0,interact:true});
  assert.ok(r.backpack.collected.includes(neighbours[0].id));
});

test('supply pouch and consumed cases survive checkpoint restoration; old saves start with an empty pouch',()=>{
  const r=newRun(course);r.lowTide.shelter=true;r.backpack.supplies={cloth:2,antiseptic:3,bandage:1};r.backpack.collected=[cases[0].id];
  const saved=JSON.parse(JSON.stringify(lowTideSnapshot(r))),restored=newRun(makeHarborCourse({openWorld:true,lowTide:true}));
  assert.equal(restoreLowTide(restored,saved),true);assert.deepEqual(restored.backpack.supplies,r.backpack.supplies);
  assert.ok(restored.backpack.collected.includes(cases[0].id));
  assert.deepEqual(validateBackpack({scrap:8}).supplies,{cloth:0,antiseptic:0,bandage:0});
  for(const supplies of [{cloth:-1,antiseptic:NaN,bandage:Infinity},{cloth:99,antiseptic:99,bandage:99}]){
    const s=validateBackpack({supplies}).supplies;assert.ok(supplyCount(s)<=12);assert.ok(Object.values(s).every(Number.isInteger));assert.ok(s.bandage<=3);
  }
});

test('all cache instances render; collections compact colour and transform arrays and release resources once',()=>{
  const pool=new ScavengerCaches(new THREE.Group(),course);
  assert.equal(pool.items.length,course.scavengerPickups.length);assert.equal(pool.meshes.length,3);
  const counts=new Map();for(const m of pool.meshes)for(const resource of [m.geometry,m.material])resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)||0)+1));
  const p=cases[0],i=pool.caseItems.indexOf(p),matrix=new THREE.Matrix4();pool.meshes[0].getMatrixAt(i,matrix);
  assert.ok(Math.abs(matrix.elements[13]-p.visualBaseY)<3e-5);
  const remaining=pool.caseItems.filter(item=>item.id!==p.id);pool.update([p.id]);assert.equal(pool.meshes[0].count,remaining.length);
  for(let j=0;j<remaining.length;j++){pool.meshes[0].getMatrixAt(j,matrix);assert.ok(Math.abs(matrix.elements[12]-remaining[j].x*4)<3e-5);}
  pool.dispose();pool.dispose();for(const n of counts.values())assert.equal(n,1);
});

test('painted cache pools bind only supplied coast lights and retain compact category colours',()=>{
  const sources=[new THREE.DirectionalLight(),new THREE.HemisphereLight()],pool=new ScavengerCaches(new THREE.Group(),course,{lightSources:sources});
  try{
    for(const mesh of pool.meshes){assert.equal(mesh.material.isMeshToonNodeMaterial,true);assert.deepEqual(mesh.material.lightsNode.getLights(),sources);}
    const original=new THREE.Color(),after=new THREE.Color(),last=pool.caseItems.at(-1);pool.meshes[0].getColorAt(pool.caseItems.length-1,original);
    pool.update([pool.caseItems[0].id]);pool.meshes[0].getColorAt(pool.caseItems.length-2,after);assert.deepEqual(after,original);
    assert.equal(pool.caseItems.at(-1),last);
  }finally{pool.dispose();}
});

test('stowed world weapons lie on their reserved deck without animated beacons or new lights',()=>{
  const root=new THREE.Group(),loot=course.weaponPickups.filter(p=>p.displayKind==='stowed');
  const art=buildDungeonWeaponLoot(root,{dungeon:true,loot});assert.equal(art.length,2);
  for(const p of art){
    assert.equal(p.light,null);assert.ok(!p.root.getObjectByName('WeaponPickupBeacon'));
    const pose=p.carrier.matrix.clone();updateDungeonWeaponLoot(art,[],5000,false,{x:0,z:0});assert.deepEqual(p.carrier.matrix,pose);
    p.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(p.root);
    assert.ok(Math.abs(box.min.y-p.visualBaseY-.018)<1e-5);
    const b=course.coastal.blackwaterSlice.buildings.find(b=>b.id===p.roomId),f=createBuildingPlan(b).furniture.find(f=>f.id===p.supportId);
    const localBox=new THREE.Box3();const inv=new THREE.Matrix4().makeRotationY(-(b.yaw||0));
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])localBox.expandByPoint(new THREE.Vector3(x-b.x,y-b.y,z-b.z).applyMatrix4(inv));
    assert.ok(localBox.min.x>=f.position[0]-f.size[0]/2-.02&&localBox.max.x<=f.position[0]+f.size[0]/2+.02,p.id+' table length');
    assert.ok(localBox.min.z>=f.position[2]-f.size[2]/2-.02&&localBox.max.z<=f.position[2]+f.size[2]/2+.02,p.id+' table depth');
  }
  updateDungeonWeaponLoot(art,[art[0].id],9000);assert.equal(art[0].root.visible,false);assert.equal(art[1].root.visible,true);
  const resources=new Set();root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);}});for(const r of resources)r.dispose();
});

test('map removes searched supplies and routes to the actual nearest bench approach',()=>{
  const r={...setup(cases[0]),vehicle:course.vehicle};const before=coastalMapSvg(r,null);
  r.backpack.collected.push(cases[0].id);const after=coastalMapSvg(r,null);
  assert.ok(after.length<before.length);
  const station=course.coastal.workbenches.find(p=>p.name.includes('SALTWIND'));
  r.coastalDestination=`bench-${station.id}`;assert.equal(coastalTarget(r).x,station.approach.x);
  Object.assign(r,station.approach);const nav=harborNavigation(r);assert.ok(nav);assert.equal(nav.target.id,r.coastalDestination);
});

test('all 46 repair routes reach their bench through clear streets, doors and furnished floor space',()=>{
  assert.equal(course.coastal.workbenches.length,46);
  for(const station of course.coastal.workbenches){
    const r={course,...course.playerSpawn,backpack:createScavengerPack(),coastalDestination:`bench-${station.id}`};
    const nav=harborNavigation(r);assert.ok(nav,station.name);assert.equal(nav.target.id,r.coastalDestination);
    assert.deepEqual(nav.points.at(-1),station.approach);
    let prior=r;
    for(const point of nav.points){
      const steps=Math.max(1,Math.ceil(Math.hypot(point.x-prior.x,point.y-prior.y)/.04));
      for(let i=0;i<=steps;i++)assert.ok(canStand(course,prior.x+(point.x-prior.x)*i/steps,prior.y+(point.y-prior.y)*i/steps,.1),station.id);
      prior=point;
    }
    // Re-query inside the room as the walker crosses a rounding boundary.
    const tail=nav.points.slice(-3);for(const point of tail){Object.assign(r,point);assert.ok(harborNavigation(r),station.id+' indoor continuation');}
  }
});
