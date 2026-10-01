import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDungeonCourse, setDungeonOpeningOpen } from '../playground/map/dungeon-course.js';
import { newRun, tick, canStand, castRay, makeCourse, addPeer, tickPlayer } from '../engine.js';
import { pickSpawnPoint, seenByPlayers, findPath, createPacing, updatePacing } from '../enemy-ai.js';
const env = { canStand, castRay };
const step = (run, frames = 1, kill = false) => {
  for (let i = 0; i < frames; i++) {
    tick(run, 1 / 60, {});
    if (kill) for (const e of run.course.enemies) e.dead = true;
  }
};
function pointInRoom(run, roomId) {
  const room = run.course.rooms.find(room => room.id === roomId);
  return run.dungeonProgression.roomSpawnCells[roomId].find(p => canStand(run.course,p.x,p.y,.16)
    && findPath(env,run.course,run,p,run.course.w*run.course.h)) || null;
}

test('all floors expose useful room purposes, reachable supplies and fewer side locks', () => {
  for (let floor = 0; floor < 5; floor++) {
    const course = makeDungeonCourse(floor), run = newRun(course);
    assert.ok(course.rooms.every(room => room.flow?.goal && Number.isInteger(room.flow.sequence)));
    assert.ok(course.supplies.length > 0);
    for (const supply of course.supplies) {
      assert.ok(canStand(course,supply.x,supply.y,.16));
      assert.ok(supply.health > 0 && supply.energy > 0);
    }
    assert.ok(course.flowOpenings.every(id => course.openingState[id]));
    assert.ok(course.openings.filter(o => o.lockedBy === 'key').every(o => !course.openingState[o.id]));
    for (const key of course.keys) assert.ok(run.dungeonProgression.encounterPlan.some(node => node.roomId === key.roomId && !node.optional));
    const required = run.dungeonProgression.encounterPlan.filter(node=>!node.optional);
    assert.ok(Math.max(...required.map(node=>node.spawns.length)) > required[0].spawns.length,
      'the authored climax has more pressure than the orientation room');
    for(const node of required)assert.equal(node.spawns.length,run.course.rooms.find(room=>room.id===node.roomId).encounter.budget);
  }
});

test('spawn waits never permit pop-in, disconnected rooms, or a co-op partner watching', () => {
  const course=makeCourse(), player={x:6,y:6,angle:0,health:100};
  const front={x:10.5,y:6.5,kind:'door'}, behind={x:1.5,y:6.5,kind:'door'};
  assert.equal(pickSpawnPoint(env,course,[player],[],[front],{minDist:3.5,relax:999}),null);
  assert.equal(pickSpawnPoint(env,course,[player],[],[{x:5,y:6}],{minDist:5,relax:999}),null);
  assert.ok(pickSpawnPoint(env,course,[player],[],[behind],{minDist:3.5}));
  const peer={x:1.5,y:10.5,angle:-Math.PI/2,health:100};
  assert.equal(pickSpawnPoint(env,course,[player,peer],[],[behind],{minDist:3.5}),null);
  // Sealing a full strip invalidates the cached reachability immediately.
  course.cells=course.cells.map(c=>[...c]);
  for(let y=0;y<course.h;y++){course.cells[y*course.w+3][1]=1;course.cells[y*course.w+4][3]=1;}
  assert.equal(pickSpawnPoint(env,course,[player],[],[behind],{minDist:3.5,relax:999}),null);
});

test('opening beat starts quickly, spawned packs remain safe and globally bounded', () => {
  for(let floor=0;floor<5;floor++){
    const run=newRun(makeDungeonCourse(floor));run.mode='play';run.health=9999;
    step(run,100);assert.equal(run.wave,0);
    const spawned=[];
    for(let i=0;i<900;i++){
      step(run);
      for(const event of run.events.filter(e=>e.type==='spawn')){
        spawned.push(event);
        assert.ok(Math.hypot(event.x-run.x,event.y-run.y)>=3.49,`${floor}: spawn clearance`);
        assert.equal(seenByPlayers(env,run.course,[run],event.x,event.y,{fov:1.4,range:45,near:2.65}),false,`${floor}: spawn visible`);
        assert.ok(findPath(env,run.course,event,run,run.course.w*run.course.h),`${floor}: spawn disconnected`);
      }
      assert.ok(run.course.enemies.filter(e=>!e.dead).length<=12);
    }
    assert.equal(run.wave,1);assert.ok(spawned.length>=2,`${floor}: opening pressure arrived`);
  }
});

test('entering a reachable later room activates it without clearing distant branches first', () => {
  const run=newRun(makeDungeonCourse(0));run.mode='play';run.health=9999;
  const node=run.dungeonProgression.encounterPlan.find(n=>n.roomId==='f1-ward');
  const point=pointInRoom(run,node.roomId);
  run.x=point.x;run.y=point.y;step(run);
  assert.equal(run.dungeonProgression.currentEncounter?.roomId,node.roomId);
  assert.equal(run.dungeonProgression.encounterPlan[0].status,'pending');
});

test('route waypoints follow open grid paths and caches apply once to the collector', () => {
  const run=newRun(makeDungeonCourse(0));run.mode='play';run.health=60;run.energy=40;
  step(run);
  const navigation=run.dungeonProgression.navigation;
  assert.ok(navigation.path.length);
  let previous=run;
  for(const point of navigation.path){
    const distance=Math.hypot(point.x-previous.x,point.y-previous.y);
    assert.ok(castRay(run.course,previous.x,previous.y,Math.atan2(point.y-previous.y,point.x-previous.x),distance+.1).dist>=distance-.01);
    previous=point;
  }
  const supply=run.course.supplies.find(s=>s.roomId==='f1-sluice');
  const peer=addPeer(run);peer.health=30;peer.energy=20;peer.x=supply.x;peer.y=supply.y;
  step(run);
  assert.equal(run.health,60);assert.equal(peer.health,55);assert.equal(peer.energy,55);
  assert.deepEqual(run.dungeonProgression.suppliesCollected,[supply.id]);
  step(run,10);assert.equal(peer.health,55);
  // Prediction advances a player, never the host's encounter or pickups.
  const before=run.dungeonProgression.completedEncounterIds.length;
  tickPlayer(peer,1/60,{});assert.equal(run.dungeonProgression.completedEncounterIds.length,before);
});

test('short relief rebuilds pressure, recovery rooms and low health provide breathing room', () => {
  const observation={hunting:0,near:0,health:100,encounterActive:false,cleared:1,maxAmbushes:5,hostile:0};
  const pacing=createPacing();let verdict;
  for(let n=0;n<52;n++)verdict=updatePacing(pacing,observation,.25);
  assert.equal(verdict.ambush,true);
  assert.equal(updatePacing(pacing,{...observation,recoveryRoom:true},.25).ambush,false);
});

test('required encounters across all floors complete without optional branch backtracking', () => {
  for(let floor=0;floor<5;floor++){
    const run=newRun(makeDungeonCourse(floor));run.mode='play';run.health=9999;
    const progression=run.dungeonProgression;
    let guard=0;
    while(progression.encounterPlan.some(n=>!n.optional&&n.status!=='cleared')&&guard++<25){
      const node=progression.encounterPlan.find(n=>!n.optional&&n.status==='pending'&&pointInRoom(run,n.roomId));
      assert.ok(node,`${floor}: required plan has pending node`);
      const point=pointInRoom(run,node.roomId);run.x=point.x;run.y=point.y;
      // Aim north throughout; unsafe points must remain deferred, not forced.
      run.angle=-Math.PI/2;
      let frames=0;
      while(node.status!=='cleared'&&frames++<1800){
        step(run,1,true);
        if(frames%180===0)run.angle+=Math.PI/2;
      }
      assert.equal(node.status,'cleared',`${floor}/${node.roomId}: encounter completes`);
    }
    assert.ok(guard<25);
    for(const key of run.course.keys){run.x=key.x;run.y=key.y;step(run,1,true);}
    step(run,120,true);
    assert.equal(progression.exitReady,true,`${floor}: required route opens exit`);
    assert.ok(progression.encounterPlan.filter(n=>n.optional).every(n=>n.status==='pending'||n.status==='cleared'));
  }
});
