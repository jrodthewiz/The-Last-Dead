import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,weapons,shoot,shootRifle,tickPlayer,switchWeapon,addPeer} from '../engine.js';

function arena(weapon=4) {
  const course=makeCourse();
  const run=newRun(course);
  Object.assign(run,{mode:'play',x:6,y:10,angle:-Math.PI/2,pitch:0});
  run.waveDelay=999;
  switchWeapon(run,weapon);
  return run;
}
function advance(run,seconds,input={}) {
  const count=Math.round(seconds*120);
  for(let i=0;i<count;i++)tickPlayer(run,1/120,input);
}
function targets(run,count=4) {
  run.course.enemies=Array.from({length:count},(_,i)=>({id:50+i,x:6,y:8-i,hp:100,maxHp:100,kind:0,dead:false,flash:0,attack:99,phase:0}));
  return run.course.enemies;
}

test('rifles extend the arsenal with independent cooldowns and deterministic automatic fire',()=>{
  assert.equal(weapons[4].name,'CARRION');assert.equal(weapons[5].name,'MOURNING');
  const simulate=()=>{
    const run=arena();targets(run,1);
    for(let i=0;i<240;i++){shoot(run);tickPlayer(run,1/120,{});}
    assert.ok(run.shotSequence>=17&&run.shotSequence<=19);
    assert.ok(run.rifleHeat>.6&&run.rifleHeat<=1);
    const traces=run.tracers.map(t=>[t.tx,t.ty,t.mode]);
    switchWeapon(run,0);advance(run,3);
    assert.equal(run.rifleHeat,0);
    assert.equal(run.cooldowns.length,weapons.length);
    return traces;
  };
  assert.deepEqual(simulate(),simulate());
});

test('burst completes three distinct rounds after trigger release and keeps recovery',()=>{
  const run=arena();targets(run,1);
  assert.equal(shoot(run,true),true);
  assert.equal(run.shotSequence,1);
  assert.equal(run.rifleBurst,2);
  advance(run,.075);
  assert.equal(run.shotSequence,2);
  advance(run,.083333333);
  assert.equal(run.shotSequence,3);
  assert.equal(run.rifleBurst,0);
  assert.ok(run.cooldowns[4]>.3);
  assert.equal(shoot(run),false);
  assert.deepEqual(run.tracers.map(t=>t.mode),['burst','burst','burst']);
  advance(run,.35);
  assert.equal(shoot(run),true);
});

test('switching cancels queued burst and charge; pause never advances a mechanism',()=>{
  const run=arena();shoot(run,true);switchWeapon(run,1);advance(run,.25);
  assert.equal(run.shotSequence,1);
  switchWeapon(run,5);shoot(run,true);advance(run,.2,{alt:true});
  assert.ok(run.rifleCharge>.3);
  const charge=run.rifleCharge;
  run.mode='pause';advance(run,.5,{alt:true});assert.equal(run.rifleCharge,charge);
  run.mode='play';switchWeapon(run,0);advance(run,1,{alt:true});
  assert.equal(run.rifleCharge,0);assert.equal(run.rifleCharging,false);assert.equal(run.shotSequence,1);
});

test('Mourning early release cancels; a full charge pierces at most three targets then recovers',()=>{
  const run=arena(5),enemies=targets(run);
  assert.equal(shoot(run,true),false);
  advance(run,.25,{alt:true});advance(run,.01);
  assert.equal(run.shotSequence,0);assert.ok(enemies.every(e=>e.hp===100));
  shoot(run,true);advance(run,.56,{alt:true});
  assert.equal(run.shotSequence,1);assert.equal(run.lastShotMode,'charged');
  assert.ok(enemies.slice(0,3).every(e=>e.hp<100));assert.equal(enemies[3].hp,100);
  assert.ok(enemies[0].hp<enemies[1].hp&&enemies[1].hp<enemies[2].hp);
  assert.equal(run.rifleCharge,0);assert.ok(run.cooldowns[5]>1.15);
  assert.equal(run.tracers[0].surface,'flesh');assert.equal(run.tracers[0].charged,true);
  assert.equal(shoot(run),false);
});

test('charged rifle cannot shoot through a wall or behind the player',()=>{
  const run=arena(5),enemies=targets(run);
  run.course.cells[8*run.course.w+6][0]=1;
  enemies[0].y=9;enemies[1].y=7;enemies[2].y=10.6;
  shoot(run,true);advance(run,.56,{alt:true});
  assert.ok(enemies[0].hp<100);assert.equal(enemies[1].hp,100);assert.equal(enemies[2].hp,100);
  assert.ok(run.tracers[0].ty>=8);
});

test('prediction animates and emits local audio but never damages enemies or mutates world pools',()=>{
  const run=arena(),enemy=targets(run,1)[0];
  shootRifle(run,true,true);advance(run,.17,{predictWeapons:true});
  assert.equal(run.shotSequence,3);assert.equal(enemy.hp,100);assert.equal(run.tracers.length,0);
  assert.equal(run.gore.length,0);assert.equal(run.events.filter(e=>e.type==='shot'&&e.predicted).length,3);
  switchWeapon(run,5);shootRifle(run,true,true);advance(run,.56,{alt:true,predictWeapons:true});
  assert.equal(run.lastShotMode,'charged');assert.equal(enemy.hp,100);assert.equal(run.tracers.length,0);
});

test('peer burst has its own state and traces preserve shooter ownership',()=>{
  const host=arena(),enemy=targets(host,1)[0],peer=addPeer(host);
  Object.assign(peer,{x:6,y:10,angle:-Math.PI/2,pitch:0});switchWeapon(peer,4);
  shoot(peer,true);advance(peer,.17);
  assert.equal(host.shotSequence,0);assert.equal(host.rifleHeat,0);
  assert.equal(peer.shotSequence,3);assert.ok(enemy.hp<100);
  assert.equal(host.tracers.length,3);assert.ok(host.tracers.every(t=>t.ownerId==='peer'));
});
