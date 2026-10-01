import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDungeonCourse,setDungeonOpeningOpen} from '../playground/map/dungeon-course.js';
import {roomContainsCell} from '../playground/map/dungeon-compiler.js';
import {shortestPath} from '../playground/map/grid.js';
import {canStand,castRay} from '../engine.js';

function roomPoint(course,id){
 const room=course.rooms.find(r=>r.id===id);
 for(let y=room.bounds.minZ+.5;y<room.bounds.maxZ;y++)for(let x=room.bounds.minX+.5;x<room.bounds.maxX;x++)
  if(roomContainsCell(room,x,y)&&canStand(course,x,y,.16))return {x,y};
 assert.fail(`${id}: no walkable floor`);
}

test('every floor has a purposeful ordered route, optional rewards, and a reachable key before its gate',()=>{
 for(let i=0;i<5;i++){
  const course=makeDungeonCourse(i);
  assert.equal(new Set(course.route).size,course.route.length);
  assert.equal(course.rooms.find(r=>r.id===course.route[0]).kind,'entry');
  assert.equal(course.rooms.find(r=>r.id===course.route.at(-1)).kind,'exit');
  assert.ok(course.encounterRoute.length>=6);
  assert.ok(course.rooms.some(r=>r.flow.optional&&['supply','recovery'].includes(r.flow.role)));
  for(const id of course.route){
   const room=course.rooms.find(r=>r.id===id);
   assert.equal(room.flow.sequence,course.route.indexOf(id));
   assert.ok(room.flow.goal&&room.flow.landmark&&room.flow.beat);
  }
  // Combat doors may release; keyed descent barriers stay shut until the key
  // can actually be reached. This catches circular key dependencies.
  for(const opening of course.openings)if(opening.lockedBy!=='key')setDungeonOpeningOpen(course,opening.id,true);
  for(const key of course.keys)assert.ok(shortestPath(course.cells,course.w,course.h,course.playerSpawn,key),`${course.id}: key is not behind its own gate`);
  for(const opening of course.openings)setDungeonOpeningOpen(course,opening.id,true);
  let previous=course.playerSpawn;
  for(const id of course.route){const point=roomPoint(course,id);assert.ok(shortestPath(course.cells,course.w,course.h,previous,point),`${course.id}: route leg to ${id}`);previous=point;}
  for(const room of course.rooms)assert.ok(shortestPath(course.cells,course.w,course.h,course.playerSpawn,roomPoint(course,room.id)),`${room.id}: optional room reachable`);
  // Cover must not isolate a pocket of otherwise walkable room floor.
  for(const room of course.rooms)for(let y=room.bounds.minZ+.5;y<room.bounds.maxZ;y++)for(let x=room.bounds.minX+.5;x<room.bounds.maxX;x++)
   if(roomContainsCell(room,x,y)&&canStand(course,x,y,.16))assert.ok(course.dungeonCompiled.reach.has(`${Math.floor(x)},${Math.floor(y)}`),`${room.id}: cover isolates floor ${x},${y}`);
 }
});

test('authored ingress crosses the exact collision opening, from outside to inside its own room',()=>{
 for(let i=0;i<5;i++){
  const course=makeDungeonCourse(i);
  for(const opening of course.openings)setDungeonOpeningOpen(course,opening.id,true);
  for(const id of course.encounterRoute){
   const room=course.rooms.find(r=>r.id===id),groups=course.ingressGroups[id];
   assert.ok(groups.length,`${id}: no authored ingress`);
   for(const group of groups){
    const opening=course.openings.find(o=>o.id===group.openingId);
    assert.equal(opening.roomId,id);
    assert.equal(roomContainsCell(room,group.origin.x,group.origin.y),false,`${group.id}: origin cannot pop into encounter floor`);
    assert.equal(roomContainsCell(room,group.arrival.x,group.arrival.y),true);
    assert.ok(canStand(course,group.portal.x,group.portal.y,.16),`${group.id}: portal lands in a jamb`);
    const tangent=opening.axis==='h'?group.portal.x:group.portal.y;
    assert.ok(tangent>opening.span[0]&&tangent<opening.span[1]+1);
    assert.equal(opening.axis==='h'?group.portal.y:group.portal.x,opening.at);
    assert.ok(group.route.length>=3);
    for(let n=0;n<group.route.length;n++){
     const point=group.route[n];assert.ok(canStand(course,point.x,point.y,.16),`${group.id}: blocked waypoint`);
     if(!n)continue;
     const previous=group.route[n-1],distance=Math.hypot(point.x-previous.x,point.y-previous.y);
     assert.ok(distance<=1.001,`${group.id}: route jumps cells`);
     assert.ok(castRay(course,previous.x,previous.y,Math.atan2(point.y-previous.y,point.x-previous.x),distance+.01).dist>=distance-.001,`${group.id}: lane crosses a wall`);
    }
   }
  }
 }
});

test('foundry key detour returns to the hall without entering the final arena early',()=>{
 const course=makeDungeonCourse(0),court=course.rooms.find(r=>r.id==='f1-court');
 const path=shortestPath(course.cells,course.w,course.h,course.keys[0],roomPoint(course,'f1-hall'));
 assert.ok(path);
 assert.equal(path.some(p=>roomContainsCell(court,p.x,p.y)),false);
 assert.ok(course.openings.filter(o=>o.roomId==='f1-court'&&o.lockedBy==='room-clear').every(o=>!course.openingState[o.id]));
 assert.equal(course.openingState['f1-o-pump-w'],true,'pump approach remains a reachable forward route');
});

test('arrival sightlines reveal machinery and the next threshold while cover stays on the flanks',()=>{
 let checked=0;
 for(let i=0;i<2;i++){
  const course=makeDungeonCourse(i);
  for(const opening of course.openings)setDungeonOpeningOpen(course,opening.id,true);
  for(const room of course.rooms)for(const line of room.sightlines||[]){
   const [x,y]=line.from,[tx,ty]=line.to,distance=Math.hypot(tx-x,ty-y);
   assert.ok(canStand(course,x,y,.16),`${room.id}: arrival viewing point must be reachable`);
   assert.ok(castRay(course,x,y,Math.atan2(ty-y,tx-x),distance+.01).dist>=distance-.001,
    `${room.id}: cover hides ${line.purpose}`);
   assert.ok(course.blocks.some(([bx,by])=>roomContainsCell(room,bx,by)),`${room.id}: retain useful flank cover`);
   checked++;
  }
 }
 assert.equal(checked,11);
});

test('equipment-return loop offers another hall approach without a new pump-gate bypass',()=>{
 const course=makeDungeonCourse(0),loading=course.rooms.find(r=>r.id==='f1-loading');
 assert.equal(loading.openings.length,2);
 const seal=id=>{
  const opening=course.openings.find(o=>o.id===id),direction={n:0,e:1,s:2,w:3}[opening.side];
  for(const p of opening.edgeCells){course.cells[p.y*course.w+p.x][direction]=1;}
  for(const p of opening.outerCells){course.cells[p.y*course.w+p.x][(direction+2)%4]=1;}
 };
 // Close the original return. The new flank must independently reach the
 // hall, while the pump stays isolated if its existing doors are shut.
 seal('f1-o-loading-n');
 const path=shortestPath(course.cells,course.w,course.h,{x:17.5,y:21.5},{x:24.5,y:14.5});
 assert.ok(path);
 assert.ok(path.some(p=>p.x===24&&p.y===16),'flank crosses the authored southeast hall threshold');
 for(const opening of course.openings.filter(o=>o.roomId==='f1-pump'))seal(opening.id);
 assert.equal(shortestPath(course.cells,course.w,course.h,{x:17.5,y:21.5},{x:29.5,y:13.5}),null);
 assert.equal(course.openings.filter(o=>o.roomId==='f1-pump').length,3,'the optional loop adds no pump entrance');
});

test('expanded courts offer wide lateral maneuvering without moving their hero anchors',()=>{
 for(const [floor,id,minimum,anchor,points]of [
  [0,'f1-court',59,[17,7],[[13.5,8.5],[21.5,8.5],[17.5,10.5]]],
  [1,'f2-theater',46,[17,7],[[14.5,9.5],[21.5,9.5],[18.5,10.5]]],
 ]){
  const course=makeDungeonCourse(floor),room=course.rooms.find(r=>r.id===id);
  for(const opening of course.openings)setDungeonOpeningOpen(course,opening.id,true);
  assert.ok(room.openCells>=minimum);
  assert.deepEqual(course.landmarks.find(l=>l.roomId===id&&l.hero).anchor,anchor);
  for(const [x,y]of points){
   assert.ok(roomContainsCell(room,x,y)&&canStand(course,x,y,.32),`${id}: useful lateral clearance`);
   assert.ok(shortestPath(course.cells,course.w,course.h,{x:points[2][0],y:points[2][1]},{x,y}));
  }
 }
});

test('every rendered doorway state has a matching collision wall and reserved wall slot',()=>{
 for(let i=0;i<5;i++){
  const course=makeDungeonCourse(i),slots=new Set(course.wallSlots.map(w=>`${w.horizontal}:${w.x}:${w.z}`));
  const check=()=>{
   for(const wall of course.walls){
    assert.ok(slots.has(`${wall.horizontal}:${wall.x}:${wall.z}`));
    const approaches=wall.horizontal?[[wall.x,wall.z-.25,Math.PI/2],[wall.x,wall.z+.25,-Math.PI/2]]:[[wall.x-.25,wall.z,0],[wall.x+.25,wall.z,Math.PI]];
    for(const [x,y,angle]of approaches)if(canStand(course,x,y,.04))assert.ok(castRay(course,x,y,angle,.5).dist<=.251,`${course.id}: visible wall lacks collision`);
   }
  };
  check();for(const opening of course.openings){setDungeonOpeningOpen(course,opening.id,true);check();}
 }
});
