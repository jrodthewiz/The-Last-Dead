import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoloCampaignCourse,createSurfaceCampaignCourse} from '../campaign-entry.js';
import {newRun,canStand,tickPlayer} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';
import {IslandBasementConnection,basementPrompt,attachIslandBasement} from '../island-basement.js';

const surface=()=>{const run=newRun(createSurfaceCampaignCourse());Object.assign(run,run.course.basementPortal,{mode:'play'});return run;};
test('default world and direct coastal fixture share an accessible mapped service stair',()=>{
  for(const c of [createSurfaceCampaignCourse(),makeHarborCourse({openWorld:true})]){
    assert.ok(c.harbor&&c.coastal);assert.equal(c.basementPortal.destination,'basement');
    assert.ok(canStand(c,c.basementPortal.x,c.basementPortal.y,.22));
    assert.ok(c.coastal.landmarks.some(p=>p.id===c.basementPortal.id));
    const n=c.obstacles.length;attachIslandBasement(c);assert.equal(c.obstacles.length,n);
  }
});

test('fresh campaign starts underground and returns to the exact same floor through customs',()=>{
 const floor=newRun(createSoloCampaignCourse()),connection=new IslandBasementConnection();floor.mode='play';connection.start(floor);
 floor.course.enemies.push({id:'retained',dead:true});floor.dungeonProgression.keysCollected.push('retained-key');
 const island=connection.transition(floor);assert.ok(island.course.coastal&&island.lowTide);island.lowTide.shelter=true;
 island.backpack.scrap=31;island.health=62;
 const returned=connection.transition(island);assert.equal(returned,floor);assert.equal(returned.backpack.scrap,31);assert.equal(returned.health,62);
 assert.equal(returned.course.enemies[0].dead,true);assert.ok(returned.dungeonProgression.keysCollected.includes('retained-key'));
 assert.equal(connection.surfaceForSave(returned).lowTide.shelter,true);
});

test('each underground lift supports backtracking without rebuilding cleared floors',()=>{
 const connection=new IslandBasementConnection(),floors=[newRun(createSoloCampaignCourse())];floors[0].mode='play';connection.start(floors[0]);
 for(let i=0;i<4;i++){
  const floor=floors[i];Object.assign(floor,floor.course.exit);floor.dungeonProgression.exitReady=true;
  floor.dungeonProgression.keysCollected.push(`floor-${i}-key`);
  assert.match(basementPrompt(floor).text,/DESCEND TO BASEMENT/);
  const next=connection.transition(floor);assert.ok(next);assert.equal(next.course.dungeonIndex,i+1);floors.push(next);
  assert.equal(next.course.basementPortal.destination,'upper-floor');
 }
 for(let i=4;i>0;i--){
  const floor=floors[i];Object.assign(floor,floor.course.playerSpawn);assert.match(basementPrompt(floor).text,/RETURN TO BASEMENT/);
  const previous=connection.transition(floor);assert.equal(previous,floors[i-1]);assert.ok(previous.dungeonProgression.keysCollected.includes(`floor-${i-1}-key`));
  assert.equal(previous.angle,Math.PI/2,'upper-floor arrival faces back into the cleared floor');
 }
 Object.assign(floors[0],floors[0].course.playerSpawn);const island=connection.transition(floors[0]);assert.ok(island.course.coastal);
 assert.equal(connection.transition(island),floors[0]);
 Object.assign(floors[0],floors[0].course.exit);assert.equal(connection.transition(floors[0]),floors[1]);
});

test('deeper lifts remain locked until floor objectives are ready',()=>{
 const floor=newRun(createSoloCampaignCourse()),connection=new IslandBasementConnection();floor.mode='play';connection.start(floor);Object.assign(floor,floor.course.exit);
 assert.equal(basementPrompt(floor),null);assert.equal(connection.transition(floor),null);
});
test('restored safehouse equipment can leave the underground through the customs stairs',()=>{
 const floor=newRun(createSoloCampaignCourse()),connection=new IslandBasementConnection();floor.mode='play';
 connection.start(floor,{restore:island=>{island.lowTide.shelter=true;island.course.activeInterior=island.course.harborRooms[3];island.ownedWeapons=[0,4];island.backpack.scrap=8;return true;}});
 assert.deepEqual(floor.ownedWeapons,[0,4]);assert.equal(floor.backpack.scrap,8);
 const island=connection.transition(floor);assert.ok(island);assert.equal(island.course.activeInterior,null);assert.equal(island.lowTide.shelter,true);
 assert.ok(canStand(island.course,island.x,island.y,.16));
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

test('climbing faces the island route and permits immediate forward travel without steering',()=>{
 const connection=new IslandBasementConnection(),island=surface(),basement=connection.transition(island),returned=connection.transition(basement);
 assert.equal(returned.angle,Math.PI/2);assert.ok(basementPrompt(returned),'return remains within usable stair range');
 const start={x:returned.x,y:returned.y};
 for(let i=0;i<240;i++)tickPlayer(returned,1/120,{forward:1});
 assert.ok(returned.y-start.y>3,'first two seconds must follow the clear island street, not walk into the door');
 assert.ok(Math.abs(returned.x-start.x)<.02);assert.ok(canStand(returned.course,returned.x,returned.y,.1),'actual movement radius stays clear');
});
