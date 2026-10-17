import test from 'node:test';
import assert from 'node:assert/strict';
import {PLACES,TRAILS,discoverPlaces,claimContactSupply} from '../island/places.js';
import {createWorldData,createColliders,SpatialGrid,SAVE_KEY} from '../island/data.js';
import {freshState,readSave,writeSave,stepPlayer,supportHeight} from '../island/simulation.js';
import {canSeePlayer,hearNoise,neighbourField,attackConnects} from '../island/enemy-behavior.js';
import {updateEnemies} from '../island/actors.js';

const actor=(id,x,z,role='shambler')=>({id,x,z,role,phase:1,alive:true,health:70,home:{x,z},hit:0,notice:0,cooldown:0,navTimer:0,path:[],attackTimer:0,actions:{},state:'',mixer:{update(){}},root:{position:{x,y:14,z,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{y:0}}});
test('sight respects facing and cover; noise points to a fixed remembered location',()=>{
 const e=actor('a',500,0),player={x:500,y:14,z:12},grid=new SpatialGrid([]);grid.floorAt=()=>14;
 assert.ok(canSeePlayer(e,player,grid));e.root.rotation.y=Math.PI;assert.equal(canSeePlayer(e,player,grid),false);
 e.root.rotation.y=0;const wall=new SpatialGrid([{x:500,z:6,w:5,d:1,y:0,h:30}]);assert.equal(canSeePlayer(e,player,wall),false);
 hearNoise([e],505,7,30);assert.deepEqual(e.lastKnown,{x:505,z:7});player.x=520;assert.deepEqual(e.lastKnown,{x:505,z:7});
});
test('six infected separate through a corner and keep attacks bounded',()=>{
 const grid=new SpatialGrid([{x:507,z:10,w:7,d:12,y:0,h:35}]);grid.floorAt=()=>14;
 const enemies=Array.from({length:6},(_,i)=>actor('dead-'+i,500+(i%2)*.2,8+Math.floor(i/2)*.2,i%2?'runner':'shambler')),player={x:521,y:14,z:10};hearNoise(enemies,player.x,player.z,60);
 let maxAttacks=0;for(let i=0;i<720;i++){updateEnemies(enemies,player,grid,1/60,i/60,()=>{});maxAttacks=Math.max(maxAttacks,enemies.filter(e=>e.attackTimer>0).length);for(const e of enemies)assert.equal(grid.blocked(e.x,e.z,14,.3),false);}
 let min=Infinity;for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++)min=Math.min(min,Math.hypot(enemies[i].x-enemies[j].x,enemies[i].z-enemies[j].z));assert.ok(min>.72,'Bodies remain separated: '+min);assert.ok(enemies.some(e=>e.x>510),'At least one actor routes past the corner');assert.ok(maxAttacks<=2);
});
test('committed melee aim can be dodged sideways',()=>{const e=actor('a',500,0),grid=new SpatialGrid([]);e.attackYaw=0;assert.ok(attackConnects(e,{x:500,y:14,z:1.4},grid));assert.equal(attackConnects(e,{x:501.4,y:14,z:.1},grid),false);});
test('discoveries, records and one ration per signal survive saves without duplicate rewards',()=>{
 const s=freshState();Object.assign(s,{x:PLACES[0].x,z:PLACES[0].z});assert.equal(discoverPlaces(s).length,1);assert.equal(discoverPlaces(s).length,0);assert.ok(claimContactSupply(s));assert.equal(claimContactSupply(s),false);s.relays.push('ridge');assert.ok(claimContactSupply(s));s.records.push('churchyard');const storage={value:null,setItem(k,v){this.value=v;},getItem(){return this.value;}};assert.ok(writeSave(storage,s));const restored=readSave(storage);assert.deepEqual(restored.records,['churchyard']);assert.equal(restored.contactStage,1);assert.equal(claimContactSupply(restored),false);
});
test('each authored walking loop remains traversable across terrain and existing collision',()=>{
 const data=createWorldData(),grid=new SpatialGrid(createColliders(data));for(const trail of TRAILS){const state=freshState();state.x=trail.points[0][0];state.z=trail.points[0][1];state.y=supportHeight(data,state.x,state.z);for(const [x,z] of trail.points.slice(1)){for(let i=0;i<9000&&Math.hypot(x-state.x,z-state.z)>.3;i++){state.yaw=Math.atan2(x-state.x,-(z-state.z));stepPlayer(state,{forward:1,strafe:0},data,grid,1/60);}assert.ok(Math.hypot(x-state.x,z-state.z)<.4,trail.name+' blocked near '+JSON.stringify([state.x,state.z]));}}
});

test('old five-round shotgun saves retain excess rounds in reserve',()=>{const s=freshState();s.armory.breach={owned:true,ammo:5,reserve:10};s.weapon='breach';s.ammo=5;s.reserve=10;delete s.armoryRevision;const restored=readSave({getItem:()=>JSON.stringify(s)});assert.equal(restored.ammo,2);assert.equal(restored.reserve,13);assert.equal(restored.armory.breach.reserve,13);});
