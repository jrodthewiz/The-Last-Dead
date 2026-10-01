// Fresh Chrome contexts and ephemeral ports only: the player's tab and 5200
// server are deliberately outside this harness's ownership.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.HORROR_QA_OUTPUT||'output/playwright/horror-presence';
const roots=(process.env.HORROR_QA_ROOTS||'source,dist').split(',');
const summary={status:'RUNNING',reports:[]};
await mkdir(output,{recursive:true});

async function runJourney(rootName){
 const root=path.resolve(rootName==='source'?'.':rootName);
 const folder=path.join(output,rootName==='source'?'source':'built');
 await mkdir(folder,{recursive:true});
 const server=await startServer({root,port:0,spaFallback:false});
 const report={status:'RUNNING',root,url:`http://127.0.0.1:${server.port}/?debug=1&horrorqa=1&dungeon=1`,viewport:{width:1280,height:720},errors:[],errorDetails:[],requestFailures:[],checks:[],views:[],stages:[],physicalControllerTested:false,humanFearTested:false};
 const runtimeFiles=['main.js','renderer.js','engine.js','horror-presence.js','horror-presence-audio.js','horror-encounter-visuals.js','horror-cuff-visuals.js','assets/audio.js'];
 async function runtimeHashes(){return Object.fromEntries(await Promise.all(runtimeFiles.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));}
 report.runtimeHashesStart=await runtimeHashes();
 let browser,page;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  const context=await browser.newContext({viewport:report.viewport});
  page=await context.newPage();page.setDefaultTimeout(45000);
  let rejectBoot,booting=true;
  const bootFailure=new Promise((_,reject)=>{rejectBoot=reject;});bootFailure.catch(()=>{});
  page.on('pageerror',error=>{report.errors.push(error.message);report.errorDetails.push(error.stack);if(booting)rejectBoot(error);});
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400){const error=new Error(`${response.status()} ${response.url()}`);report.errors.push(error.message);if(booting)rejectBoot(error);}});
  page.on('requestfailed',request=>{const error=new Error(`${request.failure()?.errorText} ${request.url()}`);report.requestFailures.push(error.message);if(booting)rejectBoot(error);});
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  async function stage(name){report.stages.push({name,at:new Date().toISOString()});await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({root:rootName,stage:name}));}
  async function ready(predicate,name){
   try{await Promise.race([page.waitForFunction(predicate,null,{timeout:180000}),bootFailure]);}
   catch(error){
    // Compilation can delay a polling result while the real UI has already
    // become usable. Retain that latency and exercise the loaded context.
    if(error.name!=='TimeoutError'||report.errors.length||report.requestFailures.length||!await page.evaluate(predicate))throw error;
    (report.startupWarnings??=[]).push(`${name}: polling exceeded 180s; actual state was ready and error-free at the limit`);
   }
  }
  await stage('browser-launched');
  await Promise.race([page.goto(report.url,{waitUntil:'domcontentloaded'}),bootFailure]);await stage('document-loaded');
  await ready(()=>!!(window.__DEAD_ARRIVAL__?.renderer&&window.__HORROR_QA__),'hooks-ready');await stage('hooks-ready');
  await page.locator('[data-action="start"]').click();
  await stage('actual-start-clicked');
  await ready(()=>window.__DEAD_ARRIVAL__?.screen==='play','play-entered');await stage('play-entered');
  await Promise.race([page.waitForFunction(()=>window.__DEAD_ARRIVAL__.audio.debugInfo.loaded),bootFailure]);booting=false;
  report.checks.push('Clean load, actual Start button, renderer warmup and user-gesture audio unlock');
  console.log(JSON.stringify({root:rootName,checkpoint:'started-and-unlocked'}));

  await page.evaluate(()=>{
   const d=window.__DEAD_ARRIVAL__,play=d.audio.play.bind(d.audio);window.__horrorAudioLog=[];window.__horrorRealShots=0;
   d.audio.play=(type,weapon,details)=>{
    const admitted=play(type,weapon,details);
    if(type==='shot'&&admitted)window.__horrorRealShots++;
    if(String(details?.id).startsWith('presence-')||String(type).startsWith('horror-')||String(type).startsWith('presence-')){
     window.__horrorAudioLog.push({type,admitted,at:d.run.time,details});
     if(window.__horrorAudioLog.length>256)window.__horrorAudioLog.shift();
    }
    return admitted;
   };
  });

  async function diagnostics(){return page.evaluate(()=>window.__HORROR_QA__.diagnostics());}
  async function advance(seconds,input={}){return page.evaluate(({seconds,input})=>window.__HORROR_QA__.advance(seconds,input),{seconds,input});}
  async function trigger(kind,options={}){return page.evaluate(({kind,options})=>window.__HORROR_QA__.trigger(kind,options),{kind,options});}
  async function reset(){return page.evaluate(()=>window.__HORROR_QA__.reset());}
  async function prepare(kind='witness',natural=false){return page.evaluate(({kind,natural})=>{
   const fixture=window.__HORROR_QA__.prepare({kind,natural}),d=window.__DEAD_ARRIVAL__;
   // A fresh stationary fixture must not inherit momentum from the preceding
   // normal-movement inspection or real-input journey.
   Object.assign(d.run,{vx:0,vy:0,vz:0,speed:0});d.renderer.bodycamMotion?.reset();d.renderer.render(d.run,performance.now());return fixture;
  },{kind,natural});}
  async function changeSettings(values){
   if(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen==='play'))await page.keyboard.press('Escape');
   await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');
   await page.locator('[data-action="settings"]').click();
   for(const [name,value]of Object.entries(values)){
    const control=page.locator(`[data-setting="${name}"]`);
    if(typeof value==='boolean'){
     if(await control.isChecked()!==value)await page.locator(`label:has([data-setting="${name}"])`).click({timeout:15000});
     assert.equal(await control.isChecked(),value,`${name} setting toggles through its visible label`);
    }
    else await control.evaluate((node,value)=>{node.value=String(value);node.dispatchEvent(new Event('input',{bubbles:true}));},value);
   }
   await page.locator('[data-action="close-settings"]').click();
   await page.locator('[data-action="resume"]').click();
   await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
  }
  async function sample(name,{capture=true}={}){
   const data=await page.evaluate(async name=>{
    const d=window.__DEAD_ARRIVAL__,r=d.renderer.renderer,info=r.info,autoReset=info.autoReset;
    const {Vector3,Box3}=await import('./vendor/three.module.js'),{castRay}=await import('./engine.js');
    info.autoReset=false;info.reset();d.renderer.render(d.run,performance.now());
    const gl=r.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let n=0,lit=0,sum=0,sum2=0;for(let i=0;i<pixels.length;i+=64){const value=(pixels[i]+pixels[i+1]+pixels[i+2])/765;n++;sum+=value;sum2+=value*value;if(value>.015)lit++;}
    const canvas=d.renderer.canvas||document.querySelector('#world');
    const horror=window.__HORROR_QA__.diagnostics(),actor=d.renderer.horrorEncounters?.root,ancestors=[];
    for(let node=actor;node;node=node.parent)ancestors.push({name:node.name,type:node.type,visible:node.visible});
    const position=d.renderer.camera.getWorldPosition(new Vector3()),forward=d.renderer.camera.getWorldDirection(new Vector3());
    let lineOfSight=null,projectedBox=null,anchorNdc=null;
    if(horror.active){const a=horror.active.anchor,angle=Math.atan2(a.y-d.run.y,a.x-d.run.x),distance=Math.hypot(a.x-d.run.x,a.y-d.run.y);lineOfSight={distance,wallDistance:castRay(d.run.course,d.run.x,d.run.y,angle,distance+.1).dist};anchorNdc=new Vector3(a.x*4,1.2,a.y*4).project(d.renderer.camera).toArray();}
    if(actor&&actor.visible){const box=new Box3().setFromObject(actor);projectedBox=[box.min.clone().project(d.renderer.camera).toArray(),box.max.clone().project(d.renderer.camera).toArray()];}
    const result={name,screen:d.screen,mode:d.run.mode,time:d.run.time,health:d.run.health,energy:d.run.energy,weapon:d.run.weapon,player:{x:d.run.x,y:d.run.y,angle:d.run.angle,pitch:d.run.pitch},horror,audio:d.audio.debugInfo,visualProof:{camera:position.toArray(),forward:forward.toArray(),ancestors,lineOfSight,anchorNdc,projectedBox},
     renderer:{calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,fps:d.fps},canvas:{display:[canvas.clientWidth,canvas.clientHeight],drawingBuffer:[w,h],litFraction:lit/n,mean:sum/n,variance:sum2/n-(sum/n)**2}};
    info.autoReset=autoReset;return result;
   },name);
   assert(data.canvas.display.every(value=>value>0)&&data.canvas.drawingBuffer.every(value=>value>0),'visible canvas dimensions');
   assert(data.canvas.litFraction>.02&&data.canvas.variance>.00005,`${name}: nonblank, varied game pixels`);
   if(capture){await page.screenshot({path:path.join(folder,`${name}.png`)});data.image=`${name}.png`;}
   report.views.push(data);await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));return data;
  }

  // Establish the behavior using real keyboard input before isolated captures.
  await prepare('answering');await advance(12);
  await page.evaluate(async()=>{
   const d=window.__DEAD_ARRIVAL__,{castRay}=await import('./engine.js');
   const angles=Array.from({length:32},(_,i)=>i*Math.PI/16);
   d.run.angle=angles.sort((a,b)=>castRay(d.run.course,d.run.x,d.run.y,b,8).dist-castRay(d.run.course,d.run.x,d.run.y,a,8).dist)[0];
   window.__horrorMoveStart=d.run.distance;window.__HORROR_QA__.setManual(false);
  });
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.distance>window.__horrorMoveStart+1.3,null,{timeout:90000});
  await page.keyboard.up('w');
  await page.waitForFunction(()=>window.__HORROR_QA__.diagnostics().active?.kind==='answering',null,{timeout:90000});
  await page.evaluate(()=>window.__HORROR_QA__.setManual(true));
  const learned=await diagnostics();assert(learned.memory.rhythm.length>=2,'the answering wall learns actual player footfall timing');
  const natural=await sample('00-natural-answering');await advance(2.5);
  const naturalAudio=await diagnostics();assert(naturalAudio.audio.played>=3,'natural answering dispatches its audible reply');
  assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.health),100);
  report.natural={learnedRhythm:learned.memory.rhythm,at:natural.time,audio:naturalAudio.audio};
  report.checks.push('Real W movement and stop naturally produce a learned-rhythm answering wall without a developer trigger');
  console.log(JSON.stringify({root:rootName,checkpoint:'natural-answering',rhythm:learned.memory.rhythm}));

  const cases=[
   {kind:'answering',times:[.3,1.9,7.4]},
   {kind:'approach',times:[.1,2.9,6.2]},
   {kind:'witness',times:[.6,1.9,3.5,9.2]},
   {kind:'transfer',times:[.6,2.3,4.4,8.2]},
   {kind:'strain',times:[.6,3.2,5.6,8.2]},
   {kind:'callback',times:[.6,1.925,2.385,9.2]},
   {kind:'table',times:[.6,.785,1.525,9.2]},
   {kind:'cuff',times:[.6,2.1,3.2,7.4]}
  ];
  for(const {kind,times}of cases){
   const fixture=await prepare(kind);assert(fixture&&fixture.anchor,`${kind}: walkable anchored fixture`);
   const before=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;return {health:r.health,weapon:r.weapon,shots:r.shotSequence,x:r.x,y:r.y,angle:r.angle};});
   assert.equal(await trigger(kind,{anchor:fixture.anchor,rhythm:[.31,.74,.46]}),true,`${kind} admitted`);
   assert.equal(await trigger('witness'),false,'a second major beat cannot overlap');
   let previous=0;
   for(const time of times){
    await advance(time-previous);previous=time;
    const state=await sample(`${kind}-${String(time).replace('.','_')}s`);
    assert.equal(state.health,before.health,`${kind} never damages the player`);
    assert.equal(state.weapon,before.weapon,`${kind} never changes the weapon`);
    assert(Math.hypot(state.player.x-before.x,state.player.y-before.y)<.01,`${kind} never moves the player`);
    const h=state.horror;
    assert(h.pending<=16&&h.history.length<=16&&h.audio.ownedVoices<=3,'bounded cues, history and presence voices');
    if(time===times.at(-1)){
     assert.equal(h.active,null,`${kind} releases after its duration`);
     assert(h.recovery>20&&h.cooldown>60,'a major beat gives a real recovery interval');
     assert.equal(h.visuals?.visible,false,'world actor restored');assert.equal(h.cuff?.movedVertices,0,'sleeve restored');
    }else{
     assert.equal(h.active?.kind,kind,`${kind} remains the canonical active sequence`);
     if(['witness','transfer','strain','callback','table'].includes(kind))assert.equal(h.visuals?.visible,true,'authored encounter geometry rendered');
     if(kind==='witness'&&time===1.9)assert(Math.abs(h.visuals.torsoYaw-h.visuals.headYaw)>.04,'deliberate local head/torso timing mismatch');
     if(kind==='transfer'&&time===2.3)assert(h.visuals.residue>.5&&h.visuals.filamentLength>0,'visible contact transfer and tether');
     if(kind==='strain'&&time===3.2)assert(h.visuals.compression>0&&h.visuals.deformedVertices>0,'actual cloned skin deforms at contact');
     if(kind==='table'&&time===1.525)assert(h.visuals.tableLift>.04,'sheet rises at an actual rhythmic peak');
     if(kind==='callback'&&time===1.925)assert(h.visuals.rhythmPulse>.8,'fingers reproduce the actual callback cue peak');
     if(kind==='cuff'&&time>.6){assert.equal(h.cuff.status,'active');assert(h.cuff.movedVertices>0&&h.cuff.maxDisplacementMeters>0&&h.cuff.maxDisplacementMeters<=.00601,'bounded deformation of actual sleeve');}
    }
   }
   if(['strain','transfer'].includes(kind)){
    await prepare(kind);await trigger(kind,{anchor:fixture.anchor,rhythm:[.31,.74,.46]});await advance(kind==='strain'?3.2:2.3);
    await advance(.23,{forward:1});const close=await sample(`${kind}-contact-inspection`);
    assert.equal(close.health,100);assert(close.visualProof.lineOfSight.distance<1.1,'player can approach and inspect contact without a forced camera');
   }
   report.checks.push(`${kind}: timed visible/audio phases, no hidden damage or player displacement, overlap prevention and clean recovery`);
   console.log(JSON.stringify({root:rootName,checkpoint:kind}));
  }

  await prepare('cuff');await trigger('cuff');await advance(2.1);const prePause=await diagnostics();
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');
  await advance(3);await page.waitForTimeout(150);const paused=await diagnostics();
  assert.equal(paused.clock,prePause.clock);assert.equal(paused.active.elapsed,prePause.active.elapsed);assert.equal(paused.audio.ownedVoices,0);
  assert.equal(paused.cuff.movedVertices,0);await sample('lifecycle-paused');
  await page.locator('[data-action="resume"]').click();await advance(.15);const resumed=await sample('lifecycle-resumed');
  assert(resumed.horror.active.elapsed>prePause.active.elapsed&&resumed.horror.cuff.movedVertices>0,'resume restores the same bounded sleeve sequence');
  report.checks.push('Actual Escape/resume freezes canonical clocks, stops presence audio, restores geometry, and resumes from the frozen phase');

  await changeSettings({gore:false,reducedMotion:true});await prepare('cuff');await trigger('cuff');await advance(2.1);
  const reduced=await sample('settings-cuff-reduced-motion-gore-off');
  assert.equal(reduced.horror.cuff.reducedMotion,true);assert(reduced.horror.cuff.maxDisplacementMeters<=.00251);
  const fold=reduced.horror.cuff.foldPathFraction;await advance(1.1);assert.equal((await diagnostics()).cuff.foldPathFraction,fold,'reduced motion uses a stationary fold');
  await prepare('transfer');await trigger('transfer');await advance(2.3);const clean=await sample('settings-transfer-gore-off');assert.equal(clean.horror.settings.gore,false);assert(clean.horror.visuals.residue>0);
  await prepare('cuff');await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.playerWounds.rightArm='severed');assert.equal(await trigger('cuff'),false,'no cuff sequence on a missing source arm');
  report.checks.push('Actual settings controls: reduced-motion static fold <=2.5mm, gore-off contact residue, missing-arm suppression');

  await changeSettings({volume:0,gore:true,reducedMotion:false});await prepare('approach');await trigger('approach');await advance(3);
  const muted=await diagnostics();assert.equal(muted.audio.played,0);assert.equal(muted.audio.ownedVoices,0);assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.audio.debugInfo.mix.muted),true);
  await changeSettings({volume:.5});report.checks.push('Actual master-volume control mutes all new presence voices while the cosmetic sequence remains nondamaging');

  await prepare('witness');await trigger('witness');await advance(1);
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.health=0;r.mode='dead';});await advance(.01);
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='dead');const dead=await diagnostics();assert.equal(dead.active,null);assert.equal(dead.audio.ownedVoices,0);
  await page.locator('[data-action="restart"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
  const restarted=await diagnostics();assert.equal(restarted.active,null);assert.deepEqual(restarted.memory.rhythm,[]);assert.equal(restarted.audio.ownedVoices,0);await sample('lifecycle-restart');
  report.checks.push('Death cancels the sequence; actual retry starts with no retained memory, actors or owned voices');

  await prepare('witness');await trigger('witness');await advance(1);
  const moved=await page.evaluate(()=>{const q=window.__HORROR_QA__,r=window.__DEAD_ARRIVAL__.run,before={x:r.x,y:r.y,angle:r.angle};q.advance(.15,{forward:1});return {distance:Math.hypot(r.x-before.x,r.y-before.y),health:r.health};});
  assert(moved.distance>.01&&moved.health===100,'movement stays responsive during the encounter');
  await page.evaluate(()=>window.__HORROR_QA__.setManual(false));
  const shots=await page.evaluate(()=>window.__horrorRealShots);await page.mouse.click(640,360);await page.mouse.down();
  await page.waitForFunction(shots=>window.__horrorRealShots>shots,shots,{timeout:15000});await page.mouse.up();await page.evaluate(()=>window.__HORROR_QA__.setManual(true));
  assert.equal((await diagnostics()).active,null,'actual firing cancels cosmetic presentation for combat clarity');
  report.actualFire=await page.evaluate(shots=>({shotsBefore:shots,shotsAfter:window.__horrorRealShots,weapon:window.__DEAD_ARRIVAL__.run.weapon,shot:window.__DEAD_ARRIVAL__.run.shot}),shots);
  report.checks.push('Movement remains authoritative during a cue; actual mouse fire still shoots and cancels presentation for combat');

  await prepare('strain');await trigger('strain');await advance(3.2);const warmed=await sample('resources-warmed',{capture:false});
  report.resources=[];
  for(let i=0;i<12;i++){
   await prepare(i%2?'cuff':'strain');await trigger(i%2?'cuff':'strain');await advance(i%2?3.2:3.2);await advance(10);
   const data=await sample(`resource-cycle-${i+1}`,{capture:false});report.resources.push(data.renderer);
   assert(data.horror.history.length<=16&&data.horror.pending<=16&&data.horror.audio.ownedVoices===0);
  }
  const final=report.resources.at(-1);assert(final.geometries<=warmed.renderer.geometries+2&&final.textures<=warmed.renderer.textures+1,'repeated cues do not grow renderer resources');
  report.checks.push('Twelve repeated world/cuff lifecycle cycles keep queues, voices, geometries and textures bounded');

  for(const viewport of [{width:960,height:540},{width:390,height:844}]){
   await page.setViewportSize(viewport);await prepare('witness');await trigger('witness');await advance(1.9);await sample(`viewport-${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize(report.viewport);

  if(rootName==='source'&&process.env.HORROR_QA_SOAK==='1'){
   await prepare('answering',true);const started=Date.now(),initial=await page.evaluate(()=>({time:window.__DEAD_ARRIVAL__.run.time,shots:window.__horrorRealShots,distance:window.__DEAD_ARRIVAL__.run.distance}));report.soak=[];report.soakInitial=initial;
   for(let i=0;i<8;i++){
    if(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen!=='play')){await page.locator('[data-action="restart"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await prepare('answering',true);}
    await page.keyboard.down(i%2?'s':'w');await page.keyboard.down('ArrowRight');await page.waitForTimeout(350);await page.keyboard.up('ArrowRight');await page.keyboard.press('Space');await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();await page.keyboard.up(i%2?'s':'w');
    await page.waitForTimeout(14500);report.soak.push(await diagnostics());
   }
   report.soakElapsedMs=Date.now()-started;report.soakFinal=await page.evaluate(()=>({time:window.__DEAD_ARRIVAL__.run.time,shots:window.__horrorRealShots,distance:window.__DEAD_ARRIVAL__.run.distance}));
   assert(report.soakElapsedMs>=120000&&report.soakFinal.time>initial.time+10&&report.soakFinal.shots>initial.shots,'two minutes exercise live simulation and actual input');await sample('live-journey-final');
   report.checks.push('Two-minute live simulation journey with real movement, aim, jumping, shooting and authored cue scheduling');
  }

  report.audioLog=await page.evaluate(()=>window.__horrorAudioLog);assert.deepEqual(report.errors,[]);assert.deepEqual(report.requestFailures,[]);
  report.runtimeHashesEnd=await runtimeHashes();report.changedRuntimeFiles=runtimeFiles.filter(file=>report.runtimeHashesStart[file]!==report.runtimeHashesEnd[file]);
  assert(report.changedRuntimeFiles.every(file=>!['main.js','horror-presence.js','horror-presence-audio.js','horror-encounter-visuals.js','horror-cuff-visuals.js'].includes(file)),'horror integration bytes remain stable during accepted QA');
  const frames=report.views.filter(view=>view.image);
  await writeFile(path.join(folder,'frames.html'),`<!doctype html><meta charset="utf-8"><title>Horror presence QA frames</title><style>body{background:#141414;color:#eee;font:14px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0}img{width:100%;display:block}figcaption{padding:8px 0}</style><h1>Horror presence: actual captured frames</h1><p>Source: ${rootName}. Chronological frames from each isolated sequence; state and timings are recorded in report.json.</p><main>${frames.map(frame=>`<figure><a href="${frame.image}"><img src="${frame.image}"></a><figcaption>${frame.name}</figcaption></figure>`).join('')}</main>`);
  report.status='PASS';console.log(JSON.stringify({root:rootName,status:report.status,checks:report.checks.length,views:frames.length,resources:final}));
 }catch(error){
  report.status='FAIL';report.failure=error.stack;
  report.failureState=await page?.evaluate(()=>({documentReady:document.readyState,screen:window.__DEAD_ARRIVAL__?.screen,mode:window.__DEAD_ARRIVAL__?.run?.mode,rendererPresent:!!window.__DEAD_ARRIVAL__?.renderer,qaPresent:!!window.__HORROR_QA__,preparationStage:window.__DEAD_ARRIVAL__?.renderer?._preparationStage})).catch(()=>null);
  await page?.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});
  throw error;
 }finally{
  await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2));summary.reports.push({root,status:report.status,checks:report.checks.length,views:report.views.length,failure:report.failure});
  await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));
 }
}

try{
 for(const rootName of roots)await runJourney(rootName);
 summary.status='PASS';
}catch(error){summary.status='FAIL';summary.failure=error.stack;throw error;}
finally{await writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));}
