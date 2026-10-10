import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';
import {verifyCourtLaneJourney} from './island-court-lane-browser.mjs';
import {verifyCityLifeGameplay} from './island-city-life-browser.mjs';
import {verifyCityPerformance,profileCityFrame} from './island-city-performance-browser.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const root=resolve(process.env.STREET_QA_ROOT||'dist');
const output=process.env.STREET_QA_OUTPUT||'output/playwright/island-world';
const label=process.env.STREET_QA_LABEL||'island';
const scoped=process.env.STREET_QA_SCOPED==='1';
const checkpointOnly=process.env.STREET_QA_CHECKPOINT_ONLY==='1';
const expectedCarCount=Number(process.env.ISLAND_QA_EXPECTED_CARS||20);
const fixedCaptureTime=process.env.ISLAND_QA_FIXED_CAPTURE_TIME?Number(process.env.ISLAND_QA_FIXED_CAPTURE_TIME):null;
assert.ok(fixedCaptureTime===null||(Number.isFinite(fixedCaptureTime)&&fixedCaptureTime>=0),'Explicit capture phase');
assert.ok([8,20].includes(expectedCarCount),'Explicit original or populated frozen fleet contract');
const desktopViewport={width:Number(process.env.STREET_QA_WIDTH||1280),height:Number(process.env.STREET_QA_HEIGHT||800)};
assert.ok(Object.values(desktopViewport).every(n=>Number.isInteger(n)&&n>=320&&n<=2560),'Explicit inspection viewport');
await mkdir(output,{recursive:true});
const files=['renderer.js','engine.js','main.js','harbor-visuals.js','blackwater-render-looks.js','blackwater-graphic-style.js','blackwater-district-layout.js','blackwater-district-visuals.js','coastal-world-layout.js','assets/blackwater-kit/set-dressing.js','assets/blackwater-kit/materials.js'];
files.push('coastal-workbenches.js','coastal-understory-layout.js','coastal-understory.js','scavenger-pack.js','scavenger-pack-ui.js','scavenger-pack.css','assets/blackwater-kit/furniture.js','assets/blackwater-kit/practicals.js','assets/blackwater-kit/utility-pickup.js','assets/blackwater-kit/architecture.js','assets/blackwater-kit/entrances.js','harbor-navigation.js','assets/survivor/fps-grip-profiles.js','assets/survivor/fps-arms-v3.glb');
files.push('coastal-terrain.js','coastal-terrain-fields.js','coastal-terrain-visuals.js','assets/forest-kit/bank-detail.js','cape-river.js','forest-vegetation.js');
files.push('island-basement.js','island-basement-layout.js','island-basement-visuals.js','coastal-basement-visuals.js','assets/blackwater-kit/district-anatomy.js');
files.push('coastal-shoreline-art.js','harbor-shadow-coverage.js','assets/blackwater-kit/skyline.js','coastal-water.js','webgpu-water.js','blackwater-street-surfaces.js');
if(process.env.ISLAND_QA_SHARED_DAYLIGHT==='1')files.push('coastal-daylight-profile.js');

files.push('assets/forest-kit/ground-atlas.js','coastal-woodland-ground.js','coastal-world-visuals.js','coastal-maritime-layout.js','coastal-maritime-visuals.js','assets/blackwater-kit/maritime-vehicles.js');
files.push('coastal-port-frontage.js','coastal-town-details.js','assets/thai-kit/bangkok-apartment-block.js');
files.push('harbor-course.js','harbor-collision.js');
files.push('harbor-thai-layout.js');
if(process.env.ISLAND_QA_FRONT_TERRAIN==='1')files.push('coastal-residential-fields.js');
if(process.env.ISLAND_QA_INDUSTRIAL_FRONTAGE==='1')files.push('coastal-industrial-frontage.js');
if(process.env.ISLAND_QA_ARMS_RUNTIME==='1')files.push('assets/survivor/fps-arms.js','assets/survivor/fps-arms-v5.glb','assets/survivor/fps-arms-v5-manifest.json');
if(process.env.ISLAND_QA_ROOT_FOOTING==='1')files.push('coastal-root-footing.js');
if(process.env.ISLAND_QA_GROVE_TERRAIN==='1')files.push('coastal-grove-court-fields.js');
if(process.env.ISLAND_QA_SALTWOOD_TRANSECT==='1')files.push('coastal-saltwood-transect.js');
if(process.env.ISLAND_QA_STATIC_BATCHES==='1')files.push('blackwater-building-batches.js');
if(process.env.ISLAND_QA_GROUND_HIERARCHY==='1')files.push('coastal-ground-hierarchy.js');
if(process.env.ISLAND_QA_TIMBER_WORKSPACE==='1')files.push('coastal-timber-workspace.js');
if(process.env.ISLAND_QA_CABLE_REPAIR==='1')files.push('coastal-cable-repair.js');
if(process.env.ISLAND_QA_TOWN_WOOD==='1')files.push('coastal-town-wood.js');
if(process.env.ISLAND_QA_CUSTOMS_GALLERY==='1')files.push('coastal-customs-gallery.js');
if(process.env.ISLAND_QA_RESIDENTIAL_RIDGE==='1')files.push('coastal-residential-ridge.js');
if(process.env.ISLAND_QA_RIDGE_HABITAT==='1')files.push('coastal-ridge-habitat.js');
if(process.env.ISLAND_QA_HARBOR_SERVICES==='1')files.push('harbor-service-frontages.js');
if(process.env.ISLAND_QA_COURT_LANE==='1')files.push('coastal-court-lane.js','coastal-neighborhood-layout.js','coastal-neighborhood-visuals.js');
if(process.env.ISLAND_QA_CITY_LIFE==='1')files.push('coastal-city-life-layout.js','coastal-city-life-visuals.js','coastal-scavenging.js','coastal-zombie-population.js','enemy-ai.js','zombie-behavior.js','npc-afterlife-model.js','harbor-vehicle.js','harbor-vehicle-fleet.js','harbor-helicopter.js','helicopter-world-collision.js','assets/blackwater-kit/burnt-vehicle.js','assets/blackwater-kit/utility-helicopter.js','campaign-entry.js','ui.js','harbor-interiors.js','low-tide.js');
const sourceHashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(resolve(root,p))).digest('hex')])));
const report={scope:'Immutable actual game on native WebGPU. Controlled fixed starting views; actual W street traversal with aim-only steering and manual120Hz advancement. Fenced stationary renderer timings are not gameplay FPS or phone hardware acceptance.',root,sourceHashes,views:[],inputSafety:[],errors:[],warnings:[],httpErrors:[],ownedNodePid:process.pid};
report.harnessHashes=Object.fromEntries(await Promise.all(['tests/island-world-browser.mjs','tests/island-court-lane-browser.mjs','tests/island-city-life-browser.mjs','tests/island-city-performance-browser.mjs'].map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
if(process.env.ISLAND_QA_FOUR_FRAME_RECHECK==='1'){
 assert.equal(process.env.ISLAND_QA_PERFORMANCE,'1');assert.equal(process.env.ISLAND_QA_ENVIRONMENT_REVIEW,'0');assert.equal(process.env.ISLAND_QA_VISUALS_ONLY,'1');
 report.scope='One unchanged immutable baseline recheck: same four original measured poses, settings, ordered warmup and 20 accepted native samples. No basement journey or whole-map art acceptance; paused timings are not gameplay FPS.';
}
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
   const state=window.__STREET_SCOPED_QA__={installed:true,skipped:[],worldBuilds:[],coldDraws:'Original synchronous visible and shadow draw preparation',concurrency:1};
   const build=owner._buildWorld.bind(owner);owner._buildWorld=course=>{state.worldBuilds.push({id:course.id,coastal:!!course.coastal,phase:owner._preparationStage});return build(course);};
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
 const started=Date.now();await page.goto('http://127.0.0.1:'+server.port+'/?debug=1&horrorqa=1'+(process.env.ISLAND_QA_CITY_LIFE==='1'?'&worldSeed=7317':''),{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:120000});
 report.startupCompilerConcurrency=await page.evaluate(cap=>{const renderer=window.__DEAD_ARRIVAL__.renderer.renderer;if(cap!==null)renderer.compilationConcurrency=cap;return renderer.compilationConcurrency;},process.env.STREET_QA_CONCURRENCY?Number(process.env.STREET_QA_CONCURRENCY):null);
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;window.__START_IDENTITY_QA__={run:q.run,course:q.run.course};});
 await page.locator('[data-action="start"]').click({timeout:60000});
 console.log('Street actual Start');await Promise.race([page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:240000}),runtimeFailure]);
 report.startMs=Date.now()-started;console.log('Street ready',report.startMs);
 report.startIdentity=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,s=window.__START_IDENTITY_QA__;return{sameRun:q.run===s.run,sameCourse:q.run.course===s.course,preparedCourse:q.renderer._preparedCourse===q.run.course,renderedCourse:q.renderer._course===q.run.course,builds:window.__STREET_SCOPED_QA__?.worldBuilds};});
 if(process.env.ISLAND_QA_CITY_LIFE==='1'){assert.equal(report.startIdentity.sameRun,true);assert.equal(report.startIdentity.sameCourse,true);assert.equal(report.startIdentity.builds.length,1);assert.equal(report.startIdentity.preparedCourse,true);}
 if(scoped){report.scope='Scoped actual native game graphics and W-door acceptance; unused legacy-interior, interaction and representative-enemy startup warmups and forced whole-exterior precompile omitted in this owned QA browser. Full resolution, actual camera/shadows/visible enemies/materials and dependency waits retained. Cold synchronous draws excluded from timing claims. Not full-game readiness.';report.startupScope=await page.evaluate(()=>window.__STREET_SCOPED_QA__);assert.equal(report.startupScope.installed,true);assert.equal(report.startupScope.skipped.length,4);}
 if(checkpointOnly)report.scope='Scoped actual native game checkpoint desktop/portrait graphics acceptance with the same four unused startup warmups omitted. Original world, camera, lighting, shadows, enemy cohort, full-resolution renderer and dependency waits retained. W-door input acceptance is separately established by native-v6. Not full-game readiness or gameplay FPS.';
 await page.evaluate(()=>{window.__HORROR_QA__.setManual(true);const q=window.__DEAD_ARRIVAL__;q.renderer.weaponPresentation.equipAge=100;q.run.health=100;q.run.weapon=0;});
 report.gpu=await page.evaluate(()=>{const b=window.__DEAD_ARRIVAL__.renderer.renderer.backend,i=b.adapter?.info??b.device?.adapterInfo;return{nativeWebGPU:b.isWebGPUBackend,adapterInfo:i?{vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description}:null};});assert.equal(report.gpu.nativeWebGPU,true);
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<20;i++)await new Promise(requestAnimationFrame);await window.__DEAD_ARRIVAL__.renderer.renderer.backend.device.queue.onSubmittedWorkDone();});
 const input=async stage=>{const state=await backgroundInputState(page);report.inputSafety.push({stage,...state});assert.equal(state.webdriver,true);assert.equal(state.pointerLocked,false);assert.equal(state.fullscreen,false);assert.deepEqual(state.attempts,{pointerLock:0,fullscreen:0,keyboardLock:0});};
 const pose=async(x,z,tx,tz,pitch=0)=>{await page.evaluate(({x,z,tx,tz,pitch})=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:x/4,y:z/4,z:0,supportZ:null,supportId:null,structureId:null,angle:Math.atan2(tz-z,tx-x),pitch,vx:0,vy:0,vz:0,damage:0,shot:0});window.advanceTime(16);},{x,z,tx,tz,pitch});await settle();};
 const capture=async suffix=>{
  const name=label+'-'+suffix;await input(name);
  try{
   if(fixedCaptureTime!==null)await page.evaluate(async time=>{
    const q=window.__DEAD_ARRIVAL__,g=q.renderer;
    if(window.__ISLAND_CAPTURE_RENDER__)throw new Error('Capture render already held');
    window.__ISLAND_CAPTURE_RENDER__={g,render:g.render,infoAutoReset:g.renderer.info.autoReset};g.render=()=>{};
    g.renderer.info.autoReset=false;g.renderer.info.reset();
    window.__ISLAND_CAPTURE_RENDER__.render.call(g,q.run,time);
    await g.renderer.backend.device.queue.onSubmittedWorkDone();
   },fixedCaptureTime);
   await page.screenshot({path:output+'/'+name+'.png'});
   report.views.push(await page.evaluate(({name,time})=>{const q=window.__DEAD_ARRIVAL__,g=q.renderer,c=g.renderer.domElement;return{name,player:[q.run.x*4,q.run.y*4],camera:g.camera.getWorldPosition(g.camera.position.clone()).toArray(),cameraQuaternion:g.camera.getWorldQuaternion(g.camera.quaternion.clone()).toArray(),inspectorPose:q.inspector.active?{...q.inspector.pose}:null,fixedCaptureTimeMs:time,renderTimeMs:g._lastNow,submittedCounts:time===null?null:{drawCalls:g.renderer.info.render.drawCalls,triangles:g.renderer.info.render.triangles,scope:g.harborWorld?.blackwater?.bundleDiagnostics?.enabled?'Untimed native direct-encoder counters; cached opaque bundle commands/geometry excluded; not FPS':'Untimed actual fixed-phase frame counters, including any submitted shadow work; not FPS'},fov:g.camera.fov,cameraProjection:{near:g.camera.near,far:g.camera.far,coordinateSystem:g.camera.coordinateSystem,reversedDepth:g.camera.reversedDepth,projectionMatrix:g.camera.projectionMatrix.toArray(),matrixWorld:g.camera.matrixWorld.toArray()},pitch:q.run.pitch,canvas:[c.width,c.height],rendererMemory:{...g.renderer.info.memory},recHud:!!document.querySelector('#bodycam-hud')};},{name,time:fixedCaptureTime}));
  }finally{
   if(fixedCaptureTime!==null)await page.evaluate(()=>{const held=window.__ISLAND_CAPTURE_RENDER__;if(held){held.g.render=held.render;held.g.renderer.info.autoReset=held.infoAutoReset;delete window.__ISLAND_CAPTURE_RENDER__;}}).catch(()=>{});
  }
  console.log('Captured',name);await writeFile(output+'/street-progress.json',JSON.stringify(report,null,2));
 };
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

 const cityOnly=process.env.ISLAND_QA_CITY_LIFE_ONLY==='1';
 if(!cityOnly){
 report.scope='Island building, forest, and basement visual acceptance in actual native WebGPU game. Four existing unused startup warmups omitted in this owned browser. Controlled static views and real E area transitions; no full-startup, combat performance or co-op claim.';
 const flight=async(position,target)=>{
  await page.evaluate(({position,target})=>{const q=window.__DEAD_ARRIVAL__;if(!q.inspector.active)q.requestInspector();const [x,y,z]=position,[tx,ty,tz]=target;Object.assign(q.inspector.pose,{x,y,z,angle:Math.atan2(tz-z,tx-x),pitch:Math.atan2(ty-y,Math.hypot(tx-x,tz-z))});q.renderer.freeCamera=q.inspector.pose;},{position,target});await settle();
 };
 await flight([25,210,-30],[225,0,200]);await capture('island-overview');
 if(process.env.ISLAND_QA_ROOF_PLANE==='1'){
  const roofEvidence=await page.evaluate(()=>{
   const g=window.__DEAD_ARRIVAL__.renderer,consumers=[];
   g.scene.traverse(o=>{
    if(!o.isMesh||o.material?.userData?.graphicSurface?.coordinates!=='owned roofPlane physical metres before placement yaw')return;
    const p=o.geometry.getAttribute('roofPlane');
    if(!p||p.itemSize!==4||p.count!==o.geometry.attributes.position.count)throw new Error('Registered roof draw has missing physical frame: '+o.name);
    const types={};for(let i=0;i<p.count;i++){const t=p.getW(i);types[t]=(types[t]||0)+1;}
    consumers.push({name:o.name,visible:o.visible,types,attributeBytes:p.array.byteLength});
   });
   const fragments=[...g.renderer._pipelines.programs.fragment.values()].filter(p=>/^look-cartoon-roof(?:Zinc)?$/.test(p.name)).map(p=>({name:p.name,code:p.code}));
   return {consumers,fragments,scope:'Read-only already-compiled native WGSL and actual registered geometry; no diagnostic render or new program'};
  });
  assert.ok(roofEvidence.consumers.length>0,'Physical roof consumers registered');
  assert.ok(roofEvidence.consumers.some(c=>c.types['1']),'Actual zinc roof frame');
  assert.ok(roofEvidence.consumers.some(c=>c.types['1.25']),'Actual monitor seat frame');
  assert.ok(roofEvidence.consumers.some(c=>c.types['2']),'Actual residential covering frame');
  assert.ok(roofEvidence.fragments.length>0,'Compiled roof fragment WGSL available');
  await writeFile(output+'/roof-plane-native-evidence.json',JSON.stringify(roofEvidence,null,2));
  report.roofPlane={consumers:roofEvidence.consumers.length,fragments:roofEvidence.fragments.map(p=>({name:p.name,bytes:Buffer.byteLength(p.code),sha256:createHash('sha256').update(p.code).digest('hex')})),scope:roofEvidence.scope};
 }
 if(process.env.ISLAND_QA_SHARED_DAYLIGHT==='1'){
  report.coastalDaylight=await page.evaluate(async()=>{
   const {COASTAL_DAYLIGHT}=await import('/coastal-daylight-profile.js');
   const g=window.__DEAD_ARRIVAL__.renderer,h=g.harborWorld;
   const describe=light=>({name:light.name,direction:light.position.clone().sub(light.target.position).normalize().toArray(),mapSize:light.shadow.mapSize.toArray(),autoUpdate:light.shadow.autoUpdate});
   return{profile:COASTAL_DAYLIGHT.direction,lights:[describe(h.blackwaterSun),describe(h.forestSun),describe(g._worldKeyLight)],buildingCoverage:h.blackwaterShadowCoverage.diagnostics(),forestCoverage:h.forestShadowCoverage.diagnostics()};
  });
  for(const light of report.coastalDaylight.lights)assert.ok(light.direction.every((v,i)=>Math.abs(v-report.coastalDaylight.profile[i])<1e-9),'Actual daylight owner uses shared direction: '+light.name);
  assert.deepEqual(report.coastalDaylight.lights[0].mapSize,[2048,2048]);assert.deepEqual(report.coastalDaylight.lights[1].mapSize,[1536,1536]);
  assert.equal(report.coastalDaylight.lights[0].autoUpdate,false);assert.equal(report.coastalDaylight.lights[1].autoUpdate,false);
 }
 if(process.env.ISLAND_QA_STATIC_BATCHES==='1'){
  report.staticBatchTransforms=await page.evaluate(async()=>{
   const q=window.__DEAD_ARRIVAL__,g=q.renderer,render=g.render,leaves=[];
   g.scene.traverse(o=>{if(o.isMesh&&o.userData.blackwaterBuildingBatch===true)leaves.push(o);});
   const saved=leaves.map(o=>({o,update:o.updateMatrix,auto:o.matrixAutoUpdate}));let calls=0;
   const matrices=()=>JSON.stringify(leaves.map(o=>o.matrixWorld.elements));
   const frame=async()=>{await new Promise(requestAnimationFrame);render.call(g,q.run,5000);await g.renderer.backend.device.queue.onSubmittedWorkDone();};
   g.render=()=>{};
   try{
    for(const p of saved)p.o.updateMatrix=function(){calls++;return p.update.call(this);};
    await frame();const optimizedCalls=calls,optimizedMatrices=matrices();
    calls=0;for(const p of saved)p.o.matrixAutoUpdate=true;
    await frame();const automaticCalls=calls,worldMatricesEqual=matrices()===optimizedMatrices;
    return{scope:'Untimed native local-matrix work counter; not FPS',leaves:leaves.length,allFrozen:saved.every(p=>p.auto===false),optimizedCalls,automaticCalls,worldMatricesEqual};
   }finally{for(const p of saved){p.o.updateMatrix=p.update;p.o.matrixAutoUpdate=p.auto;}g.render=render;}
  });
  assert.ok(report.staticBatchTransforms.leaves>0);
  assert.equal(report.staticBatchTransforms.allFrozen,true);
  assert.equal(report.staticBatchTransforms.optimizedCalls,0);
  assert.ok(report.staticBatchTransforms.automaticCalls>=report.staticBatchTransforms.leaves);
  assert.equal(report.staticBatchTransforms.worldMatricesEqual,true);
  await settle();
 }
 if(process.env.ISLAND_QA_COLLISION_INDEX==='1'){
  report.collisionBroadphase=await page.evaluate(async()=>{
   const {propCollisionDiagnostics}=await import('/harbor-collision.js');
   const course=window.__DEAD_ARRIVAL__.run.course;
   return {...propCollisionDiagnostics(course),arrayFrozen:Object.isFrozen(course.obstacles),recordsFrozen:course.obstacles.every(Object.isFrozen)};
  });
  assert.ok(report.collisionBroadphase.registered&&report.collisionBroadphase.arrayFrozen&&report.collisionBroadphase.recordsFrozen,'Actual island registers complete immutable collision authority');
  assert.equal(report.collisionBroadphase.work,null,'Production movement counters remain disabled');
 }
 await measure('island-overview');
 if(process.env.ISLAND_QA_HARBOR_SERVICES==='1'){
  report.harborServices=await page.evaluate(()=>{
   const s=window.__DEAD_ARRIVAL__.renderer.harborWorld.serviceFrontages;
   return{...s.diagnostics,leaves:s.root.children.map(o=>({name:o.name,staticLocal:!o.matrixAutoUpdate,shadow:o.castShadow,version:o.instanceMatrix.version}))};
  });
  assert.equal(report.harborServices.bays,3);assert.equal(report.harborServices.parts,100);assert.equal(report.harborServices.triangles,1200);assert.equal(report.harborServices.draws,3);assert.equal(report.harborServices.matrixBytes,8192);
  assert.equal(report.harborServices.ownedMaterials,0);assert.equal(report.harborServices.ownedPrimitives,0);
  assert.equal(report.harborServices.railOpening.oldCount,40);assert.equal(report.harborServices.railOpening.newCount,39);assert.equal(report.harborServices.railOpening.removedTriangles,204);
  assert.ok(report.harborServices.leaves.every(o=>o.staticLocal&&o.shadow));
 }
 if(process.env.ISLAND_QA_RIDGE_HABITAT==='1'){
  report.ridgeHabitat=await page.evaluate(()=>{
   const w=window.__DEAD_ARRIVAL__.renderer.harborWorld,plants=w.course.coastal.understoryPlacements,added=plants.filter(p=>p.id.startsWith('ridge-habitat-'));
   return{plants:plants.length,added:added.length,grass:added.filter(p=>p.kind==='grass').length,shrubs:added.filter(p=>p.kind==='shrub').length,
    diagnostics:{...w.understory.diagnostics},versions:w.understory.root.children.map(o=>[o.name,o.instanceMatrix.version,o.instanceColor.version]),
    shadowCasters:w.understory.root.children.filter(o=>o.castShadow).length};
  });
  const courtLane=process.env.ISLAND_QA_COURT_LANE==='1';
  assert.equal(report.ridgeHabitat.plants,courtLane?5994:5745);assert.equal(report.ridgeHabitat.added,1342);assert.equal(report.ridgeHabitat.grass,1200);assert.equal(report.ridgeHabitat.shrubs,142);
  assert.equal(report.ridgeHabitat.diagnostics.batches,courtLane?82:80);assert.equal(report.ridgeHabitat.shadowCasters,0);assert.equal(report.ridgeHabitat.diagnostics.sharedGeometries,3);assert.equal(report.ridgeHabitat.diagnostics.materials,2);
  if(courtLane){
   report.courtLaneUnderstory=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.course.coastal.courtLaneUnderstory);
   assert.equal(report.courtLaneUnderstory.before,5745);assert.equal(report.courtLaneUnderstory.after,5994);assert.equal(report.courtLaneUnderstory.added,251);
   assert.equal(report.courtLaneUnderstory.reanchored.length,51);assert.deepEqual(report.courtLaneUnderstory.retired,['understory-1120','understory-1191']);
   assert.equal(report.courtLaneUnderstory.regrounded.length,2);
  }
 }
 if(process.env.ISLAND_QA_RESIDENTIAL_RIDGE==='1'){
  report.residentialRidge=await page.evaluate(async()=>{
   const {capeGroundHeight}=await import('/coastal-terrain.js');
   const samples=[[432,24],[432,84],[412,24],[412,84],[442,65]];
   return samples.map(([x,z])=>({x,z,height:capeGroundHeight(x,z),oldHeight:capeGroundHeight(x,z,{residentialRidge:false})}));
  });
  assert.ok(report.residentialRidge[0].height>5&&report.residentialRidge[1].height>3.5,'Native unequal shoulders exist');
  assert.ok(report.residentialRidge[2].height<0&&report.residentialRidge[3].height<0,'Native lee basins exist');
  assert.equal(report.residentialRidge[4].height,report.residentialRidge[4].oldHeight,'Original heath camera access stays exact');
 }
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
 if(process.env.ISLAND_QA_LOGGIA_REVIEW==='1'){
  await flight([269,9,57],[280,10,64]);await capture('saltwind-loggia-oblique');
 }
 if(process.env.ISLAND_QA_TOWN_DETAILS==='1'){
  report.townDetails=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.townDetails.diagnostics);
  if(process.env.ISLAND_QA_TIMBER_WORKSPACE==='1'){
   assert.equal(report.townDetails.colliders,15);assert.equal(report.townDetails.timberWorkspace.parts,41);
   assert.equal(report.townDetails.timberWorkspace.triangles,492);
  }
  if(process.env.ISLAND_QA_CABLE_REPAIR==='1'){
   assert.equal(report.townDetails.parts,590);assert.equal(report.townDetails.triangles,39820);
   assert.equal(report.townDetails.draws,29);assert.equal(report.townDetails.colliders,15);
   assert.equal(report.townDetails.cableRepair.parts,15);assert.equal(report.townDetails.cableRepair.triangles,208);
  }
  if(process.env.ISLAND_QA_TOWN_WOOD==='1'){
   report.nativeTownWood=await page.evaluate(()=>{
    const world=window.__DEAD_ARRIVAL__.renderer.harborWorld,materials=new Set();let instances=0,attributeBytes=0;
    world.townDetails.root.traverse(o=>{if(o.isMesh&&o.material.userData.nativeTownWood){materials.add(o.material);instances+=o.count;attributeBytes+=o.geometry.attributes.townWoodPiece.array.byteLength;}});
    return{instances,attributeBytes,borrowedBoxAttribute:world.unitBox.hasAttribute('townWoodPiece'),graphs:[...materials].map(m=>({native:m.isMeshStandardNodeMaterial,color:!!m.colorNode,roughness:!!m.roughnessNode,filtered:m.userData.derivativeFiltered,microNormalStrength:m.userData.microNormalStrength}))};
   });
   assert.equal(report.nativeTownWood.instances,283);assert.equal(report.nativeTownWood.attributeBytes,6400);
   assert.equal(report.nativeTownWood.borrowedBoxAttribute,false);assert.equal(report.nativeTownWood.graphs.length,1);
   assert.ok(report.nativeTownWood.graphs.every(g=>g.native&&g.color&&g.roughness&&g.filtered&&g.microNormalStrength===0));
  }
  if(process.env.ISLAND_QA_CUSTOMS_GALLERY==='1'){
   report.customsGallery=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.basementGallery.diagnostics);
   assert.equal(report.customsGallery.triangles,228);assert.equal(report.customsGallery.colourSubmissions,3);assert.equal(report.customsGallery.shadowSubmissions,1);
  }
  assert.ok(report.townDetails.triangles>0,'Town detail must exist in the actual game');
  await flight([278,1.7,59],[273.8,1.0,63.2]);await capture('residential-garden');
  await flight([299,1.7,114],[293.8,.9,119.2]);await capture('workshop-repair-pocket');
  await flight([325,1.7,172],[330.2,.85,168.8]);await capture('workshop-timber-yard');
  if(process.env.ISLAND_QA_WOOD_NEAR_REVIEW==='1'){
   await flight([326.6,1.35,171.2],[327.2,.94,168.8]);await capture('timber-grain-near');
// OUTPUT-ONLY integration snippet. Parent owns tests/island-world-browser.mjs.
// Insert after the existing timber-grain-near normal capture, before near-shift.
// Requires existing page, flight, capture, report, assert bindings. One untimed
// diagnostic in the already-owned native session; never launch another browser.
if(process.env.ISLAND_QA_WOOD_RING_DIAGNOSTIC==='1'){
 await flight([326.6,1.35,171.2],[327.2,.94,168.8]);
 try{
  await page.evaluate(async()=>{
   const q=window.__DEAD_ARRIVAL__,g=q.renderer,b=g.renderer.backend;
   if(window.__TOWN_WOOD_RING_PROBE__)throw new Error('Wood probe already active');
   const saved=window.__TOWN_WOOD_RING_PROBE__={g,b,render:g.render,draw:b.draw,materials:[],draws:new Map(),beforeCamera:null,beforeVersions:[]};
   const owned=new Set();g.harborWorld.townDetails.root.traverse(o=>{if(o.isMesh&&o.material.userData.nativeTownWood)owned.add(o.material);});
   if(owned.size!==1)throw new Error('Expected one existing native wood graph');
   for(const m of owned){const debug=m.userData.debug;if(!debug||typeof debug.value!=='number')throw new Error('Existing ring debug uniform unavailable');saved.materials.push({debug,value:debug.value});}
   g.harborWorld.townDetails.root.traverse(o=>{if(o.isMesh&&owned.has(o.material)){const a=o.geometry.attributes.townWoodPiece;if(!a?.isInstancedBufferAttribute)throw new Error('Expected existing dimension/seed instance attribute');saved.beforeVersions.push({o,a,version:a.version});}});
   // Hold autonomous frames so the captured pixels belong to this exact draw.
   // Keep original full render/camera/shadows; fixed time is diagnostic only.
   g.render=()=>{};
   for(const p of saved.materials)p.debug.value=1;
   b.draw=function(ro,...args){
    const result=saved.draw.call(this,ro,...args),o=ro.object;
    if(o?.isMesh&&owned.has(o.material)){
     const a=o.geometry.attributes.townWoodPiece;
     const key=o.uuid+'/'+(ro.material===o.material?'ordinary-material':ro.material?.type||'override');
     if(!saved.draws.has(key))saved.draws.set(key,{
      name:o.name,uuid:o.uuid,submittedMaterial:ro.material?.name||'',submittedMaterialType:ro.material?.type||'',
      ordinaryMaterial:ro.material===o.material,count:o.count,capacity:a.count,attributeVersion:a.version,
      // These are the actual full active entries of the submitted bin, not
      // frustum guesses or only the first entry. Buffer remains unmodified.
      parameters:Array.from({length:o.count},(_,i)=>Array.from(a.array.subarray(i*4,i*4+4))),
      instanceMatrices:Array.from(o.instanceMatrix.array.subarray(0,o.count*16)),
      worldMatrix:Array.from(o.matrixWorld.elements)
     });
    }
    return result;
   };
   await new Promise(requestAnimationFrame);saved.render.call(g,q.run,5000);await b.device.queue.onSubmittedWorkDone();
   saved.beforeCamera={world:Array.from(g.camera.matrixWorld.elements),projection:Array.from(g.camera.projectionMatrix.elements),fov:g.camera.fov};
  });
  await capture('timber-filtered-ring-debug');
  report.townWoodRingDiagnostic=await page.evaluate(()=>{
   const s=window.__TOWN_WOOD_RING_PROBE__,g=s.g;
   return{scope:'ONE untimed actual submitted-bin filtered-ring debug capture; not visibility success or FPS',
    debugValue:s.materials.map(p=>p.debug.value),camera:s.beforeCamera,
    cameraAfter:{world:Array.from(g.camera.matrixWorld.elements),projection:Array.from(g.camera.projectionMatrix.elements),fov:g.camera.fov},
    attributeVersionIncrements:s.beforeVersions.map(p=>p.a.version-p.version),submittedBins:[...s.draws.values()]};
  });
  assert.deepEqual(report.townWoodRingDiagnostic.cameraAfter,report.townWoodRingDiagnostic.camera);
  assert.ok(report.townWoodRingDiagnostic.attributeVersionIncrements.every(v=>v===0));
  assert.ok(report.townWoodRingDiagnostic.submittedBins.some(b=>b.ordinaryMaterial),'Need actual native ordinary wood submission, not graph presence only');
 }finally{
  // Restore even on capture/readback/assertion failures; no resource creation,
  // material replacement or shader/node-builder lazy calls in this probe.
  await page.evaluate(async()=>{
   const s=window.__TOWN_WOOD_RING_PROBE__;if(!s)return;
   for(const p of s.materials)p.debug.value=p.value;
   s.b.draw=s.draw;
   try{const q=window.__DEAD_ARRIVAL__;s.render.call(s.g,q.run,5000);await s.b.device.queue.onSubmittedWorkDone();}
   finally{s.g.render=s.render;delete window.__TOWN_WOOD_RING_PROBE__;}
  });
 }
 await capture('timber-normal-restored');
 // Interpret raw debug pixels manually. Piece-following variation narrows the
 // issue to final finish contrast; uniform .5 keeps filter/binding unresolved.
 // No amplitude change or acceptance follows merely from successful capture.
}

   await flight([326.68,1.35,171.2],[327.28,.94,168.8]);await capture('timber-grain-near-shift');
   await flight([325,2.4,177],[330.2,.85,168.8]);await capture('timber-grain-distance');
  }
  if(process.env.ISLAND_QA_INDUSTRIAL_FRONTAGE==='1'){
   assert.equal(report.townDetails.industrialFrontage.parts,65);
   assert.equal(report.townDetails.industrialFrontage.triangles,780);
   await flight([290,1.7,113.8],[290,4.4,125]);await capture('industrial-receiving-repair-hall');
  }
 }
 if(process.env.ISLAND_QA_PORT_DETAILS==='1'){
  await flight([39,1.7,62],[27,1.3,69.3]);await capture('netmakers-work-apron');
  await flight([46,1.7,62],[56,1.1,69.5]);await capture('depot-maintenance-apron');
 }
 if(process.env.ISLAND_QA_ROOT_FOOTING==='1'){
  report.rootFooting=await page.evaluate(async()=>{
   const {capeGroundHeight}=await import('/coastal-terrain.js');
   let peak=0,low=0,pathDelta=0;
   for(let x=330;x<=342;x+=.25)for(let z=381;z<=394;z+=.25){const d=capeGroundHeight(x,z)-capeGroundHeight(x,z,{rootFooting:false});peak=Math.max(peak,d);low=Math.min(low,d);}
   for(let x=338.5;x<=341.5;x+=.125)for(let z=380;z<=395;z+=.125)pathDelta=Math.max(pathDelta,Math.abs(capeGroundHeight(x,z)-capeGroundHeight(x,z,{rootFooting:false})));
   return{peak,low,pathDelta};
  });
  assert.ok(report.rootFooting.peak>=.45&&report.rootFooting.peak<=.55);
  assert.ok(report.rootFooting.low<=-.20&&report.rootFooting.low>=-.25);
  assert.equal(report.rootFooting.pathDelta,0);
 }
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
 if(process.env.ISLAND_QA_ENVIRONMENT_REVIEW==='1'){
  await flight([37,3,133],[25,0,128]);await capture('moored-boats');
  if(process.env.ISLAND_QA_BOAT_PHASES==='1'){
   await page.evaluate(()=>{const g=window.__DEAD_ARRIVAL__.renderer;window.__BOAT_PHASE_RENDER__=g.render;window.__BOAT_PHASE__=0;g.render=function(run){return window.__BOAT_PHASE_RENDER__.call(this,run,window.__BOAT_PHASE__*1000);};});
   try{
    report.maritimeMotionPhases=[];
    for(const phase of [0,1.8,3.7]){
     await page.evaluate(t=>window.__BOAT_PHASE__=t,phase);await settle();await capture('moored-boat-wave-'+String(phase).replace('.','-'));
     const motion=await page.evaluate(async t=>{
      const w=window.__DEAD_ARRIVAL__.renderer.harborWorld,owner=w.maritime;
      if(typeof owner.getPose!=='function')return{phase:t,motion:'static'};
      const {coastalSurfaceHeightAt}=await import('/coastal-water.js');
      const centres=w.course.coastal.maritime.boats.map((p,i)=>{
       const matrix=owner.getPose(i+1,owner.root.matrix.clone()).elements;
       const actual=[matrix[0]*p.x+matrix[4]*p.y+matrix[8]*p.z+matrix[12],matrix[1]*p.x+matrix[5]*p.y+matrix[9]*p.z+matrix[13],matrix[2]*p.x+matrix[6]*p.y+matrix[10]*p.z+matrix[14]];
       return{id:p.id,actual,expected:[p.x,p.y+coastalSurfaceHeightAt(p.x,p.z,t),p.z]};
      });
      return{phase:t,motion:'shared wave rigid pose',waterTime:w.water.material.uniforms.time.value,centres,
       carMatrix:owner.getPose(0,owner.root.matrix.clone()).elements.slice(),
       graphs:owner.root.children.map(o=>({position:!!o.material.positionNode,normal:!!o.material.normalNode})),
       versions:owner.root.children.map(o=>Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,a.version])))};
     },phase);
     report.maritimeMotionPhases.push(motion);
     if(motion.motion!=='static'){
      assert.equal(motion.waterTime,phase,'Boat poses and displaced water consume identical time');
      for(const centre of motion.centres)for(let i=0;i<3;i++)assert.ok(Math.abs(centre.actual[i]-centre.expected[i])<1e-8,'Actual runtime rigid centre agrees with shared water');
      assert.deepEqual(motion.carMatrix,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],'Native pose buffer retains car identity');
      assert.ok(motion.graphs.every(g=>g.position&&g.normal),'Native boat draws retain motion and normal graphs');
      assert.deepEqual(motion.versions,report.maritimeMotionPhases[0].versions,'Wave motion leaves every geometry attribute version unchanged');
     }
    }
    await flight([17,3,133],[25,0,128]);await capture('moored-boat-opposite');
   }finally{await page.evaluate(()=>{const g=window.__DEAD_ARRIVAL__.renderer;g.render=window.__BOAT_PHASE_RENDER__;delete window.__BOAT_PHASE_RENDER__;delete window.__BOAT_PHASE__;});}
  }
  await flight([12,3,60],[5,1,53]);await capture('parked-estate');
  await flight([275,3,176],[268,1,180.45]);await capture('works-van');
  await flight([340,1.6,376],[335,.4,382]);await capture('forest-floor');
  if(process.env.ISLAND_QA_FOREST_MATERIAL==='1'){
   report.nativeGround=await page.evaluate(()=>{const w=window.__DEAD_ARRIVAL__.renderer.harborWorld,materials=new Set();let meshes=0;w.terrain.root.traverse(o=>{if(o.isMesh&&o.material.userData.nativeTerrainPBR){meshes++;materials.add(o.material);}});return{meshes,materials:materials.size,graphs:[...materials].map(m=>({type:m.type,native:!!m.isMeshStandardNodeMaterial,color:!!m.colorNode,roughness:!!m.roughnessNode,normal:!!m.normalNode})),terrain:w.diagnostics.terrain};});
   assert.ok(report.nativeGround.meshes>=54);assert.equal(report.nativeGround.materials,1);assert.ok(report.nativeGround.graphs.every(m=>m.native&&m.color&&m.roughness&&m.normal),'Authored ground graph must survive runtime adapters');
   if(process.env.ISLAND_QA_FRONT_TERRAIN==='1'){
    const groveTerrain=process.env.ISLAND_QA_GROVE_TERRAIN==='1';
    const courtLane=process.env.ISLAND_QA_COURT_LANE==='1';
    assert.equal(report.nativeGround.terrain.chunks,courtLane?67:groveTerrain?63:62);assert.equal(report.nativeGround.terrain.triangles,courtLane?108416:groveTerrain?106112:105472);
    if(courtLane){const lane=report.nativeGround.terrain.courtLane;assert.equal(lane.chunks,4);assert.equal(lane.triangles,2304);assert.equal(lane.geometryBytes,414720);assert.equal(lane.baseChunks,63);assert.equal(lane.baseTriangles,106112);assert.equal(lane.sharedMaterial,true);assert.equal(lane.sharedTextures,true);}
    assert.equal(report.nativeGround.terrain.front.chunks,8);assert.equal(report.nativeGround.terrain.front.triangles,15360);
    assert.equal(report.nativeGround.terrain.front.sharedMaterial,true);assert.equal(report.nativeGround.terrain.front.sharedTextures,true);
    if(process.env.ISLAND_QA_HEIGHT_CACHE==='1'){
     const cache=report.nativeGround.terrain.hierarchyHeightCache;
     assert.equal(cache.requests,45315);assert.equal(cache.queries,9174);
     assert.equal(cache.hits,36141);assert.equal(cache.retainedBytes,0);
    }
   }
   if(process.env.ISLAND_QA_GLASS_MATERIAL==='1'){
    report.nativeGlass=await page.evaluate(()=>{const materials=new Set();let meshes=0;window.__DEAD_ARRIVAL__.renderer.harborWorld.blackwater.root.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.lookRole==='glass'){meshes++;materials.add(m);}}});return{meshes,materials:materials.size,graphs:[...materials].map(m=>({type:m.type,native:!!m.isMeshStandardNodeMaterial,color:!!m.colorNode,roughness:!!m.roughnessNode,reflection:!!m.emissiveNode,scope:m.userData.reflectionScope}))};});
    assert.ok(report.nativeGlass.meshes>0);assert.ok(report.nativeGlass.graphs.every(m=>m.native&&m.color&&m.roughness&&m.reflection),'Window optics must survive actual native game adapters');
   }
   await page.evaluate(()=>{const w=window.__DEAD_ARRIVAL__.renderer.harborWorld;window.__FOREST_RECEIVE__=[];w.terrain.root.traverse(o=>{if(o.isMesh){window.__FOREST_RECEIVE__.push([o,o.receiveShadow]);o.receiveShadow=false;o.material.needsUpdate=true;}});});
   await settle();await capture('forest-floor-unshadowed');
   await page.evaluate(()=>{for(const [o,receive]of window.__FOREST_RECEIVE__){o.receiveShadow=receive;o.material.needsUpdate=true;}delete window.__FOREST_RECEIVE__;});await settle();
  }
 await flight([412,21,402],[361,3,373]);await capture('outer-forest-coast');
  if(process.env.ISLAND_QA_COAST_HEATH_REVIEW==='1'){
   await flight([442,2.4,65],[431,.9,74]);await capture('windward-coastal-heath');
   if(process.env.ISLAND_QA_RIDGE_HABITAT==='1'){
    await measure('windward-coastal-heath');
    report.ridgeHabitat.heath=await page.evaluate(()=>{
     const u=window.__DEAD_ARRIVAL__.renderer.harborWorld.understory;
     return{diagnostics:{...u.diagnostics},versions:u.root.children.map(o=>[o.name,o.instanceMatrix.version,o.instanceColor.version])};
    });
    assert.deepEqual(report.ridgeHabitat.heath.versions,report.ridgeHabitat.versions,'Changing view and wind does not upload static understory transforms/colors');
   }
  }
  if(process.env.ISLAND_QA_GROVE_COURT==='1'){
   const ground=await page.evaluate(async()=>{const {capeGroundHeight}=await import('/coastal-terrain.js');return capeGroundHeight(387,268);});
   await flight([387,ground+1.7,268],[352,1.3,268]);await capture('grove-court-habitat-corridor');
  }
  report.maritime=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.maritime.diagnostics);assert.equal(report.maritime.boats,3);assert.equal(report.maritime.cars,expectedCarCount);assert.equal(report.maritime.drawCalls,9);
 }
 if(process.env.ISLAND_QA_VISUALS_ONLY!=='1'){
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;if(q.inspector.active)q.requestInspector();const p=q.run.course.basementPortal;Object.assign(q.run,{x:p.x,y:p.y,z:0,angle:p.angle,pitch:0,vx:0,vy:0,vz:0});window.advanceTime(0);});await settle();
 report.surfacePortal=await page.evaluate(async()=>{const q=window.__DEAD_ARRIVAL__,r=q.run,{basementPrompt}=await import('/island-basement.js');return{portal:r.course.basementPortal,health:r.health,screen:q.screen,mode:r.mode,interior:r.course.activeInterior,z:r.z,bite:r.bite?.phase,brutal:r.brutal?.phase,extraction:r.extraction?.phase,prompt:basementPrompt(r)};});console.log('Portal before E',JSON.stringify(report.surfacePortal));
 await page.keyboard.press('e');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play'&&window.__DEAD_ARRIVAL__?.run.course.dungeon,null,{timeout:240000});
 await settle();await capture('dungeon-arrival');
 report.basementArrival=await page.evaluate(()=>({name:window.__DEAD_ARRIVAL__.run.course.name,portal:window.__DEAD_ARRIVAL__.run.course.basementPortal,health:window.__DEAD_ARRIVAL__.run.health}));
 await page.keyboard.press('e');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play'&&window.__DEAD_ARRIVAL__?.run.course.harbor,null,{timeout:240000});await settle();await capture('island-return');
 report.surfaceReturn=await page.evaluate(()=>({portal:window.__DEAD_ARRIVAL__.run.course.basementPortal,health:window.__DEAD_ARRIVAL__.run.health}));
 assert.equal(report.surfaceReturn.health,report.surfacePortal.health);assert.equal(report.basementArrival.health,report.surfacePortal.health);
 if(process.env.ISLAND_QA_RETURN_WALK==='1'){
  const before=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;return{x:r.x,y:r.y,angle:r.angle};});
  await page.keyboard.down('w');try{await page.evaluate(()=>window.advanceTime(2000));}finally{await page.keyboard.up('w');}
  await settle();await capture('island-return-walk');
  report.returnWalk=await page.evaluate(before=>{const r=window.__DEAD_ARRIVAL__.run;return{before,after:{x:r.x,y:r.y,angle:r.angle},distanceMetres:Math.hypot(r.x-before.x,r.y-before.y)*4,health:r.health};},before);
  assert.ok(report.returnWalk.distanceMetres>12,'Two unsteered seconds follow the clear island street');assert.equal(report.returnWalk.after.angle,before.angle);assert.ok(report.returnWalk.health>0);
 }
 }else report.scope+=' This run checks the revised island art; the area round trip is recorded separately.';
 if(process.env.ISLAND_QA_COURT_LANE==='1'){report.courtLaneJourney={};await verifyCourtLaneJourney(page,settle,report.courtLaneJourney);}
 }else report.scope=process.env.ISLAND_QA_CITY_PERFORMANCE_ONLY==='1'?'Focused native warmed render and engine cost diagnostic plus live mainRAF sample; no city input gameplay retest or original map acceptance.':'Focused native city gameplay and live performance retest; original map/basement/court acceptance retained separately with explicit snapshot provenance. No fabricated single-run48 acceptance.';
 if(process.env.ISLAND_QA_CITY_LIFE==='1'&&process.env.ISLAND_QA_CITY_PERFORMANCE_ONLY!=='1'){report.cityLifeGameplay={};await verifyCityLifeGameplay(page,settle,capture,report.cityLifeGameplay);}
 if(process.env.ISLAND_QA_CITY_LIFE==='1'){
  if(process.env.ISLAND_QA_CITY_PROFILE==='1'||process.env.ISLAND_QA_CITY_PERFORMANCE_ONLY==='1'){report.cityFrameProfile={};await profileCityFrame(page,report.cityFrameProfile);}
  report.cityPerformance={};await verifyCityPerformance(page,settle,report.cityPerformance);
  if(process.env.ISLAND_QA_CITY_PERFORMANCE_ONLY==='1'){await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;Object.assign(q.run,{x:58,y:58,z:0,angle:Math.atan2(112-232,192-232),pitch:0,supportZ:null,supportId:null,structureId:null});q.renderer._firstCameraFrame=true;window.advanceTime(0);});await settle();await capture('city-live-performance-view');
   report.frontageDensityProof=await page.evaluate(async()=>{
    const q=window.__DEAD_ARRIVAL__,r=q.run,{canStand}=await import('/engine.js'),scene=r.course.coastal.cityLife.communities.find(c=>c.story==='abandoned-workshop-frontage');
    if(!scene)return{present:false};
    const sites=[[225.1,228.1],[225.5,229.5],[226.3,229]].filter(([x,z])=>canStand(r.course,x/4,z/4,.12)&&r.vehiclePhysics.stand(x/4,z/4,.12));
    if(!sites.length)throw new Error('No legal bounded ordinary frontage approach camera');const[x,z]=sites[0];
    Object.assign(r,{x:x/4,y:z/4,z:0,angle:Math.atan2(219-z,224.1-x),pitch:-.08,supportZ:null,supportId:null,structureId:null});q.renderer._firstCameraFrame=true;window.advanceTime(0);
    return{present:true,community:scene,player:[x,z],legal:true,camera:q.renderer.camera.getWorldPosition(q.renderer.camera.position.clone()).toArray(),fov:q.renderer.camera.fov};
   });
   if(report.frontageDensityProof.present){await settle();await capture('city-workshop-frontage-approach');}
  }
 }

 await input('end');assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.httpErrors.length,0);assert.ok(report.views.every(v=>v.canvas.every(n=>n>0)));
 for(const [f,h]of Object.entries(sourceHashes))assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h,'Immutable input changed '+f);
 report.passed=true;console.log('Island world acceptance passed');
}catch(e){report.passed=false;report.failure=String(e.stack||e);if(page&&!page.isClosed()){report.failureState=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,g=q?.renderer,r=q?.run;return{screen:q?.screen,mode:r?.mode,dungeon:r?.course?.dungeon,harbor:r?.course?.harbor,prepared:g?._preparedCourse?.name,course:g?._course?.name,stage:g?._preparationStage,visible:document.visibilityState,focus:document.hasFocus(),bite:r?.bite?.phase,brutal:r?.brutal?.phase,extraction:r?.extraction?.phase,interior:r?.course?.activeInterior,z:r?.z};}).catch(()=>null);await page.screenshot({path:output+'/failure.png',timeout:10000}).catch(()=>{});report.deviceLoss=await page.evaluate(()=>window.__STREET_DEVICE_LOSS__??null).catch(()=>null);report.finalInputSafety=await backgroundInputState(page).catch(()=>null);}throw e;}
finally{await browser?.close();await new Promise((resolve,reject)=>server.server.close(error=>error?reject(error):resolve()));report.cleanup={browserClosed:true,ownedServerClosed:!server.server.listening};await writeFile(output+'/report.json',JSON.stringify(report,null,2));}
