import test from 'node:test';
import assert from 'node:assert/strict';
import {FirstPersonMotion} from '../first-person-motion.js';

test('eye presence is centered when stationary and bounded through footsteps, turn and landing',()=>{
 const motion=new FirstPersonMotion(),run={angle:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,distance:0,course:{}};
 assert.equal(motion.update(run,.016,{now:16}).y,0);
 let now=16;
 for(let i=0;i<180;i++){now+=16;run.x+=.02;run.angle+=.009;run.vx=2;run.vy=.2;run.distance+=.04;if(i===50){run.z=.5;run.vz=-1;}if(i===60){run.z=0;run.vz=0;}const p=motion.update(run,.016,{now});assert.ok(Math.abs(p.x)<.005);assert.ok(Math.abs(p.y)<.024);assert.ok(Math.abs(p.roll)<.008);assert.ok(Math.abs(p.pitch)<.011);}
 const held={...motion.pose};assert.deepEqual(motion.update(run,0,{now}),held);assert.deepEqual(motion.update(run,.016,{reducedMotion:true,now}),{x:0,y:0,pitch:0,roll:0});
});
