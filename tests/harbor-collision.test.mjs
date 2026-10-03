import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,canStand,castRay,tick} from '../engine.js';
import {propSegmentClear} from '../harbor-collision.js';
import {findPath} from '../enemy-ai.js';
function course(){return {...makeCourse(),obstacles:[{id:'van',minX:5,maxX:6,minY:5,maxY:6}]};}
test('static imported prop bounds stop feet, swept movement and sight from both axes',()=>{
 const c=course();assert.equal(canStand(c,5.5,5.5),false);assert.equal(canStand(c,4.9,5.5,.16),false);assert.ok(canStand(c,4.8,5.5,.16));
 for(const[x,y,a]of [[4,5.5,0],[7,5.5,Math.PI],[5.5,4,Math.PI/2],[5.5,7,-Math.PI/2]]){
  const hit=castRay(c,x,y,a,5);assert.equal(hit.obstacleId,'van');assert.ok(Math.abs(hit.dist-1)<1e-6);
 }
 assert.equal(propSegmentClear(c,4,5.5,7,5.5),false);
 const r=newRun(c);r.mode='play';r.x=4;r.y=5.5;r.angle=0;
 for(let i=0;i<90;i++)tick(r,.05,{forward:1});assert.ok(r.x<5);assert.ok(canStand(c,r.x,r.y));
});
test('infected pathfinding routes around a prop rather than through its cell',()=>{
 const c=course(),env={canStand,castRay};const path=findPath(env,c,{x:4.5,y:5.5},{x:7.5,y:5.5});
 assert.ok(path?.length);let previous={x:4.5,y:5.5};for(const p of path){assert.ok(propSegmentClear(c,previous.x,previous.y,p.x,p.y));previous=p;}
});
