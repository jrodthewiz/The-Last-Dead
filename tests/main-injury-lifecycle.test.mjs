import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {listenerPose,isPredictedFirearmEcho} from '../spatial-audio.js';
import {makeCourse,newRun,addPeer,chestFinisher,tick,tickPlayer,shoot,parry,grapple,switchWeapon,clamp,weapons,attackVermin,validateVerminSnapshot,validateVerminHand,validateVerminCrawl} from '../engine.js';

// Exercise the real browser entrypoint functions without starting WebGL or
// public signaling. Browser QA separately checks the rendered death journey.
const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const snapshotSource=main.slice(main.indexOf('function applySnapshot('),main.indexOf('// Keep short trigger taps'));
const frameSource=main.slice(main.indexOf('function frame('),main.indexOf('\nui.devEnabled='));
const biteEvents=new Set(['bite-windup','bite-start','bite-struggle','bite-damage','bite-release','bite-terminal','player-injury']);
const player=()=>({course:{index:0,enemies:[]},x:6,y:9,z:0,angle:0,pitch:0,weapon:0,health:100,kills:0,bite:{phase:'idle'},playerWounds:{}});
function snapshotHarness(){
  const played=[],context=vm.createContext({
    run:player(),lastSnapshot:-1,lastNetEvent:-1,fatalBiteUntil:5000,screen:'dead',parrySequence:1,chestSequence:4,hookSequence:1,
    verminSequence:0,validateVerminSnapshot,validateVerminHand,validateVerminCrawl,VERMIN_LOCAL_EVENTS:new Set(),settings:{autoRun:false},playerFields:['x','y','z','angle','pitch','weapon','health','kills','bite','playerWounds'],BITE_EVENTS:biteEvents,
    saneSnapshot:()=>true,newRun:player,makeCampaignCourse:()=>({index:0}),resetInput(){},syncRoomGateCells(){},pointerLock(){},spatialEvent:e=>e,listenerPose,isPredictedFirearmEcho,
    ui:{play(){},hide(){},toast(){}},document:{body:{classList:{add(){}}}},
    audio:{play:type=>played.push(type),updateListener(){},setScene(){},resume(){},resetCounterCues(){context.counterResets=(context.counterResets||0)+1;},unlock:()=>({then(){}})}
  });
  vm.runInContext(snapshotSource,context);
  const snapshot=(seq,health=100,phase='idle',audioEvents=[])=>({seq,host:{...player(),mode:'play'},guest:{...player(),health,bite:{phase}},sectorIndex:0,enemies:[],audioEvents});
  return{context,played,snapshot};
}

test('guest start clears an earlier fatal bite presentation deadline',()=>{
  const {context,snapshot}=snapshotHarness();
  context.applySnapshot(snapshot(1),true);
  assert.equal(context.fatalBiteUntil,0);assert.equal(context.screen,'play');
  assert.equal(context.chestSequence,0,'a new peer run cannot replay the old finisher input sequence');
  assert.equal(context.counterResets,1,'a guest restart opens a fresh canonical counter audio ledger');
});

test('a released bite snapshot plays its canonical damage once and retains ordinary damage fallback',()=>{
  const {context,played,snapshot}=snapshotHarness();
  context.screen='play';
  const events=[{seq:1,type:'bite-damage',playerId:'peer'},{seq:2,type:'bite-release',playerId:'peer'}];
  context.applySnapshot(snapshot(1,92,'released',events));
  assert.deepEqual(played,['bite-damage','bite-release']);
  played.length=0;context.applySnapshot(snapshot(2,92,'idle',events));
  assert.deepEqual(played,[],'repeated snapshots cannot replay the injury cues');
  context.applySnapshot(snapshot(3,80,'idle',events));
  assert.deepEqual(played,['damage'],'an old bite event cannot suppress a new ordinary health drop');
});

test('the other player\'s injury event cannot suppress local ordinary damage',()=>{
  const {context,played,snapshot}=snapshotHarness();
  context.screen='play';context.applySnapshot(snapshot(1,92,'idle',[{seq:1,type:'bite-damage',playerId:'host'}]));
  assert.deepEqual(played,['damage']);
});

test('guest hears host firearm cues once and rejects the local prediction echo',()=>{
 const {context,played,snapshot}=snapshotHarness();context.screen='play';
 const events=[{seq:1,type:'shot',playerId:'host'},{seq:2,type:'rocket',playerId:'host'},
  {seq:3,type:'rifle-charge',playerId:'host'},{seq:4,type:'shot',playerId:'peer'},{seq:5,type:'rocket',playerId:'peer'}];
 const poses=[];context.audio.updateListener=pose=>poses.push(pose);
 context.applySnapshot(snapshot(1,100,'idle',events));assert.deepEqual(played,['shot','rocket','rifle-charge']);
 assert.equal(poses.length,1,'the latest guest pose is installed before snapshot audio');
 assert.equal(poses[0].x,context.run.x*4);assert.equal(poses[0].y,1.6);
 played.length=0;context.applySnapshot(snapshot(2,100,'idle',events));assert.deepEqual(played,[]);
});

test('host collects final injury cues and sends terminal state in the same simulation frame',()=>{
  for(const mode of ['dead','win']){
    const sent=[],run={course:{},mode:'play',health:8,weapon:0,cooldowns:[0],bite:{phase:'idle'}};
    const context=vm.createContext({run,screen:'play',last:1000,frames:0,fpsClock:0,fps:60,acc:0,netClock:0,hudClock:0,fatalBiteUntil:0,
      horrorManual:false,updatePresence(){},updateWorldAudio(){},inspector:{active:false},session:{connected:true,role:'host',send:m=>sent.push(m)},pulses:new Set(),settings:{},
      updateGamepad(){},updateInspector(){},intent:()=>({}),shoot(){},tick:()=>{run.mode=mode;if(mode==='dead')run.bite.phase='terminal';},
      processEvents:()=>{context.netEvents.push({type:'bite-terminal',seq:1});},netEvents:[],
      snapshot:()=>({mode:run.mode,audioEvents:[...context.netEvents]}),
      resetInput(){},document:{exitPointerLock(){}},audio:{pause(){},setScene(){}},ui:{finish(){},hud(){}},
      packUI:{open:false,update(){}},renderer:{render(){},renderMenu(){}},requestAnimationFrame(){}
    });
    vm.runInContext(frameSource,context);context.frame(1010);
    const first=sent.find(m=>m.t==='snapshot');
    assert.ok(first,'terminal state flushes even before the 50ms periodic send');
    assert.equal(first.s.mode,mode);assert.equal(first.s.audioEvents[0]?.type,'bite-terminal');
  }
});

test('a downed guest cannot predict shot or parry sounds, and revival restores both',()=>{
  const played=[],run={course:{},mode:'play',health:0,weapon:0,cooldowns:[0],bite:{phase:'terminal'}};
  const context=vm.createContext({run,screen:'play',last:1000,frames:0,fpsClock:0,fps:60,acc:0,netClock:0,hudClock:0,fatalBiteUntil:0,parrySequence:0,
    horrorManual:false,updatePresence(){},updateWorldAudio(){},inspector:{active:false},session:{connected:true,role:'guest',send(){}},pulses:new Set(),settings:{},weapons:[{interval:.4}],
    updateGamepad(){},updateInspector(){},intent:()=>({fire:true}),tickPlayer(){},processEvents(){},parry(){},
    audio:{play:type=>played.push(type)},ui:{hud(){}},packUI:{open:false,update(){}},renderer:{render(){},renderMenu(){}},requestAnimationFrame(){}
  });
  const punchSource=main.split('\n').find(line=>line.startsWith('function punch('));
  vm.runInContext(frameSource+'\n'+punchSource,context);
  context.frame(1010);context.punch();
  assert.deepEqual(played,[]);assert.equal(context.parrySequence,0);
  run.health=65;run.bite.phase='idle';context.frame(1020);context.punch();
  assert.deepEqual(played,['shot','parry']);assert.equal(context.parrySequence,1);
});

test('host consumes a remote chest sequence once before held fire and preserves independent parry input',()=>{
 const run=newRun(makeCourse());Object.assign(run,{mode:'play',x:9,y:6,wave:3,waveDelay:999});
 const peer=addPeer(run);Object.assign(peer,{x:6,y:6,angle:0});
 const enemy={id:42,x:6.25,y:6,z:0,hp:60,maxHp:100,kind:0,variant:'stalker',dead:false,flash:0,phase:0,stagger:.3,attack:99,moveSpeed:.3,baseMoveSpeed:.3,wounds:{arm:false,leg:false,eye:false}};
 run.course.enemies=[enemy];const events=[];
 const context=vm.createContext({run,screen:'play',last:1000,frames:0,fpsClock:0,fps:60,acc:0,netClock:0,hudClock:0,fatalBiteUntil:0,
  horrorManual:false,updatePresence(){},updateWorldAudio(){},inspector:{active:false},session:{connected:true,role:'host',send(){}},pulses:new Set(),settings:{},
  remoteInput:{},remotePress:{fire:false,alt:false},remoteSeen:0,remoteParry:0,remoteChest:0,remoteHook:0,
  performance:{now:()=>1000},clamp,weapons,chestFinisher,tick,tickPlayer,shoot,parry,attackVermin,grapple,switchWeapon,
  updateGamepad(){},updateInspector(){},intent:()=>({}),
  processEvents(){events.push(...run.events,...peer.events);run.events=[];peer.events=[];},snapshot:()=>({}),
  resetInput(){},document:{exitPointerLock(){}},audio:{pause(){},setScene(){}},ui:{finish(){},hud(){},toast(){}},
  packUI:{open:false,update(){}},renderer:{render(){},renderMenu(){}},requestAnimationFrame(){}
 });
 const receiveSource=main.slice(main.indexOf('function receive('),main.indexOf('function intent('));
 vm.runInContext(receiveSource+'\n'+frameSource,context);
 const message={t:'input',i:{angle:0,pitch:0,weapon:0,chest:1,parry:0,fire:true}};
 context.receive(message);context.frame(1010);
 assert.equal(context.remoteChest,1);assert.equal(context.remoteParry,0);assert.equal(peer.brutal.phase,'windup');assert.ok(peer.energy>=85&&peer.energy<86);
 assert.equal(events.find(e=>e.type==='brutal-start').energyCost,15);
 assert.equal(enemy.hp,60);assert.equal(events.some(e=>e.type==='shot'),false,'the same remote frame cannot fire through committed hand motion');
 for(let frame=2;frame<=151;frame++){context.receive(message);context.frame(1000+frame*10);}
 assert.equal(events.filter(e=>e.type==='brutal-start').length,1);assert.equal(events.filter(e=>e.type==='brutal-contact').length,1);
 assert.equal(events.filter(e=>e.type==='brutal-extract').length,1);assert.equal(events.filter(e=>e.type==='brutal-release').length,1);
 assert.equal(enemy.heartRemoved,true);assert.equal(peer.brutal.phase,'idle');assert.equal(context.remoteParry,0);
 context.receive({...message,i:{...message.i,chest:1,parry:1,fire:false}});context.frame(2520);
 assert.equal(context.remoteParry,1);assert.equal(events.filter(e=>e.type==='brutal-start').length,1);
});
