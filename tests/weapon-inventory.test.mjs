import test from 'node:test';
import assert from 'node:assert/strict';
import {collectWeaponPickup, tickWeaponInventory} from '../weapon-inventory.js';
const clear = {castRay: (_course,_x,_y,_angle,max) => ({dist:max})};
const fixture = () => ({mode:'play',health:100,x:2,y:2,z:0,weapon:0,ownedWeapons:[0],events:[],
 course:{scavenging:true,weaponPickups:[{id:'harbor-bat',x:2.3,y:2,weaponIndex:6}]}});
test('proximity stash preserves equipped gun, creates melee ownership once, and keeps scrap separate',()=>{
 const run=fixture();run.backpack={scrap:12,collected:[],weaponMods:{}};
 tickWeaponInventory(run,clear);tickWeaponInventory(run,clear);
 assert.deepEqual(run.ownedWeapons,[0,6]);assert.equal(run.weapon,0);assert.equal(run.backpack.scrap,12);
 assert.deepEqual(run.backpack.weaponPickups,['harbor-bat']);assert.equal(run.events.length,1);
 assert.equal(run.events[0].type,'weapon-stashed');
});
test('wall, absent geometry callback, range, pause, death and air all retain weapon pickup',()=>{
 for(const mutate of [r=>r.x=0,r=>r.mode='pause',r=>r.health=0,r=>r.z=.4]) {
 const run=fixture();mutate(run);assert.equal(collectWeaponPickup(run,'harbor-bat',clear).ok,false);assert.deepEqual(run.ownedWeapons,[0]);
 }
 for(const env of [{},{castRay:()=>({dist:.1})}]) {const run=fixture();assert.equal(collectWeaponPickup(run,'harbor-bat',env).ok,false);assert.deepEqual(run.ownedWeapons,[0]);}
});
test('unknown objects and invalid weapon indexes cannot grant inventory',()=>{
 const run=fixture();assert.equal(collectWeaponPickup(run,{id:'invented',x:2,y:2,weaponIndex:7},clear).ok,false);
 for(const index of [-1,8,NaN,1.5,'6']) {run.course.weaponPickups[0].weaponIndex=index;assert.equal(collectWeaponPickup(run,'harbor-bat',clear).ok,false);}
});
test('already owned world pickups are removed without duplicating ownership',()=>{
 const run=fixture();run.ownedWeapons.push(6);assert.equal(collectWeaponPickup(run,'harbor-bat',clear).alreadyOwned,true);
 assert.deepEqual(run.ownedWeapons,[0,6]);assert.equal(run.backpack.weaponPickups.length,1);
});
test('shared world pickup grants ownership and common pickup history to both players',()=>{
 const run=fixture(),peer={...fixture(),x:2.3,world:run};run.x=0;run.peer=peer;
 tickWeaponInventory(run,clear);assert.deepEqual(run.ownedWeapons,[0,6]);assert.deepEqual(peer.ownedWeapons,[0,6]);
 assert.equal(peer.backpack,run.backpack);assert.equal(run.events.length,1);
});
