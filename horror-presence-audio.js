// Reuse licensed, bundled foley. All timing is supplied by the simulation.
const profiles={
 step:{type:'footstep',volume:.19,rate:.82,lowpass:1450},
 pipe:{type:'mechanism',weapon:5,volume:.13,rate:.69,lowpass:1600},
 breath:{type:'horror-approach',volume:.14,rate:.87,lowpass:1500},
 cloth:{type:'slide',volume:.11,rate:.72,lowpass:2300},
 wet:{type:'blood',volume:.11,rate:.78,lowpass:1900},
 strain:{type:'mechanism',weapon:5,volume:.16,rate:.54,lowpass:2200}
};
export class HorrorPresenceAudio {
 constructor(audio){this.audio=audio;this.sources=new Set();this.played=0;this.failed=0;this.lastId=0;this.owner=null;this.maxVoices=3;this.run=null;}
 cancel(){for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();this.owner=null;}
 reset(){this.cancel();this.lastId=0;this.played=0;this.failed=0;}
 update(state,cues,run,settings={}){
  if(this.run!==run){this.reset();this.run=run;}
  if(!state.enabled||!state.active){this.cancel();return;}
  if(this.owner!==state.active.id){this.cancel();this.owner=state.active.id;}
  for(const source of this.sources)if(!this.audio._sources?.has(source))this.sources.delete(source);
  for(const cue of cues){
   if(cue.id<=this.lastId||cue.eventId!==state.active.id)continue;this.lastId=cue.id;
   if(settings.volume===0||this.audio._muted||!this.audio.assetsLoaded){this.failed++;continue;}
   const profile=profiles[cue.cue];if(!profile)continue;
   const before=new Set(this.audio._sources||[]);
   const a=cue.anchor,angle=Math.atan2(a.y-run.y,a.x-run.x),distance=Math.hypot(a.x-run.x,a.y-run.y);
   const occluded=!!settings.occluded?.(angle,distance);
   const group=cue.cue==='step'?'sfx':'ambience';
   const played=this.audio.play(profile.type,profile.weapon||0,{...profile,group,id:`presence-${cue.id}`,cooldown:0,duration:cue.cue==='breath'?1.1:.8,position:{x:a.x*4,y:cue.kind==='cuff'?1.2:1.7,z:a.y*4},occluded,lowpass:occluded?Math.min(profile.lowpass,950):profile.lowpass,refDistance:5,maxDistance:36,rolloffFactor:.8,modulationHz:cue.rough?38:0,modulationDepth:cue.rough?.08:0});
   if(played){this.played++;for(const source of this.audio._sources||[])if(!before.has(source))this.sources.add(source);}else this.failed++;
   while(this.sources.size>this.maxVoices){const source=this.sources.values().next().value;try{source.stop();}catch{}this.sources.delete(source);}
  }
 }
 diagnostics(){return {ownedVoices:this.sources.size,maxVoices:this.maxVoices,played:this.played,failed:this.failed,lastId:this.lastId};}
}
