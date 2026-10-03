import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,tick,canStand,castRay,shoot,switchWeapon} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';
import {tickHarborVehicle,vehicleCanStand,vehicleContains} from '../harbor-vehicle.js';
const env={canStand,castRay};
function fresh(){const r=newRun(makeHarborCourse(makeCourse()));r.mode='play';r.harborProgress.initialized=true;r.x=16;r.y=15;return r;}

test('Q enters once, held Q does not eject, driving brakes and safely exits',()=>{
 const r=fresh();tick(r,1/120,{interact:true});assert.equal(r.vehicle.occupied,true);
 for(let i=0;i<120;i++)tick(r,1/120,{interact:true,forward:1});
 assert.ok(r.vehicle.distance>.5);assert.equal(r.vehicle.occupied,true);assert.ok(r.x>16);
 tick(r,1/120,{});tick(r,1/120,{interact:true});assert.equal(r.vehicle.occupied,true);
 assert.ok(r.events.some(e=>e.type==='vehicle-stop-first'));
 for(let i=0;i<80;i++)tick(r,1/120,{jump:true});
 tick(r,1/120,{interact:true});assert.equal(r.vehicle.occupied,false);
 assert.ok(canStand(r.course,r.x,r.y,.12));assert.equal(vehicleContains(r.vehicle,r.x,r.y,.1),false);
});

test('truck footprint cannot tunnel through the shoreline or boundaries at frame spikes',()=>{
 const r=fresh();Object.assign(r.vehicle,{x:30,y:27,angle:0,occupied:true,speed:3.2});
 for(let i=0;i<120;i++)tickHarborVehicle(r,.5,{forward:1},env);
 assert.ok(r.vehicle.x<31.5);assert.equal(vehicleCanStand(r.course,r.vehicle,r.vehicle.x,r.vehicle.y,r.vehicle.angle,canStand),true);
 Object.assign(r.vehicle,{x:21.5,y:28,angle:Math.PI/2,speed:3.2});
 for(let i=0;i<80;i++)tickHarborVehicle(r,.5,{forward:1,strafe:.1},env);
 assert.ok(r.vehicle.y<29.5);assert.ok(vehicleCanStand(r.course,r.vehicle,r.vehicle.x,r.vehicle.y,r.vehicle.angle,canStand));
});

test('a sealed wall prevents entry and blocked doors prevent unsafe dismount',()=>{
 const r=fresh();r.x=15.95;r.y=14;r.vehicle.x=16.5;r.course.cells[14*r.course.w+15][1]=1;
 tickHarborVehicle(r,.01,{interact:true},env);assert.equal(r.vehicle.occupied,false);
 r.course=makeHarborCourse(makeCourse());r.vehicle.occupied=true;r.vehicle.speed=0;r.vehicle.interactHeld=false;
 tickHarborVehicle(r,.01,{interact:true},{...env,canStand:()=>false});assert.equal(r.vehicle.occupied,true);
 assert.ok(r.events.some(e=>e.type==='vehicle-exit-blocked'));
});

test('weapons require ownership, driving suppresses firing, and a fresh expedition resets vehicle and bag',()=>{
 const r=fresh();assert.deepEqual(r.ownedWeapons,[0]);assert.equal(switchWeapon(r,6),false);
 tick(r,.01,{interact:true});const sequence=r.shotSequence;assert.equal(shoot(r),false);assert.equal(r.shotSequence,sequence);
 const copy=fresh();assert.equal(copy.vehicle.occupied,false);assert.equal(copy.vehicle.distance,0);assert.deepEqual(copy.ownedWeapons,[0]);
});

test('harbor extraction requires three recovered weapons and travel, never a synthetic arena wave',()=>{
 const r=fresh();r.x=r.course.exit.x;r.y=r.course.exit.y;tick(r,.01,{});assert.equal(r.mode,'play');assert.equal(r.wave,0);
 r.backpack.weaponPickups=['one','two','three'];r.vehicle.distance=8;
 tick(r,.01,{});assert.equal(r.mode,'win');assert.equal(r.harborProgress.ready,true);
});
