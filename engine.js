import {createLowTide,tickLowTideInteraction,updateLowTide} from './low-tide.js';
import {BREACH_LAUNCHER} from './weapon-attachment-config.js';
import {harborRoomAt,roomCollision,tickHarborRoom} from './harbor-interiors.js';
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
import { createJourney, updateJourney, journeyComplete } from './campaign-journey.js';
import {attachScavengerPickups,createScavengerPack,tickScavengerPack,weaponDamageMultiplier} from './scavenger-pack.js';
import {createHarborVehicle,tickHarborVehicle,vehicleContains} from './harbor-vehicle.js';
import {tickWeaponInventory} from './weapon-inventory.js';
import {propCanStand,propRay} from './harbor-collision.js';
import { encounterRoster, encounterStages, encounterAliveCap, encounterRelief, roomRecoveryPolicy } from './dungeon-encounter-design.js';
import { createMind, stepMind, reactToHit, collectNoises, getIngressCandidates, isIngressRouteOpen, pickSpawnPoint, createPacing, updatePacing, noteAmbush, spawnAnimFor, EMERGE_TIME, wakeEnemy, findPath, isHunting, hash01, turnFacing, ingressMoveSpeed, visionAllows } from './enemy-ai.js';
import {installVerminEnvironment,createVerminState,makeVerminHand,makeVerminCrawl,resetVerminWorld,cancelVermin,interceptVerminInput,tickVermin} from './vermin-system.js';
import {supportsAnatomy,traceEnemyBody,applyAnatomyDamage,anatomyMotion,beginReanimation,advanceReanimation,isThreat} from './enemy-anatomy.js';
import {isLowZombie} from './zombie-behavior.js';
import {coastalZombieAppearance} from './zombie-appearances.js';
import {groundAt} from './coastal-terrain.js';
import {actorGroundAt,supportAt,structureAt,isStructureWall,canStandStructure,resolveActorSupport,clipStructureRise,traceStructureRay,traceStructureSegment,stairWaypoint,STRUCTURE_STEP,STRUCTURE_BODY_HEIGHT} from './coastal-structures.js';
export {nearestRat,verminTarget,useVermin,attackVermin,tickVermin,validateVerminSnapshot,validateVerminHand,validateVerminCrawl,VERMIN_TIMING,VERMIN_LIMITS} from './vermin-system.js';
installVerminEnvironment({canStand,castRay,hurt,damageEnemy,releaseBite});

// Arena simulation uses 4 metre cells; renderers never own gameplay state.
export const METERS=4,EYE=.4;
const DUNGEON_START_DELAY=3.5;
const DUNGEON_ENTRY_THRESHOLD=.18;
const DUNGEON_SPAWN_STAGGER=.38;
const DUNGEON_TELEGRAPH_LEAD=.5;
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
function gridCastRay(m,x,y,angle,max=24){const dx=Math.cos(angle),dy=Math.sin(angle);let cx=Math.floor(x),cy=Math.floor(y),dist=0,side=0;for(let i=0;i<100;i++){if(cx<0||cy<0||cx>=m.w||cy>=m.h)return{dist:Math.max(.02,dist),side,u:0};const tx=dx>0?(cx+1-x)/dx:dx<0?(cx-x)/dx:Infinity,ty=dy>0?(cy+1-y)/dy:dy<0?(cy-y)/dy:Infinity;side=tx<ty?0:1;dist=side===0?tx:ty;const direction=side===0?(dx>0?1:3):(dy>0?2:0),wall=m.cells[cy*m.w+cx][direction]&&!isStructureWall(m,x+dx*dist,y+dy*dist);if(wall||dist>max){const hit=side===0?y+dy*dist:x+dx*dist;return{dist:Math.max(.02,Math.min(dist,max)),side,u:hit-Math.floor(hit)};}if(side===0)cx+=dx>0?1:-1;else cy+=dy>0?1:-1;}return{dist:max,side,u:0};}
export function castRay(m,x,y,angle,max=24,z=undefined,slope=0){const room=harborRoomAt(m,x,y);if(room)return propRay(roomCollision(room),x,y,angle,max)||{dist:max,side:0,u:0};let hit=gridCastRay(m,x,y,angle,max);const prop=m.obstacles?.length?propRay(m,x,y,angle,hit.dist):null;if(prop&&prop.dist<hit.dist)hit=prop;const finite=traceStructureRay(m,x,y,z??supportAt(m,x,y,groundAt(m,x,y)).height+EYE,angle,slope,hit.dist);return finite&&finite.dist<hit.dist?finite:hit;}
export function canStand(m,x,y,r=.075,feet=undefined,height=STRUCTURE_BODY_HEIGHT){const room=harborRoomAt(m,x,y);if(room)return x-r>=(room.x-room.width/2)/4&&x+r<=(room.x+room.width/2)/4&&y-r>=(room.z-room.depth/2)/4&&y+r<=(room.z+room.depth/2)/4&&propCanStand(roomCollision(room),x,y,r);if(m.obstacles?.length&&!propCanStand(m,x,y,r))return false;const support=supportAt(m,x,y,feet??groundAt(m,x,y),{radius:r});if(!canStandStructure(m,x,y,r,feet===undefined?support.height:Math.max(feet,support.height),height))return false;if(m.cells[Math.floor(y)*m.w+Math.floor(x)]?.every(v=>v===1)&&!structureAt(m,x,y))return false;if(x<r||y<r||x>m.w-r||y>m.h-r)return false;for(let cy=Math.max(0,Math.floor(y-r));cy<=Math.min(m.h-1,Math.floor(y+r));cy++)for(let cx=Math.max(0,Math.floor(x-r));cx<=Math.min(m.w-1,Math.floor(x+r));cx++){const walls=m.cells[cy*m.w+cx],segments=[[cx,cy,cx+1,cy],[cx+1,cy,cx+1,cy+1],[cx,cy+1,cx+1,cy+1],[cx,cy,cx,cy+1]];for(let d=0;d<4;d++){if(!walls[d])continue;const[a,b,c,e]=segments[d];if(isStructureWall(m,(a+c)/2,(b+e)/2))continue;if(Math.hypot(x-clamp(x,a,c),y-clamp(y,b,e))<r-1e-7)return false;}}return true;}

export const viewAngle=r=>r.angle;

function dungeonRoomContains(room,x,y){
 if(!room?.bounds||x<room.bounds.minX||x>=room.bounds.maxX||y<room.bounds.minZ||y>=room.bounds.maxZ)return false;
 if(!room.footprint)return true;
 const row=room.footprint[Math.floor(y)-room.bounds.minZ];
 const cell=row?.[Math.floor(x)-room.bounds.minX];
 return cell==='1'||cell===1||cell===true;
}
function dungeonRoomAt(course,x,y){
 return (course?.rooms||[]).find(room=>dungeonRoomContains(room,x,y))||null;
}
function dungeonRoomSpawnCells(course,room){
 const cells=[];
 if(!room?.bounds)return cells;
 for(let y=room.bounds.minZ+.5;y<room.bounds.maxZ;y+=1)for(let x=room.bounds.minX+.5;x<room.bounds.maxX;x+=1){
  if(dungeonRoomContains(room,x,y)&&canStand(course,x,y,.16)
   &&(!course.dungeonCompiled?.reach||course.dungeonCompiled.reach.has(`${Math.floor(x)},${Math.floor(y)}`)))cells.push({x,y});
 }
 return cells;
}
function dungeonRoomName(course,roomId){
 return (course?.rooms||[]).find(room=>room.id===roomId)?.name||'the next room';
}
function dungeonEncounterRoom(course,spawn,waveSpawns){
 if(spawn?.roomId&&(course.rooms||[]).some(room=>room.id===spawn.roomId))return spawn.roomId;
 const exact=dungeonRoomAt(course,spawn?.x,spawn?.y);
 if(exact)return exact.id;
 const siblings=(waveSpawns||[]).map(item=>dungeonRoomAt(course,item.x,item.y)?.id||item.roomId).filter(Boolean);
 if(siblings.length)return siblings[0];
 const candidates=(course.rooms||[]).filter(room=>room.encounter?.budget>0&&room.kind!=='secret'&&room.kind!=='exit');
 if(!candidates.length)return null;
 const x=Number(spawn?.x)||0,y=Number(spawn?.y)||0;
 return candidates.slice().sort((a,b)=>{
  const ac=a.center||{x:(a.bounds.minX+a.bounds.maxX)/2,y:(a.bounds.minZ+a.bounds.maxZ)/2};
  const bc=b.center||{x:(b.bounds.minX+b.bounds.maxX)/2,y:(b.bounds.minZ+b.bounds.maxZ)/2};
  return Math.hypot(ac.x-x,ac.y-y)-Math.hypot(bc.x-x,bc.y-y);
 })[0].id;
}
function buildDungeonEncounterPlan(course){
 const plan=[];
 for(let waveIndex=0;waveIndex<(course?.waveSpawns||[]).length;waveIndex++){
  const authored=course.waveSpawns[waveIndex]||[],groups=new Map();
  for(let order=0;order<authored.length;order++){
   const spawn=authored[order],roomId=dungeonEncounterRoom(course,spawn,authored);
   const key=roomId||`dungeon-wave-${waveIndex}`;
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push({...spawn,roomId,authoredOrder:order});
  }
  const entries=[...groups.entries()].sort((a,b)=>{
   const ar=(course.rooms||[]).find(room=>room.id===a[0])?.order??999;
   const br=(course.rooms||[]).find(room=>room.id===b[0])?.order??999;
   // Authored spawn order carries the designer's doorway progression. Room
   // order only breaks ties where a wave has multiple independent groups.
   return a[1][0].authoredOrder-b[1][0].authoredOrder||ar-br;
  });
  for(const [roomId,spawns] of entries){
   plan.push({id:`dungeon-encounter-${waveIndex}-${plan.length}`,roomId,waveIndex,spawns,status:'pending'});
  }
 }
 // Key rooms are purposeful combat objectives even when the old wave list
 // placed every enemy elsewhere. Optional flanks remain useful supply fights.
 for(const key of course.keys||[]){
  if(plan.some(node=>node.roomId===key.roomId))continue;
  plan.push({id:`dungeon-key-${key.id}`,roomId:key.roomId,waveIndex:Math.max(1,(course.waveCount||1)-1),
   spawns:[{x:key.x,y:key.y,roomId:key.roomId,variant:'stalker'}],status:'pending'});
 }
 // Repeated legacy wave markers in one room are one sustained encounter,
 // not a later return trip to an already-cleared aisle.
 const merged=new Map();
 for(const node of plan){const previous=merged.get(node.roomId);if(previous){previous.spawns.push(...node.spawns);previous.waveIndex=Math.min(previous.waveIndex,node.waveIndex);}else merged.set(node.roomId,node);}
 plan.length=0;plan.push(...merged.values());
 plan.sort((a,b)=>(course.rooms.find(room=>room.id===a.roomId)?.flow?.sequence??999)
  -(course.rooms.find(room=>room.id===b.roomId)?.flow?.sequence??999)||a.waveIndex-b.waveIndex);
 for(let i=0;i<plan.length;i++){
  const node=plan[i],room=course.rooms.find(room=>room.id===node.roomId);
  node.optional=!!room?.flow?.optional;
  node.spawns=encounterRoster(course,room,node.spawns);
 }
 for(let i=plan.length-1;i>=0;i--)if(!plan[i].spawns.length)plan.splice(i,1);
 return plan;
}
function createDungeonProgression(course){
 const plan=buildDungeonEncounterPlan(course),entryRoom=dungeonRoomAt(course,course.playerSpawn?.x,course.playerSpawn?.y);
 const first=plan[0];
 return {
  floorIndex:course.dungeonIndex,floorCount:course.dungeonCount,startIndex:course.dungeonIndex,floorsCleared:0,
  keysCollected:[],lootCollected:[],suppliesCollected:[],activeRoomId:null,combatDoorsReleased:false,exitReady:false,phase:'exploration',
 encounterPlan:plan,completedEncounterIds:[],roomsCompleted:[],roomSequence:plan.map(node=>node.roomId),roomCount:plan.length,roomIndex:0,
  roomSpawnCells:Object.fromEntries((course.rooms||[]).map(room=>[room.id,dungeonRoomSpawnCells(course,room)])),
  entryRoomId:entryRoom?.id||first?.roomId||null,lastRoomId:null,lastX:course.playerSpawn?.x||0,lastY:course.playerSpawn?.y||0,roomTravel:0,observed:false,
  nextEncounterIndex:0,nextRoomId:first?.roomId||null,currentEncounterRoomId:null,currentEncounter:null,
  encounter:{state:'exploration',roomId:null,wave:0,waveCount:course.waveCount||0,active:0,pending:0,remaining:0,total:0,aliveCap:0,elapsed:0},
  objective:first?`Enter ${dungeonRoomName(course,first.roomId)}`:'Find the descent lift',progress:0,
  navigation:{goal:first?`Push through ${dungeonRoomName(course,first.roomId)}`:'Reach the descent lift',kind:'entry',roomId:first?.roomId||null,target:null,waypoint:null,path:[],blocked:false,remaining:plan.filter(node=>!node.optional).length},
 };
}
export function newRun(course, options = {}){
 if(course?.harbor)course.activeInterior=null;
 if(course?.extended)attachScavengerPickups(course);
 const campaign=course?.campaign===true;
 const sectorIndex=Number.isInteger(course?.sectorIndex)?course.sectorIndex:0;
 const sector=getSector(sectorIndex);
 const spawn=course?.playerSpawn||{x:6,y:10.5,angle:-Math.PI/2};
 const waveCount=campaign?(sector.waves?.length||CAMPAIGN_WAVE_COUNT):Math.max(1,Number(course?.waveCount)||3);
 return{
  course,x:spawn.x,y:spawn.y,z:0,supportZ:null,supportId:null,structureId:null,angle:spawn.angle??-Math.PI/2,pitch:0,vx:0,vy:0,vz:0,speed:0,distance:0,time:0,mode:'ready',
  health:100,energy:100,weapon:0,ownedWeapons:course?.dungeon||course?.scavenging?[...(course.startingWeapons||[0])]:weapons.map((_,index)=>index),storyRecords:[],cooldowns:Array.from({length:weapons.length},()=>0),fireCooldown:0,shot:0,damage:0,heal:0,aim:0,slide:0,dashTime:0,punch:0,hookTime:0,hookCooldown:0,hookTarget:-1,parryTime:0,parryCooldown:0,slam:false,wallJumps:0,
  style:0,styleTotal:0,stylePending:0,styleLabel:'GET CLOSE. GET LOUD.',rank:'D',kills:0,combo:0,bestCombo:0,lastWeapon:-1,repeat:0,
  campaign,sectorIndex,sectorCount:campaign?CAMPAIGN_SECTOR_COUNT:(course?.dungeon?course.dungeonCount:1),sectorId:course?.sectorId||sector.id,sectorName:course?.name||sector.name,wave:0,waveCount,waveDelay:campaign?(sector.waves[0]?.intermission??1.2):course?.dungeon?0:1.2,
  director:campaign?{state:'intermission',budget:0,spent:0,remainingBudget:0,aliveCap:0,active:0,pending:0,queue:[],elapsed:0,seed:sectorIndex*1000+1}:null,
  roomProgression:campaign?createRoomProgression(course,sectorIndex,options):null,
  dungeonProgression:course?.dungeon?createDungeonProgression(course):null,
  journey:createJourney(course),journeyInteract:false,
  backpack:createScavengerPack(),lowTide:course?.lowTide?createLowTide():null,
  vehicle:createHarborVehicle(course),harborProgress:course?.harbor?{initialized:false,ready:false}:null,
  spawnTelegraphs:[],explosions:[],projectiles:[],coins:[],coinCharges:4,coinRegen:0,altCooldown:0,respawnTime:0,
  rifleHeat:0,rifleBurst:0,rifleBurstTimer:0,rifleCharge:0,rifleCharging:false,rifleKick:0,rifleKickYaw:0,shotSequence:0,lastShotMode:'',
  attachmentShot:0,attachmentCooldown:0,attachmentSequence:0,
  meleeActive:false,meleeProgress:1,meleeDuration:0,meleeHeavy:false,meleeResolved:false,meleeSequence:0,meleeContact:0,meleeHitStop:0,sawRev:0,sawActive:false,sawContact:0,sawTick:0,
  gore:[],blood:[],limbs:[],pools:[],tracers:[],events:[],pressed:{},nextId:1,autoRun:false,playerId:'host',campaignComplete:false,
  extraction:makeExtractionState(),extractCandidateId:null,extractions:0,extractionPoints:0,
  bite:makeBiteState(),playerWounds:makePlayerWounds(),brutal:makeBrutalState(),
  vermin:createVerminState(course),verminHand:makeVerminHand(),verminCrawl:makeVerminCrawl(),_verminCourse:course,
 };
}
export function look(r,dx,dy){if(r.mode!=='play')return;r.angle=angleDiff(r.angle+dx*.002,0);r.pitch=clamp(r.pitch-dy*.002,-1.35,1.35);}
export function switchWeapon(r,i){if(!Number.isInteger(i)||!weapons[i]||r.weapon===i||(r.course?.dungeon||r.course?.scavenging)&&!r.ownedWeapons?.includes(i))return false;r.weapon=i;r.shot=0;r.rifleBurst=0;r.rifleBurstTimer=0;r.rifleCharge=0;r.rifleCharging=false;r.rifleKick=0;r.rifleKickYaw=0;r.aim=0;cancelMelee(r);return true;}
export function nextOwnedWeapon(r,step=1){const owned=r.course?.dungeon||r.course?.scavenging?r.ownedWeapons:weapons.map((_,index)=>index);if(!owned?.length)return 0;for(let offset=1;offset<=weapons.length;offset++){const index=(r.weapon+Math.sign(step||1)*offset+weapons.length*2)%weapons.length;if(owned.includes(index))return index;}return r.weapon;}
export function eye(r){return actorGroundAt(r.course,r)+EYE+r.z-r.slide*.18;}
const enemyBase=e=>(e.groundZ||0)+(e.meleeZ||0);
const freshEnemyBase=(r,e)=>actorGroundAt(r.course,e)+(e.meleeZ||0);
const playerFoot=r=>actorGroundAt(r.course,r)+(r.z||0);
function syncEnemyGround(r,e,dt=0){
 const old=Number.isFinite(e.groundZ)?e.groundZ:groundAt(r.course,e.x,e.y),support=supportAt(r.course,e.x,e.y,old,{radius:.16});
 if(support.structureId||e.structureId){
  if(support.height>=old-STRUCTURE_STEP){e.groundZ=support.height;e.supportVZ=0;}
  else if(dt>0){e.supportVZ=(e.supportVZ||0)-5.5*dt;e.groundZ=Math.max(support.height,old+e.supportVZ*dt);}
  e.supportZ=e.groundZ;e.supportId=support.id;e.structureId=support.structureId||e.structureId;
  if(!support.structureId&&e.groundZ<=support.height+1e-7)e.structureId=null;
 }else e.groundZ=groundAt(r.course,e.x,e.y);
 return e.groundZ;
}
function syncEnemyGrounds(r){for(const e of r.course.enemies)syncEnemyGround(r,e);}
function actorLine(course,from,to){
 const z=actorGroundAt(course,from)+(from.meleeZ||from.z||0)+.32,tz=actorGroundAt(course,to)+(to.meleeZ||to.z||0)+.32;
 return pointLine(course,{x:from.x,y:from.y,z},{x:to.x,y:to.y,z:tz});
}
function pointLine(course,from,to){
 if(traceStructureSegment(course,from,to))return false;
 const distance=Math.hypot(to.x-from.x,to.y-from.y);return distance<1e-7||castRay(course,from.x,from.y,Math.atan2(to.y-from.y,to.x-from.x),distance+.1,from.z,(to.z-from.z)/distance).dist>distance-.1;
}
const settledFloor=(course,x,y,z)=>supportAt(course,x,y,Number.isFinite(z)?z:groundAt(course,x,y)+STRUCTURE_STEP,{stepHeight:0}).height;
function moveLooseParticle(course,p,dt,gravity){
 const from={x:p.x,y:p.y,z:p.z};p.vz-=gravity*dt;
 const to={x:p.x+p.vx*dt,y:p.y+p.vy*dt,z:p.z+p.vz*dt},contact=traceStructureSegment(course,from,to);
 if(contact){p.x=contact.x+contact.normal.x*.0005;p.y=contact.y+contact.normal.y*.0005;p.z=contact.z+contact.normal.z*.0005;if(contact.normal.z)p.vz=0;if(contact.normal.x)p.vx*=.1;if(contact.normal.y)p.vy*=.1;}
 else{p.x=to.x;p.y=to.y;p.z=to.z;}
 const terrain=groundAt(course,p.x,p.y);if(p.z<=terrain){p.z=terrain;p.vz=0;}
 return contact?.normal.z>0||p.z<=terrain;
}
// Sample the metre-grid terrain at quarter-metre horizontal intervals and
// refine the first contact. Flat courses retain their analytic plane path.
export function castGroundRay(course,x,y,z,angle,slope,max=24,clearance=.01){
 if(!course?.coastal?.terrain)return slope<0?Math.max(0,(clearance-z)/slope):Infinity;
 const dx=Math.cos(angle),dy=Math.sin(angle),gap=d=>z+slope*d-groundAt(course,x+dx*d,y+dy*d)-clearance;
 if(gap(0)<=0)return 0;
 const steps=Math.max(1,Math.ceil(max/.0625));let previous=0;
 for(let i=1;i<=steps;i++){
  const distance=max*i/steps;
  if(gap(distance)<=0){let a=previous,b=distance;for(let n=0;n<14;n++){const middle=(a+b)/2;if(gap(middle)>0)a=middle;else b=middle;}return b;}
  previous=distance;
 }
 return Infinity;
}
function enemyProfile(e){
 const fallback=e.kind===3?'bellwraith':e.kind===2?'brute':e.kind===1?'caster':'stalker';
 return ENEMY_PROFILES[e.variant]||ENEMY_PROFILES[fallback];
}
function enemyHitRadius(e,minimum=.16){
 const radius=Number(ENEMY_PROFILES[e?.variant]?.hitRadius);
 return Number.isFinite(radius)?Math.max(minimum,radius):minimum;
}
function enemyHitHeight(e,minimum=.52){
 if(e.locomotion==='crawler'&&(e.attacking||e.strike>0||e.bitePhase==='held'))return Math.max(minimum,.52);
 if(isLowZombie(e))return e.locomotion==='crawler'?.26:.19;
 const height=Number(ENEMY_PROFILES[e?.variant]?.hitHeight);
 return Number.isFinite(height)?Math.max(minimum,height):minimum;
}
function playerId(r){return r.playerId||((r.world&&r.world!==r)?'peer':'host');}
function aliveEnemies(r){return r.course.enemies.filter(isThreat);}
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
function hurt(r,n,biteDamage=false){if(r.dashTime>0&&!biteDamage)return;
 // A grabbed player gets the promised escape window even in a crowd. Later
 // incidental hits are reduced while the grappler owns the close contact.
 if(r.bite?.phase==='held'&&!biteDamage){if(r.bite.elapsed<1.25)return;n*=.35;}
 r.health=Math.max(0,r.health-n);r.damage=1;r.style*=.65;r.combo=0;if(r.health<=0)cancelBrutal(r,'player-down');if(!biteDamage)r.events.push({type:'damage',x:r.x,y:r.y,z:eye(r)});}

export const BITE_TIMING=Object.freeze({windup:.65,firstDamage:1.25,damageInterval:.9,release:.55,grace:8});
const BITE_LIMBS=['leftArm','rightArm','leftLeg','rightLeg'];
function makePlayerWounds(){return{leftArm:'intact',rightArm:'intact',leftLeg:'intact',rightLeg:'intact',neck:0,torso:0,eviscerated:false};}
function makeBiteState(){return{phase:'idle',enemyId:null,elapsed:0,escape:0,damageStage:0,sequence:0,cooldown:0,side:'left',limb:'leftArm',reason:''};}
function resetBite(r){cancelVermin(r,'reset');r.verminCrawl=makeVerminCrawl(r.verminCrawl?.sequence||0);r.bite=makeBiteState();r.playerWounds=makePlayerWounds();r._biteInput={effort:false};cancelBrutal(r,'reset');r.brutal=makeBrutalState(r.brutal?.sequence||0);}
const biteActive=r=>r.bite?.phase==='windup'||r.bite?.phase==='held';
function biteEvent(r,type,e,extra={}){
 const b=r.bite;
 const event={type,playerId:playerId(r),enemyId:e?.id??b.enemyId,sequence:b.sequence,phase:b.phase,
  side:b.side,limb:b.limb,x:r.x,y:r.y,z:eye(r),...extra};
 // main gathers each player's events exactly once before network relay.
 r.events.push(event);
}
function releaseBite(r,reason,escape=false){
 if(!biteActive(r))return false;
 const b=r.bite,e=r.course.enemies.find(e=>e.id===b.enemyId);
 b.phase='released';b.elapsed=0;b.reason=reason;b.cooldown=BITE_TIMING.grace;
 if(e){e.bitePhase='released';e.biteProgress=0;e.biteTargetId=null;e.biteCooldown=10;e.attacking=false;e.windup=0;e.strike=0;e.slashHit=true;e.attack=Math.max(e.attack||0,2);
  if(e.mind){e.mind.token=false;e.mind.justAttacked=false;e.mind.state='recover';e.mind.recover=.9;}
  if(escape&&!e.dead)e.stagger=Math.max(e.stagger||0,1.1);
 }
 biteEvent(r,'bite-release',e,{reason,escaped:escape});return true;
}
function beginBite(r,e){
 const previous=r.bite||makeBiteState(),sequence=previous.sequence+1;
 const limb=BITE_LIMBS[(e.id+sequence)%BITE_LIMBS.length];
 r.bite={...makeBiteState(),phase:'windup',enemyId:e.id,sequence,side:limb.startsWith('left')?'left':'right',limb};
 e.biteTargetId=playerId(r);e.bitePhase='windup';e.biteProgress=0;e.attacking=true;e.windup=BITE_TIMING.windup;
 e.aimAngle=Math.atan2(r.y-e.y,r.x-e.x);e.strike=0;e.slashHit=true;
 biteEvent(r,'bite-windup',e,{duration:BITE_TIMING.windup});
}
function biteEligible(r,e,profile,distance){
 return !!e.mind?.token&&['rush','hunter'].includes(profile.role)&&!e.wounds?.arm&&!e.dead
  &&distance<.4&&r.z<.18&&Math.abs(playerFoot(r)-enemyBase(e))<.18&&r.dashTime<=0&&r.parryTime<=0&&r.health>0
  &&!biteActive(r)&&r.bite?.phase!=='terminal'&&(r.bite?.cooldown||0)<=0&&(e.biteCooldown||0)<=0;
}
function addBiteEscape(r,amount,source){
 const b=r.bite;if(b?.phase!=='held')return false;
 b.escape=clamp(b.escape+amount,0,1);
 biteEvent(r,'bite-struggle',null,{escape:b.escape,source});
 if(b.escape>=1)releaseBite(r,'break-free',true);
 return true;
}
function advancePlayerBite(world,r,dt){
 const b=r.bite||(r.bite=makeBiteState());b.cooldown=Math.max(0,b.cooldown-dt);
 if(b.phase==='terminal'||b.phase==='idle')return;
 b.elapsed+=dt;
 if(b.phase==='released'){if(b.elapsed>=BITE_TIMING.release){b.phase='idle';b.enemyId=null;b.elapsed=0;}return;}
 const e=world.course.enemies.find(e=>e.id===b.enemyId);
 if(!e||e.dead||(e.stagger||0)>0||e.wounds?.arm||r.health<=0){releaseBite(r,!e||e.dead?'attacker-killed':r.health<=0?'player-down':'interrupted',true);return;}
 const dx=r.x-e.x,dy=r.y-e.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
 if(d>(b.phase==='windup'?.52:.85)||r.z>.24||castRay(world.course,e.x,e.y,a,d+.1).dist<=d-.05){releaseBite(r,'evaded',true);return;}
 if(r.parryTime>0&&b.phase==='windup'){releaseBite(r,'parried',true);return;}
 if(b.phase==='windup'){
  e.windup=Math.max(0,BITE_TIMING.windup-b.elapsed);e.biteProgress=clamp(b.elapsed/BITE_TIMING.windup,0,1);
  // Track the reach early, then lock it so a lateral dodge remains readable.
  if(b.elapsed<BITE_TIMING.windup*.65)e.aimAngle=a;
  if(b.elapsed+1e-8<BITE_TIMING.windup)return;
  if(Math.abs(angleDiff(a,e.aimAngle))>.72){releaseBite(r,'evaded',true);return;}
  b.phase='held';b.elapsed=0;e.bitePhase='held';e.biteProgress=0;e.attacking=false;
  r.dashTime=0;r.hookTime=0;r.vx*=.2;r.vy*=.2;cancelExtraction(r,'grabbed');
  biteEvent(r,'bite-start',e,{escapeWindow:BITE_TIMING.firstDamage});return;
 }
 e.bitePhase='held';e.biteProgress=clamp(b.elapsed/BITE_TIMING.firstDamage,0,1);
 e.facing=a;e.moving=0;
 const intent=r._biteInput||{};
 if(intent.effort){
  b.escape=clamp(b.escape+dt*.85,0,1);
  b.struggleClock=(b.struggleClock||0)+dt;
  if(b.struggleClock>=.3){b.struggleClock-=.3;biteEvent(r,'bite-struggle',e,{escape:b.escape,source:'movement'});}
  if(b.escape>=1){releaseBite(r,'break-free',true);return;}
 }
 if(b.elapsed+1e-8<BITE_TIMING.firstDamage+b.damageStage*BITE_TIMING.damageInterval)return;
 b.damageStage++;const damage=Math.min(30,b.damageStage===1?8:b.damageStage===2?14:22+(b.damageStage-3)*4);
 hurt(r,damage,true);
 const wounds=r.playerWounds||(r.playerWounds=makePlayerWounds());wounds.neck=Math.min(3,b.damageStage);
 biteEvent(r,'bite-damage',e,{damage,stage:b.damageStage,health:r.health});
 if(b.damageStage===2&&r.health>0){if(wounds[b.limb]==='intact')wounds[b.limb]='injured';wounds.torso=Math.max(1,wounds.torso);biteEvent(r,'player-injury',e,{severity:wounds[b.limb],terminal:false});}
 // A failed struggle can cost a limb without ending the fight. Keep the
 // dominant gun hand intact, retain every escape control, and never roll
 // randomly per frame. This opportunity occurs in one of three grab seeds.
 if(b.damageStage>=3&&r.health>0&&r.health<=35&&!b.severed&&(e.id+b.sequence)%3===1){
  const limb=b.limb==='rightArm'?'leftArm':b.limb;
  if(wounds[limb]!=='severed'){
   b.severed=true;b.limb=limb;b.side=limb.startsWith('left')?'left':'right';wounds[limb]='severed';
   biteEvent(r,'player-injury',e,{severity:'severed',terminal:false});
  }
 }
 if(r.health<=0){
  const fatality=['neck','limb','torso'][(e.id+b.sequence)%3];
  b.phase='terminal';b.elapsed=0;b.reason=fatality;b.cooldown=BITE_TIMING.grace;
  if(fatality==='limb')wounds[b.limb]='severed';
  if(fatality==='torso'){wounds.torso=3;wounds.eviscerated=true;}else wounds.neck=3;
  e.bitePhase='terminal';e.biteProgress=1;e.biteTargetId=null;e.biteCooldown=10;e.attack=2;
  if(e.mind){e.mind.token=false;e.mind.state='recover';e.mind.recover=1;}
  biteEvent(r,'player-injury',e,{severity:fatality==='limb'?'severed':fatality,terminal:true,fatality});
  biteEvent(r,'bite-terminal',e,{fatality,damage,stage:b.damageStage});
 }
}

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
  if(!e||!e.dead||e.reanimate?.phase==='down'||e.extracted||e.heartRemoved)continue;
  if(Math.abs(playerFoot(r)-freshEnemyBase(r,e))>.32)continue;
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
 const payload={type,enemyId:e?.id??ex.targetId,targetId:e?.id??ex.targetId,x:e?.x??r.x,y:e?.y??r.y,z:(e?enemyBase(e):groundAt(r.course,r.x,r.y))+.32,phase:ex.phase,progress:ex.progress,
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
  burst(r,e,12+ex.variation.sprayCount,{x:e.x,y:e.y,z:enemyBase(e)+.19,energy:.55});
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
 if(r.mode!=='play'||r.health<=0||brutalActive(r)){if(ex.phase!=='idle')cancelExtraction(r,brutalActive(r)?'counter':'inactive');return;}
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
 const ground=settledFloor(r.course,e.x,e.y,hit?.z??(Number.isFinite(e.groundZ)?e.groundZ:undefined));
 for(let i=0;i<count;i++){
  const a=i*2.399+seed,spread=(.10+(i%5)*.055)*energy,jet=(i%3===0?-.28:.52)*energy;
  const directed=Number.isFinite(hit?.vx),chunk=!hit?.brutal&&count>20&&i%9===0;
  r.gore.push({id:r.nextId++,x:hit?.x??e.x,y:hit?.y??e.y,z:hit?.z??(ground+.15+(i%7)*.045),
   vx:Math.cos(a)*spread+(directed?hit.vx*jet:0),vy:Math.sin(a)*spread+(directed?hit.vy*jet:0),
   vz:.16+(i%4)*.095+(directed?(hit.vz||0)*jet:0),life:1.1+(i%3)*.35,
     size:chunk?.025:.004+(i%4)*.002,chunk,counter:!!hit?.brutal,spin:a});
 }
 r.gore=r.gore.slice(-220);
 r.blood.push({id:r.nextId++,x:e.x,y:e.y,z:ground,size:count>20?.22:.075,angle:seed});r.blood=r.blood.slice(-100);
}
// Deterministic gore rolls keep host and guest reads identical without Math.random.
export const LIMB_KINDS=Object.freeze(['arm','leg','head','eye']);
const limbRoll=(seed,salt)=>{let x=(seed*2654435761+(salt||0)*40503)>>>0;x^=x>>>13;return (x>>>0)/4294967296;};
function damageEnemy(r,e,n,label='HIT',hit=null){
 syncEnemyGround(r,e);
 const deadBefore=!!e.dead;
 if(e.extracted)return;
 e.hp-=n;e.flash=.16;e.hits=(e.hits||0)+1;
 if(e.hp>0){
  const graceBefore=e.mind?.graceT||0;
  reactToHit(e,n,r);
  // A real new stagger opens a short chest-action reaction window. This
  // changes neither the AI stun nor F; grace-suppressed hits cannot renew it.
  if(graceBefore<=0&&e.mind?.graceT>0&&(e.stagger||0)>0)e.chestOpeningUntil=(r.world||r).time+CHEST_OPENING_GRACE;
 }
 const hx=hit?.x??e.x,hy=hit?.y??e.y,hz=hit?.z??enemyBase(e)+.4;
 const shotX=hx-r.x,shotY=hy-r.y,shotZ=hz-eye(r),shotLength=Math.hypot(shotX,shotY,shotZ)||1;
 burst(r,e,e.hp<=0?34:12,{x:hx,y:hy,z:hz,vx:shotX/shotLength,vy:shotY/shotLength,vz:shotZ/shotLength,energy:clamp(.65+n*.065,.7,1.8),brutal:!!hit?.brutal});
 // Gore is a presentation preference; injury and its movement penalties are
 // authoritative even when the renderer hides the cosmetic effects. Authored
 // counter contacts already applied one exact wound, so skip random anatomy.
 const cut=applyAnatomyDamage(e,n,hit,(r.world||r).time,hit?.source||'bullet');
 if(cut)r.events.push({type:'enemy-sever',enemyId:e.id,part:cut.part,x:hx,y:hy,z:hz,weapon:r.weapon,cutId:cut.id});
 const d=Math.hypot(e.x-r.x,e.y-r.y,playerFoot(r)-enemyBase(e));
 if(!deadBefore&&(!hit?.vermin||r.health>0)&&d<1.25&&castRay(r.course,r.x,r.y,Math.atan2(e.y-r.y,e.x-r.x)).dist>d-.15){r.health=Math.min(100,r.health+n*3);r.heal=.5;}
 const eventBase={x:hx,y:hy,z:hz,weapon:r.weapon,enemyId:e.id,enemyKind:e.kind,variant:e.variant||'stalker'};
 if(e.hp<=0){
  if(deadBefore&&e.reanimate?.phase!=='down')return;
  if(deadBefore&&(e.brainIntegrity??1)>.001&&!e.neckBroken&&!e.anatomy?.cuts?.some(c=>c.part==='torso'))return;
  if(!deadBefore&&!hit?.brutal&&beginReanimation(e,(r.world||r).time)){r.events.push({type:'enemy-down',...eventBase});return;}
  if(e.reanimate)e.reanimate.phase='finished';
  e.dead=true;e.deathTime=0;r.kills++;if(r.world)r.world.kills++;
  award(r,100+(r.z>.1?80:0)+(r.slide>.4?60:0),r.z>.1?'+ AIR KILL':r.slide>.4?'+ SLIDE KILL':label);
  r.events.push({type:'kill',...eventBase});
  if(r.world)r.world.events.push({type:'kill',...eventBase});
 }else r.events.push({type:'hit',...eventBase});
}
const AI_ENV={castRay:(...a)=>castRay(...a),canStand:(...a)=>canStand(...a),angleDiff:(...a)=>angleDiff(...a),clamp,
 sensorLine:actorLine,groundHeight:actorGroundAt,routeGoal:stairWaypoint};
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
 const sectorScale=r.course?.dungeon?1:1+(r.sectorIndex||0)*.16+(Math.max(0,r.wave-1))*.045;
 const hp=Math.max(1,Math.round(profile.hp*sectorScale));
  const e={id:r.nextId++,x:point.x,y:point.y,z:0,groundZ:groundAt(r.course,point.x,point.y),hp,maxHp:hp,kind:item.kind??profile.kind,variant:item.variant||'stalker',role:item.role||profile.role,
   cost:item.cost||profile.cost||1,dead:false,flash:0,attack:.35+((item.order??0)%4)*.13,phase:item.order||0,moveSpeed:profile.speed,attackCooldown:profile.attack,
   windupTime:profile.windup,projectileSpeed:profile.projectileSpeed||1.05,contactDamage:profile.contactDamage||12,spawnedAt:r.time,
   encounterId:item.encounterId||null,roomId:item.roomId||null,
   elite:sectorScale>1.2,wounds:{arm:false,leg:false,eye:false},wounded:false,drip:0,hits:0,slashDir:0,slashReach:0,slashHalf:0,slashHit:true,
  pack:item.pack??(r.wave*4+Math.floor((item.order||0)/2)),slot:(item.order||0)%4,slotSign:((item.order||0)%2)?1:-1};
  e.baseMoveSpeed=e.moveSpeed;
  const explicitAppearance=item.appearance??point.appearance;
  if(explicitAppearance!=null)e.appearance=explicitAppearance;
  else if(r.course?.harbor&&item.resident&&e.kind===0)e.appearance=coastalZombieAppearance(e,item.order??e.id);
  e.reanimates=item.reanimates??(e.kind===0&&(e.variant==='bloodhound'?e.id%3!==0:e.id%7===2));e.brainIntegrity=1;
 {
  const anim=point.ingressId?'none':item.spawnAnim??(item.resident?'none':spawnAnimFor(e.variant,point.kind,false));
  const emerge=EMERGE_TIME[anim]||0;
  const near=[r,...(r.peer?[r.peer]:[])].filter(p=>p&&p.health>0).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0]||r;
  createMind(e,{state:item.mindState||'stalk',home:point,spawnAnim:anim,emerge,firstAttack:.7+emerge*.5,facing:point.facing??Math.atan2(near.y-point.y,near.x-point.x)});
  e.resident=!!item.resident;e.ambush=!!item.ambush;
  if(point.ingressId){e.ingressId=point.ingressId;e.ingressOpeningId=point.openingId;e.ingressRoute=point.route.map(p=>({...p}));
   e.ingressTotal=e.ingressRoute.length;e.ingressProgress=0;e.ingressOrigin={x:point.x,y:point.y};e.ingressPortal=point.portal;
   e.encounterStage=item.stage??0;}
 }
 r.course.enemies.push(e);
 if(r.director){r.director.spent+=e.cost;r.director.remainingBudget=Math.max(0,r.director.budget-r.director.spent);}
  const event={type:'spawn',resident:e.resident,ambush:e.ambush,spawnAnim:e.spawnAnim,x:e.x,y:e.y,z:e.groundZ+e.z,enemyId:e.id,enemyKind:e.kind,variant:e.variant,roomId:e.roomId,encounterId:e.encounterId,sectorIndex:r.sectorIndex,wave:r.wave,dungeon:!!r.course?.dungeon,
   ingressId:e.ingressId||null,openingId:e.ingressOpeningId||null,facing:e.facing,stage:e.encounterStage??null};
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
 r.course=course;r.sectorIndex=next;r.sectorId=sector.id;r.sectorName=sector.name;r.sectorCount=CAMPAIGN_SECTOR_COUNT;resetVerminWorld(r);
 resetBite(r);if(r.peer)resetBite(r.peer);
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
  // A northbound milestone depends on fights on its approach side. The old
  // global wave index could include the key vault *behind* this very gate.
  // That circular dependency stranded the new route on the Ossuary floor.
  const approachNodes=progression.encounterPlan.filter(node=>{
   const room=course.rooms.find(room=>room.id===node.roomId);
   return !node.optional&&node.waveIndex<=encounterWave&&room?.center.y>=opening.anchor.y;
  });
  if(approachNodes.some(node=>node.status!=='cleared'))continue;
  if(setDungeonOpeningOpen(course,opening.id,true)){opened++;progression.openingsOpen=(progression.openingsOpen||0)+1;}
 }
 progression.combatDoorsReleased=roomGates.every(opening=>course.openingState[opening.id]===true);
 if(opened)r.events.push({type:'dungeon-doors-open',count:opened,floorIndex:course.dungeonIndex,wave:throughWaveIndex+1});
}
function aliveEnemiesFor(r,ids){return aliveEnemies(r).filter(e=>ids.has(e.encounterId));}
function dungeonEncounterAlive(r,encounter){
 if(!encounter)return 0;
 const ids=new Set(encounter.nodeIds||[]);
 return aliveEnemies(r).filter(enemy=>ids.has(enemy.encounterId)||enemy.encounterId===encounter.id).length;
}
function dungeonEncounterRoomCap(course,nodes){
 return Math.max(...nodes.map(node=>encounterAliveCap(course,course.rooms?.find(room=>room.id===node.roomId))),1);
}
function dungeonSpawnPoint(r,item,roomId,wait=0){
 const course=r.course,players=livePlayers(r),encounter=r.dungeonProgression.currentEncounter;
 // Cache geometry-derived staging variants until a doorway changes. The
 // visibility/distance test remains live for every placement and commitment.
 if(!encounter.ingressPoints||encounter.ingressRevision!==course.dungeonRevision){
  encounter.ingressPoints=getIngressCandidates(AI_ENV,course,roomId);encounter.ingressRevision=course.dungeonRevision;
 }
 let candidates=encounter.ingressPoints;
 const preferred=encounter.stageIngress?.[item.stage];
 // A phase opens with a readable pair from one doorway, then pressure comes
 // from another available threshold. Keep the first route only while the
 // first two are warning/spawning; never hold a wave for a blocked lane.
 const preferredOpening=preferred&&candidates.find(point=>point.ingressId===preferred)?.openingId;
 if(preferredOpening&&item.stageOrder<2&&wait<3)candidates=candidates.filter(point=>point.openingId===preferredOpening);
 const uses=encounter.ingressUses;
 const openingUses=encounter.ingressOpeningUses;
 const openings=[...new Set(candidates.map(point=>point.openingId))].sort((a,b)=>(openingUses[a]||0)-(openingUses[b]||0));
 for(const openingId of openings){
  const ordered=[...new Set(candidates.filter(point=>point.openingId===openingId).map(point=>point.ingressId))].sort((a,b)=>(uses[a]||0)-(uses[b]||0));
  for(const ingressId of ordered){
  const point=pickSpawnPoint(AI_ENV,course,players,course.enemies,candidates.filter(p=>p.ingressId===ingressId),
   {minDist:3.5,relax:0,behind:false,seed:item.order+item.stage*31,reservations:r.spawnTelegraphs,
    ingressSpeed:ingressMoveSpeed((ENEMY_PROFILES[item.variant]||ENEMY_PROFILES.stalker).speed)});
  if(point){
   const stageOpenings=encounter.stageOpenings[item.stage]??=[];
   if(!stageOpenings.includes(point.openingId)){
    stageOpenings.push(point.openingId);
    r.events.push({type:'dungeon-ingress',roomId,encounterId:encounter.id,
     ingressId,openingId:point.openingId,label:point.ingressLabel,side:point.ingressSide,
     x:point.portal.x,y:point.portal.y,phaseIndex:item.stage,phase:encounter.stageLabel});
   }
   encounter.stageIngress[item.stage]??=ingressId;return point;
  }
  }
 }
 return null;
}
function dungeonNavigation(r,force=false){
 const p=r.dungeonProgression,course=r.course;if(!p)return;
 if(!force&&r.time<(p.navigationDue||0)&&p.navigationRevision===course.dungeonRevision)return;
 p.navigationDue=r.time+.25;p.navigationRevision=course.dungeonRevision;
 const plan=p.encounterPlan||[],required=plan.filter(node=>!node.optional&&node.status!=='cleared');
 const options=[];
 const offer=(target,kind,roomId,goal,priority=0,node=null)=>{
  if(!target||!canStand(course,target.x,target.y,.16))return;
  const path=findPath(AI_ENV,course,r,target,course.w*course.h);if(!path)return;
  let distance=0,last=r;for(const point of path){distance+=Math.hypot(point.x-last.x,point.y-last.y);last=point;}
  options.push({target:{x:target.x,y:target.y},kind,roomId,goal,path,distance,priority,node});
 };
 const targetForRoom=roomId=>{
  const room=course.rooms.find(room=>room.id===roomId),points=p.roomSpawnCells[roomId]||[];
  if(!room||!points.length)return null;
  let best=null,score=Infinity;
  for(const point of points){const d=Math.hypot(point.x-room.center.x,point.y-room.center.y);if(d<score){best=point;score=d;}}
  return best;
 };
 if(p.currentEncounter){
  const encounter=p.currentEncounter;
  const inside=dungeonRoomAt(course,r.x,r.y)?.id===encounter.roomId;
  const stage=encounter.stageLabel||'Contact';
  offer(inside?{x:r.x,y:r.y}:targetForRoom(encounter.roomId),'combat',encounter.roomId,
   `${inside?'Hold':'Return to'} ${dungeonRoomName(course,encounter.roomId)} - ${stage}`);
 }else{
  const route=course.encounterRoute||plan.filter(node=>!node.optional).map(node=>node.roomId);
  const priority=roomId=>Math.max(0,course.rooms.find(room=>room.id===roomId)?.flow?.sequence??route.indexOf(roomId))*1000;
  const nextSequence=Math.min(...required.map(node=>course.rooms.find(room=>room.id===node.roomId)?.flow?.sequence??Infinity));
  for(const item of course.loot||[]){
   const room=course.rooms.find(room=>room.id===item.roomId);
   if(!room||(room.flow?.onRoute!==true&&!course.route?.includes(room.id))
     ||room.flow.sequence>nextSequence||p.lootCollected.includes(item.id)||r.ownedWeapons?.includes(item.weaponIndex))continue;
   offer(item,'equipment',room.id,`Collect ${item.name||weapons[item.weaponIndex]?.name||'equipment'}`,
    room.flow.sequence*1000-.5);
  }
  for(const key of course.keys||[])if(!p.keysCollected.includes(key.id)){
   const defended=plan.find(node=>node.roomId===key.roomId&&node.status!=='cleared');
   offer(key,'key',key.roomId,`Recover ${key.name}`,defended?priority(key.roomId)-1:-1000);
  }
  for(const node of required)offer(targetForRoom(node.roomId),'advance',node.roomId,
   course.rooms.find(room=>room.id===node.roomId)?.flow?.goal||`Push through ${dungeonRoomName(course,node.roomId)}`,priority(node.roomId),node);
  const journeyTarget=r.journey?.target;
  if(journeyTarget){
   const defended=plan.find(node=>node.roomId===journeyTarget.roomId&&node.status!=='cleared');
   // Keep authored route order and active combat guidance. Once a station's
   // room is cleared, its signature action precedes the next route beat.
   offer(journeyTarget,'journey',journeyTarget.roomId,r.journey.objective,
    defended?priority(journeyTarget.roomId)+.25:priority(journeyTarget.roomId)-2);
  }
  if(!required.length&&p.keysCollected.length>=(course.keys||[]).length&&!journeyTarget)
   offer(course.exit,'exit',null,r.journey?.phase==='complete'&&course.dungeonIndex===4?'Leave through the final threshold':'Reach the descent lift');
 }
 options.sort((a,b)=>(a.distance+a.priority)-(b.distance+b.priority));
 const chosen=options[0];
 if(chosen){
  const {node,priority,...navigation}=chosen;
  navigation.path=navigation.path.slice(0,96);
  navigation.waypoint=navigation.path.find(point=>Math.hypot(point.x-r.x,point.y-r.y)>.35)||navigation.target;
  navigation.blocked=false;navigation.remaining=required.length;p.navigation=navigation;p.objective=navigation.goal;
  if(p.currentEncounter){navigation.phase=p.currentEncounter.stageLabel;navigation.phaseIndex=p.currentEncounter.stageIndex;
   navigation.phaseCount=p.currentEncounter.stageCount;navigation.pressure=dungeonEncounterAlive(r,p.currentEncounter);
   navigation.reinforcements=p.currentEncounter.queue.filter(item=>item.status!=='spawned').length;
   navigation.hold=dungeonRoomAt(course,r.x,r.y)?.id===p.currentEncounter.roomId;
   if(navigation.hold){navigation.waypoint=null;navigation.path=[];navigation.distance=0;}}
  if(node)p.nextRoomId=node.roomId;
 }else{
  p.navigation={goal:p.currentEncounter?'Keep moving — threats are approaching':'Find the forward passage',kind:'search',roomId:p.activeRoomId,target:null,waypoint:null,path:[],blocked:true,remaining:required.length};
  p.objective=p.navigation.goal;
 }
}
function dungeonSyncEncounter(r){
 const p=r.dungeonProgression;if(!p)return;
 const plan=p.encounterPlan||[];
 const d=p.currentEncounter;
 const active=dungeonEncounterAlive(r,d);
 const pending=d?d.queue.filter(item=>item.status!=='spawned').length:0;
 const total=d?.queue.length||0;
 const next=plan[p.nextEncounterIndex];
 const completed=p.completedEncounterIds?.length||0;
 const fraction=d&&total?clamp((total-pending-active)/total,0,1):0;
 const state=d?(d.state==='spawning'?(active?'combat':'telegraph'):'combat'):(p.exitReady?'exit':p.phase);
 p.encounter={state,roomId:d?.roomId||null,wave:d?d.waveIndex+1:r.wave,waveCount:r.waveCount,active,pending,remaining:active+pending,total,aliveCap:d?.aliveCap||0,elapsed:d?.elapsed||0,
  phase:d?.stageLabel||null,phaseIndex:d?.stageIndex??0,phaseCount:d?.stageCount??0,ingressId:d?.stageIngress?.[d?.stageIndex]||null};
 p.currentEncounterRoomId=d?.roomId||null;
 p.roomIndex=d?.planIndex??Math.max(0,Math.min(plan.length,p.nextEncounterIndex||0));
 p.roomCount=plan.length;
 p.nextRoomId=next?.roomId||null;
 const missingKey=r.course.keys?.find(key=>!p.keysCollected.includes(key.id));
 p.objective=p.navigation?.goal||(d?`Clear ${dungeonRoomName(r.course,d.roomId)}`:p.exitReady?'Reach the descent lift':next?`Reach ${dungeonRoomName(r.course,next.roomId)}`:missingKey?`Find ${missingKey.name||'the floor key'}`:'Find the descent lift');
 const required=plan.filter(node=>!node.optional);
 p.progress=required.length?clamp((required.filter(node=>node.status==='cleared').length+(!d?.optional?fraction:0))/required.length,0,1):1;
}
function beginDungeonEncounter(r,nodes,{force=false}={}){
 const p=r.dungeonProgression;if(!p||p.currentEncounter||!nodes?.length)return false;
 const first=nodes[0],waveIndex=first.waveIndex,queue=[];
 for(const node of nodes){node.status='active';for(let order=0;order<node.spawns.length;order++)queue.push({...node.spawns[order],order,due:force?0:.32+queue.length*DUNGEON_SPAWN_STAGGER,status:node.spawns[order].seeded?'spawned':'queued',telegraph:null,encounterId:node.id});}
 // Seeded residents wake in a cascade, nearest first, instead of all at once.
 {
  const ids=new Set(nodes.map(node=>node.id)),sleepers=aliveEnemiesFor(r,ids).sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y));
  sleepers.forEach((sleeper,index)=>wakeEnemy(sleeper,r,.5+index*.75));
 }
 const id=nodes.length===1?first.id:`dungeon-wave-${waveIndex}`;
 const encounter={id,nodeIds:nodes.map(node=>node.id),planIndices:nodes.map(node=>p.encounterPlan.indexOf(node)),planIndex:p.encounterPlan.indexOf(first),roomId:first.roomId,waveIndex,queue,optional:nodes.every(node=>node.optional),state:force?'combat':'spawning',elapsed:0,aliveCap:dungeonEncounterRoomCap(r.course,nodes)};
 const room=r.course.rooms.find(room=>room.id===first.roomId);
 encounter.stages=encounterStages(r.course,room,queue.length,encounter.optional);
 encounter.stageCount=encounter.stages.length;
 encounter.stageIndex=0;encounter.stageStarted=0;encounter.stageLabel=encounter.stages[0].label;
 encounter.ingressUses={};encounter.ingressOpeningUses={};encounter.stageIngress={};encounter.stageOpenings={};encounter.beat=room?.flow?.beat||room?.name||'Hold the room';
 let queueIndex=0;
 encounter.stages.forEach((stage,stageIndex)=>{
  for(let stageOrder=0;stageOrder<stage.count&&queueIndex<queue.length;stageOrder++,queueIndex++){
   const item=queue[queueIndex];item.stage=stageIndex;item.stageOrder=stageOrder;item.order=queueIndex;
   item.warningLead=Math.max(DUNGEON_TELEGRAPH_LEAD,stage.lead||0);item.due=.35+stageOrder*stage.spacing;
  }
 });
 p.currentEncounter=encounter;p.currentEncounterRoomId=first.roomId;p.phase=force?'combat':'telegraph';
 if(r.wave<waveIndex+1){r.wave=waveIndex+1;r.events.push({type:'wave',wave:r.wave,waveCount:r.waveCount,sectorIndex:r.sectorIndex,sectorId:r.sectorId,dungeon:true,roomId:first.roomId});}
 r.waveDelay=0;
 r.events.push({type:'dungeon-encounter-start',roomId:first.roomId,roomName:dungeonRoomName(r.course,first.roomId),wave:waveIndex+1,waveCount:r.waveCount,encounterId:id,total:queue.length,aliveCap:encounter.aliveCap,forced:force,floorIndex:r.course.dungeonIndex});
 r.events.push({type:'dungeon-encounter-phase',roomId:first.roomId,encounterId:id,phase:encounter.stageLabel,phaseIndex:0,phaseCount:encounter.stageCount,beat:encounter.beat,total:encounter.stages[0].count});
 // Even explicit encounter starts use the normal safe, warned spawn path.
 // A test/debug caller must not create a second unsafe spawning mechanism.
 dungeonSyncEncounter(r);
 dungeonNavigation(r,true);
 return true;
}
function completeDungeonEncounter(r,encounter){
 const p=r.dungeonProgression;if(!p||p.currentEncounter!==encounter)return;
 const completedNodes=[];
 for(const index of encounter.planIndices||[]){const node=p.encounterPlan[index];if(!node)continue;node.status='cleared';completedNodes.push(node);if(!p.completedEncounterIds.includes(node.id))p.completedEncounterIds.push(node.id);if(node.roomId&&!p.roomsCompleted.includes(node.roomId))p.roomsCompleted.push(node.roomId);}
 p.currentEncounter=null;p.currentEncounterRoomId=null;p.nextEncounterIndex=p.encounterPlan.findIndex(node=>!node.optional&&node.status==='pending');
 if(p.nextEncounterIndex<0)p.nextEncounterIndex=p.encounterPlan.length;
 p.nextRoomId=p.encounterPlan[p.nextEncounterIndex]?.roomId||null;p.roomTravel=0;
 p.phase=p.nextRoomId?'exploration':'key';
 const clearedRoom=r.course.rooms.find(room=>room.id===encounter.roomId),players=livePlayers(r),health=players.length?Math.min(...players.map(player=>player.health)):r.health;
 p.reliefUntil=r.time+encounterRelief(r.course,clearedRoom,health);
 r.events.push({type:'dungeon-room-clear',roomId:completedNodes[0]?.roomId||null,roomName:dungeonRoomName(r.course,completedNodes[0]?.roomId),wave:encounter.waveIndex+1,encounterId:encounter.id,completedRooms:completedNodes.map(node=>node.roomId),floorIndex:r.course.dungeonIndex});
 releaseDungeonEncounterGates(r,r.waveCount);
 dungeonSyncEncounter(r);
 dungeonNavigation(r,true);
}
function updateDungeonEncounter(r,dt){
 const p=r.dungeonProgression;if(!p||!r.course?.dungeon)return;
 const plan=p.encounterPlan||[];
 updateTelegraphs(r,dt);
 const currentRoom=p.activeRoomId;
 const previousRoom=p.lastRoomId;
 const moved=Math.hypot(r.x-(p.lastX??r.x),r.y-(p.lastY??r.y));
 p.roomTravel=(p.roomTravel||0)+moved;
 let entered=false;
 if(currentRoom!==previousRoom){
  if(currentRoom&&previousRoom!==null)r.events.push({type:'dungeon-room-enter',roomId:currentRoom,roomName:dungeonRoomName(r.course,currentRoom),floorIndex:r.course.dungeonIndex,fromRoomId:previousRoom||null});
  entered=previousRoom!==null&&Boolean(currentRoom);
  if(previousRoom===null&&moved>=DUNGEON_ENTRY_THRESHOLD)entered=Boolean(currentRoom);
  const leavingEntry=!currentRoom&&previousRoom===p.entryRoomId&&p.nextRoomId===previousRoom;
  if(leavingEntry)entered=true;
  p.roomTravel=0;
 }else if(currentRoom&&p.roomTravel>=DUNGEON_ENTRY_THRESHOLD&&!p.currentEncounter&&p.nextRoomId===currentRoom){
  entered=true;p.roomTravel=0;
 }
 p.lastRoomId=currentRoom||null;p.lastX=r.x;p.lastY=r.y;p.observed=true;

 if(p.currentEncounter){
  const encounter=p.currentEncounter;encounter.elapsed+=dt;
  const released=encounter.queue.filter(item=>item.stage<=encounter.stageIndex);
  const stageDone=released.every(item=>item.status==='spawned');
  const alive=dungeonEncounterAlive(r,encounter),stageAge=encounter.elapsed-encounter.stageStarted;
  const stage=encounter.stages[encounter.stageIndex];
  const ready=stageDone&&stageAge>=stage.minAge
    &&(alive<=Math.max(2,Math.floor(encounter.aliveCap*.45))||(stageAge>stage.minAge+5&&alive<encounter.aliveCap-1));
  if(encounter.stageIndex+1<encounter.stageCount&&ready){
   encounter.nextStageAt??=encounter.elapsed+(stage.rest||0);
  }
  if(encounter.stageIndex+1<encounter.stageCount&&ready&&encounter.elapsed>=(encounter.nextStageAt??Infinity)){
   encounter.stageIndex++;encounter.stageStarted=encounter.elapsed;
   encounter.nextStageAt=null;
   const nextStage=encounter.stages[encounter.stageIndex];encounter.stageLabel=nextStage.label;
   for(const item of encounter.queue)if(item.stage===encounter.stageIndex)item.due=encounter.elapsed+item.warningLead+item.stageOrder*nextStage.spacing;
   r.events.push({type:'dungeon-encounter-phase',roomId:encounter.roomId,encounterId:encounter.id,
    phase:encounter.stageLabel,phaseIndex:encounter.stageIndex,phaseCount:encounter.stageCount,beat:encounter.beat,
    total:encounter.queue.filter(item=>item.stage===encounter.stageIndex).length});
   dungeonNavigation(r,true);
  }
  for(const item of encounter.queue){
   if(item.status==='spawned')continue;
   if(item.stage>encounter.stageIndex)continue;
   if(!item.telegraph&&encounter.elapsed<(item.nextAttempt||0))continue;
   if(item.telegraph&&!r.spawnTelegraphs.includes(item.telegraph))item.telegraph=null;
   const warningLead=item.warningLead||DUNGEON_TELEGRAPH_LEAD;
   const telegraphTime=Math.max(0,item.due-warningLead);
   if(encounter.elapsed>=telegraphTime&&!item.telegraph){
    item.nextAttempt=encounter.elapsed+.15;
    if(dungeonEncounterAlive(r,encounter)+r.spawnTelegraphs.filter(t=>t.encounterId===encounter.id).length>=encounter.aliveCap||aliveEnemies(r).length>=12)continue;
    const point=dungeonSpawnPoint(r,item,item.roomId,Math.max(0,encounter.elapsed-item.due));
    if(point){
     // The initial contact and a canceled/retried lane can already be close
     // to due. Every fresh warning still grants the complete reaction window.
     item.due=Math.max(item.due,encounter.elapsed+warningLead);
     item.spawnPoint=point;item.telegraph={id:r.nextId++,x:point.x,y:point.y,z:0,kind:item.kind,variant:item.variant,roomId:item.roomId,encounterId:encounter.id,life:warningLead+.15,phase:0,order:item.order};
     r.spawnTelegraphs.push(item.telegraph);r.events.push({type:'spawn-telegraph',x:point.x,y:point.y,z:0,enemyKind:item.kind,variant:item.variant,roomId:item.roomId,encounterId:encounter.id,sectorIndex:r.sectorIndex,wave:r.wave,dungeon:true});
    }
   }
   if(encounter.elapsed<item.due)continue;
   const telegraphs=r.spawnTelegraphs.filter(telegraph=>telegraph.encounterId===encounter.id&&telegraph!==item.telegraph).length;
   if(dungeonEncounterAlive(r,encounter)>=encounter.aliveCap||aliveEnemies(r).length>=12)continue;
   if(!item.telegraph)continue;
   const stillOpen=isIngressRouteOpen(AI_ENV,r.course,item.spawnPoint);
   const point=stillOpen&&pickSpawnPoint(AI_ENV,r.course,livePlayers(r),r.course.enemies,[item.spawnPoint],
    {minDist:3.5,relax:0,behind:false,seed:item.order,reservations:r.spawnTelegraphs,ignoreReservation:item.telegraph});
   if(!point){removeTelegraph(r,item);item.spawnPoint=null;item.due=encounter.elapsed+.2;continue;}
   if(item.telegraph){r.spawnTelegraphs=r.spawnTelegraphs.filter(telegraph=>telegraph!==item.telegraph);item.telegraph=null;}
   spawnEnemy(r,{...item,encounterId:encounter.id},point);item.status='spawned';
   encounter.ingressUses[point.ingressId]=(encounter.ingressUses[point.ingressId]||0)+1;
   encounter.ingressOpeningUses[point.openingId]=(encounter.ingressOpeningUses[point.openingId]||0)+1;
   if(encounter.state==='spawning'){encounter.state='combat';p.phase='combat';}
  }
  const pending=encounter.queue.some(item=>item.status!=='spawned');
  if(!pending&&dungeonEncounterAlive(r,encounter)===0)completeDungeonEncounter(r,encounter);
 }else if(plan.some(node=>node.status==='pending')){
  // Any uncleared room can respond to entry. The player chooses the flank;
  // an arbitrary wave-list order no longer sends them back through empty rooms.
  const roomId=currentRoom||previousRoom;
  const nodes=plan.filter(node=>node.status==='pending'&&node.roomId===roomId);
  const opening=roomId===p.entryRoomId&&p.completedEncounterIds.length===0&&r.time>=DUNGEON_START_DELAY;
  const inRoom=!!currentRoom&&p.completedEncounterIds.length>0;
  if(nodes.length&&(entered||opening||inRoom)&&r.time>=(p.reliefUntil||0))beginDungeonEncounter(r,nodes);
 }else{
  r.wave=Math.max(r.wave,r.waveCount);
  p.phase='key';
 }
 updateDungeonDirector(r,dt);
 const required=plan.filter(node=>!node.optional),active=aliveEnemies(r).filter(e=>isHunting(e)||!e.resident).length;
 p.combatReady=!p.currentEncounter&&!active&&required.every(node=>node.status==='cleared')&&p.keysCollected.length>=r.course.keys.length;
 p.exitReady=p.combatReady&&journeyComplete(r);
 if(required.every(node=>node.status==='cleared'))r.wave=r.waveCount;
 if(p.exitReady)p.phase='exit';
 dungeonSyncEncounter(r);
 dungeonNavigation(r);
}
// A short recovery beat can feed a pack into the next authored encounter's
// ingress. It is not a repeated behind-player teleport or a random floor rise.
function livePlayers(r){return [r,...(r.peer?[r.peer]:[])].filter(pl=>pl&&pl.health>0);}
const AMBUSH_VARIANTS=[['stalker','skitter'],['skitter','bloodhound','stalker'],['bloodhound','skitter','stalker']];
function tryDungeonAmbush(r){
 const p=r.dungeonProgression,course=r.course,players=livePlayers(r);
 if(!players.length||p.ambushQueue?.length)return false;
 const next=p.encounterPlan.find(node=>!node.optional&&node.status==='pending');
 if(!next)return false;
 const candidates=getIngressCandidates(AI_ENV,course,next.roomId);
 const point=pickSpawnPoint(AI_ENV,course,players,course.enemies,candidates,{minDist:5.5,relax:0,behind:false,seed:p.pacing.ambushes*7+1});
 if(!point)return false;
 if(!findPath(AI_ENV,course,point,r))return false;
 const tiers=AMBUSH_VARIANTS[Math.min(AMBUSH_VARIANTS.length-1,course.dungeonIndex||0)];
 const count=Math.min(12-aliveEnemies(r).length,2+Math.min(2,Math.floor(p.completedEncounterIds.length/2))),pack=`ambush:${p.pacing.ambushes}`;
 if(count<=0)return false;
 const queue=[];
 for(let i=0;i<count;i++){
  const variant=tiers[Math.floor(hash01(p.pacing.ambushes,i+3)*tiers.length)],profile=ENEMY_PROFILES[variant];
  const at=pickSpawnPoint(AI_ENV,course,players,course.enemies,candidates.filter(p=>p.ingressId===point.ingressId),
   {minDist:5.5,relax:0,behind:false,seed:i,reservations:r.spawnTelegraphs,ingressSpeed:ingressMoveSpeed(profile.speed)});
  if(!at)continue;
  const telegraph={id:r.nextId++,x:at.x,y:at.y,z:0,kind:profile.kind,variant,roomId:at.roomId,
   encounterId:null,ambush:true,life:DUNGEON_TELEGRAPH_LEAD+.3,phase:0,order:i};
  r.spawnTelegraphs.push(telegraph);
  r.events.push({type:'spawn-telegraph',x:at.x,y:at.y,z:0,enemyKind:profile.kind,variant,
   roomId:at.roomId,sectorIndex:r.sectorIndex,wave:r.wave,dungeon:true,ambush:true});
  queue.push({variant,kind:profile.kind,role:profile.role,cost:profile.cost,ambush:true,order:i,pack,
   roomId:at.roomId||null,encounterId:null,mindState:'stalk',spawnPoint:at,telegraph,due:r.time+DUNGEON_TELEGRAPH_LEAD});
 }
 if(!queue.length)return false;
 p.ambushQueue=queue;
 r.events.push({type:'dungeon-ingress',roomId:point.roomId,encounterId:null,ingressId:point.ingressId,
  openingId:point.openingId,label:point.ingressLabel,side:point.ingressSide,x:point.portal.x,y:point.portal.y,
  phase:'Patrol approach',phaseIndex:0,ambush:true});
 noteAmbush(p.pacing);
 return true;
}
function dungeonRecoveryRoom(course,players,progression){
 return players.some(player=>{
  const room=dungeonRoomAt(course,player.x,player.y);
  if(!room)return false;
  const policy=roomRecoveryPolicy(course,room);
  return policy.isSafeRoom||(policy.safeAfterClear&&progression.roomsCompleted.includes(room.id));
 });
}
function updateDungeonAmbush(r,recoveryRoom){
 const p=r.dungeonProgression;if(!p.ambushQueue?.length)return;
 const pending=[];let spawned=0,first=null;
 for(const item of p.ambushQueue){
  if(p.currentEncounter||recoveryRoom||!r.spawnTelegraphs.includes(item.telegraph)){
   removeTelegraph(r,item);continue;
  }
  if(r.time<item.due){pending.push(item);continue;}
  const at=aliveEnemies(r).length<12&&isIngressRouteOpen(AI_ENV,r.course,item.spawnPoint)
   &&pickSpawnPoint(AI_ENV,r.course,livePlayers(r),r.course.enemies,[item.spawnPoint],
    {minDist:5.5,relax:0,behind:false,reservations:r.spawnTelegraphs,ignoreReservation:item.telegraph});
  removeTelegraph(r,item);
  if(!at)continue;
  spawnEnemy(r,item,at);spawned++;first??=at;
 }
 p.ambushQueue=pending;
 if(spawned)r.events.push({type:'ambush',x:first.x,y:first.y,z:0,count:spawned,roomId:first.roomId,floorIndex:r.course.dungeonIndex});
}
function updateDungeonDirector(r,dt){
 const p=r.dungeonProgression;if(!p)return;
 p.directorClock=(p.directorClock||0)+dt;
 if(p.directorClock<.25)return;
 const step=p.directorClock;p.directorClock=0;
 if(!p.pacing)p.pacing=createPacing();
 const alive=aliveEnemies(r),players=livePlayers(r);
 const hunting=alive.filter(e=>isHunting(e)).length;
 const near=alive.filter(e=>isHunting(e)&&players.some(pl=>Math.hypot(e.x-pl.x,e.y-pl.y)<3.5)).length;
 const recoveryRoom=dungeonRecoveryRoom(r.course,players,p),health=players.length?Math.min(...players.map(player=>player.health)):r.health;
 updateDungeonAmbush(r,recoveryRoom);
 const verdict=updatePacing(p.pacing,{hunting,near,health,encounterActive:!!p.currentEncounter,cleared:p.completedEncounterIds.length,maxAmbushes:Math.min(10,4+(r.course.dungeonIndex||0)),hostile:hunting,recoveryRoom},step);
 p.pacing.hunting=hunting;
 if(verdict.ambush&&p.nextEncounterIndex<(p.encounterPlan||[]).length&&(p.throttle=(p.throttle||0)+step)>=.5){p.throttle=0;tryDungeonAmbush(r);}
}
export function spawnWave(r){
 if(r.campaign){if(r.director?.state==='intermission'&&!(r.roomProgression?.requireEntry&&Number.isInteger(r.roomProgression.pendingIndex)&&r.roomProgression.pendingIndex>r.roomProgression.currentIndex))beginCampaignWave(r);return;}
 if(r.course?.dungeon){
   const progression=r.dungeonProgression||(r.dungeonProgression=createDungeonProgression(r.course));
   if(progression.currentEncounter)return false;
   const plan=progression.encounterPlan||[],next=plan[progression.nextEncounterIndex||0];
   if(!next)return false;
   const nodes=plan.filter(node=>node.status==='pending'&&node.roomId===next.roomId);
   beginDungeonEncounter(r,nodes,{force:true});
   return true;
  }
 r.wave++;
  {
   const spots=[[2,2],[10,2],[6,3],[2,6],[10,6],[6,1.8],[1.5,4],[10.5,4]];
   for(let i=0;i<4+r.wave;i++){const p=spots[i%spots.length],kind=i%3;r.course.enemies.push({id:r.nextId++,x:p[0],y:p[1],z:0,hp:kind===2?10:kind===1?7:5,kind,variant:kind===0?'stalker':kind===1?'caster':'brute',dead:false,flash:0,attack:.5+i*.23,phase:i});}
   r.events.push({type:'wave',wave:r.wave,waveCount:3,sectorIndex:0});
  }
}
function updateDungeonProgression(r){
 const course=r.course,progression=r.dungeonProgression;
 if(!course?.dungeon||!progression)return;
  const activeRoom=dungeonRoomAt(course,r.x,r.y);
  progression.activeRoomId=activeRoom?.id||null;
 for(const item of course.supplies||[]){
  if(progression.suppliesCollected.includes(item.id))continue;
  const collector=livePlayers(r).find(player=>(player.health<100||player.energy<100)&&Math.hypot(player.x-item.x,player.y-item.y)<.65);
  if(!collector)continue;
  const health=Math.min(item.health,Math.max(0,100-collector.health)),energy=Math.min(item.energy,Math.max(0,100-collector.energy));
  collector.health+=health;collector.energy+=energy;collector.heal=1;
  progression.suppliesCollected.push(item.id);
  r.events.push({type:'dungeon-supply',supplyId:item.id,roomId:item.roomId,health,energy,playerId:playerId(collector),x:item.x,y:item.y,floorIndex:course.dungeonIndex});
 }
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
  if(newWeapon){r.ownedWeapons.push(item.weaponIndex);switchWeapon(r,item.weaponIndex);if(r.peer)r.peer.ownedWeapons=[...r.ownedWeapons];}
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
}
// Death freezes player updates. Clear every transient movement/action intent
// before revival or relocation so a stored dash, hook or charge cannot resume.
function resetPlayerMotion(player){
 player.z=0;player.vx=0;player.vy=0;player.vz=0;player.speed=0;player.dashTime=0;player.slide=0;
 player.hookTime=0;player.hookTarget=-1;player.slam=false;player.wallJumps=0;player.pressed={};
 player.respawnTime=0;player.journeyInteract=false;player.rifleCharge=0;player.rifleCharging=false;
 player.rifleBurst=0;player.rifleBurstTimer=0;player.parryTime=0;player.punch=0;
 cancelMelee(player);cancelExtraction(player,'relocated');
}
function revivePlayer(player,survivor){
 player.x=survivor.x;player.y=survivor.y;player.health=65;
 resetPlayerMotion(player);resetBite(player);player.bite.cooldown=BITE_TIMING.grace;
}
function advanceDungeonFloor(r){
 const previous=r.course,progress=r.dungeonProgression||{},previousJourney=r.journey,floorIndex=previous.dungeonIndex+1,course=makeDungeonCourse(floorIndex,{journey:previous.journeyEnabled===true,extended:previous.extended===true});
 if(course.extended)attachScavengerPickups(course);
 r.course=course;r.sectorIndex=floorIndex;r.sectorCount=course.dungeonCount;r.sectorId=course.sectorId;r.sectorName=course.name;resetVerminWorld(r);
 resetPlayerMotion(r);resetBite(r);r.journey=createJourney(course,previousJourney);
  r.dungeonProgression=createDungeonProgression(course);
  r.dungeonProgression.startIndex=progress.startIndex??previous.dungeonIndex;
  r.dungeonProgression.floorsCleared=(progress.floorsCleared||0)+1;
  r.wave=0;r.waveCount=course.waveCount;r.waveDelay=0;r.director=null;r.campaignComplete=false;
 r.x=course.playerSpawn.x;r.y=course.playerSpawn.y;r.z=0;r.vx=0;r.vy=0;r.vz=0;r.angle=course.playerSpawn.angle??-Math.PI/2;r.pitch=0;
 r.spawnTelegraphs=[];r.projectiles=[];r.coins=[];r.explosions=[];r.pools=[];r.tracers=[];r.gore=[];r.blood=[];r.limbs=[];
 if(r.peer){
  const peer=r.peer;peer.course=course;peer.dungeonProgression=r.dungeonProgression;peer.journey=r.journey;
  peer.sectorIndex=floorIndex;peer.sectorCount=course.dungeonCount;peer.sectorId=course.sectorId;peer.sectorName=course.name;
  peer.x=course.playerSpawn.x+.35;peer.y=course.playerSpawn.y;
  if(!canStand(course,peer.x,peer.y,.1)){peer.x=course.playerSpawn.x;peer.y=course.playerSpawn.y;}
  peer.angle=r.angle;peer.pitch=0;peer.mode='play';peer.health=Math.max(65,peer.health);
  resetPlayerMotion(peer);resetBite(peer);peer.ownedWeapons=[...r.ownedWeapons];peer.storyRecords=r.storyRecords;
  peer.vermin=r.vermin;peer._verminCourse=course;peer.wave=0;peer.waveCount=course.waveCount;peer.waveDelay=0;
  for(const key of ['spawnTelegraphs','projectiles','coins','explosions','pools','tracers','gore','blood','limbs'])peer[key]=r[key];
 }
 r.events.push({type:'sector-transition',sectorIndex:floorIndex,sectorName:course.name,dungeon:true,floorIndex,floorCount:course.dungeonCount});
}
function move(r,dx,dy){const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.04));for(let i=0;i<n;i++){
 const nx=r.x+dx/n,ny=r.y+dy/n,height=STRUCTURE_BODY_HEIGHT-(r.slide||0)*.18;
 const scoped=!!(r.structureId||structureAt(r.course,r.x,r.y,.1)||structureAt(r.course,nx,ny,.1));
 if(canTraverseRoomGates(r.course,r.roomProgression,r.x,r.y,nx,r.y)&&canStand(r.course,nx,r.y,.1,scoped?playerFoot(r):undefined,height)&&!vehicleContains(r.vehicle,nx,r.y,.1)){r.x=nx;if(scoped)resolveActorSupport(r.course,r);}else r.vx=0;
 if(canTraverseRoomGates(r.course,r.roomProgression,r.x,r.y,r.x,ny)&&canStand(r.course,r.x,ny,.1,scoped?playerFoot(r):undefined,height)&&!vehicleContains(r.vehicle,r.x,ny,.1)){r.y=ny;if(scoped)resolveActorSupport(r.course,r);}else r.vy=0;
}}
// Elapsed is total sequence time. Keep the strike time and full duration in
// state so host and guest visuals can use the same timeline across phases.
export const BRUTAL_TIMING=Object.freeze({
 chop:Object.freeze({contactAt:.18,contact:.07,recover:.4,duration:.65,damage:8}),
 twist:Object.freeze({contactAt:.24,contact:.06,recover:.6,duration:.9,damage:12}),
 rip:Object.freeze({contactAt:.22,contact:.08,recover:.7,duration:1,damage:12}),
 pierce:Object.freeze({contactAt:.24,contact:.44,extractionAt:.68,releaseAt:.95,recover:.55,duration:1.5,lethal:true}),
});
const BRUTAL_ENERGY=10,CHEST_ENERGY=15,CHEST_OPENING_GRACE=.45,BRUTAL_RANGE=.27,BRUTAL_CONTACT_RANGE=.31,BRUTAL_CONE=.72;
function makeBrutalState(sequence=0){return{phase:'idle',kind:'chop',enemyId:null,elapsed:0,sequence,contactApplied:false,extractionApplied:false,releaseApplied:false,side:'left',contactAt:0,extractionAt:0,releaseAt:0,duration:0,cancelReason:''};}
const brutalActive=r=>!!r.brutal&&r.brutal.phase!=='idle';
const verminBusy=r=>!!r.verminHand&&r.verminHand.phase!=='idle';
function brutalEvent(r,type,e,extra={}){
 const b=r.brutal;
 r.events.push({type,playerId:playerId(r),enemyId:e?.id??b.enemyId,sequence:b.sequence,phase:b.phase,
  kind:b.kind,side:b.side,elapsed:b.elapsed,contactAt:b.contactAt,extractionAt:b.extractionAt,releaseAt:b.releaseAt,duration:b.duration,x:e?.x??r.x,y:e?.y??r.y,z:(e?enemyBase(e):groundAt(r.course,r.x,r.y))+.4,...extra});
}
function cancelBrutal(r,reason){
 if(!brutalActive(r))return false;
 brutalEvent(r,'brutal-cancel',null,{reason,contactApplied:r.brutal.contactApplied});
 r.brutal={...makeBrutalState(r.brutal.sequence),cancelReason:reason};return true;
}
function brutalInReach(r,e,range=BRUTAL_RANGE){
 if(!e||r.z>.24||(e.meleeZ||e.z||0)>.28)return false;
 if(Math.abs(playerFoot(r)-freshEnemyBase(r,e))>.28)return false;
 const dx=e.x-r.x,dy=e.y-r.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
 return d<range&&Math.abs(angleDiff(a,r.angle))<BRUTAL_CONE
  &&castRay(r.course,r.x,r.y,a,d+.1).dist>d-.01;
}
function brutalEligible(r,e,energyCost=BRUTAL_ENERGY){
 const profile=e&&enemyProfile(e),world=r.world||r;
 return !!e&&!e.dead&&e.hp>0&&e.kind===0&&!e.boss&&!e.isBoss&&profile.role!=='anchor'&&profile.role!=='boss'
  &&r.playerWounds?.leftArm!=='severed'&&r.playerWounds?.rightArm!=='severed'
  &&!e.brutalWound&&!brutalActive(r)&&(!r.verminHand||r.verminHand.phase==='idle')&&r.energy>=energyCost&&brutalInReach(r,e)
  &&![world,world.peer].some(p=>p&&p!==r&&brutalActive(p)&&p.brutal.enemyId===e.id);
}
function parryTarget(r){
 return r.course.enemies.filter(e=>{
  if(e.dead)return false;
  if(Math.abs(playerFoot(r)-freshEnemyBase(r,e))>.65)return false;
  const dx=e.x-r.x,dy=e.y-r.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
  return d<.65&&Math.abs(angleDiff(a,r.angle))<.9&&castRay(r.course,r.x,r.y,a).dist>d-.1;
 }).sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y)||a.id-b.id)[0]||null;
}
// UI readiness derives from the same pure selector used by the F action.
// A near-complete struggle always escapes, even when the counter is unavailable.
export function brutalCandidate(r){
 if(r.mode!=='play'||r.health<=0||r.vehicle?.occupied||r.parryCooldown>0||brutalActive(r))return null;
 const held=r.bite?.phase==='held',e=held?r.course.enemies.find(e=>e.id===r.bite.enemyId):parryTarget(r);
 if(!brutalEligible(r,e)||held&&r.bite.escape<.35)return null;
 const stagger=r.bite?.phase==='windup'&&r.bite.enemyId===e.id?Math.max(e.stagger||0,1.1):(e.stagger||0);
 const maxHp=e.maxHp||enemyProfile(e).hp||e.hp;
 const kind=held?'rip':stagger>=.28&&e.hp<=Math.min(12,maxHp*.4)?'twist':'chop';
 const aimed=held?null:traceEnemyBody(e,{x:r.x,y:r.y,z:eye(r)},{x:Math.cos(r.angle)*Math.cos(r.pitch),y:Math.sin(r.angle)*Math.cos(r.pitch),z:Math.sin(r.pitch)},.65,freshEnemyBase(r,e));
 if(aimed?.part.endsWith('Leg')||aimed?.part==='head'&&aimed.hit.fraction>.62)return null;
 // Low limb and crown aim uses the free directed slice even in grab range.
 // Chest-height aim keeps the committed close counter and its contact.
 if(!held&&(r.pitch<-.65||r.pitch>.24))return null;
 if(kind==='chop'&&e.wounds?.arm)return null;
 return{enemyId:e.id,kind,side:held?r.bite.side:((e.id+(r.brutal?.sequence||0)+1)%2?'left':'right')};
}
// The committed chest action has its own input. It only opens on a visibly
// injured, recently staggered supported actor; it never replaces a free bite escape.
export function chestCandidate(r){
 if(r.mode!=='play'||r.health<=0||brutalActive(r)||['windup','held','terminal'].includes(r.bite?.phase))return null;
 const e=parryTarget(r);
 if(!brutalEligible(r,e,CHEST_ENERGY))return null;
 const maxHp=e.maxHp||enemyProfile(e).hp||e.hp;
 // Host peers reference the world directly. Guest snapshots keep the host in
 // peer; their own predicted movement clock can lag after a down/revival.
 const worldTime=r.world?.time??(r.playerId==='peer'&&Number.isFinite(r.peer?.time)?r.peer.time:r.time);
 const recentStagger=Number.isFinite(e.chestOpeningUntil)&&e.chestOpeningUntil>worldTime;
 if(((e.stagger||0)<.18&&!recentStagger)||e.hp>maxHp*.65)return null;
 return{enemyId:e.id,kind:'pierce',side:'right'};
}
export function chestFinisher(r){
 if(r.vehicle?.occupied)return false;
 const candidate=chestCandidate(r);
 return !!candidate&&beginBrutal(r,r.course.enemies.find(e=>e.id===candidate.enemyId),candidate.kind,candidate.side);
}
function interruptEnemy(e,duration){
 e.stagger=Math.max(e.stagger||0,duration);e.attacking=false;e.windup=0;e.strike=0;e.slashHit=true;
 if(e.mind){e.mind.token=false;e.mind.justAttacked=false;}
}
function beginBrutal(r,e,kind,side){
 const energyCost=kind==='pierce'?CHEST_ENERGY:BRUTAL_ENERGY;
 if(!brutalEligible(r,e,energyCost)||kind==='chop'&&e.wounds?.arm)return false;
 const timing=BRUTAL_TIMING[kind],sequence=(r.brutal?.sequence||0)+1,interrupt=!!e.attacking;
 r.brutal={...makeBrutalState(sequence),phase:'windup',kind,enemyId:e.id,
  side:side||((e.id+sequence)%2?'left':'right'),contactAt:timing.contactAt,extractionAt:timing.extractionAt||0,releaseAt:timing.releaseAt||0,duration:timing.duration,interrupt};
 r.energy-=energyCost;cancelExtraction(r,'counter');cancelMelee(r);
 r.rifleBurst=0;r.rifleBurstTimer=0;r.rifleCharge=0;r.rifleCharging=false;
 interruptEnemy(e,timing.contactAt+.01);
 if(interrupt)award(r,80,'+ INTERRUPT');
 brutalEvent(r,'brutal-start',e,{damage:timing.lethal?e.hp:timing.damage,lethal:!!timing.lethal,energyCost});return true;
}
function applyBrutalContact(r,e){
 const b=r.brutal,timing=BRUTAL_TIMING[b.kind],region=b.kind==='chop'?'arm':b.kind==='twist'?'neck':b.kind==='pierce'?'chest':'torso',damage=timing.lethal?Math.max(1,e.hp):timing.damage;
 // Reserve the result before damage/death callbacks. A specific contact never
 // invokes the generic random limb roll or alters unrelated anatomy.
 b.contactApplied=true;b.phase='contact';
 e.brutalWound={sequence:b.sequence,type:b.kind,side:b.side,region,playerId:playerId(r),at:r.time};
 e.wounds||={arm:false,leg:false,eye:false};e.wounds[region]=true;e.wounded=true;
 if(b.kind==='chop'){
  e.wounds.armSide=b.side;
  e.moveSpeed=(e.baseMoveSpeed??e.moveSpeed??enemyProfile(e).speed??.3)*(e.wounds.leg?.82:.92);
 }else if(b.kind==='twist')e.neckBroken=true;
 else if(b.kind==='pierce')e.chestPierced=true;
 else e.eviscerated=true;
 e.drip=(e.drip||0)+.35;
 damageEnemy(r,e,damage,b.interrupt?'+ INTERRUPT':b.kind==='chop'?'+ ARM CHOP':b.kind==='twist'?'+ NECK TWIST':b.kind==='pierce'?'+ CHEST PIERCE':'+ GUT RIP',
  {x:e.x,y:e.y,z:enemyBase(e)+(b.kind==='twist'?.5:b.kind==='rip'?.3:.4),brutal:true});
 brutalEvent(r,'brutal-contact',e,{damage,lethal:!!timing.lethal,killed:e.dead,wound:{...e.brutalWound}});
}
// Only the authoritative world tick advances counters. tickPlayer prediction
// can animate movement without applying damage, wounds or a second contact.
function advanceBrutal(world,r,dt){
 if(!brutalActive(r))return;
 const b=r.brutal,e=world.course.enemies.find(e=>e.id===b.enemyId),timing=BRUTAL_TIMING[b.kind];
 if(r.mode!=='play'||r.health<=0){cancelBrutal(r,r.health<=0?'player-down':'inactive');return;}
 if(r.playerWounds?.leftArm==='severed'||r.playerWounds?.rightArm==='severed'){cancelBrutal(r,'arm-unavailable');return;}
 if(!e||e.dead&&!b.contactApplied){cancelBrutal(r,'target-unavailable');return;}
 if(!(b.kind==='pierce'&&b.contactApplied)&&!brutalInReach(r,e,BRUTAL_CONTACT_RANGE)){cancelBrutal(r,'out-of-range');return;}
 if(!b.contactApplied&&e.brutalWound){cancelBrutal(r,'target-wounded');return;}
 b.elapsed=Math.min(b.duration,b.elapsed+dt);
 if(!b.contactApplied){
  if(b.elapsed+1e-8<b.contactAt){interruptEnemy(e,b.contactAt-b.elapsed+.01);return;}
  applyBrutalContact(r,e);
 }
 if(b.kind==='pierce'){
  if(!b.extractionApplied&&b.elapsed+1e-8>=b.extractionAt){
   b.extractionApplied=true;b.phase='extract';e.heartRemoved=true;
   e.brutalWound.heartRemoved=true;
   brutalEvent(r,'brutal-extract',e,{heartRemoved:true,wound:{...e.brutalWound}});
  }
  if(!b.releaseApplied&&b.elapsed+1e-8>=b.releaseAt){
   b.releaseApplied=true;b.phase='recover';
   brutalEvent(r,'brutal-release',e,{heartRemoved:e.heartRemoved});brutalEvent(r,'brutal-recover',e);
  }
 }else if(b.phase==='contact'&&b.elapsed+1e-8>=b.contactAt+timing.contact){b.phase='recover';brutalEvent(r,'brutal-recover',e);}
 if(b.elapsed+1e-8>=b.duration){brutalEvent(r,'brutal-complete',e);r.brutal=makeBrutalState(b.sequence);}
}
export function parry(r){if(r.mode!=='play'||r.health<=0||r.vehicle?.occupied||r.parryCooldown>0)return false;
 syncEnemyGrounds(r);
 const candidate=brutalCandidate(r);
 r.parryTime=.19;r.parryCooldown=.45;r.punch=.3;const punchIndex=r.events.length;r.events.push({type:'punch',x:r.x,y:r.y,z:eye(r)});
 if(r.bite?.phase==='held'){
  const e=r.course.enemies.find(e=>e.id===r.bite.enemyId);
  addBiteEscape(r,.65,'parry');
  if(candidate&&r.bite.phase==='released'&&beginBrutal(r,e,candidate.kind,candidate.side))r.events.splice(punchIndex,1);
  return true;
 }
 if(r.bite?.phase==='windup')releaseBite(r,'parried',true);
 // A second F still opens the projectile parry window, but cannot stack a
 // punch or another counter while the committed sequence is recovering.
 if(brutalActive(r))return true;
 const e=parryTarget(r)||r.course.enemies.filter(e=>e.dead&&!e.extracted&&supportsAnatomy(e)).map(e=>({e,hit:traceEnemyBody(e,{x:r.x,y:r.y,z:eye(r)},{x:Math.cos(r.angle)*Math.cos(r.pitch),y:Math.sin(r.angle)*Math.cos(r.pitch),z:Math.sin(r.pitch)},.65)})).filter(t=>t.hit).sort((a,b)=>a.hit.distance-b.hit.distance)[0]?.e;
 if(e){
  if(!candidate||candidate.enemyId!==e.id||!beginBrutal(r,e,candidate.kind,candidate.side)){
   const interrupt=e.attacking,d=Math.hypot(e.x-r.x,e.y-r.y),c=Math.cos(r.pitch);
   const body=traceEnemyBody(e,{x:r.x,y:r.y,z:eye(r)},{x:Math.cos(r.angle)*c,y:Math.sin(r.angle)*c,z:Math.sin(r.pitch)},.8/c);
   if(body||!supportsAnatomy(e))damageEnemy(r,e,3,interrupt?'+ INTERRUPT':'+ HAND SLICE',{...(body?.hit||{x:e.x,y:e.y,z:eye(r)+d*Math.tan(r.pitch)}),source:'slice',angle:r.angle,pitch:r.pitch});
   interruptEnemy(e,.45);
   if(interrupt)award(r,80,'+ INTERRUPT');
  }else r.events.splice(punchIndex,1);
 }
 return true;
}
export function cancelMelee(r){
 r.meleeActive=false;r.meleeProgress=1;r.meleeResolved=false;r.meleeContact=0;r.meleeHitStop=0;
 r.sawActive=false;r.sawRev=0;r.sawContact=0;r.sawTick=0;
}

// Contact is sampled at the strike frame, not at button-down. A committed
// swing may cleave two nearby enemies, but each target takes one hit only.
function meleeTargets(r,range,cone,limit){
 syncEnemyGrounds(r);
 const height=eye(r),slope=Math.tan(r.pitch);
 return r.course.enemies.filter(e=>!e.extracted&&(!e.dead||supportsAnatomy(e))).map(e=>{
  if(r.weapon===7){const t=enemyRayTarget(e,r,r.angle,r.pitch,range+.14);return t?{e,d:t.along,a:r.angle,z:t.z,bodyHit:t.bodyHit}:null;}
  const dx=e.x-r.x,dy=e.y-r.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
  return{e,d,a,z:height+d*slope};
 }).filter(t=>t&&t.d<=range+enemyHitRadius(t.e,.16)&&Math.abs(angleDiff(t.a,r.angle))<=cone
  &&(t.bodyHit||t.z>=enemyBase(t.e)-.08&&t.z<=enemyHitHeight(t.e,.52)+enemyBase(t.e)+.08)
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
 const hit={...(target.bodyHit||{x:r.x+Math.cos(r.angle)*target.d,y:r.y+Math.sin(r.angle)*target.d,z:clamp(z,enemyBase(e)+.02,enemyHitHeight(e,.52)+enemyBase(e))}),source:kind==='chainsaw'?'chainsaw':'blunt',angle:r.angle,pitch:r.pitch};
 damageEnemy(r,e,damage*weaponDamageMultiplier(r,r.weapon),kind==='chainsaw'?'+ CARVED UP':heavy?'+ HOME RUN':'+ LIGHTS OUT',hit);
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
 const slope=Math.tan(r.pitch),floor=castGroundRay(r.course,r.x,r.y,eye(r),r.angle,slope,range);
 const onFloor=floor<wall.dist&&floor<range,distance=onFloor?floor:wall.dist,height=eye(r)+distance*slope;
 const x=r.x+Math.cos(r.angle)*distance,y=r.y+Math.sin(r.angle)*distance;
 const ground=groundAt(r.course,x,y);if(distance>=range||height<ground||height>ground+1.45)return false;
 world.tracers.push({id:world.nextId++,x:r.x,y:r.y,z:eye(r),tx:x,ty:y,tz:height,surface:onFloor?'floor':'wall',
  normal:onFloor?{x:0,y:0,z:1}:wall.side===0?{x:-Math.sign(Math.cos(r.angle)),y:0,z:0}:{x:0,y:-Math.sign(Math.sin(r.angle)),z:0},
  ownerId:playerId(r),life:.14,duration:.14,weapon:r.weapon,hit:false,melee:true,heavy});
 r.events.push({type:'melee-wall',weapon:r.weapon,heavy,x,y,z:height});r.meleeContact=.12;
 return true;
}

export function shootMelee(r,secondary=false,predicted=false){
 if(r.mode!=='play'||r.health<=0||r.vehicle?.occupied||brutalActive(r)||verminBusy(r)||r.weapon<6||r.weapon>7)return false;
 if(r.weapon===7&&!secondary)return false; // Held cutting is stepped below.
 if(r.meleeActive||r.cooldowns[r.weapon]>0)return false;
 r.meleeActive=true;r.meleeProgress=0;r.meleeResolved=false;r.meleeHeavy=secondary;
 r.meleeDuration=r.weapon===7?.64:secondary?1.02:.68;r.meleeSequence=(r.meleeSequence||0)+1;
 r.cooldowns[r.weapon]=r.meleeDuration+.04;r.fireCooldown=r.cooldowns[r.weapon];
 r.events.push({type:'bat-swing',weapon:r.weapon,heavy:secondary,x:r.x,y:r.y,z:eye(r),predicted});
 return true;
}

function advanceMelee(r,dt,input){
 if(brutalActive(r)||verminBusy(r)){cancelMelee(r);return;}
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
 const groundBefore=syncEnemyGround(r,e),heightBefore=e.meleeZ||0,airborne=heightBefore>.001||(e.meleeVZ||0)>0;
 const vx=e.meleeVX||0,vy=e.meleeVY||0,steps=Math.max(1,Math.ceil(Math.hypot(vx,vy)*dt/.035));
 for(let i=0;i<steps;i++){
  const mx=(e.meleeVX||0)*dt/steps,my=(e.meleeVY||0)*dt/steps;
  if(canStand(r.course,e.x+mx,e.y,.16))e.x+=mx;else e.meleeVX=0;
  if(canStand(r.course,e.x,e.y+my,.16))e.y+=my;else e.meleeVY=0;
 }
 const groundAfter=syncEnemyGround(r,e);
 e.meleeVZ=(e.meleeVZ||0)-7.5*dt;e.meleeZ=Math.max(0,heightBefore+e.meleeVZ*dt+(airborne?groundBefore-groundAfter:0));
 if(e.meleeZ===0)e.meleeVZ=0;
 const drag=Math.exp(-dt*(e.dead?3.8:8));e.meleeVX*=drag;e.meleeVY*=drag;
 e.meleeYaw=clamp((e.meleeYaw||0)+(e.meleeSpinV||0)*dt,-.85,.85);e.meleeSpinV=(e.meleeSpinV||0)*Math.exp(-dt*5);
}

// Rifles share the authoritative hit rules and pooled tracer path. Prediction
// only advances the local mechanism/audio state, never enemy health or effects.
function enemyRayTarget(e,r,a,pitch,max){
 syncEnemyGround(r,e);
 const dx=Math.cos(a),dy=Math.sin(a),ex=e.x-r.x,ey=e.y-r.y,along=ex*dx+ey*dy,slope=Math.tan(pitch),oz=eye(r);
 if(supportsAnatomy(e)){
  const c=Math.cos(pitch),body=traceEnemyBody(e,{x:r.x,y:r.y,z:oz},{x:dx*c,y:dy*c,z:Math.sin(pitch)},max/c);
  return body?{e,along:body.distance*c,side:0,z:body.hit.z,bodyHit:body.hit}:null;
 }
 const z=oz+along*slope,side=Math.abs(-ex*dy+ey*dx);
 return along>0&&along<max+.01&&side<enemyHitRadius(e,.16)&&z>=enemyBase(e)&&z<enemyBase(e)+enemyHitHeight(e,.52)?{e,along,side,z}:null;
}
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
 const oz=eye(r),slope=Math.tan(r.pitch),wallHit=castRay(r.course,r.x,r.y,a,w.range,oz,slope);
 const floor=castGroundRay(r.course,r.x,r.y,oz,a,slope,Math.min(w.range,wallHit.dist)),max=Math.min(w.range,wallHit.dist,floor);
 const dx=Math.cos(a),dy=Math.sin(a);
 const targets=r.course.enemies.filter(e=>!e.extracted&&(!e.dead||supportsAnatomy(e))).map(e=>enemyRayTarget(e,r,a,r.pitch,max)).filter(Boolean)
 .sort((a,b)=>a.along-b.along||(a.e.id||0)-(b.e.id||0)).slice(0,charged?3:1);
 // Rifle rounds can shoot an ejected Breach core, but cannot inherit Arc's nuke.
 const core=world.projectiles.find(p=>{
  if(!p.core||p.attachment||p.life<=0)return false;
  const px=p.x-r.x,py=p.y-r.y,along=px*dx+py*dy;
  return along>0&&along<Math.min(max,targets[0]?.along??max)&&Math.abs(-px*dy+py*dx)<.14&&Math.abs(p.z-(oz+along*slope))<.14;
 });
 let end=max,hit=false,scoringHit=false,surface=wallHit.structureId?wallHit.surface:floor<=wallHit.dist&&floor<=w.range?'floor':wallHit.dist<w.range&&oz+slope*max<=groundAt(r.course,r.x+dx*max,r.y+dy*max)+1.45?'wall':'air';
 if(core){end=(core.x-r.x)*dx+(core.y-r.y)*dy;core.life=0;core.nuke=false;explode(world,core);award(r,120,'+ CORE SHOT');surface='air';}
 else for(let i=0;i<targets.length;i++){
  scoringHit ||= !targets[i].e.dead;
  const t=targets[i],head=t.bodyHit?t.bodyHit.part==='head':t.z-enemyBase(t.e)>.38,damage=(charged?11:w.damage)*(head?1.5:1)*Math.pow(.82,i);
  damageEnemy(r,t.e,damage*weaponDamageMultiplier(r,r.weapon),charged?'+ THROUGH THE VEIL':head?'+ HEADSHOT':'+ ELIMINATED',{...(t.bodyHit||{x:r.x+dx*t.along,y:r.y+dy*t.along,z:t.z}),angle:a,pitch:r.pitch});
  if(charged)t.e.stagger=Math.max(t.e.stagger||0,.22);
  end=t.along;hit=true;surface='flesh';
 }
 const duration=charged?.18:r.weapon===4?.085:.13;
 world.tracers.push({id:world.nextId++,x:r.x,y:r.y,z:oz,tx:r.x+dx*end,ty:r.y+dy*end,tz:oz+slope*end,
   surface,normal:wallHit.normal??(surface==='floor'?{x:0,y:0,z:1}:wallHit.side===0?{x:-Math.sign(dx),y:0,z:0}:{x:0,y:-Math.sign(dy),z:0}),
  ownerId:playerId(r),life:duration,duration,weapon:r.weapon,hit,charged,mode,rail:false});
 if(scoringHit)award(r,charged&&targets.length>1?95:Math.max(8,38-r.repeat*5),charged&&targets.length>1?'+ THREAD THE NEEDLE':mode==='burst'?'+ CONTROLLED BURST':'+ RIFLE HIT');
 return true;
}

export function shootRifle(r, secondary=false, predicted=false) {
 if(r.mode!=='play'||r.health<=0||r.vehicle?.occupied||brutalActive(r)||verminBusy(r)||(r.weapon!==4&&r.weapon!==5))return false;
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
 const focus=r.weapon<6&&input.alt&&!brutalActive(r)&&!verminBusy(r)?1:0;
 r.aim+=(focus-r.aim)*(1-Math.exp(-dt*12));
 if(brutalActive(r)||verminBusy(r)){r.rifleBurst=0;r.rifleBurstTimer=0;r.rifleCharge=0;r.rifleCharging=false;return;}
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
}

// Bare firearms use the secondary control to steady the aim. Their prototype
// secondary attacks are not player inputs; an attachment must author that mode
// before it can be connected here. Firing while aiming uses the primary shot.
export function fireWeaponInput(r,input={},predicted=false){
 if(input.attachment&&r.weapon===BREACH_LAUNCHER.weapon)return fireAttachment(r,predicted);
 if(r.weapon>=6)return input.fire||input.alt?shootMelee(r,!!input.alt,predicted):false;
 if(!input.fire)return false;
 if(predicted&&r.weapon>=4)return shootRifle(r,false,true);
 return predicted?false:shoot(r,false);
}

export function fireAttachment(r,predicted=false){
 if(r.weapon!==BREACH_LAUNCHER.weapon||r.mode!=='play'||r.health<=0||r.vehicle?.occupied||brutalActive(r)||verminBusy(r)||(r.attachmentCooldown||0)>0)return false;
 const world=r.world||r,cp=Math.cos(r.pitch),sp=Math.sin(r.pitch),ca=Math.cos(r.angle),sa=Math.sin(r.angle);
 const wall=castRay(r.course,r.x,r.y,r.angle,BREACH_LAUNCHER.forward,eye(r),Math.tan(r.pitch));
 const forward=Math.max(.005,Math.min(BREACH_LAUNCHER.forward,wall.dist-.025));
 const origin={x:r.x+ca*cp*forward,y:r.y+sa*cp*forward,z:eye(r)+sp*forward-BREACH_LAUNCHER.drop};
 r.attachmentCooldown=BREACH_LAUNCHER.cooldown;r.attachmentShot=1;r.attachmentSequence=(r.attachmentSequence||0)+1;
 if(!predicted)world.projectiles.push({id:world.nextId++,kind:'grenade',weapon:1,...origin,vx:ca*cp*BREACH_LAUNCHER.speed,vy:sa*cp*BREACH_LAUNCHER.speed,vz:sp*BREACH_LAUNCHER.speed+.35,life:BREACH_LAUNCHER.life,age:0,reflected:true,core:true,attachment:true,damageMultiplier:weaponDamageMultiplier(r,1),ownerId:playerId(r)});
 r.events.push({type:'shot',weapon:1,...origin,attachment:true,predicted});
 return true;
}

export function shoot(r,secondary=false){if(r.mode!=='play'||r.health<=0||r.vehicle?.occupied||brutalActive(r)||verminBusy(r))return false;const world=r.world||r;
 syncEnemyGrounds(r);
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
 if(r.weapon===3){const w=weapons[3],speed=7.2,dx=Math.cos(r.angle)*Math.cos(r.pitch),dy=Math.sin(r.angle)*Math.cos(r.pitch),dz=Math.sin(r.pitch);r.cooldowns[3]=w.interval;r.fireCooldown=w.interval;r.shot=1;r.lastWeapon=r.weapon;r.repeat=0;const rocket={id:world.nextId++,kind:'rocket',weapon:3,x:r.x,y:r.y,z:eye(r),vx:dx*speed,vy:dy*speed,vz:dz*speed,life:4,radius:w.radius,damage:w.damage*weaponDamageMultiplier(r,3),knockback:w.knockback,ownerId:playerId(r),selfBoost:true,reflected:false};world.projectiles.push(rocket);r.events.push({type:'rocket',weapon:3,x:rocket.x,y:rocket.y,z:rocket.z,projectileId:rocket.id});return true;}
 if(secondary&&r.weapon===1){r.cooldowns[1]=.95;r.shot=1;const core={id:world.nextId++,kind:'core',weapon:1,x:r.x,y:r.y,z:eye(r),vx:Math.cos(r.angle)*Math.cos(r.pitch)*2.8,vy:Math.sin(r.angle)*Math.cos(r.pitch)*2.8,vz:Math.sin(r.pitch)*2.8+.5,life:3,reflected:true,core:true,damageMultiplier:weaponDamageMultiplier(r,1),ownerId:playerId(r)};world.projectiles.push(core);r.events.push({type:'shot',weapon:1,x:core.x,y:core.y,z:core.z,projectileId:core.id});return true;}
const w=weapons[r.weapon];r.cooldowns[r.weapon]=w.interval*(secondary&&r.weapon===0?2:1);r.fireCooldown=r.cooldowns[r.weapon];r.shot=1;r.events.push({type:'shot',weapon:r.weapon,x:r.x,y:r.y,z:eye(r)});r.repeat=r.lastWeapon===r.weapon?r.repeat+1:0;r.lastWeapon=r.weapon;
 const pellets=r.weapon===1?9:1,pierce=r.weapon===2||(secondary&&r.weapon===0);let hits=0;
  for(let i=0;i<pellets;i++){const offset=pellets>1?(i-4)/4:0,a=r.angle+offset*w.cone,pitch=r.pitch+(pellets>1?Math.sin(i*2.4)*.075:0),oz=eye(r),slope=Math.tan(pitch),wallHit=castRay(r.course,r.x,r.y,a,w.range,oz,slope),wall=wallHit.dist,floor=castGroundRay(r.course,r.x,r.y,oz,a,slope,Math.min(w.range,wall)),max=Math.min(w.range,wall,floor);let end=max;
 const targets=r.course.enemies.filter(e=>!e.extracted&&(!e.dead||supportsAnatomy(e))).map(e=>enemyRayTarget(e,r,a,pitch,max)).filter(Boolean).sort((a,b)=>a.along-b.along);
 const coin=r.weapon===0?world.coins.find(c=>{const dx=c.x-r.x,dy=c.y-r.y,d=dx*Math.cos(a)+dy*Math.sin(a);return d>0&&d<max&&Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))<.085&&Math.abs(c.z-(oz+d*slope))<.085;}):null;
 if(coin){coin.life=0;const target=r.course.enemies.filter(e=>!e.dead&&castRay(r.course,coin.x,coin.y,Math.atan2(e.y-coin.y,e.x-coin.x)).dist>Math.hypot(e.x-coin.x,e.y-coin.y)-.1).sort((a,b)=>Math.hypot(a.x-coin.x,a.y-coin.y)-Math.hypot(b.x-coin.x,b.y-coin.y))[0];if(target){damageEnemy(r,target,9*weaponDamageMultiplier(r,0),'+ RICOCHET');award(r,180,'+ RICOCHET');world.tracers.push({id:world.nextId++,x:coin.x,y:coin.y,z:coin.z,tx:target.x,ty:target.y,tz:enemyBase(target)+.4,ownerId:playerId(r),life:.22,duration:.22,weapon:0,ricochet:true,rail:true});hits++;}continue;}
 const core=world.projectiles.find(p=>{if(!p.core||p.attachment||p.life<=0)return false;const dx=p.x-r.x,dy=p.y-r.y,d=dx*Math.cos(a)+dy*Math.sin(a);return d>0&&d<max&&Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))<.14&&Math.abs(p.z-(oz+d*slope))<.14;});if(core){core.life=0;core.nuke=r.weapon===2;if(core.nuke)core.damageMultiplier=weaponDamageMultiplier(r,2);explode(world,core);award(r,core.nuke?350:120,core.nuke?'+ CORE NUKE':'+ CORE SHOT');hits++;continue;}for(const t of targets.slice(0,pierce?100:1)){const head=t.bodyHit?t.bodyHit.part==='head':t.z-enemyBase(t.e)>.38,wasDead=t.e.dead;damageEnemy(r,t.e,w.damage*weaponDamageMultiplier(r,r.weapon)*(head?1.5:1)*(secondary&&r.weapon===0?2:1),head?'+ HEADSHOT':'+ ELIMINATED',{...(t.bodyHit||{x:r.x+Math.cos(a)*t.along,y:r.y+Math.sin(a)*t.along,z:t.z}),angle:a,pitch});if(!wasDead)hits++;if(!pierce)end=t.along;}
 if(pellets===1||i%2===0)(r.world||r).tracers.push({id:(r.world||r).nextId++,x:r.x,y:r.y,z:oz,tx:r.x+Math.cos(a)*end,ty:r.y+Math.sin(a)*end,tz:oz+slope*end,surface:(!pierce&&targets.length)?'flesh':wallHit.structureId?wallHit.surface:floor<=wall&&floor<=w.range?'floor':wall<w.range&&oz+slope*end<=groundAt(r.course,r.x+Math.cos(a)*end,r.y+Math.sin(a)*end)+1.45?'wall':'air',normal:wallHit.normal??(floor<=wall&&floor<=w.range?{x:0,y:0,z:1}:wallHit.side===0?{x:-Math.sign(Math.cos(a)),y:0,z:0}:{x:0,y:-Math.sign(Math.sin(a)),z:0}),ownerId:playerId(r),life:.18,duration:.18,weapon:r.weapon,hit:targets.length>0,rail:r.weapon===2});}
 if(hits)award(r,Math.max(8,55-r.repeat*9)*(r.weapon===1?1:1.3),r.repeat<1?'+ FRESH WEAPON':'+ HIT');return true;
}
export function tickPlayer(r,dt,input={}){r.journeyInteract=r.mode==='play'&&r.health>0&&!!input.interact;if(r.mode!=='play'||r.health<=0){r.aim=0;return;}dt=clamp(dt,0,.05);r.time+=dt;
 if(Number.isFinite(r._supportX)&&Math.hypot(r.x-r._supportX,r.y-r._supportY)>1){r.structureId=null;r.supportZ=undefined;r.supportId=null;}
 if(r.structureId||structureAt(r.course,r.x,r.y))resolveActorSupport(r.course,r);
 syncEnemyGrounds(r);
 if(r.lowTide&&tickLowTideInteraction(r,input))return;
 if(r.course.harbor&&tickHarborRoom(r,input,{canStand}))return;
 if(r.vehicle&&tickHarborVehicle(r,dt,input,{canStand,castRay})){cancelMelee(r);r.shot=0;r.aim=0;return;}
 const harvestHeld=!!input.harvest,verminConsumes=interceptVerminInput(r,input);
 if(verminConsumes)input={...input,harvest:false,fire:false,alt:false};
 if(!input.predictWeapons)r._biteInput={effort:Math.abs(input.forward||0)+Math.abs(input.strafe||0)>.1||!!input.jump||!!input.dash};
 const heldByBite=r.bite?.phase==='held';
 for(const key of ['shot','damage','heal','punch','hookTime','hookCooldown','parryTime','parryCooldown','dashTime','altCooldown'])r[key]=Math.max(0,r[key]-dt*(key==='shot'?7:1));for(let i=0;i<weapons.length;i++)r.cooldowns[i]=Math.max(0,r.cooldowns[i]-dt);r.fireCooldown=r.cooldowns[r.weapon];
 advanceRifles(r,dt,input);
 r.attachmentShot=Math.max(0,(r.attachmentShot||0)-dt*7);
 r.attachmentCooldown=Math.max(0,(r.attachmentCooldown||0)-dt);
 advanceMelee(r,dt,input);
 r.angle=angleDiff(r.angle+(input.turn||0)*dt*2,0);r.pitch=clamp(r.pitch+(input.lookY||0)*dt,-1.35,1.35);r.energy=clamp(r.energy+dt*22,0,100);if(r.coinCharges<4){r.coinRegen+=dt;if(r.coinRegen>=2){r.coinCharges++;r.coinRegen=0;}}
 const jump=input.jump&&!r.pressed.jump,dash=input.dash&&!r.pressed.dash,wasAir=r.z>.001,wasSliding=r.slide>.55;r.pressed={jump:!!input.jump,dash:!!input.dash};let f=input.forward||0,s=input.strafe||0;if(r.autoRun&&f===0&&!harvestHeld)f=1;const length=Math.max(1,Math.hypot(f,s));f/=length;s/=length;const dx=Math.cos(r.angle)*f-Math.sin(r.angle)*s,dy=Math.sin(r.angle)*f+Math.cos(r.angle)*s;
 if(jump&&!heldByBite){if(r.z<=.001){r.vz=2.05;r.events.push({type:'jump',x:r.x,y:r.y,z:r.z});}else if(r.wallJumps<3&&!canStand(r.course,r.x,r.y,.2)){r.vz=1.8;r.wallJumps++;r.vx=-Math.cos(r.angle)*1.4;r.vy=-Math.sin(r.angle)*1.4;award(r,20,'+ WALL JUMP');}}
 if(dash&&!heldByBite&&r.energy>=33){r.energy-=33;r.dashTime=.18;const len=Math.hypot(dx,dy);r.vx=(len?dx:Math.cos(r.angle))*6;r.vy=(len?dy:Math.sin(r.angle))*6;r.vz=Math.max(0,r.vz);r.events.push({type:'dash',x:r.x,y:r.y,z:r.z});}
 if(input.slide&&r.z>.12){r.slam=true;r.vz=-5;}
 r.slide+=(Number(!!input.slide&&r.z<.05)-r.slide)*(1-Math.exp(-dt*20));if(r.slide>.55&&!wasSliding)r.events.push({type:'slide',x:r.x,y:r.y,z:r.z});
 if(r.dashTime<=0){const legPenalty=Math.min(.3,['leftLeg','rightLeg'].reduce((sum,limb)=>sum+(r.playerWounds?.[limb]==='severed'?.18:r.playerWounds?.[limb]==='injured'?.12:0),0));const speed=(r.slide>.5?3.25:2.05)*(heldByBite?.2:1-legPenalty),acc=r.z>.05?5:18;if(r.slide>.5){const heading=Math.hypot(r.vx,r.vy)>.1?Math.atan2(r.vy,r.vx):r.angle;r.vx+=(Math.cos(heading)*speed-r.vx)*dt*4;r.vy+=(Math.sin(heading)*speed-r.vy)*dt*4;}else{r.vx+=(dx*speed-r.vx)*(1-Math.exp(-dt*acc));r.vy+=(dy*speed-r.vy)*(1-Math.exp(-dt*acc));}}
 if(r.hookTime>0){const target=r.course.enemies.find(e=>e.id===r.hookTarget&&!e.dead);if(target){const dx=target.x-r.x,dy=target.y-r.y,d=Math.hypot(dx,dy);if(d>.5){if(target.kind===2){r.vx=dx/d*4.2;r.vy=dy/d*4.2;r.vz=Math.max(r.vz,.35);}else{const ex=target.x-dx/d*dt*5,ey=target.y-dy/d*dt*5;if(canStand(r.course,ex,ey,.16)){target.x=ex;target.y=ey;}}}else r.hookTime=0;}else r.hookTime=0;}
 const ox=r.x,oy=r.y,groundBefore=groundAt(r.course,ox,oy),airborne=wasAir||r.vz>0,structureBefore=!!(r.structureId||structureAt(r.course,ox,oy));move(r,r.vx*dt,r.vy*dt);r.speed=Math.hypot(r.x-ox,r.y-oy)/Math.max(dt,.0001);r.distance+=r.speed*dt;
 const scoped=structureBefore||!!r.structureId,groundAfter=scoped?actorGroundAt(r.course,r):groundAt(r.course,r.x,r.y);
 if(r.dashTime<=0)r.vz-=5.5*dt;
 const previousFeet=groundAfter+r.z,nextFeet=previousFeet+r.vz*dt;
 const capped=scoped?clipStructureRise(r.course,r.x,r.y,previousFeet,nextFeet,STRUCTURE_BODY_HEIGHT-r.slide*.18,.1):nextFeet;
 if(capped<nextFeet-1e-7)r.vz=Math.min(0,r.vz);
 r.z=Math.max(0,capped-groundAfter+(!scoped&&airborne?groundBefore-groundAfter:0));if(r.z===0){r.vz=0;r.wallJumps=0;if(r.slam){r.slam=false;for(const e of r.course.enemies)if(!e.dead&&Math.hypot(e.x-r.x,e.y-r.y,enemyBase(e)-groundAfter)<1.15&&castRay(r.course,r.x,r.y,Math.atan2(e.y-r.y,e.x-r.x)).dist>Math.hypot(e.x-r.x,e.y-r.y)-.1)damageEnemy(r,e,5,'+ GROUND SLAM');r.events.push({type:'slam',x:r.x,y:r.y,z:groundAfter});}else if(wasAir)r.events.push({type:'land',x:r.x,y:r.y,z:groundAfter});}
 // Keep extraction after movement so any actual displacement in this tick
 // cancels the committed action before it can advance or award.
 if(r.course.activeInterior&&r.z>.35){r.z=.35;r.vz=Math.min(0,r.vz);}
 if(!heldByBite)advanceExtraction(r,dt,input);
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
  r.tracers.push({id:r.nextId++,x:e.x+Math.cos(a0)*reach,y:e.y+Math.sin(a0)*reach,z:enemyBase(e)+.34,tx:e.x+Math.cos(a1)*reach,ty:e.y+Math.sin(a1)*reach,tz:enemyBase(e)+.32,ownerId:'enemy',life:.16,duration:.16,weapon:-1,hit:false,slash:true,enemyId:e.id});
 }
 if(r.tracers.length>180)r.tracers=r.tracers.slice(-180);
}
// Lobbed glob: slow horizontal speed, real gravity arc, deterministic wobble
// and drip seeds. vz stays under the arena ceiling; the flight time is then
// solved exactly so the glob still lands on the target it was thrown at.
function throwGlob(r,e,target,a,d){
 const fromZ=enemyBase(e)+.32,toZ=Math.max(groundAt(r.course,target.x,target.y)+.05,eye(target)-.12),t=clamp(d/(1.7*((e.projectileSpeed??enemyProfile(e).projectileSpeed??1.05)/1.05)),.45,2.2);
 let vz=(toZ-fromZ+.5*GLOB_GRAVITY*t*t)/t;
 vz=clamp(vz,-1.1,2.35);
 const fall=Math.max(.25,(vz+Math.sqrt(Math.max(0,vz*vz+2*GLOB_GRAVITY*(fromZ-toZ))))/GLOB_GRAVITY);
 const lx=target.x+(target.vx||0)*fall*.5,ly=target.y+(target.vy||0)*fall*.5;
 const dir=Math.atan2(ly-e.y,lx-e.x),speed=clamp(Math.hypot(lx-e.x,ly-e.y)/Math.max(.3,fall),.45,2.6);
 const glob={id:r.nextId++,kind:'enemy',glob:true,x:e.x+Math.cos(a)*.24,y:e.y+Math.sin(a)*.24,z:fromZ,vx:Math.cos(dir)*speed,vy:Math.sin(dir)*speed,vz,life:GLOB_LIFE,age:0,reflected:false,enemyId:e.id,enemyKind:e.kind,variant:e.variant||'stalker',damage:clamp(Math.round((e.contactDamage??enemyProfile(e).contactDamage??12)*.7),7,15),splash:3,splashRadius:.85,wob:limbRoll(e.id,3)*6.283,wobAmp:.45+limbRoll(e.id,5)*.3,drip:0};
 r.projectiles.push(glob);
 return glob.id;
}
function splatGlob(r,p,z){
 const gx=p.x,gy=p.y,ground=settledFloor(r.course,gx,gy,z??p.z),gz=clamp(z??ground,ground,ground+.9);
 burst(r,{id:p.id,x:gx,y:gy},8,{x:gx,y:gy,z:gz});
 r.blood.push({id:r.nextId++,x:gx,y:gy,z:ground,size:.3,angle:limbRoll(p.id,9)*6.283});r.blood=r.blood.slice(-100);
 if(!Array.isArray(r.pools))r.pools=[];
 r.pools.push({id:p.id,x:gx,y:gy,z:ground,life:POOL_LIFE,radius:.62,damage:POOL_DAMAGE,pulse:limbRoll(p.id,11)*.4,seed:p.id});
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
export function tick(r,dt,input={}){if(r.mode!=='play'){cancelBrutal(r,'inactive');if(r.peer)cancelBrutal(r.peer,'inactive');return;}dt=clamp(dt,0,.05);syncEnemyGrounds(r);tickPlayer(r,dt,input);updateLowTide(r,dt);
 for(const defender of [r,...(r.peer?[r.peer]:[])])advanceBrutal(r,defender,dt);
 for(const defender of [r,...(r.peer?[r.peer]:[])])advancePlayerBite(r,defender,dt);
 tickVermin(r,dt);
 // Hoarding packs: members share a hunt target, clump toward the pack centroid
 // and take separate slots around the player so a wave arrives as a surround
 // instead of a conga line.
 for(const e of r.course.enemies){if(advanceReanimation(e,r.time))r.events.push({type:'enemy-rise',enemyId:e.id,x:e.x,y:e.y,z:enemyBase(e)+.15});if(e.reanimate?.phase==='rise'&&r.time>=e.reanimate.until)e.reanimate.phase='hunting';}
 const packs=new Map();
 for(const e of r.course.enemies){
  if(e.dead)continue;
  const key=e.pack??0;let pack=packs.get(key);
  if(!pack){pack={key,members:[],x:0,y:0,alert:0,lastX:0,lastY:0,leader:null,leaderD:Infinity};packs.set(key,pack);}
  pack.members.push(e);pack.x+=e.x;pack.y+=e.y;
 }
 const aiTargets=new Map();
 for(const pack of packs.values()){
  pack.x/=pack.members.length;pack.y/=pack.members.length;
  pack.alert=Math.max(0,pack.alert-dt);
  for(const e of pack.members){
   let t=r.peer&&r.peer.health>0&&(r.health<=0||Math.hypot(r.peer.x-e.x,r.peer.y-e.y)<Math.hypot(r.x-e.x,r.y-e.y))?r.peer:r;
   const profile=enemyProfile(e);
   const canSee=player=>player&&player.health>0&&!r.course.activeInterior&&(!e.mind||visionAllows(e,player,profile))&&actorLine(r.course,e,player);
   let seen=!!canSee(t);
   const other=t===r?r.peer:r;
   // An invisible nearer co-op player cannot hide a visible farther one.
   if(e.mind&&!seen&&canSee(other)){t=other;seen=true;}
   aiTargets.set(e.id,t);
   const d=Math.hypot(t.x-e.x,t.y-e.y);
   // Sight lines are cast once per enemy per tick and shared with the movement
   // pass below, so the pack memory costs no extra raycasts.
   e.seesTarget=seen;
   if(seen){pack.alert=2.6;pack.lastX=t.x;pack.lastY=t.y;}
   if(d<pack.leaderD){pack.leaderD=d;pack.leader=e;}
  }
 }
 const aiAlive=r.course.enemies.filter(en=>!en.dead);
 const aiCtx={env:AI_ENV,course:r.course,dt,time:r.time,noises:aiAlive.some(en=>en.mind)?collectNoises(r):[],packs,alive:aiAlive,navBudget:4,profile:null,reach:0,tokens:{melee:0,ranged:0,maxMelee:aiAlive.length>=5?3:2,maxRanged:2}};
 for(const en of aiAlive)if(en.mind?.token){if(isMeleeRole(enemyProfile(en).role))aiCtx.tokens.melee++;else aiCtx.tokens.ranged++;}
 for(const e of r.course.enemies){
 if(r.lowTide&&r.course.activeInterior){e.attacking=false;e.windup=0;continue;}
 advanceMeleeImpulse(r,e,dt);
 e.flash=Math.max(0,e.flash-dt);e.strike=Math.max(0,(e.strike||0)-dt);e.stagger=Math.max(0,(e.stagger||0)-dt);e.biteCooldown=Math.max(0,(e.biteCooldown||0)-dt);if(e.dead)continue;const profile=enemyProfile(e);
 if([r,r.peer].some(player=>player&&biteActive(player)&&player.bite.enemyId===e.id))continue;
 const target=aiTargets.get(e.id)||r;
 const dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx),visible=e.seesTarget===true;
 if(biteActive(target)&&target.bite.enemyId!==e.id&&isMeleeRole(profile.role)){e.attacking=false;e.windup=0;e.strike=0;e.slashHit=true;}
 e.attack=Math.max(0,e.attack-dt);e.phase+=dt;
 if(e.stagger>0){e.attacking=false;e.windup=0;e.slashHit=true;e.strike=0;if(e.mind){e.state='stagger';e.mind.token=false;if(e.hitDir!==undefined)e.facing=e.facing+angleDiff(e.hitDir+Math.PI,e.facing)*Math.min(1,dt*3);}continue;}
 if(e.mind&&e.state==='stagger'){e.state=e.mind.state;e.mind.t=0;}
 const pack=packs.get(e.pack??0),melee=isMeleeRole(profile.role),reach=isLowZombie(e)?.40:melee?meleeReach(profile.role):13,half=meleeArc(profile.role);
  const stairGoal=!e.mind?stairWaypoint(r.course,e,target):null;
  if(stairGoal){
   const heading=Math.atan2(stairGoal.y-e.y,stairGoal.x-e.x),step=Math.min((e.moveSpeed||profile.speed||.30)*dt,Math.hypot(stairGoal.x-e.x,stairGoal.y-e.y));
   const mx=Math.cos(heading)*step,my=Math.sin(heading)*step;
   if(canStand(r.course,e.x+mx,e.y,.16,enemyBase(e)))e.x+=mx;
   if(canStand(r.course,e.x,e.y+my,.16,enemyBase(e)))e.y+=my;
   syncEnemyGround(r,e,dt);e.attacking=false;e.windup=0;e.facing=heading;e.state='hunt';if(e.mind)e.mind.token=false;continue;
  }
 let mindRes=null;
 if(e.mind){
  aiCtx.profile=profile;aiCtx.reach=reach;aiCtx.env=e.structureId?{...AI_ENV,canStand:(m,x,y,radius)=>canStand(m,x,y,radius,enemyBase(e)),castRay:(m,x,y,a,max)=>castRay(m,x,y,a,max,enemyBase(e)+.32)}:AI_ENV;mindRes=stepMind(aiCtx,e,target);
  if(e.wounded&&(e.drip=(e.drip||0)-dt)<=0){e.drip=.55;r.blood.push({id:r.nextId++,x:e.x,y:e.y,z:enemyBase(e),size:.1,angle:e.id*.7});r.blood=r.blood.slice(-100);}
 }
 if(!e.mind&&!e.attacking&&(!visible||d>meleeStandoff(profile.role))){
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
  if(canStand(r.course,e.x+mx,e.y,.16,enemyBase(e)))e.x+=mx;if(canStand(r.course,e.x,e.y+my,.16,enemyBase(e)))e.y+=my;
  if(e.wounded&&(e.drip=(e.drip||0)-dt)<=0){e.drip=.55;r.blood.push({id:r.nextId++,x:e.x,y:e.y,z:enemyBase(e),size:.1,angle:e.id*.7});r.blood=r.blood.slice(-100);}
 }
 syncEnemyGround(r,e,dt);
 const verticalReach=profile.role==='anchor'?.55:.3,levelContact=Math.abs(playerFoot(target)-enemyBase(e))<verticalReach;
 const eligible=visible&&(melee?d<reach&&levelContact:d<13)&&(!e.mind||e.attacking||e.attack>0||mindRes.attackOK);
 if(!eligible){e.attacking=false;e.windup=0;}
 else if(e.attack<=0){
  if(!e.attacking){
   if(melee){e.biteAttackCount=(e.biteAttackCount||0)+1;if(biteEligible(target,e,profile,d)&&(e.id+e.biteAttackCount)%3===0){beginBite(target,e);continue;}}
   e.attacking=true;e.windup=e.windupTime??profile.windup??(melee?.28:.48);e.eventsSeen=0;e.aimAngle=a;}
  e.windup=Math.max(0,e.windup-dt);
  // Fair telegraph: the swing tracks the player early in the windup, then locks.
  if(e.windup>(e.windupTime??profile.windup??.4)*.35)e.aimAngle=a;
  if(e.mind)turnFacing(e,e.aimAngle??a,(e.aiTune?.turn||6)*1.6,dt);
  if(e.windup<=0){
   if(e.mind){e.mind.justAttacked=true;e.facing=e.aimAngle??a;}
   e.attacking=false;e.strike=melee?SLASH_SWING:.22;e.attack=e.attackCooldown??profile.attack??(melee?.8:1.9);
   const event={type:'enemy-attack',x:e.x,y:e.y,z:enemyBase(e)+.32,enemyId:e.id,enemyKind:e.kind,variant:e.variant||'stalker'};
   if(melee){e.slashDir=e.mind?(e.aimAngle??a):a;e.slashReach=reach;e.slashHalf=half;e.slashHit=false;event.slash=true;event.reach=reach;event.arc=half;slashArc(r,e);}
   else{event.glob=true;event.projectileId=throwGlob(r,e,target,a,d);}
   r.events.push(event);
  }
 }
 // The swing: one arc hit-test per swing directly in front of the enemy,
 // blocked by walls and cancelled the moment the enemy staggers or is parried.
 if(e.strike>0&&!e.slashHit&&e.slashDir!==undefined&&e.slashReach>0){
  const hd=Math.hypot(target.x-e.x,target.y-e.y),ha=Math.atan2(target.y-e.y,target.x-e.x);
  if(levelContact&&hd<=e.slashReach&&Math.abs(angleDiff(ha,e.slashDir))<=e.slashHalf&&actorLine(r.course,e,target)){e.slashHit=true;hurt(target,(e.contactDamage??profile.contactDamage??12)*anatomyMotion(e).damage);}
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
    p.vx=Math.cos(pa)*(p.kind==='rocket'?5.4:4);p.vy=Math.sin(pa)*(p.kind==='rocket'?5.4:4);p.vz=target?(enemyBase(target)+.28-p.z)/(Math.max(.1,pd2))*(p.kind==='rocket'?5.4:4):Math.sin(defender.pitch)*(p.kind==='rocket'?5.4:4);
    defender.health=Math.min(100,defender.health+15);award(defender,200,'+ PARRY');r.events.push({type:'parry',x:defender.x,y:defender.y,z:eye(defender),weapon:defender.weapon});
   }
  }
  if(p.life<=0){if(p.attachment)explode(r,p);continue;}
  const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy,p.vz)*dt/(r.course?.coastal?.terrain?.0625:.12)));
  let detonated=false;
  for(let stepIndex=0;stepIndex<steps;stepIndex++){
   if(p.life<=0)break;
    const stepDt=dt/steps,travel=Math.hypot(p.vx,p.vy)*stepDt;
    const contact=traceStructureSegment(r.course,p,{x:p.x+p.vx*stepDt,y:p.y+p.vy*stepDt,z:p.z+p.vz*stepDt});
    if(contact){p.x=contact.x;p.y=contact.y;p.z=contact.z;if(p.core||p.kind==='rocket')explode(r,p);else if(p.glob)splatGlob(r,p,p.z);p.life=0;detonated=true;break;}
    const blocked=castRay(r.course,p.x,p.y,Math.atan2(p.vy,p.vx),travel+.01,p.z,travel>1e-9?p.vz*stepDt/travel:0).dist<=travel;
   if(blocked){if(p.core||p.kind==='rocket')explode(r,p);else if(p.glob)splatGlob(r,p,Math.min(p.z,groundAt(r.course,p.x,p.y)+.5));p.life=0;detonated=true;break;}
   const oldX=p.x,oldY=p.y,oldZ=p.z;
   p.x+=p.vx*stepDt;p.y+=p.vy*stepDt;p.z+=p.vz*stepDt;
   const ground=groundAt(r.course,p.x,p.y),ceiling=r.course?.coastal?.terrain&&!r.course.activeInterior?Infinity:ground+1.5;
   if(p.z<ground||p.z>ceiling){
    if(p.z<ground){
     if(r.course?.coastal?.terrain&&oldZ>=groundAt(r.course,oldX,oldY)){
      let a=0,b=1;for(let n=0;n<14;n++){const t=(a+b)/2,x=oldX+p.vx*stepDt*t,y=oldY+p.vy*stepDt*t;if(oldZ+p.vz*stepDt*t>groundAt(r.course,x,y))a=t;else b=t;}
      p.x=oldX+p.vx*stepDt*b;p.y=oldY+p.vy*stepDt*b;
     }
     p.z=groundAt(r.course,p.x,p.y);
    }
    if(p.core||p.kind==='rocket')explode(r,p);else if(p.glob)splatGlob(r,p,p.z);p.life=0;detonated=true;break;
   }
   if(p.kind==='rocket'){
    const enemy=r.course.enemies.find(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<enemyHitRadius(e,.2)&&p.z>=enemyBase(e)&&p.z<enemyBase(e)+enemyHitHeight(e,.65));
    if(enemy){explode(r,p);p.life=0;detonated=true;break;}
   }else if(p.reflected){
    const enemy=r.course.enemies.find(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<enemyHitRadius(e,.22)&&p.z>=enemyBase(e)&&p.z<enemyBase(e)+enemyHitHeight(e,.6));
    if(enemy){if(p.core)explode(r,p);else{if(p.glob)splatGlob(r,p,p.z);damageEnemy(r,enemy,14,'+ RETURN TO SENDER',{x:p.x,y:p.y,z:p.z});}p.life=0;break;}
   }else{
    // A glob is a fat body, not a pinprick: slightly more forgiving to connect
    // than a bolt, but slower, telegraphed and dodgeable in flight.
    const defender=[r,...(r.peer?[r.peer]:[])].find(player=>player.health>0&&Math.hypot(p.x-player.x,p.y-player.y)<(p.glob?.34:.15)&&Math.abs(p.z-(eye(player)-.1))<(p.glob?.5:.22));
    if(defender){if(p.glob){p.hitPlayer=defender;splatGlob(r,p,p.z);hurt(defender,p.damage??15);}else hurt(defender,15);p.life=0;break;}
   }
  }
  if(detonated)continue;
 } for(const c of r.coins){c.life-=dt;c.vz-=1.4*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.z+=c.vz*dt;if(c.z<groundAt(r.course,c.x,c.y))c.life=0;}r.coins=r.coins.filter(c=>c.life>0);
  r.projectiles=r.projectiles.filter(p=>p.life>0);for(const x of (r.explosions||[]))x.life-=dt;r.explosions=(r.explosions||[]).filter(x=>x.life>0);for(const p of r.gore){p.life-=dt;const ground=settledFloor(r.course,p.x,p.y,p.z);if(p.z>ground+1e-7)moveLooseParticle(r.course,p,dt,3);else p.z=ground;}r.gore=r.gore.filter(p=>p.life>0);for(const t of r.tracers)t.life-=dt;r.tracers=r.tracers.filter(t=>t.life>0);
 // Detached limbs keep tumbling, land, and then stay where they fell: the arena
 // accumulates evidence of the fight instead of cleaning itself up.
 for(const l of r.limbs){
  l.spin+=(l.rest?.2:2.4)*dt;l.angle=l.spin;
  if(l.rest){l.z=settledFloor(r.course,l.x,l.y,l.z);l.settle=Math.min(1,(l.settle||0)+dt*2.2);continue;}
  l.life-=dt;const landed=moveLooseParticle(r.course,l,dt,7.5);
  const ground=settledFloor(r.course,l.x,l.y,l.z);if(landed||l.z<=ground){l.z=ground;l.rest=true;l.vz=0;l.vx*=.2;l.vy*=.2;
   if(l.kind==='head'||l.kind==='eye')r.blood.push({id:r.nextId++,x:l.x,y:l.y,size:l.kind==='head'?.2:.14,angle:l.spin});
   else r.blood.push({id:r.nextId++,x:l.x,y:l.y,size:.13,angle:l.spin});}
  if(l.life<=0){l.rest=true;l.z=ground;l.vz=0;}
 }
 r.limbs=r.limbs.slice(-64);
 // Glob pools: short-lived blood slicks that keep punishing a held position.
 // Pulses are on a fixed cadence so co-op runs stay deterministic, and each
 // pulse re-checks the wall between pool and player.
 if(Array.isArray(r.pools)&&r.pools.length){
  for(const pool of r.pools){
   pool.z=settledFloor(r.course,pool.x,pool.y,pool.z);pool.life-=dt;pool.pulse=(pool.pulse||0)+dt;
   if(pool.pulse<POOL_INTERVAL)continue;
   pool.pulse-=POOL_INTERVAL;
   for(const defender of [r,...(r.peer?[r.peer]:[])]){
    if(!defender||defender.health<=0||Math.abs(playerFoot(defender)-pool.z)>.34)continue;
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
  b.z=settledFloor(r.course,b.x,b.y,b.z);b.baseSize??=b.size||.12;b.age=(b.age||0)+dt;
  b.size=b.baseSize*(1+.16*(1-Math.exp(-b.age*1.3)));
 }
 r.style=Math.max(0,r.style-dt*35);r.rank=r.style>1400?'SSS':r.style>1100?'SS':r.style>800?'S':r.style>550?'A':r.style>300?'B':r.style>120?'C':'D';
 if(r.course.harbor){
  const progress=r.harborProgress;
  if(!progress.initialized){
   progress.initialized=true;
   const harborVariants=['stalker','bloodhound','stalker','skitter'];
   for(const [order,point] of (r.course.harborSpawns||[]).entries())spawnEnemy(r,{variant:point.variant||harborVariants[order%harborVariants.length],appearance:point.appearance,resident:true,mindState:'wander',order,spawnAnim:'none'},point);
  }
  const lootInteract=!!input.interact&&!r.scavengerInteractHeld,peerLootInteract=!!r.peer?.journeyInteract&&!r.peer?.scavengerInteractHeld;
  r.scavengerInteractHeld=!!input.interact;if(r.peer)r.peer.scavengerInteractHeld=!!r.peer.journeyInteract;
  if(!r.vehicle?.occupied&&!r.course.activeInterior){
   const consumed=tickWeaponInventory(r,{castRay,interact:lootInteract,peerInteract:peerLootInteract});
   tickScavengerPack(r,{interact:lootInteract&&!consumed.has(r),peerInteract:peerLootInteract&&!consumed.has(r.peer)});
  }
  progress.ready=(r.backpack.weaponPickups?.length||0)>=3&&(r.vehicle?.distance||0)>=8;
  if(!r.lowTide&&progress.ready&&!r.vehicle?.occupied&&Math.hypot(r.x-r.course.exit.x,r.y-r.course.exit.y)<.65){r.mode='win';r.events.push({type:'win',x:r.x,y:r.y,z:eye(r)});}
 }else if(r.campaign){
  updateCampaignDirector(r,dt);
  updateRoomProgression(r,dt);
  checkCampaignExit(r);
  }else if(r.course?.dungeon){
   if(r.course.extended)tickScavengerPack(r,{interact:!!input.interact,peerInteract:!!r.peer?.journeyInteract});
   updateDungeonProgression(r);
   updateDungeonEncounter(r,dt);
   const journeySequence=r.journey?.eventSeq;
   updateJourney(r,dt,{castRay});
   r.dungeonProgression.exitReady=r.dungeonProgression.combatReady&&journeyComplete(r);
   if(r.journey?.eventSeq!==journeySequence)dungeonNavigation(r,true);
   if(r.dungeonProgression.exitReady&&(Math.hypot(r.x-r.course.exit.x,r.y-r.course.exit.y)<.6||(r.peer&&Math.hypot(r.peer.x-r.course.exit.x,r.peer.y-r.course.exit.y)<.6))){
    if(r.course.dungeonIndex+1<r.course.dungeonCount)advanceDungeonFloor(r);
    else{r.mode='win';r.campaignComplete=true;r.dungeonProgression.floorsCleared=r.course.dungeonCount-r.dungeonProgression.startIndex;r.events.push({type:'win',floorIndex:r.course.dungeonIndex,floorCount:r.course.dungeonCount,x:r.x,y:r.y,z:eye(r)});}
   }
  }else if(!r.course.enemies.some(isThreat)){
  if(r.wave<r.waveCount){r.waveDelay-=dt;if(r.waveDelay<=0){spawnWave(r);r.waveDelay=2;}}
  else if(Math.hypot(r.x-r.course.exit.x,r.y-r.course.exit.y)<.6||(r.peer&&Math.hypot(r.peer.x-r.course.exit.x,r.peer.y-r.course.exit.y)<.6)){r.mode='win';r.events.push({type:'win',x:r.x,y:r.y,z:eye(r)});}
 } if(r.peer){r.peer.style=Math.max(0,r.peer.style-dt*35);r.peer.rank=styleRank(r.peer.style);if(r.health<=0&&r.peer.health>0){r.respawnTime=(r.respawnTime||0)+dt;if(r.respawnTime>3)revivePlayer(r,r.peer);}if(r.peer.health<=0&&r.health>0){r.peer.respawnTime=(r.peer.respawnTime||0)+dt;if(r.peer.respawnTime>3)revivePlayer(r.peer,r);}}if(r.health<=0&&(!r.peer||r.peer.health<=0)){r.mode='dead';r.events.push({type:'dead'});}
}

export const styleRank=v=>v>1400?"SSS":v>1100?"SS":v>800?"S":v>550?"A":v>300?"B":v>120?"C":"D";
export function addPeer(r){const p=newRun(r.course,{requireEntry:r.roomProgression?.requireEntry===true});p.x=(r.course.playerSpawn?.x??6)+.5;p.y=r.course.playerSpawn?.y??10.5;if(!canStand(r.course,p.x,p.y,.1)){p.x=r.x;p.y=r.y;}p.mode='play';p.playerId='peer';p.world=r;p.vermin=r.vermin;p.roomProgression=r.roomProgression||p.roomProgression;if(r.course.dungeon){p.dungeonProgression=r.dungeonProgression;p.journey=r.journey;p.ownedWeapons=[...r.ownedWeapons];p.storyRecords=r.storyRecords;}if(p.roomProgression)syncRoomGateCells(r.course,p.roomProgression);r.peer=p;return p;}

function explode(r,p){
 if(p.exploded)return;
 p.exploded=true;
 const rocket=p.kind==='rocket',radius=rocket?(p.radius||1.65):(p.nuke?2.3:1.1),baseDamage=rocket?(p.damage||24):(p.nuke?22:9)*(p.damageMultiplier||1);
 const owner=p.ownerId==='peer'?r.peer:p.ownerId==='host'?r:null;
 const attacker=owner||r;
 for(const e of r.course.enemies){
  syncEnemyGround(r,e);
  const horizontal=Math.hypot(e.x-p.x,e.y-p.y),d=r.course?.coastal?.terrain?Math.hypot(horizontal,enemyBase(e)+.28-p.z):horizontal;
   if(isThreat(e)&&d<radius&&pointLine(r.course,p,{x:e.x,y:e.y,z:enemyBase(e)+.28})){
   const falloff=Math.max(.12,1-d/radius);
   damageEnemy(attacker,e,Math.max(2,baseDamage*falloff),rocket?'+ RIFT BLAST':p.attachment?'+ GRENADE BLAST':p.nuke?'+ CORE NUKE':'+ CORE BLAST',{x:p.x,y:p.y,z:p.z});
   const dx=e.x-p.x,dy=e.y-p.y,len=Math.max(.1,horizontal);
   e.x+=dx/len*(rocket?falloff*.22:0);e.y+=dy/len*(rocket?falloff*.22:0);
   syncEnemyGround(r,e);
  }
 }
 if(rocket&&p.selfBoost&&owner&&owner.health>0){
  const dx=owner.x-p.x,dy=owner.y-p.y,horizontal=Math.hypot(dx,dy),d=r.course?.coastal?.terrain?Math.hypot(horizontal,playerFoot(owner)-p.z):horizontal;
   if(d<radius&&pointLine(r.course,p,{x:owner.x,y:owner.y,z:playerFoot(owner)+.12})){
   const len=Math.max(.1,horizontal),boost=Math.max(.35,1-d/radius);
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
export function grapple(r){if(r.mode!=='play'||r.health<=0||r.vehicle?.occupied||r.hookCooldown>0)return false;const target=r.course.enemies.filter(e=>!e.dead).map(e=>({e,d:Math.hypot(e.x-r.x,e.y-r.y),a:Math.atan2(e.y-r.y,e.x-r.x)})).filter(t=>t.d<7&&Math.abs(angleDiff(t.a,r.angle))<.3&&castRay(r.course,r.x,r.y,t.a).dist>t.d-.1).sort((a,b)=>a.d-b.d)[0];if(!target)return false;r.hookTarget=target.e.id;r.hookTime=.65;r.hookCooldown=1;award(r,35,'+ TETHER');r.events.push({type:'hook'});return true;}
