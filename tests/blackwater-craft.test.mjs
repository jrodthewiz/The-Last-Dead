import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {createWorldData} from '../island/data.js';
import {freshState,readSave,writeSave} from '../island/simulation.js';
import {SURVIVORS,claimSurvivorSupply} from '../island/survivor-roles.js';
import {PLACES,claimMedicalNote} from '../island/places.js';
import {compactReceipts} from '../island/field-ui.js';
import {createLootVisuals} from '../island/loot-visuals.js';

test('procedural rocks reserve whole occupied buildings, across seeded worlds',()=>{
 for(const seed of [undefined,17,81]){
  const data=createWorldData(seed);
  for(const r of data.rocks)for(const b of data.buildings){
   // A rock is contained by its radius even after rotating its nonuniform
   // scale. Keep that complete footprint away from the house and foundation.
   const dx=Math.max(Math.abs(r.x-b.x)-b.w/2,0),dz=Math.max(Math.abs(r.z-b.z)-b.d/2,0);
   assert.ok(Math.hypot(dx,dz)>r.s,b.id+' intersects a landscape rock');
  }
  assert.ok(data.rocks.length>100,'Natural cover remains outside settlements');
 }
});

test('a full medical belt preserves Iven’s gift and claims it once after making room',()=>{
 const s=freshState(),person=SURVIVORS.find(p=>p.reward==='medical');s.medkits=20;
 assert.equal(claimSurvivorSupply(s,person),false);assert.ok(!s.collected.includes('survivor-'+person.id));
 s.medkits--;assert.equal(claimSurvivorSupply(s,person),true);assert.equal(s.medkits,20);assert.equal(claimSurvivorSupply(s,person),false);
});

test('copying a medical note at capacity retains its dressing across save/reload',()=>{
 const s=freshState(),record=PLACES.find(p=>p.reward==='medical');s.medkits=20;
 assert.equal(claimMedicalNote(s,record),'full');s.records.push(record.id);
 const store={setItem(k,v){this.v=v;},getItem(){return this.v;}};writeSave(store,s);const loaded=readSave(store);
 assert.equal(claimMedicalNote(loaded,record),'full');loaded.medkits=19;
 assert.equal(claimMedicalNote(loaded,record),'recovered');assert.equal(loaded.medkits,20);
 assert.equal(claimMedicalNote(loaded,record),'claimed');assert.equal(loaded.collected.some(id=>id.startsWith('pending-medical-')),false);
 // Existing notes in old saves already received their original reward.
 const old=freshState();old.records.push(record.id);assert.equal(claimMedicalNote(old,record),'claimed');
});

test('multi-reserve receipts foreground the equipped gain while acknowledging the other reserves',()=>{
 const items=['carbine','ossuary','breach','arc','reliquary','carrion','mourning','chainsaw'].map((id,i)=>({id:'ammo-'+id,count:i+1}));
 const result=compactReceipts(items,'Ammunition recovered','carbine');assert.equal(result.length,1);
 assert.equal(result[0].id,'ammo-carbine');assert.equal(result[0].count,1);assert.equal(result[0].reserves.length,7);assert.match(result[0].title,/7 other reserves/);
 assert.deepEqual(compactReceipts([{id:'cloth',count:2}],'Packed','carbine'),[{id:'cloth',count:2,title:'Packed'}]);
});

test('opened containers expose their hollow interior and deplete individual supply families',()=>{
 const scene=new T.Scene(),containers=['bag','crate','trunk','chest'].map((kind,i)=>({id:kind,kind,name:kind,x:i*2,y:0,z:0,loot:{bandage:2,cloth:1,beer:1,'ammo-carbine':8}}));
 const visuals=createLootVisuals(scene,containers),state=freshState(),near=new T.Vector3(0,2,2);
 for(const c of containers){state.backpack.searched.push(c.id);state.backpack.remaining[c.id]={...c.loot};}
 for(let i=0;i<60;i++)visuals.update(1/60,state,near);
 for(const e of visuals.entries){assert.ok(e.lid.rotation.x<-1.3);assert.equal(e.families.size,5);assert.ok(e.families.get('medical').visible);state.backpack.remaining[e.c.id].bandage=0;}
 visuals.update(1/60,state,near);for(const e of visuals.entries){assert.equal(e.families.get('medical').visible,false);assert.equal(e.families.get('beer').visible,true);}
 const bag=visuals.entries[0];state.backpack.remaining.bag={scrap:2};visuals.update(1/60,state,near);assert.equal(bag.families.get('tools').visible,true,'An old saved category remains visible even when absent from the current loot theme');scene.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(0,1,0),new T.Vector3(0,-1,0));
 const bodyHits=ray.intersectObjects(bag.group.children.filter(o=>o.isMesh),false);assert.ok(bodyHits.length&&bodyHits[0].point.y<.15,'The open satchel has an actual opening, rather than a solid top face');
 for(const c of containers)for(const id of Object.keys(state.backpack.remaining[c.id]))state.backpack.remaining[c.id][id]=0;
 visuals.update(1/60,state,near);for(const e of visuals.entries)assert.equal(e.contents.visible,false);
});
