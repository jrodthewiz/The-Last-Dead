import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldData,createColliders,SpatialGrid,LANDMARKS,ROADS,SPAWN,terrainHeight,groundHeight,bridgeHeight,SAVE_KEY,stationPosition,SIGNAL_STAIRS} from '../island/data.js';
import {freshState,readSave,writeSave,stepPlayer,objective,clearShot,rayBox,supportHeight} from '../island/simulation.js';
import {walkableLine,findLocalPath} from '../island/navigation.js';
const data=createWorldData(),grid=new SpatialGrid(createColliders(data));grid.floorAt=(x,z)=>supportHeight(data,x,z);
test('a reproducible world with connected island and city content',()=>{
 assert.deepEqual(createWorldData(),data);assert.ok(data.buildings.length>=240);assert.ok(data.trees.length>1500);assert.ok(data.enemies.length>=30);
 assert.equal(grid.blocked(SPAWN.x,SPAWN.z,groundHeight(SPAWN.x,SPAWN.z)),false);
 for(const p of LANDMARKS.filter(p=>p.type==='relay')){const q=stationPosition(p);assert.equal(grid.blocked(q.x,q.z,groundHeight(q.x,q.z)),false,p.name+' has accessible controls');}
 for(const e of data.enemies)assert.equal(grid.blocked(e.x,e.z,groundHeight(e.x,e.z),.35),false,e.id+' must spawn in walkable space');
});
test('the survey staircase is a continuous physical route with blocking guardrails',()=>{
 const s={...freshState(),x:-433,z:-286,y:groundHeight(-433,-286),yaw:Math.PI/2};
 for(let i=0;i<330;i++)stepPlayer(s,{forward:1,strafe:0},data,grid,1/60);
 assert.ok(s.x>-405&&s.x<-400);assert.equal(s.y,SIGNAL_STAIRS.base+SIGNAL_STAIRS.rise);
 const x=s.x;s.yaw=Math.PI/2;for(let i=0;i<120;i++)stepPlayer(s,{forward:1,strafe:0},data,grid,1/60);assert.ok(s.x< -400.4&&s.x>x,'Platform rail prevents walking off the edge');
 assert.equal(grid.blocked(106,-4.6,groundHeight(106,-4.6)),true,'Abandoned car has collision');assert.equal(grid.blocked(106,0,groundHeight(106,0),1.4),false,'Central bridge lane admits the truck');
 assert.equal(grid.blocked(620,0,14,1.4),true,'Evacuation barrier diverts vehicles');assert.equal(grid.blocked(620,6,14,.42),false,'Pedestrians can pass on the pavement');
});
test('new station requirements persist and old saves receive safe defaults',()=>{
 const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};const s=freshState();s.fuse=true;s.generatorReady=true;writeSave(storage,s);assert.equal(readSave(storage).fuse,true);assert.equal(readSave(storage).generatorReady,true);
 delete s.fuse;delete s.generatorReady;writeSave(storage,s);assert.equal(readSave(storage).fuse,false);assert.equal(readSave(storage).generatorReady,false);
});
test('procedural architecture has valid tier and entrance ownership',()=>{
 for(const b of data.buildings){let top=0;for(const t of b.tiers){assert.equal(t.y,top);assert.ok(t.w>=12&&t.d>=12);assert.ok(t.w<=b.w&&t.d<=b.d);top+=t.h;}assert.ok(Math.abs(top-b.height)<.001);if(b.enterable){assert.equal(grid.blocked(b.x,b.z+b.d/2,supportHeight(data,b.x,b.z+b.d/2)),false);assert.equal(grid.blocked(b.x-b.w/2,b.z,b.baseY+.2),true);}}
});
test('all island road centre lines remain walkable and have gentle grades',()=>{
 for(const road of ROADS)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);let last=null;
  for(let d=0;d<=length;d+=1){const t=d/length,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,y=groundHeight(x,z);assert.ok(y>1,road.name+' stays above water');if(last!==null)assert.ok(Math.abs(y-last)<.6,road.name+' has walkable slopes');assert.equal(grid.blocked(x,z,y,.42),false,road.name+' is not blocked by generated scenery');last=y;}
 }
});
test('player traverses the full bridge and reaches the mainland under ordinary movement',()=>{
 const s={...freshState(),x:67,z:0,y:groundHeight(67,0),yaw:Math.PI/2};
 for(let i=0;i<4600;i++)stepPlayer(s,{forward:1,strafe:0,sprint:false,jump:false},data,grid,1/60);
 assert.ok(s.x>380,`Reached mainland: ${s.x}`);assert.ok(s.y>10);assert.equal(grid.blocked(s.x,s.z,s.y),false);
 for(let x=70;x<=370;x+=10)assert.equal(groundHeight(x,0),bridgeHeight(x));
});
test('walls stop motion and bullets while the open door permits entry',()=>{
 const b=data.buildings.find(b=>b.id==='arrival-house'),y=terrainHeight(b.x,b.z);
 assert.equal(clearShot([b.x-15,b.baseY+.65,b.z],[1,0,0],20,grid),false,'The solid wall below the window stops bullets');
 assert.equal(clearShot([b.x,y+1.7,b.z+b.d/2+1],[0,0,-1],2,grid),true);
 assert.equal(rayBox([0,20,0],[1,0,0],{x:4,z:0,w:2,d:2,y:0,h:3},10),null,'Shots can pass above a low wall');
 const s={...freshState(),x:b.x,z:b.z+b.d/2+3,y:supportHeight(data,b.x,b.z+b.d/2+3),yaw:0};for(let i=0;i<70;i++)stepPlayer(s,{forward:1,strafe:0},data,grid,1/60);assert.ok(s.z<b.z+b.d/2,'Door admits the player');
});
test('progress is validated, versioned and isolated from legacy campaign saves',()=>{
 const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};const s=freshState();s.relays=['lighthouse','ridge'];s.collected=['supply-0'];s.kills=['dead-0'];assert.equal(writeSave(storage,s),true);assert.deepEqual(readSave(storage).relays,s.relays);assert.equal(objective(readSave(storage)).target.id,'hospital');
 saved.set(SAVE_KEY,'{"version":1,"x":"invalid"}');assert.equal(readSave(storage),null);
 saved.set(SAVE_KEY,JSON.stringify({...s,relays:['ridge','ridge','injected'],ammo:800,reserve:-1}));const clean=readSave(storage);assert.deepEqual(clean.relays,['ridge']);assert.equal(clean.ammo,8);assert.equal(clean.reserve,0);
 s.vehicles=[{x:170,z:0,angle:1.5}];s.activeVehicle=0;writeSave(storage,s);assert.deepEqual(readSave(storage).vehicles,s.vehicles);assert.equal(readSave(storage).activeVehicle,0);
 assert.equal(writeSave({setItem(){throw Error('quota');}},s),false);
 s.relays=['lighthouse','ridge','hospital'];assert.equal(objective(s).target.id,'ferry');s.won=true;assert.equal(objective(s).target,null);
});
test('infected can route around solid buildings instead of walking into walls',()=>{
 const b=data.buildings.find(b=>!b.enterable&&b.district==='oldtown'),a={x:b.x-b.w/2-3,z:b.z},target={x:b.x+b.w/2+3,z:b.z};
 assert.equal(walkableLine(grid,a.x,a.z,target.x,target.z),false);const path=findLocalPath(grid,a.x,a.z,target.x,target.z,2500);assert.ok(path.length>2);let previous=a;for(const p of path){assert.equal(walkableLine(grid,previous.x,previous.z,p.x,p.z),true);previous=p;}
 const closed=new SpatialGrid([{x:-740,z:280,w:12,d:12,y:0,h:100}]);assert.deepEqual(findLocalPath(closed,-760,280,-740,280,100),[],'Sealed goals terminate under a fixed search budget');
});
