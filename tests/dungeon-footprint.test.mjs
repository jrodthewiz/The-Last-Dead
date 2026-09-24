import test from 'node:test';
import assert from 'node:assert/strict';
import {newRun,tick} from '../engine.js';
import {makeDungeonCourse} from '../playground/map/dungeon-course.js';

test('dungeon active room excludes clipped footprint cells and supports legacy bounds',()=>{
 const r=newRun(makeDungeonCourse(0));r.mode='play';r.waveDelay=999;
 const x=Math.floor(r.x),y=Math.floor(r.y);
 const room={id:'footprint-fixture',bounds:{minX:x,minZ:y,maxX:x+2,maxZ:y+2},footprint:['01','11']};
 r.course.rooms=[room];
 tick(r,1/120,{});assert.equal(r.dungeonProgression.activeRoomId,null,'a clipped corner is outside the room');
 room.footprint[0]='11';
 tick(r,1/120,{});assert.equal(r.dungeonProgression.activeRoomId,room.id,'a walkable room cell activates the room');
 delete room.footprint;
 tick(r,1/120,{});assert.equal(r.dungeonProgression.activeRoomId,room.id,'older rooms still use their rectangular bounds');
});
