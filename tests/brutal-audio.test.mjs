// Render the shipped samples and real mix graph in a separate headless browser.
// No generated/probe waveform replaces the authored counter layers.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {startServer} from '../server.mjs';
import {castRay,validateVerminSnapshot,validateVerminHand,validateVerminCrawl} from '../engine.js';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.BRUTAL_AUDIO_OUTPUT||'output/playwright/brutal-combat';
const references=[
 'C:/Users/wolfk/.codex/skills/threejs-qa-release/SKILL.md',
 'C:/Users/wolfk/.codex/skills/threejs-qa-release/references/qa-release-checklists.md',
 'C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/visual-verification.md',
 'C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/playtest-qa.md',
 'C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/release.md',
 'C:/Users/wolfk/.codex/skills/threejs-audio-generator/SKILL.md',
 'C:/Users/wolfk/.codex/skills/threejs-audio-generator/references/audio-workflows.md',
];
function eventRoutingProof(source){
 const fields=source.match(/^const playerFields=.*\n(?:playerFields\.push.*\n)+/m)?.[0];
 const biteEvents=source.match(/^const BITE_EVENTS=.*$/m)?.[0];
 const spatial=source.match(/^const spatialEvent=[\s\S]*?^\};/m)?.[0];
 const process=source.match(/function processEvents\(\)\{[\s\S]*?\n\}/)?.[0];
 const apply=source.match(/^function applySnapshot\(.*$/m)?.[0];
 assert(fields&&biteEvents&&spatial&&process&&apply,'actual main.js routing functions are available');
 const openCourse=()=>({index:0,w:4,h:4,cells:Array.from({length:16},()=>[0,0,0,0])});
 const hostPlayed=[],run={playerId:'host',x:0,y:0,z:0,angle:0,pitch:0,distance:0,time:0,health:100,course:openCourse(),
  events:[{type:'brutal-start',kind:'chop',playerId:'host',enemyId:42,sequence:1,x:1,y:2,z:.4}],
  peer:{events:[{type:'brutal-contact',kind:'rip',playerId:'peer',enemyId:43,sequence:1,x:2,y:2,z:.4}]}};
 const common={VERMIN_LOCAL_EVENTS:new Set(),BITE_EVENTS:new Set(),ui:{combatEvent(){},toast(){}},renderer:{queueHorrorScare(){}},updateHorrorAudio(){},
  audio:{play:(type,weapon,details)=>{hostPlayed.push({type,weapon,details});return true;},setAmbiencePreset(){}},
  lastStep:0,lastHeartbeat:0,session:{role:'host'},netEvents:[],netEventSeq:0,run,castRay};
 const host=vm.createContext(common);vm.runInContext(`${fields}\n${biteEvents}\n${spatial}\n${process}\nprocessEvents();`,host);
 const forwarded=JSON.parse(JSON.stringify(host.netEvents));
 assert.equal(hostPlayed.filter(e=>e.type.startsWith('brutal-')).length,2);
 assert.deepEqual(forwarded.map(e=>[e.type,e.playerId,e.sequence,e.seq]),[['brutal-start','host',1,1],['brutal-contact','peer',1,2]]);
 assert.equal(run.events.length,0);assert.equal(run.peer.events.length,0);
 const guestPlayed=[],guestRun={playerId:'peer',x:0,y:0,z:0,angle:0,pitch:0,weapon:0,health:100,kills:0,course:openCourse()};
 const guest=vm.createContext({run:guestRun,lastSnapshot:-1,lastNetEvent:-1,screen:'play',VERMIN_LOCAL_EVENTS:new Set(),validateVerminSnapshot,validateVerminHand,validateVerminCrawl,saneSnapshot:()=>true,syncRoomGateCells(){},
  ui:{toast(){}},settings:{autoRun:false},castRay,audio:{play:(type,weapon,details)=>{guestPlayed.push({type,weapon,details});return true;}}});
 vm.runInContext(`${fields}\n${biteEvents}\n${spatial}\n${apply}`,guest);
 const snapshot={seq:1,sectorIndex:0,guest:{health:100,brutal:{phase:'contact',sequence:1,kind:'rip'}},host:{mode:'play',kills:0,brutal:{phase:'recover',kind:'chop',sequence:1}},enemies:[],audioEvents:forwarded};
 guest.snapshot=snapshot;vm.runInContext('applySnapshot(snapshot);',guest);
 const firstDelivery=guestPlayed.length;snapshot.seq=2;vm.runInContext('applySnapshot(snapshot);',guest);
 const duplicateDelivery=guestPlayed.length;
 snapshot.seq=3;snapshot.audioEvents=[{...forwarded[1],seq:3,sequence:2}];vm.runInContext('applySnapshot(snapshot);',guest);
 const nextDelivery=guestPlayed.length;
 assert.equal(firstDelivery,2);assert.equal(duplicateDelivery,2);assert.equal(nextDelivery,3);
 assert.equal(guestRun.brutal.kind,'rip');assert.equal(guestRun.peer.brutal.kind,'chop');
 assert.deepEqual(JSON.parse(JSON.stringify(guestPlayed[0].details.position)),{x:4,y:1.6,z:8});
 assert(source.match(/function begin\(coop=false\)\{\s*audio\.resetCounterCues\(\)/),'new host/solo run clears only counter cue keys');
 assert(apply.includes('if(start){audio.resetCounterCues();'),'new guest run clears counter cue keys');
 // A wall separates the host from this event. The guest is on the event's
 // side of the wall, so the same canonical cue needs different local filters.
 const wallCourse=openCourse();wallCourse.cells[0][1]=1;wallCourse.cells[1][3]=1;
 run.course=wallCourse;run.x=.5;run.y=.5;guestRun.course=wallCourse;guestRun.x=3.5;guestRun.y=.5;
 const query={type:'brutal-contact',kind:'rip',playerId:'peer',enemyId:43,sequence:2,x:2.5,y:.5,z:.4};
 host.query=query;guest.query=query;
 const hostWall=JSON.parse(JSON.stringify(vm.runInContext('spatialEvent(query);',host)));
 const guestWall=JSON.parse(JSON.stringify(vm.runInContext('spatialEvent(query);',guest)));
 const wallSelection={hostOccluded:hostWall.occluded,guestOccluded:guestWall.occluded,canonicalEventMutated:Object.hasOwn(query,'occluded'),
  hostHit:castRay(wallCourse,.5,.5,0,2).dist,guestHit:castRay(wallCourse,3.5,.5,Math.PI,1).dist,position:hostWall.position};
 return{forwarded,hostPlayed:hostPlayed.length,guestFirstDelivery:firstDelivery,guestRepeatDelivery:duplicateDelivery,guestNextDelivery:nextDelivery,
  localCounter:guestRun.brutal,remoteCounter:guestRun.peer.brutal,wallSelection,source:'Executed actual main.js processEvents/applySnapshot/spatialEvent with the production castRay against bounded host/guest fixtures.'};
}
const mainSource=await readFile(new URL('../main.js',import.meta.url),'utf8');
const server=await startServer({root:process.cwd(),port:0,spaFallback:false});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('requestfailed',r=>errors.push(`${r.failure()?.errorText} ${r.url()}`));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
 await page.goto(`http://127.0.0.1:${server.port}/assets/audio.js`);
 const result=await page.evaluate(async()=>{
  const {AudioSystem}=await import('/assets/audio.js'),{BRUTAL_COMBAT_CUES}=await import('/assets/audio-manifest.js');
  const sampleRate=44100,kinds=['chop','twist','rip','pierce'];
  const library=new AudioSystem({baseUrl:location.origin+'/assets/audio.js'});
  library._ctx=new OfflineAudioContext(2,sampleRate,sampleRate);await library._loadAssets();
  const setup=(seconds=3)=>{
   const ctx=new OfflineAudioContext(2,sampleRate*seconds,sampleRate),audio=new AudioSystem({volume:1});
   // OfflineAudioContext has no close(); keep the real manager source cleanup,
   // substituting only that real-time context lifecycle method.
   ctx.close=async()=>{};
   audio._ctx=ctx;audio._buffers=new Map(library._buffers);audio._loaded=true;audio._normalizePools();audio._createMixGraph();
   audio.updateListener({x:0,y:0,z:0,forwardX:0,forwardY:0,forwardZ:-1,upX:0,upY:1,upZ:0});
   return{ctx,audio};
  };
  const measure=buffer=>{
   let peak=0,power=0,active=0,lastActive=-1,differencePower=0;const channels=[];
   for(let c=0;c<buffer.numberOfChannels;c++){
    const data=buffer.getChannelData(c);let channelPower=0;
    for(let i=0;i<data.length;i++){
     const value=data[i];peak=Math.max(peak,Math.abs(value));channelPower+=value*value;
     if(Math.abs(value)>1e-5){active++;lastActive=Math.max(lastActive,i);}
     if(i){const delta=value-data[i-1];differencePower+=delta*delta;}
    }
    power+=channelPower;channels.push(Math.sqrt(channelPower/data.length));
   }
   const rms=Math.sqrt(power/(buffer.length*buffer.numberOfChannels));
   return{peak,peakDb:20*Math.log10(Math.max(1e-9,peak)),rms,rmsDb:20*Math.log10(Math.max(1e-9,rms)),
    channels,activeSamples:active,lastActiveSeconds:lastActive/sampleRate,differenceEnergyRatio:differencePower/Math.max(1e-20,power)};
  };
  const details=(kind,sequence=1,extra={})=>({kind,playerId:'host',enemyId:42,sequence,...extra});
  const cues={};
  for(const kind of kinds)for(const name of ['brutal-start','brutal-contact']){
   const {ctx,audio}=setup(),played=audio.play(name,0,details(kind,1,{delay:.2})),sources=[...audio._sources];
   cues[`${kind}:${name}`]={played,sources:sources.length,looped:sources.some(s=>s.loop),...measure(await ctx.startRendering())};
  }
  for(const name of ['brutal-extract','brutal-release']){
   const {ctx,audio}=setup(),played=audio.play(name,0,details('pierce',3,{delay:.2})),sources=[...audio._sources];
   cues[`pierce:${name}`]={played,sources:sources.length,looped:sources.some(s=>s.loop),...measure(await ctx.startRendering())};
  }
  const mixes={};
  // Fire is a nearby teammate's report while the local action owns its hands.
  for(const kind of kinds)for(const weapon of [0,1,4,5]){
   const {ctx,audio}=setup();audio.play('ambience',0,{variant:0});
   audio.play('brutal-start',0,details(kind,1,{delay:.4}));audio.play('brutal-contact',0,details(kind,1,{delay:.65}));
   if(kind==='pierce'){audio.play('brutal-extract',0,details(kind,1,{delay:1.09}));audio.play('brutal-release',0,details(kind,1,{delay:1.36}));}
   const shots=[audio.play('shot',weapon,{delay:.65,variant:0,cooldown:0,sequence:1}),audio.play('shot',weapon,{delay:.83,variant:1,cooldown:0,sequence:2})];
   mixes[`${kind}:weapon${weapon}`]={shots,...measure(await ctx.startRendering())};
  }
  const controls={};
  for(const control of ['master','mute','sfx','paused']){
   const {ctx,audio}=setup(),queued=[];
   for(const [i,kind]of kinds.entries()){
    queued.push(audio.play('brutal-start',0,details(kind,i+1,{delay:.75+i*.6})));
    queued.push(audio.play('brutal-contact',0,details(kind,i+1,{delay:.98+i*.6})));
   }
   if(control==='master')audio.setVolume(0);
   if(control==='mute')audio.setMuted(true);
   if(control==='sfx')audio.setGroupVolume('sfx',0);
   if(control==='paused')audio.pause();
   const admitted=audio.play('brutal-contact',0,details('rip',99,{delay:2.3}));
   controls[control]={queued,admitted,...measure(await ctx.startRendering())};
  }
  const duplicate=setup(),d=details('rip',7,{delay:.2});
  const firstStart=duplicate.audio.play('brutal-start',0,d),firstContact=duplicate.audio.play('brutal-contact',0,d),afterFirst=duplicate.audio._sources.size;
  const repeatStart=duplicate.audio.play('brutal-start',0,d),repeatContact=duplicate.audio.play('brutal-contact',0,d),afterRepeat=duplicate.audio._sources.size;
  const second=duplicate.audio.play('brutal-contact',0,{...d,sequence:8,delay:1.1}),afterSecond=duplicate.audio._sources.size;
  const peer=duplicate.audio.play('brutal-contact',0,{...d,playerId:'peer',delay:1.8});
  const dedup={firstStart,firstContact,repeatStart,repeatContact,afterFirst,afterRepeat,second,afterSecond,peer,...measure(await duplicate.ctx.startRendering())};
  const reset=setup(),resetDetails=details('chop',1,{delay:.2});
  const resetFirst=reset.audio.play('brutal-contact',0,resetDetails);
  reset.audio.pause();reset.audio._paused=false; // Resume the manager while the offline context remains schedulable.
  const afterPause=reset.audio.play('brutal-contact',0,resetDetails);
  reset.audio._lastPlay.set('injury:sentinel',17);reset.audio.resetCounterCues();
  const sentinelPreserved=reset.audio._lastPlay.get('injury:sentinel')===17;
  const replay=reset.audio.play('brutal-contact',0,{...resetDetails,delay:1});
  const restart={first:resetFirst,afterPause,sentinelPreserved,replay,...measure(await reset.ctx.startRendering())};
  const pressure=setup();
  for(let sequence=1;sequence<=600;sequence++)pressure.audio.play('brutal-contact',0,details('chop',sequence,{delay:1}));
  const budget={ledger:pressure.audio._lastPlay.size,sources:pressure.audio._sources.size};pressure.audio.pause();
  await pressure.ctx.startRendering();
  const spatial={};
  for(const [name,position,occluded]of [
   ['right',{x:5,y:0,z:-2},false],['left',{x:-5,y:0,z:-2},false],
   ['far',{x:18,y:0,z:-2},false],['occluded',{x:18,y:0,z:-2},true],
  ]){
   const {ctx,audio}=setup();const played=audio.play('brutal-contact',0,details('rip',1,{delay:.2,position,occluded}));
   spatial[name]={played,position,occluded,...measure(await ctx.startRendering())};
  }
  const cleanup=setup();cleanup.audio.play('brutal-start',0,details('rip',1,{delay:.3}));
  cleanup.audio.play('brutal-contact',0,details('rip',1,{delay:.7}));
  const beforeDispose=cleanup.audio._sources.size;cleanup.audio.dispose();
  const afterDispose=cleanup.audio._sources.size,postDispose=cleanup.audio.play('brutal-contact',0,details('rip',2));
  return{sampleRate,loadErrors:library.loadErrors,loadedSamples:library._assetCount,manifestLayers:Object.fromEntries(Object.entries(BRUTAL_COMBAT_CUES).map(([name,layers])=>[name,layers.length])),
   cues,mixes,controls,dedup,restart,budget,spatial,cleanup:{beforeDispose,afterDispose,postDispose},
   boundaries:['Audibility means measured waveform energy, not a human listening verdict.','Real-time gesture unlock, UI wiring, in-game wall occlusion selection, restart epochs, and mobile output devices are covered by separate gameplay QA.']};
 });
 const checks=[],check=(name,verify)=>{try{verify();checks.push({name,result:'PASS'});}catch(error){checks.push({name,result:'FAIL',reason:error.message});}};
 check('all bundled samples decode without browser errors',()=>{assert.deepEqual(result.loadErrors,[]);assert.deepEqual(errors,[]);});
 for(const [key,cue]of Object.entries(result.cues)){
  const [kind,name]=key.split(':');
  check(`${key} is audible, layered, bounded, and retains headroom`,()=>{
   const layer=name==='brutal-start'?'start':name==='brutal-extract'?kind+'-extract':name==='brutal-release'?kind+'-release':kind;
   assert(cue.played&&cue.peak>.001);assert.equal(cue.sources,result.manifestLayers[layer]);
   assert(!cue.looped);assert(cue.peak<.95);assert(cue.lastActiveSeconds<1.3);
  });
 }
 for(const [name,mix]of Object.entries(result.mixes))check(`${name} fire + counter + ambience peak below .95`,()=>{assert(mix.shots.every(Boolean));assert(mix.peak>.001&&mix.peak<.95);});
 for(const [name,control]of Object.entries(result.controls))check(`${name} silences scheduled counter layers`,()=>{assert(control.queued.every(Boolean));assert(control.peak<1e-5);if(name==='paused')assert.equal(control.admitted,false);});
 check('canonical duplicate admits no voices; second sequence and peer identity are admitted',()=>{
  const d=result.dedup;assert(d.firstStart&&d.firstContact);assert.equal(d.repeatStart,false);assert.equal(d.repeatContact,false);
  assert.equal(d.afterRepeat,d.afterFirst);assert(d.second&&d.peer);assert.equal(d.afterSecond-d.afterFirst,result.manifestLayers.rip);
 });
 check('pause preserves dedup while new-run reset admits identical canonical replay',()=>{
  const r=result.restart;assert(r.first);assert.equal(r.afterPause,false);assert(r.sentinelPreserved&&r.replay&&r.peak>.001);
 });
 check('long-session dedup ledger and per-event voices stay bounded',()=>{assert(result.budget.ledger<=512);assert(result.budget.sources<=6);});
 check('remote counter has stereo direction, distance attenuation, and occlusion damping',()=>{
  const s=result.spatial;assert(Object.values(s).every(c=>c.played&&c.peak>1e-5));
  assert(s.right.channels[1]>s.right.channels[0]*1.02);assert(s.left.channels[0]>s.left.channels[1]*1.02);
  assert(s.far.rms<s.right.rms*.5);assert(s.occluded.rms<s.far.rms*.95);
  assert(s.occluded.differenceEnergyRatio<s.far.differenceEnergyRatio);
 });
 check('disposal clears counter sources and rejects subsequent events',()=>{assert(result.cleanup.beforeDispose>0);assert.equal(result.cleanup.afterDispose,0);assert.equal(result.cleanup.postDispose,false);});
 check('host forwards both counter cues and guest snapshots deliver each net sequence once',()=>{
  result.eventRouting=eventRoutingProof(mainSource);
 });
 check('actual counter wall selection differs per listener without mutating the canonical event',()=>{
  const wall=result.eventRouting.wallSelection;assert.equal(wall.hostOccluded,true);assert.equal(wall.guestOccluded,false);
  assert.equal(wall.canonicalEventMutated,false);assert.equal(wall.hostHit,.5);assert.equal(wall.guestHit,1);
  assert.deepEqual(wall.position,{x:10,y:1.6,z:2});
 });
 result.status=checks.every(check=>check.result==='PASS')?'PASS':'FAIL';result.checks=checks;result.browserErrors=errors;
 result.generatedAt=new Date().toISOString();result.url=`http://127.0.0.1:${server.port}/assets/audio.js`;
 result.referenceLedger=references.map(path=>({loaded:true,path,failureReason:null}));
 await mkdir(output,{recursive:true});await writeFile(`${output}/audio.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify({status:result.status,checks:checks.length,failed:checks.filter(c=>c.result==='FAIL'),maxMixPeak:Math.max(...Object.values(result.mixes).map(m=>m.peak)),spatial:result.spatial,artifact:`${output}/audio.json`},null,2));
 assert.equal(result.status,'PASS','offline counter audio checks');
}finally{
 await browser?.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));
}
