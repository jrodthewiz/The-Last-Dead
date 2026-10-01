import test from 'node:test';
import assert from 'node:assert/strict';
import {HorrorPresence,HORROR_KINDS,HORROR_LIMITS,horrorEligibility,validateHorrorSnapshot,horrorPresentationContext} from '../horror-presence.js';
import {HorrorPresenceAudio} from '../horror-presence-audio.js';
import {makeDungeonCourse,DUNGEON_LAYERS} from '../playground/map/dungeon-course.js';
import {canStand,castRay} from '../engine.js';
const fixture=()=>({x:5,y:5,angle:0,time:0,health:100,mode:'play',speed:0,course:{id:'fixture',w:12,h:12,index:0,enemies:[],rooms:[{id:'ward',bounds:{minX:2,maxX:9,minZ:2,maxZ:9}}]},projectiles:[]});
function advance(core,run,seconds,options={}){for(let t=0;t<seconds-1e-6;t+=.05){run.time+=.05;core.update(run,{playing:true,...options});}}
test('recorded walking rhythm answers after the player stops, then grants recovery',()=>{
 const r=fixture(),c=new HorrorPresence();c.update(r,{playing:true});
 advance(c,r,11);c.noteStep(r);advance(c,r,.3);c.noteStep(r);advance(c,r,.65);c.noteStep(r);advance(c,r,1);
 assert.equal(c.active.kind,'answering');assert.deepEqual(c.memory.rhythm,[.3,.65]);
 const health=r.health;advance(c,r,8);assert.equal(c.active,null);assert.ok(c.recovery>20);assert.equal(r.health,health);
 assert.equal(c.trigger('witness',r),false);
});
test('one scene at a time; enemies, recovery rooms, injury, combat and actions take priority',()=>{
 const r=fixture(),c=new HorrorPresence();c.update(r,{playing:true});
 for(const kind of HORROR_KINDS){assert.equal(c.trigger(kind,r,{force:true}),true);assert.equal(c.trigger('witness',r,{force:true}),false);c.cancel();}
 assert.equal(c.trigger('witness',r,{force:true}),true);r.course.enemies.push({x:6,y:5,dead:false});advance(c,r,.1);assert.equal(c.active,null);assert.equal(c.reason,'nearby-threat');
 r.course.enemies=[];r.course.rooms[0].flow={role:'recovery'};assert.equal(horrorEligibility(r),'recovery-room');
 delete r.course.rooms[0].flow;r.bite={phase:'held'};assert.equal(horrorEligibility(r),'hand-action');
 r.bite=null;r.health=20;assert.equal(horrorEligibility(r),'low-health');
});
test('pause freezes scene and emits no late cue; resume, death, course and restart clean up',()=>{
 const r=fixture(),c=new HorrorPresence();c.trigger('strain',r,{force:true});advance(c,r,1);c.drain();
 const elapsed=c.active.elapsed,clock=c.clock;r.mode='pause';advance(c,r,2);assert.equal(c.active.elapsed,elapsed);assert.equal(c.clock,clock);assert.deepEqual(c.drain(),[]);
 r.mode='play';advance(c,r,.2);assert.ok(c.active.elapsed>elapsed);
 r.health=0;advance(c,r,.1);assert.equal(c.active,null);
 r.health=100;c.trigger('answering',r,{force:true,rhythm:[.25,.8]});const memory=c.memory.rhythm;r.course={...r.course,index:1};c.update(r,{playing:true});assert.equal(c.active,null);assert.deepEqual(c.memory.rhythm,memory);
 c.update(fixture(),{playing:true});assert.deepEqual(c.memory.rhythm,[]);assert.equal(c.sequence,0);
});
test('scripted cuff is cosmetic and bounded; authored anchors fall back to walkable cells',()=>{
 const r=fixture(),c=new HorrorPresence({canStand:(_c,x)=>x>4});c.trigger('cuff',r,{force:true,anchor:{x:3,y:5}});
 assert.ok(c.active.anchor.x>4);assert.equal(r.verminCrawl.kind,'roach');assert.equal(r.verminCrawl.count,1);assert.equal(r.verminCrawl.weapon,false);assert.equal(r.health,100);
 assert.equal(c.active.duration,7.2);assert.ok(c.drain().length<=HORROR_LIMITS.cues);
});
test('host snapshot is bounded, validated, course-bound and sound cues cannot replay',()=>{
 const r=fixture(),host=new HorrorPresence();host.trigger('approach',r,{force:true});advance(host,r,.2);const s=host.snapshot();assert.equal(validateHorrorSnapshot(s,r.course),true);
 const guest=new HorrorPresence();assert.equal(guest.receive(s,r),true);assert.equal(guest.drain().length,1);guest.receive(s,r);assert.equal(guest.drain().length,0);
 assert.equal(validateHorrorSnapshot({...s,active:{...s.active,anchor:{x:NaN,y:1,angle:0}}},r.course),false);
 assert.equal(validateHorrorSnapshot({...s,cues:Array(20).fill(s.cues[0])},r.course),false);
 assert.equal(validateHorrorSnapshot(s,{...r.course,index:2}),false);
 assert.equal(validateHorrorSnapshot({...s,memory:{...s.memory,rhythm:[-1]}},r.course),false);
 advance(guest,r,.2,{authoritative:false});assert.equal(guest.drain().length,0);
});
test('audio owns and caps its own voices, respects mute and cancels without stopping gameplay',()=>{
 let id=0;const unrelated={stop(){throw Error('gameplay voice stopped');}};
 const audio={assetsLoaded:true,_sources:new Set([unrelated]),play(type,weapon,event){const source={id:++id,stop(){audio._sources.delete(source);}};audio._sources.add(source);audio.events.push(event);return true;},events:[]};
 const bridge=new HorrorPresenceAudio(audio),state={enabled:true,active:{id:1}},r=fixture();
 const cues=Array.from({length:8},(_,i)=>({id:i+1,eventId:1,cue:'breath',kind:'approach',anchor:{x:6,y:5},rough:true}));
 bridge.update(state,cues,r,{volume:.5});assert.equal(bridge.sources.size,3);assert.equal(audio.events[0].modulationHz,38);assert.equal(audio.events[0].modulationDepth,.08);assert.ok(audio._sources.has(unrelated));
 bridge.update(state,[{...cues[0],id:9}],r,{volume:0});assert.equal(audio.events.length,8);
 bridge.update({enabled:false,active:null},[],r);assert.equal(bridge.sources.size,0);assert.deepEqual([...audio._sources],[unrelated]);
 bridge.update(state,[cues[0]],fixture(),{volume:.5});assert.equal(bridge.played,1,'a restarted run can reuse cue IDs and still play');bridge.cancel();
});
test('shared scare budget excludes legacy jumps while a scene or recovery is active',()=>{
 const r=fixture(),c=new HorrorPresence();c.update(r,{playing:true});assert.equal(c.claimLegacy(r,'window',10),true);assert.equal(c.trigger('strain',r),false);
 c.trigger('strain',r,{force:true});assert.equal(c.claimLegacy(r,'drop'),false);c.cancel();assert.equal(c.allowLegacy(r),false);
});
test('real shaped dungeon rooms place inspectable scenes in walkable visible space',()=>{
 let checked=0;
 for(let floor=0;floor<DUNGEON_LAYERS.length;floor++){
  const course=makeDungeonCourse(floor),core=new HorrorPresence({canStand,castRay});
  for(const room of course.rooms){
   const b=room.bounds;if(!b)continue;
   const x=(b.minX+b.maxX)/2,y=(b.minZ+b.maxZ)/2;if(!canStand(course,x,y,.22))continue;
   const r={...fixture(),course,x,y,dungeonProgression:{activeRoomId:room.id}};
   const anchor=core.anchor(r,'strain');if(!anchor)continue;
   const d=Math.hypot(anchor.x-x,anchor.y-y);
   assert.ok(d>=.55&&canStand(course,anchor.x,anchor.y,.22));
   assert.ok(castRay(course,x,y,Math.atan2(anchor.y-y,anchor.x-x),d).dist>=d-.05);
   checked++;
  }
 }
 assert.ok(checked>=20,`checked ${checked} real room placements`);
});
test('a paused co-op host continues the shared phase while its local presentation is quiet',()=>{
 const context=horrorPresentationContext({screen:'pause',connected:true,role:'host'});assert.equal(context.sharedPlaying,true);assert.equal(context.localPlaying,false);
 const r=fixture(),c=new HorrorPresence();c.trigger('witness',r,{force:true});r.time=1;c.update(r,{playing:context.sharedPlaying});assert.equal(c.active.elapsed,1);assert.equal(c.snapshot().enabled,true);
 assert.equal(horrorPresentationContext({screen:'pause',connected:true,role:'guest'}).sharedPlaying,false);
 assert.equal(horrorPresentationContext({screen:'pause'}).sharedPlaying,false);
 assert.equal(horrorPresentationContext({screen:'play',inspecting:true}).sharedPlaying,false);
});
test('a natural recognition callback requires a rhythm already learned in this run',()=>{
 const r=fixture(),c=new HorrorPresence();c.update(r,{playing:true});advance(c,r,12);assert.equal(c.trigger('callback',r),false);
 c.memory={rhythm:[.3,.65],courseKey:'earlier-floor',floor:0};assert.equal(c.trigger('callback',r),true);assert.deepEqual(c.active.rhythm,[.3,.65]);
});
test('accepting a host phase does not immediately count the same snapshot time twice',()=>{
 const r=fixture(),host=new HorrorPresence(),guest=new HorrorPresence();host.trigger('witness',r,{force:true});advance(host,r,1);guest.receive(host.snapshot(),r);
 advance(host,r,.05);guest.receive(host.snapshot(),r);const elapsed=guest.active.elapsed;
 guest.update(r,{playing:true,authoritative:false});assert.equal(guest.active.elapsed,elapsed);
});
test('a guest shot suppresses presentation while preserving the canonical shared actor',()=>{
 const r=fixture(),host=new HorrorPresence(),guest=new HorrorPresence();host.trigger('witness',r,{force:true});advance(host,r,1);guest.receive(host.snapshot(),r);
 r.shot=.4;r.time+=.1;const hidden=guest.update(r,{playing:true,authoritative:false});assert.equal(hidden.enabled,false);assert.equal(hidden.active.id,host.active.id);assert.ok(guest.active.elapsed>1);
 r.shot=0;r.time+=.1;const shown=guest.update(r,{playing:true,authoritative:false});assert.equal(shown.enabled,true);assert.equal(shown.active.id,host.active.id);
});
test('a cuff cannot replace an existing crawl or skip its specific roach lead-in',()=>{
 const r=fixture(),c=new HorrorPresence();r.verminCrawl={phase:'active',kind:'rat',count:1,elapsed:1.2,sequence:9,duration:4.2};const original=JSON.stringify(r.verminCrawl);
 assert.equal(c.trigger('cuff',r,{force:true}),false);assert.equal(JSON.stringify(r.verminCrawl),original);assert.equal(c.active,null);
});
