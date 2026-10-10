import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMind,stepMind,enemyNavigationFrame,isHunting} from '../enemy-ai.js';
import {newRun,tick} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';
const report={scope:'CPU120Hz navigation service and behavior tests; operation counts, not native FPS'};
function actors(){return Array.from({length:56},(_,id)=>{const e={id,kind:0,variant:'stalker',x:2,y:2,moveSpeed:1,attack:99,strike:0,dead:false,seesTarget:false};createMind(e,{state:'stalk',firstAttack:99,facing:0});e.mind.lastKnown={x:6,y:2};return e;});}
function simulate(limited=true){
 const enemies=actors(),course={coastal:limited?{}:undefined,enemies,w:12,h:12,cells:Array.from({length:144},()=>[1,1,1,1])},run={course,time:0};
 const first=new Map(),windows=new Map();let footQueries=0,steps=0,searches=0;
 for(let frame=0;frame<168;frame++){
  run.time=(frame+1)/120;const nav=enemyNavigationFrame(run,56);
  const ctx={time:run.time,dt:1/120,course,alive:enemies,env:{canStand:()=>{footQueries++;return false;},castRay:()=>({dist:100})},noises:[],navBudget:nav.budget,noteNavSearch:nav.noteSearch,navSearches:0,profile:{role:'rush',speed:1},reach:.34,tokens:{melee:0,maxMelee:0,ranged:0,maxRanged:0}};
  for(let i=0;i<56;i++){const e=enemies[(nav.start+i)%56],before=ctx.navSearches;stepMind(ctx,e,{x:6,y:2});steps++;if(ctx.navSearches>before&&!first.has(e.id))first.set(e.id,run.time);}
  searches+=ctx.navSearches;const w=Math.floor((run.time+1e-9)*10);windows.set(w,(windows.get(w)||0)+ctx.navSearches);
 }
 return{run,first,windows,footQueries,steps,searches};
}
test('saturated unreachable56 residents receive fair bounded service while every mind steps at120Hz',()=>{
 const a=simulate(),b=simulate(false);assert.equal(a.first.size,56);assert(Math.max(...a.first.values())<=1.4);assert([...a.windows.values()].every(n=>n<=4));assert.equal(a.steps,56*168);assert.equal(a.steps,b.steps);assert(a.searches<b.searches);assert(a.run.course.enemies.every(e=>e.nav.failed&&e.nav.repath<=1));
 report.saturation={ticks:168,seconds:1.4,allMindSteps:a.steps,candidateSearches:a.searches,legacySearches:b.searches,candidateFootQueries:a.footQueries,legacyFootQueries:b.footQueries,lastFirstServiceSeconds:Math.max(...a.first.values()),maxSearchesPerFixed100ms:Math.max(...a.windows.values()),candidateCursor:a.run.enemyAICursor};
});
test('serialized mind budget counts survive snapshots and dead records cannot refund current service',()=>{
 const run={time:.023,course:{coastal:{},enemies:actors()}};const frame=enemyNavigationFrame(run,56);for(const e of run.course.enemies.slice(0,4))frame.noteSearch(e);
 assert.equal(enemyNavigationFrame(run,56).budget,0);run.course.enemies[0].dead=true;assert.equal(enemyNavigationFrame(run,56).budget,0);
 const snapshot=JSON.parse(JSON.stringify(run));assert(!snapshot.course.enemies[0].nav);assert.equal(enemyNavigationFrame(snapshot,56).budget,0);assert.equal(snapshot.enemyAICursor,4);
 snapshot.time=.1;assert.equal(enemyNavigationFrame(snapshot,56).budget,4);const legacy={time:0,course:{enemies:actors()},enemyAICursor:0};assert.equal(enemyNavigationFrame(legacy,56).start,0);assert.equal(legacy.enemyAICursor,4);
});
test('zero search availability leaves direct pursuit, runner recognition and pointblank sensing responsive',()=>{
 const course={w:24,h:24,cells:Array.from({length:576},()=>[0,0,0,0])},times=[];
 for(const variant of ['bloodhound','stalker']){
  const e=actors()[0];e.variant=variant;e.seesTarget=true;createMind(e,{state:'wander',facing:0,firstAttack:99});e.mind.pause=999;
  const ctx={time:0,dt:1/120,course,alive:[e],env:{canStand:()=>true,castRay:()=>({dist:100})},noises:[],navBudget:0,navSearches:0,profile:{role:'rush',speed:1},reach:.34,tokens:{melee:0,maxMelee:0,ranged:0,maxRanged:0}};
  for(let n=0;n<600&&!isHunting(e);n++){ctx.time+=ctx.dt;stepMind(ctx,e,{x:8,y:2});}assert(isHunting(e));times.push(ctx.time);
  const x=e.x;for(let n=0;n<60;n++){ctx.time+=ctx.dt;stepMind(ctx,e,{x:8,y:2});}assert(e.x>x);assert.equal(ctx.navSearches,0);
  createMind(e,{state:'wander',facing:0,firstAttack:99});ctx.alive=[e];ctx.time+=ctx.dt;stepMind(ctx,e,{x:e.x+.4,y:e.y});assert.equal(e.mind.senses.visible,true);
 }
 assert(times[0]<times[1]);report.recognition={runnerSeconds:times[0],shamblerSeconds:times[1],directLineSearches:0,pointblankVisible:true};
});
test('actual coastal engine simulation keeps all56 residents and exposes temporal availability',()=>{
 const run=newRun(makeHarborCourse({openWorld:true,cityLootSeed:7317}));run.mode='play';const windows=new Map();
 for(let i=0;i<24;i++){tick(run,1/120);assert.equal(run.course.enemies.length,56);const d=run.enemyAIDiagnostics;assert(d.navAvailable>=0&&d.navAvailable<=4);windows.set(d.navWindow,(windows.get(d.navWindow)||0)+d.navSearches);}
 assert([...windows.values()].every(n=>n<=4));assert(Math.abs(run.time-.2)<1e-9);report.actualEngine={ticks:24,seconds:run.time,residents:56,windowSearches:Object.fromEntries(windows)};
});
test('save bounded CPU findings',()=>fs.writeFileSync('output/island-coastal-navigation-performance-findings.json',JSON.stringify(report,null,2)+'\n'));
