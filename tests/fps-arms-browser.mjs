import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
import {verifyFPSInputJourney} from './fps-arms-input-journey.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.FP_CAPTURE_OUTPUT||'output/playwright/fps-arms-v3-game';await mkdir(output,{recursive:true});
const root=resolve(process.env.FP_CAPTURE_ROOT||'.'),server=await startServer({root,port:0,spaFallback:false});let browser,context;
const viewport={width:Number(process.env.FP_CAPTURE_WIDTH||1280),height:Number(process.env.FP_CAPTURE_HEIGHT||800)};
const weapons=process.env.FP_CAPTURE_WEAPONS?process.env.FP_CAPTURE_WEAPONS.split(',').map(Number):[0,1,2,3,4,5,6,7];
const captureBody=process.env.FP_CAPTURE_BODY!=='0';
const recordVideo=process.env.FP_CAPTURE_VIDEO!=='0';
const frameSequence=process.env.FP_CAPTURE_FRAME_SEQUENCE==='1';
assert(weapons.length&&weapons.every(i=>Number.isInteger(i)&&i>=0&&i<8));
assert(Object.values(viewport).every(n=>Number.isInteger(n)&&n>=320&&n<=2560));
const report={scope:`Actual native game in isolated browser/server; real Start and selected weapon keys (${weapons.join(',')}), representative rendered bone playback with seven still checkpoints${captureBody?', controlled look-down standing/walking/slide views':''}. Controlled animation clocks pause for screenshots. No mobile/performance certification.`,selectedWeapons:weapons,captureBody,recordVideo,root,viewport,errors:[],httpErrors:[],views:[],body:[],sourceHashes:{}};
await writeFile(output+'/owned-process.json',JSON.stringify({nodePid:process.pid,port:server.port,root},null,2));
for(const file of ['renderer.js','assets/survivor/fps-arms.js','assets/survivor/fps-arms-v3.glb','assets/survivor/fps-arms-v3-manifest.json','assets/survivor/viewmodel-hold-poses.js','assets/survivor/meshy-survivor.js','assets/survivor/tld-survivor-v02.glb','weapon-occult-redesign.js','blackwater-weapon-style.js'])report.sourceHashes[file]=createHash('sha256').update(await readFile(resolve(root,file))).digest('hex');
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 report.browserVersion=browser.version();
 context=await browser.newContext({viewport,...(recordVideo?{recordVideo:{dir:output+'/video',size:viewport}}:{})});
 const page=await context.newPage();await guardBackgroundInput(page);
 if(process.env.FP_CAPTURE_SCOPED==='1'){
  // Match the world verifier's bounded cold-start scope. The actual visible
  // world, materials, lights, shadows and production draw path remain intact.
  await page.addInitScript(()=>Object.defineProperty(window,'__DEAD_ARRIVAL__',{configurable:true,set(value){
   const owner=value.renderer;
   if(owner._warmupCourse!==null)throw new Error('FPS scoped QA arrived after warmup');
   const state=window.__FPS_SCOPED_QA__={installed:true,skipped:[],initialPoses:[],coldDraws:'Original synchronous visible and shadow draw preparation'};
   const course=value.run.course,seen=new WeakSet(),render=owner.render.bind(owner);
   owner.render=(run,...args)=>{
    if(run?.course===course&&!seen.has(run)){
     seen.add(run);Object.assign(run,{x:206/4,y:56/4,z:0,supportZ:null,supportId:null,structureId:null,angle:Math.PI,pitch:-.025,vx:0,vy:0,vz:0});
     state.initialPoses.push({ordinal:state.initialPoses.length+1,player:[run.x*4,run.y*4],pitch:run.pitch,stage:owner._preparationStage??'first render'});
     if(state.initialPoses.length>2)throw new Error('Unexpected FPS scoped run lifecycle');
    }
    return render(run,...args);
   };
   owner.renderer.compilationConcurrency=1;
   for(const name of ['_prepareHarborInteriors','_prepareInteractionResources','_prepareCoastalEnemies']){
    if(typeof owner[name]!=='function')throw new Error('Missing FPS scoped QA hook '+name);
    owner[name]=async()=>{state.skipped.push(name);};
   }
   const compile=owner._compilePreparedScene.bind(owner);
   owner._compilePreparedScene=async renderer=>{
    if(owner._course?.coastal&&owner._preparationStage==='Preparing the open coast'){state.skipped.push('forced whole-exterior precompile');return;}
    return compile(renderer);
   };
   Object.defineProperty(window,'__DEAD_ARRIVAL__',{value,writable:true,configurable:true});
  }}));
  report.scope+=' Scoped cold start omits unused interior/interaction/enemy warmup and forced whole-exterior precompile; visible production rendering remains.';
 }
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&horrorqa=1`);
 await page.locator('[data-action="start"]').click({timeout:180000});console.log('Actual game Start pressed');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:180000});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._survivors?.fpsRigRevision===3,null,{timeout:60000});
 report.gpu=await page.evaluate(()=>{const b=window.__DEAD_ARRIVAL__.renderer.renderer.backend,i=b.adapter?.info??b.device?.adapterInfo;return{nativeWebGPU:b.isWebGPUBackend,adapterInfo:i?{vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description}:null};});
 assert.equal(report.gpu.nativeWebGPU,true);
 await page.evaluate(()=>{window.__HORROR_QA__.setManual(true);const q=window.__DEAD_ARRIVAL__;Object.assign(q.run,{x:206/4,y:56/4,z:0,angle:Math.PI,pitch:-.025,vx:0,vy:0,vz:0,speed:0,slide:0,aim:0,shot:0,damage:0,ownedWeapons:[0,1,2,3,4,5,6,7]});
  // Manual simulation leaves main.js's automatic render loop running. Keep
  // that loop from consuming recoil between paused screenshot checkpoints;
  // this saved entry point still calls the unmodified production renderer.
  window.__FPS_RENDER_QA__={draw:q.renderer.render.bind(q.renderer),now:performance.now()};q.renderer.render=()=>{};
 });
 report.scope+=' QA-only inventory grants allow the real number-key switching; weapon/body/action poses are controlled. Automatic main-loop rendering is paused after startup; fixed-clock calls use the unmodified production renderer.';
 report.renderClock={automaticMainLoop:'paused after startup',controlledStepMs:1000/60,entryPoint:'saved unmodified production render'};
 if(frameSequence)report.renderClock.frameSequence={renderedHz:60,capturedHz:30,framesPerAction:46,scope:'Native production frames sampled every two controlled steps, encoded separately at authored time; not wall-clock gameplay footage.'};
 const render=async(frames=30)=>page.evaluate(async frames=>{const q=window.__DEAD_ARRIVAL__,clock=window.__FPS_RENDER_QA__;for(let k=0;k<frames;k++){clock.now+=1000/60;clock.draw(q.run,clock.now);await new Promise(requestAnimationFrame);}await q.renderer.renderer.backend.device.queue.onSubmittedWorkDone();},frames);
 for(const weapon of weapons){
  await page.keyboard.press(String(weapon+1));await render();
  const row=await page.evaluate(async weapon=>{const q=window.__DEAD_ARRIVAL__,{fpsGripDiagnostics}=await import('/assets/survivor/fps-arms.js');return {weapon,selected:q.run.weapon,screen:q.screen,rigRevision:q.renderer._survivors.fpsRigRevision,...fpsGripDiagnostics(q.renderer.weaponGroups[weapon])};},weapon);
  assert.equal(row.selected,weapon);assert.equal(row.rigRevision,3);for(const a of row.arms){assert(a.gap<1e-5);assert(a.rotationGap<1e-5);assert(a.wristDegrees<=a.wristLimitDegrees+.005);assert(Math.abs(a.forearmMetres-.30464)<1e-5);assert(Math.abs(a.upperMetres-.3584)<1e-5);}report.views.push(row);
  await page.screenshot({path:`${output}/hold-${weapon}.png`,timeout:60000});console.log('Actual FPS hold',weapon);
  if(![1,6,7].includes(weapon))continue;
  // A complete native rendered action, driven by the same run/presentation
  // events as gameplay. Explicitly controlled, not claimed as real mouse fire.
  await page.evaluate(({weapon,name})=>{const q=window.__DEAD_ARRIVAL__,clock=window.__FPS_RENDER_QA__;clock.now+=1000/60;q.run.shot=0;q.run.meleeActive=false;clock.draw(q.run,clock.now);const bone=q.renderer.weaponGroups[weapon].userData.authoredFPS.rig.getObjectByName(`FPS_${name}_right_Index0`);window.__FPS_ACTION_QA__={weapon,bone,start:bone.quaternion.clone(),nextFrame:0,origin:clock.now+1000/60,maxGap:0,jointTravel:0,baseRigDepth:q.renderer.weaponRig.position.z,maxRecoilDepth:0,peakShotStrength:0};},{weapon,name:FIRST_PERSON_HOLD_POSES[weapon].name});
  let action;const stillCheckpoints=[0,3,8,16,35,60,90];
  if(frameSequence)await mkdir(`${output}/frames/${weapon}`,{recursive:true});
  const checkpoints=frameSequence?Array.from({length:91},(_,i)=>i).filter(i=>i%2===0||stillCheckpoints.includes(i)):stillCheckpoints;
  for(const checkpoint of checkpoints){
   action=await page.evaluate(async end=>{const q=window.__DEAD_ARRIVAL__,r=q.renderer,s=window.__FPS_ACTION_QA__,{fpsGripDiagnostics}=await import('/assets/survivor/fps-arms.js');
    for(let k=s.nextFrame;k<=end;k++){if(s.weapon===1){q.run.shot=Math.max(0,1-k*7/60);if(k===0)q.run.shotSequence=(q.run.shotSequence||0)+1;}else{q.run.meleeActive=k<60;q.run.meleeProgress=Math.min(1,k/60);q.run.meleeHeavy=true;if(k===0)q.run.meleeSequence=(q.run.meleeSequence||0)+1;}
     window.__FPS_RENDER_QA__.now=s.origin+k*1000/60;window.__FPS_RENDER_QA__.draw(q.run,window.__FPS_RENDER_QA__.now);await new Promise(requestAnimationFrame);s.jointTravel=Math.max(s.jointTravel,s.start.angleTo(s.bone.quaternion));s.maxRecoilDepth=Math.max(s.maxRecoilDepth,Math.abs(r.weaponRig.position.z-s.baseRigDepth));s.peakShotStrength=Math.max(s.peakShotStrength,r.weaponPresentation.shotStrength);for(const a of fpsGripDiagnostics(r.weaponGroups[s.weapon]).arms)s.maxGap=Math.max(s.maxGap,a.gap);
    }s.nextFrame=end+1;return{weapon:s.weapon,frames:s.nextFrame,maxGap:s.maxGap,jointTravel:s.jointTravel,maxRecoilDepth:s.maxRecoilDepth,peakShotStrength:s.peakShotStrength};
   },checkpoint);
   const png=await page.screenshot({timeout:60000});
   if(stillCheckpoints.includes(checkpoint))await writeFile(`${output}/action-${weapon}-${checkpoint}.png`,png);
   if(frameSequence&&checkpoint%2===0)await writeFile(`${output}/frames/${weapon}/frame-${String(checkpoint/2).padStart(3,'0')}.png`,png);
  }
  await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q.run.meleeActive=false;q.run.shot=0;delete window.__FPS_ACTION_QA__;});
  assert(action.maxGap<1e-5);assert(action.jointTravel>.02);if(weapon===1){assert(action.peakShotStrength>=1,'paused capture must actually trigger outer recoil');assert(action.maxRecoilDepth>.04,'complete rendered outer shotgun recoil must travel');}report.actions??=[];report.actions.push(action);
 }
 if(process.env.FP_CAPTURE_INPUT==='1'){
  report.inputJourney=await verifyFPSInputJourney(page,output);
  report.scope+=' Also exercises real keyboard movement/switching and pointer input on the production FIRE/AIM controls, temporarily exposed on desktop, through the installed game skill client. Simulation and rendering use a controlled clock; enemies omitted during this bounded input journey.';
 }
 await page.keyboard.press('2');
 for(const state of captureBody?['standing','walking','slide']:[]){
  await page.evaluate(state=>{const q=window.__DEAD_ARRIVAL__;Object.assign(q.run,{pitch:-1.25,speed:state==='walking'?1.5:0,vx:state==='walking'?1.5:0,vy:0,slide:state==='slide'?1:0});},state);await render(45);
  const body=await page.evaluate(()=>{const s=window.__DEAD_ARRIVAL__.renderer._survivors;return{source:s.local.userData.source,visible:s.local.visible,torsoLegsVisible:s.local.userData.body.visible,headVisible:s.local.userData.head.visible,remoteArmsVisible:s.local.userData.arms.visible,animation:s.local.userData.animation};});
  assert.equal(body.source,'meshy-v02');assert(body.visible&&body.torsoLegsVisible);assert(!body.headVisible&&!body.remoteArmsVisible);report.body.push({state,...body});
  await page.screenshot({path:`${output}/look-down-${state}.png`,timeout:60000});console.log('Actual look-down',state);
 }
 report.scopedStartup=await page.evaluate(()=>window.__FPS_SCOPED_QA__||null);
 report.backgroundInput=await backgroundInputState(page);assert.deepEqual(report.backgroundInput.attempts,{pointerLock:0,fullscreen:0,keyboardLock:0});assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.status='PASS';
 await context.close();context=null;report.video=recordVideo?await page.video().path():null;
}catch(error){report.status='FAIL';report.failure=String(error.stack||error);console.error(report.failure);process.exitCode=1;
 try{const page=context?.pages()[0];if(page){report.failurePage=await page.evaluate(()=>({url:location.href,title:document.title,text:document.body.innerText.slice(0,2500),state:window.__DEAD_ARRIVAL__?.screen}));await page.screenshot({path:output+'/failure.png',timeout:10000});}}catch{}
}
finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await context?.close();await browser?.close();server.server.closeAllConnections?.();await new Promise(r=>server.server.close(r));}
