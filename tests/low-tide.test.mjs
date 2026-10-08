import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {newRun,tick,tickPlayer,canStand,castRay} from '../engine.js';
import {lowTideObjective,lowTidePrompt,lowTideJournal,createLowTide,updateLowTide} from '../low-tide.js';
import {createLowTideSave,lowTideSnapshot,restoreLowTide} from '../low-tide-save.js';
import {harborNavigation} from '../harbor-navigation.js';
import {collectNoises} from '../enemy-ai.js';
const fresh=()=>{const r=newRun(makeHarborCourse({lowTide:true}));r.mode='play';return r;};
function approach(r,id){const p=r.course.lowTideStations.find(p=>p.id===id);r.course.activeInterior=r.course.harborRooms.find(room=>room.id===p.roomId);Object.assign(r,{x:p.x,y:p.y,z:0,vx:0,vy:0});assert.ok(canStand(r.course,r.x,r.y,.12),id);tickPlayer(r,.016,{interact:false});}
function use(r,id){approach(r,id);const action=lowTidePrompt(r);assert.equal(action.station.id,id);tickPlayer(r,.016,{interact:true});}
test('complete chapter is ordered, allows either supply order, and remains an open world',()=>{
 const r=fresh();assert.equal(lowTideObjective(r).id,'shelter');
 use(r,'powered');assert.equal(r.lowTide.powered,false);use(r,'battery');assert.equal(r.lowTide.battery,false);
 use(r,'shelter');assert.ok(r.lowTide.shelter);use(r,'manifest');use(r,'identified');
 r.backpack.scrap=12;use(r,'fuel');use(r,'battery');assert.equal(r.backpack.scrap,12);
 const revision=r.lowTide.revision;tickPlayer(r,.016,{interact:true});assert.equal(r.lowTide.revision,revision);
 use(r,'powered');assert.ok(r.lowTide.powered);assert.equal(r.lowTide.bellRemaining,24);
 updateLowTide(r,1);assert.equal(r.lowTide.bellRemaining,24,'indoor reading does not consume the consequence');
 r.course.activeInterior=null;r.x=12;r.y=16;tick(r,.016,{});assert.ok(r.events.some(e=>e.type==='low-tide-bell'));
 assert.ok(collectNoises({...r,_noiseCursor:0}).some(n=>n.type==='low-tide-bell'&&n.radius===40));
 use(r,'shelter');assert.ok(r.lowTide.answered);assert.equal(lowTideJournal(r).length,7);assert.equal(r.mode,'play');
 assert.match(lowTideJournal(r).at(-1).text,/MARA VENN/);
 r.course.activeInterior=null;Object.assign(r,r.course.exit);r.backpack.weaponPickups=['a','b','c'];r.vehicle.distance=10;tick(r,.016,{});assert.equal(r.mode,'play','legacy salvage win cannot end the chapter');
});
test('every mission step has a collision-clear street route and an accessible indoor station',()=>{
 const r=fresh();for(const id of ['shelter','manifest','identified','battery','fuel','powered','shelter']){
  r.course.activeInterior=null;Object.assign(r,r.course.playerSpawn);const nav=harborNavigation(r);assert.ok(nav);
  let prev=r;for(const p of nav.points){const d=Math.hypot(p.x-prev.x,p.y-prev.y);assert.ok(castRay(r.course,prev.x,prev.y,Math.atan2(p.y-prev.y,p.x-prev.x),d+.01).dist>=d-.001,id);prev=p;}
  approach(r,id);const room=r.course.activeInterior;
  // Flood-fill the actual room collision, including all Thai furniture.
  const step=.08,start={...room.spawn},queue=[start],seen=new Set();let reached=false;
  for(let n=0;n<queue.length&&n<20000;n++){const p=queue[n];if(Math.hypot(p.x-r.x,p.y-r.y)<.13){reached=true;break;}
   for(const [dx,dy]of [[step,0],[-step,0],[0,step],[0,-step]]){const q={x:p.x+dx,y:p.y+dy},key=`${Math.round(q.x/step)},${Math.round(q.y/step)}`;if(!seen.has(key)&&canStand(r.course,q.x,q.y,.12)){seen.add(key);queue.push(q);}}
  }assert.ok(reached,`${id} indoor route`);use(r,id);
 }
});
test('stash conserves scrap, respects capacity, and cannot be used before claiming shelter',()=>{
 const r=fresh();r.backpack.scrap=12;use(r,'stash');assert.equal(r.lowTide.bank,0);
 use(r,'shelter');use(r,'stash');assert.equal(r.backpack.scrap,0);assert.equal(r.lowTide.bank,12);
 use(r,'stash');assert.equal(r.backpack.scrap,12);assert.equal(r.lowTide.bank,0);
 r.lowTide.bank=97;use(r,'stash');assert.equal(r.lowTide.bank,99);assert.equal(r.backpack.scrap,10);
});
test('checkpoint restores only validated state at safehouse and reports storage failure',()=>{
 const r=fresh();let text=null,writes=0;const store=createLowTideSave({getItem:()=>text,setItem:(k,v)=>{text=v;writes++;}});
 assert.equal(store.save(r),false);use(r,'shelter');use(r,'manifest');r.ownedWeapons=[0,6];r.backpack.scrap=8;use(r,'stash');
 assert.ok(store.save(r));store.save(r);assert.equal(writes,1);
 const restored=fresh();assert.ok(store.load(restored));assert.equal(restored.course.activeInterior.id,'harbor-block-3');assert.ok(canStand(restored.course,restored.x,restored.y,.12));assert.equal(restored.lowTide.bank,8);assert.deepEqual(restored.ownedWeapons,[0,6]);assert.equal(restored.vehicle.occupied,false);
 restored.health=0;assert.equal(store.save(restored),false);const retry=fresh();store.load(retry);assert.equal(retry.health,100);assert.ok(retry.lowTide.manifest);
 assert.equal(restoreLowTide(fresh(),{version:99}),false);
 assert.equal(createLowTide({answered:true,powered:true}).answered,false);
 const broken=createLowTideSave({getItem:()=>'{',setItem:()=>{throw Error('denied');}});assert.equal(broken.load(fresh()),false);assert.equal(broken.save(r),false);assert.match(r.lowTideSaveStatus,/unavailable/);const sessionRetry=fresh();assert.ok(broken.load(sessionRetry));assert.ok(sessionRetry.lowTide.manifest);
 assert.ok(lowTideSnapshot(r));
});
test('inactive, airborne and distant interactions cannot advance the chapter',()=>{
 const r=fresh();approach(r,'shelter');r.mode='pause';tickPlayer(r,.016,{interact:true});assert.equal(r.lowTide.shelter,false);
 r.mode='play';r.z=1;tickPlayer(r,.016,{interact:false});tickPlayer(r,.016,{interact:true});assert.equal(r.lowTide.shelter,false);
 r.z=0;r.x+=1;tickPlayer(r,.016,{interact:false});tickPlayer(r,.016,{interact:true});assert.equal(r.lowTide.shelter,false);
});

test('shift bell reaches resident minds and moves living infected toward the dock circuit',()=>{
 const r=fresh();for(const id of ['shelter','manifest','identified','battery','fuel','powered'])use(r,id);
 r.course.activeInterior=null;Object.assign(r,{x:5.5,y:26,z:0,vx:0,vy:0});
 tick(r,.016,{});const before=r.course.enemies.map(e=>({id:e.id,x:e.x,y:e.y}));
 let heard=false;
 for(let n=0;n<200;n++){
  r.events.length=0;r._noiseCursor=0;tick(r,.05,{});
  heard ||= r.course.enemies.some(e=>e.mind?.noise?.x===16&&e.mind?.noise?.y===17);
 }
 assert.ok(heard,'at least one resident receives the bell target');
 assert.ok(r.course.enemies.some(e=>{const p=before.find(p=>p.id===e.id);return p&&Math.hypot(e.x-p.x,e.y-p.y)>.2;}),'resident movement is observable');
});
