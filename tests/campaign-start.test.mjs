import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual start lifecycle with renderer preparation held pending.
const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const code=main.slice(main.indexOf('function begin('),main.indexOf('function pause('));
function fixture(screen='menu') {
  const initial={harbor:true,id:'menu'},fresh={harbor:true,id:'retry'},arena={id:'arena'};
  const prepared=[],loaded=[],sent=[];let starts=0;
  const renderer={renderer:{},_weaponsPrepared:false,render(run){
    prepared.push(run.course);this._warmupCourse=run.course;
    this._warmupPromise=new Promise(resolve=>{this.finish=()=>{this._preparedCourse=run.course;this._weaponsPrepared=true;resolve();};});
  }};
  const context=vm.createContext({screen,run:{course:initial},renderer,session:null,
    packUI:{close(){}},audio:{resetCounterCues(){},setAmbiencePreset(){},setScene(){},unlock:()=>Promise.resolve(),resume(){},play(){}},
    inspector:{active:false},document:{body:{classList:{add(){},remove(){}}}},
    ui:{loading(){},play(){},hide(){},toast(){}},lowTideSave:{load:run=>loaded.push(run.course)},settings:{},
    startingCourse:()=>{starts++;return fresh;},makeCampaignCourse:()=>arena,
    newRun:course=>({course,lowTide:!!course.harbor,sectorName:'Arena',sectorIndex:0}),addPeer:run=>{run.peer={};},
    requestAnimationFrame:callback=>callback(),setTimeout:callback=>callback(),performance:{now:()=>0},
    resetInput(){},pointerLock(){},snapshot:()=>({}),prepareDescentFloor(){},
  });
  vm.runInContext(code,context);
  return {context,renderer,initial,fresh,arena,prepared,loaded,sent,starts:()=>starts};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('campaign click uses the already selected world and ignores duplicate clicks during preparation',async()=>{
  const f=fixture();f.context.begin();f.context.begin();
  assert.deepEqual(f.prepared,[f.initial]);assert.equal(f.context.screen,'menu');
  f.renderer.finish();await flush();
  assert.equal(f.context.screen,'play');assert.equal(f.context.run.course,f.initial);
  assert.deepEqual(f.loaded,[f.initial]);assert.equal(f.starts(),0);
});

test('retry prepares its fresh world once and starts that exact prepared world',async()=>{
  const f=fixture('pause');f.renderer._weaponsPrepared=true;f.renderer._preparedCourse=f.initial;
  f.context.begin();assert.deepEqual(f.prepared,[f.fresh]);
  f.renderer.finish();await flush();
  assert.equal(f.context.screen,'play');assert.equal(f.context.run.course,f.fresh);
  assert.equal(f.starts(),1);assert.deepEqual(f.loaded,[f.fresh]);
});

test('co-op prepares its arena instead of reusing the solo coastal world',async()=>{
  const f=fixture();f.context.session={connected:true,send:value=>f.sent.push(value)};
  f.context.begin(true);assert.deepEqual(f.prepared,[f.arena]);
  f.renderer.finish();await flush();
  assert.equal(f.context.run.course,f.arena);assert.ok(f.context.run.peer);
  assert.equal(f.sent.length,1);assert.deepEqual(f.loaded,[]);
});
