import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,switchWeapon,fireWeaponInput,tickPlayer,addPeer} from '../engine.js';

function player(weapon){
 const r=newRun(makeCourse());Object.assign(r,{mode:'play',x:6,y:6,angle:0,pitch:0,waveDelay:999});r.course.enemies=[];switchWeapon(r,weapon);return r;
}
function hold(r,input,seconds=1,predicted=false){
 for(let i=0;i<Math.round(seconds*120);i++){fireWeaponInput(r,input,predicted);tickPlayer(r,1/120,{...input,predictWeapons:predicted});}
}

test('right-click / LT steadies every bare firearm without a secondary shot or effect',()=>{
 for(let weapon=0;weapon<6;weapon++){
  const r=player(weapon),coins=r.coinCharges;hold(r,{alt:true});
  assert(r.aim>.99,`weapon ${weapon} must steady while held`);
  assert.equal(r.coinCharges,coins);assert.equal(r.coins.length,0);
  assert.equal(r.projectiles.length,0);assert.equal(r.tracers.length,0);
  assert.equal(r.shot,0);assert.equal(r.shotSequence,0);
  assert.equal(r.rifleBurst,0);assert.equal(r.rifleCharge,0);assert.equal(r.rifleCharging,false);
  assert(!r.events.some(e=>['shot','coin','rifle-charge','rocket','rocket-detonate'].includes(e.type)));
  hold(r,{},.6);assert(r.aim<.001,'release smoothly restores ordinary handling');
 }
});

test('left-click / RT while aiming still fires each primary weapon',()=>{
 for(let weapon=0;weapon<6;weapon++){
  const r=player(weapon);hold(r,{alt:true},.4);assert(fireWeaponInput(r,{fire:true,alt:true}));
  assert.equal(r.coins.length,0);assert(!r.projectiles.some(p=>p.core));
  if(weapon===3)assert.equal(r.projectiles[0].kind,'rocket');
  else assert(r.tracers.length>0);
  if(weapon>=4)assert.equal(r.lastShotMode,weapon===4?'auto':'snap');
 }
});

test('co-op host and predicted guest share aim-only secondary input',()=>{
 const host=player(0),peer=addPeer(host);
 for(let weapon=0;weapon<6;weapon++){
  switchWeapon(peer,weapon);hold(peer,{alt:true});
  assert.equal(host.coins.length,0);assert.equal(host.tracers.length,0);assert.equal(host.projectiles.length,0);
 }
 for(const weapon of [4,5]){
  const guest=player(weapon);hold(guest,{alt:true},1,true);
  assert.equal(guest.shotSequence,0);assert.equal(guest.rifleCharge,0);
  assert(fireWeaponInput(guest,{fire:true,alt:true},true));
  assert.equal(guest.tracers.length,0,'prediction never creates authoritative hits');
  assert.equal(guest.lastShotMode,weapon===4?'auto':'snap');
 }
});

test('the existing bat heavy strike and saw shove remain physical melee actions',()=>{
 for(const weapon of [6,7]){
  const r=player(weapon);assert(fireWeaponInput(r,{alt:true}));
  assert.equal(r.meleeActive,true);assert.equal(r.meleeHeavy,true);
  tickPlayer(r,1/120,{alt:true});assert.equal(r.aim,0);
 }
});
