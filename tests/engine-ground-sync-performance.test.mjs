import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeHarborCourse} from '../harbor-course.js';

// Run both exact implementations against the same authority, without creating
// a second runtime file or adding counters to production's enemy hot path.
const url=new URL('../engine.js',import.meta.url),source=await readFile(url,'utf8');
assert.ok(source.includes('tickPlayer(r,dt,input,true)'));
assert.ok(source.includes('if(!enemyGroundsSynced)syncEnemyGrounds(r);'));
const baselineSource=source.replace('tickPlayer(r,dt,input,true)','tickPlayer(r,dt,input)')
  .replace('if(!enemyGroundsSynced)syncEnemyGrounds(r);','syncEnemyGrounds(r);');
async function instrument(text){
  text=text.replace('function syncEnemyGround(r,e,dt=0){','function syncEnemyGround(r,e,dt=0){groundSyncWork.enemyQueries++;')
    .replace('function syncEnemyGrounds(r){','function syncEnemyGrounds(r){groundSyncWork.fullPasses++;');
  text=text.replace(/(from\s+|import\s*)(['"])(\.\/[^'"]+)\2/g,(_,prefix,quote,path)=>`${prefix}${quote}${new URL(path,url).href}${quote}`);
  text+='\nexport const groundSyncWork={enemyQueries:0,fullPasses:0};\n';
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}
const baseline=await instrument(baselineSource),optimized=await instrument(source);
const enemy=(id,x,y,extra={})=>({id,x,y,z:0,hp:100,maxHp:100,kind:0,variant:'stalker',dead:false,flash:0,attack:999,phase:0,moveSpeed:.2,...extra});
const snapshot=run=>JSON.stringify(run,(key,value)=>key==='world'||key==='course'?undefined:value);
function setup(engine,scenario){
  const coastal=scenario==='stairs'||scenario==='coastal-corpses';
  const course=coastal?makeHarborCourse({openWorld:true}):engine.makeCourse();
  const run=engine.newRun(course);run.mode='play';run.waveDelay=999;run.lowTide=null;run.vehicle=null;
  course.harbor=false;
  if(scenario==='stairs'){
    const structure=course.coastal.structures.find(p=>p.id==='coast-lot-4-0-0-0');
    const p=structure.stairPath[3],target=structure.stairPath.at(-1);
    Object.assign(run,{x:target.x,y:target.y,supportZ:target.z,structureId:structure.id});
    course.enemies=[enemy(901,p.x,p.y,{groundZ:p.z,supportZ:p.z,structureId:structure.id})];
  }else if(scenario==='coastal-corpses'){
    run.x=80;run.y=95;course.enemies=Array.from({length:40},(_,i)=>enemy(901+i,80+(i%4)*.12,95+Math.floor(i/4)*.08,{dead:true,hp:0}));
  }else{
    run.x=6;run.y=6;course.enemies=Array.from({length:12},(_,i)=>enemy(901+i,6+(i%3)*.22,7+Math.floor(i/3)*.18));
    if(scenario==='dead-host-peer'){
      run.health=0;run.peer=engine.newRun(course);Object.assign(run.peer,{mode:'play',x:6,y:6,world:run});
    }
  }
  return run;
}
for(const scenario of ['combat','stairs','coastal-corpses','dead-host-peer']){
  test(`${scenario}: authoritative tick matches baseline while eliminating only duplicate support queries`,()=>{
    const before=setup(baseline,scenario),after=setup(optimized,scenario);
    baseline.groundSyncWork.enemyQueries=baseline.groundSyncWork.fullPasses=0;
    optimized.groundSyncWork.enemyQueries=optimized.groundSyncWork.fullPasses=0;
    const ticks=120;
    for(let i=0;i<ticks;i++){
      const input={forward:i<30?.12:0,strafe:i%8<4?.05:0,jump:i===45};
      baseline.tick(before,1/120,input);optimized.tick(after,1/120,input);
      assert.equal(snapshot(after),snapshot(before),`complete dynamic state at tick ${i}`);
      assert.deepEqual(after.course.enemies,before.course.enemies,`enemy authority at tick ${i}`);
    }
    const savedPasses=baseline.groundSyncWork.fullPasses-optimized.groundSyncWork.fullPasses;
    const savedQueries=baseline.groundSyncWork.enemyQueries-optimized.groundSyncWork.enemyQueries;
    if(scenario==='dead-host-peer')assert.equal(savedPasses,0,'dead-host early return still has its initial world support pass');
    else{
      assert.equal(savedPasses,ticks);
      assert.equal(savedQueries,ticks*before.course.enemies.length);
    }
    console.log(JSON.stringify({scenario,ticks,baseline:{...baseline.groundSyncWork},optimized:{...optimized.groundSyncWork},savedQueries}));
  });
}
test('standalone player prediction retains enemy support synchronization',()=>{
  const a=setup(baseline,'stairs'),b=setup(optimized,'stairs');
  optimized.groundSyncWork.enemyQueries=optimized.groundSyncWork.fullPasses=0;
  for(let i=0;i<30;i++){baseline.tickPlayer(a,1/120,{forward:.1});optimized.tickPlayer(b,1/120,{forward:.1});}
  assert.equal(snapshot(a),snapshot(b));assert.deepEqual(a.course.enemies,b.course.enemies);
  assert.equal(optimized.groundSyncWork.fullPasses,30);
  assert.equal(optimized.groundSyncWork.enemyQueries,30);
});
