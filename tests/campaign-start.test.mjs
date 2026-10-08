import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual start lifecycle with renderer preparation held pending.
const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const code=main.slice(main.indexOf('function begin('),main.indexOf('function cancelSignal('));
const resetCode=main.slice(main.indexOf('function releaseFormFocus('),main.indexOf('function pointerLock('));
const floorCode=main.slice(main.indexOf('let floorPreparation = null;'),main.indexOf('function processEvents('));
const focusCode=main.slice(main.indexOf("addEventListener('blur',()=>{windowFocused=false"),main.indexOf("addEventListener('resize',"));
function fixture(screen='menu') {
  const initial={harbor:true,id:'menu'},fresh={harbor:true,id:'retry'},arena={id:'arena'};
  const prepared=[],loaded=[],sent=[],events=new Map();let starts=0,locks=0,pauses=0;
  const keys=new Set(['KeyW']),touches=new Map([[1,{}]]),pulses=new Set(['jump']);
  const renderer={renderer:{},_weaponsPrepared:false,render(run){
    prepared.push(run.course);this._warmupCourse=run.course;
    this._warmupPromise=new Promise(resolve=>{this.finish=()=>{this._preparedCourse=run.course;this._weaponsPrepared=true;resolve();};});
  }};
  const context=vm.createContext({screen,run:{course:initial,mode:screen==='pause'?'pause':'ready'},renderer,session:null,windowFocused:true,network:'SOLO',fps:60,
    packUI:{close(){}},audio:{resetCounterCues(){},setAmbiencePreset(){},setScene(){},unlock:()=>Promise.resolve(),resume(){},play(){},pause(){}},
    inspector:{active:false},document:{hidden:false,activeElement:null,exitPointerLock(){},addEventListener:(name,fn)=>events.set(name,fn),body:{classList:{add(){},remove(){}}}},
    ui:{loading(){},play(){},hide(){},toast(){},hud(){},pause(){pauses++;}},lowTideSave:{load:run=>loaded.push(run.course)},settings:{},
    startingCourse:()=>{starts++;return fresh;},makeCampaignCourse:()=>arena,
    newRun:course=>({course,lowTide:!!course.harbor,sectorName:'Arena',sectorIndex:0}),addPeer:run=>{run.peer={};},
    requestAnimationFrame:callback=>callback(),setTimeout:callback=>callback(),performance:{now:()=>0},
    keys,touches,pulses,fire:true,alt:true,attachment:true,
    gamepadInput:{suppress(){}},emptyGamepadFrame:()=>({}),cancelMelee(){},
    addEventListener:(name,fn)=>events.set(name,fn),pointerLock(){locks++;},snapshot:()=>({}),
  });
  vm.runInContext(resetCode+'\n'+code+'\n'+floorCode+'\n'+focusCode,context);
  return {context,renderer,initial,fresh,arena,prepared,loaded,sent,events,keys,touches,pulses,locks:()=>locks,pauses:()=>pauses,starts:()=>starts};
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

for(const loss of ['blur','hidden']) {
  test('campaign completion after '+loss+' shows existing pause; normal resume restores controls',async()=>{
    const f=fixture();f.context.begin();
    if(loss==='blur')f.events.get('blur')();else{f.context.document.hidden=true;f.events.get('visibilitychange')();}
    assert.equal(f.context.screen,'menu');f.keys.add('KeyW');f.context.fire=true;
    f.renderer.finish();await flush();
    assert.equal(f.context.screen,'pause');assert.equal(f.context.run.mode,'pause');assert.equal(f.locks(),0);
    assert.equal(f.pauses(),1);assert.equal(f.keys.size,0);assert.equal(f.context.fire,false);
    f.context.document.hidden=false;f.events.get('focus')();f.context.resume();await flush();
    assert.equal(f.context.screen,'play');assert.equal(f.context.run.mode,'play');assert.equal(f.locks(),1);
  });
  test('floor completion after '+loss+' stays paused',async()=>{
    const f=fixture('play');Object.assign(f.initial,{dungeon:true,dungeonIndex:1,name:'Floor'});f.context.run.mode='play';
    f.context.prepareDescentFloor();assert.equal(f.context.screen,'loading');assert.equal(f.context.run.mode,'pause');
    if(loss==='blur')f.events.get('blur')();else{f.context.document.hidden=true;f.events.get('visibilitychange')();}
    f.renderer.finish();await flush();assert.equal(f.context.screen,'pause');assert.equal(f.context.run.mode,'pause');assert.equal(f.pauses(),1);
    f.context.document.hidden=false;f.events.get('focus')();f.context.resume();assert.equal(f.context.screen,'play');assert.equal(f.context.run.mode,'play');
  });
  test('existing live '+loss+' still pauses and clears held input',()=>{
    const f=fixture('play');f.context.run.mode='play';
    if(loss==='blur')f.events.get('blur')();else{f.context.document.hidden=true;f.events.get('visibilitychange')();}
    assert.equal(f.context.screen,'pause');assert.equal(f.context.run.mode,'pause');assert.equal(f.keys.size,0);assert.equal(f.touches.size,0);assert.equal(f.pulses.size,0);assert.equal(f.context.fire,false);
  });
}
test('focused floor completion retains normal play',async()=>{
  const f=fixture('play');Object.assign(f.initial,{dungeon:true,dungeonIndex:1,name:'Floor'});f.context.run.mode='play';
  f.context.prepareDescentFloor();f.renderer.finish();await flush();assert.equal(f.context.screen,'play');assert.equal(f.context.run.mode,'play');assert.equal(f.pauses(),0);
});
test('unfocused co-op completion preserves existing live-while-paused policy',async()=>{
  const f=fixture();f.context.session={connected:true,send:value=>f.sent.push(value)};f.context.begin(true);f.events.get('blur')();
  f.renderer.finish();await flush();assert.equal(f.context.screen,'pause');assert.equal(f.context.run.mode,'play');assert.equal(f.sent.length,1);assert.equal(f.locks(),0);
});
