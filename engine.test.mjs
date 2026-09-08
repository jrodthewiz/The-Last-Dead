import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,makeCampaignCourse,newRun,tick,tickPlayer,shoot,parry,look,switchWeapon,addPeer,canStand,eye,grapple,weapons} from './engine.js';
const fresh=()=>{const r=newRun(makeCourse());r.mode='play';r.wave=3;r.x=6;r.y=6;r.angle=0;r.waveDelay=999;return r;};
const enemy=(r,x=7,y=6,hp=20)=>{const e={id:r.nextId++,x,y,hp,kind:1,dead:false,flash:0,attack:999,phase:0};r.course.enemies.push(e);return e;};
test('free movement follows aim; optional autorun; input release stops ground travel',()=>{const r=fresh();enemy(r,10);for(let n=0;n<120;n++)tick(r,1/120,{forward:1});assert.ok(r.x>7.8);const a=r.angle;look(r,200,-80);assert.notEqual(r.angle,a);assert.ok(r.pitch>0);for(let n=0;n<120;n++)tick(r,1/120,{});assert.ok(r.speed<.01);r.autoRun=true;tick(r,1/60,{});assert.ok(r.speed>0);});
test('dash does not tunnel through cover, including diagonal corners at frame spikes',()=>{for(const angle of [0,.2,-.2]){const r=fresh();r.x=2.5;r.y=3.5;r.angle=angle;for(let n=0;n<50;n++){tick(r,.1,{forward:1,dash:n%5===0});assert.ok(canStand(r.course,r.x,r.y,.1));assert.ok(!(r.x>3&&r.x<4&&r.y>3&&r.y<4));}if(angle===0)assert.ok(r.x<3);}});
test('jump, air dash and slam land; slide is faster than ground run',()=>{const r=fresh();enemy(r,10);tick(r,1/120,{jump:true});for(let n=0;n<20;n++)tick(r,1/120,{});assert.ok(r.z>.15);const z=r.z;tick(r,1/120,{dash:true});assert.ok(r.dashTime>0&&r.energy<70);tick(r,1/120,{slide:true});for(let n=0;n<80;n++)tick(r,1/120,{slide:true});assert.equal(r.z,0);assert.ok(r.slide>.9);assert.ok(r.speed>2.1);assert.ok(z>0);});
test('vertical aim matters, walls occlude shots and fire cooldown is enforced',()=>{const r=fresh(),e=enemy(r);r.pitch=1;shoot(r);assert.equal(e.hp,20);r.cooldowns[0]=0;r.pitch=0;assert.equal(shoot(r),true);assert.ok(e.hp<20);const hp=e.hp;assert.equal(shoot(r),false);assert.equal(e.hp,hp);r.x=2.5;r.y=3.5;r.angle=0;e.x=4.5;e.y=3.5;r.cooldowns[0]=0;shoot(r);assert.equal(e.hp,hp);});
test('close-range damage heals and produces bounded blood/gore',()=>{const r=fresh();r.health=40;const e=enemy(r,6.6,6,2);shoot(r);assert.equal(e.dead,true);assert.ok(r.health>40);assert.ok(r.blood.length&&r.gore.length);assert.ok(r.styleTotal>0);for(let n=0;n<40;n++){r.cooldowns[0]=0;enemy(r,6.6,6,2);shoot(r);}assert.ok(r.gore.length<=220&&r.blood.length<=100);});
test('coin toss can be shot for lethal ricochet',()=>{const r=fresh(),e=enemy(r,8,6,7);assert.equal(shoot(r,true),true);assert.equal(r.coinCharges,3);const coin=r.coins[0];r.pitch=Math.atan2(coin.z-eye(r),coin.x-r.x);shoot(r);assert.equal(e.dead,true);assert.ok(r.styleTotal>=180);});
test('parry reflects projectile and returns it to an enemy',()=>{const r=fresh(),e=enemy(r,7.3,6,10);r.health=50;r.projectiles.push({id:90,x:6.5,y:6,z:.4,vx:-1,vy:0,vz:0,life:3,reflected:false});parry(r);tick(r,1/120,{});assert.equal(r.projectiles[0].reflected,true);assert.ok(r.health>=65);for(let n=0;n<40;n++)tick(r,1/120,{});assert.equal(e.dead,true);});
test('shotgun core explodes on cover and cannot blast through walls',()=>{const r=fresh();r.x=2.5;r.y=3.5;switchWeapon(r,1);const e=enemy(r,3.5,3.5,20);shoot(r,true);for(let n=0;n<100;n++)tick(r,1/120,{});assert.equal(e.hp,20);assert.equal(r.projectiles.filter(p=>p.core).length,0);});
test('peer shots affect authoritative shared world; peer movement respects walls',()=>{const r=fresh(),p=addPeer(r);p.x=6;p.y=6;p.angle=0;const e=enemy(r,6.6,6,2);p.health=50;shoot(p);assert.equal(e.dead,true);assert.equal(r.kills,1);assert.ok(r.gore.length);assert.ok(p.health>50);p.x=2.5;p.y=3.5;for(let n=0;n<80;n++)tickPlayer(p,1/120,{forward:1,dash:n===0});assert.ok(p.x<3);});
test('waves progress, exit clears run, death and restart reset state',()=>{const r=newRun(makeCourse());r.mode='play';for(let wave=1;wave<=3;wave++){for(let n=0;n<260;n++)tick(r,1/120,{});assert.equal(r.wave,wave);for(const e of r.course.enemies)e.dead=true;}r.x=r.course.exit.x;r.y=r.course.exit.y;tick(r,1/120,{});assert.equal(r.mode,'win');const d=fresh();d.health=0;tick(d,1/120,{});assert.equal(d.mode,'dead');const clean=newRun(makeCourse());assert.equal(clean.health,100);assert.equal(clean.wave,0);assert.equal(clean.projectiles.length,0);assert.equal(clean.coins.length,0);});

test('tether pulls a light enemy close and draws player toward a heavy',()=>{const r=fresh(),e=enemy(r,8,6,20);e.kind=0;assert.equal(grapple(r),true);for(let n=0;n<40;n++)tickPlayer(r,1/120,{});assert.ok(e.x<7);r.hookCooldown=0;e.kind=2;e.x=8;assert.equal(grapple(r),true);for(let n=0;n<30;n++)tickPlayer(r,1/120,{});assert.ok(r.x>6.7);});

test('enemies route around cover instead of remaining pinned to the wall',()=>{const r=fresh();r.x=4.8;r.y=3.5;const e=enemy(r,2.5,3.5,20);e.kind=0;for(let n=0;n<840;n++){tick(r,1/120,{});assert.ok(canStand(r.course,e.x,e.y,.159));}assert.ok(e.x>4.1);assert.ok(Math.hypot(e.x-r.x,e.y-r.y)<.6);});
test('melee attacks telegraph before damage and punches interrupt the windup',()=>{const r=fresh(),e=enemy(r,6.35,6,20);e.kind=0;e.attack=0;tick(r,1/120,{});assert.equal(e.attacking,true);assert.equal(r.health,100);for(let n=0;n<20;n++)tick(r,1/120,{});assert.equal(r.health,100);parry(r);assert.equal(e.attacking,false);assert.ok(e.stagger>0);for(let n=0;n<30;n++)tick(r,1/120,{});assert.equal(r.health,100);assert.match(r.styleLabel,/INTERRUPT/);});
test('casters commit a visible windup before releasing a projectile',()=>{const r=fresh(),e=enemy(r,7.5,6,20);e.attack=0;tick(r,1/120,{});assert.equal(e.attacking,true);assert.equal(r.projectiles.length,0);for(let n=0;n<60;n++)tick(r,1/120,{});assert.ok(r.projectiles.length>0);assert.ok(e.strike>0);});

test('Ossuary hit blood originates at the ray height and tracers carry weapon identity',()=>{const r=newRun(makeCourse());r.mode='play';r.angle=-Math.PI/2;r.pitch=0;r.course.enemies=[{id:77,x:6,y:9,z:0,hp:30,kind:0,dead:false,flash:0,attack:99,phase:0}];shoot(r);assert.ok(r.gore.length>=12);assert.ok(r.gore.every(p=>Math.abs(p.z-.4)<1e-6));assert.equal(r.tracers[0].weapon,0);assert.equal(r.tracers[0].hit,true);assert.equal(r.tracers[0].duration,.18);assert.equal(r.tracers[0].ty,9);});
test('wall shots do not spawn enemy blood and effects expire',()=>{const r=newRun(makeCourse());r.mode='play';shoot(r);assert.equal(r.gore.length,0);assert.equal(r.tracers[0].hit,false);for(let i=0;i<30;i++)tick(r,1/120);assert.equal(r.tracers.length,0);});


test('campaign director is deterministic, telegraphs safe spawns, and advances sectors',()=>{
 const a=newRun(makeCampaignCourse(0)),b=newRun(makeCampaignCourse(0));a.mode='play';b.mode='play';
 for(let n=0;n<360;n++){tick(a,1/120,{});tick(b,1/120,{});}
 assert.equal(a.wave,1);assert.equal(a.wave,b.wave);assert.deepEqual(a.director.queue.map(q=>[q.variant,q.due,q.status]),b.director.queue.map(q=>[q.variant,q.due,q.status]));
 assert.ok(a.course.enemies.length+a.spawnTelegraphs.length<=a.director.aliveCap);
 assert.ok(a.spawnTelegraphs.length>0||a.course.enemies.length>0);
 for(const e of a.course.enemies)assert.ok(Math.hypot(e.x-a.x,e.y-a.y)>=3.49);
 for(let n=0;n<3000&&a.director.state!=='exit';n++){tick(a,1/120,{});for(const e of a.course.enemies)e.dead=true;}
 assert.equal(a.director.state,'exit');a.x=a.course.exit.x;a.y=a.course.exit.y;tick(a,1/120,{});
 assert.equal(a.sectorIndex,1);assert.equal(a.sectorId,'ossuary');assert.equal(a.wave,0);assert.equal(a.course.name,'The Ossuary');
});

test('bazooka rockets detonate with splash, rocket jump, and wall occlusion',()=>{
 const r=newRun(makeCourse());r.mode='play';r.x=6;r.y=6;r.angle=0;const e={id:r.nextId++,x:7.2,y:6,z:0,hp:30,kind:0,variant:'stalker',dead:false,flash:0,attack:999,phase:0};r.course.enemies.push(e);
 switchWeapon(r,3);assert.equal(r.weapon,3);assert.equal(weapons.length,4);assert.equal(shoot(r),true);assert.equal(r.projectiles[0].kind,'rocket');for(let n=0;n<80;n++)tick(r,1/120,{});
 assert.ok(e.hp<30);assert.ok(r.explosions.length||r.events.some(event=>event.type==='explosion'));assert.ok(r.events.some(event=>event.type==='rocket-jump'));
 const w=newRun(makeCourse());w.mode='play';w.x=2.5;w.y=3.5;w.angle=0;const behind={id:w.nextId++,x:4.5,y:3.5,z:0,hp:30,kind:0,variant:'stalker',dead:false,flash:0,attack:999,phase:0};w.course.enemies.push(behind);switchWeapon(w,3);shoot(w);for(let n=0;n<100;n++)tick(w,1/120,{});assert.equal(behind.hp,30);
});

test('campaign final exit produces victory after the third sector',()=>{
 const r=newRun(makeCampaignCourse(2));r.mode='play';r.wave=r.waveCount;r.course.enemies=[];r.director={state:'exit',budget:0,spent:0,remainingBudget:0,aliveCap:0,active:0,pending:0,queue:[],elapsed:0,seed:0};r.x=r.course.exit.x;r.y=r.course.exit.y;tick(r,1/120,{});
 assert.equal(r.mode,'win');assert.equal(r.campaignComplete,true);assert.equal(r.events.at(-1).type,'win');
});

test('bazooka alternate fire detonates only the owner live rocket',()=>{
 const r=newRun(makeCourse());r.mode='play';r.x=6;r.y=6;r.angle=0;switchWeapon(r,3);
 assert.equal(shoot(r,true),false);assert.equal(shoot(r),true);const rocket=r.projectiles.find(p=>p.kind==='rocket');assert.ok(rocket);
 r.cooldowns[3]=99;assert.equal(shoot(r,true),true);assert.equal(rocket.exploded,true);assert.equal(rocket.life,0);assert.ok(r.events.some(event=>event.type==='rocket-detonate'));
 assert.equal(shoot(r,true),false);
});