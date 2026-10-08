import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {newRun,tickPlayer,canStand,castRay} from '../engine.js';
import {harborRoomPrompt} from '../harbor-interiors.js';
test('all six rooms enter, contain movement and rays, search once, and preserve exterior state on exit',()=>{
 const course=makeHarborCourse(),r=newRun(course);r.mode='play';
 const vehicle=r.vehicle;r.ownedWeapons.push(6);
 for(const room of course.harborRooms){
  Object.assign(r,room.door);assert.ok(canStand(course,r.x,r.y,.12),room.name);
  tickPlayer(r,1/60,{interact:false});assert.equal(harborRoomPrompt(r).kind,'enter');tickPlayer(r,1/60,{interact:true});
  assert.equal(course.activeInterior,room);assert.ok(canStand(course,r.x,r.y,.12));
  assert.ok(castRay(course,r.x,r.y,-Math.PI/2,30).dist<room.depth/4);
  for(let i=0;i<200;i++)tickPlayer(r,.05,{forward:1});
  assert.ok(canStand(course,r.x,r.y,.1),'walking remains inside room');
  Object.assign(r,{x:room.cache.x-.4,y:room.cache.y,vx:0,vy:0});assert.ok(canStand(course,r.x,r.y,.1));
  const before=r.backpack.scrap;tickPlayer(r,.016,{interact:false});tickPlayer(r,.016,{interact:true});assert.equal(r.backpack.scrap,before+2);
  tickPlayer(r,.016,{interact:false});tickPlayer(r,.016,{interact:true});assert.equal(r.backpack.scrap,before+2);
  Object.assign(r,room.exit);tickPlayer(r,.016,{interact:false});tickPlayer(r,.016,{interact:true});assert.equal(course.activeInterior,null);
  assert.ok(canStand(course,r.x,r.y,.12));assert.equal(r.vehicle,vehicle);assert.ok(r.ownedWeapons.includes(6));
 }
 assert.equal(r.backpack.scrap,12);newRun(course);assert.equal(course.activeInterior,null);
});

test('partial and full backpacks retain uncollected room supplies',()=>{
 const course=makeHarborCourse(),r=newRun(course),room=course.harborRooms[0];r.mode='play';course.activeInterior=room;
 Object.assign(r,{x:room.cache.x-.4,y:room.cache.y});r.backpack.scrap=11;
 const search=()=>{tickPlayer(r,.016,{interact:false});tickPlayer(r,.016,{interact:true});};
 search();assert.equal(r.backpack.scrap,12);assert.equal(r.harborRooms[room.id],1);
 assert.equal(harborRoomPrompt(r).label,'BACKPACK FULL');search();assert.equal(r.harborRooms[room.id],1);
 r.backpack.scrap=4;search();assert.equal(r.backpack.scrap,5);assert.equal(r.harborRooms[room.id],2);
 assert.equal(harborRoomPrompt(r).label,'SUPPLIES SEARCHED');search();assert.equal(r.backpack.scrap,5);
});
