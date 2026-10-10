import test from 'node:test';import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';import {canStand,castRay} from '../engine.js';import{groundAt}from'../coastal-terrain.js';import{createHarborVehicle}from'../harbor-vehicle.js';import{createVehicleFleet,createVehiclePhysicsContext}from'../harbor-vehicle-fleet.js';import{tickHarborHelicopter}from'../harbor-helicopter.js';
test('Shift removes forward inertia through swept flight before Ctrl lands on actual clear dock ground without recovery',()=>{
 const c=makeHarborCourse({openWorld:true}),f=createVehicleFleet(c,createHarborVehicle(c)),ctx=createVehiclePhysicsContext(c,f,{canStand,castRay,groundAt}),v=f.helicopter,r={course:ctx.facade,x:v.x,y:v.y,z:0,health:100,distance:0,events:[]};v.occupied=true;
 const advance=(seconds,input)=>{for(let i=0;i<Math.round(seconds*120);i++)tickHarborHelicopter(r,v,1/120,input,ctx);};
 advance(3,{jump:true});assert(v.altitudeM>2);advance(.8,{forward:1});const flight={x:v.x*4,z:v.y*4,altitudeM:v.altitudeM,vxM:v.vxM};assert(flight.vxM< -10);assert(flight.x>90&&flight.x<91);
 advance(.034,{interact:true});assert(v.occupied);const brakeStart=v.x*4,altBefore=v.altitudeM;advance(2,{dash:true});const stop={x:v.x*4,z:v.y*4,altitudeM:v.altitudeM,speedM:Math.hypot(v.vxM,v.vzM)};
 assert(stop.x>88&&stop.x<90,'real braking distance keeps full airframe above clear dock');assert(stop.x<brakeStart-.5,'brake decelerates through actual swept movement rather than snapping velocity/pose');assert(stop.speedM<.001);assert(v.altitudeM>=altBefore,'airbrake does not change collective');
 advance(5,{slide:true,dash:true});assert.equal(v.landed,true);assert.equal(v.altitudeM,ctx.aerial.landing(v.x*4,v.y*4,v.angle));assert.equal(ctx.aerial.blocked(v.x*4,v.y*4,v.altitudeM,v.angle,v.id),false);assert(!r.events.some(e=>e.type==='helicopter-impact'||e.type==='vehicle-recovered'));assert(r.events.some(e=>e.type==='helicopter-land'));
 console.log(JSON.stringify({flight,stop,landing:{x:v.x*4,z:v.y*4,altitudeM:v.altitudeM,landed:v.landed}}));ctx.dispose();
});
