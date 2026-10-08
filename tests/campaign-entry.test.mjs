import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloCampaignCourse} from '../campaign-entry.js';
import {newRun} from '../engine.js';
import {createLowTideSave} from '../low-tide-save.js';

test('ordinary, debug, and former district links enter the same full open-world campaign',()=>{
  for(const query of ['', 'debug', 'dev', 'district=harbor', 'district=story']) {
    const course=createSoloCampaignCourse(new URLSearchParams(query));
    assert.equal(course.harbor,true,query);
    assert.ok(course.coastal,query);
    assert.ok(course.lowTide,query);
    assert.equal(course.harborRooms.length,6,query);
    assert.ok(course.coastal.buildings.length>=70,query);
    assert.ok(newRun(course).lowTide,query);
  }
});

test('fresh campaign worlds retain checkpoint progress without retaining world mutations',()=>{
  const save=createLowTideSave({getItem:()=>null,setItem(){}});
  const first=newRun(createSoloCampaignCourse());
  first.mode='play';first.lowTide.shelter=true;
  assert.equal(save.save(first),true);
  first.course.activeInterior=first.course.harborRooms[0];
  const retry=newRun(createSoloCampaignCourse());
  assert.notEqual(retry.course,first.course);
  assert.equal(save.load(retry),true);
  assert.equal(retry.lowTide.shelter,true);
  assert.equal(retry.course.activeInterior,retry.course.harborRooms[3]);
  assert.notEqual(retry.course.activeInterior,first.course.activeInterior);
});

test('explicit development floor and arena routes remain usable',()=>{
  const floor=createSoloCampaignCourse(new URLSearchParams('dungeon=1'));
  assert.equal(floor.dungeon,true);
  assert.equal(floor.dungeonIndex,1);
  assert.ok(!floor.harbor);
  const arena=createSoloCampaignCourse(new URLSearchParams('debug&sector=1'));
  assert.ok(!arena.harbor);
  assert.equal(arena.sectorIndex,1);
});
