import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import {makeCourse,newRun,eye,castRay} from '../engine.js';
import {FIREARM_EVENTS,listenerPose,eventAudioDetails,resolveAudioTrack,isPredictedFirearmEcho} from '../spatial-audio.js';

function fixture(){const run=newRun(makeCourse());Object.assign(run,{x:2.5,y:3.5,z:0,slide:0,angle:0,pitch:0,mode:'play',playerId:'host'});return run;}
const near=(a,b,message)=>assert(Math.abs(a-b)<1e-10,message);

test('host processing stamps both shooters and forwards their actual positional firearm cues',()=>{
 const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
 const source=main.slice(main.indexOf('function processEvents('),main.indexOf('function frame('));
 const run=fixture(),played=[];run.time=0;run.distance=0;run.events=[{type:'shot',weapon:0,x:run.x,y:run.y,z:.4}];
 run.peer={playerId:'peer',events:[{type:'shot',weapon:4,x:4.5,y:3.5,z:.4},{type:'rifle-charge',weapon:5,x:4.5,y:3.5,z:.4}]};
 const context=vm.createContext({run,session:{role:'host'},lastStep:0,lastHeartbeat:0,netEvents:[],netEventSeq:0,FIREARM_EVENTS,
  BITE_EVENTS:new Set(),VERMIN_LOCAL_EVENTS:new Set(),listenerPose,spatialEvent:e=>eventAudioDetails(e,run),
  horrorPresence:{noteStep(){}},updatePresence(){},updateHorrorAudio(){},renderer:{},ui:{combatEvent(){}},
  audio:{updateListener(){},setAmbiencePreset(){},play:(type,weapon,details)=>played.push({type,weapon,details})}});
 vm.runInContext(source,context);context.processEvents();
 assert.deepEqual(played.map(e=>e.details.playerId),['host','peer','peer']);assert.equal(played[0].details.position,null);
 assert.deepEqual(played[1].details.position,{x:18,y:1.6,z:14});assert.equal(played[1].details.occluded,true);
 assert.deepEqual(Array.from(context.netEvents,e=>e.playerId),['host','peer','peer']);
 assert.deepEqual(Array.from(context.netEvents,e=>e.seq),[1,2,3]);assert.equal(run.events.length,0);assert.equal(run.peer.events.length,0);
});

test('listener matches actual camera axes and engine eye height in metres, including sliding and airborne poses',()=>{
  const run=fixture();
  for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI])for(const pitch of [-1.1,0,1.1])for(const slide of [0,.5,1]){
    Object.assign(run,{angle,pitch,slide,z:.25});const pose=listenerPose(run);
    near(pose.x,10);near(pose.z,14);near(pose.y,eye(run)*4);
    const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();rig.add(camera);
    rig.rotation.y=-angle-Math.PI/2;camera.rotation.order='YXZ';camera.rotation.x=pitch;rig.updateMatrixWorld(true);
    const forward=camera.getWorldDirection(new THREE.Vector3()),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    const actualForward=new THREE.Vector3(pose.forwardX,pose.forwardY,pose.forwardZ),actualUp=new THREE.Vector3(pose.upX,pose.upY,pose.upZ);
    assert(actualForward.distanceTo(forward)<1e-10);assert(actualUp.distanceTo(up)<1e-10);
    near(actualForward.dot(actualUp),0);near(actualForward.length(),1);near(actualUp.length(),1);
  }
  Object.assign(run,{z:0,slide:1});near(listenerPose(run).y,.88);
});

test('own firearm audio stays head-relative while remote shots use world units and shooter identity',()=>{
  const run=fixture();
  for(const type of FIREARM_EVENTS){
    const event={type,weapon:4,x:run.x,y:run.y,z:eye(run),shotSequence:7,trackKey:'enemy:wrong'};
    const copy=structuredClone(event),own=eventAudioDetails(event,run),peer=eventAudioDetails({...event,x:3.5,y:2.5},run,'peer');
    assert.equal(own.playerId,'host');assert.equal(own.position,null);assert.equal(own.occluded,false);assert.equal(own.trackKey,undefined);
    assert.equal(peer.playerId,'peer');assert.deepEqual(peer.position,{x:14,y:1.6,z:10});
    assert.deepEqual(event,copy,'routing never stamps or rewrites the simulation event');
  }
  const alreadyOwned={type:'shot',playerId:'peer',x:3.5,y:2.5,z:.4};
  assert.equal(eventAudioDetails(alreadyOwned,run,'host').playerId,'peer','canonical shooter identity wins');
  run.playerId='peer';assert.equal(eventAudioDetails({...alreadyOwned,playerId:'host'},run).position.x,14);
  assert.equal(eventAudioDetails(alreadyOwned,run).position,null);
});

test('all world sounds use actual engine wall rays from the local listener without changing canonical anchors',()=>{
  const run=fixture();
  // makeCourse's authored cover occupies cell (3,3). This cue is beyond it.
  const event={type:'enemy-attack',enemyId:12,x:4.5,y:3.5,z:.32,occluded:false};
  const distance=Math.hypot(event.x-run.x,event.y-run.y);
  assert(castRay(run.course,run.x,run.y,0,distance).dist<distance-.12);
  for(const type of ['enemy-attack','shot','explosion','melee-wall','brutal-contact']){
    const routed=eventAudioDetails({...event,type},run,'peer');
    assert.equal(routed.occluded,true,type);assert.deepEqual(routed.position,{x:18,y:1.28,z:14});
  }
  const guest={...run,x:5.5,playerId:'peer'};
  assert.equal(eventAudioDetails(event,guest).occluded,false,'the same shared source has different listener-relative occlusion');
  assert.equal(event.occluded,false);assert.equal(event.position,undefined);
  assert.equal(eventAudioDetails({type:'explosion',x:run.x+.05,y:run.y,z:0},run).occluded,false,'very close sources avoid self-occlusion');
});

test('eligible living enemy cues recover missing coordinates and follow current position/occlusion',()=>{
  const run=fixture(),enemy={id:12,x:4.5,y:3.5,z:.32,hp:20,dead:false};run.course.enemies.push(enemy);
  for(const type of ['moan','enemy-attack','enemyjump','enemyland','horror-approach']){
    const cue={type,enemyId:12},snapshot=structuredClone(cue),routed=eventAudioDetails(cue,run);
    assert.equal(routed.trackKey,'enemy:12');assert.deepEqual(routed.position,{x:18,y:1.28,z:14});assert.equal(routed.occluded,true);
    assert.deepEqual(cue,snapshot);
  }
  assert.deepEqual(eventAudioDetails({type:'moan',enemyId:12,z:.08},run).position,{x:18,y:.32,z:14},'authored vertical cue anchors survive missing-coordinate recovery');
  enemy.x=2.5;enemy.y=2.5;enemy.z=.4;
  assert.deepEqual(resolveAudioTrack('enemy:12',run),{position:{x:10,y:1.6,z:10},occluded:false});
  assert.deepEqual(resolveAudioTrack('enemy:12',{...run,course:null,world:run}),{position:{x:10,y:1.6,z:10},occluded:false});
  enemy.dead=true;assert.equal(resolveAudioTrack('enemy:12',run),null);assert.equal(eventAudioDetails({type:'enemy-attack',enemyId:12},run).trackKey,undefined);
  enemy.dead=false;enemy.hp=0;assert.equal(resolveAudioTrack('enemy:12',run),null);
  enemy.hp=20;enemy.health=-1;assert.equal(resolveAudioTrack('enemy:12',run),null);
  run.course.enemies=[];assert.equal(resolveAudioTrack('enemy:12',run),null);
  assert.equal(eventAudioDetails({type:'moan',enemyId:12},run).position,undefined);
});

test('impacts, deaths and completed firearm shots never inherit entity tracking',()=>{
  const run=fixture();run.course.enemies.push({id:8,x:2.5,y:2.5,hp:20,dead:false});
  for(const type of ['hit','blood','kill','enemy-death','death','explosion','shot','rocket']){
    const cue=eventAudioDetails({type,x:2.5,y:2.5,z:.32,enemyId:8,playerId:'peer',trackKey:'enemy:8'},run);
    assert.equal(cue.trackKey,undefined,type);
  }
  for(const key of ['',null,'other:8','enemy:','enemy:missing'])assert.equal(resolveAudioTrack(key,run),null);
});

test('only a live remote rifle charge may track the peer, with independent occlusion and cleanup on death',()=>{
  const run=fixture();run.peer={playerId:'peer',x:4.5,y:3.5,z:.4,health:100,mode:'play'};
  const cue=eventAudioDetails({type:'rifle-charge'},run,'peer');
  assert.equal(cue.trackKey,'peer:peer');assert.deepEqual(cue.position,{x:18,y:1.6,z:14});assert.equal(cue.occluded,true);
  run.peer.x=2.5;run.peer.y=2.5;
  assert.deepEqual(resolveAudioTrack(cue.trackKey,run),{position:{x:10,y:1.6,z:10},occluded:false});
  assert.equal(eventAudioDetails({type:'rifle-charge',playerId:'host'},run).trackKey,undefined);
  assert.equal(eventAudioDetails({type:'shot',playerId:'peer',x:run.peer.x,y:run.peer.y},run).trackKey,undefined);
  run.peer.health=0;assert.equal(resolveAudioTrack(cue.trackKey,run),null);
  run.peer.health=-1;assert.equal(resolveAudioTrack(cue.trackKey,run),null);
  delete run.peer;assert.equal(resolveAudioTrack(cue.trackKey,run),null);
});

test('local firearm echoes are rejected by shooter identity without suppressing peer or enemy sounds',()=>{
  for(const type of FIREARM_EVENTS){
    assert.equal(isPredictedFirearmEcho({type,playerId:'peer'},'peer'),true);
    assert.equal(isPredictedFirearmEcho({type,playerId:'host'},'peer'),false);
    assert.equal(isPredictedFirearmEcho({type},undefined),false);
  }
  for(const type of ['enemy-attack','explosion','brutal-contact','hit'])assert.equal(isPredictedFirearmEcho({type,playerId:'peer'},'peer'),false);
  assert.equal(isPredictedFirearmEcho(null,'peer'),false);
});

test('explicit metre positions are copied, occluded locally and missing coordinates remain safe',()=>{
  const run=fixture(),event={type:'explosion',position:{x:18,y:1.6,z:14},occluded:false};
  const details=eventAudioDetails(event,run);assert.notEqual(details,event);assert.notEqual(details.position,event.position);assert.equal(details.occluded,true);
  assert.equal(event.occluded,false);
  assert.equal(eventAudioDetails({type:'moan',enemyId:99,x:NaN,y:1},run).position,undefined);
  assert.equal(eventAudioDetails({type:'ui'},run).position,undefined);
  assert.equal(resolveAudioTrack('enemy:99',{}),null);
});
