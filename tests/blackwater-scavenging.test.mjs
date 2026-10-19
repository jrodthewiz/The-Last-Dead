import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,readSave,writeSave,supportHeight} from '../island/simulation.js';
import {createWorldData,SpatialGrid,createColliders} from '../island/data.js';
import {openStash,transferLoot,packCount,craftBandage,fitWeapon,weaponDamageMultiplier,consumeRemedy,validatePack,discardItem} from '../island/backpack.js';
import {collectWeapon,equip} from '../island/armory-state.js';
import {createLootPlan} from '../island/loot-plan.js';
import {advanceCrimson,inCrimsonReach,crimsonCandidate} from '../island/close-combat.js';
const stash={id:'stash-test',loot:{cloth:8,antiseptic:3,beer:2,'ammo-arc':3,'weapon-arc':1}};
test('search reveals a single persistent inventory and partial transfers conserve leftovers',()=>{
 const s=freshState();s.backpack.items.cloth=22;assert.equal(transferLoot(s,stash,'cloth'),2);assert.equal(packCount(s),24);assert.equal(transferLoot(s,stash,'antiseptic'),0);assert.equal(openStash(s,stash).cloth,6);
 assert.ok(discardItem(s,'cloth'));assert.equal(transferLoot(s,stash,'antiseptic',1),1);assert.ok(craftBandage(s));assert.equal(s.backpack.items.bandage,1);assert.equal(s.backpack.items.cloth,21);assert.equal(packCount(s),22);
 const storage={getItem(){return this.v;},setItem(k,v){this.v=v;}};writeSave(storage,s);const restored=readSave(storage);assert.equal(openStash(restored,stash).cloth,6);assert.equal(openStash(restored,stash).antiseptic,2);assert.equal(restored.backpack.items.bandage,1);
});
test('ammunition collected before a weapon survives acquisition; fittings and healing cannot double spend',()=>{
 const s=freshState(),reserve=s.armory.arc.reserve;assert.equal(transferLoot(s,stash,'ammo-arc'),3);assert.equal(transferLoot(s,stash,'weapon-arc'),1);assert.equal(s.armory.arc.reserve,reserve+3);assert.equal(transferLoot(s,stash,'weapon-arc'),0);assert.equal(collectWeapon(s,'arc'),false);
 s.backpack.items.scrap=8;equip(s,'arc');assert.ok(fitWeapon(s,'arc'));assert.equal(weaponDamageMultiplier(s),1.2);assert.equal(fitWeapon(s,'arc'),false);assert.equal(s.backpack.items.scrap,0);
 s.backpack.items.beer=1;assert.equal(consumeRemedy(s,'beer'),null);s.health=50;assert.equal(consumeRemedy(s,'beer').heal,15);assert.equal(consumeRemedy(s,'beer'),null);
});
test('old or malformed save packs have bounded quantities and validated identities',()=>{
 assert.equal(Object.values(validatePack().items).reduce((a,b)=>a+b,0),0);const p=validatePack({items:{cloth:999,beer:-3,scrap:NaN,bandage:2},searched:['bad','stash-test','stash-test'],remaining:{'stash-test':{cloth:999,unknown:5}},fittings:{arc:true,unknown:true}});assert.equal(Object.values(p.items).reduce((a,b)=>a+b,0),24);assert.deepEqual(p.searched,['stash-test']);assert.deepEqual(p.remaining,{'stash-test':{cloth:99}});assert.deepEqual(p.fittings,{arc:true});
});
test('world containers have stable varied contents and clear supported footprints',()=>{
 const data=createWorldData(),grid=new SpatialGrid(createColliders(data)),floor=(x,z)=>supportHeight(data,x,z),loot=createLootPlan(data,grid,floor);assert.ok(loot.length>=40);assert.deepEqual(loot,createLootPlan(data,grid,floor));assert.equal(new Set(loot.map(c=>c.id)).size,loot.length);for(const c of loot){assert.equal(grid.blocked(c.x,c.z,c.y,.7),false,c.id);assert.ok(Math.abs(c.y-floor(c.x,c.z))<.025,c.id+' is unsupported');assert.ok(c.y>1,c.id);assert.ok(Object.values(c.loot).some(n=>n>0));}
 assert.ok(loot.some(c=>c.loot.bandage));assert.ok(loot.some(c=>c.loot.beer));assert.ok(loot.some(c=>c.loot['ammo-chainsaw']));
});
test('Crimson requires a wounded, recently staggered target, aim, stamina and a clear chest path',()=>{
 const grid=new SpatialGrid([]),s={x:0,y:0,z:0,yaw:0,stamina:100},e={x:0,z:-1.6,root:{position:{y:0}},alive:true,health:35,crimsonWindow:1};assert.equal(crimsonCandidate(s,[e],grid),e);assert.equal(crimsonCandidate({...s,stamina:14},[e],grid),null);assert.equal(crimsonCandidate(s,[{...e,health:70}],grid),null);assert.equal(crimsonCandidate(s,[{...e,crimsonWindow:0}],grid),null);assert.equal(inCrimsonReach({...s,yaw:Math.PI},e,grid),false);assert.equal(inCrimsonReach(s,{...e,z:-2.5},grid),false);
 const wall=new SpatialGrid([{x:0,z:-.8,w:3,d:.15,y:0,h:3}]);assert.equal(inCrimsonReach(s,e,wall),false);
});
test('Crimson event crossings are once-only and separation cancels even after contact',()=>{
 const a={time:0,contacted:false},events=[];for(let i=0;i<100;i++)events.push(...advanceCrimson(a,1/60,true));assert.deepEqual(events,['contact','extract','release','finish']);assert.deepEqual(advanceCrimson({time:.1,contacted:false},.05,false),['cancel']);assert.deepEqual(advanceCrimson({time:.4,contacted:true},.05,false),['cancel']);
});
