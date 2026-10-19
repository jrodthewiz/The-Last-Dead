import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldData,createColliders,SpatialGrid} from '../island/data.js';
import {freshState,readSave,writeSave} from '../island/simulation.js';
import {interiorPlan} from '../island/interior-plan.js';
import {recoverWeapon,collectWeapon,equip,storeAmmo,WEAPONS} from '../island/armory-state.js';

test('field weapons recover once, auto-load new finds and survive a save round trip',()=>{
 const s=freshState(),cache={id:'weapon-ossuary',weapon:'ossuary'};
 assert.deepEqual(recoverWeapon(s,cache),{id:'weapon-ossuary',count:1});
 assert.equal(s.weapon,'carbine');assert.equal(s.armory.ossuary.ammo,6);
 assert.equal(equip(s,'ossuary'),true);s.ammo=4;storeAmmo(s);
 const storage={getItem(){return this.value;},setItem(k,v){this.value=v;}};
 assert.equal(writeSave(storage,s),true);const restored=readSave(storage);
 assert.equal(restored.weapon,'ossuary');assert.equal(restored.ammo,4);
 assert.equal(recoverWeapon(restored,cache),null);assert.equal(restored.reserve,24);
});

test('a separately recovered weapon yields only available spare ammunition',()=>{
 for(const w of WEAPONS.filter(w=>w.capacity)){
  const s=freshState(),cache={id:'spare-'+w.id,weapon:w.id};collectWeapon(s,w.id);equip(s,w.id);s.reserve=998;s.armory[w.id].reserve=998;
  assert.deepEqual(recoverWeapon(s,cache),{id:'ammo-'+w.id,count:Math.min(1,w.capacity)});assert.equal(s.reserve,999);
  assert.equal(recoverWeapon(s,cache),null);
 }
});

test('a full reserve leaves the weapon intact and never changes the held weapon',()=>{
 const s=freshState(),cache={id:'weapon-breach',weapon:'breach'};collectWeapon(s,'breach');s.armory.breach.reserve=999;
 assert.equal(recoverWeapon(s,cache),null);assert.equal(s.collected.includes(cache.id),false);assert.equal(s.weapon,'carbine');
 s.armory.breach.reserve=997;assert.deepEqual(recoverWeapon(s,cache),{id:'ammo-breach',count:2});assert.equal(s.weapon,'carbine');assert.equal(s.reserve,48);
});

test('cottage domestic zones use visible, solid furniture without obstructing the entry',()=>{
 const data=createWorldData(),grid=new SpatialGrid(createColliders(data));let furnished=0;
 for(const b of data.buildings.filter(b=>b.enterable&&b.district==='village'&&!['arrival-house','lightkeeper'].includes(b.id))){
  const p=interiorPlan(b),roles=new Set(p.pieces.map(p=>p.role));furnished++;
  for(const role of ['kitchen-worktop','sink-basin','bedside-cabinet','bedside-lamp-shade','linen-sideboard'])assert.ok(roles.has(role),b.id+' missing '+role);
  for(const name of ['kitchen','bedside-cabinet','linen-sideboard']){
   const s=p.solids.find(s=>s.id===b.id+'-'+name);assert.ok(s,b.id+' missing solid '+name);assert.equal(grid.blocked(s.x,s.z,b.baseY+.2,.2),true);
  }
  for(let z=b.z;z<=b.z+b.d/2;z+=.25)assert.equal(grid.blocked(b.x,z,b.baseY+.2,.42),false,b.id+' central entrance obstructed');
 }
 assert.equal(furnished,18);
});
