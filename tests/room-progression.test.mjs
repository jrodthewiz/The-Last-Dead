import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCampaignCourse, newRun, tick, canStand, castRay } from '../engine.js';
import {
  CAMPAIGN_ROOMS,
  ROOM_PROGRESSION_VERSION,
  canTraverseRoomGates,
  completeRoom,
  createRoomProgression,
  getRoomSequence,
  roomAt,
  roomProgressionSnapshot,
  syncRoomGateCells,
  updateRoomProgression,
} from '../room-progression.js';

test('campaign rooms are deterministic disjoint bands with paired gated connectors', () => {
  assert.equal(CAMPAIGN_ROOMS.length, 12);
  for (const sectorId of ['bloodworks', 'ossuary', 'choir']) {
    const sequence = getRoomSequence(sectorId);
    assert.equal(sequence.length, 4);
    for (let index = 0; index < sequence.length; index += 1) {
      const room = sequence[index];
      assert.equal(room.index, index);
      assert.ok(room.bounds.minZ < room.bounds.maxZ);
      assert.equal(room.bounds.minX, 0);
      assert.equal(room.bounds.maxX, 12);
      assert.ok(room.spawnPoints.length >= 2);
      const doors = room.portals.filter(portal => portal.kind === 'door' || portal.kind === 'lift');
      assert.equal(doors.length, 2);
      assert.ok(room.encounter);
      if (room.role === 'objective') assert.deepEqual(room.encounter.waves, []);
      else assert.equal(room.encounter.waves.length, 1);
      if (index) assert.ok(room.bounds.maxZ < sequence[index - 1].bounds.minZ);
    }
  }
});

test('locked room barriers block the center and both door spans until clear', () => {
  const course = makeCampaignCourse(0);
  const progression = createRoomProgression(course, 0);
  const first = getRoomSequence('bloodworks')[0];
  const barrier = progression.barriers['bloodworks-barrier-0'];
  assert.equal(progression.version, ROOM_PROGRESSION_VERSION);
  assert.equal(barrier.open, false);
  assert.equal(canTraverseRoomGates(course, progression, 6, 9.2, 6, 8.8), false);
  assert.equal(canTraverseRoomGates(course, progression, 2, 9.2, 2, 8.8), false);
  assert.equal(canTraverseRoomGates(course, progression, .5, 9.2, .5, 8.8), false);
  assert.equal(canTraverseRoomGates(course, progression, 3.5, 9.2, 3.5, 8.8), false);
  assert.equal(canTraverseRoomGates(course, progression, 11.5, 9.2, 11.5, 8.8), false);
  assert.equal(canStand(course, 2, 9.02, .1), false);
  assert.ok(castRay(course, 2, 9.2, -Math.PI / 2, 1).dist < .2);
  completeRoom(progression, 0);
  syncRoomGateCells(course, progression);
  assert.equal(progression.barriers['bloodworks-barrier-0'].open, true);
  assert.equal(canTraverseRoomGates(course, progression, 6, 9.2, 6, 8.8), false);
  assert.equal(canTraverseRoomGates(course, progression, 2, 9.2, 2, 8.8), true);
  assert.equal(canStand(course, 2, 9.02, .1), true);
  assert.ok(castRay(course, 2, 9.2, -Math.PI / 2, 1).dist > .8);
  assert.equal(canStand(course, .5, 9.02, .1), false);
  assert.equal(canStand(course, 3.5, 9.02, .1), false);
  assert.ok(castRay(course, 6, 9.2, -Math.PI / 2, 1).dist < .2);
  assert.equal(roomAt(getRoomSequence('bloodworks'), 6, 10.5).id, first.id);
});
test('wave clear advances exactly one room and exposes the final objective vestibule', () => {
  const course = makeCampaignCourse(0);
  const run = newRun(course);
  run.mode = 'play';
  run.director = { state: 'intermission' };
  run.wave = 1;
  updateRoomProgression(run, 1 / 120);
  assert.equal(run.roomProgression.currentIndex, 1);
  assert.deepEqual(run.roomProgression.completed, ['bloodworks-act-i-entry']);
  assert.equal(run.events.at(-1).type, 'room-transition');
  run.director.state = 'intermission';
  run.wave = 2;
  updateRoomProgression(run, 1 / 120);
  assert.equal(run.roomProgression.currentIndex, 2);
  run.director.state = 'exit';
  run.wave = run.waveCount;
  updateRoomProgression(run, 1 / 120);
  assert.equal(run.roomProgression.currentIndex, 3);
  assert.equal(run.roomProgression.phase, 'exit');
  assert.equal(run.roomProgression.objective, 'Reach the sector exit');
  const snapshot = roomProgressionSnapshot(run.roomProgression);
  assert.equal(snapshot.version, ROOM_PROGRESSION_VERSION);
  assert.notEqual(snapshot.gates, run.roomProgression.gates);
  assert.ok(snapshot.gates['bloodworks-act-i-objective-portal-0'].open);
});

test('strict campaign waits for physical room entry before the next encounter', () => {
  const course = makeCampaignCourse(0);
  const run = newRun(course, { requireEntry: true });
  run.mode = 'play';
  run.director = { state: 'intermission', active: 0 };
  run.wave = 1;
  run.waveDelay = 0;
  updateRoomProgression(run, 1 / 120);
  assert.equal(run.roomProgression.currentIndex, 0);
  assert.equal(run.roomProgression.pendingIndex, 1);
  assert.equal(run.wave, 1);
  tick(run, 1 / 120, {});
  assert.equal(run.wave, 1);
  run.x = 2;
  run.y = 9.04;
  tick(run, 1 / 120, {});
  assert.equal(run.roomProgression.currentIndex, 0, "Approaching the threshold does not enter the next room");
  run.y = 8.4;
  tick(run, 1 / 120, {});
  assert.equal(run.roomProgression.currentIndex, 1);
  assert.equal(run.roomProgression.pendingIndex, null);
  assert.equal(run.roomProgression.activeRoomId, 'bloodworks-act-i-gallery');
  assert.equal(run.wave, 1);
  tick(run, 1 / 120, {});
  assert.equal(run.wave, 2);
  assert.ok(run.events.some(event => event.type === 'wave' && event.wave === 2));
});

test('every room keeps both doorway approaches reachable through its carved cover layout', () => {
  for(let sector=0;sector<3;sector++){
    const course=makeCampaignCourse(sector),run=newRun(course,{requireEntry:true});
    for(const room of getRoomSequence(run.sectorId)){
      const start=room.spawnPoints[0],queue=[[Math.round(start.x*4),Math.round(start.y*4)]],seen=new Set(queue.map(p=>p.join(',')));
      for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const [x,y]=queue[i],nx=x+dx,ny=y+dy,key=nx+','+ny;
        if(seen.has(key)||ny/4<room.bounds.minZ||ny/4>room.bounds.maxZ||!canStand(course,nx/4,ny/4,.1)||!canStand(course,(x+nx)/8,(y+ny)/8,.1))continue;
        seen.add(key);queue.push([nx,ny]);
      }
      for(const portal of room.portals.filter(p=>p.kind==='door'||p.kind==='lift')){
        const x=(portal.span[0]+portal.span[1])/2,y=portal.at+.25;
        assert.ok(seen.has(Math.round(x*4)+','+Math.round(y*4)),room.id+' cannot reach '+portal.id);
      }
    }
  }
});
