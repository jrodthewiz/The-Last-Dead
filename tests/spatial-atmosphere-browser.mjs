// Real Chromium audio measurements plus a small in-game lifecycle journey.
// All servers/browser contexts are task-owned; never attach to the player's tab.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=path.resolve('output/playwright/spatial-atmosphere');
await mkdir(output,{recursive:true});

export async function offlineMeasurements(page){
 return page.evaluate(async()=>{
  const {AudioSystem}=await import('/assets/audio.js');
  const rate=44100,library=new AudioSystem({baseUrl:location.origin+'/assets/audio.js'});
  library._ctx=new OfflineAudioContext(2,rate,rate);await library._loadAssets();
  const setup=(seconds=2)=>{
   const ctx=new OfflineAudioContext(2,rate*seconds,rate),audio=new AudioSystem({volume:1});ctx.close=async()=>{};
   audio._ctx=ctx;audio._buffers=new Map(library._buffers);audio._loaded=true;audio._normalizePools();audio._createMixGraph();
   audio.updateListener({x:0,y:0,z:0,forwardX:0,forwardY:0,forwardZ:-1,upX:0,upY:1,upZ:0});
   const probe=ctx.createBuffer(1,rate/2,rate),data=probe.getChannelData(0);let seed=0x31ab7921;
   for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/0xffffffff*2-1)*.18;}
   audio._buffers.set('qa-probe:0',probe);return{ctx,audio};
  };
  function measure(buffer,start=.15,end=1.8){
   const first=Math.round(start*rate),last=Math.min(buffer.length,Math.round(end*rate)),channels=[],n=Math.max(1,last-first);let power=0,peak=0,difference=0;
   for(let c=0;c<2;c++){const data=buffer.getChannelData(c);let sum=0;for(let i=first;i<last;i++){sum+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));if(i>first)difference+=(data[i]-data[i-1])**2;}power+=sum;channels.push(Math.sqrt(sum/n));}
   return{channels,rms:Math.sqrt(power/(n*2)),peak,differenceEnergyRatio:difference/Math.max(1e-20,power)};
  }
  const profile={loop:true,panningModel:'HRTF',rate:1,volume:1,group:'ambience',highpass:0,lowpass:20000,refDistance:1,maxDistance:40,rolloffFactor:1,variant:0};
  const spatial={},waveforms={};
  for(const [name,position,occluded]of [
   ['left',{x:-4,y:0,z:-2},false],['right',{x:4,y:0,z:-2},false],
   ['front',{x:0,y:0,z:-5},false],['back',{x:0,y:0,z:5},false],
   ['near',{x:0,y:0,z:-2},false],['far',{x:0,y:0,z:-14},false],['occluded',{x:0,y:0,z:-14},true],
  ]){
   const {ctx,audio}=setup(),admitted=audio.startSpatialEmitter('probe','qa-probe',{...profile,position,occluded});
   const diagnostics=audio.spatialDiagnostics(),rendered=await ctx.startRendering();spatial[name]={admitted,position,occluded,diagnostics,...measure(rendered)};
   if(name==='front'||name==='back')waveforms[name]=rendered.getChannelData(0);
  }
  let delta=0,reference=0;for(let i=Math.round(.15*rate);i<Math.round(1.8*rate);i++){delta+=(waveforms.front[i]-waveforms.back[i])**2;reference+=waveforms.front[i]**2+waveforms.back[i]**2;}
  spatial.frontBackDifference=Math.sqrt(delta/Math.max(1e-20,reference));
  const motion={};
  for(const kind of ['listener-turn','source-crossing']){
   const {ctx,audio}=setup(),position={x:kind==='listener-turn'?4:-4,y:0,z:-2};
   const admitted=audio.startSpatialEmitter('moving','qa-probe',{...profile,position}),before=audio.spatialDiagnostics();
   const boundary=ctx.suspend(.8),rendering=ctx.startRendering();await boundary;
   let updated=true;if(kind==='listener-turn')audio.updateListener({x:0,y:0,z:0,forwardX:0,forwardY:0,forwardZ:1,upX:0,upY:1,upZ:0});
   else updated=audio.updateSpatialEmitter('moving',{position:{x:4,y:0,z:-2},occluded:false,volume:1});
   const after=audio.spatialDiagnostics();await ctx.resume();const rendered=await rendering;
   motion[kind]={admitted,updated,before,after,early:measure(rendered,.2,.65),late:measure(rendered,1.1,1.7)};
  }
  const cues={};
  for(const [name,cue,extra]of [['wind','ambience',{variant:1,loop:true}],['whisper','secret-whisper',{loop:false}],['rustle','cloth-rustle',{loop:false}]]){
   const {ctx,audio}=setup(4),admitted=audio.startSpatialEmitter('cue',cue,{...extra,position:{x:2,y:0,z:-3},volume:.1,group:'ambience',variant:extra.variant??0,rate:1});
   cues[name]={admitted,diagnostics:audio.spatialDiagnostics(),...measure(await ctx.startRendering(),0,4)};
  }
  const lifecycle={};
  for(const kind of ['mute','pause','stop','dispose']){
   const {ctx,audio}=setup();audio.startSpatialEmitter('owned','qa-probe',{...profile,position:{x:2,y:0,z:-2}});
   const before=audio.spatialDiagnostics();if(kind==='mute')audio.setMuted(true);else if(kind==='pause')audio.pause();else if(kind==='stop')audio.stopSpatialEmitter('owned',{immediate:true});else audio.dispose();
   const after=audio.spatialDiagnostics();lifecycle[kind]={before,after,...measure(await ctx.startRendering())};
  }
  const zero=setup();zero.audio.startSpatialEmitter('zero','qa-probe',{...profile,position:{x:0,y:0,z:-14},occluded:true,volume:0});
  const occludedZero={diagnostics:zero.audio.spatialDiagnostics(),...measure(await zero.ctx.startRendering())};
  const fadeBuffers=[];
  for(const update of [false,true]){
   const {ctx,audio}=setup(),position={x:2,y:0,z:-2};audio.startSpatialEmitter('fade','qa-probe',{...profile,position,fadeIn:.6});
   if(update){const boundary=ctx.suspend(.08),rendering=ctx.startRendering();await boundary;audio.updateSpatialEmitter('fade',{position,occluded:false,volume:1});await ctx.resume();fadeBuffers.push(await rendering);}
   else fadeBuffers.push(await ctx.startRendering());
  }
  let fadeDelta=0,fadeReference=0;
  for(let c=0;c<2;c++){const baseline=fadeBuffers[0].getChannelData(c),updated=fadeBuffers[1].getChannelData(c);for(let i=Math.round(.15*rate);i<Math.round(.7*rate);i++){fadeDelta+=(baseline[i]-updated[i])**2;fadeReference+=baseline[i]**2;}}
  const unchangedFade={baseline:measure(fadeBuffers[0],.15,.7),updated:measure(fadeBuffers[1],.15,.7),normalizedDifference:Math.sqrt(fadeDelta/Math.max(1e-20,fadeReference))};
  const tracked=setup(),trackedSource=tracked.audio._playBuffer(tracked.audio._buffers.get('qa-probe:0'),'enemycharge',0,{...profile,position:{x:0,y:1.4,z:-3},trackKey:'enemy:fixture',trackOffsetY:1.4});
  const trackedPanner=trackedSource?._spatialPanner;tracked.audio.updateTrackedSources(key=>key==='enemy:fixture'?{position:{x:2,y:.25,z:-4}}:null);
  const trackedHeight={admitted:!!trackedSource,pannerRetained:trackedPanner===trackedSource?._spatialPanner,diagnostics:tracked.audio.spatialDiagnostics(),...measure(await tracked.ctx.startRendering())};
  const {ctx,audio}=setup(),admitted=[];for(let i=0;i<7;i++)admitted.push(audio.startSpatialEmitter('budget-'+i,'qa-probe',{...profile,position:{x:1,y:0,z:-2}}));
  const budget=audio.spatialDiagnostics();audio.pause();await ctx.startRendering();
  return{loadErrors:library.loadErrors,decoded:library._buffers.size,spatial,motion,cues,lifecycle,occludedZero,unchangedFade,trackedHeight,budget,admitted};
 });
}

export function verifyOffline(report){
 assert.deepEqual(report.loadErrors,[]);assert(report.decoded>100);
 const s=report.spatial;for(const name of ['left','right','front','back','near','far','occluded'])assert(s[name].admitted&&s[name].peak>1e-6,`${name} creates finite audible waveform energy`);
 assert(s.left.channels[0]>s.left.channels[1]*1.02,'left source favors left channel');assert(s.right.channels[1]>s.right.channels[0]*1.02,'right source favors right channel');
 assert(s.frontBackDifference>.02,'equal-distance front/back produces different HRTF waveform evidence');
 assert(s.far.rms<s.near.rms*.55,'far source attenuates');assert(s.occluded.rms<s.far.rms*.95,'occluded source dampens');assert(s.occluded.differenceEnergyRatio<s.far.differenceEnergyRatio,'occlusion loses high-frequency energy');
 const t=report.motion['listener-turn'],m=report.motion['source-crossing'];assert(t.admitted&&t.early.channels[1]>t.early.channels[0]*1.02&&t.late.channels[0]>t.late.channels[1]*1.02,'listener turning reverses channel emphasis for fixed world source');
 assert(m.admitted&&m.updated&&m.early.channels[0]>m.early.channels[1]*1.02&&m.late.channels[1]>m.late.channels[0]*1.02,'moving emitter reverses channel emphasis');
 for(const [name,cue]of Object.entries(report.cues))assert(cue.admitted&&cue.peak>1e-6&&cue.peak<.95,`${name} bundled cue decodes and renders with headroom`);
 for(const [name,result]of Object.entries(report.lifecycle)){assert(result.peak<1e-5,`${name} prevents retained loop output`);if(name!=='mute')assert.equal(result.after.emitters.length,0,`${name} clears emitter ownership`);}
 assert(report.budget.emitters.length<=4,'keyed emitter ownership is bounded');
 assert(report.occludedZero.peak<1e-5,'occluded explicit volume zero remains silent');
 assert(report.unchangedFade.normalizedDifference<1e-5,'unchanged spatial updates preserve the original gain ramp');
 assert(report.trackedHeight.admitted&&report.trackedHeight.pannerRetained&&report.trackedHeight.peak>1e-6,'tracked actor retains a live panner');assert.deepEqual(report.trackedHeight.diagnostics.tracked[0].position,{x:2,y:1.65,z:-4},'tracked actor movement retains the authored mouth offset');
}

async function journey(rootName){
 const root=path.resolve(rootName==='source'?'.':rootName),variant=rootName==='source'?'source':'built',folder=path.join(output,variant);
 await mkdir(folder,{recursive:true});const server=await startServer({root,port:0,spaFallback:false});let browser,page;
 const files=['main.js','assets/audio.js','assets/audio-manifest.js','spatial-audio.js','room-atmosphere-audio.js','world-setdressing.js'];
 const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));
 const report={status:'RUNNING',root,variant,url:`http://127.0.0.1:${server.port}/?debug=1&horrorqa=1&spatialqa=1&dungeon=1`,errors:[],requests:[],checks:[],stages:[],samples:[],runtimeHashesStart:await hashes(),humanListeningTested:false,physicalControllerTested:false};
 async function receipt(){await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));}
 async function stage(name){report.stages.push({name,at:new Date().toISOString()});await receipt();console.log(JSON.stringify({variant,stage:name}));}
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
  let rejectBoot,booting=true;const failure=new Promise((_,reject)=>{rejectBoot=reject;});failure.catch(()=>{});
  page.on('pageerror',error=>{report.errors.push(error.stack);if(booting)rejectBoot(error);});
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400){const error=new Error(`${response.status()} ${response.url()}`);report.errors.push(error.message);if(booting)rejectBoot(error);}});
  page.on('requestfailed',request=>{const error=new Error(`${request.failure()?.errorText} ${request.url()}`);report.requests.push(error.message);if(booting)rejectBoot(error);});
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  await stage('browser-launched');await page.goto(`http://127.0.0.1:${server.port}/assets/audio.js`);
  if(variant==='source'||process.env.SPATIAL_QA_OFFLINE_ALL==='1'){
   report.offline=await offlineMeasurements(page);verifyOffline(report.offline);await writeFile(path.join(folder,'offline.json'),JSON.stringify(report.offline,null,2));report.checks.push('Real offline HRTF directions, distance, occlusion, listener turn, moving source, bundled cues, controls and ownership cap');await stage('offline-passed');
  }
  async function ready(predicate){try{await Promise.race([page.waitForFunction(predicate,null,{timeout:180000}),failure]);}catch(error){if(error.name!=='TimeoutError'||report.errors.length||report.requests.length||!await page.evaluate(predicate))throw error;(report.startupWarnings??=[]).push('Polling deadline raced actual ready state; continued same error-free context');}}
  await page.goto(report.url,{waitUntil:'domcontentloaded'});await stage('document-loaded');await ready(()=>!!(window.__DEAD_ARRIVAL__&&window.__HORROR_QA__&&window.__SPATIAL_QA__));
  await stage('hooks-ready');await page.locator('[data-action="start"]').click({timeout:180000});await stage('actual-start-clicked');await ready(()=>window.__DEAD_ARRIVAL__?.screen==='play');await ready(()=>window.__DEAD_ARRIVAL__?.audio.debugInfo.loaded);booting=false;await stage('play-entered');report.checks.push('Real Start enters play and unlocks loaded audio');
  const diag=()=>page.evaluate(()=>window.__SPATIAL_QA__.diagnostics());
  async function advance(seconds,input={}){for(let left=seconds;left>0;left-=18)await page.evaluate(({seconds,input})=>{window.__HORROR_QA__.advance(seconds,input);window.__SPATIAL_QA__.refresh();},{seconds:Math.min(18,left),input});}
  async function sample(name,capture=false){const state=await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;window.__SPATIAL_QA__.refresh();return {screen:d.screen,mode:d.run.mode,time:d.run.time,health:d.run.health,player:{x:d.run.x,y:d.run.y,angle:d.run.angle},spatial:window.__SPATIAL_QA__.diagnostics(),mix:d.audio.debugInfo.mix};});state.name=name;
   assert(state.spatial.audio.emitters.length<=4&&new Set(state.spatial.audio.emitters.map(s=>s.id)).size===state.spatial.audio.emitters.length,'unique bounded keyed sources');assert(state.spatial.beds.length<=2);if(capture){state.image=`${name}.png`;await page.screenshot({path:path.join(folder,state.image)});}report.samples.push(state);await receipt();return state;}
  await page.evaluate(()=>{window.__HORROR_QA__.prepare({kind:'witness'});window.__SPATIAL_QA__.reset();});await advance(50);await page.waitForTimeout(100);
  const natural=await sample('natural-room',true);assert(natural.spatial.beds.length>0,'actual nearby world source creates natural wind bed');assert(natural.spatial.counts.whisper>0,'quiet room naturally schedules a rare authored whisper');assert.equal(natural.health,100);report.checks.push('Natural wind/rare whisper originate at existing authored world sources');
  report.windOffsets=await page.evaluate(()=>[...window.__DEAD_ARRIVAL__.audio._spatialEmitters].filter(([,source])=>source.loop).map(([id,source])=>({id,offset:source._spatialProfile.offset,duration:source.buffer.duration})));
  assert(report.windOffsets.length>0&&report.windOffsets.every(source=>Number.isFinite(source.offset)&&source.offset>=0&&source.offset<source.duration),'wind loop offsets are finite and within the actual buffer');
  if(report.windOffsets.length>1)assert(new Set(report.windOffsets.map(source=>source.offset)).size>1,'nearby wind beds have different authored start offsets');report.checks.push('World wind beds use finite per-anchor loop offsets');
  for(const family of ['wind','whisper','rustle']){
   await page.evaluate(async family=>{
    const d=window.__DEAD_ARRIVAL__,s=window.__SPATIAL_QA__,{canStand}=await import('./engine.js');s.reset();
    const sources=s.diagnostics().sources.filter(source=>source.family===family);let chosen=null;
    for(const source of sources){if(family==='whisper'&&d.run.course.rooms?.find(room=>room.id===source.roomId)?.flow?.role==='recovery')continue;for(const [dx,dy]of [[.5,0],[-.5,0],[0,.5],[0,-.5],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]]){const x=source.position.x/4+dx,y=source.position.z/4+dy;if(canStand(d.run.course,x,y)){chosen={source,x,y};break;}}if(chosen)break;}
    if(!chosen)throw new Error(`No walkable authored ${family} source`);Object.assign(d.run,{x:chosen.x,y:chosen.y,vx:0,vy:0,vz:0,speed:0});d.renderer.bodycamMotion?.reset();d.run.angle=Math.atan2(chosen.source.position.z/4-d.run.y,chosen.source.position.x/4-d.run.x);s.refresh();
    if(!s.trigger(family,chosen.source.id))throw new Error(`Actual authored ${family} trigger rejected`);window.__spatialChosen=chosen.source;
   },family);await page.waitForTimeout(100);const state=await sample(`authored-${family}`,family==='rustle');
   const source=await page.evaluate(()=>window.__spatialChosen);assert(state.spatial.audio.emitters.some(e=>e.id===source.id),`${family} retains its keyed source`);assert.equal(state.health,100);report.checks.push(`${family}: actual authored anchor, range, bounded ownership and nondamaging playback`);
   if(family==='wind'){report.nearbyWindOffsets=await page.evaluate(()=>[...window.__DEAD_ARRIVAL__.audio._spatialEmitters].filter(([,source])=>source.loop).map(([id,source])=>({id,offset:source._spatialProfile.offset,duration:source.buffer.duration})));assert(report.nearbyWindOffsets.every(source=>Number.isFinite(source.offset)&&source.offset>=0&&source.offset<source.duration));if(report.nearbyWindOffsets.length>1)assert(new Set(report.nearbyWindOffsets.map(source=>source.offset)).size>1,'nearby admitted wind loops have distinct offsets');}
  }
  const before=await diag();await advance(.5,{turn:1});const turned=await sample('listener-turn');assert(Math.abs(turned.player.angle-report.samples.at(-2).player.angle)>.01,'normal engine turning remains responsive');assert.deepEqual(turned.spatial.sources,before.sources,'authored sources remain in world coordinates');report.checks.push('Listener turn changes player pose while authored emitters stay fixed in world coordinates');
  async function pause(){await page.keyboard.press('Escape');await ready(()=>window.__DEAD_ARRIVAL__.screen==='pause');await page.waitForTimeout(100);const state=await diag();assert.equal(state.audio.emitters.length,0);assert.equal(state.audio.tracked.length,0);}
  async function resume(){await page.locator('[data-action="resume"]').click();await ready(()=>window.__DEAD_ARRIVAL__.screen==='play');await page.evaluate(()=>window.__SPATIAL_QA__.refresh());}
  await pause();await resume();report.checks.push('Actual pause removes keyed/tracked sources; resume rebuilds bounded room ownership');
  await pause();await page.locator('[data-action="settings"]').click();await page.locator('[data-setting="volume"]').evaluate(node=>{node.value='0';node.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('[data-action="close-settings"]').click();await resume();assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.audio.debugInfo.mix.muted),true);
  await pause();await page.locator('[data-action="settings"]').click();await page.locator('[data-setting="volume"]').evaluate(node=>{node.value='.5';node.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('[data-action="close-settings"]').click();await resume();report.checks.push('Actual master settings mute and restore the atmosphere mix');
  report.cycles=[];for(let i=0;i<6;i++){await pause();await resume();const state=await sample(`cycle-${i+1}`);report.cycles.push({emitters:state.spatial.audio.emitters.length,sources:state.spatial.audio.sources,beds:state.spatial.beds.length});}assert(Math.max(...report.cycles.map(s=>s.sources))<=4,'six cycles retain no stopped/faded spatial sources');report.checks.push('Six real pause/resume cycles keep sources unique and bounded');
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.health=0;r.mode='dead';});await advance(.1);await ready(()=>window.__DEAD_ARRIVAL__.screen==='dead');assert.equal((await diag()).audio.emitters.length,0);
  await page.locator('[data-action="restart"]').click({timeout:180000});await ready(()=>window.__DEAD_ARRIVAL__.screen==='play');await sample('retry');report.checks.push('Normal death clears emitters; actual retry rebuilds a fresh bounded room');
  report.runtimeHashesEnd=await hashes();assert.deepEqual(report.runtimeHashesEnd,report.runtimeHashesStart,'tested spatial integration remains unchanged');assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.status='PASS';await stage('passed');
 }catch(error){report.status='FAIL';report.failure=error.stack;await page?.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});throw error;}
 finally{await receipt();await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))){
 const roots=(process.env.SPATIAL_QA_ROOTS||'source').split(','),summary={status:'RUNNING',reports:[]};
 try{for(const root of roots){const r=await journey(root);summary.reports.push({root:r.root,variant:r.variant,status:r.status,checks:r.checks.length,samples:r.samples.length});}summary.status='PASS';}
 catch(error){summary.status='FAIL';summary.failure=error.stack;throw error;}
 finally{await writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));}
}
