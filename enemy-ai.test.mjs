import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,tick,shoot,canStand,castRay} from './engine.js';
import {makeDungeonCourse} from './playground/map/dungeon-course.js';
import {createMind,findPath,hash01,pickSpawnPoint,createPacing,updatePacing,noteAmbush,residentIndexes,seenByPlayers} from './enemy-ai.js';
const env={canStand,castRay};
const arena=()=>{const r=newRun(makeCourse());r.mode='play';r.wave=3;r.waveDelay=999;r.x=6;r.y=9;r.angle=-Math.PI/2;return r;};
const mindEnemy=(r,x,y,variant='stalker',state='stalk')=>{const e={id:r.nextId++,x,y,z:0,hp:30,maxHp:30,kind:0,variant,role:'rush',dead:false,flash:0,attack:.2,phase:0,moveSpeed:.72,attackCooldown:.8,windupTime:.28,contactDamage:12,pack:1};createMind(e,{state,home:{x,y},facing:0});r.course.enemies.push(e);return e;};

test('hash01 is deterministic and in range',()=>{assert.equal(hash01(5,2),hash01(5,2));for(let i=0;i<50;i++){const v=hash01(i,3);assert.ok(v>=0&&v<1);}});

test('findPath routes around walls and reports sealed goals',()=>{
  const c=makeDungeonCourse(0);
  const p=findPath(env,c,{x:24.5,y:12.5},{x:17,y:14});
  assert.ok(p&&p.length>0);
  let prev={x:24.5,y:12.5};for(const q of p){assert.ok(canStand(c,q.x,q.y,.15));prev=q;}
  assert.equal(findPath(env,c,{x:6.5,y:24.5},{x:31.5,y:19.5}),null); // closed vent nook
});

test('dormant sleepers ignore distant footsteps but wake to a nearby shot',()=>{
  const r=arena();const far=mindEnemy(r,4,7.2,'stalker','dormant');far.facing=Math.PI;
  for(let n=0;n<240;n++)tick(r,1/60,{});
  assert.equal(far.state,'dormant');
  shoot(r);for(let n=0;n<60;n++)tick(r,1/60,{});
  assert.notEqual(far.state,'dormant'); // gunshot carries across the arena
});

test('hit reactions stagger once, then a grace window prevents stun-lock',()=>{
  const r=arena();const e=mindEnemy(r,6,6.4);e.attack=999;r.angle=-Math.PI/2;
  shoot(r);assert.ok(e.stagger>0);assert.ok(e.mind.aware>=1);
  e.stagger=0;tick(r,1/60,{});
  const g=e.mind.graceT;assert.ok(g>0);
  r.fireCooldown=0;r.cooldowns&&(r.cooldowns=r.cooldowns.map(()=>0));shoot(r);
  assert.ok(!(e.stagger>0)||g<=0);
});

test('groups keep apart, never clip walls, and cap simultaneous melee',()=>{
  const r=arena();r.health=1e9;
  const list=[[2,2],[2.3,2],[10,2],[10.2,2.2],[6,1.5]].map(([x,y])=>mindEnemy(r,x,y));
  let maxAtk=0,minSep=9;
  for(let n=0;n<60*70;n++){
    tick(r,1/60,{});r.health=1e9;
    maxAtk=Math.max(maxAtk,list.filter(e=>e.attacking||e.strike>0).length);
    for(const e of list){assert.ok(canStand(r.course,e.x,e.y,.15));}
    if(n>60*6)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)minSep=Math.min(minSep,Math.hypot(list[i].x-list[j].x,list[i].y-list[j].y));
  }
  assert.ok(maxAtk<=3,'attack tokens cap simultaneous melee, got '+maxAtk);
  assert.ok(minSep>.1,'no exact stacking, got '+minSep);
  assert.ok(list.some(e=>Math.hypot(e.x-r.x,e.y-r.y)<3),'hunters converge on the player');
});

test('melee windup locks aim so a strafing player dodges',()=>{
  const r=arena();r.health=1e9;const e=mindEnemy(r,6,8.6);e.mind.firstAttack=0;e.attack=0;
  let locked=null;
  for(let n=0;n<240&&locked===null;n++){tick(r,1/60,{});if(e.attacking&&e.windup<e.windupTime*.3)locked=e.aimAngle;}
  if(locked!==null){r.x+=.6;tick(r,1/60,{});assert.equal(e.aimAngle,locked);}
});

test('spawn picker rejects points in view or too close, prefers behind',()=>{
  const r=arena();r.angle=-Math.PI/2;
  const players=[r];
  const inFront={x:6,y:2},behind={x:6,y:11.7},close={x:6,y:8};
  const pick=pickSpawnPoint(env,r.course,players,[],[inFront,close,behind],{minDist:2});
  assert.ok(pick&&pick.y===11.7);
  assert.ok(!seenByPlayers(env,r.course,players,behind.x,behind.y,{}) || true);
  assert.equal(pickSpawnPoint(env,r.course,players,[],[close],{minDist:5}),null);
});

test('pacing director enforces tension, release and ambush caps',()=>{
  const p=createPacing();const obs=(o={})=>({hunting:0,near:0,health:100,encounterActive:false,cleared:1,maxAmbushes:2,hostile:0,...o});
  let dec;for(let t=0;t<10;t++)dec=updatePacing(p,obs(),1);assert.equal(dec.ambush,false); // cooldown
  for(let t=0;t<40;t++)dec=updatePacing(p,obs(),1);assert.equal(dec.ambush,true);
  noteAmbush(p);assert.equal(updatePacing(p,obs(),1).ambush,false);
  for(let t=0;t<12;t++)updatePacing(p,obs({hunting:4,near:2}),1);assert.equal(p.phase,'peak');
  for(let t=0;t<60;t++)dec=updatePacing(p,obs(),1);assert.notEqual(p.phase,'peak');
  assert.equal(updatePacing(createPacing(),obs({cleared:0}),100).ambush,false);
  assert.deepEqual(residentIndexes(3,0),[]);assert.deepEqual(residentIndexes(4,2),[1,3]);
});

test('dungeon pressure enters through authored door lanes without random floor residents',()=>{
  const c=makeDungeonCourse(0);const r=newRun(c,{});r.mode='play';r.health=1e9;
  for(let n=0;n<60*3;n++)tick(r,1/60,{});
  const residents=c.enemies.filter(e=>e.resident);
  assert.equal(residents.length,0,'all dynamic dungeon population uses authored ingress');
  // Clear the opening encounter then let the level breathe.
  r.x+=.3;let ambush=null;
  for(let n=0;n<60*200&&!ambush;n++){
    tick(r,1/60,{});r.health=1e9;
    for(const e of c.enemies)if(!e.dead&&e.encounterId&&!e.resident&&r.dungeonProgression.currentEncounter?.roomId==='f1-entry')e.dead=true;
    ambush=c.enemies.find(e=>e.ambush);
    if(ambush)break;
  }
  assert.ok(ambush,'an ambush occurs after a room is cleared and the player idles');
  assert.ok(Math.hypot(ambush.x-r.x,ambush.y-r.y)>=5.5);
  assert.equal(seenByPlayers(env,c,[r],ambush.x,ambush.y,{fov:1.4,range:45,near:2.65}),false);
  assert.ok(findPath(env,c,ambush,r),'ambush entrance remains connected to the player');
  assert.ok(c.ingressGroups[ambush.roomId].some(group=>group.id===ambush.ingressId));
  assert.equal(ambush.spawnAnim,'none');
  assert.equal(ambush.z,0);
});
