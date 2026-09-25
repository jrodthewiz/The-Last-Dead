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
import { makeDungeonCourse, setDungeonOpeningOpen } from './playground/map/dungeon-course.js';

// Arena simulation uses 4 metre cells; renderers never own gameplay state.
export const METERS=4,EYE=.4;
const DUNGEON_START_DELAY=3.5;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const courses=CAMPAIGN_SECTORS.map((sector,index)=>({name:sector.name,color:sector.color,tag:sector.tag,index}));
export const weapons=[
 {name:'OSSUARY',interval:.22,damage:2,range:20,cone:.008,kind:'hitscan'},
 {name:'BREACH SHOTGUN',interval:.72,damage:1.2,range:7,cone:.15,kind:'hitscan'},
 {name:'ARC LANCE',interval:5,damage:12,range:24,cone:.015,kind:'hitscan'},
 {name:'RELIQUARY',alias:'RIFT BAZOOKA',interval:1.1,damage:24,range:30,cone:.01,kind:'rocket',radius:1.65,knockback:4.8},
 {name:'CARRION',alias:'AUTOMATIC RIFLE',interval:.11,damage:1.45,range:22,cone:.018,kind:'hitscan'},
 {name:'MOURNING',alias:'MARKSMAN RIFLE',interval:.78,damage:6.5,range:28,cone:.002,kind:'hitscan'},
 {name:'WAKE BAT',alias:'HEAVY MELEE',interval:.72,damage:7,range:.86,cone:.82,kind:'melee'},
 {name:'RIPPER',alias:'CHAINSAW',interval:.105,damage:1.25,range:.73,cone:.26,kind:'melee'},
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
 const waveCount=campaign?(sector.waves?.length||CAMPAIGN_WAVE_COUNT):Math.max(1,Number(course?.waveCount)||3);
 return{
  course,x:spawn.x,y:spawn.y,z:0,angle:spawn.angle??-Math.PI/2,pitch:0,vx:0,vy:0,vz:0,speed:0,distance:0,time:0,mode:'ready',
  health:100,energy:100,weapon:0,ownedWeapons:course?.dungeon?[...(course.startingWeapons||[0])]:weapons.map((_,index)=>index),storyRecords:[],cooldowns:Array.from({length:weapons.length},()=>0),fireCooldown:0,shot:0,damage:0,heal:0,aim:0,slide:0,dashTime:0,punch:0,hookTime:0,hookCooldown:0,hookTarget:-1,parryTime:0,parryCooldown:0,slam:false,wallJumps:0,
  style:0,styleTotal:0,stylePending:0,styleLabel:'GET CLOSE. GET LOUD.',rank:'D',kills:0,combo:0,bestCombo:0,lastWeapon:-1,repeat:0,
  campaign,sectorIndex,sectorCount:campaign?CAMPAIGN_SECTOR_COUNT:(course?.dungeon?course.dungeonCount:1),sectorId:course?.sectorId||sector.id,sectorName:course?.name||sector.name,wave:0,waveCount,waveDelay:campaign?(sector.waves[0]?.intermission??1.2):course?.dungeon?DUNGEON_START_DELAY:1.2,
  director:campaign?{state:'intermission',budget:0,spent:0,remainingBudget:0,aliveCap:0,active:0,pending:0,queue:[],elapsed:0,seed:sectorIndex*1000+1}:null,
  roomProgression:campaign?createRoomProgression(course,sectorIndex,options):null,
  dungeonProgression:course?.dungeon?{floorIndex:course.dungeonIndex,floorCount:course.dungeonCount,startIndex:course.dungeonIndex,floorsCleared:0,keysCollected:[],lootCollected:[],activeRoomId:null,combatDoorsReleased:false,exitReady:false,phase:'combat'}:null,
  spawnTelegraphs:[],explosions:[],projectiles:[],coins:[],coinCharges:4,coinRegen:0,altCooldown:0,respawnTime:0,
  rifleHeat:0,rifleBurst:0,rifleBurstTimer:0,rifleCharge:0,rifleCharging:false,rifleKick:0,rifleKickYaw:0,shotSequence:0,lastShotMode:'',
  meleeActive:false,meleeProgress:1,meleeDuration:0,meleeHeavy:false,meleeResolved:false,meleeSequence:0,meleeContact:0,meleeHitStop:0,sawRev:0,sawActive:false,sawContact:0,sawTick:0,
  gore:[],blood:[],limbs:[],pools:[],tracers:[],events:[],pressed:{},nextId:1,autoRun:false,playerId:'host',campaignComplete:false,
  extraction:makeExtractionState(),extractCandidateId:null,extractions:0,extractionPoints:0,
 };
}
export function look(r,dx,dy){if(r.mode!=='play')return;r.angle=angleDiff(r.angle+dx*.002,0);r.pitch=clamp(r.pitch-dy*.002,-1.35,1.35);}
export function switchWeapon(r,i){if(!Number.isInteger(i)||!weapons[i]||r.weapon===i||r.course?.dungeon&&!r.ownedWeapons?.includes(i))return false;r.weapon=i;r.shot=0;r.rifleBurst=0;r.rifleBurstTimer=0;r.rifleCharge=0;r.rifleCharging=false;r.rifleKick=0;r.rifleKickYaw=0;r.aim=0;cancelMelee(r);return true;}
export function nextOwnedWeapon(r,step=1){const owned=r.course?.dungeon?r.ownedWeapons:weapons.map((_,index)=>index);if(!owned?.length)return 0;for(let offset=1;offset<=weapons.length;offset++){const index=(r.weapon+Math.sign(step||1)*offset+weapons.length*2)%weapons.length;if(owned.includes(index))return index;}return r.weapon;}
export function eye(r){return EYE+r.z-r.slide*.18;}
function enemyProfile(e){
 const fallback=e.kind===3?'bellwraith':e.kind===2?'brute':e.kind===1?'caster':'stalker';
 return ENEMY_PROFILES[e.variant]||ENEMY_PROFILES[fallback];
}
function enemyHitRadius(e,minimum=.16){
 const radius=Number(ENEMY_PROFILES[e?.variant]?.hitRadius);
 return Number.isFinite(radius)?Math.max(minimum,radius):minimum;
}
function enemyHitHeight(e,minimum=.52){
 const height=Number(ENEMY_PROFILES[e?.variant]?.hitHeight);
 return Number.isFinite(height)?Math.max(minimum,height):minimum;
}
function playerId(r){return r.playerId||((r.world&&r.world!==r)?'peer':'host');}
function aliveEnemies(r){return r.course.enemies.filter(e=>!e.dead);}
function pushEvent(r,type,extra={}){r.events.push({type,...extra});}
const STYLE_PENDING_CAP=420;
// Combat actions build an unbanked claim. The visible style meter and lifetime
// score only move when the player completes a corpse extraction.
function award(r,amount,label){
 const gain=clamp(Number(amount)||0,0,STYLE_PENDING_CAP);
 if(gain<=0)return;
 r.stylePending=clamp((r.stylePending||0)+gain,0,STYLE_PENDING_CAP);
 r.styleLabel=label;r.combo++;r.bestCombo=Math.max(r.combo,r.bestCombo);
}
function bankStyle(r,amount,label,totalAmount=amount){
 const gain=clamp(Number(amount)||0,0,1800);
 if(gain<=0)return;
 r.style=Math.min(1800,(r.style||0)+gain);r.styleTotal=(r.styleTotal||0)+clamp(Number(totalAmount)||0,0,1800);r.styleLabel=label;
 r.combo++;r.bestCombo=Math.max(r.bestCombo,r.combo);
}
function hurt(r,n){if(r.dashTime>0)return;r.health=Math.max(0,r.health-n);r.damage=1;r.style*=.65;r.combo=0;r.events.push({type:'damage',x:r.x,y:r.y,z:eye(r)});}

// Corpse extraction is a committed, held interaction. The renderer consumes
// the phase/variation fields and events; the simulation owns the gate so a
// visual effect can never award points by itself.
const EXTRACTION_RANGE=.95;
const EXTRACTION_FACING=.72;
const EXTRACTION_TURN_LIMIT=.55;
const EXTRACTION_DURATIONS=Object.freeze({draw:.78,incise:.74,rip:.86});
const EXTRACTION_TOTAL=EXTRACTION_DURATIONS.draw+EXTRACTION_DURATIONS.incise+EXTRACTION_DURATIONS.rip;
const EXTRACTION_PHASES=Object.freeze(['draw','incise','rip']);
const extractionHash=(seed,salt=0)=>{
 let x=((seed>>>0)^((salt+1)*0x9e3779b9))>>>0;
 x^=x>>>16;x=Math.imul(x,0x7feb352d)>>>0;x^=x>>>15;x=Math.imul(x,0x846ca68b)>>>0;x^=x>>>16;
 return x>>>0;
};
const extractionRoll=(seed,salt=0)=>extractionHash(seed,salt)/4294967296;
function extractionSeed(e){
 if(Number.isSafeInteger(e.extractionSeed)&&e.extractionSeed>0)return e.extractionSeed;
 const id=Number.isSafeInteger(e.id)?e.id:0;
 let variant=0;for(const c of String(e.variant||e.kind||'stalker'))variant=(variant*33+c.charCodeAt(0))>>>0;
 return extractionHash((id^variant)>>>0,13)||1;
}
function extractionVariation(seed){
 return Object.freeze({
  drawRate:.92+extractionRoll(seed,1)*.16,
  drawSway:-.045+extractionRoll(seed,2)*.09,
  incisionAngle:-.34+extractionRoll(seed,3)*.68,
  incisionDepth:.72+extractionRoll(seed,4)*.46,
  ripArc:-.42+extractionRoll(seed,5)*.84,
  heartPulse:.82+extractionRoll(seed,6)*.36,
  sprayCount:3+Math.floor(extractionRoll(seed,7)*4),
  rewardRoll:extractionRoll(seed,8),
 });
}
function makeExtractionState(){
 return {targetId:null,phase:'idle',progress:0,seed:0,variation:null,elapsed:0,stageProgress:0,anchorX:0,anchorY:0,anchorAngle:0,
  lastTargetId:null,lastSeed:0,lastPhase:'idle',completedAt:0,cancelReason:'',sequence:0,predicted:false};
}
function extractionTarget(r){
 const enemies=r.course?.enemies||[];
 let best=null,bestDistance=Infinity;
 for(const e of enemies){
  if(!e||!e.dead||e.extracted)continue;
  const d=Math.hypot(e.x-r.x,e.y-r.y);
  if(d>EXTRACTION_RANGE||d>=bestDistance)continue;
  const a=Math.atan2(e.y-r.y,e.x-r.x);
  if(Math.abs(angleDiff(a,r.angle))>EXTRACTION_FACING)continue;
  // A corpse still tumbling from a heavy hit must settle before it can be
  // harvested. This keeps the interaction grounded and readable.
  if((e.meleeZ||0)>.28)continue;
  if(castRay(r.course,r.x,r.y,a,d+.12).dist<=d-.1)continue;
  best=e;bestDistance=d;
 }
 return best;
}
function extractionEvent(r,type,e,extra={}){
 const ex=r.extraction||makeExtractionState();
 const payload={type,enemyId:e?.id??ex.targetId,targetId:e?.id??ex.targetId,x:e?.x??r.x,y:e?.y??r.y,z:.32,phase:ex.phase,progress:ex.progress,
  seed:ex.seed,variation:ex.variation,gore:r.settings?.gore!==false,sequence:ex.sequence,...extra};
 r.events.push(payload);
}
function cancelExtraction(r,reason='cancelled'){
 const ex=r.extraction;if(!ex||ex.phase==='idle')return false;
 const e=(r.course?.enemies||[]).find(item=>item.id===ex.targetId);
 const phase=ex.phase,progress=ex.progress;
 extractionEvent(r,'extract-cancel',e,{reason,phase,progress});
 ex.lastTargetId=ex.targetId;ex.lastSeed=ex.seed;ex.lastPhase=phase;ex.cancelReason=reason;
 ex.targetId=null;ex.phase='idle';ex.progress=0;ex.elapsed=0;ex.stageProgress=0;ex.predicted=false;ex.seed=0;ex.variation=null;ex.anchorX=0;ex.anchorY=0;ex.anchorAngle=0;
 return true;
}
function beginExtraction(r,e,predicted=false){
 const ex=r.extraction||(r.extraction=makeExtractionState());
 const seed=extractionSeed(e),variation=e.extractionVariation||extractionVariation(seed);
 if(!predicted){e.extractionSeed=seed;e.extractionVariation=variation;}
 ex.targetId=e.id;ex.phase='draw';ex.progress=0;ex.stageProgress=0;ex.seed=seed;ex.variation=variation;ex.elapsed=0;
 ex.anchorX=r.x;ex.anchorY=r.y;ex.anchorAngle=r.angle;ex.lastPhase='draw';ex.cancelReason='';ex.sequence=(ex.sequence||0)+1;
 extractionEvent(r,'extract-start',e,{stage:'draw'});
 extractionEvent(r,'extract-draw',e,{stage:'draw',stageProgress:0});
 return true;
}
function completeExtraction(r,e){
 const ex=r.extraction;
 if(!e||e.extracted||!ex||ex.targetId!==e.id)return false;
 // Reward values stay bounded and are seeded by the body so co-op peers and
 // repeated visual runs agree without using Math.random(). Pending combat
 // claims are banked in a bounded chunk, then the heart adds its own bonus.
 const pending=clamp(r.stylePending||0,0,STYLE_PENDING_CAP);
 const banked=clamp(pending,0,180);
 const bonus=clamp(72+(ex.variation.sprayCount-3)*8+Math.round(ex.variation.rewardRoll*12),72,108);
 const points=clamp(banked+bonus,72,288);
 e.extracted=true;e.extractedAt=r.time;e.extractionPoints=points;e.extractionVariation=ex.variation;
 if(r.settings?.gore!==false){
  const world=r.world||r;
  burst(r,e,12+ex.variation.sprayCount,{x:e.x,y:e.y,z:.19,energy:.55});
  for(let i=0;i<3;i++)world.blood.push({id:world.nextId++,x:e.x+(extractionRoll(ex.seed,i+21)-.5)*.18,
   y:e.y+(extractionRoll(ex.seed,i+25)-.5)*.18,size:.18+extractionRoll(ex.seed,i+29)*.11,angle:extractionRoll(ex.seed,i+33)*Math.PI*2});
  world.blood=world.blood.slice(-100);
 }
 r.stylePending=Math.max(0,pending-banked);
 bankStyle(r,points,'+ HEART EXTRACTED',points);
 r.extractions=(r.extractions||0)+1;r.extractionPoints=(r.extractionPoints||0)+points;
 ex.lastTargetId=e.id;ex.lastSeed=ex.seed;ex.lastPhase='rip';ex.completedAt=r.time;ex.cancelReason='';
 extractionEvent(r,'extract-complete',e,{stage:'complete',points,banked,bonus,heart:true});
 ex.targetId=null;ex.phase='idle';ex.progress=0;ex.elapsed=0;ex.stageProgress=0;ex.predicted=false;ex.seed=0;ex.variation=null;ex.anchorX=0;ex.anchorY=0;ex.anchorAngle=0;
 return true;
}

// Exported so host code can explicitly advance a remote player when needed;
// tickPlayer also calls it, keeping solo, host and guest simulation identical.
export function advanceExtraction(r,dt,input={}){
 const ex=r.extraction||(r.extraction=makeExtractionState());
 const target=extractionTarget(r);
 r.extractCandidateId=target?.id??null;
 if(r.mode!=='play'||r.health<=0){if(ex.phase!=='idle')cancelExtraction(r,'inactive');return;}
 const held=!!input.harvest;
 const moving=Math.abs(Number(input.forward)||0)>.01||Math.abs(Number(input.strafe)||0)>.01||!!input.jump||!!input.dash||!!input.slide;
 const turning=ex.phase!=='idle'&&Math.abs(angleDiff(r.angle,ex.anchorAngle))>EXTRACTION_TURN_LIMIT;
 const firing=!!input.fire||!!input.alt;
 if(ex.phase==='idle'){
  if(held&&target&&!moving&&!firing&&Math.abs(r.speed||0)<.18)beginExtraction(r,target,!!input.predictWeapons);
  return;
 }
 const active=(r.course?.enemies||[]).find(e=>e.id===ex.targetId);
 if(!held){cancelExtraction(r,'released');return;}
 if(!active||active.extracted){cancelExtraction(r,'body-unavailable');return;}
 if(r.damage>0){cancelExtraction(r,'damage');return;}
 if(moving||firing||turning||Math.abs(r.x-ex.anchorX)>.025||Math.abs(r.y-ex.anchorY)>.025){cancelExtraction(r,moving?'movement':firing?'weapon':'out-of-position');return;}
 const eligible=extractionTarget(r);
 if(!eligible||eligible.id!==active.id){cancelExtraction(r,'out-of-range');return;}
 const phase=ex.phase,index=EXTRACTION_PHASES.indexOf(phase);
 ex.elapsed+=dt*ex.variation.drawRate;
 let before=0;for(let i=0;i<index;i++)before+=EXTRACTION_DURATIONS[EXTRACTION_PHASES[i]];
 ex.progress=clamp(ex.elapsed/EXTRACTION_TOTAL,0,1);
 const localProgress=clamp((ex.elapsed-before)/EXTRACTION_DURATIONS[phase],0,1);
 ex.stageProgress=localProgress;
 if(ex.elapsed>=before+EXTRACTION_DURATIONS[phase]){
  if(index<EXTRACTION_PHASES.length-1){
   ex.phase=EXTRACTION_PHASES[index+1];ex.lastPhase=ex.phase;ex.stageProgress=0;
   extractionEvent(r,`extract-${ex.phase}`,active,{stage:ex.phase,stageProgress:0});
  }else if(input.predictWeapons){
   // Guest prediction may animate the final rip, but only the host is allowed
   // to mark the corpse, bank points, or emit the completion event.
   ex.progress=.999;ex.stageProgress=1;ex.predicted=true;
  }else completeExtraction(r,active);
 }
}
function burst(player,e,count=18,hit=null){
 const r=player.world||player,seed=e.id+(e.hits||0)*13,energy=hit?.energy||1;
 for(let i=0;i<count;i++){
  const a=i*2.399+seed,spread=(.10+(i%5)*.055)*energy,jet=(i%3===0?-.28:.52)*energy;
  const directed=Number.isFinite(hit?.vx),chunk=count>20&&i%9===0;
  r.gore.push({id:r.nextId++,x:hit?.x??e.x,y:hit?.y??e.y,z:hit?.z??(.15+(i%7)*.045),
   vx:Math.cos(a)*spread+(directed?hit.vx*jet:0),vy:Math.sin(a)*spread+(directed?hit.vy*jet:0),
   vz:.16+(i%4)*.095+(directed?(hit.vz||0)*jet:0),life:1.1+(i%3)*.35,
   size:chunk?.025:.004+(i%4)*.002,chunk,spin:a});
 }
 r.gore=r.gore.slice(-220);
 r.blood.push({id:r.nextId++,x:e.x,y:e.y,size:count>20?.22:.075,angle:seed});r.blood=r.blood.slice(-100);
}
// Deterministic gore rolls keep host and guest reads identical without Math.random.
export const LIMB_KINDS=Object.freeze(['arm','leg','head','eye']);
const limbRoll=(seed,salt)=>{let x=(seed*2654435761+(salt||0)*40503)>>>0;x^=x>>>13;return (x>>>0)/4294967296;};
function pushLimb(r,e,kind,hit,power=1){
 const a=(e.id*2.399+kind.length*1.7+LIMB_KINDS.indexOf(kind)*2.1)%6.283;
 const speed=(.9+power*.5);
 r.limbs.push({id:r.nextId++,enemyId:e.id,variant:e.variant||'stalker',kind,
  x:hit?.x??e.x,y:hit?.y??e.y,z:Math.max(.28,hit?.z??.42),
  vx:Math.cos(a)*speed+(hit?.vx||0),vy:Math.sin(a)*speed+(hit?.vy||0),vz:1.5+power*.6,
  life:2.6+kind.length*.1,rest:false,spin:a,angle:a,scale:kind==='head'?1.25:1,seed:limbRoll(e.id,kind.length)});
 r.limbs=r.limbs.slice(-64);
}
// Limbs come off on the killing blow, and on heavy hits once the target is
// already hurt, so a fight visibly degrades the enemy instead of only staining it.
function dismember(r,e,hit,power=1,kill=false){
 if(!e.wounds)e.wounds={arm:false,leg:false,eye:false};
 const hz=hit?.z??.4;
 const bloodX=hit?.x??e.x,bloodY=hit?.y??e.y;
 if(kill){
  if(!e.wounds.arm)pushLimb(r,e,'arm',{x:bloodX,y:bloodY,z:Math.max(.32,hz)},power);
  if(!e.wounds.leg)pushLimb(r,e,'leg',{x:bloodX,y:bloodY,z:.22},power);
  e.wounds.arm=true;e.wounds.leg=true;
  if(limbRoll(e.id,e.hits||0)>.45)pushLimb(r,e,'head',{x:bloodX,y:bloodY,z:Math.max(.5,hz+.1)},power+.3);
  else if(limbRoll(e.id,7)>.3)pushLimb(r,e,'eye',{x:bloodX,y:bloodY,z:Math.max(.45,hz+.12)},power*.6);
  for(let i=0;i<3;i++)r.blood.push({id:r.nextId++,x:bloodX+(i-1)*.18,y:bloodY+(i%2)*.12,size:.24+i*.05,angle:(e.id+i)*1.3});
 }else{
  const roll=limbRoll(e.id,(e.hits||0)*3+1);
  if(!e.wounds.arm&&roll>.62){e.wounds.arm=true;pushLimb(r,e,'arm',{x:bloodX,y:bloodY,z:Math.max(.3,hz)},power*.8);}
  else if(!e.wounds.leg&&roll<.2){e.wounds.leg=true;pushLimb(r,e,'leg',{x:bloodX,y:bloodY,z:.2},power*.7);}
  else if(roll>.5&&roll<.56)pushLimb(r,e,'eye',{x:bloodX,y:bloodY,z:Math.max(.45,hz+.1)},power*.5);
 }
 e.wounded=!!(e.wounds.arm||e.wounds.leg);
 if(e.wounded){e.moveSpeed=(e.baseMoveSpeed??e.moveSpeed??.3)*(e.wounds.leg?.82:.92);e.drip=(e.drip||0)+.35;}
 r.blood=r.blood.slice(-100);
}
function damageEnemy(r,e,n,label='HIT',hit=null){
 if(e.dead)return;
 e.hp-=n;e.flash=.16;e.hits=(e.hits||0)+1;
 const hx=hit?.x??e.x,hy=hit?.y??e.y,hz=hit?.z??.4;
 const shotX=hx-r.x,shotY=hy-r.y,shotZ=hz-eye(r),shotLength=Math.hypot(shotX,shotY,shotZ)||1;
 burst(r,e,e.hp<=0?34:12,{x:hx,y:hy,z:hz,vx:shotX/shotLength,vy:shotY/shotLength,vz:shotZ/shotLength,energy:clamp(.65+n*.065,.7,1.8)});
 if(r.settings?.gore===false){}
 else if(e.hp<=0)dismember(r,e,{x:hx,y:hy,z:hz},n/6,true);
 else if(n>=5||(e.maxHp&&e.hp<=e.maxHp*.35))dismember(r,e,{x:hx,y:hy,z:hz},n/8,false);
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
  elite:sectorScale>1.2,wounds:{arm:false,leg:false,eye:false},wounded:false,drip:0,hits:0,slashDir:0,slashReach:0,slashHalf:0,slashHit:true,
  pack:item.pack??(r.wave*4+Math.floor((item.order||0)/2)),slot:(item.order||0)%4,slotSign:((item.order||0)%2)?1:-1};
  e.baseMoveSpeed=e.moveSpeed;
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
 r.spawnTelegraphs=[];r.projectiles=[];r.coins=[];r.explosions=[];r.pools=[];
 r.x=spawn.x;r.y=spawn.y;r.z=0;r.vx=0;r.vy=0;r.vz=0;r.angle=spawn.angle??-Math.PI/2;
 const transition={type:'sector-transition',sectorIndex:next,sectorId:sector.id,sectorName:sector.name,sectorCount:CAMPAIGN_SECTOR_COUNT,x:r.x,y:r.y,z:0};
 r.events.push(transition);
 if(r.peer){
  r.peer.course=course;r.peer.roomProgression=r.roomProgression;r.peer.sectorIndex=next;r.peer.sectorId=sector.id;r.peer.sectorName=sector.name;r.peer.wave=0;r.peer.waveCount=sector.waves.length;r.peer.waveDelay=r.waveDelay;r.peer.director=r.director;r.peer.spawnTelegraphs=r.spawnTelegraphs;r.peer.projectiles=r.projectiles;r.peer.coins=r.coins;r.peer.explosions=r.explosions;r.peer.pools=r.pools;
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
function releaseDungeonEncounterGates(r, throughWaveIndex){
 const course=r.course,progression=r.dungeonProgression;
 if(!course?.dungeon||!progression)return;
 let opened=0;
 const roomGates=course.openings.filter(opening=>opening.lockedBy==='room-clear');
 for(const opening of roomGates){
  let encounterWave=course.roomClearWaveByOpening?.[opening.id];
  if(!Number.isInteger(encounterWave))encounterWave=(course.waveSpawns||[]).findIndex(wave=>wave.some(spawn=>spawn.roomId===opening.roomId));
  if(!Number.isInteger(encounterWave)||encounterWave<0||encounterWave>throughWaveIndex)continue;
  if(setDungeonOpeningOpen(course,opening.id,true)){opened++;progression.openingsOpen=(progression.openingsOpen||0)+1;}
 }
 progression.combatDoorsReleased=roomGates.every(opening=>course.openingState[opening.id]===true);
 if(opened)r.events.push({type:'dungeon-doors-open',count:opened,floorIndex:course.dungeonIndex,wave:throughWaveIndex+1});
}
export function spawnWave(r){
 if(r.campaign){if(r.director?.state==='intermission'&&!(r.roomProgression?.requireEntry&&Number.isInteger(r.roomProgression.pendingIndex)&&r.roomProgression.pendingIndex>r.roomProgression.currentIndex))beginCampaignWave(r);return;}
 r.wave++;
 if(r.course?.dungeon){
  releaseDungeonEncounterGates(r,r.wave-1);
  const authored=r.course.waveSpawns?.[r.wave-1]||[];
  for(let i=0;i<authored.length;i++){
   const point=authored[i],profile=ENEMY_PROFILES[point.variant]||ENEMY_PROFILES.stalker;
   r.course.enemies.push({id:r.nextId++,x:point.x,y:point.y,z:0,hp:profile.hp,kind:profile.kind,variant:point.variant,dead:false,flash:0,attack:profile.attack+i*.19,phase:i,pack:r.wave,roomId:point.roomId});
  }
  r.events.push({type:'wave',wave:r.wave,waveCount:r.waveCount,sectorIndex:r.sectorIndex,sectorId:r.sectorId});
  return;
 }
 const spots=[[2,2],[10,2],[6,3],[2,6],[10,6],[6,1.8],[1.5,4],[10.5,4]];
 for(let i=0;i<4+r.wave;i++){const p=spots[i%spots.length],kind=i%3;r.course.enemies.push({id:r.nextId++,x:p[0],y:p[1],z:0,hp:kind===2?10:kind===1?7:5,kind,variant:kind===0?'stalker':kind===1?'caster':'brute',dead:false,flash:0,attack:.5+i*.23,phase:i});}
 r.events.push({type:'wave',wave:r.wave,waveCount:3,sectorIndex:0});
}
function updateDungeonProgression(r){
 const course=r.course,progression=r.dungeonProgression;
 if(!course?.dungeon||!progression)return;
 const activeRoom=course.rooms.find(room=>r.x>=room.bounds.minX&&r.x<room.bounds.maxX&&r.y>=room.bounds.minZ&&r.y<room.bounds.maxZ&&(!room.footprint||room.footprint[Math.floor(r.y)-room.bounds.minZ]?.[Math.floor(r.x)-room.bounds.minX]==='1'));
 progression.activeRoomId=activeRoom?.id||null;
 const active=r.course.enemies.some(enemy=>!enemy.dead);
 if(r.wave>0&&!active)releaseDungeonEncounterGates(r,r.wave);
 for(const key of course.keys){
  if(progression.keysCollected.includes(key.id))continue;
  const collector=[r,...(r.peer?[r.peer]:[])].find(player=>player.health>0&&Math.hypot(player.x-key.x,player.y-key.y)<.62);
  if(!collector)continue;
  progression.keysCollected.push(key.id);
  r.storyRecords.push({id:key.id,title:key.name,text:key.note,kind:'key',floorIndex:course.dungeonIndex,floorName:course.name});
  for(const opening of course.openings){
   if(opening.keyId!==key.id&&!(key.opens||[]).includes(opening.id))continue;
   setDungeonOpeningOpen(course,opening.id,true);
  }
  r.events.push({type:'dungeon-key',keyId:key.id,keyName:key.name,story:key.note,floorIndex:course.dungeonIndex,x:key.x,y:key.y});
 }
 for(const item of course.loot||[]){
  if(progression.lootCollected.includes(item.id))continue;
  const collector=[r,...(r.peer?[r.peer]:[])].find(player=>player.health>0&&Math.hypot(player.x-item.x,player.y-item.y)<.65);
  if(!collector)continue;
  progression.lootCollected.push(item.id);
  const newWeapon=!r.ownedWeapons.includes(item.weaponIndex);
  if(newWeapon){r.ownedWeapons.push(item.weaponIndex);switchWeapon(r,item.weaponIndex);}
  r.events.push({type:'dungeon-weapon',lootId:item.id,weaponIndex:item.weaponIndex,weaponName:weapons[item.weaponIndex].name,rarity:item.rarity,story:item.story,newWeapon,floorIndex:course.dungeonIndex,x:item.x,y:item.y});
 }
 for(const item of course.evidence||[]){
  if(r.storyRecords.some(record=>record.id===item.id))continue;
  const collector=[r,...(r.peer?[r.peer]:[])].find(player=>player.health>0&&Math.hypot(player.x-item.x,player.y-item.y)<.76);
  if(!collector)continue;
  r.storyRecords.push({id:item.id,title:item.title,text:item.text,kind:item.kind,floorIndex:course.dungeonIndex,floorName:course.name});
  r.events.push({type:'dungeon-evidence',evidenceId:item.id,title:item.title,story:item.text,kind:item.kind,floorIndex:course.dungeonIndex,x:item.x,y:item.y});
 }
 for(const opening of course.openings){
  if(!opening.secret||opening.kind!=='vent'||course.openingState[opening.id])continue;
  if(Math.hypot(r.x-opening.anchor.x,r.y-opening.anchor.y)<.82&&setDungeonOpeningOpen(course,opening.id,true)){
   r.events.push({type:'dungeon-secret',openingId:opening.id,floorIndex:course.dungeonIndex,x:opening.anchor.x,y:opening.anchor.y});
  }
 }
 const keyCount=course.keys.length;
 progression.exitReady=r.wave>=r.waveCount&&!active&&progression.keysCollected.length>=keyCount;
 progression.phase=progression.exitReady?'exit':active?'combat':r.wave<r.waveCount?'intermission':keyCount>progression.keysCollected.length?'key':'exit';
}
function advanceDungeonFloor(r){
 const previous=r.course,progress=r.dungeonProgression||{},floorIndex=previous.dungeonIndex+1,course=makeDungeonCourse(floorIndex);
 r.course=course;r.sectorIndex=floorIndex;r.sectorCount=course.dungeonCount;r.sectorId=course.sectorId;r.sectorName=course.name;
 r.dungeonProgression={floorIndex,floorCount:course.dungeonCount,startIndex:progress.startIndex??previous.dungeonIndex,floorsCleared:(progress.floorsCleared||0)+1,keysCollected:[],lootCollected:[],activeRoomId:null,combatDoorsReleased:false,exitReady:false,phase:'combat'};
 r.wave=0;r.waveCount=course.waveCount;r.waveDelay=DUNGEON_START_DELAY;r.director=null;r.campaignComplete=false;
 r.x=course.playerSpawn.x;r.y=course.playerSpawn.y;r.z=0;r.vx=0;r.vy=0;r.vz=0;r.angle=course.playerSpawn.angle??-Math.PI/2;r.pitch=0;
 r.spawnTelegraphs=[];r.projectiles=[];r.coins=[];r.explosions=[];r.pools=[];r.tracers=[];r.gore=[];r.blood=[];r.limbs=[];
 r.events.push({type:'sector-transition',sectorIndex:floorIndex,sectorName:course.name,dungeon:true,floorIndex,floorCount:course.dungeonCount});
}
function move(r,dx,dy){const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.04));for(let i=0;i<n;i++){const nx=r.x+dx/n,ny=r.y+dy/n;if(canTraverseRoomGates(r.course,r.roomProgression,r.x,r.y,nx,r.y)&&canStand(r.course,nx,r.y,.1))r.x=nx;else r.vx=0;if(canTraverseRoomGates(r.course,r.roomProgression,r.x,r.y,r.x,ny)&&canStand(r.course,r.x,ny,.1))r.y=ny;else r.vy=0;}}
export function parry(r){if(r.mode!=='play'||r.health<=0||r.parryCooldown>0)return false;r.parryTime=.19;r.parryCooldown=.45;r.punch=.3;r.events.push({type:'punch',x:r.x,y:r.y,z:eye(r)});const e=r.course.enemies.filter(e=>!e.dead).find(e=>Math.hypot(e.x-r.x,e.y-r.y)<.65&&Math.abs(angleDiff(Math.atan2(e.y-r.y,e.x-r.x),r.angle))<.9&&castRay(r.course,r.x,r.y,Math.atan2(e.y-r.y,e.x-r.x)).dist>Math.hypot(e.x-r.x,e.y-r.y)-.1);if(e){const interrupt=e.attacking;damageEnemy(r,e,3,interrupt?'+ INTERRUPT':'+ KNUCKLE');e.stagger=.45;e.attacking=false;e.windup=0;if(interrupt)award(r,80,'+ INTERRUPT');}return true;}
export function cancelMelee(r){
 r.meleeActive=false;r.meleeProgress=1;r.meleeResolved=false;r.meleeContact=0;r.meleeHitStop=0;
 r.sawActive=false;r.sawRev=0;r.sawContact=0;r.sawTick=0;
}

// Contact is sampled at the strike frame, not at button-down. A committed
// swing may cleave two nearby enemies, but each target takes one hit only.
function meleeTargets(r,range,cone,limit){
 const height=eye(r),slope=Math.tan(r.pitch);
 return r.course.enemies.filter(e=>!e.dead).map(e=>{
  const dx=e.x-r.x,dy=e.y-r.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
  return{e,d,a,z:height+d*slope};
 }).filter(t=>t.d<=range+enemyHitRadius(t.e,.16)&&Math.abs(angleDiff(t.a,r.angle))<=cone
  &&t.z>=(t.e.meleeZ||0)-.08&&t.z<=enemyHitHeight(t.e,.52)+(t.e.meleeZ||0)+.08
  &&castRay(r.course,r.x,r.y,t.a,t.d+.2).dist>t.d-.06)
 .sort((a,b)=>a.d-b.d||a.e.id-b.e.id).slice(0,limit);
}

function impulseMeleeEnemy(e,angle,power,kind){
 const mass=e.kind===2?.46:e.kind===3?.35:1;
 e.meleeHitId=(e.meleeHitId||0)+1;e.meleeHitAngle=angle;e.meleePower=power;e.meleeKind=kind;
 const force=(e.dead?1.85:.9)*power*mass;
 e.meleeVX=clamp((e.meleeVX||0)+Math.cos(angle)*force,-3,3);
 e.meleeVY=clamp((e.meleeVY||0)+Math.sin(angle)*force,-3,3);
 e.meleeVZ=Math.max(e.meleeVZ||0,(e.dead?.9:.24)*power*mass);
 e.meleeSpinV=clamp((e.meleeSpinV||0)+((e.id%2)?1:-1)*power*(e.dead?1.2:.22),-2.5,2.5);
 if(kind==='bat'||e.dead){e.stagger=Math.max(e.stagger||0,.28+power*.13);e.attacking=false;e.windup=0;e.strike=0;e.slashHit=true;}
}

function meleeImpact(r,target,damage,power,kind,heavy){
 const world=r.world||r,{e,a,z}=target,deadBefore=e.dead;
 const hit={x:e.x,y:e.y,z:clamp(z,(e.meleeZ||0)+.08,enemyHitHeight(e,.52)+(e.meleeZ||0))};
 damageEnemy(r,e,damage,kind==='chainsaw'?'+ CARVED UP':heavy?'+ HOME RUN':'+ LIGHTS OUT',hit);
 impulseMeleeEnemy(e,a,power,kind);
 // A short local contact record feeds the existing bounded splash pool. It
 // deliberately has no luminous bullet beam or muzzle flash.
 world.tracers.push({id:world.nextId++,x:r.x,y:r.y,z:eye(r),tx:hit.x,ty:hit.y,tz:hit.z,
  surface:'flesh',ownerId:playerId(r),life:.14,duration:.14,weapon:r.weapon,hit:true,melee:true,heavy,enemyId:e.id});
 r.events.push({type:kind==='chainsaw'?'chainsaw-hit':'melee-hit',weapon:r.weapon,heavy,x:hit.x,y:hit.y,z:hit.z,enemyId:e.id,killed:!deadBefore&&e.dead});
 r.meleeContact=.18;r.shot=.75;
 if(kind==='bat')r.meleeHitStop=heavy?.065:.042;
}

function meleeWall(r,range,heavy=false){
 const world=r.world||r,wall=castRay(r.course,r.x,r.y,r.angle,range);
 const slope=Math.tan(r.pitch),floor=slope<0?(eye(r)-.01)/-slope:Infinity;
 const onFloor=floor<wall.dist&&floor<range,distance=onFloor?floor:wall.dist,height=eye(r)+distance*slope;
 if(distance>=range||height<0||height>1.45)return false;
 const x=r.x+Math.cos(r.angle)*distance,y=r.y+Math.sin(r.angle)*distance;
 world.tracers.push({id:world.nextId++,x:r.x,y:r.y,z:eye(r),tx:x,ty:y,tz:height,surface:onFloor?'floor':'wall',
  normal:onFloor?{x:0,y:0,z:1}:wall.side===0?{x:-Math.sign(Math.cos(r.angle)),y:0,z:0}:{x:0,y:-Math.sign(Math.sin(r.angle)),z:0},
  ownerId:playerId(r),life:.14,duration:.14,weapon:r.weapon,hit:false,melee:true,heavy});
 r.events.push({type:'melee-wall',weapon:r.weapon,heavy,x,y,z:height});r.meleeContact=.12;
 return true;
}

export function shootMelee(r,secondary=false,predicted=false){
 if(r.mode!=='play'||r.health<=0||r.weapon<6||r.weapon>7)return false;
 if(r.weapon===7&&!secondary)return false; // Held cutting is stepped below.
 if(r.meleeActive||r.cooldowns[r.weapon]>0)return false;
 r.meleeActive=true;r.meleeProgress=0;r.meleeResolved=false;r.meleeHeavy=secondary;
 r.meleeDuration=r.weapon===7?.64:secondary?1.02:.68;r.meleeSequence=(r.meleeSequence||0)+1;
 r.cooldowns[r.weapon]=r.meleeDuration+.04;r.fireCooldown=r.cooldowns[r.weapon];
 r.events.push({type:'bat-swing',weapon:r.weapon,heavy:secondary,x:r.x,y:r.y,z:eye(r),predicted});
 return true;
}

function advanceMelee(r,dt,input){
 r.meleeContact=Math.max(0,(r.meleeContact||0)-dt);r.sawContact=Math.max(0,(r.sawContact||0)-dt);
 const predicted=!!input.predictWeapons;
 if(r.meleeActive&&r.weapon>=6){
  if(r.meleeHitStop>0)r.meleeHitStop=Math.max(0,r.meleeHitStop-dt);
  else r.meleeProgress=Math.min(1,r.meleeProgress+dt/r.meleeDuration);
  if(r.meleeProgress>=.4&&!r.meleeResolved){
   r.meleeResolved=true;
   if(!predicted){
    const shove=r.weapon===7,w=weapons[r.weapon],range=shove?.62:r.meleeHeavy?.95:w.range;
    const targets=meleeTargets(r,range,shove?.48:r.meleeHeavy?.4:w.cone,r.meleeHeavy?1:2);
    for(const target of targets)meleeImpact(r,target,shove?3:r.meleeHeavy?12:w.damage,shove?.9:r.meleeHeavy?1.5:1,'bat',r.meleeHeavy);
    if(!targets.length&&meleeWall(r,range,r.meleeHeavy))r.meleeHitStop=.025;
   }
  }
  if(r.meleeProgress>=1)r.meleeActive=false;
 }
 r.sawActive=r.weapon===7&&!!input.fire&&!input.alt&&!r.meleeActive;
 r.sawRev=clamp((r.sawRev||0)+dt*(r.sawActive?3.8:-3.2),0,1);
 r.sawTick=Math.max(0,(r.sawTick||0)-dt);
 if(r.sawActive&&r.sawRev>.62&&r.sawTick<=0){
  r.sawTick=weapons[7].interval;
  if(!predicted){
   const targets=meleeTargets(r,weapons[7].range,weapons[7].cone,1);
   if(targets.length){meleeImpact(r,targets[0],weapons[7].damage,.12,'chainsaw',false);r.sawContact=.15;}
   else if(meleeWall(r,weapons[7].range)){r.meleeContact=.08;r.sawContact=0;}
  }
 }
}

// Small swept proxies carry the hit impulse; the renderer's bone springs
// supply the loose-limb follow-through. Substeps prevent tunnelling at walls.
function advanceMeleeImpulse(r,e,dt){
 if(!e.meleeHitId)return;
 const vx=e.meleeVX||0,vy=e.meleeVY||0,steps=Math.max(1,Math.ceil(Math.hypot(vx,vy)*dt/.035));
 for(let i=0;i<steps;i++){
  const mx=(e.meleeVX||0)*dt/steps,my=(e.meleeVY||0)*dt/steps;
  if(canStand(r.course,e.x+mx,e.y,.16))e.x+=mx;else e.meleeVX=0;
  if(canStand(r.course,e.x,e.y+my,.16))e.y+=my;else e.meleeVY=0;
 }
 e.meleeVZ=(e.meleeVZ||0)-7.5*dt;e.meleeZ=Math.max(0,(e.meleeZ||0)+e.meleeVZ*dt);
 if(e.meleeZ===0)e.meleeVZ=0;
 const drag=Math.exp(-dt*(e.dead?3.8:8));e.meleeVX*=drag;e.meleeVY*=drag;
 e.meleeYaw=clamp((e.meleeYaw||0)+(e.meleeSpinV||0)*dt,-.85,.85);e.meleeSpinV=(e.meleeSpinV||0)*Math.exp(-dt*5);
}

// Rifles share the authoritative hit rules and pooled tracer path. Prediction
// only advances the local mechanism/audio state, never enemy health or effects.
function fireRifleRound(r, mode, predicted = false) {
 const w=weapons[r.weapon],world=r.world||r,charged=mode==='charged';
 r.shot=1;r.shotSequence=(r.shotSequence||0)+1;r.lastShotMode=mode;
 r.repeat=r.lastWeapon===r.weapon?r.repeat+1:0;r.lastWeapon=r.weapon;
 if(r.weapon===4)r.rifleHeat=clamp((r.rifleHeat||0)+(mode==='burst'?.065:.09),0,1);
 // Keep recoil as simulation state so the renderer can give each rifle a
 // readable kick without guessing from the generic `shot` decay.  Carrion
 // climbs more as its barrel heats; Mourning has one deliberate, heavier
 // snap for both its quick shot and charged shot.
 const kick=r.weapon===4?(mode==='burst'?.76:.52+(r.rifleHeat||0)*.18):(charged?1.16:.86);
 r.rifleKick=Math.max(r.rifleKick||0,kick);
 const yawPattern=Math.sin(r.shotSequence*2.399963+(.31* (r.weapon===5?1:0))) * (r.weapon===4?.045:.018);
 r.rifleKickYaw=clamp((r.rifleKickYaw||0)+yawPattern,-.16,.16);
 r.events.push({type:'shot',weapon:r.weapon,mode,x:r.x,y:r.y,z:eye(r),predicted,sequence:r.shotSequence,shotSequence:r.shotSequence,heat:r.rifleHeat||0,kick:r.rifleKick,kickYaw:r.rifleKickYaw});
 if(predicted)return true;
 const spread=r.weapon===4?(mode==='burst'?.0015:.001+w.cone*(r.rifleHeat||0)):(charged?0:w.cone);
 const a=r.angle+Math.sin(r.shotSequence*2.399963)*spread;
 const oz=eye(r),slope=Math.tan(r.pitch),wallHit=castRay(r.course,r.x,r.y,a,w.range);
 const floor=slope<0?Math.max(0,(.01-oz)/slope):Infinity,max=Math.min(w.range,wallHit.dist,floor);
 const dx=Math.cos(a),dy=Math.sin(a);
 const targets=r.course.enemies.filter(e=>!e.dead).map(e=>{
  const ex=e.x-r.x,ey=e.y-r.y,along=ex*dx+ey*dy;
  return{e,along,side:Math.abs(-ex*dy+ey*dx),z:oz+along*slope};
 }).filter(t=>t.along>0&&t.along<max+.01&&t.side<enemyHitRadius(t.e,.16)&&t.z>=0&&t.z<enemyHitHeight(t.e,.52))
 .sort((a,b)=>a.along-b.along||(a.e.id||0)-(b.e.id||0)).slice(0,charged?3:1);
 // Rifle rounds can shoot an ejected Breach core, but cannot inherit Arc's nuke.
 const core=world.projectiles.find(p=>{
  if(!p.core||p.life<=0)return false;
  const px=p.x-r.x,py=p.y-r.y,along=px*dx+py*dy;
  return along>0&&along<Math.min(max,targets[0]?.along??max)&&Math.abs(-px*dy+py*dx)<.14&&Math.abs(p.z-(oz+along*slope))<.14;
 });
 let end=max,hit=false,surface=floor<=wallHit.dist&&floor<=w.range?'floor':wallHit.dist<w.range&&oz+slope*max<=1.45?'wall':'air';
 if(core){end=(core.x-r.x)*dx+(core.y-r.y)*dy;core.life=0;core.nuke=false;explode(world,core);award(r,120,'+ CORE SHOT');surface='air';}
 else for(let i=0;i<targets.length;i++){
  const t=targets[i],head=t.z>.38,damage=(charged?11:w.damage)*(head?1.5:1)*Math.pow(.82,i);
  damageEnemy(r,t.e,damage,charged?'+ THROUGH THE VEIL':head?'+ HEADSHOT':'+ ELIMINATED',{x:r.x+dx*t.along,y:r.y+dy*t.along,z:t.z});
  if(charged)t.e.stagger=Math.max(t.e.stagger||0,.22);
  end=t.along;hit=true;surface='flesh';
 }
 const duration=charged?.18:r.weapon===4?.085:.13;
 world.tracers.push({id:world.nextId++,x:r.x,y:r.y,z:oz,tx:r.x+dx*end,ty:r.y+dy*end,tz:oz+slope*end,
  surface,normal:surface==='floor'?{x:0,y:0,z:1}:wallHit.side===0?{x:-Math.sign(dx),y:0,z:0}:{x:0,y:-Math.sign(dy),z:0},
  ownerId:playerId(r),life:duration,duration,weapon:r.weapon,hit,charged,mode,rail:false});
 if(hit)award(r,charged&&targets.length>1?95:Math.max(8,38-r.repeat*5),charged&&targets.length>1?'+ THREAD THE NEEDLE':mode==='burst'?'+ CONTROLLED BURST':'+ RIFLE HIT');
 return true;
}

export function shootRifle(r, secondary=false, predicted=false) {
 if(r.mode!=='play'||r.health<=0||(r.weapon!==4&&r.weapon!==5))return false;
 if(r.cooldowns[r.weapon]>0||r.rifleBurst>0)return false;
 if(r.weapon===5&&secondary){
  if(!r.rifleCharging){r.rifleCharging=true;r.rifleCharge=0;r.events.push({type:'rifle-charge',weapon:5,x:r.x,y:r.y,z:eye(r),predicted});}
  return false;
 }
 r.rifleCharging=false;r.rifleCharge=0;
 if(r.weapon===4&&secondary){r.rifleBurst=2;r.rifleBurstTimer=.075;}
 r.cooldowns[r.weapon]=r.weapon===4&&secondary?.5:weapons[r.weapon].interval;
 r.fireCooldown=r.cooldowns[r.weapon];
 return fireRifleRound(r,r.weapon===5?'snap':secondary?'burst':'auto',predicted);
}

function advanceRifles(r,dt,input){
 r.rifleHeat=Math.max(0,(r.rifleHeat||0)-dt*.36);
 r.rifleKick=Math.max(0,(r.rifleKick||0)-dt*6.8);
 r.rifleKickYaw*=Math.exp(-dt*11);
 if(r.weapon===4&&r.rifleBurst>0){
  r.rifleBurstTimer-=dt;
  if(r.rifleBurstTimer<=1e-9){r.rifleBurst--;r.rifleBurstTimer+=.075;fireRifleRound(r,'burst',!!input.predictWeapons);}
 }else if(r.weapon!==4){r.rifleBurst=0;r.rifleBurstTimer=0;}
 if(r.weapon===5&&r.rifleCharging&&input.alt){
  r.rifleCharge=clamp((r.rifleCharge||0)+dt/.55,0,1);
  if(r.rifleCharge>=1){
   r.rifleCharging=false;r.rifleCharge=0;r.cooldowns[5]=1.2;r.fireCooldown=1.2;
   fireRifleRound(r,'charged',!!input.predictWeapons);
  }
 }else {r.rifleCharging=false;r.rifleCharge=0;}
 const focus=r.weapon===5&&input.alt?1:r.weapon===4&&r.rifleBurst>0?.3:0;
 r.aim+=(focus-r.aim)*(1-Math.exp(-dt*12));
}

export function shoot(r,secondary=false){if(r.mode!=='play'||r.health<=0)return false;const world=r.world||r;
 if(r.weapon>=6)return shootMelee(r,secondary);
 if(r.weapon>=4)return shootRifle(r,secondary);
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
 const targets=r.course.enemies.filter(e=>!e.dead).map(e=>{const dx=e.x-r.x,dy=e.y-r.y,along=dx*Math.cos(a)+dy*Math.sin(a),side=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a));return{e,along,side,z:oz+along*slope};}).filter(t=>t.along>0&&t.along<max+.01&&t.side<enemyHitRadius(t.e,.16)&&t.z>=0&&t.z<enemyHitHeight(t.e,.52)).sort((a,b)=>a.along-b.along);
 const coin=r.weapon===0?world.coins.find(c=>{const dx=c.x-r.x,dy=c.y-r.y,d=dx*Math.cos(a)+dy*Math.sin(a);return d>0&&d<max&&Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))<.085&&Math.abs(c.z-(oz+d*slope))<.085;}):null;
 if(coin){coin.life=0;const target=r.course.enemies.filter(e=>!e.dead&&castRay(r.course,coin.x,coin.y,Math.atan2(e.y-coin.y,e.x-coin.x)).dist>Math.hypot(e.x-coin.x,e.y-coin.y)-.1).sort((a,b)=>Math.hypot(a.x-coin.x,a.y-coin.y)-Math.hypot(b.x-coin.x,b.y-coin.y))[0];if(target){damageEnemy(r,target,9,'+ RICOCHET');award(r,180,'+ RICOCHET');world.tracers.push({id:world.nextId++,x:coin.x,y:coin.y,z:coin.z,tx:target.x,ty:target.y,tz:.4,ownerId:playerId(r),life:.22,duration:.22,weapon:0,ricochet:true,rail:true});hits++;}continue;}
 const core=world.projectiles.find(p=>{if(!p.core||p.life<=0)return false;const dx=p.x-r.x,dy=p.y-r.y,d=dx*Math.cos(a)+dy*Math.sin(a);return d>0&&d<max&&Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))<.14&&Math.abs(p.z-(oz+d*slope))<.14;});if(core){core.life=0;core.nuke=r.weapon===2;explode(world,core);award(r,core.nuke?350:120,core.nuke?'+ CORE NUKE':'+ CORE SHOT');hits++;continue;}for(const t of targets.slice(0,pierce?100:1)){const head=t.z>.38;damageEnemy(r,t.e,w.damage*(head?1.5:1)*(secondary&&r.weapon===0?2:1),head?'+ HEADSHOT':'+ ELIMINATED',{x:r.x+Math.cos(a)*t.along,y:r.y+Math.sin(a)*t.along,z:t.z});hits++;if(!pierce)end=t.along;}
 if(pellets===1||i%2===0)(r.world||r).tracers.push({id:(r.world||r).nextId++,x:r.x,y:r.y,z:oz,tx:r.x+Math.cos(a)*end,ty:r.y+Math.sin(a)*end,tz:oz+slope*end,surface:(!pierce&&targets.length)?'flesh':floor<=wall&&floor<=w.range?'floor':wall<w.range&&oz+slope*end<=1.45?'wall':'air',normal:floor<=wall&&floor<=w.range?{x:0,y:0,z:1}:wallHit.side===0?{x:-Math.sign(Math.cos(a)),y:0,z:0}:{x:0,y:-Math.sign(Math.sin(a)),z:0},ownerId:playerId(r),life:.18,duration:.18,weapon:r.weapon,hit:targets.length>0,rail:r.weapon===2});}
 if(hits)award(r,Math.max(8,55-r.repeat*9)*(r.weapon===1?1:1.3),r.repeat<1?'+ FRESH WEAPON':'+ HIT');return true;
}
export function tickPlayer(r,dt,input={}){if(r.mode!=='play'||r.health<=0)return;dt=clamp(dt,0,.05);r.time+=dt;
 for(const key of ['shot','damage','heal','punch','hookTime','hookCooldown','parryTime','parryCooldown','dashTime','altCooldown'])r[key]=Math.max(0,r[key]-dt*(key==='shot'?7:1));for(let i=0;i<weapons.length;i++)r.cooldowns[i]=Math.max(0,r.cooldowns[i]-dt);r.fireCooldown=r.cooldowns[r.weapon];
 advanceRifles(r,dt,input);
 advanceMelee(r,dt,input);
 r.angle=angleDiff(r.angle+(input.turn||0)*dt*2,0);r.pitch=clamp(r.pitch+(input.lookY||0)*dt,-1.35,1.35);r.energy=clamp(r.energy+dt*22,0,100);if(r.coinCharges<4){r.coinRegen+=dt;if(r.coinRegen>=2){r.coinCharges++;r.coinRegen=0;}}
 const jump=input.jump&&!r.pressed.jump,dash=input.dash&&!r.pressed.dash,wasAir=r.z>.001,wasSliding=r.slide>.55;r.pressed={jump:!!input.jump,dash:!!input.dash};let f=input.forward||0,s=input.strafe||0;if(r.autoRun&&f===0&&!input.harvest)f=1;const length=Math.max(1,Math.hypot(f,s));f/=length;s/=length;const dx=Math.cos(r.angle)*f-Math.sin(r.angle)*s,dy=Math.sin(r.angle)*f+Math.cos(r.angle)*s;
 if(jump){if(r.z<=.001){r.vz=2.05;r.events.push({type:'jump',x:r.x,y:r.y,z:r.z});}else if(r.wallJumps<3&&!canStand(r.course,r.x,r.y,.2)){r.vz=1.8;r.wallJumps++;r.vx=-Math.cos(r.angle)*1.4;r.vy=-Math.sin(r.angle)*1.4;award(r,20,'+ WALL JUMP');}}
 if(dash&&r.energy>=33){r.energy-=33;r.dashTime=.18;const len=Math.hypot(dx,dy);r.vx=(len?dx:Math.cos(r.angle))*6;r.vy=(len?dy:Math.sin(r.angle))*6;r.vz=Math.max(0,r.vz);r.events.push({type:'dash',x:r.x,y:r.y,z:r.z});}
 if(input.slide&&r.z>.12){r.slam=true;r.vz=-5;}
 r.slide+=(Number(!!input.slide&&r.z<.05)-r.slide)*(1-Math.exp(-dt*20));if(r.slide>.55&&!wasSliding)r.events.push({type:'slide',x:r.x,y:r.y,z:r.z});
 if(r.dashTime<=0){const speed=r.slide>.5?3.25:2.05,acc=r.z>.05?5:18;if(r.slide>.5){const heading=Math.hypot(r.vx,r.vy)>.1?Math.atan2(r.vy,r.vx):r.angle;r.vx+=(Math.cos(heading)*speed-r.vx)*dt*4;r.vy+=(Math.sin(heading)*speed-r.vy)*dt*4;}else{r.vx+=(dx*speed-r.vx)*(1-Math.exp(-dt*acc));r.vy+=(dy*speed-r.vy)*(1-Math.exp(-dt*acc));}}
 if(r.hookTime>0){const target=r.course.enemies.find(e=>e.id===r.hookTarget&&!e.dead);if(target){const dx=target.x-r.x,dy=target.y-r.y,d=Math.hypot(dx,dy);if(d>.5){if(target.kind===2){r.vx=dx/d*4.2;r.vy=dy/d*4.2;r.vz=Math.max(r.vz,.35);}else{const ex=target.x-dx/d*dt*5,ey=target.y-dy/d*dt*5;if(canStand(r.course,ex,ey,.16)){target.x=ex;target.y=ey;}}}else r.hookTime=0;}else r.hookTime=0;}
 const ox=r.x,oy=r.y;move(r,r.vx*dt,r.vy*dt);r.speed=Math.hypot(r.x-ox,r.y-oy)/Math.max(dt,.0001);r.distance+=r.speed*dt;
 if(r.dashTime<=0)r.vz-=5.5*dt;r.z=Math.max(0,r.z+r.vz*dt);if(r.z===0){r.vz=0;r.wallJumps=0;if(r.slam){r.slam=false;for(const e of r.course.enemies)if(!e.dead&&Math.hypot(e.x-r.x,e.y-r.y)<1.15&&castRay(r.course,r.x,r.y,Math.atan2(e.y-r.y,e.x-r.x)).dist>Math.hypot(e.x-r.x,e.y-r.y)-.1)damageEnemy(r,e,5,'+ GROUND SLAM');r.events.push({type:'slam',x:r.x,y:r.y,z:0});}else if(wasAir)r.events.push({type:'land',x:r.x,y:r.y,z:0});}
 // Keep extraction after movement so any actual displacement in this tick
 // cancels the committed action before it can advance or award.
 advanceExtraction(r,dt,input);
}
// Recompute a short grid route only when cover blocks line of sight.
function enemyWaypoint(course,e,target){
 const w=course.w,start=Math.floor(e.y)*w+Math.floor(e.x),goal=Math.floor(target.y)*w+Math.floor(target.x),queue=[start],previous=new Map([[start,-1]]);
 for(let i=0;i<queue.length;i++){const cell=queue[i];if(cell===goal)break;const x=cell%w,y=Math.floor(cell/w);for(const[dx,dy,side]of[[1,0,1],[-1,0,3],[0,1,2],[0,-1,0]]){const nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=course.h||course.cells[cell][side]||previous.has(n))continue;previous.set(n,cell);queue.push(n);}}
 if(!previous.has(goal))return{x:e.x,y:e.y};let next=goal;while(previous.get(next)!==-1&&previous.get(next)!==start)next=previous.get(next);return{x:next%w+.5,y:Math.floor(next/w)+.5};
}
// Enemy attack feel. Melee roles (rush / hunter / anchor) read as slashing
// zombies: a committed windup, then a short swing arc that is hit-tested once
// per swing. Ranged roles lob a slow blood glob that arcs, wobbles, splats and
// leaves a short-lived pool. Arc, splat and pool all run through castRay, so
// nothing can bite through a wall, and every roll is seeded from the enemy id
// so host and guest stay bit-identical.
const SLASH_SWING=.24,SLASH_REACH=.34,SLASH_ARC=.82,GLOB_GRAVITY=2.6,GLOB_LIFE=9,POOL_LIFE=5,POOL_INTERVAL=.5,POOL_DAMAGE=3;
const isMeleeRole=role=>role==='rush'||role==='hunter'||role==='anchor';
const meleeReach=role=>role==='anchor'?1.1:SLASH_REACH;
const meleeArc=role=>role==='anchor'?1:SLASH_ARC;
const meleeStandoff=role=>role==='rush'?.25:role==='hunter'?.28:role==='anchor'?.95:role==='teleport'?1.8:2.3;
// The swing paints a crescent with the existing tracer pool, so the slash is
// visible for host and guest without new render state.
function slashArc(r,e){
 const a=e.slashDir||0,half=e.slashHalf||SLASH_ARC,reach=(e.slashReach||SLASH_REACH)*.96,segs=4;
 for(let i=0;i<segs;i++){
  const a0=a-half+2*half*(i/segs),a1=a-half+2*half*((i+1)/segs);
  r.tracers.push({id:r.nextId++,x:e.x+Math.cos(a0)*reach,y:e.y+Math.sin(a0)*reach,z:.34,tx:e.x+Math.cos(a1)*reach,ty:e.y+Math.sin(a1)*reach,tz:.32,ownerId:'enemy',life:.16,duration:.16,weapon:-1,hit:false,slash:true,enemyId:e.id});
 }
 if(r.tracers.length>180)r.tracers=r.tracers.slice(-180);
}
// Lobbed glob: slow horizontal speed, real gravity arc, deterministic wobble
// and drip seeds. vz stays under the arena ceiling; the flight time is then
// solved exactly so the glob still lands on the target it was thrown at.
function throwGlob(r,e,target,a,d){
 const fromZ=.32,toZ=Math.max(.05,eye(target)-.12),t=clamp(d/(1.7*((e.projectileSpeed??enemyProfile(e).projectileSpeed??1.05)/1.05)),.45,2.2);
 let vz=(toZ-fromZ+.5*GLOB_GRAVITY*t*t)/t;
 vz=clamp(vz,-1.1,2.35);
 const fall=(vz+Math.sqrt(vz*vz+2*GLOB_GRAVITY*(fromZ-toZ)))/GLOB_GRAVITY;
 const lx=target.x+(target.vx||0)*fall*.5,ly=target.y+(target.vy||0)*fall*.5;
 const dir=Math.atan2(ly-e.y,lx-e.x),speed=clamp(Math.hypot(lx-e.x,ly-e.y)/Math.max(.3,fall),.45,2.6);
 const glob={id:r.nextId++,kind:'enemy',glob:true,x:e.x+Math.cos(a)*.24,y:e.y+Math.sin(a)*.24,z:fromZ,vx:Math.cos(dir)*speed,vy:Math.sin(dir)*speed,vz,life:GLOB_LIFE,age:0,reflected:false,enemyId:e.id,enemyKind:e.kind,variant:e.variant||'stalker',damage:clamp(Math.round((e.contactDamage??enemyProfile(e).contactDamage??12)*.7),7,15),splash:3,splashRadius:.85,wob:limbRoll(e.id,3)*6.283,wobAmp:.45+limbRoll(e.id,5)*.3,drip:0};
 r.projectiles.push(glob);
 return glob.id;
}
function splatGlob(r,p,z){
 const gx=p.x,gy=p.y,gz=clamp(z||0,0,.9);
 burst(r,{id:p.id,x:gx,y:gy},8,{x:gx,y:gy,z:gz});
 r.blood.push({id:r.nextId++,x:gx,y:gy,size:.3,angle:limbRoll(p.id,9)*6.283});r.blood=r.blood.slice(-100);
 if(!Array.isArray(r.pools))r.pools=[];
 r.pools.push({id:p.id,x:gx,y:gy,z:0,life:POOL_LIFE,radius:.62,damage:POOL_DAMAGE,pulse:limbRoll(p.id,11)*.4,seed:p.id});
 if(r.pools.length>24)r.pools=r.pools.slice(-24);
 for(const defender of [r,...(r.peer?[r.peer]:[])]){
  if(!defender||defender.health<=0||defender===p.hitPlayer)continue;
  const dx=defender.x-gx,dy=defender.y-gy,dd=Math.hypot(dx,dy);
  if(dd>p.splashRadius)continue;
  if(castRay(r.course,gx,gy,Math.atan2(dy,dx)).dist<=dd-.1)continue;
  hurt(defender,p.splash);
 }
 r.events.push({type:'blood',x:gx,y:gy,z:gz,enemyId:p.enemyId,variant:p.variant,splat:true,projectileId:p.id});
}
export function tick(r,dt,input={}){if(r.mode!=='play')return;dt=clamp(dt,0,.05);tickPlayer(r,dt,input);
 // Hoarding packs: members share a hunt target, clump toward the pack centroid
 // and take separate slots around the player so a wave arrives as a surround
 // instead of a conga line.
 const packs=new Map();
 for(const e of r.course.enemies){
  if(e.dead)continue;
  const key=e.pack??0;let pack=packs.get(key);
  if(!pack){pack={key,members:[],x:0,y:0,alert:0,lastX:0,lastY:0,leader:null,leaderD:Infinity};packs.set(key,pack);}
  pack.members.push(e);pack.x+=e.x;pack.y+=e.y;
 }
 for(const pack of packs.values()){
  pack.x/=pack.members.length;pack.y/=pack.members.length;
  pack.alert=Math.max(0,pack.alert-dt);
  for(const e of pack.members){
   const t=r.peer&&r.peer.health>0&&(r.health<=0||Math.hypot(r.peer.x-e.x,r.peer.y-e.y)<Math.hypot(r.x-e.x,r.y-e.y))?r.peer:r;
   const d=Math.hypot(t.x-e.x,t.y-e.y);
   // Sight lines are cast once per enemy per tick and shared with the movement
   // pass below, so the pack memory costs no extra raycasts.
   const seen=castRay(r.course,e.x,e.y,Math.atan2(t.y-e.y,t.x-e.x)).dist>d-.1;
   e.seesTarget=seen;
   if(seen){pack.alert=2.6;pack.lastX=t.x;pack.lastY=t.y;}
   if(d<pack.leaderD){pack.leaderD=d;pack.leader=e;}
  }
 }
 for(const e of r.course.enemies){
 advanceMeleeImpulse(r,e,dt);
 e.flash=Math.max(0,e.flash-dt);e.strike=Math.max(0,(e.strike||0)-dt);e.stagger=Math.max(0,(e.stagger||0)-dt);if(e.dead)continue;const profile=enemyProfile(e);
 const target=r.peer&&r.peer.health>0&&(r.health<=0||Math.hypot(r.peer.x-e.x,r.peer.y-e.y)<Math.hypot(r.x-e.x,r.y-e.y))?r.peer:r;
 const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx),visible=e.seesTarget===true;
 e.attack=Math.max(0,e.attack-dt);e.phase+=dt;
 if(e.stagger>0){e.attacking=false;e.windup=0;e.slashHit=true;e.strike=0;continue;}
 const pack=packs.get(e.pack??0),melee=isMeleeRole(profile.role),reach=melee?meleeReach(profile.role):13,half=meleeArc(profile.role);
 if(!e.attacking&&(!visible||d>meleeStandoff(profile.role))){
  e.navTimer=(e.navTimer||0)-dt;let heading=a;
  if(!visible){
   // Aggressive pursuit: a pack that has seen the player keeps hunting the last
   // known position even after line of sight breaks.
   if(pack&&pack.alert>0){heading=Math.atan2(pack.lastY-e.y,pack.lastX-e.x);e.navPoint={x:pack.lastX,y:pack.lastY};e.navTimer=Math.min(e.navTimer,.2);}
   else{if(e.navTimer<=0||!e.navPoint||Math.hypot(e.x-e.navPoint.x,e.y-e.navPoint.y)<.16){e.navPoint=enemyWaypoint(r.course,e,target);e.navTimer=.35;}heading=Math.atan2(e.navPoint.y-e.y,e.navPoint.x-e.x);}
  }else if(d>1.15){
   // Surround slots instead of a single-file charge.
   const slot=e.slot??(e.id%4),slotSign=e.slotSign??((e.id%2)?1:-1);
   const slotAngle=a+slotSign*(.42+(slot%3)*.22);
   const slotRange=Math.max(.9,d-(1.1+(slot%3)*.35));
   const sx=target.x-Math.cos(slotAngle)*slotRange,sy=target.y-Math.sin(slotAngle)*slotRange;
   heading=Math.atan2(sy-e.y,sx-e.x);
  }
  if(pack&&!visible){
   const cx=pack.x,cy=pack.y,cd=Math.hypot(cx-e.x,cy-e.y);
   if(cd>3.2){const ha=Math.atan2(cy-e.y,cx-e.x);heading=ha+Math.atan2(Math.sin(heading-ha),Math.cos(heading-ha))*.35;}
  }
  const charge=visible?1.24:pack&&pack.alert>0?1.14:1;
  const sp=(e.moveSpeed||profile.speed||.30)*charge,mx=Math.cos(heading)*sp*dt,my=Math.sin(heading)*sp*dt;
  if(canStand(r.course,e.x+mx,e.y,.16))e.x+=mx;if(canStand(r.course,e.x,e.y+my,.16))e.y+=my;
  if(e.wounded&&(e.drip=(e.drip||0)-dt)<=0){e.drip=.55;r.blood.push({id:r.nextId++,x:e.x,y:e.y,size:.1,angle:e.id*.7});r.blood=r.blood.slice(-100);}
 }
 const eligible=visible&&(melee?d<reach&&target.z<(profile.role==='anchor'?.55:.3):d<13);
 if(!eligible){e.attacking=false;e.windup=0;}
 else if(e.attack<=0){
  if(!e.attacking){e.attacking=true;e.windup=e.windupTime??profile.windup??(melee?.28:.48);e.eventsSeen=0;}
  e.windup=Math.max(0,e.windup-dt);
  if(e.windup<=0){
   e.attacking=false;e.strike=melee?SLASH_SWING:.22;e.attack=e.attackCooldown??profile.attack??(melee?.8:1.9);
   const event={type:'enemy-attack',x:e.x,y:e.y,z:.32,enemyId:e.id,enemyKind:e.kind,variant:e.variant||'stalker'};
   if(melee){e.slashDir=a;e.slashReach=reach;e.slashHalf=half;e.slashHit=false;event.slash=true;event.reach=reach;event.arc=half;slashArc(r,e);}
   else{event.glob=true;event.projectileId=throwGlob(r,e,target,a,d);}
   r.events.push(event);
  }
 }
 // The swing: one arc hit-test per swing directly in front of the enemy,
 // blocked by walls and cancelled the moment the enemy staggers or is parried.
 if(e.strike>0&&!e.slashHit&&e.slashDir!==undefined&&e.slashReach>0){
  const hd=Math.hypot(target.x-e.x,target.y-e.y),ha=Math.atan2(target.y-e.y,target.x-e.x);
  if(hd<=e.slashReach&&Math.abs(angleDiff(ha,e.slashDir))<=e.slashHalf&&castRay(r.course,e.x,e.y,ha).dist>hd-.12){e.slashHit=true;hurt(target,e.contactDamage??profile.contactDamage??12);}
 }
 }
 for(const p of r.projectiles){
 p.age=(p.age||0)+dt;
 p.life-=dt;
 if(p.core)p.vz-=2*dt;
  if(p.glob){
   // Fat lobbed glob: real gravity, a deterministic wobble that does not drift
   // (a sine displacement integrates back to zero) and a dripping trail.
   p.vz-=GLOB_GRAVITY*dt;
   p.wob=(p.wob||0)+dt*7;
   const sway=Math.sin(p.wob)*(p.wobAmp||0)*dt,inv=1/Math.max(.001,Math.hypot(p.vx,p.vy));
   p.x-=p.vy*inv*sway;p.y+=p.vx*inv*sway;
   p.drip=(p.drip||0)+dt;
   if(p.drip>=.34){p.drip-=.34;r.gore.push({id:r.nextId++,x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:-.2,life:.6,size:.022,chunk:false,spin:p.id});}
  }
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
   if(blocked){if(p.core||p.kind==='rocket')explode(r,p);else if(p.glob)splatGlob(r,p,Math.min(p.z,.5));p.life=0;detonated=true;break;}
   p.x+=p.vx*stepDt;p.y+=p.vy*stepDt;p.z+=p.vz*stepDt;
   if(p.z<0||p.z>1.5){if(p.core||p.kind==='rocket')explode(r,p);else if(p.glob)splatGlob(r,p,clamp(p.z,0,.9));p.life=0;detonated=true;break;}
   if(p.kind==='rocket'){
    const enemy=r.course.enemies.find(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<enemyHitRadius(e,.2)&&p.z<enemyHitHeight(e,.65));
    if(enemy){explode(r,p);p.life=0;detonated=true;break;}
   }else if(p.reflected){
    const enemy=r.course.enemies.find(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<enemyHitRadius(e,.22)&&p.z<enemyHitHeight(e,.6));
    if(enemy){if(p.core)explode(r,p);else{if(p.glob)splatGlob(r,p,p.z);damageEnemy(r,enemy,14,'+ RETURN TO SENDER',{x:p.x,y:p.y,z:p.z});}p.life=0;break;}
   }else{
    // A glob is a fat body, not a pinprick: slightly more forgiving to connect
    // than a bolt, but slower, telegraphed and dodgeable in flight.
    const defender=[r,...(r.peer?[r.peer]:[])].find(player=>player.health>0&&Math.hypot(p.x-player.x,p.y-player.y)<(p.glob?.34:.15)&&Math.abs(p.z-(eye(player)-.1))<(p.glob?.5:.22));
    if(defender){if(p.glob){p.hitPlayer=defender;splatGlob(r,p,p.z);hurt(defender,p.damage??15);}else hurt(defender,15);p.life=0;break;}
   }
  }
  if(detonated)continue;
 } for(const c of r.coins){c.life-=dt;c.vz-=1.4*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.z+=c.vz*dt;if(c.z<0)c.life=0;}r.coins=r.coins.filter(c=>c.life>0);
  r.projectiles=r.projectiles.filter(p=>p.life>0);for(const x of (r.explosions||[]))x.life-=dt;r.explosions=(r.explosions||[]).filter(x=>x.life>0);for(const p of r.gore){p.life-=dt;if(p.z>0){p.vz-=3*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z=Math.max(0,p.z+p.vz*dt);}}r.gore=r.gore.filter(p=>p.life>0);for(const t of r.tracers)t.life-=dt;r.tracers=r.tracers.filter(t=>t.life>0);
 // Detached limbs keep tumbling, land, and then stay where they fell: the arena
 // accumulates evidence of the fight instead of cleaning itself up.
 for(const l of r.limbs){
  l.spin+=(l.rest?.2:2.4)*dt;l.angle=l.spin;
  if(l.rest){l.settle=Math.min(1,(l.settle||0)+dt*2.2);continue;}
  l.life-=dt;l.vz-=7.5*dt;l.x+=l.vx*dt;l.y+=l.vy*dt;l.z+=l.vz*dt;
  if(l.z<=0){l.z=0;l.rest=true;l.vz=0;l.vx*=.2;l.vy*=.2;
   if(l.kind==='head'||l.kind==='eye')r.blood.push({id:r.nextId++,x:l.x,y:l.y,size:l.kind==='head'?.2:.14,angle:l.spin});
   else r.blood.push({id:r.nextId++,x:l.x,y:l.y,size:.13,angle:l.spin});}
  if(l.life<=0)l.rest=true;
 }
 r.limbs=r.limbs.slice(-64);
 // Glob pools: short-lived blood slicks that keep punishing a held position.
 // Pulses are on a fixed cadence so co-op runs stay deterministic, and each
 // pulse re-checks the wall between pool and player.
 if(Array.isArray(r.pools)&&r.pools.length){
  for(const pool of r.pools){
   pool.life-=dt;pool.pulse=(pool.pulse||0)+dt;
   if(pool.pulse<POOL_INTERVAL)continue;
   pool.pulse-=POOL_INTERVAL;
   for(const defender of [r,...(r.peer?[r.peer]:[])]){
    if(!defender||defender.health<=0||defender.z>.34)continue;
    const dx=defender.x-pool.x,dy=defender.y-pool.y,dd=Math.hypot(dx,dy);
    if(dd>pool.radius)continue;
    if(castRay(r.course,pool.x,pool.y,Math.atan2(dy,dx)).dist<=dd-.1)continue;
    hurt(defender,pool.damage);
   }
  }
  r.pools=r.pools.filter(pool=>pool.life>0);
 }
 // Residue settles only a little; a pin-sized drip must never grow into a
 // room-wide disk. Age also drives the renderer's wet-to-dry response.
 for(const b of r.blood){
  b.baseSize??=b.size||.12;b.age=(b.age||0)+dt;
  b.size=b.baseSize*(1+.16*(1-Math.exp(-b.age*1.3)));
 }
 r.style=Math.max(0,r.style-dt*35);r.rank=r.style>1400?'SSS':r.style>1100?'SS':r.style>800?'S':r.style>550?'A':r.style>300?'B':r.style>120?'C':'D';
 if(r.campaign){
  updateCampaignDirector(r,dt);
  updateRoomProgression(r,dt);
  checkCampaignExit(r);
 }else if(r.course?.dungeon){
  updateDungeonProgression(r);
  if(!r.course.enemies.some(e=>!e.dead)){
   if(r.wave<r.waveCount){r.waveDelay-=dt;if(r.waveDelay<=0){spawnWave(r);r.waveDelay=2;}}
   else if(r.dungeonProgression.exitReady&&(Math.hypot(r.x-r.course.exit.x,r.y-r.course.exit.y)<.6||(r.peer&&Math.hypot(r.peer.x-r.course.exit.x,r.peer.y-r.course.exit.y)<.6))){
    if(r.course.dungeonIndex+1<r.course.dungeonCount)advanceDungeonFloor(r);
    else{r.mode='win';r.campaignComplete=true;r.dungeonProgression.floorsCleared=r.course.dungeonCount-r.dungeonProgression.startIndex;r.events.push({type:'win',floorIndex:r.course.dungeonIndex,floorCount:r.course.dungeonCount,x:r.x,y:r.y,z:eye(r)});}
   }
  }
 }else if(!r.course.enemies.some(e=>!e.dead)){
  if(r.wave<r.waveCount){r.waveDelay-=dt;if(r.waveDelay<=0){spawnWave(r);r.waveDelay=2;}}
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
