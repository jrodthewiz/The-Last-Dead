import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,addPeer,tick,tickPlayer,nearestRat,verminTarget,useVermin,attackVermin,tickVermin,shoot,shootRifle,shootMelee,chestFinisher,VERMIN_TIMING,validateVerminSnapshot,validateVerminHand,validateVerminCrawl,canStand} from '../engine.js';
import {createVerminState,makeVerminHand,resetVerminWorld} from '../vermin-system.js';

function setup({peer=false}={}){
  const world=newRun(makeCourse());Object.assign(world,{mode:'play',x:6,y:6,angle:0,pitch:-.7,wave:3,waveDelay:999});
  const player=peer?addPeer(world):world;Object.assign(player,{x:6,y:6,angle:0,pitch:-.7});
  const rat={...world.vermin.rats[0],id:100000,x:6.2,y:6,z:.014,angle:0,state:'floor',ownerId:null,enemyId:null,age:0,turn:100,speed:.05};
  world.vermin.rats=[rat];world.vermin.roaches=[];world.vermin.swarm.nextAmbientAt=1e6;
  const enemy={id:42,x:6.29,y:6,z:0,hp:100,maxHp:100,kind:0,variant:'stalker',dead:false,phase:0,attack:99,moveSpeed:0,baseMoveSpeed:0,flash:0,wounds:{arm:false,leg:false,eye:false}};
  world.course.enemies=[enemy];return{world,player,rat,enemy};
}
function advance(s,seconds,hz=120){for(let i=0;i<Math.round(seconds*hz);i++)tickVermin(s.world,1/hz);}
function hold(s){assert.equal(useVermin(s.player),true);advance(s,.4);assert.equal(s.player.verminHand.phase,'held');return s;}
function wall(s,closed=true){s.world.course.cells[6*s.world.course.w+6][1]=Number(closed);s.world.course.cells[6*s.world.course.w+7][3]=Number(closed);}

test('ambient populations are seeded, bounded, wall-aware and safely away from the opening spawn',()=>{
  for(const course of [makeCourse(),makeCourse(1,{campaign:true})]){
    const a=createVerminState(course),b=createVerminState(course);assert.deepEqual(a,b);assert(a.rats.length>0&&a.rats.length<=16);assert(a.roaches.length>0&&a.roaches.length<=48);
    for(const item of [...a.rats,...a.roaches]){assert(canStand(course,item.x,item.y,.01));assert(Math.hypot(item.x-course.playerSpawn.x,item.y-course.playerSpawn.y)>=(course.campaign?.6:1.1));}
  }
  const s=setup();for(let i=0;i<12000;i++)tickVermin(s.world,1/120);assert(canStand(s.world.course,s.rat.x,s.rat.y,.024));assert(s.rat.x>=0&&s.rat.x<=12);
});

test('rat selector requires deliberate floor aim, reachable floor state, both hands and unobstructed sight',()=>{
  const s=setup();assert.equal(nearestRat(s.player),s.rat);
  for(const patch of [{pitch:0},{z:.1},{angle:Math.PI},{mode:'ready'},{health:0}]){const old={};for(const k in patch)old[k]=s.player[k];Object.assign(s.player,patch);assert.equal(nearestRat(s.player),null);Object.assign(s.player,old);}
  s.player.playerWounds.leftArm='severed';assert.equal(useVermin(s.player),false);s.player.playerWounds.leftArm='intact';
  s.player.x=6.9;s.rat.x=7.1;s.player.y=s.rat.y=6.5;wall(s);assert.equal(nearestRat(s.player),null);wall(s,false);assert.equal(nearestRat(s.player),s.rat);
});

test('host/peer claim the same rat atomically and cannot steal or double throw it',()=>{
  const s=setup(),peer=addPeer(s.world);Object.assign(peer,{x:6,y:6,angle:0,pitch:-.7});assert.equal(peer.vermin,s.world.vermin);
  assert.equal(useVermin(s.player),true);assert.equal(useVermin(peer),false);assert.equal(s.rat.ownerId,'host');advance(s,.4);
  assert.equal(useVermin(s.player),true);assert.equal(useVermin(s.player),false);assert.equal(s.rat.state,'thrown');assert.equal(s.player.events.filter(e=>e.type==='vermin-throw').length,1);
});

test('legacy held harvest edge picks up once, protects extraction and requires a deliberate second press to throw',()=>{
  const s=setup();s.player.autoRun=true;tickPlayer(s.player,.01,{harvest:true});assert.equal(s.player.verminHand.phase,'pickup');
  for(let i=0;i<40;i++){tickPlayer(s.player,.01,{harvest:true});tickVermin(s.world,.01);}
  assert.equal(s.player.verminHand.phase,'held');assert.equal(s.rat.state,'held');assert.equal(s.player.extraction.phase,'idle');assert.equal(s.player.x,6);
  tickPlayer(s.player,.01,{harvest:false});tickPlayer(s.player,.01,{harvest:true});assert.equal(s.rat.state,'thrown');
});

test('monotonic G/X intent survives a released network packet and duplicate packets cannot retrigger',()=>{
  const s=setup();tickPlayer(s.player,.01,{harvest:false,vermin:1});assert.equal(s.player.verminHand.phase,'pickup');
  advance(s,.4);for(let i=0;i<20;i++)tickPlayer(s.player,.01,{harvest:false,vermin:1});assert.equal(s.rat.state,'held');
  tickPlayer(s.player,.01,{harvest:false,vermin:2});assert.equal(s.rat.state,'thrown');assert.equal(s.player.events.filter(e=>e.type==='vermin-throw').length,1);
});

test('guest prediction never reserves rats, advances world clocks, damages or consumes authoritative intent',()=>{
  const s=setup({peer:true});for(let i=0;i<90;i++)tickPlayer(s.player,1/120,{harvest:true,vermin:1,predictWeapons:true});
  assert.equal(s.rat.state,'floor');assert.equal(s.player.verminHand.phase,'idle');assert.equal(s.world.vermin.age,0);assert.equal(s.player._verminSequenceConsumed,undefined);
  tickPlayer(s.player,.01,{harvest:false,vermin:1});assert.equal(s.rat.state,'held');assert.equal(s.player.verminHand.phase,'pickup');
  const guest={...s.player,world:undefined,peer:s.world,verminHand:makeVerminHand()};assert.equal(useVermin(guest),false);tickVermin(guest,.05);assert.equal(s.world.vermin.age,0);
});

test('held biting grants startup grace and one HP at bounded intervals with an eight-second escape hatch',()=>{
  const s=hold(setup());advance(s,1.2);assert.equal(s.player.health,100);assert.equal(s.player.verminHand.bites,0);
  advance(s,.12);assert.equal(s.player.health,99);assert.equal(s.player.verminHand.bites,1);
  advance(s,1.4);assert.equal(s.player.health,98);assert.equal(s.player.verminHand.bites,2);
  advance(s,6);assert.equal(s.player.verminHand.phase,'idle');assert.equal(s.rat.state,'floor');assert(s.player.health>=95);assert(s.player.events.some(e=>e.type==='vermin-drop'&&e.reason==='hold-timeout'));
});

test('holding a rat suppresses firearm/melee/chest mechanisms without granting damage immunity',()=>{
  const s=hold(setup());s.enemy.hp=60;s.enemy.stagger=.3;
  assert.equal(chestFinisher(s.player),false);assert.equal(shoot(s.player),false);
  s.player.weapon=4;assert.equal(shootRifle(s.player,false,true),false);s.player.weapon=6;assert.equal(shootMelee(s.player,false,true),false);
  tickPlayer(s.player,.05,{fire:true,alt:true});assert.equal(s.player.meleeActive,false);assert.equal(s.player.rifleBurst,0);
  advance(s,1.4);assert.equal(s.player.health,99);
});

test('stuffing resolves one canonical contact and timed damage through the ordinary hit/kill callbacks',()=>{
  const s=hold(setup());s.player.pitch=0;const candidate=verminTarget(s.player);assert.equal(candidate.channel,'mouth');assert.equal(attackVermin(s.player),true);assert.equal(attackVermin(s.player),false);
  advance(s,.3);assert.equal(s.enemy.hp,100);assert.equal(s.player.verminHand.contactApplied,false);
  advance(s,.04);assert.equal(s.enemy.hp,98);assert.equal(s.rat.state,'infesting');assert.equal(s.enemy.verminInfestation.channel,'mouth');
  advance(s,.6);assert.equal(s.player.verminHand.phase,'idle');advance(s,3);
  assert(Math.abs(s.enemy.hp-94.5)<1e-8);assert.equal(s.player.events.filter(e=>e.type==='vermin-infest').length,1);assert.equal(s.enemy.hits,6);assert.equal(s.enemy.verminInfestation.remaining,0);
  assert.equal(s.enemy.wounds.arm,false);assert.equal(s.enemy.wounds.leg,false);
});

test('stuffing respects source-arm reach: 1.26m is eligible, 1.30m is not, and excessive precontact retreat cancels',()=>{
  const s=hold(setup());s.enemy.x=s.player.x+.315;assert.equal(verminTarget(s.player)?.enemyId,s.enemy.id);
  s.enemy.x=s.player.x+.325;assert.equal(verminTarget(s.player),null);assert.equal(attackVermin(s.player),false);assert.equal(s.rat.state,'held');
  s.enemy.x=s.player.x+.32;assert.equal(attackVermin(s.player),true);
  s.enemy.x=s.player.x+.355;advance(s,.35);assert.equal(s.player.verminHand.phase,'held');assert.equal(s.rat.state,'held');assert.equal(s.enemy.hp,100);assert.equal(s.enemy.verminInfestation,undefined);
});

test('the existing engine awards a rat kill once to its host peer and cannot revive a downed owner from lingering infestation',()=>{
  const s=hold(setup({peer:true}));s.enemy.hp=2.4;assert.equal(attackVermin(s.player),true);advance(s,.4);assert.equal(s.enemy.dead,false);s.player.health=0;
  advance(s,1);assert.equal(s.enemy.dead,true);assert.equal(s.player.kills,1);assert.equal(s.world.kills,1);assert.equal(s.player.health,0);
  advance(s,2);assert.equal(s.player.kills,1);assert.equal(s.world.kills,1);
});

test('stomach aim and a grabbed-player mouth counter use supported anatomy while unsupported rigs retain F',()=>{
  const s=hold(setup());assert.equal(verminTarget(s.player).channel,'stomach');
  for(const patch of [{kind:2},{boss:true},{dead:true},{hp:0},{variant:'bellwraith'}]){const old={};for(const k in patch)old[k]=s.enemy[k];Object.assign(s.enemy,patch);assert.equal(attackVermin(s.player),false);Object.assign(s.enemy,old);assert.equal(s.rat.state,'held');}
  s.player.bite={...s.player.bite,phase:'held',enemyId:s.enemy.id};s.enemy.bitePhase='held';assert.equal(verminTarget(s.player).channel,'mouth');assert.equal(attackVermin(s.player),true);assert.equal(s.player.bite.phase,'released');
});

test('wall, target death and sudden retreat cancel before stuffing contact and keep the reserved rat in hand',()=>{
  for(const scenario of ['wall','dead','retreat','turn','jump']){
    const s=hold(setup());s.player.x=6.8;s.player.y=6.5;s.enemy.x=7.12;s.enemy.y=6.5;assert.equal(attackVermin(s.player),true);
    if(scenario==='wall')wall(s);if(scenario==='dead')s.enemy.dead=true;if(scenario==='retreat')s.enemy.x=8;
    if(scenario==='turn')s.player.angle=Math.PI;if(scenario==='jump')s.player.z=.6;
    advance(s,.35);assert.equal(s.player.verminHand.phase,'held');assert.equal(s.rat.state,'held');assert.equal(s.enemy.verminInfestation,undefined);assert.equal(s.enemy.hp,100);
  }
});

test('an uncommitted floor pickup cannot pull a distant rat through a wall after a dash',()=>{
  const s=setup();assert.equal(useVermin(s.player),true);s.player.x=7;advance(s,.1);assert.equal(s.player.verminHand.phase,'idle');assert.equal(s.rat.state,'floor');assert.equal(s.rat.ownerId,null);assert(Math.abs(s.rat.x-6.2)<.02);
  const t=hold(setup());t.player.z=.5;assert.equal(attackVermin(t.player),false);assert.equal(t.rat.state,'held');
});

test('two stuffing owners cannot reserve the same target and existing committed counters are protected',()=>{
  const s=hold(setup()),peer=addPeer(s.world);Object.assign(peer,{x:6,y:6,angle:0,pitch:0});
  const rat={...s.rat,id:100001,state:'held',ownerId:'peer'};s.world.vermin.rats.push(rat);peer.verminHand={...makeVerminHand(1),phase:'held',ratId:rat.id};
  assert.equal(attackVermin(s.player),true);assert.equal(attackVermin(peer),false);advance(s,.4);assert.equal(s.enemy.hits,1);
  const t=hold(setup());const other=addPeer(t.world);other.brutal={phase:'windup',enemyId:t.enemy.id};assert.equal(attackVermin(t.player),false);
});

test('analytical thrown flight agrees across frame rates and segment sweeps never cross a closed wall',()=>{
  const positions=[];
  for(const hz of [30,60,120]){
    const s=hold(setup());s.world.course.enemies=[];s.player.pitch=.1;assert.equal(useVermin(s.player),true);advance(s,.2,hz);positions.push([s.rat.x,s.rat.y,s.rat.z]);
  }
  for(const p of positions)for(let i=0;i<3;i++)assert(Math.abs(p[i]-positions[0][i])<1e-9);
  const s=hold(setup());Object.assign(s.player,{x:6.8,y:6.5,pitch:0});Object.assign(s.enemy,{x:7.12,y:6.5});wall(s);useVermin(s.player);advance(s,.4,30);
  assert.equal(s.enemy.hp,100);assert.equal(s.enemy.verminInfestation,undefined);assert(s.rat.x<7);assert.equal(s.rat.state,'floor');assert(canStand(s.world.course,s.rat.x,s.rat.y,.024));
});

test('a thrown rat finds the first visible supported torso exactly once, lands otherwise, and remains available',()=>{
  const s=hold(setup());s.player.pitch=0;assert.equal(useVermin(s.player),true);advance(s,.2,30);assert.equal(s.rat.state,'infesting');assert.equal(s.enemy.hp,98.8);assert.equal(s.player.events.filter(e=>e.type==='vermin-infest').length,1);
  advance(s,7);assert.equal(s.rat.state,'floor');assert.equal(s.rat.ownerId,null);assert(s.enemy.hp<98.8);
  const t=hold(setup());t.world.course.enemies=[];t.player.pitch=-.6;useVermin(t.player);advance(t,1);assert.equal(t.rat.state,'floor');assert.equal(t.rat.z,.014);
});

test('distant rat landing and infestation audio events use the actual contact point rather than the owner hand',()=>{
  const s=hold(setup());s.player.pitch=0;s.enemy.x=7;useVermin(s.player);
  for(let i=0;i<120&&s.rat.state==='thrown';i++)tickVermin(s.world,.01);
  const infestation=s.player.events.find(e=>e.type==='vermin-infest');assert(infestation);assert.equal(infestation.x,s.enemy.x);assert.equal(infestation.y,s.enemy.y);assert.equal(infestation.z,s.rat.z);assert.notEqual(infestation.x,s.player.x);
  const t=hold(setup());t.world.course.enemies=[];t.player.pitch=-.6;useVermin(t.player);
  for(let i=0;i<120&&t.rat.state==='thrown';i++)tickVermin(t.world,.01);
  const landing=t.player.events.find(e=>e.type==='vermin-land');assert(landing);assert.equal(landing.x,t.rat.x);assert.equal(landing.y,t.rat.y);assert.equal(landing.z,.014);assert.notEqual(landing.x,t.player.x);
});

test('pause freezes timers, player death/arm loss drops the rat, and a course transition removes all old reservations',()=>{
  const s=hold(setup());const age=s.world.vermin.age,clock=s.player.verminHand.holdAge;s.world.mode='pause';tick(s.world,.05,{harvest:true});assert.equal(s.world.vermin.age,age);assert.equal(s.player.verminHand.holdAge,clock);
  s.world.mode='play';s.player.playerWounds.rightArm='severed';tickVermin(s.world,.01);assert.equal(s.player.verminHand.phase,'idle');assert.equal(s.rat.ownerId,null);
  s.player.playerWounds.rightArm='intact';Object.assign(s.rat,{x:6.2,y:6,state:'floor'});hold(s);s.player.health=0;tickVermin(s.world,.01);assert.equal(s.player.verminHand.phase,'idle');assert.equal(s.rat.ownerId,null);
  s.player.health=100;s.world.course=makeCourse(1,{campaign:true});tickVermin(s.world,.01);assert.notEqual(s.world.vermin.rats[0],s.rat);assert.equal(s.player.verminHand.phase,'idle');assert.equal(s.world.vermin.scent,0);
});

test('fresh canonical combat evidence raises scent once, then warning and finite cosmetic swarms respect cooldown',()=>{
  const s=setup();s.world.vermin.swarm.cooldown=0;s.world.vermin.scent=.8;tickVermin(s.world,.01);assert.equal(s.world.vermin.swarm.phase,'warning');assert.equal(s.player.verminCrawl.phase,'idle');
  advance(s,2.3);assert.equal(s.world.vermin.swarm.phase,'active');assert.equal(s.player.verminCrawl.phase,'active');assert(s.player.verminCrawl.count<=4);assert.equal(s.player.health,100);
  advance(s,5.3);assert.equal(s.world.vermin.swarm.phase,'idle');assert.equal(s.player.verminCrawl.phase,'idle');assert(s.world.vermin.swarm.cooldown>30);
  const previous=s.world.vermin.scent;s.world.kills+=4;s.enemy.hits=5;s.world.blood=[{id:88}];tickVermin(s.world,.01);assert(s.world.vermin.scent>previous+.3);const scent=s.world.vermin.scent;
  advance(s,1);assert(s.world.vermin.scent<scent);assert.equal(s.world.vermin.swarm.phase,'idle');assert.equal(s.player.health,100);
});

test('an actual rail kill burst feeds scent from canonical kills, hits and fresh blood without cosmetic-only injection',()=>{
  const s=setup();s.player.pitch=0;s.player.weapon=2;s.world.vermin.swarm.cooldown=0;
  s.world.course.enemies=Array.from({length:8},(_,i)=>({...s.enemy,id:42+i,x:6.8+i*.28,hp:5,maxHp:5,wounds:{arm:false,leg:false,eye:false}}));
  assert.equal(shoot(s.player),true);assert.equal(s.world.kills,8);assert(s.world.blood.length>0);
  tickVermin(s.world,.01);assert(s.world.vermin.scent>.58);assert.equal(s.world.vermin.swarm.phase,'warning');const before=s.world.vermin.scent;
  tickVermin(s.world,.01);assert(s.world.vermin.scent<before);assert.equal(s.world.events.filter(e=>e.type==='vermin-swarm-warning').length,1);
});

test('active rats and roaches converge on the newest visible canonical blood while calm wandering remains unchanged',()=>{
  const s=setup();Object.assign(s.rat,{x:5.5,y:6,angle:0,turn:100});
  s.world.vermin.roaches=[{id:200000,x:5.5,y:6.08,z:.004,angle:0,age:0,seed:21,speed:.04,turn:100}];
  s.world.blood=[{id:4,x:4.5,y:6},{id:9,x:6.5,y:6,age:0}];
  tickVermin(s.world,.01);assert.equal(s.world.vermin.scentTarget.kind,'blood');assert.equal(s.world.vermin.scentTarget.id,9);
  const initial=s.world.vermin.rats.concat(s.world.vermin.roaches).map(item=>Math.hypot(6.5-item.x,6-item.y));
  s.world.vermin.swarm={...s.world.vermin.swarm,phase:'active',elapsed:0,duration:VERMIN_TIMING.active};advance(s,3);
  for(const [i,item]of s.world.vermin.rats.concat(s.world.vermin.roaches).entries())assert(Math.hypot(6.5-item.x,6-item.y)<initial[i]-.15);
  const calm=setup();Object.assign(calm.rat,{x:5.5,y:6,angle:Math.PI,turn:100});calm.world.blood=[{id:9,x:6.5,y:6}];tickVermin(calm.world,.01);const x=calm.rat.x;advance(calm,1);assert(calm.rat.x<x);
});

test('scent attraction respects closed walls and capped active turning at every canonical step',()=>{
  const s=setup();Object.assign(s.rat,{x:6.91,y:6.5,angle:0,turn:100});s.world.blood=[{id:9,x:7.4,y:6.5}];wall(s);tickVermin(s.world,.01);
  s.world.vermin.swarm={...s.world.vermin.swarm,phase:'active',elapsed:0,duration:VERMIN_TIMING.active};
  for(let i=0;i<360;i++){
    const angle=s.rat.angle;tickVermin(s.world,1/120);
    const change=Math.abs(Math.atan2(Math.sin(s.rat.angle-angle),Math.cos(s.rat.angle-angle)));assert(change<=2.8/120+1e-10);assert(s.rat.x<7);assert(canStand(s.world.course,s.rat.x,s.rat.y,.024));
  }
  assert.equal(s.world.vermin.scentTarget.id,9);assert.equal(s.world.vermin.scentTarget.x,7.4);
});

test('without blood an active scavenger seeks a visible wounded survivor, then the nearest survivor',()=>{
  const s=setup(),peer=addPeer(s.world);Object.assign(s.rat,{x:5.5,y:6,angle:0,turn:100});Object.assign(s.world,{x:5,y:6});Object.assign(peer,{x:6.5,y:6,health:70});
  tickVermin(s.world,.01);assert.equal(s.world.vermin.scentTarget.kind,'player');assert.equal(s.world.vermin.scentTarget.playerId,'peer');
  s.world.vermin.swarm={...s.world.vermin.swarm,phase:'active',elapsed:0,duration:VERMIN_TIMING.active};const x=s.rat.x;advance(s,1);assert(s.rat.x>x);
  peer.health=100;s.world.x=5.5;s.rat.angle=Math.PI;tickVermin(s.world,.01);assert.equal(s.world.vermin.scentTarget.playerId,'host');const after=s.rat.x;advance(s,1);assert(s.rat.x<after);
});

test('the snapshotted scent target clamps coordinates and strips unknown source ownership or non-finite positions',()=>{
  const course=makeCourse(),state=validateVerminSnapshot({scentTarget:{kind:'blood',id:9,x:1e9,y:-1e9,age:Infinity,playerId:'intruder',unsafe:{magic:1}}},course);
  assert.equal(state.scentTarget.x,course.w-.025);assert.equal(state.scentTarget.y,.025);assert.equal(state.scentTarget.age,0);assert.equal(state.scentTarget.playerId,null);assert.equal(state.scentTarget.unsafe,undefined);
  assert.equal(validateVerminSnapshot({scentTarget:{kind:'blood',x:NaN,y:4}},course).scentTarget,null);assert.equal(validateVerminSnapshot({scentTarget:{kind:'evil',x:4,y:4}},course).scentTarget,null);
});

test('snapshot validation limits all arrays, IDs, ownership and scalar values without trusting unknown keys',()=>{
  const course=makeCourse(),state=validateVerminSnapshot({scent:10,age:Infinity,sequence:NaN,rats:Array.from({length:100},(_,i)=>({id:i,x:1e9,y:-20,z:100,state:'held',ownerId:'intruder',speed:10})),roaches:Array.from({length:100},(_,i)=>({id:2000+i,x:5,y:5})),swarm:{phase:'evil',elapsed:Infinity},unsafe:{magic:1}},course);
  assert.equal(state.rats.length,16);assert.equal(state.roaches.length,48);assert.equal(state.scent,1);assert.equal(state.swarm.phase,'idle');assert.equal(state.unsafe,undefined);
  for(const r of state.rats){assert.equal(r.ownerId,null);assert(r.x<12&&r.y>=.025&&r.z<=1.5&&r.speed<=.12);}
  assert.equal(validateVerminSnapshot({rats:[{id:1,state:'floor'},{id:1,state:'floor'},{id:2,state:'bad'}]},course).rats.length,1);
  assert.equal(validateVerminHand({phase:'stuff',elapsed:Infinity,channel:'evil',ratId:'1',sequence:10}).ratId,null);
  assert.equal(validateVerminCrawl({phase:'active',kind:'rat',count:500}).count,1);assert.equal(validateVerminCrawl({phase:'active',kind:'roach',count:500}).count,4);
});

test('stuffing damage, contact count and holding health agree at 30/60/120 Hz with gore preferences',()=>{
  const result=[];
  for(const hz of [30,60,120])for(const gore of [true,false]){
    const s=setup();s.player.settings={gore};useVermin(s.player);advance(s,.4,hz);advance(s,2,hz);const health=s.player.health;
    attackVermin(s.player);advance(s,4,hz);result.push({health,hp:Math.round(s.enemy.hp*10)/10,infest:s.player.events.filter(e=>e.type==='vermin-infest').length,hits:s.enemy.hits,phase:s.player.verminHand.phase});
  }
  for(const item of result)assert.deepEqual(item,result[0]);assert.equal(result[0].infest,1);
});
