import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloCampaignCourse} from '../campaign-entry.js';
import {newRun,canStand} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';
import {IslandBasementConnection,basementPrompt,attachIslandBasement} from '../island-basement.js';

const surface=()=>{const run=newRun(createSoloCampaignCourse());Object.assign(run,run.course.basementPortal,{mode:'play'});return run;};
test('default world and direct coastal fixture share an accessible mapped service stair',()=>{
  for(const c of [createSoloCampaignCourse(),makeHarborCourse({openWorld:true})]){
    assert.ok(c.harbor&&c.coastal);assert.equal(c.basementPortal.destination,'basement');
    assert.ok(canStand(c,c.basementPortal.x,c.basementPortal.y,.22));
    assert.ok(c.coastal.landmarks.some(p=>p.id===c.basementPortal.id));
    const n=c.obstacles.length;attachIslandBasement(c);assert.equal(c.obstacles.length,n);
  }
});
test('island and real authored dungeon connect both ways while retaining simulation and equipment',()=>{
  const island=surface(),connection=new IslandBasementConnection();island.health=63;island.lowTide.shelter=true;
  const basement=connection.transition(island);assert.ok(basement.course.dungeonCompiled);assert.ok(basement.course.extended);assert.ok(basement.journey);
  assert.equal(basement.course.dungeonIndex,0);assert.equal(basement.health,63);assert.ok(basementPrompt(basement));
  basement.course.enemies.push({id:'cleared-basement-resident',dead:true});basement.backpack.scrap=19;basement.health=47;
  const returned=connection.transition(basement);assert.equal(returned,island);assert.equal(returned.health,47);assert.equal(returned.lowTide.shelter,true);
  const again=connection.transition(returned);assert.equal(again,basement);assert.equal(again.course.enemies[0].dead,true);assert.equal(again.backpack.scrap,19);
});
test('stairs reject unsafe, distant, vehicle and co-op use; held interaction cannot bounce',()=>{
  const run=surface(),connection=new IslandBasementConnection();
  assert.equal(connection.transition(run,{connected:true}),null);
  run.bite.phase='held';assert.equal(connection.transition(run),null);run.bite.phase='idle';
  run.vehicle.occupied=true;assert.equal(basementPrompt(run),null);run.vehicle.occupied=false;
  const next=connection.update(run,true);assert.ok(next);assert.equal(connection.update(next,true),null);
  assert.equal(connection.update(next,false),null);assert.equal(connection.update(next,true),run);
  run.x+=4;assert.equal(basementPrompt(run),null);
});
