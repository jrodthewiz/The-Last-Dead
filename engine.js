import {
  CAMPAIGN_SECTORS,
  CAMPAIGN_SECTOR_COUNT,
  CAMPAIGN_WAVE_COUNT,
  ENEMY_PROFILES,
  createCampaignCourse,
  getSector,
  getWavePlan,
  makeWaveQueue,
} from './campaign.js';
import { createRoomProgression, updateRoomProgression, currentRoom, syncRoomGateCells, canTraverseRoomGates } from './room-progression.js';

// Arena simulation uses 4 metre cells; renderers never own gameplay state.
export const METERS=4,EYE=.4;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const courses=CAMPAIGN_SECTORS.map((sector,index)=>({name:sector.name,color:sector.color,tag:sector.tag,index}));
export const weapons=[
 {name:'OSSUARY',interval:.22,damage:2,range:20,cone:.008,kind:'hitscan'},
 {name:'BREACH SHOTGUN',interval:.72,damage:1.2,range:7,cone:.15,kind:'hitscan'},
 {name:'ARC LANCE',interval:5,damage:12,range:24,cone:.015,kind:'hitscan'},
 {name:'RELIQUARY',alias:'RIFT BAZOOKA',interval:1.1,damage:24,range:30,cone:.01,kind:'rocket',radius:1.65,knockback:4.8},
];

// The default course remains the compact three-wave combat lab for old tests and
// deterministic smoke checks. The live game can opt into the authored campaign
// with makeCourse(index,{campaign:true}) or makeCampaignCourse(index).
export function makeCourse(index=0,options={}){
 if(options?.campaign||index>0)return createCampaignCourse(index);
 const w=12,h=12,cells=Array.from({length:w*h},(_,i)=>[i<w?1:0,i%w===w-1?1:0,i>=w*(h-1)?1:0,i%w===0?1:0]);
 // Four tall cover blocks create a central combat floor and outer circulation lanes.
 const blocks=[[3,3],[8,3],[3,8],[8,8]];
 for(const[x,y]of blocks){const i=y*w+x;cells[i]=[1,1,1,1];cells[i-w][2]=1;cells[i+1][3]=1;cells[i+w][0]=1;cells[i-1][1]=1;}
 return{...courses[0],w,h,cells,blocks,index:0,sectorIndex:0,sectorId:'bloodworks',campaign:false,enemies:[],spawnPoints:CAMPAIGN_SECTORS[0].spawnPoints.map(([x,y])=>({x,y})),points:[{x:6,y:10.5},{x:6,y:1}],playerSpawn:{x:6,y:10.5,angle:-Math.PI/2},exit:{x:6,y:1},turns:[]};
}
export const makeCampaignCourse=index=>createCampaignCourse(index);
export function castRay(m,x,y,angle,max=24){const dx=Math.cos(angle),dy=Math.sin(angle);let cx=Math.floor(x),cy=Math.floor(y),dist=0,side=0;for(let i=0;i<100;i++){if(cx<0||cy<0||cx>=m.w||cy>=m.h)return{dist:Math.max(.02,dist),side,u:0};const tx=dx>0?(cx+1-x)/dx:dx<0?(cx-x)/dx:Infinity,ty=dy>0?(cy+1-y)/dy:dy<0?(cy-y)/dy:Infinity;side=tx<ty?0:1;dist=side===0?tx:ty;const direction=side===0?(dx>0?1:3):(dy>0?2:0);if(m.cells[cy*m.w+cx][direction]||dist>max){const hit=side===0?y+dy*dist:x+dx*dist;return{dist:Math.max(.02,Math.min(dist,max)),side,u:hit-Math.floor(hit)};}if(side===0)cx+=dx>0?1:-1;else cy+=dy>0?1:-1;}return{dist:max,side,u:0};}
export function canStand(m,x,y,r=.075){if(m.cells[Math.floor(y)*m.w+Math.floor(x)]?.every(v=>v===1))return false;if(x<r||y<r||x>m.w-r||y>m.h-r)return false;for(let cy=Math.max(0,Math.floor(y-r));cy<=Math.min(m.h-1,Math.floor(y+r));cy++)for(let cx=Math.max(0,Math.floor(x-r));cx<=Math.min(m.w-1,Math.floor(x+r));cx++){const walls=m.cells[cy*m.w+cx],segments=[[cx,cy,cx+1,cy],[cx+1,cy,cx+1,cy+1],[cx,cy+1,cx+1,cy+1],[cx,cy,cx,cy+1]];for(let d=0;d<4;d++){if(!walls[d])continue;const[a,b,c,e]=segments[d];if(Math.hypot(x-clamp(x,a,c),y-clamp(y,b,e))<r-1e-7)return false;}}return true;}

export const viewAngle=r=>r.angle;
export function newRun(course, options = {}){
 const campaign=course?.campaign===true;
 const sectorIndex=Number.isInteger(course?.sectorIndex)?course.sectorIndex:0;
 const sector=getSector(sectorIndex);
 const spawn=course?.playerSpawn||{x:6,y:10.5,angle:-Math.PI/2};
 const waveCount=campaign?(sector.waves?.length||CAMPAIGN_WAVE_COUNT):3;
 return{
  course,x:spawn.x,y:spawn.y,z:0,angle:spawn.angle??-Math.PI/2,pitch:0,vx:0,vy:0,vz:0,speed:0,distance:0,time:0,mode:'ready',
  health:100,energy:100,weapon:0,cooldowns:Array.from({length:weapons.length},()=>0),fireCooldown:0,shot:0,damage:0,heal:0,aim:0,slide:0,dashTime:0,punch:0,hookTime:0,hookCooldown:0,hookTarget:-1,parryTime:0,parryCooldown:0,slam:false,wallJumps:0,
  style:0,styleTotal:0,styleLabel:'GET CLOSE. GET LOUD.',rank:'D',kills:0,combo:0,bestCombo:0,lastWeapon:-1,repeat:0,
  campaign,sectorIndex,sectorCount:campaign?CAMPAIGN_SECTOR_COUNT:1,sectorId:course?.sectorId||sector.id,sectorName:course?.name||sector.name,wave:0,waveCount,waveDelay:campaign?(sector.waves[0]?.intermission??1.2):1.2,
  director:campaign?{state:'intermission',budget:0,spent:0,remainingBudget:0,aliveCap:0,active:0,pending:0,queue:[],elapsed:0,seed:sectorIndex*1000+1}:null,
  roomProgression:campaign?createRoomProgression(course,sectorIndex,options):null,
  spawnTelegraphs:[],explosions:[],projectiles:[],coins:[],coinCharges:4,coinRegen:0,altCooldown:0,respawnTime:0,
  gore:[],blood:[],tracers:[],events:[],pressed:{},nextId:1,autoRun:false,playerId:'host',campaignComplete:false,
 };
}
export function look(r,dx,dy){if(r.mode!=='play')return;r.angle=angleDiff(r.angle+dx*.002,0);r.pitch=clamp(r.pitch-dy*.002,-1.35,1.35);}
export function switchWeapon(r,i){if(!weapons[i]||r.weapon===i)return;r.weapon=i;r.shot=0;}
export function eye(r){return EYE+r.z-r.slide*.18;}
function enemyProfile(e){
 const fallback=e.kind===3?'bellwraith':e.kind===2?'brute':e.kind===1?'caster':'stalker';
 return ENEMY_PROFILES[e.variant]||ENEMY_PROFILES[fallback];
}
function playerId(r){return r.playerId||((r.world&&r.world!==r)?'peer':'host');}
function aliveEnemies(r){return r.course.enemies.filter(e=>!e.dead);}
function pushEvent(r,type,extra={}){r.events.push({type,...extra});}
function award(r,amount,label){r.style=Math.min(1800,r.style+amount);r.styleTotal+=amount;r.styleLabel=label;r.combo++;r.bestCombo=Math.max(r.combo,r.bestCombo);}
function hurt(r,n){if(r.dashTime>0)return;r.health=Math.max(0,r.health-n);r.damage=1;r.style*=.65;r.combo=0;r.events.push({type:'damage',x:r.x,y:r.y,z:eye(r)});}
function burst(player,e,count=18,hit=null){const r=player.world||player;for(let i=0;i<count;i++){const a=(i*2.399+e.id),v=.35+(i%5)*.15;r.gore.push({id:r.nextId++,x:hit?.x??e.x,y:hit?.y??e.y,z:hit?.z??(.15+(i%7)*.045),vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:.55+(i%4)*.22,life:2+(i%3),size:i%6===0?.065:.017,chunk:i%6===0,spin:a});}r.gore=r.gore.slice(-220);r.blood.push({id:r.nextId++,x:e.x,y:e.y,size:.12+count*.005,angle:e.id});r.blood=r.blood.slice(-100);}
function damageEnemy(r,e,n,label='HIT',hit=null){
 if(e.dead)return;
 e.hp-=n;e.flash=.16;
 const hx=hit?.x??e.x,hy=hit?.y??e.y,hz=hit?.z??.4;
 burst(r,e,e.hp<=0?34:12,{x:hx,y:hy,z:hz});
 const d=Math.hypot(e.x-r.x,e.y-r.y,r.z);
 if(d<1.25&&castRay(r.course,r.x,r.y,Math.atan2(e.y-r.y,e.x-r.x)).dist>d-.15){r.health=Math.min(100,r.health+n*3);r.heal=.5;}
 const eventBase={x:hx,y:hy,z:hz,weapon:r.weapon,enemyId:e.id,enemyKind:e.kind,variant:e.variant||'stalker'};
 if(e.hp<=0){
  e.dead=true;e.deathTime=0;r.kills++;if(r.world)r.world.kills++;
  award(r,100+(r.z>.1?80:0)+(r.slide>.4?60:0),r.z>.1?'+ AIR KILL':r.slide>.4?'+ SLIDE KILL':label);
  r.events.push({type:'kill',...eventBase});
  if(r.world)r.world.events.push({type:'kill',...eventBase});
 }else r.events.push({type:'hit',...eventBase});
}
function safeSpawnPoint(r, preferred=0){
 const points=Array.isArray(r.course.spawnPoints)&&r.course.spawnPoints.length?r.course.spawnPoints:[{x:2,y:2},{x:10,y:2},{x:6,y:3},{x:2,y:6},{x:10,y:6},{x:6,y:1.8},{x:1.5,y:4},{x:10.5,y:4}];
 const activeRoom=r.roomProgression?.requireEntry?currentRoom(r.roomProgression):null;
 const roomPoints=activeRoom?.spawnPoints?.length?activeRoom.spawnPoints:null;
 const source=roomPoints||points;
 const players=[r,...(r.peer?[r.peer]:[])].filter(p=>p&&p.health>0);
 const ordered=source.map((point,index)=>({p:point,index})).sort((a,b)=>{
  const ap=Math.min(...players.map(player=>Math.hypot(a.p.x-player.x,a.p.y-player.y)));
  const bp=Math.min(...players.map(player=>Math.hypot(b.p.x-player.x,b.p.y-player.y)));
  return (bp-ap)||(((a.index-preferred+source.length)%source.length)-((b.index-preferred+source.length)%source.length));
 });
 return ordered.find(({p})=>canStand(r.course,p.x,p.y,.16)&&players.every(player=>Math.hypot(p.x-player.x,p.y-player.y)>=3.5))?.p||null;
}
function spawnEnemy(r,item,point){
 const profile=ENEMY_PROFILES[item.variant]||enemyProfile(item);
 const sectorScale=1+(r.sectorIndex||0)*.16+(Math.max(0,r.wave-1))*.045;
 const hp=Math.max(1,Math.round(profile.hp*sectorScale));
 const e={id:r.nextId++,x:point.x,y:point.y,z:0,hp,maxHp:hp,kind:item.kind??profile.kind,variant:item.variant||'stalker',role:item.role||profile.role,
  cost:item.cost||profile.cost||1,dead:false,flash:0,attack:.35+(item.order%4)*.13,phase:item.order||0,moveSpeed:profile.speed,attackCooldown:profile.attack,
  windupTime:profile.windup,projectileSpeed:profile.projectileSpeed||1.05,contactDamage:profile.contactDamage||12,spawnedAt:r.time,
  elite:sectorScale>1.2};
 r.course.enemies.push(e);
 if(r.director){r.director.spent+=e.cost;r.director.remainingBudget=Math.max(0,r.director.budget-r.director.spent);}
 const event={type:'spawn',x:e.x,y:e.y,z:e.z,enemyId:e.id,enemyKind:e.kind,variant:e.variant,sectorIndex:r.sectorIndex,wave:r.wave};
 r.events.push(event);
 if(r.world)r.world.events.push({...event});
 return e;
}
function removeTelegraph(r,item){
 if(!item.telegraph)return;
 r.spawnTelegraphs=r.spawnTelegraphs.filter(t=>t.id!==item.telegraph.id);
 item.telegraph=null;
}
function updateTelegraphs(r,dt){
 for(const t of r.spawnTelegraphs){t.life-=dt;t.phase=(t.phase||0)+dt;}
 r.spawnTelegraphs=r.spawnTelegraphs.filter(t=>t.life>0);
}
function beginCampaignWave(r){
 const plan=getWavePlan(r.sectorIndex,r.wave);
 const queue=makeWaveQueue(r.sectorIndex,r.wave);
 r.wave++;
 r.director={state:'spawning',budget:plan.budget,spent:0,remainingBudget:plan.budget,aliveCap:plan.aliveCap,active:aliveEnemies(r).length,pending:queue.length,queue,elapsed:0,seed:(r.sectorIndex+1)*1000+r.wave};
 r.waveDelay=0;
 r.events.push({type:'wave',wave:r.wave,waveCount:r.waveCount,sectorIndex:r.sectorIndex,sectorId:r.sectorId});
}
function updateCampaignDirector(r,dt){
 const d=r.director;
 if(!d)return;
 updateTelegraphs(r,dt);
 const active=aliveEnemies(r).length;
 d.active=active;
 if(d.state==='intermission'){
  if(r.roomProgression?.requireEntry && Number.isInteger(r.roomProgression.pendingIndex) && r.roomProgression.pendingIndex>r.roomProgression.currentIndex)return;
  if(active>0){d.state='combat';return;}
  r.waveDelay=Math.max(0,r.waveDelay-dt);
  if(r.waveDelay<=0&&r.wave<r.waveCount){beginCampaignWave(r);}
  return;
 }
 if(d.state==='spawning'||d.state==='combat'){
  d.elapsed+=dt;
  for(const item of d.queue){
   if(item.status==='spawned')continue;
   const telegraphTime=Math.max(0,item.due-.55);
   if(d.elapsed>=telegraphTime&&!item.telegraph){
    const p=safeSpawnPoint(r,item.spawn);
    if(p){
     item.telegraph={id:r.nextId++,x:p.x,y:p.y,z:0,kind:item.kind,variant:item.variant,life:.65,phase:0,order:item.order};
     r.spawnTelegraphs.push(item.telegraph);
     r.events.push({type:'spawn-telegraph',x:p.x,y:p.y,z:0,enemyKind:item.kind,variant:item.variant,sectorIndex:r.sectorIndex,wave:r.wave});
    }
   }
   if(d.elapsed<item.due||aliveEnemies(r).length+r.spawnTelegraphs.length>=d.aliveCap)continue;
   const p=safeSpawnPoint(r,item.spawn);
   if(!p)continue; // Hold until the player has moved far enough away.
   removeTelegraph(r,item);spawnEnemy(r,item,p);item.status='spawned';
   d.pending=Math.max(0,d.pending-1);
  }
  const pending=d.queue.some(item=>item.status!=='spawned');
  d.active=aliveEnemies(r).length;
  if(!pending&&d.active>0)d.state='combat';
  if(!pending&&d.active===0){
   if(r.wave<r.waveCount){d.state='intermission';r.waveDelay=getWavePlan(r.sectorIndex,r.wave).intermission;}
   else d.state='exit';
  }
 }
}
function advanceCampaignSector(r){
 const next=r.sectorIndex+1;
 if(next>=CAMPAIGN_SECTOR_COUNT){
  r.campaignComplete=true;r.mode='win';
  r.events.push({type:'win',sectorIndex:r.sectorIndex,sectorId:r.sectorId,x:r.x,y:r.y,z:eye(r)});
  return false;
 }
 const course=createCampaignCourse(next),sector=getSector(next),spawn=course.playerSpawn;
 r.course=course;r.sectorIndex=next;r.sectorId=sector.id;r.sectorName=sector.name;r.sectorCount=CAMPAIGN_SECTOR_COUNT;
 r.roomProgression=createRoomProgression(course,next,{requireEntry:r.roomProgression?.requireEntry===true});
 r.wave=0;r.waveCount=sector.waves.length;r.waveDelay=sector.waves[0]?.intermission??1.2;
 r.director={state:'intermission',budget:0,spent:0,remainingBudget:0,aliveCap:0,active:0,pending:0,queue:[],elapsed:0,seed:(next+1)*1000};
 r.spawnTelegraphs=[];r.projectiles=[];r.coins=[];r.explosions=[];
 r.x=spawn.x;r.y=spawn.y;r.z=0;r.vx=0;r.vy=0;r.vz=0;r.angle=spawn.angle??-Math.PI/2;
 const transition={type:'sector-transition',sectorIndex:next,sectorId:sector.id,sectorName:sector.name,sectorCount:CAMPAIGN_SECTOR_COUNT,x:r.x,y:r.y,z:0};
 r.events.push(transition);
 if(r.peer){
  r.peer.course=course;r.peer.roomProgression=r.roomProgression;r.peer.sectorIndex=next;r.peer.sectorId=sector.id;r.peer.sectorName=sector.name;r.peer.wave=0;r.peer.waveCount=sector.waves.length;r.peer.waveDelay=r.waveDelay;r.peer.director=r.director;r.peer.spawnTelegraphs=r.spawnTelegraphs;r.peer.projectiles=r.projectiles;r.peer.coins=r.coins;r.peer.explosions=r.explosions;
  r.peer.x=spawn.x+.5;r.peer.y=spawn.y;r.peer.z=0;r.peer.vx=0;r.peer.vy=0;r.peer.vz=0;r.peer.angle=spawn.angle??-Math.PI/2;
 }
 return true;
}
function checkCampaignExit(r){
 const d=r.director;if(!d||d.state!=='exit')return;
 const near=Math.hypot(r.x-r.course.exit.x,r.y-r.course.exit.y)<.65||(r.peer&&Math.hypot(r.peer.x-r.course.exit.x,r.peer.y-r.course.exit.y)<.65);
 if(!near)return;
 advanceCampaignSector(r);
}
export function spawnWave(r){
 if(r.campaign){if(r.director?.state==='intermission'&&!(r.roomProgression?.requireEntry&&Number.isInteger(r.roomProgression.pendingIndex)&&r.roomProgression.pendingIndex>r.roomProgression.currentIndex))beginCampaignWave(r);return;}
 r.wave++;const spots=[[2,2],[10,2],[6,3],[2,6],[10,6],[6,1.8],[1.5,4],[10.5,4]];
 for(let i=0;i<4+r.wave;i++){const p=spots[i%spots.length],kind=i%3;r.course.enemies.push({id:r.nextId++,x:p[0],y:p[1],z:0,hp:kind===2?10:kind===1?7:5,kind,variant:kind===0?'stalker':kind===1?'caster':'brute',dead:false,flash:0,attack:.5+i*.23,phase:i});}
 r.events.push({type:'wave',wave:r.wave,waveCount:3,sectorIndex:0});
}
function move(r,dx,dy){const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.04));for(let i=0;i<n;i++){const nx=r.x+dx/n,ny=r.y+dy/n;if(canTraverseRoomGates(r.course,r.roomProgression,r.x,r.y,nx,r.y)&&canStand(r.course,nx,r.y,.1))r.x=nx;else r.vx=0;if(canTraverseRoomGates(r.course,r.roomProgression,r.x,r.y,r.x,ny)&&canStand(r.course,r.x,ny,.1))r.y=ny;else r.vy=0;}}
export function parry(r){if(r.mode!=='play'||r.health<=0||r.parryCooldown>0)return false;r.parryTime=.19;r.parryCooldown=.45;r.punch=.3;r.events.push({type:'punch',x:r.x,y:r.y,z:eye(r)});const e=r.course.enemies.filter(e=>!e.dead).find(e=>Math.hypot(e.x-r.x,e.y-r.y)<.65&&Math.abs(angleDiff(Math.atan2(e.y-r.y,e.x-r.x),r.angle))<.9&&castRay(r.course,r.x,r.y,Math.atan2(e.y-r.y,e.x-r.x)).dist>Math.hypot(e.x-r.x,e.y-r.y)-.1);if(e){const interrupt=e.attacking;damageEnemy(r,e,3,interrupt?'+ INTERRUPT':'+ KNUCKLE');e.stagger=.45;e.attacking=false;e.windup=0;if(interrupt)award(r,80,'+ INTERRUPT');}return true;}
export function shoot(r,secondary=false){if(r.mode!=='play'||r.health<=0)return false;const world=r.world||r;
 if(secondary&&r.weapon===0){if(r.altCooldown||r.coinCharges<=0)return false;r.coinCharges--;r.altCooldown=.3;world.coins.push({id:world.nextId++,x:r.x+Math.cos(r.angle)*.2,y:r.y+Math.sin(r.angle)*.2,z:eye(r)+.03,vx:Math.cos(r.angle)*.9,vy:Math.sin(r.angle)*.9,vz:1.15,life:3});r.events.push({type:'coin',weapon:0,x:r.x,y:r.y,z:eye(r)});return true;}
 if(secondary&&r.weapon===3){
  const rocket=world.projectiles.find(p=>p.kind==='rocket'&&p.ownerId===playerId(r)&&!p.exploded&&p.life>0);
  if(!rocket)return false;
  explode(world,rocket);rocket.life=0;
  r.events.push({type:'rocket-detonate',weapon:3,x:rocket.x,y:rocket.y,z:rocket.z,projectileId:rocket.id});
  return true;
}
if(r.cooldowns[r.weapon]>0)return false;
 if(r.weapon===3){const w=weapons[3],speed=7.2,dx=Math.cos(r.angle)*Math.cos(r.pitch),dy=Math.sin(r.angle)*Math.cos(r.pitch),dz=Math.sin(r.pitch);r.cooldowns[3]=w.interval;r.fireCooldown=w.interval;r.shot=1;r.lastWeapon=r.weapon;r.repeat=0;const rocket={id:world.nextId++,kind:'rocket',weapon:3,x:r.x,y:r.y,z:eye(r),vx:dx*speed,vy:dy*speed,vz:dz*speed,life:4,radius:w.radius,damage:w.damage,knockback:w.knockback,ownerId:playerId(r),selfBoost:true,reflected:false};world.projectiles.push(rocket);r.events.push({type:'rocket',weapon:3,x:rocket.x,y:rocket.y,z:rocket.z,projectileId:rocket.id});return true;}
 if(secondary&&r.weapon===1){r.cooldowns[1]=.95;r.shot=1;const core={id:world.nextId++,kind:'core',weapon:1,x:r.x,y:r.y,z:eye(r),vx:Math.cos(r.angle)*Math.cos(r.pitch)*2.8,vy:Math.sin(r.angle)*Math.cos(r.pitch)*2.8,vz:Math.sin(r.pitch)*2.8+.5,life:3,reflected:true,core:true,ownerId:playerId(r)};world.projectiles.push(core);r.events.push({type:'shot',weapon:1,x:core.x,y:core.y,z:core.z,projectileId:core.id});return true;}
const w=weapons[r.weapon];r.cooldowns[r.weapon]=w.interval*(secondary&&r.weapon===0?2:1);r.fireCooldown=r.cooldowns[r.weapon];r.shot=1;r.events.push({type:'shot',weapon:r.weapon,x:r.x,y:r.y,z:eye(r)});r.repeat=r.lastWeapon===r.weapon?r.repeat+1:0;r.lastWeapon=r.weapon;
 const pellets=r.weapon===1?9:1,pierce=r.weapon===2||(secondary&&r.weapon===0);let hits=0;
 for(let i=0;i<pellets;i++){const offset=pellets>1?(i-4)/4:0,a=r.angle+offset*w.cone,pitch=r.pitch+(pellets>1?Math.sin(i*2.4)*.075:0),wallHit=castRay(r.course,r.x,r.y,a,w.range),wall=wallHit.dist,oz=eye(r),slope=Math.tan(pitch),floor=slope<0?Math.max(0,(.01-oz)/slope):Infinity,max=Math.min(w.range,wall,floor);let end=max;
 const targets=r.course.enemies.filter(e=>!e.dead).map(e=>{const dx=e.x-r.x,dy=e.y-r.y,along=dx*Math.cos(a)+dy*Math.sin(a),side=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a));return{e,along,side,z:oz+along*slope};}).filter(t=>t.along>0&&t.along<max+.01&&t.side<.16&&t.z>=0&&t.z<.52).sort((a,b)=>a.along-b.along);
 const coin=r.weapon===0?world.coins.find(c=>{const dx=c.x-r.x,dy=c.y-r.y,d=dx*Math.cos(a)+dy*Math.sin(a);return d>0&&d<max&&Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))<.085&&Math.abs(c.z-(oz+d*slope))<.085;}):null;
 if(coin){coin.life=0;const target=r.course.enemies.filter(e=>!e.dead&&castRay(r.course,coin.x,coin.y,Math.atan2(e.y-coin.y,e.x-coin.x)).dist>Math.hypot(e.x-coin.x,e.y-coin.y)-.1).sort((a,b)=>Math.hypot(a.x-coin.x,a.y-coin.y)-Math.hypot(b.x-coin.x,b.y-coin.y))[0];if(target){damageEnemy(r,target,9,'+ RICOCHET');award(r,180,'+ RICOCHET');world.tracers.push({id:world.nextId++,x:coin.x,y:coin.y,z:coin.z,tx:target.x,ty:target.y,tz:.4,ownerId:playerId(r),life:.22,duration:.22,weapon:0,ricochet:true,rail:true});hits++;}continue;}
 const core=world.projectiles.find(p=>{if(!p.core||p.life<=0)return false;const dx=p.x-r.x,dy=p.y-r.y,d=dx*Math.cos(a)+dy*Math.sin(a);return d>0&&d<max&&Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))<.14&&Math.abs(p.z-(oz+d*slope))<.14;});if(core){core.life=0;core.nuke=r.weapon===2;explode(world,core);award(r,core.nuke?350:120,core.nuke?'+ CORE NUKE':'+ CORE SHOT');hits++;continue;}for(const t of targets.slice(0,pierce?100:1)){const head=t.z>.38;damageEnemy(r,t.e,w.damage*(head?1.5:1)*(secondary&&r.weapon===0?2:1),head?'+ HEADSHOT':'+ ELIMINATED',{x:r.x+Math.cos(a)*t.along,y:r.y+Math.sin(a)*t.along,z:t.z});hits++;if(!pierce)end=t.along;}
 if(pellets===1||i%2===0)(r.world||r).tracers.push({id:(r.world||r).nextId++,x:r.x,y:r.y,z:oz,tx:r.x+Math.cos(a)*end,ty:r.y+Math.sin(a)*end,tz:oz+slope*end,surface:(!pierce&&targets.length)?'flesh':floor<=wall&&floor<=w.range?'floor':wall<w.range&&oz+slope*end<=1.45?'wall':'air',normal:floor<=wall&&floor<=w.range?{x:0,y:0,z:1}:wallHit.side===0?{x:-Math.sign(Math.cos(a)),y:0,z:0}:{x:0,y:-Math.sign(Math.sin(a)),z:0},ownerId:playerId(r),life:.18,duration:.18,weapon:r.weapon,hit:targets.length>0,rail:r.weapon===2});}
 if(hits)award(r,Math.max(8,55-r.repeat*9)*(r.weapon===1?1:1.3),r.repeat<1?'+ FRESH WEAPON':'+ HIT');return true;
}
export function tickPlayer(r,dt,input={}){if(r.mode!=='play'||r.health<=0)return;dt=clamp(dt,0,.05);r.time+=dt;
 for(const key of ['shot','damage','heal','punch','hookTime','hookCooldown','parryTime','parryCooldown','dashTime','altCooldown'])r[key]=Math.max(0,r[key]-dt*(key==='shot'?7:1));for(let i=0;i<weapons.length;i++)r.cooldowns[i]=Math.max(0,r.cooldowns[i]-dt);r.fireCooldown=r.cooldowns[r.weapon];
 r.angle=angleDiff(r.angle+(input.turn||0)*dt*2,0);r.pitch=clamp(r.pitch+(input.lookY||0)*dt,-1.35,1.35);r.energy=clamp(r.energy+dt*22,0,100);if(r.coinCharges<4){r.coinRegen+=dt;if(r.coinRegen>=2){r.coinCharges++;r.coinRegen=0;}}
 const jump=input.jump&&!r.pressed.jump,dash=input.dash&&!r.pressed.dash,wasAir=r.z>.001,wasSliding=r.slide>.55;r.pressed={jump:!!input.jump,dash:!!input.dash};let f=input.forward||0,s=input.strafe||0;if(r.autoRun&&f===0)f=1;const length=Math.max(1,Math.hypot(f,s));f/=length;s/=length;const dx=Math.cos(r.angle)*f-Math.sin(r.angle)*s,dy=Math.sin(r.angle)*f+Math.cos(r.angle)*s;
 if(jump){if(r.z<=.001){r.vz=2.05;r.events.push({type:'jump',x:r.x,y:r.y,z:r.z});}else if(r.wallJumps<3&&!canStand(r.course,r.x,r.y,.2)){r.vz=1.8;r.wallJumps++;r.vx=-Math.cos(r.angle)*1.4;r.vy=-Math.sin(r.angle)*1.4;award(r,20,'+ WALL JUMP');}}
 if(dash&&r.energy>=33){r.energy-=33;r.dashTime=.18;const len=Math.hypot(dx,dy);r.vx=(len?dx:Math.cos(r.angle))*6;r.vy=(len?dy:Math.sin(r.angle))*6;r.vz=Math.max(0,r.vz);r.events.push({type:'dash',x:r.x,y:r.y,z:r.z});}
 if(input.slide&&r.z>.12){r.slam=true;r.vz=-5;}
 r.slide+=(Number(!!input.slide&&r.z<.05)-r.slide)*(1-Math.exp(-dt*20));if(r.slide>.55&&!wasSliding)r.events.push({type:'slide',x:r.x,y:r.y,z:r.z});
 if(r.dashTime<=0){const speed=r.slide>.5?3.25:2.05,acc=r.z>.05?5:18;if(r.slide>.5){const heading=Math.hypot(r.vx,r.vy)>.1?Math.atan2(r.vy,r.vx):r.angle;r.vx+=(Math.cos(heading)*speed-r.vx)*dt*4;r.vy+=(Math.sin(heading)*speed-r.vy)*dt*4;}else{r.vx+=(dx*speed-r.vx)*(1-Math.exp(-dt*acc));r.vy+=(dy*speed-r.vy)*(1-Math.exp(-dt*acc));}}
 if(r.hookTime>0){const target=r.course.enemies.find(e=>e.id===r.hookTarget&&!e.dead);if(target){const dx=target.x-r.x,dy=target.y-r.y,d=Math.hypot(dx,dy);if(d>.5){if(target.kind===2){r.vx=dx/d*4.2;r.vy=dy/d*4.2;r.vz=Math.max(r.vz,.35);}else{const ex=target.x-dx/d*dt*5,ey=target.y-dy/d*dt*5;if(canStand(r.course,ex,ey,.16)){target.x=ex;target.y=ey;}}}else r.hookTime=0;}else r.hookTime=0;}
 const ox=r.x,oy=r.y;move(r,r.vx*dt,r.vy*dt);r.speed=Math.hypot(r.x-ox,r.y-oy)/Math.max(dt,.0001);r.distance+=r.speed*dt;
 if(r.dashTime<=0)r.vz-=5.5*dt;r.z=Math.max(0,r.z+r.vz*dt);if(r.z===0){r.vz=0;r.wallJumps=0;if(r.slam){r.slam=false;for(const e of r.course.enemies)if(!e.dead&&Math.hypot(e.x-r.x,e.y-r.y)<1.15&&castRay(r.course,r.x,r.y,Math.atan2(e.y-r.y,e.x-r.x)).dist>Math.hypot(e.x-r.x,e.y-r.y)-.1)damageEnemy(r,e,5,'+ GROUND SLAM');r.events.push({type:'slam',x:r.x,y:r.y,z:0});}else if(wasAir)r.events.push({type:'land',x:r.x,y:r.y,z:0});}
}
// Recompute a short grid route only when cover blocks line of sight.
function enemyWaypoint(course,e,target){
 const w=course.w,start=Math.floor(e.y)*w+Math.floor(e.x),goal=Math.floor(target.y)*w+Math.floor(target.x),queue=[start],previous=new Map([[start,-1]]);
 for(let i=0;i<queue.length;i++){const cell=queue[i];if(cell===goal)break;const x=cell%w,y=Math.floor(cell/w);for(const[dx,dy,side]of[[1,0,1],[-1,0,3],[0,1,2],[0,-1,0]]){const nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=course.h||course.cells[cell][side]||previous.has(n))continue;previous.set(n,cell);queue.push(n);}}
 if(!previous.has(goal))return{x:e.x,y:e.y};let next=goal;while(previous.get(next)!==-1&&previous.get(next)!==start)next=previous.get(next);return{x:next%w+.5,y:Math.floor(next/w)+.5};
}
export function tick(r,dt,input={}){if(r.mode!=='play')return;dt=clamp(dt,0,.05);tickPlayer(r,dt,input);
 for(const e of r.course.enemies){
 e.flash=Math.max(0,e.flash-dt);e.strike=Math.max(0,(e.strike||0)-dt);e.stagger=Math.max(0,(e.stagger||0)-dt);if(e.dead)continue;const profile=enemyProfile(e);
 const target=r.peer&&r.peer.health>0&&(r.health<=0||Math.hypot(r.peer.x-e.x,r.peer.y-e.y)<Math.hypot(r.x-e.x,r.y-e.y))?r.peer:r;
 const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx),visible=castRay(r.course,e.x,e.y,a).dist>d-.1;
 e.attack=Math.max(0,e.attack-dt);e.phase+=dt;
 if(e.stagger>0){e.attacking=false;e.windup=0;continue;}
 if(!e.attacking&&(!visible||d>(profile.role==='rush'?.34:profile.role==='teleport'?1.8:2.3))){
  e.navTimer=(e.navTimer||0)-dt;let heading=a;
  if(!visible){if(e.navTimer<=0||!e.navPoint||Math.hypot(e.x-e.navPoint.x,e.y-e.navPoint.y)<.16){e.navPoint=enemyWaypoint(r.course,e,target);e.navTimer=.35;}heading=Math.atan2(e.navPoint.y-e.y,e.navPoint.x-e.x);}
  const sp=e.moveSpeed||profile.speed||.30,mx=Math.cos(heading)*sp*dt,my=Math.sin(heading)*sp*dt;
  if(canStand(r.course,e.x+mx,e.y,.16))e.x+=mx;if(canStand(r.course,e.x,e.y+my,.16))e.y+=my;
 }
 const eligible=visible&&(e.kind===0?d<.48&&target.z<.25:d<13);
 if(!eligible){e.attacking=false;e.windup=0;}
 else if(e.attack<=0){
  if(!e.attacking){e.attacking=true;e.windup=e.windupTime??profile.windup??(e.kind===0?.28:e.kind===2?.65:.48);e.eventsSeen=0;}
  e.windup=Math.max(0,e.windup-dt);
  if(e.windup<=0){e.attacking=false;e.strike=.22;e.attack=e.attackCooldown??profile.attack??(e.kind===0?.8:e.kind===2?2.6:1.9);r.events.push({type:'enemy-attack',x:e.x,y:e.y,z:.32,enemyId:e.id,enemyKind:e.kind,variant:e.variant||'stalker'});
   if(profile.role==='rush')hurt(target,e.contactDamage??profile.contactDamage??12);
   else{const speed=e.projectileSpeed??profile.projectileSpeed??(e.kind===2?1.4:1.05);r.projectiles.push({id:r.nextId++,kind:'enemy',x:e.x,y:e.y,z:.32,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,vz:(eye(target)-.32)/Math.max(.1,d)*speed,life:9,reflected:false,enemyId:e.id,enemyKind:e.kind});}
  }
 }
 }
 for(const p of r.projectiles){
  p.age=(p.age||0)+dt;
  p.life-=dt;
  if(p.core)p.vz-=2*dt;
  for(const defender of [r,...(r.peer?[r.peer]:[])]){
   if(defender.health<=0||p.life<=0)continue;
   const pd=Math.hypot(p.x-defender.x,p.y-defender.y,p.z-eye(defender));
   if(!p.reflected&&defender.parryTime>0&&pd<.8&&Math.abs(angleDiff(Math.atan2(p.y-defender.y,p.x-defender.x),defender.angle))<1.2&&castRay(r.course,defender.x,defender.y,Math.atan2(p.y-defender.y,p.x-defender.x)).dist>Math.hypot(p.x-defender.x,p.y-defender.y)-.1){
    p.reflected=true;p.ownerId=playerId(defender);
    const target=r.course.enemies.filter(e=>!e.dead).sort((a,b)=>Math.abs(angleDiff(Math.atan2(a.y-p.y,a.x-p.x),defender.angle))-Math.abs(angleDiff(Math.atan2(b.y-p.y,b.x-p.x),defender.angle)))[0];
    const pa=target?Math.atan2(target.y-p.y,target.x-p.x):defender.angle,pd2=target?Math.hypot(target.x-p.x,target.y-p.y):5;
    p.vx=Math.cos(pa)*(p.kind==='rocket'?5.4:4);p.vy=Math.sin(pa)*(p.kind==='rocket'?5.4:4);p.vz=target?(.28-p.z)/(Math.max(.1,pd2))*(p.kind==='rocket'?5.4:4):Math.sin(defender.pitch)*(p.kind==='rocket'?5.4:4);
    defender.health=Math.min(100,defender.health+15);award(defender,200,'+ PARRY');r.events.push({type:'parry',x:defender.x,y:defender.y,z:eye(defender),weapon:defender.weapon});
   }
  }
  if(p.life<=0)continue;
  const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*dt/.12));
  let detonated=false;
  for(let stepIndex=0;stepIndex<steps;stepIndex++){
   if(p.life<=0)break;
   const stepDt=dt/steps,travel=Math.hypot(p.vx,p.vy)*stepDt;
   const blocked=castRay(r.course,p.x,p.y,Math.atan2(p.vy,p.vx),travel+.01).dist<=travel;
   if(blocked){if(p.core||p.kind==='rocket')explode(r,p);p.life=0;detonated=true;break;}
   p.x+=p.vx*stepDt;p.y+=p.vy*stepDt;p.z+=p.vz*stepDt;
   if(p.z<0||p.z>1.5){if(p.core||p.kind==='rocket')explode(r,p);p.life=0;detonated=true;break;}
   if(p.kind==='rocket'){
    const enemy=r.course.enemies.find(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<.2&&p.z<.65);
    if(enemy){explode(r,p);p.life=0;detonated=true;break;}
   }else if(p.reflected){
    const enemy=r.course.enemies.find(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<.22&&p.z<.6);
    if(enemy){if(p.core)explode(r,p);else damageEnemy(r,enemy,14,'+ RETURN TO SENDER',{x:p.x,y:p.y,z:p.z});p.life=0;break;}
   }else{
    const defender=[r,...(r.peer?[r.peer]:[])].find(player=>player.health>0&&Math.hypot(p.x-player.x,p.y-player.y)<.15&&Math.abs(p.z-(eye(player)-.1))<.22);
    if(defender){hurt(defender,15);p.life=0;break;}
   }
  }
  if(detonated)continue;
 } for(const c of r.coins){c.life-=dt;c.vz-=1.4*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.z+=c.vz*dt;if(c.z<0)c.life=0;}r.coins=r.coins.filter(c=>c.life>0);
 r.projectiles=r.projectiles.filter(p=>p.life>0);for(const x of (r.explosions||[]))x.life-=dt;r.explosions=(r.explosions||[]).filter(x=>x.life>0);for(const p of r.gore){p.life-=dt;if(p.z>0){p.vz-=3*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z=Math.max(0,p.z+p.vz*dt);}}r.gore=r.gore.filter(p=>p.life>0);for(const t of r.tracers)t.life-=dt;r.tracers=r.tracers.filter(t=>t.life>0);
 r.style=Math.max(0,r.style-dt*35);r.rank=r.style>1400?'SSS':r.style>1100?'SS':r.style>800?'S':r.style>550?'A':r.style>300?'B':r.style>120?'C':'D';
 if(r.campaign){
  updateCampaignDirector(r,dt);
  updateRoomProgression(r,dt);
  checkCampaignExit(r);
 }else if(!r.course.enemies.some(e=>!e.dead)){
  if(r.wave<3){r.waveDelay-=dt;if(r.waveDelay<=0){spawnWave(r);r.waveDelay=2;}}
  else if(Math.hypot(r.x-r.course.exit.x,r.y-r.course.exit.y)<.6||(r.peer&&Math.hypot(r.peer.x-r.course.exit.x,r.peer.y-r.course.exit.y)<.6)){r.mode='win';r.events.push({type:'win',x:r.x,y:r.y,z:eye(r)});}
 } if(r.peer){r.peer.style=Math.max(0,r.peer.style-dt*35);r.peer.rank=styleRank(r.peer.style);if(r.health<=0&&r.peer.health>0){r.respawnTime=(r.respawnTime||0)+dt;if(r.respawnTime>3){r.x=r.peer.x;r.y=r.peer.y;r.z=0;r.health=65;r.respawnTime=0;}}if(r.peer.health<=0&&r.health>0){r.peer.respawnTime=(r.peer.respawnTime||0)+dt;if(r.peer.respawnTime>3){r.peer.x=r.x;r.peer.y=r.y;r.peer.z=0;r.peer.health=65;r.peer.respawnTime=0;}}}if(r.health<=0&&(!r.peer||r.peer.health<=0)){r.mode='dead';r.events.push({type:'dead'});}
}

export const styleRank=v=>v>1400?"SSS":v>1100?"SS":v>800?"S":v>550?"A":v>300?"B":v>120?"C":"D";
export function addPeer(r){const p=newRun(r.course,{requireEntry:r.roomProgression?.requireEntry===true});p.x=(r.course.playerSpawn?.x??6)+.5;p.y=r.course.playerSpawn?.y??10.5;p.mode='play';p.playerId='peer';p.world=r;p.roomProgression=r.roomProgression||p.roomProgression;if(p.roomProgression)syncRoomGateCells(r.course,p.roomProgression);r.peer=p;return p;}

function explode(r,p){
 if(p.exploded)return;
 p.exploded=true;
 const rocket=p.kind==='rocket',radius=rocket?(p.radius||1.65):(p.nuke?2.3:1.1),baseDamage=rocket?(p.damage||24):(p.nuke?22:9);
 const owner=p.ownerId==='peer'?r.peer:p.ownerId==='host'?r:null;
 const attacker=owner||r;
 for(const e of r.course.enemies){
  const d=Math.hypot(e.x-p.x,e.y-p.y);
  if(!e.dead&&d<radius&&castRay(r.course,p.x,p.y,Math.atan2(e.y-p.y,e.x-p.x)).dist>d-.1){
   const falloff=Math.max(.12,1-d/radius);
   damageEnemy(attacker,e,Math.max(2,baseDamage*falloff),rocket?'+ RIFT BLAST':p.nuke?'+ CORE NUKE':'+ CORE BLAST',{x:p.x,y:p.y,z:p.z});
   const dx=e.x-p.x,dy=e.y-p.y,len=Math.max(.1,d);
   e.x+=dx/len*(rocket?falloff*.22:0);e.y+=dy/len*(rocket?falloff*.22:0);
  }
 }
 if(rocket&&p.selfBoost&&owner&&owner.health>0){
  const dx=owner.x-p.x,dy=owner.y-p.y,d=Math.hypot(dx,dy);
  if(d<radius){
   const len=Math.max(.1,d),boost=Math.max(.35,1-d/radius);
   owner.vx+=dx/len*(p.knockback||4.8)*boost;owner.vy+=dy/len*(p.knockback||4.8)*boost;owner.vz=Math.max(owner.vz,.8+(p.knockback||4.8)*.7*boost);
   owner.events.push({type:'rocket-jump',weapon:3,x:p.x,y:p.y,z:p.z,projectileId:p.id});
  }
 }
 if(!Array.isArray(r.explosions))r.explosions=[];
 r.explosions.push({id:p.id,x:p.x,y:p.y,z:p.z,radius,life:1.0,maxLife:1.0,weapon:rocket?3:(p.weapon||1),intensity:rocket?1.5:1});
 r.explosions=r.explosions.slice(-80);
 burst(r,{id:p.id,x:p.x,y:p.y,z:p.z},rocket?48:24,{x:p.x,y:p.y,z:p.z});
 r.events.push({type:'explosion',weapon:rocket?3:(p.weapon||1),x:p.x,y:p.y,z:p.z,radius,projectileId:p.id});
}
export function grapple(r){if(r.mode!=='play'||r.health<=0||r.hookCooldown>0)return false;const target=r.course.enemies.filter(e=>!e.dead).map(e=>({e,d:Math.hypot(e.x-r.x,e.y-r.y),a:Math.atan2(e.y-r.y,e.x-r.x)})).filter(t=>t.d<7&&Math.abs(angleDiff(t.a,r.angle))<.3&&castRay(r.course,r.x,r.y,t.a).dist>t.d-.1).sort((a,b)=>a.d-b.d)[0];if(!target)return false;r.hookTarget=target.e.id;r.hookTime=.65;r.hookCooldown=1;award(r,35,'+ TETHER');r.events.push({type:'hook'});return true;}
