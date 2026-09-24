import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,weapons,shoot,shootMelee,tick,tickPlayer,switchWeapon,cancelMelee,addPeer,canStand} from '../engine.js';

function encounter(weapon=6){
 const r=newRun(makeCourse());
 Object.assign(r,{mode:'play',x:6,y:8,angle:-Math.PI/2,pitch:0,waveDelay:999});
 switchWeapon(r,weapon);
 const e={id:101,x:6,y:7.3,z:0,hp:100,maxHp:100,kind:0,variant:'stalker',dead:false,flash:0,phase:0,attack:99,hits:0};
 r.course.enemies=[e];return{r,e};
}
function advance(r,seconds,input={},world=false){
 for(let i=0;i<Math.round(seconds*120);i++)(world?tick:tickPlayer)(r,1/120,input);
}

test('bat damage lands at the strike frame once, with an interrupted target and impact pause',()=>{
 const {r,e}=encounter();e.attacking=true;e.windup=.5;e.strike=.1;
 assert.equal(weapons.length,8);assert.equal(weapons[6].kind,'melee');
 assert.equal(shoot(r),true);assert.equal(e.hp,100);
 advance(r,.2);assert.equal(e.hp,100);assert.ok(r.meleeProgress<.4);
 advance(r,.083333);assert.equal(e.hp,93);assert.equal(e.hits,1);
 assert.equal(e.attacking,false);assert.ok(e.stagger>0);assert.ok(r.meleeHitStop>0);
 const progress=r.meleeProgress;advance(r,.025);assert.equal(r.meleeProgress,progress);
 advance(r,.6);assert.equal(e.hp,93);assert.equal(r.meleeActive,false);
 assert.equal(r.tracers[0].melee,true);assert.equal(r.tracers[0].surface,'flesh');
});

test('heavy bat has a later, stronger, narrower single-target strike',()=>{
 const {r,e}=encounter();const second={...e,id:102,x:6.22,y:7.27};r.course.enemies.push(second);
 shoot(r,true);advance(r,.3);assert.equal(e.hp,100);
 advance(r,.15);assert.equal(e.hp,88);assert.equal(second.hp,100);
 assert.equal(e.meleePower,1.5);assert.equal(r.lastShotMode,'');
});

test('normal bat cleaves at most two targets and excludes rear, high and distant targets',()=>{
 const {r,e}=encounter();
 const candidates=[{...e,id:102,x:6.25},{...e,id:103,x:5.75},{...e,id:104,y:8.6},{...e,id:105,y:6.4}];
 r.course.enemies.push(...candidates);shoot(r);advance(r,.3);
 assert.equal(r.course.enemies.filter(x=>x.hp<100).length,2);assert.equal(candidates[2].hp,100);assert.equal(candidates[3].hp,100);
 const high=encounter();high.r.z=1.4;shoot(high.r);advance(high.r,.3);assert.equal(high.e.hp,100);
});

test('both melee weapons respect walls; close wall contacts create surface effects',()=>{
 for(const w of [6,7]){
  const {r,e}=encounter(w);r.y=8.25;e.y=7.7;r.course.cells[8*r.course.w+6][0]=1;
  shoot(r);advance(r,.6,{fire:w===7});
  assert.equal(e.hp,100);assert.ok(r.events.some(x=>x.type==='melee-wall'));
  assert.ok(r.tracers.every(x=>x.surface==='wall'&&x.melee));
 }
});

test('chainsaw spools up, cuts only on cadence and stops damaging immediately on release',()=>{
 const {r,e}=encounter(7);advance(r,.1,{fire:true});assert.equal(e.hp,100);
 advance(r,.5,{fire:true});assert.ok(e.hits>=4&&e.hits<=5);assert.ok(r.sawContact>0);assert.equal(r.sawRev,1);
 const hp=e.hp;advance(r,.4);assert.equal(e.hp,hp);assert.equal(r.sawActive,false);assert.equal(r.sawRev,0);
 assert.ok(r.events.filter(x=>x.type==='chainsaw-hit').length<=5);
});

test('a downward swing contacts the floor without hitting an upright target',()=>{
 const {r,e}=encounter();r.pitch=-1.2;shoot(r);advance(r,.3);
 assert.equal(e.hp,100);assert.equal(r.tracers[0]?.surface,'floor');assert.equal(r.tracers[0]?.normal.z,1);
});

test('chainsaw shove is a single contact and never also cuts while alternate input is held',()=>{
 const {r,e}=encounter(7);shoot(r,true);advance(r,.7,{fire:true,alt:true});
 assert.equal(e.hp,97);assert.equal(e.hits,1);assert.equal(r.sawActive,false);
 assert.equal(r.events.filter(x=>x.type==='chainsaw-hit').length,0);
});

test('switching or cancelling during windup prevents a delayed invisible hit',()=>{
 const {r,e}=encounter();shoot(r);advance(r,.18);switchWeapon(r,0);advance(r,.7);
 assert.equal(e.hp,100);assert.equal(r.meleeActive,false);
 switchWeapon(r,6);r.cooldowns[6]=0;shoot(r);advance(r,.1);cancelMelee(r);advance(r,.7);assert.equal(e.hp,100);
 switchWeapon(r,7);advance(r,.3,{fire:true});cancelMelee(r);assert.equal(r.sawRev,0);assert.equal(r.sawContact,0);
});

test('lethal bat impulse moves and lifts a corpse, collides with walls and settles finitely',()=>{
 const {r,e}=encounter();e.hp=1;shoot(r,true);advance(r,.45,{},true);
 assert.equal(e.dead,true);assert.ok(e.meleeVY<0);assert.ok(e.meleeZ>0);
 const hitY=e.y;advance(r,1.6,{},true);assert.ok(e.y<hitY);assert.equal(e.meleeZ,0);
 r.course.cells[r.course.w+6][0]=1;e.y=1.19;e.meleeVY=-3;
 for(let i=0;i<40;i++)tick(r,.05,{});
 assert.ok(canStand(r.course,e.x,e.y,.16));assert.ok(e.y>=1.16);assert.ok(Math.abs(e.meleeYaw)<=.85);
 for(const k of ['x','y','meleeZ','meleeVX','meleeVY','meleeVZ','meleeYaw'])assert.ok(Number.isFinite(e[k]),k);
});

test('guest prediction advances swing/rev presentation without mutating enemies or contact pools',()=>{
 const {r,e}=encounter();shootMelee(r,false,true);advance(r,.8,{predictWeapons:true});
 assert.equal(e.hp,100);assert.equal(r.tracers.length,0);assert.equal(r.meleeSequence,1);
 switchWeapon(r,7);advance(r,.5,{fire:true,predictWeapons:true});
 assert.equal(r.sawRev,1);assert.equal(e.hp,100);assert.equal(r.tracers.length,0);
});

test('peer melee uses independent swing state and shared authoritative contact effects',()=>{
 const {r,e}=encounter();const peer=addPeer(r);Object.assign(peer,{x:r.x,y:r.y,angle:r.angle,pitch:0});switchWeapon(peer,6);
 shoot(peer);advance(peer,.3);assert.equal(e.hp,93);assert.equal(r.meleeSequence,0);
 assert.equal(peer.meleeSequence,1);assert.equal(r.tracers[0].ownerId,'peer');
});
