// Authoritative vermin simulation. Coordinates use the arena's four-metre
// cells, with z up. Meshes, skeletons and render frame clocks never enter here.
export const VERMIN_LIMITS = Object.freeze({ rats:16, roaches:48 });
export const VERMIN_TIMING = Object.freeze({ pickup:.36, release:.3, stuff:.86, contact:.32,
  biteGrace:1.35, biteInterval:1.4, maxHold:8, infestation:3, infestationInterval:.6,
  warning:2.2, active:5.2, cooldown:32, crawl:4.2 });
const RAT_FLOOR=.014, PICKUP_RANGE=.35, STUFF_RANGE=.32, THROW_GRAVITY=9.81/4;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const numeric=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const hash=(a,b=0)=>{ let n=(a^Math.imul(b+1,0x9e3779b1))>>>0;n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return ((n^(n>>>16))>>>0)/4294967296; };
let environment={canStand:()=>false,castRay:()=>({dist:0}),hurt:()=>{},damageEnemy:()=>{},releaseBite:()=>{}};
export function installVerminEnvironment(value){environment={...environment,...value};}
const worldOf=p=>p?.world||p;
const idOf=p=>p?.playerId||'host';
const playersOf=w=>w.peer?[w,w.peer]:[w];
const isAuthoritative=w=>!!w&&!(w.playerId==='peer'&&!w.world);
const active=p=>p?.mode==='play'&&p.health>0;
const armsAvailable=p=>p.playerWounds?.leftArm!=='severed'&&p.playerWounds?.rightArm!=='severed';
const actionConflict=p=>p.brutal?.phase&&p.brutal.phase!=='idle'||p.extraction?.phase&&p.extraction.phase!=='idle';
const handOccupied=p=>!!p?.verminHand&&p.verminHand.phase!=='idle';
function seedFor(course){let seed=0x811c9dc5;for(const ch of String(course?.sectorId||course?.name||'vermin'))seed=Math.imul(seed^ch.charCodeAt(0),16777619);return (seed^(course?.dungeonIndex||0)*97)>>>0;}
export function makeVerminHand(sequence=0){return{phase:'idle',ratId:null,enemyId:null,channel:'mouth',elapsed:0,sequence,bites:0,holdAge:0,contactAt:VERMIN_TIMING.contact,duration:VERMIN_TIMING.stuff,contactApplied:false,reason:''};}
export function makeVerminCrawl(sequence=0){return{phase:'idle',elapsed:0,sequence,kind:'roach',count:0,weapon:false,duration:VERMIN_TIMING.crawl};}
export function createVerminState(course){
  const seed=seedFor(course),state={rats:[],roaches:[],scent:0,scentTarget:null,sequence:0,seed,age:0,lastKills:0,lastHits:0,lastBloodId:0,lastWounds:0,
    swarm:{phase:'idle',elapsed:0,duration:0,sequence:0,cooldown:12,nextAmbientAt:48}};
  const spawn=course?.playerSpawn||{x:6,y:10.5};
  const candidates=[];
  for(let y=0;y<(course?.h||0);y++)for(let x=0;x<(course?.w||0);x++){
    const px=x+.19+hash(seed,x+y*course.w)*.62,py=y+.2+hash(seed,x+y*course.w+103)*.6;
    if(Math.hypot(px-spawn.x,py-spawn.y)>=1.1&&environment.canStand(course,px,py,.04))candidates.push({x:px,y:py,order:hash(seed,x+y*course.w+901)});
  }
  candidates.sort((a,b)=>a.order-b.order);
  // The authored entry corridor gets one visible, reachable scavenger. The
  // old compact combat lab keeps ambient animals away from its test spawn.
  if(course?.dungeon||course?.campaign){
    for(const offset of [0,.16,-.16,.35,-.35]){
      const a=(spawn.angle||0)+offset,d=.62,point={x:spawn.x+Math.cos(a)*d,y:spawn.y+Math.sin(a)*d,order:-1};
      if(environment.canStand(course,point.x,point.y,.04)&&environment.castRay(course,spawn.x,spawn.y,a,d+.05).dist>d-.008){candidates.unshift(point);break;}
    }
  }
  const ratCount=Math.min(course?.dungeon?14:course?.campaign?10:5,candidates.length),roachCount=Math.min(course?.dungeon?42:course?.campaign?30:12,candidates.length);
  for(let i=0;i<ratCount;i++){
    const p=candidates[i];state.rats.push({id:100000+i,x:p.x,y:p.y,z:RAT_FLOOR,angle:hash(seed,i+41)*Math.PI*2,state:'floor',ownerId:null,enemyId:null,age:0,seed:(seed+i*71)>>>0,speed:.045+hash(seed,i+87)*.025,turn:0,holdAge:0,flightAge:0,ttl:0});
  }
  for(let i=0;i<roachCount;i++){
    const p=candidates[(i+ratCount)%candidates.length];state.roaches.push({id:200000+i,x:p.x,y:p.y,z:.004,angle:hash(seed,i+401)*Math.PI*2,age:0,seed:(seed+i*29)>>>0,speed:.023+hash(seed,i+91)*.03,turn:0});
  }
  return state;
}
export function resetVerminWorld(world){
  world.vermin=createVerminState(world.course);world._verminCourse=world.course;
  for(const p of playersOf(world)){p.vermin=world.vermin;p.verminHand=makeVerminHand(p.verminHand?.sequence||0);p.verminCrawl=makeVerminCrawl(p.verminCrawl?.sequence||0);p._verminHarvestPressed=false;p._verminHarvestConsumed=false;}
  return world.vermin;
}
function ensureWorld(world){if(!world.vermin||world._verminCourse&&world._verminCourse!==world.course)return resetVerminWorld(world);world._verminCourse=world.course;return world.vermin;}
function visible(course,a,b,tolerance=.008){const d=Math.hypot(b.x-a.x,b.y-a.y);return d<.001||environment.castRay(course,a.x,a.y,Math.atan2(b.y-a.y,b.x-a.x),d+.04).dist>d-tolerance;}
function emit(p,type,extra={}){p.events?.push({type,playerId:idOf(p),sequence:p.verminHand?.sequence||0,x:p.x,y:p.y,z:(p.z||0)+.3,...extra});}
function findRat(p){return worldOf(p)?.vermin?.rats.find(r=>r.id===p.verminHand?.ratId&&r.ownerId===idOf(p));}
export function nearestRat(player){
  if(!active(player)||!armsAvailable(player)||actionConflict(player)||handOccupied(player)||player.z>.08||player.pitch>-.22||['windup','held','terminal'].includes(player.bite?.phase))return null;
  const world=worldOf(player),rats=world?.vermin?.rats||player.vermin?.rats||[];
  let nearest=null,distance=PICKUP_RANGE;
  for(const rat of rats){if(rat.state!=='floor'||rat.ownerId)continue;const d=Math.hypot(rat.x-player.x,rat.y-player.y);
    if(d>distance||Math.abs(angleDiff(Math.atan2(rat.y-player.y,rat.x-player.x),player.angle))>.95||!visible(player.course,player,rat))continue;
    nearest=rat;distance=d;
  }
  return nearest;
}
function supportedEnemy(e){return !!e&&!e.dead&&e.hp>0&&e.kind===0&&!e.boss&&!e.isBoss&&!['brute','bellwraith','lurker'].includes(e.variant);}
export function verminTarget(player){
  const h=player?.verminHand;if(!active(player)||!armsAvailable(player)||actionConflict(player)||h?.phase!=='held'||!findRat(player)||(player.z||0)>.22)return null;
  const world=worldOf(player);let target=null,distance=STUFF_RANGE;
  for(const e of player.course?.enemies||[]){
    if(!supportedEnemy(e)||e.verminInfestation?.remaining>0||(e.z||e.meleeZ||0)>.28)continue;
    if(['windup','held'].includes(player.bite?.phase)&&player.bite.enemyId!==e.id)continue;
    if(playersOf(world).some(p=>p!==player&&p.verminHand?.phase==='stuff'&&p.verminHand.enemyId===e.id||p!==player&&p.brutal?.phase!=='idle'&&p.brutal?.enemyId===e.id))continue;
    const d=Math.hypot(e.x-player.x,e.y-player.y),a=Math.atan2(e.y-player.y,e.x-player.x);
    if(d>distance+1e-8||Math.abs(angleDiff(a,player.angle))>.8||!visible(player.course,player,e))continue;
    target=e;distance=d;
  }
  if(!target)return null;
  return{enemyId:target.id,channel:player.bite?.phase==='held'&&player.bite.enemyId===target.id||player.pitch>=-.16?'mouth':'stomach',distance};
}
function handAnchor(p){const a=p.angle||0;return{x:p.x+Math.cos(a)*.1+Math.sin(a)*.035,y:p.y+Math.sin(a)*.1-Math.cos(a)*.035,z:Math.max(RAT_FLOOR,(p.z||0)+.30)};}
function floorRat(world,rat,p,reason){
  const proposed=handAnchor(p),course=world.course;
  const uncommitted=p.verminHand?.phase==='pickup'&&p.verminHand.elapsed<VERMIN_TIMING.pickup*.55;
  const locations=uncommitted?[{x:rat.pickupX,y:rat.pickupY},proposed,{x:p.x,y:p.y},{x:rat.x,y:rat.y}]:[proposed,{x:p.x,y:p.y},{x:rat.x,y:rat.y}];
  const spot=locations.find(point=>environment.canStand(course,point.x,point.y,.024))||{x:course.playerSpawn?.x||p.x,y:course.playerSpawn?.y||p.y};
  rat.x=spot.x;rat.y=spot.y;rat.z=RAT_FLOOR;rat.state='floor';rat.ownerId=null;rat.enemyId=null;rat.age=0;rat.turn=.8;rat.holdAge=0;rat.flightAge=0;
  emit(p,'vermin-drop',{ratId:rat.id,reason});
}
export function cancelVermin(player,reason='cancelled'){
  if(!handOccupied(player))return false;
  const h=player.verminHand,world=worldOf(player),rat=findRat(player);
  if(rat?.state==='held')floorRat(world,rat,player,reason);
  player.verminHand={...makeVerminHand(h.sequence),reason};return true;
}
export function useVermin(player){
  const world=worldOf(player);if(!isAuthoritative(world)||!active(player)||!armsAvailable(player)||actionConflict(player))return false;
  ensureWorld(world);player.verminHand||=makeVerminHand();
  const h=player.verminHand;
  if(h.phase==='held'){
    const rat=findRat(player);if(!rat||rat.state!=='held')return false;
    const start=handAnchor(player),speed=2.5,up=Math.sin(clamp(player.pitch||0,-1.2,1.2)),horizontal=Math.cos(clamp(player.pitch||0,-1.2,1.2));
    rat.state='thrown';rat.x=start.x;rat.y=start.y;rat.z=start.z;rat.angle=player.angle;rat.flightAge=0;
    rat.startX=start.x;rat.startY=start.y;rat.startZ=start.z;rat.vx=Math.cos(player.angle)*speed*horizontal;rat.vy=Math.sin(player.angle)*speed*horizontal;rat.vz=up*speed+.4;rat.age=0;
    h.phase='release';h.elapsed=0;h.duration=VERMIN_TIMING.release;emit(player,'vermin-throw',{ratId:rat.id});return true;
  }
  if(h.phase!=='idle')return false;
  const rat=nearestRat(player);if(!rat)return false;
  // Ownership changes immediately; a second player cannot reserve the same rat.
  rat.state='held';rat.ownerId=idOf(player);rat.age=0;rat.holdAge=0;rat.pickupX=rat.x;rat.pickupY=rat.y;rat.pickupZ=rat.z;
  world.vermin.sequence++;
  player.verminHand={...makeVerminHand(h.sequence+1),phase:'pickup',ratId:rat.id,duration:VERMIN_TIMING.pickup};
  player.rifleBurst=0;player.rifleBurstTimer=0;player.rifleCharge=0;player.rifleCharging=false;player.meleeActive=false;player.sawActive=false;
  emit(player,'vermin-pickup',{ratId:rat.id});return true;
}
export function interceptVerminInput(player,input){
  const down=!!input.harvest,rising=down&&!player._verminHarvestPressed;player._verminHarvestPressed=down;
  if(!down)player._verminHarvestConsumed=false;
  const hasSequence=Number.isSafeInteger(input.vermin)&&input.vermin>=0;
  const previous=player._verminSequenceConsumed||0,edge=hasSequence?input.vermin>previous:rising;
  if(!input.predictWeapons&&edge){
    if(hasSequence)player._verminSequenceConsumed=input.vermin;
    if(useVermin(player))player._verminHarvestConsumed=down;
  }
  return !!player._verminHarvestConsumed||handOccupied(player);
}
export function attackVermin(player){
  const world=worldOf(player);if(!isAuthoritative(world))return false;
  const candidate=verminTarget(player);if(!candidate)return false;
  const h=player.verminHand,e=player.course.enemies.find(e=>e.id===candidate.enemyId);
  h.phase='stuff';h.elapsed=0;h.enemyId=e.id;h.channel=candidate.channel;h.duration=VERMIN_TIMING.stuff;h.contactAt=VERMIN_TIMING.contact;h.contactApplied=false;
  e.stagger=Math.max(e.stagger||0,h.contactAt+.1);e.attacking=false;e.windup=0;e.strike=0;e.slashHit=true;
  if(e.mind){e.mind.token=false;e.mind.justAttacked=false;}
  if(['windup','held'].includes(player.bite?.phase)&&player.bite.enemyId===e.id)environment.releaseBite(player,'vermin-counter',true);
  emit(player,'vermin-stuff',{ratId:h.ratId,enemyId:e.id,channel:h.channel});return true;
}
function infest(world,owner,rat,e,channel,thrown=false){
  if(!supportedEnemy(e)||e.verminInfestation?.remaining>0)return false;
  rat.state='infesting';rat.enemyId=e.id;rat.age=0;rat.ttl=4;rat.z=channel==='mouth'?.48:.29;
  const sequence=++world.vermin.sequence;
  // Latch first; existing engine death/scoring callbacks run exactly once.
  e.verminInfestation={channel,remaining:thrown?2.4:VERMIN_TIMING.infestation,tick:0,sequence,ownerId:idOf(owner),ratId:rat.id,age:0};
  e.stagger=Math.max(e.stagger||0,.65);e.attacking=false;e.windup=0;e.strike=0;e.slashHit=true;
  environment.damageEnemy(owner,e,thrown?1.2:2,'+ RAT INFESTATION',{x:e.x,y:e.y,z:rat.z,brutal:true,vermin:true});
  emit(owner,'vermin-infest',{ratId:rat.id,enemyId:e.id,channel,thrown,infestationSequence:sequence,x:e.x,y:e.y,z:rat.z});return true;
}
function advanceHand(world,p,dt){
  p.verminHand||=makeVerminHand();p.verminCrawl||=makeVerminCrawl();const h=p.verminHand;
  if(h.phase==='idle')return;
  if(!active(p)||!armsAvailable(p)||actionConflict(p)){cancelVermin(p,!active(p)?'inactive':!armsAvailable(p)?'arm-unavailable':'action-conflict');return;}
  const rat=findRat(p)||((h.contactApplied||h.phase==='release')?world.vermin.rats.find(r=>r.id===h.ratId):null);if(!rat){cancelVermin(p,'rat-unavailable');return;}
  h.elapsed+=dt;
  if(h.phase==='release'){if(h.elapsed+1e-8>=VERMIN_TIMING.release)p.verminHand=makeVerminHand(h.sequence);return;}
  if(h.phase==='pickup'){
    if(['windup','held','terminal'].includes(p.bite?.phase)){cancelVermin(p,'grabbed');return;}
    if(h.elapsed<VERMIN_TIMING.pickup*.55&&(Math.hypot(p.x-rat.pickupX,p.y-rat.pickupY)>.45||(p.z||0)>.16||!visible(world.course,p,{x:rat.pickupX,y:rat.pickupY}))){cancelVermin(p,'pickup-out-of-reach');return;}
    const t=clamp(h.elapsed/VERMIN_TIMING.pickup,0,1),ease=t*t*(3-2*t),anchor=handAnchor(p);
    rat.x=rat.pickupX+(anchor.x-rat.pickupX)*ease;rat.y=rat.pickupY+(anchor.y-rat.pickupY)*ease;rat.z=rat.pickupZ+(anchor.z-rat.pickupZ)*ease;
    if(t>=1){h.phase='held';h.elapsed=0;h.holdAge=0;emit(p,'vermin-held',{ratId:rat.id});}return;
  }
  if(h.phase==='held'){
    const anchor=handAnchor(p);rat.x=anchor.x;rat.y=anchor.y;rat.z=anchor.z;rat.angle=p.angle;
    h.holdAge+=dt;rat.holdAge=h.holdAge;
    const bites=h.holdAge+1e-8>=VERMIN_TIMING.biteGrace?1+Math.floor((h.holdAge-VERMIN_TIMING.biteGrace+1e-8)/VERMIN_TIMING.biteInterval):0;
    if(bites>h.bites){h.bites=bites;environment.hurt(p,1,true);emit(p,'vermin-bite',{ratId:rat.id,damage:1,bites:h.bites});}
    if(h.holdAge+1e-8>=VERMIN_TIMING.maxHold)cancelVermin(p,'hold-timeout');return;
  }
  if(h.phase==='stuff'){
    const e=world.course.enemies.find(e=>e.id===h.enemyId);
    if(!h.contactApplied&&(!supportedEnemy(e)||Math.hypot(e.x-p.x,e.y-p.y)>STUFF_RANGE+.03||(p.z||0)>.24||Math.abs(angleDiff(Math.atan2(e.y-p.y,e.x-p.x),p.angle))>.95||!visible(world.course,p,e)||e.verminInfestation?.remaining>0)){
      h.phase='held';h.elapsed=0;h.enemyId=null;emit(p,'vermin-cancel',{ratId:rat.id,reason:'target-unavailable'});return;
    }
    if(!h.contactApplied){
      const anchor=handAnchor(p),t=clamp(h.elapsed/h.contactAt,0,1);rat.x=anchor.x+(e.x-anchor.x)*t;rat.y=anchor.y+(e.y-anchor.y)*t;rat.z=anchor.z+((h.channel==='mouth'?.48:.29)-anchor.z)*t;
      if(h.elapsed+1e-8>=h.contactAt){h.contactApplied=true;infest(world,p,rat,e,h.channel);}
    }
    if(h.elapsed+1e-8>=VERMIN_TIMING.stuff)p.verminHand=makeVerminHand(h.sequence);
  }
}
function segmentActorT(a,b,e){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,ex=a.x-e.x,ey=a.y-e.y,ez=a.z-((e.z||0)+.28),radius=.17;
  // A capsule surrogate: horizontal radius and a .56-cell tall torso.
  const denom=dx*dx+dy*dy;if(denom<1e-10)return null;
  const B=2*(ex*dx+ey*dy),C=ex*ex+ey*ey-radius*radius,disc=B*B-4*denom*C;if(disc<0)return null;
  const t=clamp((-B-Math.sqrt(disc))/(2*denom),0,1);
  if(C>0&&((-B-Math.sqrt(disc))/(2*denom)<0||(-B-Math.sqrt(disc))/(2*denom)>1))return null;
  return Math.abs(ez+dz*t)<=.3?t:null;
}
function advanceThrown(world,rat,dt){
  const owner=playersOf(world).find(p=>idOf(p)===rat.ownerId)||world;
  const steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps;
  for(let i=0;i<steps&&rat.state==='thrown';i++){
    const a={x:rat.x,y:rat.y,z:rat.z},t=rat.flightAge+step;
    const b={x:rat.startX+rat.vx*t,y:rat.startY+rat.vy*t,z:rat.startZ+rat.vz*t-.5*THROW_GRAVITY*t*t};
    const horizontal=Math.hypot(b.x-a.x,b.y-a.y),wall=horizontal>1e-8?environment.castRay(world.course,a.x,a.y,Math.atan2(b.y-a.y,b.x-a.x),horizontal+.03).dist:Infinity;
    let earliest=horizontal>1e-8&&wall<=horizontal+.025?clamp((wall-.025)/horizontal,0,1):Infinity,hit=null;
    for(const e of world.course.enemies||[]){if(!supportedEnemy(e)||e.verminInfestation?.remaining>0||!visible(world.course,a,e,.002))continue;const candidate=segmentActorT(a,b,e);if(candidate!==null&&candidate<earliest){earliest=candidate;hit=e;}}
    if(hit){rat.x=a.x+(b.x-a.x)*earliest;rat.y=a.y+(b.y-a.y)*earliest;rat.z=a.z+(b.z-a.z)*earliest;infest(world,owner,rat,hit,rat.z>.4?'mouth':'stomach',true);break;}
    if(earliest!==Infinity){rat.x=a.x+(b.x-a.x)*earliest;rat.y=a.y+(b.y-a.y)*earliest;rat.z=RAT_FLOOR;rat.state='floor';rat.ownerId=null;rat.flightAge=0;rat.turn=.8;emit(owner,'vermin-land',{ratId:rat.id,surface:'wall',x:rat.x,y:rat.y,z:rat.z});break;}
    rat.x=b.x;rat.y=b.y;rat.z=b.z;rat.flightAge=t;
    if(b.z<=RAT_FLOOR||t>=3){rat.z=RAT_FLOOR;rat.state='floor';rat.ownerId=null;rat.flightAge=0;rat.turn=.8;emit(owner,'vermin-land',{ratId:rat.id,surface:'floor',x:rat.x,y:rat.y,z:rat.z});}
  }
}
function woundedPlayer(p){const w=p.playerWounds;return p.health<100||(w?.neck||0)>0||(w?.torso||0)>0||!!w?.eviscerated||!!(w&&(w.leftArm&&w.leftArm!=='intact'||w.rightArm&&w.rightArm!=='intact'||w.leftLeg&&w.leftLeg!=='intact'||w.rightLeg&&w.rightLeg!=='intact'));}
function scentPlayer(world,point,requireVisible=false){
  let selected=null,distance=Infinity,wounded=false;
  // There are at most two survivors. Select locally without building a search
  // array or route; a visible wound takes priority, then the nearest survivor.
  for(let i=0;i<2;i++){
    const p=i===0?world:world.peer;if(!active(p)||requireVisible&&!visible(world.course,point,p))continue;
    const injured=woundedPlayer(p),d=(p.x-point.x)**2+(p.y-point.y)**2;
    if(selected&&(wounded&&!injured||injured===wounded&&d>=distance))continue;
    selected=p;distance=d;wounded=injured;
  }
  return selected;
}
function swarmWalk(world,item,dt,isRat){
  const radius=isRat?.024:.01,turnRate=isRat?2.8:4.8;
  const cached=world.vermin.scentTarget,target=cached?.kind==='blood'?cached:scentPlayer(world,item,true);
  let desired=item.angle,speed=item.speed*1.8;
  if(target&&visible(world.course,item,target)){
    desired=Math.atan2(target.y-item.y,target.x-item.x);
    if(Math.hypot(target.x-item.x,target.y-item.y)<.065)speed*=.2;
  }else{
    if(item.turn<=0){item.turn=.6+hash(item.seed,Math.floor(item.age*2)+73)*1.7;item.wanderAngle=item.angle+(hash(item.seed,Math.floor(item.age*2)+91)-.5)*1.4;}
    desired=item.wanderAngle??item.angle;
  }
  const probe=.06+radius;
  if(!environment.canStand(world.course,item.x+Math.cos(desired)*probe,item.y+Math.sin(desired)*probe,radius)){
    const side=hash(item.seed,13)>.5?1:-1;
    const left=desired+side*Math.PI/2,right=desired-side*Math.PI/2;
    if(environment.canStand(world.course,item.x+Math.cos(left)*probe,item.y+Math.sin(left)*probe,radius))desired=left;
    else if(environment.canStand(world.course,item.x+Math.cos(right)*probe,item.y+Math.sin(right)*probe,radius))desired=right;
    else desired=item.angle+side*Math.PI;
    item.wanderAngle=desired;item.turn=.2;
  }
  item.angle=angleDiff(item.angle+clamp(angleDiff(desired,item.angle),-turnRate*dt,turnRate*dt),0);
  const x=item.x+Math.cos(item.angle)*speed*dt,y=item.y+Math.sin(item.angle)*speed*dt;
  if(environment.canStand(world.course,x,y,radius)){item.x=x;item.y=y;}
}
function walk(world,item,dt,isRat){
  item.age+=dt;item.turn=(item.turn||0)-dt;
  if(world.vermin.swarm.phase==='active'){swarmWalk(world,item,dt,isRat);return;}
  if(item.turn<=0){item.turn=.6+hash(item.seed,Math.floor(item.age*2)+73)*1.7;item.angle+=((hash(item.seed,Math.floor(item.age*2)+91)-.5)*1.4);}
  const speed=item.speed,dx=Math.cos(item.angle)*speed*dt,dy=Math.sin(item.angle)*speed*dt,r=isRat?.024:.01;
  if(environment.canStand(world.course,item.x+dx,item.y+dy,r)){item.x+=dx;item.y+=dy;}
  else{item.angle+=Math.PI*.7;item.turn=.2;}
}
function advanceInfestations(world,dt){
  for(const e of world.course.enemies||[]){const infestation=e.verminInfestation;if(!infestation||infestation.remaining<=0)continue;
    if(e.dead){infestation.remaining=0;continue;}
    const activeTime=Math.min(dt,infestation.remaining);infestation.remaining=Math.max(0,infestation.remaining-dt);infestation.tick+=activeTime;infestation.age+=activeTime;
    const owner=playersOf(world).find(p=>idOf(p)===infestation.ownerId)||world;
    while(infestation.tick+1e-8>=VERMIN_TIMING.infestationInterval&&!e.dead){infestation.tick-=VERMIN_TIMING.infestationInterval;e.stagger=Math.max(e.stagger||0,.16);environment.damageEnemy(owner,e,.7,'+ RAT INFESTATION',{x:e.x,y:e.y,z:infestation.channel==='mouth'?.48:.29,brutal:true,vermin:true});}
  }
}
function advanceScent(world,dt){
  const state=world.vermin;let hits=0;for(const e of world.course.enemies||[])hits+=e.hits||0;
  let wounds=0;for(const p of playersOf(world))wounds+=(p.playerWounds?.neck||0)+(p.playerWounds?.torso||0)+Number(!!p.playerWounds?.eviscerated)*2;
  let bloodId=state.lastBloodId,newestBlood=null;
  for(const b of world.blood||[]){
    bloodId=Math.max(bloodId,b.id||0);
    if(Number.isSafeInteger(b.id)&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.x>=0&&b.y>=0&&b.x<=world.course.w&&b.y<=world.course.h&&(!newestBlood||b.id>newestBlood.id))newestBlood=b;
  }
  if(newestBlood){
    if(state.scentTarget?.kind!=='blood'||state.scentTarget.id!==newestBlood.id)state.scentTarget={kind:'blood',x:newestBlood.x,y:newestBlood.y,id:newestBlood.id,playerId:null,age:Math.max(0,numeric(newestBlood.age))};
    else{state.scentTarget.x=newestBlood.x;state.scentTarget.y=newestBlood.y;state.scentTarget.age+=dt;}
  }else{
    const p=scentPlayer(world,state.rats.find(r=>r.state==='floor')||world);
    if(p){
      if(state.scentTarget?.kind!=='player'||state.scentTarget.playerId!==idOf(p))state.scentTarget={kind:'player',x:p.x,y:p.y,id:null,playerId:idOf(p),age:0};
      else{state.scentTarget.x=p.x;state.scentTarget.y=p.y;state.scentTarget.age+=dt;}
    }else state.scentTarget=null;
  }
  const kills=world.kills||0;
  state.scent=clamp(state.scent+Math.max(0,kills-state.lastKills)*.075+Math.min(10,Math.max(0,hits-state.lastHits))*.014+Math.min(4,Math.max(0,bloodId-state.lastBloodId))*.006+Math.max(0,wounds-state.lastWounds)*.035-dt*.012,0,1);
  state.lastKills=kills;state.lastHits=hits;state.lastBloodId=bloodId;state.lastWounds=wounds;
}
function attachCrawl(p,state){
  if(!active(p)||p.verminCrawl?.phase==='active'||actionConflict(p)||['windup','held','terminal'].includes(p.bite?.phase)||handOccupied(p))return;
  const sequence=(p.verminCrawl?.sequence||0)+1,kind=hash(state.seed,state.swarm.sequence+sequence+((idOf(p)==='peer')?71:0))>.72?'rat':'roach';
  p.verminCrawl={...makeVerminCrawl(sequence),phase:'active',kind,count:kind==='rat'?1:4,weapon:hash(state.seed,sequence+121)>.32};
  emit(p,'vermin-crawl',{kind,count:p.verminCrawl.count,weapon:p.verminCrawl.weapon,crawlSequence:sequence});
}
function advanceSwarm(world,dt){
  const state=world.vermin,s=state.swarm;s.cooldown=Math.max(0,s.cooldown-dt);
  for(const p of playersOf(world)){p.verminCrawl||=makeVerminCrawl();if(p.verminCrawl.phase==='active'){if(!active(p)||actionConflict(p)||['windup','held','terminal'].includes(p.bite?.phase)||handOccupied(p))p.verminCrawl=makeVerminCrawl(p.verminCrawl.sequence);else{p.verminCrawl.elapsed+=dt;if(p.verminCrawl.elapsed>=VERMIN_TIMING.crawl)p.verminCrawl=makeVerminCrawl(p.verminCrawl.sequence);}}}
  if(s.phase==='idle'){
    if(s.cooldown<=0&&(state.scent>=.58||state.age>=s.nextAmbientAt)&&state.rats.length+state.roaches.length>0&&playersOf(world).some(active)){
      s.phase='warning';s.elapsed=0;s.duration=VERMIN_TIMING.warning;s.sequence++;s.nextAmbientAt=state.age+65;world.events?.push({type:'vermin-swarm-warning',sequence:s.sequence,scent:state.scent,x:world.x,y:world.y,z:0});
    }return;
  }
  s.elapsed+=dt;
  if(s.phase==='warning'&&s.elapsed+1e-8>=VERMIN_TIMING.warning){s.phase='active';s.elapsed=0;s.duration=VERMIN_TIMING.active;for(const p of playersOf(world))attachCrawl(p,state);world.events?.push({type:'vermin-swarm',sequence:s.sequence,scent:state.scent,x:world.x,y:world.y,z:0});}
  else if(s.phase==='active'&&s.elapsed+1e-8>=VERMIN_TIMING.active){s.phase='idle';s.elapsed=0;s.duration=0;s.cooldown=VERMIN_TIMING.cooldown;state.scent*=.38;}
}
export function tickVermin(world,dt){
  if(!isAuthoritative(world)||world.mode!=='play')return;const state=ensureWorld(world);dt=clamp(numeric(dt),0,.05);if(dt<=0)return;state.age+=dt;
  for(const p of playersOf(world)){p.vermin=state;advanceHand(world,p,dt);}
  for(const rat of state.rats){
    if(rat.state==='floor')walk(world,rat,dt,true);
    else if(rat.state==='thrown')advanceThrown(world,rat,dt);
    else if(rat.state==='infesting'){
      rat.age+=dt;const e=world.course.enemies.find(e=>e.id===rat.enemyId);
      if(e){rat.x=e.x;rat.y=e.y;rat.z=(e.z||0)+(e.verminInfestation?.channel==='mouth'?.48:.29);}
      if(!e||e.dead||e.verminInfestation?.remaining<=0||rat.age>=rat.ttl){rat.state='spent';rat.age=0;rat.ttl=4;rat.ownerId=null;rat.z=RAT_FLOOR;}
    }else if(rat.state==='spent'){rat.age+=dt;if(rat.age>=rat.ttl){rat.state='floor';rat.age=0;rat.enemyId=null;rat.turn=1.5;}}
    else if(rat.state==='held'&&!playersOf(world).some(p=>idOf(p)===rat.ownerId&&p.verminHand?.ratId===rat.id))floorRat(world,rat,world,'owner-unavailable');
  }
  for(const roach of state.roaches)walk(world,roach,dt,false);
  advanceInfestations(world,dt);advanceScent(world,dt);advanceSwarm(world,dt);
}
// Network snapshots accept only bounded, serializable simulation data. Unknown
// keys cannot create arrays, mutate prototypes, or introduce render-owned state.
export function validateVerminSnapshot(value,course){
  const base=createVerminState(course);if(!value||typeof value!=='object')return base;
  const bounded=(v,a,b,f=0)=>clamp(numeric(v,f),a,b),states=new Set(['floor','held','thrown','infesting','spent']);
  const ids=new Set();base.rats=[];base.roaches=[];
  for(const rat of (Array.isArray(value.rats)?value.rats:[]).slice(0,VERMIN_LIMITS.rats)){
    if(!rat||!Number.isSafeInteger(rat.id)||ids.has(rat.id)||!states.has(rat.state))continue;ids.add(rat.id);
    const clean={id:rat.id,x:bounded(rat.x,.025,(course?.w||12)-.025),y:bounded(rat.y,.025,(course?.h||12)-.025),z:bounded(rat.z,0,1.5),angle:bounded(rat.angle,-1e5,1e5),state:rat.state,
      ownerId:rat.ownerId==='host'||rat.ownerId==='peer'?rat.ownerId:null,enemyId:Number.isSafeInteger(rat.enemyId)?rat.enemyId:null};
    for(const k of ['age','holdAge','flightAge','ttl','turn'])clean[k]=bounded(rat[k],0,k==='age'?1e7:120);
    for(const k of ['vx','vy','vz'])clean[k]=bounded(rat[k],-12,12);
    for(const k of ['startX','pickupX'])clean[k]=bounded(rat[k],0,course?.w||12,clean.x);
    for(const k of ['startY','pickupY'])clean[k]=bounded(rat[k],0,course?.h||12,clean.y);
    for(const k of ['startZ','pickupZ'])clean[k]=bounded(rat[k],0,1.5,clean.z);
    clean.seed=(numeric(rat.seed)|0)>>>0;clean.speed=bounded(rat.speed,.01,.12,.055);base.rats.push(clean);
    if(Number.isFinite(rat.wanderAngle))clean.wanderAngle=bounded(rat.wanderAngle,-1e5,1e5);
  }
  for(const roach of (Array.isArray(value.roaches)?value.roaches:[]).slice(0,VERMIN_LIMITS.roaches)){
    if(!roach||!Number.isSafeInteger(roach.id)||ids.has(roach.id))continue;ids.add(roach.id);
    const clean={id:roach.id,x:bounded(roach.x,.01,(course?.w||12)-.01),y:bounded(roach.y,.01,(course?.h||12)-.01),z:.004,angle:bounded(roach.angle,-1e5,1e5),age:bounded(roach.age,0,1e6),turn:bounded(roach.turn,0,5),seed:(numeric(roach.seed)|0)>>>0,speed:bounded(roach.speed,.01,.08,.035)};
    if(Number.isFinite(roach.wanderAngle))clean.wanderAngle=bounded(roach.wanderAngle,-1e5,1e5);base.roaches.push(clean);
  }
  for(const k of ['sequence','age','lastKills','lastHits','lastBloodId','lastWounds'])base[k]=bounded(value[k],0,1e7);
  base.seed=(numeric(value.seed,base.seed)|0)>>>0;base.scent=bounded(value.scent,0,1);
  const target=value.scentTarget;
  if(target&&['blood','player'].includes(target.kind)&&Number.isFinite(target.x)&&Number.isFinite(target.y))base.scentTarget={kind:target.kind,x:bounded(target.x,.025,(course?.w||12)-.025),y:bounded(target.y,.025,(course?.h||12)-.025),id:Number.isSafeInteger(target.id)?target.id:null,playerId:target.playerId==='host'||target.playerId==='peer'?target.playerId:null,age:bounded(target.age,0,1e7)};
  const s=value.swarm||{};base.swarm={phase:['idle','warning','active'].includes(s.phase)?s.phase:'idle',elapsed:bounded(s.elapsed,0,8),duration:bounded(s.duration,0,8),sequence:bounded(s.sequence,0,1e7),cooldown:bounded(s.cooldown,0,90),nextAmbientAt:bounded(s.nextAmbientAt,0,1e7,base.age+48)};
  return base;
}
export function validateVerminHand(value){
  const h=makeVerminHand();if(!value||typeof value!=='object')return h;
  if(['idle','pickup','held','stuff','release'].includes(value.phase))h.phase=value.phase;
  for(const k of ['ratId','enemyId'])h[k]=Number.isSafeInteger(value[k])?value[k]:null;
  for(const k of ['elapsed','holdAge','bites','sequence'])h[k]=clamp(numeric(value[k]),0,k==='sequence'?1e7:120);
  h.channel=value.channel==='stomach'?'stomach':'mouth';h.contactApplied=!!value.contactApplied;h.duration=h.phase==='pickup'?VERMIN_TIMING.pickup:h.phase==='release'?VERMIN_TIMING.release:VERMIN_TIMING.stuff;return h;
}
export function validateVerminCrawl(value){
  const c=makeVerminCrawl();if(!value||typeof value!=='object')return c;c.phase=value.phase==='active'?'active':'idle';c.elapsed=clamp(numeric(value.elapsed),0,VERMIN_TIMING.crawl);c.sequence=clamp(numeric(value.sequence),0,1e7);c.kind=value.kind==='rat'?'rat':'roach';c.count=c.phase==='active'?clamp(Math.round(numeric(value.count)),0,c.kind==='rat'?1:4):0;c.weapon=!!value.weapon;return c;
}
