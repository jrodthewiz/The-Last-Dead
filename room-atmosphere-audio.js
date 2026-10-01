import {castRay} from './engine.js';
import {roomContainsCell} from './playground/map/dungeon-compiler.js';
import {horrorEligibility} from './horror-presence.js';

export const ATMOSPHERE_LIMITS=Object.freeze({beds:2,range:24,detailRange:18,interval:.05,whisperGap:42,rustleGap:17});
const hash=s=>{let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const roomFor=(course,x,y)=>course.rooms?.find(room=>roomContainsCell(room,x,y))||null;
const distance=(run,p)=>Math.hypot(run.x*4-p.x,run.y*4-p.z);
export function atmosphereOcclusion(run,position){
 const dx=position.x/4-run.x,dy=position.z/4-run.y,d=Math.hypot(dx,dy);
 return d>.1&&castRay(run.course,run.x,run.y,Math.atan2(dy,dx),d).dist<d-.12;
}

// The sources are the objects the player can actually encounter: ventilation,
// organ mouths, barred recesses, and cloth meshes. No phantom outdoor foliage.
export function atmosphereSources(course,renderer={}){
 const sources=[],add=(id,family,position,roomId)=>{
  if(!position||![position.x,position.y,position.z].every(Number.isFinite))return;
  sources.push({id:`atmosphere:${id}:${family}`,family,position,roomId:roomId||roomFor(course,position.x/4,position.z/4)?.id||null});
 };
 for(const opening of course.openings||[])if(opening.kind==='vent'){
  const p={x:opening.anchor.x*4,y:2.4,z:opening.anchor.y*4};
  add(opening.id,'wind',p,opening.roomId);add(opening.id,'whisper',p,opening.roomId);
 }
 for(const object of [...(course.landmarks||[]),...(course.machinery||[])]){
  const a=object.anchor;if(!a)continue;
  const p={x:a[0]*4,y:object.type==='pipe-organ'?3:1.8,z:a[1]*4};
  if(['pump-bank','organ-pump','boiler-stack','pipe-organ'].includes(object.type))add(object.id,'wind',p,object.roomId);
  if(['flesh-conduit','mouth-altar','gate-organ','pipe-organ','bone-cage'].includes(object.type))add(object.id,'whisper',p,object.roomId);
 }
 if(renderer._course===course){
  const recess=renderer.horrorScares?.window?.group;
  if(recess){const p=recess.getWorldPosition(recess.position.clone());add('barred-recess','wind',{x:p.x,y:p.y+2,z:p.z});add('barred-recess','whisper',{x:p.x,y:p.y+2,z:p.z});}
  const dressing=renderer.horror?.setDressing,anchors=dressing?.userData?.audioAnchors;
  for(const source of anchors||[]){
   const p=dressing.position.clone().set(source.position.x,source.position.y,source.position.z).applyMatrix4(dressing.matrixWorld);
   add(source.id,'rustle',{x:p.x,y:p.y,z:p.z});
  }
  for(const [i,prop]of (anchors?[]:dressing?.children||[]).entries()){
   if(!prop.userData?.setDressing||!prop.children?.some(mesh=>mesh.name?.endsWith('_cloth')))continue;
   const p=prop.getWorldPosition(prop.position.clone());add(`cloth-${i}-${prop.userData.setDressing}`,'rustle',{x:p.x,y:p.y+.9,z:p.z});
  }
 }
 return sources.slice(0,64);
}

export class RoomAtmosphereAudio{
 constructor(audio){this.audio=audio;this.run=null;this.course=null;this.rendererRoot=null;this.sources=[];this.beds=new Set();this.short=null;this.reservedUntil=0;this.history=[];this.counts={wind:0,whisper:0,rustle:0};this.nextWhisper=0;this.nextRustle=0;this.nextUpdate=0;this.reason='inactive';}
 reset(){for(const id of this.beds)this.audio.stopSpatialEmitter(id,{immediate:true});if(this.short)this.audio.stopSpatialEmitter(this.short,{immediate:true});this.beds.clear();this.short=null;this.nextUpdate=0;}
 bind(run,renderer){
  const root=renderer._course===run.course?renderer.horror?.setDressing:null;
  if(this.run!==run||this.course!==run.course){this.reset();this.run=run;this.course=run.course;this.rendererRoot=root;this.sources=atmosphereSources(run.course,renderer);
   const time=run.time||0;this.nextWhisper=time+32+hash(run.course.id||run.course.name)%17;this.nextRustle=time+8+hash(run.course.id||'cloth')%8;
   this.history=[];this.counts={wind:0,whisper:0,rustle:0};
  }else if(this.rendererRoot!==root){this.rendererRoot=root;this.sources=atmosphereSources(run.course,renderer);}
 }
 diagnostics(){return {reason:this.reason,nextWhisper:this.nextWhisper,nextRustle:this.nextRustle,sources:this.sources.map(s=>({...s,position:{...s.position}})),beds:[...this.beds],short:this.short,counts:{...this.counts},history:this.history.slice(-12)};}
 update(run,renderer,{playing=true,presence=null,force=false}={}){
  this.bind(run,renderer);
  if(!playing||run.mode!=='play'||run.health<=0){this.reason='inactive';this.reset();return;}
  const time=run.time||0;if(!force&&time<this.nextUpdate)return;this.nextUpdate=time+ATMOSPHERE_LIMITS.interval;
  const active=new Set(this.audio.spatialDiagnostics().emitters.map(s=>s.id));
  for(const id of this.beds)if(!active.has(id))this.beds.delete(id);
  if(this.short&&!active.has(this.short))this.short=null;
  const reason=horrorEligibility(run),state=presence?.state?.()||presence;
  const blocked=reason||state?.active||presence?.recovery>0||
   (presence?.clock<presence?.legacyUntil&&!(this.short&&presence?.legacyUntil===this.reservedUntil));
  this.reason=typeof blocked==='string'?blocked:blocked?'horror-scene':'quiet';
  const ranked=this.sources.filter(s=>s.family==='wind'&&distance(run,s.position)<(this.beds.has(s.id)?26:22)).sort((a,b)=>distance(run,a.position)-distance(run,b.position));
  const selected=ranked.slice(0,ATMOSPHERE_LIMITS.beds),selectedIds=new Set(selected.map(s=>s.id));
  for(const id of this.beds)if(!selectedIds.has(id)){this.audio.stopSpatialEmitter(id);this.beds.delete(id);}
  for(const source of selected){
   const details={position:source.position,occluded:atmosphereOcclusion(run,source.position),volume:blocked?.022:.065,
    loop:true,variant:1,rate:.98,offset:hash(source.id)%1600/100,highpass:160,lowpass:4200,refDistance:2.8,maxDistance:28,rolloffFactor:1.35};
   if(this.beds.has(source.id))this.audio.updateSpatialEmitter(source.id,details);
   else if(this.audio.startSpatialEmitter(source.id,'ambience',details)){this.beds.add(source.id);this.counts.wind++;}
  }
  // Cancel a frightening detail when an attack/action or a directed scene
  // begins; ordinary low air movement can remain in a recovery room.
  if(blocked){if(this.short)this.audio.stopSpatialEmitter(this.short);this.short=null;return;}
  if(this.short){const s=this.sources.find(s=>s.id===this.short);if(s)this.audio.updateSpatialEmitter(s.id,{position:s.position,occluded:atmosphereOcclusion(run,s.position)});return;}
  if(time>=this.nextWhisper){
   this.nextWhisper=time+ATMOSPHERE_LIMITS.whisperGap+hash(`${run.course.id}:${Math.floor(time)}`)%25;
   if(presence?.allowLegacy?.(run)!==false){
    const played=this.trigger('whisper',run);
    if(played&&presence?.claimLegacy){
     if(presence.claimLegacy(run,'secret-whisper',4))this.reservedUntil=presence.legacyUntil;
     else{this.audio.stopSpatialEmitter(this.short,{immediate:true});this.short=null;}
    }
   }
  }else if(time>=this.nextRustle){this.nextRustle=time+ATMOSPHERE_LIMITS.rustleGap+hash(`${run.course.id}:${Math.floor(time)}`)%13;this.trigger('rustle',run);}
 }
 trigger(family,run,id=null){
  if(!['wind','whisper','rustle'].includes(family)||this.short&&family!=='wind')return false;
  const candidates=this.sources.filter(s=>s.family===family&&(!id||s.id===id)&&distance(run,s.position)<=ATMOSPHERE_LIMITS.detailRange&&
   (family!=='whisper'||run.course.rooms?.find(r=>r.id===s.roomId)?.flow?.role!=='recovery')).sort((a,b)=>distance(run,a.position)-distance(run,b.position));
  const source=candidates[0];if(!source)return false;
  const variant=(this.counts[family]+hash(source.id))%3,loop=family==='wind';
  const details={position:source.position,occluded:atmosphereOcclusion(run,source.position),loop,variant:loop?1:variant,rate:1,offset:loop?hash(source.id)%1600/100:0,
   volume:loop?.065:family==='whisper'?.15:.12,highpass:family==='whisper'?230:170,lowpass:family==='whisper'?4700:6200,
   refDistance:family==='whisper'?2.6:2,maxDistance:24,rolloffFactor:1.3};
  if(!this.audio.startSpatialEmitter(source.id,loop?'ambience':family==='whisper'?'secret-whisper':'cloth-rustle',details))return false;
  if(loop)this.beds.add(source.id);else this.short=source.id;
  this.counts[family]++;this.history.push({family,id:source.id,time:run.time,variant});this.history=this.history.slice(-12);return true;
 }
}
