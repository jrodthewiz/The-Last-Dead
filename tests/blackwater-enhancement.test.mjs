import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldData,createColliders,SpatialGrid,terrainHeight,entranceHeight,SAVE_KEY} from '../island/data.js';
import {freshState,supportHeight,stepPlayer,writeSave,readSave} from '../island/simulation.js';
import {WEAPONS,equip,collectWeapon,finishReload,supplyAmmo} from '../island/armory-state.js';
import {sceneryPlan} from '../island/scenery.js';
const data=createWorldData(),grid=new SpatialGrid(createColliders(data));grid.floorAt=(x,z)=>supportHeight(data,x,z);
test('every raised floor clears the rendered triangle terrain across the complete footprint',()=>{
 for(const b of data.buildings)for(let x=b.x-b.w/2;x<=b.x+b.w/2;x+=.7)for(let z=b.z-b.d/2;z<=b.z+b.d/2;z+=.7)assert.ok(terrainHeight(x,z)<=b.baseY+.001,b.id+' ground penetrates floor');
});
test('all 45 furnished entrances can be climbed from the terrain without jumping',()=>{
 for(const b of data.buildings.filter(b=>b.enterable)){const z=b.entry.z+b.entry.length+1,s={...freshState(),x:b.x,z,y:supportHeight(data,b.x,z),yaw:0};for(let i=0;i<Math.ceil((b.entry.length+3)/5.2*60);i++)stepPlayer(s,{forward:1,strafe:0},data,grid,1/60);assert.ok(s.z<b.entry.z-.5,b.id+' final step blocked');assert.ok(s.y>=b.baseY+.19);}
});
test('stair support never falls below terrain and has bounded risers',()=>{
 for(const b of data.buildings.filter(b=>b.enterable)){let previous=null;for(let d=0;d<b.entry.length;d+=.1){const z=b.entry.z+d,h=entranceHeight(b,b.x,z);assert.ok(h>=terrainHeight(b.x,z));if(previous!==null)assert.ok(Math.abs(h-previous)<.6,b.id+' excessive riser');previous=h;}}
});
test('weapon switching, reload and save migration preserve each ammunition pool',()=>{
 const s=freshState(),storage={value:null,setItem(k,v){assert.equal(k,SAVE_KEY);this.value=v;},getItem(){return this.value;}};assert.equal(equip(s,'carrion'),false);collectWeapon(s,'carrion');s.ammo=3;assert.equal(equip(s,'carrion'),true);s.ammo=20;s.reserve=7;assert.equal(finishReload(s),7);assert.equal(s.ammo,27);assert.equal(s.reserve,0);writeSave(storage,s);const saved=readSave(storage);assert.equal(saved.weapon,'carrion');assert.equal(saved.ammo,27);assert.equal(equip(saved,'carbine'),true);assert.equal(saved.ammo,3);assert.equal(saved.reserve,48);
 supplyAmmo(saved);assert.equal(saved.reserve,64);assert.equal(equip(saved,'carrion'),true);assert.equal(saved.reserve,30);writeSave(storage,{...freshState(),armory:undefined,weapon:undefined});assert.equal(readSave(storage).weapon,'carbine');assert.equal(readSave(storage).armory.bat.owned,true);
 for(const w of WEAPONS){collectWeapon(s,w.id);equip(s,w.id);s.ammo=0;s.reserve=999;finishReload(s);assert.equal(s.ammo,w.capacity);}
});
test('richer scenery stays deterministic and leaves front-door approaches clear',()=>{
 const props=sceneryPlan(data);assert.deepEqual(props,sceneryPlan(data));assert.ok(props.length>4000);assert.ok(new Set(props.map(p=>p.name)).size>=20);for(const p of props)for(const b of data.buildings.filter(b=>b.enterable))assert.equal(Math.abs(p.x-b.x)<2.7+p.size*.35&&p.z>b.entry.z-1&&p.z<b.entry.z+b.entry.length+2,false,b.id+' entrance has '+p.name);
});
