import {validatePack} from './backpack.js';
import {locomotion,findVault,advanceVault} from './traversal.js';
import {PLACES} from './places.js';
import {interiorPlan} from './interior-plan.js';
import {cityForecourtPlan} from './city-forecourts.js';
import {settlementSupport} from './settlement-plan.js';
import {recoverCivicSave,civicCraftPlan} from './civic-craft.js';
import {domesticExteriorPlan} from './domestic-exteriors.js';
import {SPAWN,LANDMARKS,terrainHeight,groundHeight,clamp,SAVE_KEY,KEEPER_FUSE,HOSPITAL_GENERATOR,stationPosition,entranceHeight} from './data.js';
import {ensureArmory,storeAmmo,weaponProfile} from './armory-state.js';
export const relayIds=LANDMARKS.filter(p=>p.type==='relay').map(p=>p.id);
export function freshState(){return ensureArmory({version:1,armoryRevision:2,discovered:[],records:[],contactStage:-1,fuse:false,generatorReady:false,x:SPAWN.x,z:SPAWN.z,y:groundHeight(SPAWN.x,SPAWN.z),yaw:SPAWN.yaw,pitch:0,vy:0,health:100,stamina:100,ammo:8,reserve:48,medkits:2,backpack:validatePack(),relays:[],collected:[],kills:[],vehicles:[],activeVehicle:null,checkpoint:'arrival',time:0,won:false});}
export function readSave(storage){try{const s=JSON.parse(storage.getItem(SAVE_KEY));if(!s||s.version!==1)return null;const out=freshState();for(const k of ['x','z','y','yaw','pitch','health','ammo','reserve','medkits','time']){if(!Number.isFinite(s[k]))return null;out[k]=s[k];}if(Math.abs(out.x)>1400||Math.abs(out.z)>900||out.health<=0)return null;out.health=clamp(out.health,1,100);out.ammo=clamp(Math.floor(out.ammo),0,8);out.reserve=clamp(Math.floor(out.reserve),0,999);out.medkits=clamp(Math.floor(out.medkits),0,20);out.pitch=clamp(out.pitch,-1.35,1.35);out.relays=Array.isArray(s.relays)?[...new Set(s.relays.filter(v=>relayIds.includes(v)))]:[];out.collected=Array.isArray(s.collected)?s.collected.filter(v=>typeof v==='string').slice(0,2000):[];out.kills=Array.isArray(s.kills)?s.kills.filter(v=>typeof v==='string').slice(0,200):[];out.checkpoint=LANDMARKS.some(p=>p.id===s.checkpoint&&p.type==='camp')?s.checkpoint:'arrival';out.vehicles=Array.isArray(s.vehicles)?s.vehicles.slice(0,2).map(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.angle)&&Math.abs(v.x)<1400&&Math.abs(v.z)<900&&groundHeight(v.x,v.z)>1?{x:v.x,z:v.z,angle:v.angle}:null):[];out.activeVehicle=Number.isInteger(s.activeVehicle)&&s.activeVehicle>=0&&s.activeVehicle<2&&out.vehicles[s.activeVehicle]?s.activeVehicle:null;out.discovered=Array.isArray(s.discovered)?[...new Set(s.discovered.filter(id=>PLACES.some(p=>p.id===id)))]:[];out.records=Array.isArray(s.records)?[...new Set(s.records.filter(id=>PLACES.some(p=>p.id===id)))]:[];out.contactStage=Number.isInteger(s.contactStage)?clamp(s.contactStage,-1,3):-1;out.fuse=s.fuse===true;out.generatorReady=s.generatorReady===true;out.won=!!s.won;out.backpack=validatePack(s.backpack);out.weapon=s.weapon;ensureArmory(out,s.armory);out.ammo=clamp(Math.floor(s.ammo),0,weaponProfile(out).capacity);out.reserve=clamp(Math.floor(s.reserve)+(out.weapon==='breach'&&s.armoryRevision!==2?clamp(s.ammo-2,0,3):0),0,999);storeAmmo(out);return recoverCivicSave(out);}catch{return null;}}
export function writeSave(storage,state){try{storeAmmo(state);storage.setItem(SAVE_KEY,JSON.stringify({...state,vy:0}));return true;}catch{return false;}}
const supportPlans=new WeakMap(),furnitureSupports=new WeakMap(),forecourtSupports=new WeakMap();
const authoredSupports=new WeakMap(),emptySupports=[];
function authoredSupport(data,x,z){
 let cells=authoredSupports.get(data);
 if(!cells){
  cells=new Map();
  for(const s of [...civicCraftPlan().solids,...domesticExteriorPlan(data,terrainHeight).solids]){
   if(s.y+s.h>groundHeight(s.x,s.z)+1.7)continue;
   for(let cx=Math.floor((s.x-s.w/2-.43)/32);cx<=Math.floor((s.x+s.w/2+.43)/32);cx++)for(let cz=Math.floor((s.z-s.d/2-.43)/32);cz<=Math.floor((s.z+s.d/2+.43)/32);cz++){
    const key=`${cx},${cz}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);
   }
  }
  authoredSupports.set(data,cells);
 }
 let y=-Infinity;
 for(const s of cells.get(`${Math.floor(x/32)},${Math.floor(z/32)}`)||emptySupports){
  const dx=Math.max(Math.abs(x-s.x)-s.w/2,0),dz=Math.max(Math.abs(z-s.z)-s.d/2,0);
  if(dx*dx+dz*dz<.43*.43)y=Math.max(y,s.y+s.h+.012);
 }
 return y;
}
function supportBuildings(data,x,z){let cells=supportPlans.get(data);if(!cells){cells=new Map();for(const b of data.buildings){if(!b.enterable)continue;for(let cx=Math.floor((b.x-b.w/2)/32);cx<=Math.floor((b.x+b.w/2)/32);cx++)for(let cz=Math.floor((b.z-b.d/2)/32);cz<=Math.floor((b.entry.z+Math.max(b.entry.length,5))/32);cz++){const key=`${cx},${cz}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(b);}}supportPlans.set(data,cells);}return cells.get(`${Math.floor(x/32)},${Math.floor(z/32)}`)||[];}
export function supportHeight(data,x,z){let y=Math.max(groundHeight(x,z),settlementSupport(x,z,terrainHeight),authoredSupport(data,x,z));for(const b of supportBuildings(data,x,z)){if(Math.abs(x-b.x)<=b.w*.5&&Math.abs(z-b.z)<=b.d*.5){y=Math.max(y,b.baseY+.2);let surfaces=furnitureSupports.get(b);if(!surfaces){surfaces=interiorPlan(b).solids.filter(s=>s.y+s.h<=b.baseY+1.7);furnitureSupports.set(b,surfaces);}for(const s of surfaces){const bench=s.id.endsWith('supplies-bench-top'),r=bench?.43:0;if(Math.abs(x-s.x)<s.w/2+r&&Math.abs(z-s.z)<s.d/2+r)y=Math.max(y,s.y+s.h+(bench?.012:0));}}let exterior=forecourtSupports.get(b);if(!exterior){exterior=cityForecourtPlan(b,groundHeight).solids.filter(s=>s.y+s.h<=b.baseY+1.7);forecourtSupports.set(b,exterior);}for(const s of exterior){const r=s.id.endsWith('bench-seat')?.43:0;if(Math.abs(x-s.x)<s.w/2+r&&Math.abs(z-s.z)<s.d/2+r)y=Math.max(y,s.y+s.h+.012);}const entry=entranceHeight(b,x,z);if(entry!==null)y=Math.max(y,entry);}if(x>=1168&&x<=1254&&Math.abs(z-300)<12)y=Math.max(y,14);return y;}
export function stepPlayer(state,input,data,grid,dt){
  const motion=locomotion(state),floorAt=(x,z)=>supportHeight(data,x,z);motion.landing=Math.max(0,motion.landing-dt*2.5);
  if(input.jump)motion.buffer=.12;else motion.buffer=Math.max(0,motion.buffer-dt);
  if(advanceVault(state,dt))return {moving:true,sprinting:false,swimming:false,onGround:false,vaulting:true,landing:motion.landing};
  const dirX=Math.sin(state.yaw)*input.forward+Math.cos(state.yaw)*input.strafe,dirZ=-Math.cos(state.yaw)*input.forward+Math.sin(state.yaw)*input.strafe,n=Math.max(1,Math.hypot(dirX,dirZ));
  const ground=supportHeight(data,state.x,state.z),swimming=ground<-.45,onGround=state.y<=Math.max(-.45,ground)+.08;
  motion.coyote=onGround&&state.vy<=0?.1:Math.max(0,motion.coyote-dt);
  if(motion.buffer>0&&onGround&&!swimming&&input.forward>.4&&input.vault!==false){const vault=findVault(state,grid,floorAt);if(vault){motion.vault=vault;motion.buffer=motion.coyote=0;advanceVault(state,dt);return {moving:true,sprinting:false,swimming:false,onGround:false,vaulting:true,landing:0};}}
  const intent=Math.hypot(dirX,dirZ)>.1,wantsSprint=input.sprint&&intent&&state.stamina>1&&!swimming;
  const speed=swimming?2.5:wantsSprint?9.3:5.2;
  // Exact exponential integration gives the same acceleration at different
  // frame rates. Collision owns the resulting distance and stops blocked axes.
  const response=onGround?(intent?24:36):7,decay=Math.exp(-response*dt),tx=dirX/n*speed,tz=dirZ/n*speed;
  const travelX=tx*dt+(motion.vx-tx)*(1-decay)/response,travelZ=tz*dt+(motion.vz-tz)*(1-decay)/response;
  motion.vx=tx+(motion.vx-tx)*decay;motion.vz=tz+(motion.vz-tz)*decay;
  const oldX=state.x,oldZ=state.z,steps=Math.max(1,Math.ceil(Math.hypot(travelX,travelZ)/.22));
  for(let i=0;i<steps;i++){
    const dx=travelX/steps,dz=travelZ/steps;
    const can=(x,z)=>Math.abs(x)<1400&&Math.abs(z)<900&&!grid.blocked(x,z,state.y,.42)&&supportHeight(data,x,z)<state.y+1.2;
    if(can(state.x+dx,state.z))state.x+=dx;else motion.vx=0;if(can(state.x,state.z+dz))state.z+=dz;else motion.vz=0;
  }
  const distance=Math.hypot(state.x-oldX,state.z-oldZ),actualSpeed=distance/Math.max(.001,dt),moving=actualSpeed>.08,sprinting=!!wantsSprint&&actualSpeed>5.4;
  state.stamina=clamp(state.stamina+(wantsSprint&&moving?-16:swimming&&moving?-5:13)*dt,0,100);
  if(motion.buffer>0&&motion.coyote>0&&!swimming){state.vy=6.1;motion.buffer=motion.coyote=0;}
  const previousY=state.y;state.vy-=18*dt;state.y+=state.vy*dt;
  // Furniture can now be stood on. Stop upward motion at the same ground-floor
  // ceiling used by the shell, leaving clearance above the 1.7 m eye position.
  if(state.vy>0)for(const b of supportBuildings(data,state.x,state.z)){
    const underside=b.baseY+(b.interiorHeight||3.4)-.16;
    if(Math.abs(state.x-b.x)<b.w/2-.2&&Math.abs(state.z-b.z)<b.d/2-.2&&previousY+1.8<=underside+.001&&state.y+1.8>underside){state.y=underside-1.8;state.vy=0;}
  }
  const floor=Math.max(-.45,supportHeight(data,state.x,state.z));
  // Follow supported stair treads instead of repeatedly becoming airborne.
  // Upward jumps and real ledges retain the normal gravity trajectory.
  const stepDown=onGround&&!swimming&&state.vy<=0&&previousY>=floor&&previousY-floor<=.35;
  if(state.y<floor||stepDown){if(!stepDown&&state.vy<-2)motion.landing=Math.min(1,-state.vy/12);state.y=floor;state.vy=0;}
  const exhausted=swimming&&state.stamina<=0,environmentalDamage=exhausted?5*dt:0;
  return {moving,sprinting,swimming,exhausted,environmentalDamage,onGround:state.vy===0&&state.y<=floor+.08,landing:motion.landing,vaulting:false,distance,speed:actualSpeed};
}
export function viewCeiling(grid,x,y,z){
 let ceiling=Infinity;for(const b of grid.query(x,z,.1))if(b.y>y+1.5&&Math.abs(x-b.x)<b.w/2+.1&&Math.abs(z-b.z)<b.d/2+.1)ceiling=Math.min(ceiling,b.y-.1);return ceiling;
}
export function objective(state){
  if(state.won)return {title:'The coast is yours',detail:'The broadcast is alive. Keep exploring Blackwater.',target:null};
  if(state.relays.length===3)return {title:'The last crossing',detail:'Reach the evacuation ferry at East Docks.',target:LANDMARKS.find(p=>p.id==='ferry')};
  const target=LANDMARKS.filter(p=>p.type==='relay'&&!state.relays.includes(p.id)).sort((a,b)=>Math.hypot(a.x-state.x,a.z-state.z)-Math.hypot(b.x-state.x,b.z-state.z))[0];
  if(target.id==='lighthouse'&&!state.fuse)return {title:'The keeper’s last light',detail:'Find the spare fuse inside the keeper’s house. Then restore Westlight.',target:{...target,...KEEPER_FUSE,id:target.id,name:'Keeper’s house'}};
  if(target.id==='hospital'&&!state.generatorReady)return {title:'Wake the emergency ward',detail:'Start the courtyard generator. Stay close until it warms up.',target:{...target,...HOSPITAL_GENERATOR,id:target.id,name:'Hospital generator'}};
  if(target.id==='ridge')return {title:'Above the treeline',detail:'Climb the survey stairs to the transmitter platform.',target:{...target,...(state.y<80?{x:-432,z:-286}:stationPosition(target))}};
  return {title:'A signal in the silence',detail:'Restore '+target.name+'. '+state.relays.length+' / 3 stations online.',target:{...target,...stationPosition(target)}};
}
// Slab intersection for firearm visibility. Building height matters: a shot
// above a fence may pass; walls cannot be bypassed by aiming at a hidden actor.
export function rayBox(origin,dir,b,max=100){let lo=0,hi=max;const bounds=[[b.x-b.w/2,b.x+b.w/2],[b.y,b.y+b.h],[b.z-b.d/2,b.z+b.d/2]];for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-7){if(origin[i]<bounds[i][0]||origin[i]>bounds[i][1])return null;}else{let a=(bounds[i][0]-origin[i])/dir[i],c=(bounds[i][1]-origin[i])/dir[i];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return null;}}return lo;}
export function clearShot(origin,dir,distance,grid){
  const candidates=new Set();for(let t=0;t<=distance;t+=8)for(const b of grid.query(origin[0]+dir[0]*t,origin[2]+dir[2]*t,9))candidates.add(b);
  for(const b of candidates){const hit=rayBox(origin,dir,b,distance);if(hit!==null&&hit<distance-.1)return false;}return true;
}
