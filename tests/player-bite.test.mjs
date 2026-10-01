import test from 'node:test';
import assert from 'node:assert/strict';
import {newRun,makeCourse,tick,tickPlayer,shoot,parry,addPeer,BITE_TIMING,canStand} from '../engine.js';
import {createMind} from '../enemy-ai.js';

function setup({id=2,health=100,peer=false}={}){
 const run=newRun(makeCourse());Object.assign(run,{mode:'play',x:6,y:9,angle:-Math.PI/2,wave:3,waveDelay:999});
 const player=peer?addPeer(run):run;
 Object.assign(player,{x:6,y:9,angle:-Math.PI/2,health});if(peer){run.x=9;run.y=9;}
 const enemy={id,x:6,y:8.72,z:0,hp:100,maxHp:100,kind:0,variant:'stalker',dead:false,flash:0,phase:0,
  attack:0,moveSpeed:.3,contactDamage:12,biteAttackCount:(2-id%3+3)%3};
 createMind(enemy,{state:'stalk',firstAttack:0});enemy.mind.token=true;run.course.enemies=[enemy];
 return{run,player,enemy,events:[]};
}
function advance(s,seconds,input={},hz=120){
 for(let i=0;i<Math.round(seconds*hz);i++){
  s.run.events=[];if(s.player!==s.run){s.player.events=[];tickPlayer(s.player,1/hz,input);}
  tick(s.run,1/hz,s.player===s.run?input:{});
  const events=s.player===s.run?s.run.events:[...s.run.events,...s.player.events];
  s.events.push(...events.map(e=>({...e,time:s.run.time})));
 }
}
function latch(s){advance(s,.7);assert.equal(s.player.bite.phase,'held');}

test('grapple has a distinct windup, damage-free latch window, escalating injury, and health-based death',()=>{
 const s=setup();advance(s,.1);
 assert.equal(s.player.bite.phase,'windup');assert.equal(s.player.health,100);
 advance(s,.6);assert.equal(s.player.bite.phase,'held');
 advance(s,1.1);assert.equal(s.player.health,100);assert.equal(s.player.bite.damageStage,0);
 advance(s,.2);assert.equal(s.player.health,92);
 advance(s,.9);assert.equal(s.player.health,78);assert.equal(s.player.playerWounds.rightLeg,'injured');
 assert.notEqual(s.player.bite.phase,'terminal');
 advance(s,3);assert.equal(s.player.health,0);assert.equal(s.player.bite.phase,'terminal');assert.equal(s.run.mode,'dead');
 const pulses=s.events.filter(e=>e.type==='bite-damage');assert.deepEqual(pulses.map(e=>e.damage),[8,14,22,26,30]);
 assert.equal(s.events.filter(e=>e.type==='bite-start').length,1);assert.equal(s.events.filter(e=>e.type==='bite-terminal').length,1);
 assert.ok(pulses[0].time-s.events.find(e=>e.type==='bite-start').time>=BITE_TIMING.firstDamage-1e-6);
 assert.equal(s.player.bite.enemyId,s.enemy.id,'terminal visual retains its attacker');
});

test('F interrupts windup and a dodge or wall break cancels rather than latching',()=>{
 for(const action of ['parry','dash','wall']){
  const s=setup();advance(s,.1);
  if(action==='parry')parry(s.player);
  if(action==='wall'){s.player.x=s.enemy.x=6.5;s.player.y=9.1;s.enemy.y=8.8;s.run.course.cells[9*s.run.course.w+6][0]=1;s.run.course.cells[8*s.run.course.w+6][2]=1;}
  advance(s,.7,action==='dash'?{dash:true,forward:-1}:{});
  assert.ok(['released','idle'].includes(s.player.bite.phase),action);
  assert.equal(s.events.some(e=>e.type==='bite-start'),false,action);assert.equal(s.player.health,100);
 }
});

test('holding existing movement controls escapes before first bite, without consuming energy',()=>{
 for(const input of [{forward:-1},{strafe:1},{dash:true},{jump:true}]){
  const s=setup({health:1});latch(s);const energy=s.player.energy;
  advance(s,1.2,input);
  assert.ok(['released','idle'].includes(s.player.bite.phase));assert.equal(s.player.health,1);
  assert.equal(s.player.energy,energy);assert.ok(s.player.bite.cooldown>6);
  assert.equal(s.events.some(e=>e.type==='bite-damage'),false);
 }
});

test('two deliberate F presses escape while cooldown rejects repeated calls; gunfire can rescue too',()=>{
 const s=setup();latch(s);
 assert.equal(parry(s.player),true);assert.equal(s.player.bite.escape,.65);
 assert.equal(parry(s.player),false);advance(s,.46);
 assert.equal(parry(s.player),true);assert.equal(s.player.bite.phase,'released');assert.equal(s.player.health,100);
 const armed=setup();latch(armed);armed.enemy.hp=1;
 assert.equal(shoot(armed.player),true);assert.equal(armed.enemy.dead,true);advance(armed,.02);
 assert.equal(armed.player.bite.phase,'released');assert.equal(armed.player.bite.reason,'attacker-killed');
});

test('crowd damage cannot erase the initial escape window, and only one enemy owns a victim',()=>{
 const s=setup();latch(s);
 const other={...s.enemy,id:9,x:6.05,hp:100,dead:false,mind:undefined,attack:0,strike:.2,slashHit:false,slashDir:Math.PI/2,slashReach:.5,slashHalf:1,biteTargetId:null,bitePhase:null};
 createMind(other,{state:'stalk',firstAttack:0});other.mind.token=true;s.run.course.enemies.push(other);
 advance(s,.6);assert.equal(s.player.health,100);assert.equal(s.player.bite.enemyId,s.enemy.id);
 assert.equal(s.run.course.enemies.filter(e=>e.biteTargetId==='host').length,1);
});

test('authoritative peer grapples progress once; prediction cannot damage, injure or escape the player',()=>{
 const s=setup({peer:true});latch(s);
 const state=JSON.stringify(s.player.bite),health=s.player.health;
 for(let i=0;i<300;i++)tickPlayer(s.player,1/120,{predictWeapons:true,dash:true});
 assert.equal(JSON.stringify(s.player.bite),state);assert.equal(s.player.health,health);
 assert.equal(s.player.playerWounds.neck,0);
 advance(s,1.3);assert.equal(s.player.health,92);assert.equal(s.run.health,100);
 const damage=s.events.filter(e=>e.type==='bite-damage');assert.equal(damage.length,1);assert.equal(damage[0].playerId,'peer');
 assert.equal(s.events.filter(e=>e.type==='damage').length,0,'bite has its own damage cue without duplicate generic hits');
 assert.equal(s.player.bite.damageStage,1);
});

test('fatal neck, limb and torso states reset on restart or co-op revive',()=>{
 for(const [id,fatality] of [[2,'neck'],[3,'limb'],[4,'torso']]){
  const s=setup({id,health:8,peer:true});latch(s);
  assert.equal(s.player.playerWounds.eviscerated,false);
  advance(s,1.3);assert.equal(s.player.health,0);assert.equal(s.player.bite.reason,fatality);
  if(fatality==='limb')assert.equal(s.player.playerWounds[s.player.bite.limb],'severed');
  if(fatality==='torso')assert.equal(s.player.playerWounds.eviscerated,true);
  s.enemy.dead=true;advance(s,3.1);assert.equal(s.player.health,65);assert.equal(s.player.bite.phase,'idle');
  assert.equal(s.player.playerWounds.eviscerated,false);assert.equal(s.player.playerWounds.leftArm,'intact');
 }
 const fresh=newRun(makeCourse());assert.equal(fresh.bite.phase,'idle');assert.equal(fresh.playerWounds.neck,0);
});

test('rare late failed struggles can sever a non-dominant limb while the survivor still shoots and escapes',()=>{
 const s=setup({id:12});latch(s);advance(s,4);
 assert.equal(s.player.health,30);assert.equal(s.player.bite.phase,'held');
 assert.equal(s.player.playerWounds.leftArm,'severed');assert.equal(s.player.playerWounds.rightArm,'injured');
 assert.ok(s.events.some(e=>e.type==='player-injury'&&e.severity==='severed'&&!e.terminal));
 assert.equal(shoot(s.player),true,'dominant weapon remains usable after losing the support arm');
 parry(s.player);advance(s,.46);parry(s.player);
 assert.equal(s.player.bite.phase,'released');assert.ok(s.player.health>0);
 assert.equal(s.player.playerWounds.leftArm,'severed');
});

test('leg wounds reduce ordinary movement modestly while hands and firing remain functional',()=>{
 const plain=setup(),injured=setup();plain.run.course.enemies=[];injured.run.course.enemies=[];
 injured.player.playerWounds.leftLeg='injured';
 for(let i=0;i<60;i++){tickPlayer(plain.player,1/120,{forward:1});tickPlayer(injured.player,1/120,{forward:1});}
 const ratio=(9-injured.player.y)/(9-plain.player.y);assert.ok(ratio>.86&&ratio<.90);
 injured.player.playerWounds.leftArm='injured';assert.equal(shoot(injured.player),true);
 assert.ok(canStand(injured.run.course,injured.player.x,injured.player.y,.1));
});

test('bite outcome remains deterministic at 30/60/120Hz',()=>{
 for(const hz of [30,60,120]){
  const s=setup();advance(s,3,{},hz);
  assert.equal(s.player.health,78);assert.equal(s.player.bite.damageStage,2);
  assert.equal(s.player.playerWounds.rightLeg,'injured');
 }
});
