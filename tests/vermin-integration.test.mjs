import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {makeCourse,newRun,addPeer,tick,tickPlayer,clamp,weapons,validateVerminSnapshot,validateVerminHand,validateVerminCrawl} from '../engine.js';

const source=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const receive=source.slice(source.indexOf('function receive('),source.indexOf('function intent('));
const apply=source.slice(source.indexOf('function applySnapshot('),source.indexOf('// Keep short trigger taps'));
const fields=source.match(/^const playerFields=.*\n(?:playerFields\.push.*\n)+/m)[0];
const events=source.match(/^const (?:BITE_EVENTS|VERMIN_LOCAL_EVENTS)=.*$/gm).join('\n');

test('actual remote input routing preserves a released rat tap and never repeats its pickup',()=>{
  const run=newRun(makeCourse());run.mode='play';run.x=9;run.y=9;
  const peer=addPeer(run);Object.assign(peer,{x:6,y:6,z:0,angle:0,pitch:-.6});
  const rat=run.vermin.rats[0];Object.assign(rat,{x:6.2,y:6,state:'floor',ownerId:null});
  const c=vm.createContext({session:{role:'host'},remoteInput:{},remotePress:{},remoteSeen:0,clamp,weapons,ui:{toast(){}},performance:{now:()=>1}});
  vm.runInContext(receive,c);
  c.receive({t:'input',i:{angle:0,pitch:-.6,weapon:0,harvest:false,vermin:1}});
  tickPlayer(peer,1/120,c.remoteInput);assert.equal(peer.verminHand.phase,'pickup');
  for(let i=0;i<50;i++){tickPlayer(peer,1/120,c.remoteInput);tick(run,1/120,{});}
  assert.equal(peer.verminHand.phase,'held');assert.equal(peer.verminHand.sequence,1);
  assert.equal(peer.events.filter(e=>e.type==='vermin-pickup').length,1);
  c.receive({t:'input',i:{angle:0,pitch:0,weapon:0,harvest:false,vermin:2}});
  tickPlayer(peer,1/120,c.remoteInput);assert.equal(rat.state,'thrown');
  for(let i=0;i<45;i++){tickPlayer(peer,1/120,c.remoteInput);tick(run,1/120,{});}
  assert.equal(peer.verminHand.phase,'idle');assert.equal(peer.events.filter(e=>e.type==='vermin-throw').length,1);
});

function guestHarness(){
  const run=newRun(makeCourse()),played=[];run.course.index=0;run.health=100;
  const c=vm.createContext({run,screen:'play',lastSnapshot:-1,lastNetEvent:-1,settings:{autoRun:false},
    saneSnapshot:()=>true,syncRoomGateCells(){},spatialEvent:e=>e,ui:{toast(){}},
    validateVerminSnapshot,validateVerminHand,validateVerminCrawl,
    audio:{play:type=>played.push(type)}});
  vm.runInContext(fields+'\n'+events+'\n'+apply,c);
  return{run,played,c};
}
test('actual guest snapshot applies bounded world/hand state and filters another player’s bite audio',()=>{
  const {run,played,c}=guestHarness();
  const s={seq:1,sectorIndex:0,host:{mode:'play',kills:0,verminHand:{phase:'held',ratId:12,sequence:4}},
    guest:{x:run.x,y:run.y,health:99,verminHand:{phase:'held',ratId:13,sequence:2,holdAge:2.1},verminCrawl:{phase:'active',count:99}},
    enemies:[],vermin:{rats:[{id:13,state:'held',ownerId:'peer',x:Infinity,y:6,z:999}],roaches:[],scent:99},
    audioEvents:[{seq:1,type:'vermin-bite',playerId:'host',bites:1},{seq:2,type:'vermin-bite',playerId:'peer',bites:1}]};
  c.applySnapshot(s);assert.equal(run.verminHand.ratId,13);assert.equal(run.peer.verminHand.ratId,12);
  assert.equal(run.vermin.scent,1);assert(Number.isFinite(run.vermin.rats[0].x));assert.equal(run.vermin.rats[0].z,1.5);
  assert(run.verminCrawl.count<=4);assert.deepEqual(played,['vermin-bite']);
  c.applySnapshot({...s,seq:2});assert.deepEqual(played,['vermin-bite'],'duplicate canonical event is silent');
  s.seq=3;s.guest.health=98;s.audioEvents=[];c.applySnapshot(s);assert.equal(played.at(-1),'damage','unrelated health loss keeps generic feedback');
});
