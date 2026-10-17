import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldData,createColliders,SpatialGrid} from '../island/data.js';
import {freshState,stepPlayer,supportHeight,readSave,writeSave,clearShot} from '../island/simulation.js';
import {interiorPlan} from '../island/interior-plan.js';
import {houseShell} from '../island/house-shell.js';
import {SURVIVORS,claimSurvivorSupply,survivorResponse} from '../island/survivor-roles.js';
const data=createWorldData(),grid=new SpatialGrid(createColliders(data));
test('all furnished homes retain a walkable doorway-to-supply route',()=>{
 for(const b of data.buildings.filter(b=>b.enterable)){
  const s={...freshState(),x:b.x,z:b.z+b.d/2-.7,y:b.baseY+.2};
  for(const [x,z]of [[b.x,b.z+1],[b.x-3,b.z+1]]){
   for(let i=0;i<600&&Math.hypot(s.x-x,s.z-z)>.25;i++){s.yaw=Math.atan2(x-s.x,-(z-s.z));stepPlayer(s,{forward:1,strafe:0},data,grid,1/60);}
   assert.ok(Math.hypot(s.x-x,s.z-z)<.3,b.id+' blocked at '+s.x+','+s.z);
  }
  for(const c of interiorPlan(b).solids){assert.ok(Math.abs(c.x-b.x)+c.w/2<b.w/2+.1,b.id+' furniture outside side wall');assert.ok(Math.abs(c.z-b.z)+c.d/2<b.d/2+.1,b.id+' furniture outside back/front wall');}
 }
});
test('ground windows have matching openings and solid sills',()=>{
 const b=data.buildings.find(b=>b.id==='building-8'),shell=houseShell(b),w=shell.windows.find(w=>w.side===2),z=b.z+w.u;
 assert.equal(clearShot([b.x+b.w/2+1,b.baseY+1.9,z],[-1,0,0],1.8,grid),true);
 assert.equal(clearShot([b.x+b.w/2+1,b.baseY+.6,z],[-1,0,0],1.8,grid),false);
 assert.equal(grid.blocked(b.x+b.w/2,z,b.baseY+.2),true,'Sill prevents ordinary walking through a window');
});
test('jumping onto furniture lands on a supported surface instead of trapping the player',()=>{
 const b=data.buildings.find(b=>b.id==='building-7'),s={...freshState(),x:b.x-3,z:b.z-2.6,y:b.baseY+2,vy:0};
 for(let i=0;i<180;i++)stepPlayer(s,{forward:0,strafe:0},data,grid,1/60);
 assert.ok(Math.abs(s.y-(b.baseY+.2+.92))<.01);
 const ward=data.buildings.find(b=>b.id==='clinic');assert.ok(Math.abs(supportHeight(data,ward.x+8,ward.z-1)-(ward.baseY+1.2))<.001,'Clinic mattress supports the feet');
});
test('jumping from a worktable cannot put the camera through the ceiling',()=>{
 const b=data.buildings.find(b=>b.id==='building-7'),s={...freshState(),x:b.x-3,z:b.z-2.6,y:b.baseY+1.12,vy:0};let maxEye=s.y+1.7;
 for(let i=0;i<120;i++){stepPlayer(s,{forward:0,strafe:0,jump:i===0},data,grid,1/60);maxEye=Math.max(maxEye,s.y+1.7);}
 assert.ok(maxEye<=b.baseY+3.14+.001);assert.ok(maxEye>b.baseY+3,'Jump began before contacting the ceiling');assert.ok(Math.abs(s.y-(b.baseY+1.12))<.01);
});
test('two refuge supplies persist once and react to existing journey progress',()=>{
 const s=freshState(),medical=s.medkits;for(const person of SURVIVORS){assert.ok(claimSurvivorSupply(s,person));assert.equal(claimSurvivorSupply(s,person),false);}assert.equal(s.medkits,medical+1);
 const storage={setItem(k,v){this.v=v;},getItem(){return this.v;}};writeSave(storage,s);const loaded=readSave(storage);for(const p of SURVIVORS)assert.equal(claimSurvivorSupply(loaded,p),false);
 assert.notEqual(survivorResponse(SURVIVORS[1],s),survivorResponse(SURVIVORS[1],{...s,generatorReady:true}));
 assert.notEqual(survivorResponse(SURVIVORS[0],s),survivorResponse(SURVIVORS[0],{...s,relays:['ridge']}));
});
