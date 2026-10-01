import test from 'node:test';
import assert from 'node:assert/strict';
import {
 makeCourse,newRun,tick,tickPlayer,parry,shoot,shootRifle,shootMelee,addPeer,
 brutalCandidate,chestCandidate,chestFinisher,BRUTAL_TIMING,
} from '../engine.js';
import {createMind} from '../enemy-ai.js';
import {ENEMY_PROFILES} from '../campaign.js';

function setup({hp=100,maxHp=hp,id=42,kind=0,variant='stalker',peer=false}={}){
 const run=newRun(makeCourse());Object.assign(run,{mode:'play',x:6,y:6,angle:0,wave:3,waveDelay:999});
 const player=peer?addPeer(run):run;Object.assign(player,{x:6,y:6,angle:0});
 if(peer)run.x=9;
 const enemy={id,x:6.25,y:6,z:0,hp,maxHp,kind,variant,dead:false,flash:0,phase:0,
  attack:99,moveSpeed:.3,baseMoveSpeed:.3,wounds:{arm:false,leg:false,eye:false}};
 run.course.enemies=[enemy];
 return{run,player,enemy,events:[]};
}
function collect(s){
 s.events.push(...s.player.events.map(event=>({...event})));
 s.run.events=[];if(s.player!==s.run)s.player.events=[];
}
function press(s){const result=parry(s.player);collect(s);return result;}
function advance(s,seconds,input={},hz=120){
 for(let i=0;i<Math.round(seconds*hz);i++){
  if(s.player!==s.run)tickPlayer(s.player,1/hz,input);
  tick(s.run,1/hz,s.player===s.run?input:{});collect(s);
 }
}
function heldSetup(options={}){
 const s=setup({...options,id:2});s.enemy.x=6.24;s.enemy.attack=0;
 s.enemy.contactDamage=12;s.enemy.biteAttackCount=0;
 createMind(s.enemy,{state:'stalk',firstAttack:0});s.enemy.mind.token=true;
 advance(s,.7);assert.equal(s.player.bite.phase,'held');return s;
}
function chestSetup(options={}){
 const s=setup({hp:60,maxHp:100,...options});s.enemy.stagger=.3;return s;
}
function pierce(s){const result=chestFinisher(s.player);collect(s);return result;}
function chestWall(s,closed){
 s.player.x=6.88;s.player.y=s.enemy.y=6.5;s.enemy.x=7.12;
 s.run.course.cells[6*s.run.course.w+6][1]=Number(closed);s.run.course.cells[6*s.run.course.w+7][3]=Number(closed);
}
function naturalChestSetup({weapon=0,hp=5,variant='stalker',peer=false}={}){
 const s=setup({hp,maxHp:hp,variant,peer}),profile=ENEMY_PROFILES[variant];
 Object.assign(s.enemy,{moveSpeed:profile.speed,baseMoveSpeed:profile.speed,role:profile.role,attackCooldown:profile.attack,windupTime:profile.windup});
 Object.assign(s.player,{weapon,pitch:Math.atan2(-.1,.25)});
 createMind(s.enemy,{state:'stalk',firstAttack:99,emerge:0,spawnAnim:'none',facing:Math.PI});
 return s;
}

test('readiness is pure and F selects a close chop while preserving the ordinary punch reach',()=>{
 const s=setup(),before=JSON.stringify(s.player);
 const candidate=brutalCandidate(s.player);assert.deepEqual(candidate,{enemyId:42,kind:'chop',side:'left'});
 assert.equal(JSON.stringify(s.player),before);
 s.enemy.x=6.4;assert.equal(brutalCandidate(s.player),null);
 assert.equal(press(s),true);assert.equal(s.enemy.hp,97);assert.equal(s.player.brutal.phase,'idle');
 assert.equal(s.events.filter(e=>e.type==='punch').length,1);
});

test('chop has a committed windup, one contact, exact arm damage and a bounded recovery',()=>{
 const s=setup();assert.equal(press(s),true);
 assert.equal(s.enemy.hp,100);assert.equal(s.player.energy,90);assert.equal(s.player.brutal.phase,'windup');
 assert.equal(s.player.brutal.contactAt,BRUTAL_TIMING.chop.contactAt);
 assert.equal(s.player.brutal.duration,.65);assert.equal(s.events.some(e=>e.type==='punch'),false);
 advance(s,.17);assert.equal(s.enemy.hp,100);assert.equal(s.player.brutal.contactApplied,false);
 advance(s,.02);assert.equal(s.enemy.hp,92);assert.equal(s.player.brutal.phase,'contact');
 assert.equal(s.player.brutal.contactApplied,true);assert.ok(s.player.brutal.elapsed>=.18);
 assert.equal(s.enemy.wounds.arm,true);assert.equal(s.enemy.wounds.leg,false);assert.equal(s.enemy.wounds.eye,false);
 assert.equal(s.enemy.wounds.armSide,'left');assert.equal(s.enemy.moveSpeed,.3*.92);
 assert.deepEqual(s.enemy.brutalWound,{sequence:1,type:'chop',side:'left',region:'arm',playerId:'host',at:s.player.time});
 assert.equal(s.run.limbs.length,0,'the exact contact does not randomly remove extra anatomy');
 advance(s,.07);assert.equal(s.player.brutal.phase,'recover');assert.ok(s.player.brutal.elapsed>=.25-1e-8);
 advance(s,.45);assert.equal(s.player.brutal.phase,'idle');assert.equal(s.player.brutal.sequence,1);
 assert.equal(s.enemy.hp,92);assert.equal(s.events.filter(e=>e.type==='brutal-contact').length,1);
 assert.equal(s.events.filter(e=>e.type==='brutal-complete').length,1);
 assert.equal(s.events.find(e=>e.type==='brutal-contact').wound.type,'chop');
});

test('F cannot stack counter damage during recovery or repeatedly counter an already wounded enemy',()=>{
 const s=setup();press(s);assert.equal(press(s),false);
 advance(s,.46);assert.equal(s.enemy.hp,92);assert.equal(press(s),true);
 assert.equal(s.enemy.hp,92);assert.equal(s.player.brutal.sequence,1);
 advance(s,.46);assert.equal(s.player.brutal.phase,'idle');assert.equal(brutalCandidate(s.player),null);
 const wound={...s.enemy.brutalWound};assert.equal(press(s),true);assert.equal(s.enemy.hp,89);
 assert.equal(s.player.brutal.sequence,1);assert.deepEqual(s.enemy.brutalWound,wound);
 assert.equal(s.events.filter(e=>e.type==='brutal-start').length,1);
});

test('a weakened staggered target selects a neck twist and receives no unrelated kill wounds',()=>{
 const s=setup({hp:10,maxHp:30});s.enemy.stagger=.35;
 assert.equal(brutalCandidate(s.player).kind,'twist');press(s);assert.equal(s.enemy.hp,10);
 advance(s,.25);assert.equal(s.enemy.dead,true);assert.equal(s.player.kills,1);
 assert.equal(s.enemy.brutalWound.type,'twist');assert.equal(s.enemy.brutalWound.region,'neck');
 assert.equal(s.enemy.neckBroken,true);assert.equal(s.enemy.wounds.neck,true);
 assert.equal(s.enemy.wounds.arm,false);assert.equal(s.enemy.wounds.leg,false);assert.equal(s.run.limbs.length,0);
 assert.ok(s.run.gore.length>0);assert.ok(s.run.gore.every(p=>!p.chunk),'brutal kills use fluid droplets rather than primitive anatomy chunks');
 advance(s,.1);assert.equal(s.player.brutal.phase,'recover');assert.equal(s.player.brutal.duration,.9);
 advance(s,.6);assert.equal(s.player.brutal.phase,'idle');
 assert.equal(s.events.filter(e=>e.type==='brutal-contact').length,1);
});

test('healthy or unstaggered targets cannot receive an automatic neck execution',()=>{
 for(const [hp,maxHp,stagger] of [[100,100,1],[10,30,0],[13,100,1]]){
  const s=setup({hp,maxHp});s.enemy.stagger=stagger;
  assert.equal(brutalCandidate(s.player).kind,'chop');press(s);assert.equal(s.player.brutal.kind,'chop');
 }
});

test('second F escapes immediately and commits an optional gut rip without exposing a bite damage frame',()=>{
 const s=heldSetup();const side=s.player.bite.side;
 assert.equal(brutalCandidate(s.player),null);assert.equal(press(s),true);
 assert.equal(s.player.bite.escape,.65);assert.equal(s.player.energy,100);assert.equal(s.player.brutal.phase,'idle');
 assert.equal(press(s),false);advance(s,.46);
 assert.deepEqual(brutalCandidate(s.player),{enemyId:2,kind:'rip',side});assert.equal(press(s),true);
 assert.equal(s.player.bite.phase,'released');assert.equal(s.player.health,100);assert.equal(s.enemy.hp,100);
 assert.equal(s.player.brutal.kind,'rip');assert.equal(s.player.brutal.duration,1);
 advance(s,.24);assert.equal(s.enemy.hp,88);assert.equal(s.player.health,100);
 assert.equal(s.enemy.brutalWound.region,'torso');assert.equal(s.enemy.eviscerated,true);
 assert.equal(s.enemy.wounds.arm,false);assert.equal(s.enemy.wounds.leg,false);
 assert.equal(s.events.filter(e=>e.type==='bite-damage').length,0);
 assert.equal(s.events.filter(e=>e.type==='punch').length,1,'only the first free escape press uses ordinary punch audio');
 assert.equal(s.events.filter(e=>e.type==='brutal-contact').length,1);
});

test('insufficient energy never blocks two-F escape or charges the first escape press',()=>{
 const s=heldSetup();s.player.energy=0;press(s);
 assert.equal(s.player.energy,0);assert.equal(s.player.bite.escape,.65);
 advance(s,.46);s.player.energy=0;assert.equal(brutalCandidate(s.player),null);press(s);
 assert.equal(s.player.bite.phase,'released');assert.equal(s.player.energy,0);assert.equal(s.player.health,100);
 assert.equal(s.player.brutal.phase,'idle');assert.equal(s.enemy.hp,100);
 assert.equal(s.events.some(e=>e.type==='brutal-start'),false);
});

test('partial movement escape uses the same contextual rip readiness as F',()=>{
 const s=heldSetup();s.player.bite.escape=.35;
 assert.equal(brutalCandidate(s.player).kind,'rip');press(s);
 assert.equal(s.player.bite.phase,'released');assert.equal(s.player.brutal.kind,'rip');
});

test('unsupported caster rigs, brutes, anchors and bosses retain the ordinary punch',()=>{
 for(const patch of [{kind:1,variant:'caster'},{kind:2,variant:'brute'},{kind:2,variant:'colossus'},{kind:0,variant:'warden'},{boss:true},{isBoss:true}]){
  const s=setup({hp:10,maxHp:30});Object.assign(s.enemy,patch,{stagger:1});
  assert.equal(brutalCandidate(s.player),null);press(s);
  assert.equal(s.enemy.hp,7);assert.equal(s.player.brutal.phase,'idle');assert.equal(s.enemy.brutalWound,undefined);
  assert.equal(s.player.energy,100);
 }
});

test('a severed player arm disables anatomical counters while preserving ordinary F and bite escape',()=>{
 for(const limb of ['leftArm','rightArm']){
  const normal=setup();normal.player.playerWounds[limb]='severed';
  assert.equal(brutalCandidate(normal.player),null);press(normal);
  assert.equal(normal.enemy.hp,97);assert.equal(normal.player.brutal.phase,'idle');
  const held=heldSetup();held.player.playerWounds[limb]='severed';press(held);advance(held,.46);
  assert.equal(brutalCandidate(held.player),null);press(held);
  assert.equal(held.player.bite.phase,'released');assert.equal(held.player.brutal.phase,'idle');
  assert.equal(held.player.playerWounds[limb],'severed');assert.equal(held.player.health,100);
 }
});

test('range, aim, wall, missing target and death cancel before contact with no wound or damage',()=>{
 const cases={range:s=>{s.player.x=5.8;},aim:s=>{s.player.angle=Math.PI;},
  targetDead:s=>{s.enemy.dead=true;},targetRemoved:s=>{s.run.course.enemies=[];},
  playerDead:s=>{s.player.health=0;},inactive:s=>{s.run.mode='pause';},
  wall:s=>{s.run.course.cells[6*s.run.course.w+6][1]=1;s.run.course.cells[6*s.run.course.w+7][3]=1;}};
 for(const [name,mutate] of Object.entries(cases)){
  const s=setup();if(name==='wall'){
   s.player.x=6.88;s.player.y=s.enemy.y=6.5;s.enemy.x=7.12;
   s.run.course.cells[6*s.run.course.w+6][1]=0;s.run.course.cells[6*s.run.course.w+7][3]=0;
  }
  assert.equal(press(s),true,name);assert.equal(s.player.brutal.phase,'windup',name);
  advance(s,.1);mutate(s);advance(s,.15);
  assert.equal(s.player.brutal.phase,'idle',name);assert.equal(s.enemy.hp,100,name);
  assert.equal(s.enemy.brutalWound,undefined,name);assert.equal(s.player.brutal.sequence,1,name);
  assert.equal(s.events.some(e=>e.type==='brutal-contact'),false,name);
  assert.equal(s.events.filter(e=>e.type==='brutal-cancel').length,1,name);
 }
});

test('the strike tolerates a small retreat but cannot start outside actual hand reach',()=>{
 const s=setup();press(s);s.enemy.x=6.30;advance(s,.2);assert.equal(s.enemy.hp,92);
 const far=setup();far.enemy.x=6.30;assert.equal(brutalCandidate(far.player),null);press(far);
 assert.equal(far.enemy.hp,97);assert.equal(far.enemy.brutalWound,undefined);
});

test('the committed windup grants no invulnerability and a fatal incoming hit cancels it immediately',()=>{
 const s=setup();s.player.health=5;press(s);
 s.run.projectiles.push({id:91,x:5.9,y:6,z:.3,vx:0,vy:0,vz:0,life:3,reflected:false});
 advance(s,1/120);assert.equal(s.player.health,0);assert.equal(s.player.brutal.phase,'idle');
 assert.equal(s.player.brutal.cancelReason,'player-down');assert.equal(s.enemy.hp,100);
 assert.equal(s.events.filter(e=>e.type==='brutal-contact').length,0);
});

test('losing a required arm during a windup cancels its contact without regenerating anatomy',()=>{
 const s=setup();press(s);s.player.playerWounds.leftArm='severed';advance(s,.2);
 assert.equal(s.player.brutal.phase,'idle');assert.equal(s.player.brutal.cancelReason,'arm-unavailable');
 assert.equal(s.enemy.hp,100);assert.equal(s.enemy.brutalWound,undefined);assert.equal(s.player.playerWounds.leftArm,'severed');
});

test('a counter cancels corpse extraction and prevents harvest progress until its hand action ends',()=>{
 const s=setup({hp:5});s.run.course.enemies.push({...s.enemy,id:43,x:6.2,hp:0,dead:true});
 tickPlayer(s.player,1/120,{harvest:true});assert.equal(s.player.extraction.phase,'draw');collect(s);
 press(s);assert.equal(s.player.extraction.phase,'idle');assert.equal(s.player.extraction.cancelReason,'counter');
 advance(s,.3,{harvest:true});assert.equal(s.player.extraction.phase,'idle');assert.equal(s.player.extractions,0);
 assert.equal(s.events.filter(e=>e.type==='extract-cancel'&&e.reason==='counter').length,1);
});

test('projectile reflection remains available while counter recovery suppresses repeated melee damage',()=>{
 const s=setup();press(s);advance(s,.46);
 s.run.projectiles.push({id:90,x:6.2,y:6,z:.9,vx:-1,vy:0,vz:0,life:3,reflected:false});
 assert.equal(press(s),true);advance(s,1/120);
 assert.equal(s.run.projectiles[0].reflected,true);assert.equal(s.enemy.hp,92);
 assert.equal(s.events.filter(e=>e.type==='brutal-contact').length,1);
});

test('a committed counter cancels existing weapon mechanisms and rejects ordinary and predicted firing',()=>{
 const s=setup();s.player.rifleBurst=2;s.player.rifleBurstTimer=.001;s.player.rifleCharging=true;s.player.rifleCharge=.99;
 s.player.meleeActive=true;s.player.sawActive=true;press(s);
 assert.equal(s.player.rifleBurst,0);assert.equal(s.player.rifleCharging,false);assert.equal(s.player.meleeActive,false);
 for(const weapon of [0,4,5,6,7]){
  s.player.weapon=weapon;assert.equal(shoot(s.player),false);
  if(weapon===4||weapon===5)assert.equal(shootRifle(s.player,true,true),false);
  if(weapon>=6)assert.equal(shootMelee(s.player,true,true),false);
 }
 s.player.weapon=7;advance(s,.4,{fire:true});assert.equal(s.enemy.hp,92);assert.equal(s.player.sawActive,false);
 assert.equal(s.events.some(e=>['shot','rifle-charge','bat-swing','chainsaw-hit'].includes(e.type)),false);
});

test('prediction cannot advance a peer counter; authoritative world tick applies its contact exactly once',()=>{
 const s=setup({peer:true});press(s);const before=JSON.stringify(s.player.brutal);
 for(let i=0;i<120;i++)tickPlayer(s.player,1/120,{predictWeapons:true});
 assert.equal(JSON.stringify(s.player.brutal),before);assert.equal(s.enemy.hp,100);assert.equal(s.enemy.brutalWound,undefined);
 advance(s,.3);assert.equal(s.enemy.hp,92);assert.equal(s.enemy.brutalWound.playerId,'peer');
 const contacts=s.events.filter(e=>e.type==='brutal-contact');assert.equal(contacts.length,1);assert.equal(contacts[0].playerId,'peer');
 advance(s,.4);assert.equal(s.enemy.hp,92);assert.equal(s.player.brutal.phase,'idle');
});

test('two players cannot reserve two counter contacts on the same target',()=>{
 const s=setup(),peer=addPeer(s.run);Object.assign(peer,{x:6,y:6,angle:0});
 press(s);assert.equal(brutalCandidate(peer),null);assert.equal(parry(peer),true);
 assert.equal(peer.brutal.phase,'idle');assert.equal(s.enemy.hp,97);
 advance(s,.3);assert.equal(s.enemy.hp,89);assert.equal(s.enemy.brutalWound.playerId,'host');
 assert.equal(s.events.filter(e=>e.type==='brutal-contact').length,1);
});

test('cancelling recovery retains the applied wound and the next target uses a new global sequence',()=>{
 const s=setup();press(s);advance(s,.3);const wound={...s.enemy.brutalWound};s.player.x=5;
 advance(s,.01);assert.equal(s.player.brutal.phase,'idle');assert.deepEqual(s.enemy.brutalWound,wound);
 s.player.x=6;s.player.parryCooldown=0;s.run.course.enemies=[{...s.enemy,id:43,hp:100,brutalWound:undefined,wounds:{arm:false,leg:false,eye:false}}];
 press(s);assert.equal(s.player.brutal.sequence,2);assert.equal(s.player.brutal.enemyId,43);
});

test('co-op revival resets the active action but preserves its global sequence',()=>{
 const s=setup(),peer=addPeer(s.run);Object.assign(peer,{x:9,y:6});press(s);s.player.health=0;
 advance(s,3.2);assert.equal(s.player.health,65);assert.equal(s.player.brutal.phase,'idle');assert.equal(s.player.brutal.sequence,1);
 Object.assign(s.player,{x:6,y:6,angle:0,parryCooldown:0});Object.assign(s.enemy,{x:6.25,y:6,attack:99});
 assert.equal(press(s),true);assert.equal(s.player.brutal.sequence,2);
});

test('gore preference cannot change counter anatomy, generic kill wounds or movement penalties',()=>{
 const results=[];
 for(const gore of [true,false]){
  const counter=setup();counter.player.settings={gore};press(counter);advance(counter,.2);
  const ordinary=setup({hp:2});ordinary.player.settings={gore};shoot(ordinary.player);
  results.push({counterWounds:counter.enemy.wounds,counterSpeed:counter.enemy.moveSpeed,wound:counter.enemy.brutalWound,
   genericWounds:ordinary.enemy.wounds,genericSpeed:ordinary.enemy.moveSpeed});
 }
 assert.deepEqual(results[0],results[1]);assert.equal(results[1].genericWounds.arm,false);assert.equal(results[1].genericWounds.leg,false);
});

test('contact outcome and event count agree at 30, 60 and 120Hz',()=>{
 const results=[];
 for(const hz of [30,60,120]){
  const s=setup();press(s);advance(s,1,{},hz);
  results.push({hp:s.enemy.hp,phase:s.player.brutal.phase,sequence:s.player.brutal.sequence,
   wound:{...s.enemy.brutalWound,at:0},contacts:s.events.filter(e=>e.type==='brutal-contact').length});
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);assert.equal(results[0].contacts,1);
});

test('chest readiness is pure and requires an injured, staggered, supported target and both arms',()=>{
 const s=chestSetup(),before=JSON.stringify(s.player);
 assert.deepEqual(chestCandidate(s.player),{enemyId:42,kind:'pierce',side:'right'});assert.equal(JSON.stringify(s.player),before);
 for(const [name,change] of [
  ['healthy',s=>s.enemy.hp=66],['not staggered',s=>s.enemy.stagger=.17],['energy',s=>s.player.energy=14],
  ['left arm',s=>s.player.playerWounds.leftArm='severed'],['right arm',s=>s.player.playerWounds.rightArm='severed'],
  ['unsupported',s=>s.enemy.kind=2],['boss',s=>s.enemy.boss=true],['previous wound',s=>s.enemy.brutalWound={type:'chop'}],
  ['range',s=>s.enemy.x=6.28],['aim',s=>s.player.angle=Math.PI],['height',s=>s.player.z=.25],
  ['held bite',s=>s.player.bite.phase='held'],['windup bite',s=>s.player.bite.phase='windup'],['down',s=>s.player.health=0],
  ['inactive',s=>s.player.mode='pause'],['wall',s=>chestWall(s,true)],
 ]){
  const invalid=chestSetup();change(invalid);
  assert.equal(chestCandidate(invalid.player),null,name);assert.equal(pierce(invalid),false,name);
  assert.equal(invalid.player.energy,name==='energy'?14:100,name);assert.equal(invalid.enemy.brutalWound?.type==='pierce',false,name);
 }
});

test('ordinary body shots leave a usable chest opening after the natural AI stagger ends',()=>{
 for(const [weapon,hp,variant,secondAt] of [[0,5,'stalker',0],[4,5,'stalker',.12],[4,8,'bloodhound',.12],[0,8,'bloodhound',.23]]){
  const s=naturalChestSetup({weapon,hp,variant});assert.equal(shoot(s.player),true);collect(s);
  assert.equal(s.enemy.chestOpeningUntil,.45);assert.ok(s.enemy.stagger<=.2);
  if(secondAt){advance(s,secondAt);assert.equal(shoot(s.player),true);collect(s);assert.equal(s.enemy.chestOpeningUntil,.45);}
  assert.ok(Math.abs(s.enemy.hp-(hp-(secondAt?2:1)*(weapon===4?1.45:2)))<1e-9,'ordinary shot damage is unchanged');
  advance(s,.32-s.run.time);
  assert.equal(s.enemy.stagger,0);assert.ok(s.enemy.hp>0&&s.enemy.hp<=s.enemy.maxHp*.65);
  assert.equal(brutalCandidate(s.player)?.kind,'chop','F does not inherit the chest opening');
  assert.equal(chestCandidate(s.player)?.kind,'pierce',`${variant} ${hp} HP weapon ${weapon}`);
  assert.equal(pierce(s),true);
 }
});

test('the chest opening expires after 450ms and AI grace hits never refresh it',()=>{
 const s=naturalChestSetup({weapon:4,hp:11,variant:'bloodhound'});
 assert.equal(shoot(s.player),true);collect(s);const opening=s.enemy.chestOpeningUntil,stun=s.enemy.stagger;
 assert.equal(opening,.45);assert.equal(stun,.1725);
 for(let i=0;i<2;i++){
  advance(s,.12);const grace=s.enemy.mind.graceT,stagger=s.enemy.stagger;
  assert.ok(grace>0);assert.equal(shoot(s.player),true);collect(s);
  assert.equal(s.enemy.chestOpeningUntil,opening);assert.equal(s.enemy.mind.graceT,grace);assert.equal(s.enemy.stagger,stagger);
 }
 assert.equal(chestCandidate(s.player)?.kind,'pierce');
 advance(s,.46-s.run.time);assert.equal(chestCandidate(s.player),null);assert.equal(s.enemy.chestOpeningUntil,opening);
 advance(s,1);
 assert.equal(s.enemy.mind.graceT,0);
 const distance=Math.hypot(s.enemy.x-s.player.x,s.enemy.y-s.player.y);
 s.player.angle=Math.atan2(s.enemy.y-s.player.y,s.enemy.x-s.player.x);s.player.pitch=Math.atan2(-.1,distance);
 assert.equal(shoot(s.player),true);collect(s);
 assert.ok(s.enemy.hp>0);assert.ok(s.enemy.stagger>0);assert.equal(s.enemy.chestOpeningUntil,s.run.time+.45);
 assert.ok(s.enemy.chestOpeningUntil>opening);
});

test('suppressed, emerging, predicted and lethal hits cannot invent a chest opening',()=>{
 for(const [name,change] of [['AI grace',s=>s.enemy.mind.graceT=1],['emerging',s=>s.enemy.mind.emerge=1],['lethal',s=>s.enemy.hp=1]]){
  const s=naturalChestSetup();change(s);assert.equal(shoot(s.player),true,name);
  assert.equal(s.enemy.chestOpeningUntil,undefined,name);assert.equal(chestCandidate(s.player),null,name);
 }
 const predicted=naturalChestSetup({weapon:4});assert.equal(shootRifle(predicted.player,false,true),true);
 assert.equal(predicted.enemy.hp,5);assert.equal(predicted.enemy.chestOpeningUntil,undefined);
 const healthy=naturalChestSetup({hp:10});assert.equal(shoot(healthy.player),true);advance(healthy,.3);
 assert.ok(healthy.enemy.chestOpeningUntil>healthy.run.time);assert.equal(chestCandidate(healthy.player),null,'the opening still requires a wounded target');
 for(const [name,change] of [['range',s=>s.enemy.x=7],['wall',s=>chestWall(s,true)],['arm',s=>s.player.playerWounds.leftArm='severed'],['boss',s=>s.enemy.boss=true],['reserved',s=>{const peer=addPeer(s.run);peer.brutal={phase:'windup',enemyId:s.enemy.id};}]]){
  const s=naturalChestSetup();assert.equal(shoot(s.player),true);advance(s,.3);change(s);
  assert.equal(chestCandidate(s.player),null,name);assert.equal(pierce(s),false,name);
 }
});

test('chest openings use authoritative world time for host peers and equivalent guest snapshots',()=>{
 const s=naturalChestSetup({peer:true});s.run.time=3;s.player.time=30;
 assert.equal(shoot(s.player),true);collect(s);assert.equal(s.enemy.chestOpeningUntil,3.45);
 advance(s,.3);assert.ok(s.player.time>30);assert.equal(s.enemy.stagger,0);
 assert.equal(chestCandidate(s.player)?.kind,'pierce');
 const guest={...s.player,peer:{time:s.run.time,playerId:'host'},course:{...s.run.course,enemies:JSON.parse(JSON.stringify(s.run.course.enemies))}};delete guest.world;
 assert.ok(guest.time>30,'the guest snapshot retains its separate movement clock');
 const before=JSON.stringify(guest);assert.deepEqual(chestCandidate(guest),chestCandidate(s.player));assert.equal(JSON.stringify(guest),before);
 s.run.time=3.45;guest.peer.time=3.45;
 assert.equal(chestCandidate(s.player),null);assert.equal(chestCandidate(guest),null);
});

test('chest finisher kills at contact, removes one heart at extraction, releases once and completes recovery',()=>{
 const s=chestSetup();assert.equal(pierce(s),true);assert.equal(s.player.energy,85);
 assert.equal(s.player.brutal.kind,'pierce');assert.equal(s.player.brutal.contactAt,.24);assert.equal(s.player.brutal.extractionAt,.68);assert.equal(s.player.brutal.releaseAt,.95);
 assert.equal(pierce(s),false);advance(s,.23);assert.equal(s.enemy.hp,60);assert.equal(s.enemy.brutalWound,undefined);
 advance(s,.02);assert.equal(s.enemy.hp,0);assert.equal(s.enemy.dead,true);assert.equal(s.player.brutal.phase,'contact');assert.equal(s.enemy.heartRemoved,undefined);
 assert.equal(s.enemy.chestPierced,true);assert.equal(s.enemy.brutalWound.region,'chest');assert.equal(s.enemy.eviscerated,undefined);
 const hit=s.events.find(e=>e.type==='brutal-contact');assert.equal(hit.damage,60);assert.equal(hit.lethal,true);assert.equal(hit.extractionAt,.68);assert.equal(hit.releaseAt,.95);
 advance(s,.42);assert.equal(s.enemy.heartRemoved,undefined);advance(s,.02);
 assert.equal(s.player.brutal.phase,'extract');assert.equal(s.enemy.heartRemoved,true);assert.equal(s.enemy.brutalWound.heartRemoved,true);
 advance(s,.28);assert.equal(s.player.brutal.phase,'recover');assert.equal(s.player.brutal.releaseApplied,true);
 advance(s,.55);assert.equal(s.player.brutal.phase,'idle');assert.equal(s.player.brutal.sequence,1);
 for(const type of ['brutal-start','brutal-contact','brutal-extract','brutal-release','brutal-recover','brutal-complete'])assert.equal(s.events.filter(e=>e.type===type).length,1,type);
 assert.equal(s.events.find(e=>e.type==='brutal-extract').heartRemoved,true);
 tickPlayer(s.player,1/120,{harvest:true});assert.equal(s.player.extractCandidateId,null);assert.equal(s.player.extraction.phase,'idle','the same corpse cannot yield a second heart');
});

test('interrupted chest windups cannot apply wounds, kill damage or heart removal',()=>{
 for(const [name,change] of [
  ['range',s=>s.enemy.x=7],['aim',s=>s.player.angle=Math.PI],['wall',s=>chestWall(s,true)],
  ['arm lost',s=>s.player.playerWounds.rightArm='severed'],['down',s=>s.player.health=0],
  ['target removed',s=>s.run.course.enemies=[]],['another kill',s=>{s.enemy.dead=true;s.enemy.hp=0;}],
 ]){
  const s=chestSetup();if(name==='wall')chestWall(s,false);pierce(s);advance(s,.1);change(s);advance(s,.25);
  assert.equal(s.player.brutal.phase,'idle',name);assert.equal(s.enemy.brutalWound,undefined,name);assert.equal(s.enemy.heartRemoved,undefined,name);
  assert.equal(s.events.filter(e=>e.type==='brutal-cancel').length,1,name);
  assert.equal(s.events.some(e=>['brutal-contact','brutal-extract','brutal-release'].includes(e.type)),false,name);
 }
});

test('postcontact pierce tolerates dead targets and movement, but arm loss or removal cancels remaining phases',()=>{
 const moving=chestSetup();pierce(moving);advance(moving,.25);moving.player.x=5;moving.player.angle=Math.PI;
 advance(moving,1.3);assert.equal(moving.player.brutal.phase,'idle');assert.equal(moving.enemy.heartRemoved,true);
 assert.equal(moving.events.filter(e=>e.type==='brutal-complete').length,1);
 for(const [name,change] of [['arm lost',s=>s.player.playerWounds.leftArm='severed'],['down',s=>s.player.health=0],['target removed',s=>s.run.course.enemies=[]]]){
  const s=chestSetup();pierce(s);advance(s,.25);const wound={...s.enemy.brutalWound};change(s);advance(s,.5);
  assert.equal(s.player.brutal.phase,'idle',name);assert.deepEqual(s.enemy.brutalWound,wound,name);assert.equal(s.enemy.heartRemoved,undefined,name);
  assert.equal(s.events.filter(e=>e.type==='brutal-contact').length,1,name);assert.equal(s.events.some(e=>e.type==='brutal-extract'),false,name);
 }
});

test('peer chest prediction cannot apply phases or damage and both players cannot reserve one target',()=>{
 const s=chestSetup({peer:true});pierce(s);const before=JSON.stringify(s.player.brutal);
 for(let i=0;i<120;i++)tickPlayer(s.player,1/120,{predictWeapons:true});
 assert.equal(JSON.stringify(s.player.brutal),before);assert.equal(s.enemy.hp,60);assert.equal(s.enemy.brutalWound,undefined);
 Object.assign(s.run,{x:6,y:6,angle:0});assert.equal(chestCandidate(s.run),null);assert.equal(chestFinisher(s.run),false);assert.equal(s.run.energy,100);
 advance(s,1.55);assert.equal(s.enemy.dead,true);assert.equal(s.enemy.brutalWound.playerId,'peer');assert.equal(s.enemy.heartRemoved,true);
 assert.equal(s.events.filter(e=>e.type==='brutal-contact').length,1);assert.equal(s.events.filter(e=>e.type==='brutal-extract').length,1);
});

test('chest sequence clears delayed weapon motion, suppresses held fire and cancels existing harvest',()=>{
 const s=chestSetup();s.run.course.enemies.push({...s.enemy,id:43,x:6.2,hp:0,dead:true});
 tickPlayer(s.player,1/120,{harvest:true});collect(s);assert.equal(s.player.extraction.phase,'draw');
 s.player.rifleBurst=2;s.player.rifleBurstTimer=.001;s.player.rifleCharging=true;s.player.rifleCharge=.99;s.player.meleeActive=true;s.player.sawActive=true;
 assert.equal(pierce(s),true);assert.equal(s.player.extraction.phase,'idle');assert.equal(s.player.rifleBurst,0);assert.equal(s.player.rifleCharging,false);assert.equal(s.player.meleeActive,false);
 for(const weapon of [0,4,5,6,7]){s.player.weapon=weapon;assert.equal(shoot(s.player),false);if(weapon===4||weapon===5)assert.equal(shootRifle(s.player,true,true),false);if(weapon>=6)assert.equal(shootMelee(s.player,true,true),false);}
 advance(s,1,{fire:true,harvest:true});assert.equal(s.player.extraction.phase,'idle');assert.equal(s.player.extractions,0);
 assert.equal(s.events.some(e=>['shot','rifle-charge','bat-swing','chainsaw-hit'].includes(e.type)),false);
});

test('all chest phase counts and anatomy agree at 30, 60 and 120Hz with gore on or off',()=>{
 const outcomes=[];
 for(const hz of [30,60,120])for(const gore of [true,false]){
  const s=chestSetup();s.player.settings={gore};pierce(s);advance(s,1.6,{},hz);
  outcomes.push({hp:s.enemy.hp,dead:s.enemy.dead,heart:s.enemy.heartRemoved,phase:s.player.brutal.phase,
   wound:{...s.enemy.brutalWound,at:0},events:s.events.filter(e=>e.type.startsWith('brutal-')).map(e=>e.type)});
 }
 for(const outcome of outcomes)assert.deepEqual(outcome,outcomes[0]);assert.equal(outcomes[0].heart,true);
});
