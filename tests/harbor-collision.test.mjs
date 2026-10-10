import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,canStand,castRay,tick} from '../engine.js';
import {propCanStand,propSegmentClear} from '../harbor-collision.js';
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

// The former 0.08-cell sampler is kept only as a regression witness.
function sampledSegmentClear(c,x,y,xx,yy,radius=.16){
 const steps=Math.max(1,Math.ceil(Math.hypot(xx-x,yy-y)/.08));
 for(let i=0;i<=steps;i++){
  const t=i/steps;if(!propCanStand(c,x+(xx-x)*t,y+(yy-y)*t,radius))return false;
 }
 return true;
}
const boxCourse=(bounds={minX:0,maxX:1,minY:0,maxY:1})=>({obstacles:[bounds]});
function bothDirections(c,x,y,xx,yy,radius,expected){
 assert.equal(propSegmentClear(c,x,y,xx,yy,radius),expected,'forward');
 assert.equal(propSegmentClear(c,xx,yy,x,y,radius),expected,'reverse');
}

test('continuous clearance rejects shallow corner grazes missed between samples',()=>{
 const c=boxCourse({minX:0,maxX:.01,minY:0,maxY:.01});
 assert.equal(sampledSegmentClear(c,-.2,.169,.2,.169,.16),true,'baseline misses overlap');
 bothDirections(c,-.2,.169,.2,.169,.16,false);
});

test('continuous clearance retains circular corners and strict tangency',()=>{
 const c=boxCourse();
 bothDirections(c,-1,1.125,2,1.125,.125,true);
 bothDirections(c,-1,1.124,2,1.124,.125,false);
 bothDirections(c,-.1,-.1,-.08,-.08,.1,true,'outside rounded corner');
 bothDirections(c,-.04,-.04,-.06,-.06,.1,false);
 bothDirections(c,-1,-1,2,2,0,false);
 bothDirections(c,-1,0,2,0,0,true);
 bothDirections(c,-1,1,1,-1,0,true,'single corner touch');
 bothDirections(c,.5,.5,2,2,0,false);
 bothDirections(c,-1,.5,.5,.5,0,false);
});

test('zero-length clearance agrees with point clearance inside, outside and on boundaries',()=>{
 const c=boxCourse();
 for(const radius of [0,.125])for(const [x,y] of [[.5,.5],[-1,-1],[0,.5],[-.125,.5],[1.125,.5]]){
  assert.equal(propSegmentClear(c,x,y,x,y,radius),propCanStand(c,x,y,radius));
 }
});

test('long segments inspect every obstacle and leave separated routes open',()=>{
 const c={obstacles:[{minX:5,maxX:6,minY:5,maxY:6},{minX:500,maxX:500.001,minY:0,maxY:.001}]};
 bothDirections(c,-100,.0005,1000,.0005,0,false);
 bothDirections(c,-100,2,1000,2,.16,true);
 assert.equal(propSegmentClear({obstacles:[]},-100,0,1000,0),true);
});
