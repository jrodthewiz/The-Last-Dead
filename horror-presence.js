// Simulation-clock horror direction. This module never damages or moves a player.
export const HORROR_KINDS=Object.freeze(['answering','approach','witness','transfer','strain','callback','table','cuff']);
export const HORROR_LIMITS=Object.freeze({history:16,cues:16,steps:6,threatRadius:5,grace:10,calm:5,recovery:24,cooldown:68});
const finite=Number.isFinite;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const busy=a=>!!a?.phase&&!['idle','cancelled','released','complete','completed'].includes(a.phase);
const key=c=>`${c?.id||c?.name||'course'}:${c?.dungeonIndex??c?.index??0}`;
const duration={answering:7.2,approach:6,witness:9,transfer:8,strain:8,callback:9,table:9,cuff:7.2};
function roomAt(run){
 const id=run.dungeonProgression?.activeRoomId||run.roomProgression?.currentRoomId;
 return run.course?.rooms?.find(r=>r.id===id)||run.course?.rooms?.find(r=>r.bounds&&run.x>=r.bounds.minX&&run.x<=r.bounds.maxX&&run.y>=r.bounds.minZ&&run.y<=r.bounds.maxZ)||null;
}
function playable(run){return run?.mode==='play'&&run.health>0;}
export function horrorPresentationContext({screen,inspecting=false,connected=false,role='host'}={}){
 const authoritative=!connected||role!=='guest';
 return {authoritative,sharedPlaying:!inspecting&&(screen==='play'||authoritative&&connected&&screen==='pause'),localPlaying:!inspecting&&screen==='play'};
}
export function horrorEligibility(run){
 if(!playable(run))return 'inactive';
 if(run.health<35)return 'low-health';
 const room=roomAt(run);
 if(room?.flow?.role==='recovery'||room?.kind==='recovery')return 'recovery-room';
 if(busy(run.bite)||busy(run.brutal)||busy(run.extraction)||busy(run.verminHand))return 'hand-action';
 if(run.meleeActive||run.sawActive||run.rifleCharging||run.shot>.02||run.damage>.05||run.punch>.02||run.dashTime>0||run.slide>.1||run.hookTime>0)return 'player-action';
 if(['warning','active'].includes(run.vermin?.swarm?.phase))return 'swarm';
 if((run.course?.enemies||[]).some(e=>!e.dead&&Math.hypot(e.x-run.x,e.y-run.y)<HORROR_LIMITS.threatRadius))return 'nearby-threat';
 if((run.projectiles||[]).some(p=>Math.hypot(p.x-run.x,p.y-run.y)<3))return 'projectile';
 const p=run.dungeonProgression||run.roomProgression;
 if(p?.phase==='combat'||p?.currentEncounter||p?.encounter?.active>0)return 'encounter';
 return null;
}

export class HorrorPresence {
 constructor(environment={}){this.environment=environment;this.reset();}
 reset(){
  this.run=null;this.course=null;this.courseKey='';this.clock=0;this.lastTime=0;this.sequence=0;this.cueSequence=0;this.active=null;this.history=[];this.cues=[];this.networkCues=[];this.steps=[];this.memory={rhythm:[],courseKey:'',floor:0};this.seen=new Set();this.calm=0;this.cooldown=HORROR_LIMITS.grace;this.recovery=0;this.stopped=0;this.legacyUntil=0;this.enabled=false;this.reason='inactive';this.receivedCue=0;this.receivedSequence=-1;this.counts={};
 }
 bind(run){
  if(this.run!==run){this.reset();this.run=run;this.lastTime=run.time||0;}
  if(this.course!==run.course){this.cancel('course-change');this.course=run.course;this.courseKey=key(run.course);this.lastTime=run.time||0;this.calm=0;this.cooldown=Math.max(this.cooldown,8);}
 }
 noteStep(run){this.bind(run);if(!playable(run))return;this.steps.push(this.clock);if(this.steps.length>HORROR_LIMITS.steps)this.steps.shift();this.stopped=0;}
 rhythm(){return this.steps.slice(1).map((t,i)=>t-this.steps[i]).filter(t=>t>=.12&&t<=1.5).map(t=>Math.round(t*1000)/1000).slice(-4);}
 anchor(run,kind,override){
  const room=roomAt(run),b=room?.bounds;
  const authored=(run.course.scares||[]).find(s=>s.roomId===room?.id&&s.at);
  const candidates=[];
  if(override&&finite(override.x)&&finite(override.y))candidates.push(override);
  if(authored&&['witness','table','callback'].includes(kind))candidates.push({x:authored.at[0],y:authored.at[1]});
  // The fixture sits beside the walking route, facing the observer.
  if(b){for(const x of[b.minX+.65,b.maxX-.65]){const p={x,y:clamp(run.y,b.minZ+.6,b.maxZ-.6)};if(Math.hypot(p.x-run.x,p.y-run.y)<=1.5)candidates.push(p);}}
  for(const a of [run.angle,run.angle+Math.PI/2,run.angle-Math.PI/2,run.angle+Math.PI])candidates.push({x:run.x+Math.cos(a)*1.1,y:run.y+Math.sin(a)*1.1});
  candidates.push({x:run.x,y:run.y});
  const point=candidates.find(p=>{
   if(p.x<=.2||p.y<=.2||p.x>=run.course.w-.2||p.y>=run.course.h-.2||this.environment.canStand&&!this.environment.canStand(run.course,p.x,p.y,.22))return false;
   const distance=Math.hypot(p.x-run.x,p.y-run.y);
   if(['witness','transfer','strain','callback','table'].includes(kind)&&distance<.55)return false;
   return !this.environment.castRay||distance<.1||this.environment.castRay(run.course,run.x,run.y,Math.atan2(p.y-run.y,p.x-run.x),distance).dist>=distance-.05;
  });
  return point?{x:point.x,y:point.y,angle:Math.atan2(run.y-point.y,run.x-point.x)}:null;
 }
 trigger(kind,run,options={}){
  this.bind(run);
  if(!HORROR_KINDS.includes(kind)||!playable(run)||this.active||(!options.force&&(horrorEligibility(run)||this.cooldown>0||this.recovery>0||this.clock<this.legacyUntil)))return false;
  if(kind==='cuff'&&['severed','missing'].includes(run.playerWounds?.rightArm))return false;
  if(kind==='cuff'&&busy(run.verminCrawl))return false;
  if(kind==='callback'&&!options.force&&!this.memory.rhythm.length)return false;
  const anchor=this.anchor(run,kind,options.anchor);if(!anchor)return false;
  const rhythm=(options.rhythm||((kind==='callback'&&this.memory.rhythm.length)?this.memory.rhythm:this.rhythm())).filter(n=>finite(n)&&n>=.12&&n<=1.5).slice(-4);
  if(!rhythm.length)rhythm.push(.37,.62,.41);
  this.active={id:++this.sequence,kind,elapsed:0,duration:duration[kind],anchor,rhythm,roomId:roomAt(run)?.id||this.courseKey,fired:0};
  if(kind==='answering'){this.memory={rhythm:[...rhythm],courseKey:this.courseKey,floor:run.course.dungeonIndex??run.sectorIndex??0};}
  this.seen.add(`${this.courseKey}:${this.active.roomId}:${kind}`);if(this.seen.size>64)this.seen.delete(this.seen.values().next().value);
  this.counts[kind]=(this.counts[kind]||0)+1;this.history.push({id:this.sequence,kind,clock:this.clock,roomId:this.active.roomId});this.history=this.history.slice(-HORROR_LIMITS.history);
  if(kind==='cuff'&&!busy(run.verminCrawl))run.verminCrawl={phase:'active',elapsed:0,sequence:(run.verminCrawl?.sequence||0)+1,kind:'roach',count:1,weapon:false,duration:1.3};
  this.enabled=true;this.emitDue();return true;
 }
 timeline(a){
  let t=.75;
  const rhythm=a.rhythm.map((interval,i)=>{t+=interval;return{at:t,cue:'step',offset:i*.055};});
  if(a.kind==='answering')return [{at:.3,cue:'pipe'},...rhythm];
  if(a.kind==='callback')return [{at:.4,cue:'pipe'},...rhythm,{at:t+.7,cue:'breath'}];
  if(a.kind==='approach')return [0,1.4,2.8,4.2].map((at,i)=>({at,cue:'breath',distance:3-i*.7,rough:i===3}));
  if(a.kind==='cuff')return [{at:0,cue:'cloth'},{at:1.55,cue:'cloth'},{at:3.25,cue:'cloth'},{at:5.2,cue:'cloth'}];
  if(a.kind==='transfer')return [{at:.3,cue:'pipe'},{at:2.4,cue:'wet'},{at:4.2,cue:'cloth'},{at:6,cue:'pipe'}];
  if(a.kind==='strain')return [{at:.2,cue:'pipe'},{at:2,cue:'strain'},{at:3.5,cue:'strain'},{at:5.5,cue:'breath',rough:true}];
  if(a.kind==='table')return [{at:.4,cue:'breath'},{at:2.7,cue:'cloth'},{at:4.8,cue:'breath',rough:true},{at:6.9,cue:'pipe'}];
  return [{at:.4,cue:'cloth'},{at:2.8,cue:'breath'},{at:5.2,cue:'cloth'},{at:7,cue:'breath',rough:true}];
 }
 emitDue(){
  const a=this.active;if(!a)return;
  const events=this.timeline(a);
  while(a.fired<events.length&&events[a.fired].at<=a.elapsed+1e-6){
   const item=events[a.fired++],anchor={...a.anchor};
   if(a.kind==='cuff'){anchor.x=this.run.x;anchor.y=this.run.y;}
   if(item.distance){anchor.x-=Math.cos(anchor.angle)*item.distance;anchor.y-=Math.sin(anchor.angle)*item.distance;}
   if(item.offset){anchor.x+=Math.cos(anchor.angle+Math.PI/2)*item.offset;anchor.y+=Math.sin(anchor.angle+Math.PI/2)*item.offset;}
   anchor.x=clamp(anchor.x,.21,this.course.w-.21);anchor.y=clamp(anchor.y,.21,this.course.h-.21);
   const cue={id:++this.cueSequence,eventId:a.id,kind:a.kind,cue:item.cue,rough:!!item.rough,anchor,clock:this.clock};
   this.cues.push(cue);this.networkCues.push(cue);
  }
  this.cues=this.cues.slice(-HORROR_LIMITS.cues);this.networkCues=this.networkCues.slice(-HORROR_LIMITS.cues);
 }
 cancel(reason='cancelled'){
  if(this.active){this.history.push({id:this.active.id,kind:this.active.kind,clock:this.clock,reason});this.history=this.history.slice(-HORROR_LIMITS.history);this.active=null;this.recovery=HORROR_LIMITS.recovery;this.cooldown=HORROR_LIMITS.cooldown;}
  this.cues=[];
 }
 choose(run){
  const room=roomAt(run),id=room?.id||this.courseKey;
  const unseen=kind=>!this.seen.has(`${this.courseKey}:${id}:${kind}`);
  if(!this.memory.rhythm.length&&this.rhythm().length>=2&&this.stopped>.75&&unseen('answering'))return 'answering';
  const authored={'f1-crane':'witness','f2-wardD':'transfer','f2-theater':'table','f3-vault':'strain','f3-apse':'callback','f4-aisleW':'cuff','f4-tower':'approach','f5-organ':'callback'};
  const kind=authored[id];if(kind&&unseen(kind))return kind;
  if(this.memory.rhythm.length&&(run.course.dungeonIndex??run.sectorIndex??0)>this.memory.floor&&unseen('callback'))return 'callback';
  if(this.history.some(h=>h.roomId===id&&!h.reason))return null;
  const index=Math.max(0,run.course.rooms?.findIndex(r=>r.id===id)??0);
  const fallback=['approach','witness','transfer','strain','table','cuff'][index%6];
  return unseen(fallback)&&this.clock>20?fallback:null;
 }
 update(run,options={}){
  this.bind(run);this.enabled=!!options.playing&&playable(run);this.reason=horrorEligibility(run)||(!this.enabled?'inactive':null);
  const time=run.time||0,dt=clamp(time-this.lastTime,0,1);this.lastTime=time;
  if(!this.enabled){if(options.authoritative!==false&&(run.health<=0||['ready','dead','win'].includes(run.mode)))this.cancel('inactive');return this.state();}
  this.clock+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.recovery=Math.max(0,this.recovery-dt);
  this.stopped=run.speed>.1?0:this.stopped+dt;
  // Only the host ends a shared encounter. A guest's local shot/threat can
  // silence its presentation without deleting and resurrecting the actor.
  if(options.authoritative===false){
   if(this.active)this.active.elapsed=Math.min(this.active.duration,this.active.elapsed+dt);
   return {...this.state(),enabled:this.enabled&&!this.reason};
  }
  if(this.reason){this.calm=0;this.cancel(this.reason);return this.state();}
  this.calm+=dt;
  if(this.active){this.active.elapsed+=dt;if(options.authoritative!==false)this.emitDue();if(this.active.elapsed>=this.active.duration)this.cancel('complete');}
  else if(options.authoritative!==false&&!options.manual&&this.calm>=HORROR_LIMITS.calm&&this.cooldown<=0&&this.recovery<=0&&this.clock>=this.legacyUntil){const kind=this.choose(run);if(kind)this.trigger(kind,run);}
  return this.state();
 }
 state(){return {enabled:this.enabled,active:this.active?{...this.active,anchor:{...this.active.anchor},rhythm:[...this.active.rhythm]}:null,memory:{...this.memory,rhythm:[...this.memory.rhythm]}};}
 drain(){return this.cues.splice(0);}
 allowLegacy(run){this.bind(run);return playable(run)&&!horrorEligibility(run)&&!this.active&&this.recovery<=0&&this.clock>=this.legacyUntil&&(!this.memory.rhythm.length||this.cooldown>4);}
 claimLegacy(run,kind,seconds=10){if(!this.allowLegacy(run))return false;this.legacyUntil=this.clock+clamp(seconds,1,15);this.cooldown=Math.max(this.cooldown,seconds+8);this.history.push({kind:`legacy-${kind}`,clock:this.clock});this.history=this.history.slice(-HORROR_LIMITS.history);return true;}
 snapshot(){return {version:1,courseKey:this.courseKey,sequence:this.sequence,clock:this.clock,...this.state(),cues:this.networkCues.slice(-8)};}
 receive(value,run){
  this.bind(run);
  if(!validateHorrorSnapshot(value,run.course)||value.sequence<this.receivedSequence)return false;
  this.receivedSequence=value.sequence;this.clock=value.clock;this.lastTime=run.time||0;this.sequence=value.sequence;this.enabled=value.enabled;this.active=value.active?{...value.active,anchor:{...value.active.anchor},rhythm:[...value.active.rhythm],fired:0}:null;this.memory={...value.memory,rhythm:[...value.memory.rhythm]};
  for(const cue of value.cues)if(cue.id>this.receivedCue){this.receivedCue=cue.id;if(value.clock-cue.clock<.45&&this.active?.id===cue.eventId)this.cues.push({...cue,anchor:{...cue.anchor}});}
  this.cues=this.cues.slice(-HORROR_LIMITS.cues);return true;
 }
 diagnostics(){return {...this.state(),clock:this.clock,sequence:this.sequence,pending:this.cues.length,history:this.history.slice(),counts:{...this.counts},cooldown:this.cooldown,recovery:this.recovery,calm:this.calm,reason:this.reason,roomId:roomAt(this.run||{})?.id||null,courseKey:this.courseKey};}
}
export function validateHorrorSnapshot(v,course){
 const point=p=>p&&[p.x,p.y,p.angle].every(finite)&&p.x>=0&&p.y>=0&&p.x<=course.w&&p.y<=course.h&&Math.abs(p.angle)<=Math.PI;
 const rhythm=r=>Array.isArray(r)&&r.length<=4&&r.every(n=>finite(n)&&n>=.12&&n<=1.5);
 if(!v||v.version!==1||v.courseKey!==key(course)||!Number.isSafeInteger(v.sequence)||v.sequence<0||v.sequence>1e7||!finite(v.clock)||v.clock<0||v.clock>1e7||typeof v.enabled!=='boolean'||!v.memory||!rhythm(v.memory.rhythm)||typeof v.memory.courseKey!=='string'||v.memory.courseKey.length>160||!Number.isInteger(v.memory.floor)||v.memory.floor<0||v.memory.floor>5||!Array.isArray(v.cues)||v.cues.length>8)return false;
 const a=v.active;
 if(a&&(!HORROR_KINDS.includes(a.kind)||!Number.isSafeInteger(a.id)||a.id<0||a.id>v.sequence||!point(a.anchor)||!rhythm(a.rhythm)||!finite(a.elapsed)||!finite(a.duration)||a.elapsed<0||a.elapsed>a.duration||a.duration<1||a.duration>12||typeof a.roomId!=='string'||a.roomId.length>160))return false;
 return v.cues.every(c=>Number.isSafeInteger(c.id)&&c.id>0&&c.id<=1e8&&Number.isSafeInteger(c.eventId)&&c.eventId>0&&c.eventId<=v.sequence&&HORROR_KINDS.includes(c.kind)&&['step','pipe','breath','cloth','wet','strain'].includes(c.cue)&&point(c.anchor)&&typeof c.rough==='boolean'&&finite(c.clock)&&c.clock>=0&&c.clock<=v.clock+.01);
}
