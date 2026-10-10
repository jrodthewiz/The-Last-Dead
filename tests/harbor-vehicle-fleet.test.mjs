import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand,castRay} from '../engine.js';
import {groundAt} from '../coastal-terrain.js';
import {createHarborVehicle} from '../harbor-vehicle.js';
import {createVehicleFleet,createVehiclePhysicsContext,tickVehicleFleet,snapshotVehicleFleet,restoreVehicleFleet,recoverVehicle} from '../harbor-vehicle-fleet.js';
import {makeUtilityHelicopter} from '../assets/blackwater-kit/utility-helicopter.js';
import {buildCoastalMaritime} from '../coastal-maritime-visuals.js';
const course=makeHarborCourse({openWorld:true}),before=JSON.stringify(course.obstacles),fleet=createVehicleFleet(course,createHarborVehicle(course)),context=createVehiclePhysicsContext(course,fleet,{canStand,castRay,groundAt});
const run={course:context.facade,sourceCourse:course,vehicle:fleet.vehicles[0],vehicleFleet:fleet,vehiclePhysics:context,x:24,y:27.2,z:0,health:100,distance:0,events:[],vx:0,vy:0,vz:0};
function step(input={},n=1){for(let i=0;i<n;i++)tickVehicleFleet(run,1/120,input,context);}
test('per-run facade removes only16 usable static cars; wrecks/original authority remain and dynamic collision follows poses',()=>{
 assert.equal(fleet.cars.length,16);assert.equal(course.obstacles.length-context.facade.obstacles.length,16);assert.equal(JSON.stringify(course.obstacles),before);assert.notEqual(context.staticCourse,context.facade);assert.equal(context.staticCourse.vehiclePhysics,undefined);
 const car=fleet.cars[3],x=car.x,y=car.y;assert.equal(context.stand(x,y,.1),false);assert.equal(context.stand(x,y,.1,undefined,undefined,car.id),true);car.x+=4;
 assert.equal(context.stand(x,y,.1),true);assert.equal(context.stand(car.x,car.y,.1),false);assert.equal(context.ray(car.x-1.5,car.y,0,3,.4).obstacleId,car.id);car.x=x;
 context.facade.activeInterior={id:'forwarding-proof'};assert.equal(context.staticCourse.activeInterior,context.facade.activeInterior);context.facade.activeInterior=null;
});
test('live source replacements and facade writes retain public course semantics without sharing fleet state',()=>{
 const oldHarbor=course.harbor,oldEnemies=course.enemies,replacement=[{id:'source-enemy'}];course.harbor=false;course.enemies=replacement;
 assert.equal(context.facade.harbor,false);assert.equal(context.staticCourse.harbor,false);assert.equal(context.facade.enemies,replacement);assert.equal(context.staticCourse.enemies,replacement);
 const next=[{id:'facade-enemy'}];context.facade.enemies=next;assert.equal(course.enemies,next);assert.equal(context.staticCourse.enemies,next);
 const oldObstacles=course.obstacles;assert.notEqual(context.facade.obstacles,oldObstacles);assert.equal(course.vehiclePhysics,undefined);context.facade.activeInterior={id:'private-room'};assert.equal(context.staticCourse.activeInterior.id,'private-room');assert.notEqual(course.activeInterior,context.facade.activeInterior);
 course.harbor=oldHarbor;course.enemies=oldEnemies;context.facade.activeInterior=null;
});
test('car Q edge enters once, swept drive brakes and exits; legacy mission truck remains distinct',()=>{
 const car=fleet.cars[3];run.x=car.x;run.y=car.y-.8;step({interact:true});assert.equal(fleet.activeId,car.id);assert.equal(car.occupied,true);const start=car.x;step({interact:true,forward:1},180);assert.ok(car.x>start+.5);assert.equal(car.occupied,true);assert.equal(run.vehicle.distance,0);
 step({},1);step({interact:true});assert.equal(car.occupied,true);step({jump:true},100);step({interact:true});assert.equal(car.occupied,false);assert.equal(context.stand(run.x,run.y,.12),true);
 assert.ok(recoverVehicle(run,car.id));assert.equal(car.x,car.home.x);
});
test('utility model is carried on skid contact, bounded rotor/tail and idempotent ownership',()=>{
 const model=makeUtilityHelicopter();assert.ok(model.diagnostics.triangles<=20000);assert.equal(model.diagnostics.draws,8);assert.equal(model.diagnostics.materials,6);assert.equal(model.diagnostics.textures,0);assert.ok(Math.abs(model.bounds.min.y)<1e-7);assert.ok(model.bounds.min.x< -6.4&&model.bounds.max.z>=5.19);
 let gd=0,md=0;const mats=new Set();model.root.traverse(o=>{if(o.isMesh){o.geometry.addEventListener('dispose',()=>gd++);mats.add(o.material);for(const a of Object.values(o.geometry.attributes))for(const n of a.array)assert.ok(Number.isFinite(n));}});for(const m of mats)m.addEventListener('dispose',()=>md++);model.dispose();model.dispose();assert.equal(gd,8);assert.equal(md,6);
});
test('actual home clears full flight volume; water/stacks block, takeoff cannot eject airborne and checked recovery works',()=>{
 const h=fleet.helicopter;assert.equal(context.aerial.landing(96,112,Math.PI),0);assert.equal(context.aerial.blocked(96,112,0,Math.PI,h.id),false);assert.equal(context.aerial.landing(96,130,0),null);
 const tall=context.aerial.volumes.filter(v=>v.source.includes('architecture')).sort((a,b)=>b.maxY-a.maxY)[0];assert.ok(tall.maxY>30);const cx=(tall.minX+tall.maxX)/2,cz=(tall.minZ+tall.maxZ)/2;assert.equal(context.aerial.ray(tall.minX-2,cz,0,tall.maxX-tall.minX+4,tall.maxY-1).obstacleId,tall.id);assert.notEqual(context.aerial.ray(tall.minX-2,cz,0,tall.maxX-tall.minX+4,tall.maxY+20).obstacleId,tall.id);assert.equal(context.ray(24,28,0,4,30,0,h.id).aerial,true);assert.equal(context.aerial.blocked((tall.minX+tall.maxX)/2,(tall.minZ+tall.maxZ)/2,tall.maxY-2,0,h.id),true);
 run.x=h.x;run.y=h.y-.8;step({});step({interact:true});assert.equal(h.occupied,true);step({jump:true},720);assert.ok(h.altitudeM>10);assert.equal(h.landed,false);step({interact:true});assert.equal(h.occupied,true);assert.ok(run.events.some(e=>e.type==='vehicle-land-first'));
 step({slide:true},1000);assert.equal(h.landed,true);assert.equal(h.altitudeM,0);step({interact:true});assert.equal(h.occupied,false);const rotor=h.rotorSpeed;step({},60);assert.ok(h.rotorSpeed<rotor);
 h.altitudeM=20;h.landed=false;assert.equal(recoverVehicle(run,h.id),true);assert.equal(h.altitudeM,0);assert.equal(h.damage,0);
});
test('fleet snapshots preserve canonical poses; malformed updates reject atomically without copying arbitrary state',()=>{
 const snapshot=snapshotVehicleFleet(fleet),old=JSON.stringify(snapshot);const bad=structuredClone(snapshot);bad.vehicles[1].x=NaN;assert.equal(restoreVehicleFleet(fleet,bad),false);assert.equal(JSON.stringify(snapshotVehicleFleet(fleet)),old);const good=structuredClone(snapshot);good.vehicles[1].x+=.1;good.vehicles[1].home={x:999};assert.equal(restoreVehicleFleet(fleet,good),true);assert.notEqual(fleet.vehicles[1].home.x,999);restoreVehicleFleet(fleet,snapshot);
});
test('same nine maritime batches move car vertices with unchanged buffers and updated live culling bounds',()=>{
 const world={course,root:new THREE.Group(),diagnostics:{}},art=buildCoastalMaritime(world),versions=art.root.children.map(m=>m.geometry.attributes.position.version),car=fleet.cars[0];assert.equal(art.diagnostics.drawCalls,9);assert.equal(art.diagnostics.poseUniformBytes,1536);assert.equal(art.diagnostics.staticFinishUniformBytes,1920);
 car.x+=100;fleet.revision++;art.update(0,fleet);const pose=new THREE.Matrix4();art.getPose(4,pose);assert.ok(pose.elements[12]>399);for(const mesh of art.root.children)assert.ok(mesh.geometry.boundingBox.max.x>=car.x*4);assert.deepEqual(art.root.children.map(m=>m.geometry.attributes.position.version),versions);car.x=car.home.x;fleet.revision++;art.update(0,fleet);art.dispose();art.dispose();
});
