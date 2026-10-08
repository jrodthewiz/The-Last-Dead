import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeDungeonCourse} from '../playground/map/dungeon-course.js';
import {planDungeonWayfinding,buildDungeonWayfinding} from '../dungeon-wayfinding.js';
import {districtPanelTint} from '../district-materials.js';
import {createOssuary} from '../weapon-ossuary.js';
import {batchStaticWeaponMeshes} from '../weapon-batching.js';
import {installOssuaryFitting,updateOssuaryFitting} from '../scavenger-fitting.js';
import {createScavengerPack,upgradeWeapon,tickScavengerPack} from '../scavenger-pack.js';

test('all extended destination rooms get signs with valid atlas UVs',()=>{
 for(let floor=0;floor<5;floor++){
  const course=makeDungeonCourse(floor,{extended:true}),plan=planDungeonWayfinding(course);
  const destinations=course.rooms.filter(room=>room.kind!=='secret'&&course.openings.some(o=>(o.roomId||o.room)===room.id&&o.kind!=='vent'&&!o.secret&&o.anchor));
  if(floor===0)assert.ok(destinations.length>16,'first floor exercises the old 16-room cap');
  for(const room of destinations)assert.ok(plan.some(sign=>sign.roomId===room.id),room.id);
  const root=new THREE.Group();buildDungeonWayfinding(root,course);
  const faces=root.getObjectByName('NumberedDestinationPlaques');
  assert.ok([...faces.geometry.attributes.uv.array].every(value=>value>=0&&value<=1));
  root.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
 }
});

test('panel wear is stable and varied without changing geometry',()=>{
 const values=Array.from({length:20},(_,i)=>districtPanelTint(i+.5,4));
 assert.ok(new Set(values.map(c=>c.getHex())).size>5);
 assert.deepEqual(districtPanelTint(3.5,4),districtPanelTint(3.5,4));
 assert.ok(values.every(c=>c.r>=.78&&c.r<=1&&c.b>=.7));
});

test('visible fitting follows its barrel and survives weapon batching, then resets with a new pack',()=>{
 const weapon=createOssuary(),mesh=installOssuaryFitting(weapon);
 assert.ok(mesh);assert.equal(mesh.parent.name,'barrel');assert.equal(mesh.visible,false);
 assert.equal(installOssuaryFitting(weapon),mesh);
 batchStaticWeaponMeshes(weapon);
 assert.equal(weapon.getObjectByName('HardenedBarrelFitting'),mesh);
 const geometry=mesh.geometry,run={mode:'play',health:100,weapon:0,ownedWeapons:[0],backpack:createScavengerPack({scrap:8}),events:[]};
 upgradeWeapon(run,0);updateOssuaryFitting(weapon,run);assert.equal(mesh.visible,true);
 run.weapon=1;updateOssuaryFitting(weapon,run);assert.equal(mesh.visible,true);
 run.course=makeDungeonCourse(1,{extended:true});updateOssuaryFitting(weapon,run);assert.equal(mesh.visible,true);
 for(let i=0;i<120;i++)updateOssuaryFitting(weapon,run);
 assert.equal(mesh.geometry,geometry);
 run.backpack=createScavengerPack();updateOssuaryFitting(weapon,run);assert.equal(mesh.visible,false);
});

test('full pack explains blocked collection once per approach and leaves the cache collectible',()=>{
 const run={mode:'play',health:100,x:1.5,y:1.5,z:0,weapon:0,ownedWeapons:[0],events:[],backpack:createScavengerPack({scrap:12}),
 course:{dungeon:true,w:4,h:4,cells:Array.from({length:16},()=>[0,0,0,0]),scavengerPickups:[{id:'cache',x:1.5,y:1.5,amount:4}]}};
 for(let frame=0;frame<120;frame++)tickScavengerPack(run);
 assert.equal(run.events.filter(e=>e.type==='scavenger-full').length,1);
 assert.equal(run.backpack.collected.length,0);
 run.x=3;tickScavengerPack(run);run.x=1.5;tickScavengerPack(run);
 assert.equal(run.events.filter(e=>e.type==='scavenger-full').length,2);
 upgradeWeapon(run,0);tickScavengerPack(run);
 assert.equal(run.backpack.scrap,8);assert.deepEqual(run.backpack.collected,['cache']);
});
