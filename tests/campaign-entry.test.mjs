import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloCampaignCourse,createSurfaceCampaignCourse} from '../campaign-entry.js';
import {newRun} from '../engine.js';
import {createLowTideSave} from '../low-tide-save.js';

test('ordinary, debug, and former district links start in the connected underground',()=>{
  for(const query of ['', 'debug', 'dev', 'district=harbor', 'district=story']) {
    const course=createSoloCampaignCourse(new URLSearchParams(query));
    assert.equal(course.dungeon,true,query);
    assert.equal(course.dungeonIndex,0,query);
    assert.equal(course.undergroundCampaign,true,query);
    assert.equal(course.basementPortal.destination,'island',query);
    assert.equal(course.surfaceOptions.openWorld,true,query);
    assert.ok(newRun(course).journey,query);
  }
});

test('fresh campaign worlds retain checkpoint progress without retaining world mutations',()=>{
  const save=createLowTideSave({getItem:()=>null,setItem(){}});
  const first=newRun(createSurfaceCampaignCourse());
  first.mode='play';first.lowTide.shelter=true;
  assert.equal(save.save(first),true);
  first.course.activeInterior=first.course.harborRooms[0];
  const retry=newRun(createSurfaceCampaignCourse());
  assert.notEqual(retry.course,first.course);
  assert.equal(save.load(retry),true);
  assert.equal(retry.lowTide.shelter,true);
  assert.equal(retry.course.activeInterior,retry.course.harborRooms[3]);
  assert.notEqual(retry.course.activeInterior,first.course.activeInterior);
});

test('explicit development floor and arena routes remain usable',()=>{
  assert.ok(createSoloCampaignCourse(new URLSearchParams('world=island')).coastal);
  assert.equal(createSoloCampaignCourse(new URLSearchParams('world=harbor')).harbor,true);
  const floor=createSoloCampaignCourse(new URLSearchParams('dungeon=1'));
  assert.equal(floor.dungeon,true);
  assert.equal(floor.dungeonIndex,1);
  assert.ok(!floor.harbor);
  const arena=createSoloCampaignCourse(new URLSearchParams('debug&sector=1'));
  assert.ok(!arena.harbor);
  assert.equal(arena.sectorIndex,1);
});
