import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const root=resolve(process.env.STREET_QA_ROOT||'dist');
const output=process.env.STREET_QA_OUTPUT||'output/playwright/blackwater-14/native-v1';
const label=process.env.STREET_QA_LABEL||'14';
const scoped=process.env.STREET_QA_SCOPED==='1';
const shortScoped=scoped&&process.env.STREET_QA_EXTENDED!=='1';
const checkpointOnly=process.env.STREET_QA_CHECKPOINT_ONLY==='1';
const benchOnly=process.env.STREET_QA_BENCH_ONLY==='1';
const overviewOnly=process.env.STREET_QA_ENTRANCE_OVERVIEW_ONLY==='1';
const desktopViewport={width:Number(process.env.STREET_QA_WIDTH||1280),height:Number(process.env.STREET_QA_HEIGHT||800)};
assert.ok(Object.values(desktopViewport).every(n=>Number.isInteger(n)&&n>=320&&n<=2560),'Explicit inspection viewport');
await mkdir(output,{recursive:true});
const files=['renderer.js','engine.js','main.js','harbor-visuals.js','blackwater-render-looks.js','blackwater-graphic-style.js','blackwater-district-layout.js','blackwater-district-visuals.js','coastal-world-layout.js','assets/blackwater-kit/set-dressing.js','assets/blackwater-kit/materials.js'];
files.push('coastal-workbenches.js','coastal-understory-layout.js','coastal-understory.js','scavenger-pack.js','scavenger-pack-ui.js','scavenger-pack.css','assets/blackwater-kit/furniture.js','assets/blackwater-kit/practicals.js','assets/blackwater-kit/utility-pickup.js','assets/blackwater-kit/architecture.js','assets/blackwater-kit/entrances.js','harbor-navigation.js','assets/survivor/fps-grip-profiles.js','assets/survivor/fps-arms-v3.glb');
const sourceHashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(resolve(root,p))).digest('hex')])));
const report={scope:'Immutable actual game on native WebGPU. Controlled fixed starting views; actual W street traversal with aim-only steering and manual120Hz advancement. Fenced stationary renderer timings are not gameplay FPS or phone hardware acceptance.',root,sourceHashes,views:[],inputSafety:[],errors:[],warnings:[],httpErrors:[],ownedNodePid:process.pid};
const server=await startServer({root,port:0});let browser,page;
await writeFile(output+'/owned-process.json',JSON.stringify({nodePid:process.pid,port:server.port,root},null,2));
try{
 browser=await chromium.launch({headless:true,handleSIGINT:false,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 report.browserVersion=browser.version();report.inspectionViewport=desktopViewport;page=await browser.newPage({viewport:desktopViewport});
 await guardBackgroundInput(page);
 if(scoped)await page.addInitScript(({checkpointStart})=>{
  // Install before the first menu frame; a post-navigation patch can arrive
  // after warmup starts. Keep the real world, dependencies and render path.
  Object.defineProperty(window,'__DEAD_ARRIVAL__',{configurable:true,set(value){
   const owner=value.renderer;
   if(owner._warmupCourse!==null)throw new Error('Scoped QA arrived after warmup');
   const state=window.__STREET_SCOPED_QA__={installed:true,skipped:[],coldDraws:'Original synchronous visible and shadow draw preparation',concurrency:1};
   if(checkpointStart){
    const course=value.run.course,seen=new WeakSet(),render=owner.render.bind(owner),draw=owner._renderScene.bind(owner);
    if(!course.harbor||!course.coastal?.blackwaterSlice)throw new Error('Unexpected initial checkpoint course');
    state.initialPoses=[];
    owner.render=(run,...args)=>{
     if(run?.course===course&&!seen.has(run)){
      seen.add(run);Object.assign(run,{x:214/4,y:26/4,z:0,supportZ:null,supportId:null,structureId:null,angle:-Math.PI/2,pitch:-.07,vx:0,vy:0,vz:0});
      state.initialPoses.push({ordinal:state.initialPoses.length+1,player:[run.x*4,run.y*4],pitch:run.pitch,stage:owner._preparationStage??'first render'});
      if(state.initialPoses.length>2)throw new Error('Unexpected checkpoint run lifecycle');
     }
     return render(run,...args);
    };
    owner._renderScene=(...args)=>{
     if(!state.firstWorldDraw){
      if(owner._course!==course||state.initialPoses.length===0)throw new Error('World draw preceded controlled initial pose');
      const position=owner.camera.getWorldPosition(owner.camera.position.clone());
      state.firstWorldDraw={camera:position.toArray(),fov:owner.camera.fov,courseMatches:true};
      if(Math.hypot(position.x-214,position.z-26)>.05)throw new Error('Initial checkpoint camera overridden');
     }
     return draw(...args);
    };
   }
   owner.renderer.compilationConcurrency=1;
   for(const name of ['_prepareHarborInteriors','_prepareInteractionResources','_prepareCoastalEnemies']){
    if(typeof owner[name]!=='function')throw new Error('Missing scoped QA hook '+name);
    owner[name]=async()=>{state.skipped.push(name);};
   }
   const compile=owner._compilePreparedScene.bind(owner);
   owner._compilePreparedScene=async renderer=>{
    if(owner._course?.coastal&&owner._preparationStage==='Preparing the open coast'){
     state.skipped.push('forced whole-exterior precompile');return;
    }
    return compile(renderer);
   };
   Object.defineProperty(window,'__DEAD_ARRIVAL__',{value,writable:true,configurable:true});
  }});
 },{checkpointStart:process.env.STREET_QA_INITIAL_CHECKPOINT==='1'});
 let rejectRuntime;
 const runtimeFailure=new Promise((_,reject)=>{rejectRuntime=reject;});runtimeFailure.catch(()=>{});
 page.on('pageerror',e=>{report.errors.push(String(e));rejectRuntime(e);});
 page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());rejectRuntime(new Error(m.text()));}else if(m.type()==='warning')report.warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
 await page.addInitScript(()=>{const timer=setInterval(()=>{const d=window.__DEAD_ARRIVAL__?.renderer?.renderer?.backend?.device;if(d?.lost){clearInterval(timer);d.lost.then(i=>window.__STREET_DEVICE_LOSS__={reason:i.reason,message:i.message});}},50);});
 const started=Date.now();await page.goto('http://127.0.0.1:'+server.port+'/?debug=1&horrorqa=1');
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});
 report.startupCompilerConcurrency=await page.evaluate(cap=>{const renderer=window.__DEAD_ARRIVAL__.renderer.renderer;if(cap!==null)renderer.compilationConcurrency=cap;return renderer.compilationConcurrency;},process.env.STREET_QA_CONCURRENCY?Number(process.env.STREET_QA_CONCURRENCY):null);
 await page.locator('[data-action="start"]').click({timeout:60000});
 console.log('Street actual Start');await Promise.race([page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:240000}),runtimeFailure]);
 report.startMs=Date.now()-started;console.log('Street ready',report.startMs);
 if(scoped){report.scope='Scoped actual native game graphics and W-door acceptance; unused legacy-interior, interaction and representative-enemy startup warmups and forced whole-exterior precompile omitted in this owned QA browser. Full resolution, actual camera/shadows/visible enemies/materials and dependency waits retained. Cold synchronous draws excluded from timing claims. Not full-game readiness.';report.startupScope=await page.evaluate(()=>window.__STREET_SCOPED_QA__);assert.equal(report.startupScope.installed,true);assert.equal(report.startupScope.skipped.length,4);}
 if(checkpointOnly)report.scope='Scoped actual native game checkpoint desktop/portrait graphics acceptance with the same four unused startup warmups omitted. Original world, camera, lighting, shadows, enemy cohort, full-resolution renderer and dependency waits retained. W-door input acceptance is separately established by native-v6. Not full-game readiness or gameplay FPS.';
 await page.evaluate(()=>{window.__HORROR_QA__.setManual(true);const q=window.__DEAD_ARRIVAL__;q.renderer.weaponPresentation.equipAge=100;q.run.health=100;q.run.weapon=0;});
 report.gpu=await page.evaluate(()=>{const b=window.__DEAD_ARRIVAL__.renderer.renderer.backend,i=b.adapter?.info??b.device?.adapterInfo;return{nativeWebGPU:b.isWebGPUBackend,adapterInfo:i?{vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description}:null};});assert.equal(report.gpu.nativeWebGPU,true);
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<20;i++)await new Promise(requestAnimationFrame);await window.__DEAD_ARRIVAL__.renderer.renderer.backend.device.queue.onSubmittedWorkDone();});
 const input=async stage=>{const state=await backgroundInputState(page);report.inputSafety.push({stage,...state});assert.equal(state.webdriver,true);assert.equal(state.pointerLocked,false);assert.equal(state.fullscreen,false);assert.deepEqual(state.attempts,{pointerLock:0,fullscreen:0,keyboardLock:0});};
 const pose=async(x,z,tx,tz,pitch=0)=>{await page.evaluate(({x,z,tx,tz,pitch})=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:x/4,y:z/4,z:0,supportZ:null,supportId:null,structureId:null,angle:Math.atan2(tz-z,tx-x),pitch,vx:0,vy:0,vz:0,damage:0,shot:0});window.advanceTime(16);},{x,z,tx,tz,pitch});await settle();};
 const capture=async suffix=>{const name=label+'-'+suffix;await input(name);await page.screenshot({path:output+'/'+name+'.png'});report.views.push(await page.evaluate(name=>{const q=window.__DEAD_ARRIVAL__,g=q.renderer,c=g.renderer.domElement;return{name,player:[q.run.x*4,q.run.y*4],camera:g.camera.getWorldPosition(g.camera.position.clone()).toArray(),fov:g.camera.fov,pitch:q.run.pitch,canvas:[c.width,c.height],recHud:!!document.querySelector('#bodycam-hud')};},name));console.log('Captured',name);await writeFile(output+'/street-progress.json',JSON.stringify(report,null,2));};
 const measure=()=>page.evaluate(async()=>{const g=window.__DEAD_ARRIVAL__.renderer,r=g.renderer,draw=g.render,auto=r.info.autoReset,t=[];g.render=()=>{};r.info.autoReset=false;try{for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);r.info.reset();const s=performance.now();g._renderScene();await r.backend.device.queue.onSubmittedWorkDone();if(i>=8)t.push(performance.now()-s);}t.sort((a,b)=>a-b);return{scope:'22 stationary fenced render samples; not total gameplay FPS.',draws:r.info.render.drawCalls,triangles:r.info.render.triangles,medianMs:t[11],p95Ms:t[20],memoryBytes:r.info.memory.total};}finally{g.render=draw;r.info.autoReset=auto;}});
 await input('start');

 report.scope='Actual native game entrance iteration: controlled initial Hardware approach and later cottage views. Four unused startup warmups omitted; full-quality world, renderer, camera, lighting, shadows and actual input retained. Inventory and scrap seeded for a repeatable repair transaction. No continuous combat FPS, full startup or phone hardware claim.';
 report.world=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,w=q.renderer.harborWorld;return{enterable:w.blackwater.diagnostics.enterable.length,stations:q.run.course.coastal.workbenches.length,understory:w.diagnostics.understory,truck:w.diagnostics.detail.pickup,residents:q.run.course.harborSpawns,practicals:w.blackwater.diagnostics.practicals};});
 assert.equal(report.world.enterable,94);assert.equal(report.world.stations,46);assert.equal(report.world.truck.original,true);
 if(benchOnly){report.scope+=' Bounded entrance and location-label followup; prior river, foliage and vehicle native checks belong to blackwater-13/native-v5. No new driving claim.';assert.equal(report.world.practicals.lightCount,12);assert.equal(report.world.practicals.additionalShadowMaps,0);assert.equal(report.world.practicals.lights.filter(l=>l.name==='HARBOR HARDWARE repair task lamp').length,1);}
 if(overviewOnly){
  report.scope='Actual native full-quality entrance overview followup against the identical accepted snapshot. Controlled stationary views; four unused startup warmups omitted. Walk and fitting acceptance belongs to native-v1; no additional input or performance claim.';
  await pose(214,2,214,12,.08);await capture('hardware-overview');
  await pose(158,236,158,246,.08);await capture('cottage-overview');
 }else{
 await capture('hardware-approach');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q._qaEnemies=q.run.course.enemies;q.run.course.enemies=[];});
 const walkTo=async(x,z)=>{await page.keyboard.down('w');let result;try{result=await page.evaluate(({x,z})=>{const q=window.__DEAD_ARRIVAL__,r=q.run,g=q.renderer,draw=g.render;g.render=()=>{};let frames=0,reached=false;try{for(;frames<2200;frames++){if(Math.hypot(x/4-r.x,z/4-r.y)<.03){reached=true;break;}r.angle=Math.atan2(z/4-r.y,x/4-r.x);window.advanceTime(1000/120);}}finally{g.render=draw;window.advanceTime(0);}return{target:[x,z],player:[r.x*4,r.y*4],frames,reached,screen:q.screen};},{x,z});}finally{await page.keyboard.up('w');}assert.equal(result.reached,true,JSON.stringify(result));assert.equal(result.screen,'play');return result;};
 report.walk={scope:'Actual W input from the original rear approach through the hardware door to the bench. Aim-only steering; no player-coordinate writes. Enemy simulation omitted for this bounded input check.',steps:[]};
 for(const p of [[214,23],[214,19],[214,12],[214,9.4],[216.3,9.4],[218.05,9.4]])report.walk.steps.push(await walkTo(...p));
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,r=q.run;r.angle=Math.atan2(11-r.y*4,218.05-r.x*4);r.pitch=-.23;window.advanceTime(0);});await settle();await capture('workbench');
 assert.equal(await page.locator('[data-hud="room-name"]').innerText(),'HARBOR HARDWARE');
 report.craft=await page.evaluate(async()=>{const q=window.__DEAD_ARRIVAL__,m=await import('/scavenger-pack.js');q.run.backpack.scrap=8;q.run.ownedWeapons=[0,4,5,6,7];return{scope:'Controlled 8 scrap / five owned weapons for UI transaction; no fabricated pickup or progression claim.',access:m.workbenchAccess(q.run)};});assert.equal(report.craft.access.available,true);
 await page.keyboard.press('b');await page.locator('.pack-overlay').waitFor({state:'visible'});await page.locator('[data-pack-workbench][data-available=true]').waitFor({state:'visible'});
 await page.locator('[data-pack-weapon="4"]').click();await page.locator('.pack-equip').click();assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.weapon),4);
 await page.locator('.pack-upgrade').click();await page.locator('.pack-status[data-state=success]').waitFor({state:'visible'});
 report.craft.after=await page.evaluate(()=>({scrap:window.__DEAD_ARRIVAL__.run.backpack.scrap,mods:window.__DEAD_ARRIVAL__.run.backpack.weaponMods,weapon:window.__DEAD_ARRIVAL__.run.weapon,disabled:document.querySelector('.pack-upgrade').disabled}));
 assert.equal(report.craft.after.scrap,0);assert.equal(report.craft.after.mods[4],'hardened-fitting');assert.equal(report.craft.after.disabled,true);
 await page.locator('[data-pack-workbench]').scrollIntoViewIfNeeded();await settle();await capture('repair-ui');
 await page.setViewportSize({width:390,height:844});await page.locator('[data-pack-workbench]').scrollIntoViewIfNeeded();await settle();await capture('repair-ui-portrait');await page.setViewportSize(desktopViewport);
 await page.keyboard.press('b');await page.locator('.pack-overlay').waitFor({state:'hidden'});
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q.run.course.enemies=q._qaEnemies;delete q._qaEnemies;});
 report.entrances=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,d=q.renderer.harborWorld.blackwater.diagnostics;return {themes:d.models.reduce((a,m)=>{const e=m.plan.entrances;a[e.theme]=(a[e.theme]||0)+1;return a;},{}),sourceDraws:d.buildingBatches.sourceDraws,batchedDraws:d.buildingBatches.batchedDraws,triangles:d.buildingBatches.triangles,materials:d.materials};});
 await pose(214,5,214,12,-.03);await capture('hardware-front');
 await pose(158,238,158,248,-.07);await capture('cottage-porch');
 const addressPose=await page.evaluate(()=>{const b=window.__DEAD_ARRIVAL__.run.course.coastal.blackwaterSlice.buildings.find(b=>b.label==='CAPE LODGE 75');const p=window.__DEAD_ARRIVAL__.renderer.harborWorld.blackwater.models.find(m=>m.diagnostics.plan.settings.label===b.label).diagnostics.plan.entrances.modules.find(p=>p.role==='entry-address-enamel');const c=Math.cos(b.yaw),s=Math.sin(b.yaw),x=b.x+p.position[0]*c+p.position[2]*s,z=b.z-p.position[0]*s+p.position[2]*c;return {x:x+s*3.2,z:z+c*3.2,tx:x,tz:z};});
 await pose(addressPose.x,addressPose.z,addressPose.tx,addressPose.tz,0);await capture('cottage-address');
 await pose(158,238,158,248,0);
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q._qaEnemies=q.run.course.enemies;q.run.course.enemies=[];});
 report.houseWalk={scope:'Actual W input from controlled porch approach into the cottage; aim steering only, enemy cohort omitted for this bounded walk.',step:await walkTo(158,244)};
 await settle();assert.equal(await page.locator('[data-hud="room-name"]').innerText(),'CAPE LODGE 75');await capture('cottage-inside');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q.run.course.enemies=q._qaEnemies;delete q._qaEnemies;});
 if(!benchOnly){
 await pose(346,341,347,355,-.07);await capture('forest-bank');
 report.world.understoryAtForest=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.diagnostics.understory);
 await pose(219,27,210,24,-.08);await capture('building-verge');
 await pose(69,61,64,56,-.11);await capture('utility-pickup');
 await pose(64,60.2,64,56,0);
 await page.keyboard.down('q');await page.evaluate(()=>window.advanceTime(1000/120));await page.keyboard.up('q');await page.evaluate(()=>window.advanceTime(1000/120));
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.vehicle.occupied),true);
 await page.keyboard.down('w');try{await page.evaluate(()=>{for(let i=0;i<150;i++)window.advanceTime(1000/120);});}finally{await page.keyboard.up('w');}
 await page.keyboard.down('Space');try{await page.evaluate(()=>{for(let i=0;i<180;i++)window.advanceTime(1000/120);});}finally{await page.keyboard.up('Space');}
 report.drive=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return{...q.run.vehicle,scope:'Actual Q entry, W driving, Space braking and Q exit. Controlled initial standing position.'};});assert.ok(report.drive.distance>2);assert.ok(Math.abs(report.drive.speed)<.3);
 await settle();await capture('driving');await page.keyboard.down('q');await page.evaluate(()=>window.advanceTime(1000/120));await page.keyboard.up('q');await page.evaluate(()=>window.advanceTime(1000/120));assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.vehicle.occupied),false);
 }
 }
 await input('end');assert.equal(report.errors.length,0);assert.equal(report.httpErrors.length,0);assert.ok(report.views.every(v=>v.canvas.every(n=>n>0)&&!v.recHud));
 report.textState=await page.evaluate(()=>typeof window.render_game_to_text==='function'?JSON.parse(window.render_game_to_text()):null);assert.ok(report.textState);
 for(const [f,h]of Object.entries(sourceHashes))assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h,'Immutable input changed '+f);
 report.passed=true;console.log('Coastal polish 14 native checks passed');
}catch(e){report.passed=false;report.failure=String(e.stack||e);if(page&&!page.isClosed()){report.deviceLoss=await page.evaluate(()=>window.__STREET_DEVICE_LOSS__??null).catch(()=>null);report.finalInputSafety=await backgroundInputState(page).catch(()=>null);}throw e;}
finally{await browser?.close();await new Promise((resolve,reject)=>server.server.close(error=>error?reject(error):resolve()));report.cleanup={browserClosed:true,ownedServerClosed:!server.server.listening};await writeFile(output+'/report.json',JSON.stringify(report,null,2));}
