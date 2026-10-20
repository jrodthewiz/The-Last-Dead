import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,readSave,writeSave,stepPlayer,supportHeight} from '../island/simulation.js';
import {createWorldData,SpatialGrid} from '../island/data.js';
import {hasAmmoSpace,supplyAmmo} from '../island/armory-state.js';
import {SURVIVORS,claimSurvivorSupply} from '../island/survivor-roles.js';
import {PLACES,claimContactSupply,claimNoteSupply} from '../island/places.js';

const full=s=>{for(const a of Object.values(s.armory))a.reserve=999;s.reserve=999;};
const roundTrip=s=>{const store={setItem(k,v){this.value=v;},getItem(){return this.value;}};assert.ok(writeSave(store,s));return readSave(store);};

test('full ammo reserves preserve Mara’s one-time gift through a save and later collection',()=>{
 let s=freshState();full(s);const mara=SURVIVORS.find(p=>p.reward==='ammo');
 assert.equal(hasAmmoSpace(s),false);assert.equal(claimSurvivorSupply(s,mara),false);assert.ok(!s.collected.includes('survivor-mara'));
 s=roundTrip(s);s.reserve=998;assert.ok(hasAmmoSpace(s));assert.ok(claimSurvivorSupply(s,mara));assert.deepEqual(supplyAmmo(s),[{id:'ammo-carbine',count:1}]);assert.equal(s.reserve,999);assert.equal(claimSurvivorSupply(s,mara),false);
});

test('Elias preserves a completely full ration and delivers only resources that fit',()=>{
 let s=freshState();full(s);s.medkits=20;assert.equal(claimContactSupply(s),false);assert.equal(s.contactStage,-1);
 s=roundTrip(s);s.medkits=19;assert.ok(claimContactSupply(s));assert.equal(s.medkits,20);assert.deepEqual(supplyAmmo(s),[]);assert.equal(claimContactSupply(s),false);
 s.relays.push('ridge');s.reserve=997;assert.ok(claimContactSupply(s));assert.equal(s.medkits,20);assert.deepEqual(supplyAmmo(s),[{id:'ammo-carbine',count:2}]);assert.equal(s.reserve,999);
});

test('a copied ammunition note keeps its box at capacity without duplicating old rewards',()=>{
 let s=freshState();full(s);const record=PLACES.find(p=>p.reward==='ammo');
 assert.deepEqual(claimNoteSupply(s,record),{status:'full',items:[]});s.records.push(record.id);s=roundTrip(s);
 assert.equal(claimNoteSupply(s,record).status,'full');s.reserve=990;
 assert.deepEqual(claimNoteSupply(s,record),{status:'recovered',items:[{id:'ammo-carbine',count:9}]});assert.equal(s.reserve,999);assert.equal(claimNoteSupply(s,record).status,'claimed');
 assert.ok(!s.collected.some(id=>id.startsWith('pending-ammo-')));
 const old=freshState();old.records.push(record.id);assert.equal(claimNoteSupply(old,record).status,'claimed');
});

test('supply receipts count actual capped deltas and never promise unowned ammunition',()=>{
 const s=freshState();s.reserve=998;s.armory.chainsaw.owned=true;s.armory.chainsaw.reserve=975;
 assert.deepEqual(supplyAmmo(s),[{id:'ammo-carbine',count:1},{id:'ammo-chainsaw',count:24}]);assert.equal(s.reserve,999);assert.equal(s.armory.chainsaw.reserve,999);assert.equal(s.armory.ossuary.owned,false);assert.deepEqual(supplyAmmo(s),[]);
});

test('exhausted swimming reports frame-rate-independent harm for the game damage owner',()=>{
 const data=createWorldData(),grid=new SpatialGrid([]),totals=[];
 for(const hz of [30,60,120]){
  const s={...freshState(),x:-1250,z:0,y:-.45,health:80,stamina:0};assert.ok(supportHeight(data,s.x,s.z)<-.45);let damage=0,m;
  for(let i=0;i<hz*2;i++){m=stepPlayer(s,{forward:1,strafe:0},data,grid,1/hz);damage+=m.environmentalDamage;assert.equal(m.exhausted,true);}
  assert.equal(s.health,80,'Movement reports harm without subtracting it a second time');totals.push(damage);
  for(let i=0;i<hz/2;i++)m=stepPlayer(s,{forward:0,strafe:0},data,grid,1/hz);
  assert.equal(m.exhausted,false);assert.equal(m.environmentalDamage,0);assert.ok(s.stamina>0);
 }
 for(const damage of totals)assert.ok(Math.abs(damage-10)<1e-7);
});
