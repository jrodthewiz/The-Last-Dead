import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const root=resolve(process.env.STREET_QA_ROOT||'dist');
const output=process.env.STREET_QA_OUTPUT||'output/playwright/island-world';
const label=process.env.STREET_QA_LABEL||'island';
const scoped=process.env.STREET_QA_SCOPED==='1';
const checkpointOnly=process.env.STREET_QA_CHECKPOINT_ONLY==='1';
const desktopViewport={width:Number(process.env.STREET_QA_WIDTH||1280),height:Number(process.env.STREET_QA_HEIGHT||800)};
assert.ok(Object.values(desktopViewport).every(n=>Number.isInteger(n)&&n>=320&&n<=2560),'Explicit inspection viewport');
await mkdir(output,{recursive:true});
const files=['renderer.js','engine.js','main.js','harbor-visuals.js','blackwater-render-looks.js','blackwater-graphic-style.js','blackwater-district-layout.js','blackwater-district-visuals.js','coastal-world-layout.js','assets/blackwater-kit/set-dressing.js','assets/blackwater-kit/materials.js'];
files.push('coastal-workbenches.js','coastal-understory-layout.js','coastal-understory.js','scavenger-pack.js','scavenger-pack-ui.js','scavenger-pack.css','assets/blackwater-kit/furniture.js','assets/blackwater-kit/practicals.js','assets/blackwater-kit/utility-pickup.js','assets/blackwater-kit/architecture.js','assets/blackwater-kit/entrances.js','harbor-navigation.js','assets/survivor/fps-grip-profiles.js','assets/survivor/fps-arms-v3.glb');
files.push('coastal-terrain.js','coastal-terrain-fields.js','coastal-terrain-visuals.js','assets/forest-kit/bank-detail.js','cape-river.js','forest-vegetation.js');
files.push('island-basement.js','island-basement-layout.js','island-basement-visuals.js','coastal-basement-visuals.js','assets/blackwater-kit/district-anatomy.js');
files.push('coastal-shoreline-art.js','harbor-shadow-coverage.js','assets/blackwater-kit/skyline.js','coastal-water.js','webgpu-water.js','blackwater-street-surfaces.js');
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
      seen.add(run);Object.assign(run,{x:340/4,y:332/4,z:0,supportZ:null,supportId:null,structureId:null,angle:Math.PI/2,pitch:-.07,vx:0,vy:0,vz:0});
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
      if(Math.hypot(position.x-340,position.z-332)>.05)throw new Error('Initial checkpoint camera overridden');
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
 const started=Date.now();await page.goto('http://127.0.0.1:'+server.port+'/?debug=1&horrorqa=1',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:120000});
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
 const capture=async suffix=>{const name=label+'-'+suffix;await input(name);await page.screenshot({path:output+'/'+name+'.png'});report.views.push(await page.evaluate(name=>{const q=window.__DEAD_ARRIVAL__,g=q.renderer,c=g.renderer.domElement;return{name,player:[q.run.x*4,q.run.y*4],camera:g.camera.getWorldPosition(g.camera.position.clone()).toArray(),fov:g.camera.fov,pitch:q.run.pitch,canvas:[c.width,c.height],rendererMemory:{...g.renderer.info.memory},recHud:!!document.querySelector('#bodycam-hud')};},name));console.log('Captured',name);await writeFile(output+'/street-progress.json',JSON.stringify(report,null,2));};
 const measure=async name=>{
  if(process.env.ISLAND_QA_PERFORMANCE!=='1')return;
  const result=await page.evaluate(async()=>{
   const q=window.__DEAD_ARRIVAL__,g=q.renderer,r=g.renderer,render=g.render,auto=r.info.autoReset;
   const forest=g.harborWorld.forest,attributes=[];
   forest.root.traverse(o=>{if(o.instanceMatrix)attributes.push(o.instanceMatrix);if(o.instanceColor)attributes.push(o.instanceColor);});
   const summary=()=>({versions:attributes.reduce((n,a)=>n+a.version,0),forest:forest.diagnostics()});
   const cpu=[],wall=[],draws=[],triangles=[];let before,after;
   // Stop the application's autonomous render only during the owned stationary
   // sample. Restore it even on failure. Simulation remains manually paused.
   g.render=()=>{};r.info.autoReset=false;
   try{
    for(let i=0;i<26;i++){
     await new Promise(requestAnimationFrame);await r.backend.device.queue.onSubmittedWorkDone();
     if(i===6)before=summary();r.info.reset();const started=performance.now();
     render.call(g,q.run,performance.now());const submitted=performance.now();
     await r.backend.device.queue.onSubmittedWorkDone();
     if(i>=6){cpu.push(submitted-started);wall.push(performance.now()-started);draws.push(r.info.render.drawCalls);triangles.push(r.info.render.triangles);}
    }
    after=summary();const stats=v=>{const s=[...v].sort((a,b)=>a-b);return{min:s[0],median:s[Math.floor(s.length/2)],p95:s[Math.min(s.length-1,Math.ceil(s.length*.95)-1)]};};
    return{scope:'20 warmed stationary full-render samples, paused simulation; CPU submission and queue-fenced wall time. Headless desktop only, not gameplay FPS or GPU timestamp duration.',samples:cpu.length,cpuSubmitMs:stats(cpu),fencedWallMs:stats(wall),drawCalls:stats(draws),triangles:stats(triangles),forestAttributeVersionIncrements:after.versions-before.versions,forestBefore:before.forest,forestAfter:after.forest,memory:{...r.info.memory}};
   }finally{g.render=render;r.info.autoReset=auto;}
  });
  assert.equal(result.samples,20);assert.ok(Number.isFinite(result.cpuSubmitMs.median)&&Number.isFinite(result.fencedWallMs.median));
  (report.performance??=[]).push({name,...result});console.log('Measured '+name);
 };

 report.scope='Island building, forest, and basement visual acceptance in actual native WebGPU game. Four existing unused startup warmups omitted in this owned browser. Controlled static views and real E area transitions; no full-startup, combat performance or co-op claim.';
 const flight=async(position,target)=>{
  await page.evaluate(({position,target})=>{const q=window.__DEAD_ARRIVAL__;if(!q.inspector.active)q.requestInspector();const [x,y,z]=position,[tx,ty,tz]=target;Object.assign(q.inspector.pose,{x,y,z,angle:Math.atan2(tz-z,tx-x),pitch:Math.atan2(ty-y,Math.hypot(tx-x,tz-z))});q.renderer.freeCamera=q.inspector.pose;},{position,target});await settle();
 };
 await flight([25,210,-30],[225,0,200]);await capture('island-overview');
 await measure('island-overview');
 report.forestAerial=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.forest.diagnostics());assert.ok(report.forestAerial.visibleTrees>=350,'Woodland must survive aerial culling');
 await flight([286,38,115],[290,9,179]);await capture('works-rooflines');
 await measure('works-rooflines');
 if(process.env.ISLAND_QA_SURFACE_PROBE==='1'){
  report.pavingProbe=await page.evaluate(async()=>{
   const w=window.__DEAD_ARRIVAL__.renderer.harborWorld;
   const names=['CoastalSidewalk','CoastalBuildingApron','CoastalEntranceWalk','CoastalRoadShoulder'];
   const objects=[];w.root.traverse(o=>{if(o.isMesh&&o.visible&&(names.includes(o.name)||o.userData.sourceNames?.some(n=>names.includes(n))||(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.userData.lookRole==='paving')))objects.push(o);});
   window.__PAVING_PROBE__=objects.map(o=>({o,material:o.material,receiveShadow:o.receiveShadow}));
   const describe=m=>({name:m.name,type:m.type,color:m.color?.getHexString(),roughness:m.roughness,role:m.userData.lookRole,
    map:m.map?.name||!!m.map,colorNode:!!m.colorNode,lightsNode:!!m.lightsNode,graphicSurface:m.userData.graphicSurface||null});
   for(const o of objects)o.receiveShadow=false;
   return{expected:describe(w.materials.concrete),adapter:w.diagnostics.coastalArtDirection,objects:objects.length,
    samples:objects.slice(0,12).map(o=>({name:o.name,sources:o.userData.sourceNames?.slice(0,4),materials:(Array.isArray(o.material)?o.material:[o.material]).map(describe)})),
    rootNames:w.root.children.slice(0,20).map(o=>({name:o.name,visible:o.visible,type:o.type}))};
  });assert.ok(report.pavingProbe.objects>0,'Paving probe must select rendered surfaces');await settle();await capture('paving-unshadowed');
  await page.evaluate(async()=>{const{MeshBasicNodeMaterial}=await import('/vendor/three.webgpu.js');const m=new MeshBasicNodeMaterial({color:'#99a49c'});window.__PAVING_FLAT__=m;for(const {o}of window.__PAVING_PROBE__)o.material=m;});await settle();await capture('paving-flat-comparison');
  await page.evaluate(()=>{for(const {o,material,receiveShadow}of window.__PAVING_PROBE__){o.material=material;o.receiveShadow=receiveShadow;}window.__PAVING_FLAT__.dispose();delete window.__PAVING_PROBE__;delete window.__PAVING_FLAT__;});await settle();
 }
 await flight([258,23,59],[290,8,87]);await capture('residential-depth');
 await flight([339,4,369],[324,7,389]);await capture('forest-canopy');
 await flight([48,3,29],[40,1.5,28]);await capture('basement-entrance');
 if(process.env.ISLAND_QA_ART_REVIEW==='1'){
  await flight([355,28,120],[348,19,160]);await capture('foundry-landmark');
  await flight([285,16,-65],[317,7,4]);await capture('headland-geology');
  await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;if(q.inspector.active)q.requestInspector();});
  await pose(220,62,192,32,-.035);await capture('street-gameplay');
  await measure('street-gameplay');
  await pose(340,376,323,388,-.03);await capture('woodland-gameplay');
  await measure('woodland-gameplay');
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.settings.bodycam=false;});await settle();await capture('woodland-neutral');
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.settings.bodycam=true;});
 }
 if(process.env.ISLAND_QA_VISUALS_ONLY!=='1'){
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;if(q.inspector.active)q.requestInspector();const p=q.run.course.basementPortal;Object.assign(q.run,{x:p.x,y:p.y,z:0,angle:p.angle,pitch:0,vx:0,vy:0,vz:0});window.advanceTime(0);});await settle();
 report.surfacePortal=await page.evaluate(()=>({portal:window.__DEAD_ARRIVAL__.run.course.basementPortal,health:window.__DEAD_ARRIVAL__.run.health}));
 await page.keyboard.press('e');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play'&&window.__DEAD_ARRIVAL__?.run.course.dungeon,null,{timeout:240000});
 await settle();await capture('dungeon-arrival');
 report.basementArrival=await page.evaluate(()=>({name:window.__DEAD_ARRIVAL__.run.course.name,portal:window.__DEAD_ARRIVAL__.run.course.basementPortal,health:window.__DEAD_ARRIVAL__.run.health}));
 await page.keyboard.press('e');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play'&&window.__DEAD_ARRIVAL__?.run.course.harbor,null,{timeout:240000});await settle();await capture('island-return');
 report.surfaceReturn=await page.evaluate(()=>({portal:window.__DEAD_ARRIVAL__.run.course.basementPortal,health:window.__DEAD_ARRIVAL__.run.health}));
 assert.equal(report.surfaceReturn.health,report.surfacePortal.health);assert.equal(report.basementArrival.health,report.surfacePortal.health);
 }else report.scope+=' This run checks the revised island art; the area round trip is recorded separately.';
 await input('end');assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.httpErrors.length,0);assert.ok(report.views.every(v=>v.canvas.every(n=>n>0)));
 for(const [f,h]of Object.entries(sourceHashes))assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h,'Immutable input changed '+f);
 report.passed=true;console.log('Island world acceptance passed');
}catch(e){report.passed=false;report.failure=String(e.stack||e);if(page&&!page.isClosed()){await page.screenshot({path:output+'/failure.png'}).catch(()=>{});report.deviceLoss=await page.evaluate(()=>window.__STREET_DEVICE_LOSS__??null).catch(()=>null);report.finalInputSafety=await backgroundInputState(page).catch(()=>null);}throw e;}
finally{await browser?.close();await new Promise((resolve,reject)=>server.server.close(error=>error?reject(error):resolve()));report.cleanup={browserClosed:true,ownedServerClosed:!server.server.listening};await writeFile(output+'/report.json',JSON.stringify(report,null,2));}
