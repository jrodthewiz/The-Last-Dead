import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomProgression } from '../ui.js';

const course = {
  dungeon: true,
  dungeonIndex: 1,
  dungeonCount: 5,
  name: 'The Ossuary',
  waveCount: 4,
  keys: [],
  rooms: [
    { id: 'landing', name: 'Bone Landing', bounds: { minX: 0, minZ: 0, maxX: 6, maxZ: 4 }, encounter: { tactic: 'Read the rib gate.' } },
    { id: 'court', name: 'Reliquary Court', bounds: { minX: 0, minZ: 4, maxX: 6, maxZ: 8 }, encounter: { tactic: 'Use the altar as hard cover.' } },
  ],
};

test('dungeon HUD uses encounter fields and keeps staggered pending counts', () => {
  const view = roomProgression({
    course,
    wave: 1,
    waveCount: 4,
    courseEnemies: [],
    dungeonProgression: {
      phase: 'telegraph',
      activeRoomId: 'landing',
      encounterRoomId: 'landing',
      nextRoomId: 'court',
      roomIndex: 0,
      roomCount: 2,
      roomSequence: ['landing', 'court'],
      roomsCompleted: [],
      objective: 'Clear Bone Landing',
      progress: 0,
      encounter: {
        state: 'telegraph', wave: 1, waveCount: 4,
        active: 2, pending: 3, remaining: 5, total: 5,
      },
    },
  });

  assert.equal(view.roomName, 'Bone Landing');
  assert.equal(view.roomIndex, 0);
  assert.equal(view.roomCount, 2);
  assert.equal(view.active, 2);
  assert.equal(view.pending, 3);
  assert.equal(view.remaining, 5);
  assert.equal(view.encounterProgress, 0);
  assert.equal(view.objective, 'Clear Bone Landing');
  assert.equal(view.threat, '3 INCOMING');
  assert.ok(!view.objective.includes('WAVE'));
});

test('dungeon HUD names the next room while the cleared room is explorable', () => {
  const view = roomProgression({
    course,
    dungeonProgression: {
      phase: 'exploration',
      activeRoomId: null,
      encounterRoomId: null,
      nextRoomId: 'court',
      roomIndex: 1,
      roomCount: 2,
      roomSequence: ['landing', 'court'],
      roomsCompleted: ['landing'],
      objective: 'Reach Reliquary Court',
      progress: 0.5,
      encounter: { state: 'exploration', wave: 1, waveCount: 4, active: 0, pending: 0, remaining: 0, total: 5 },
    },
  });

  assert.equal(view.roomName, 'Reliquary Court');
  assert.equal(view.objective, 'Reach Reliquary Court');
  assert.equal(view.threat, 'ROOM CLEAR');
  assert.equal(view.progress, 0.5);
  assert.equal(view.encounterProgress, 1);
  assert.ok(!view.objective.includes('IN'));
});
