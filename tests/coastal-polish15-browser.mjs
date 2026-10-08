import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const root=resolve(process.env.STREET_QA_ROOT||'dist');
const output=process.env.STREET_QA_OUTPUT||'output/playwright/blackwater-15/native-v1';
const label=process.env.STREET_QA_LABEL||'15';
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
files.push('coastal-terrain.js','coastal-terrain-fields.js','coastal-terrain-visuals.js','assets/forest-kit/bank-detail.js','cape-river.js','forest-vegetation.js');
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
 const capture=async suffix=>{const name=label+'-'+suffix;await input(name);await page.screenshot({path:output+'/'+name+'.png'});report.views.push(await page.evaluate(name=>{const q=window.__DEAD_ARRIVAL__,g=q.renderer,c=g.renderer.domElement;return{name,player:[q.run.x*4,q.run.y*4],camera:g.camera.getWorldPosition(g.camera.position.clone()).toArray(),fov:g.camera.fov,pitch:q.run.pitch,canvas:[c.width,c.height],rendererMemory:{...g.renderer.info.memory},recHud:!!document.querySelector('#bodycam-hud')};},name));console.log('Captured',name);await writeFile(output+'/street-progress.json',JSON.stringify(report,null,2));};

 report.scope='Actual native WebGPU river/forest iteration. Controlled initial bridge approach and later fixed views. Four unused startup warmups omitted in this owned browser. Full-quality materials, camera, shadows and foliage; actual W bridge traversal with aim-only steering, no position writes during walking, enemy cohort omitted only for that bounded check. No full-startup, combat FPS or phone hardware claim.';
 report.world=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,w=q.renderer.harborWorld;return{terrain:w.diagnostics.terrain,understory:w.diagnostics.understory,trees:w.forest.diagnostics,enterable:w.blackwater.diagnostics.enterable.length};});
 assert.equal(report.world.enterable,94);assert.equal(report.world.understory.plants,2433);assert.ok(report.world.terrain.bankDetail.triangles<=14000);
 await input('start');await settle();await capture('bridge-approach');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q._qaEnemies=q.run.course.enemies;q.run.course.enemies=[];});
 const walkTo=async(x,z)=>{await page.keyboard.down('w');let result;try{result=await page.evaluate(({x,z})=>{const q=window.__DEAD_ARRIVAL__,r=q.run,g=q.renderer,draw=g.render;g.render=()=>{};let frames=0,reached=false;try{for(;frames<2200;frames++){if(Math.hypot(x/4-r.x,z/4-r.y)<.03){reached=true;break;}r.angle=Math.atan2(z/4-r.y,x/4-r.x);window.advanceTime(1000/120);}}finally{g.render=draw;window.advanceTime(0);}return{target:[x,z],player:[r.x*4,r.y*4],jumpOffsetMetres:r.z*4,supportZ:r.supportZ,frames,reached,screen:q.screen};},{x,z});}finally{await page.keyboard.up('w');}assert.equal(result.reached,true,JSON.stringify(result));assert.equal(result.screen,'play');return result;};
 report.bridgeWalk={scope:'Actual W across both bridge ramps to the north forest path; steering changes aim only. Enemy simulation omitted for this bounded input check.',steps:[]};
 for(const p of [[340,336],[340,341],[340,346],[340,351],[340,356],[340,366],[340,376]])report.bridgeWalk.steps.push(await walkTo(...p));
 await settle();await capture('forest-path');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q.run.course.enemies=q._qaEnemies;delete q._qaEnemies;});
 await pose(333,335,346,349,-.06);await capture('river-overview');
 await pose(328,350,310,356,-.14);await capture('shale-bank');
 await pose(346,341,350,357,-.1);await capture('bank-forest');
 await pose(405,383,390,397,-.09);await capture('woodland-slope');
 const rootClose=await page.evaluate(async()=>{const q=window.__DEAD_ARRIVAL__,c=q.run.course,{capeDetailClear}=await import('/coastal-terrain-fields.js'),{capeStreamZ}=await import('/coastal-terrain.js'),{canStand}=await import('/engine.js');const p=c.coastal.forestPlacements.filter(p=>p.z>326&&Math.abs(p.z-capeStreamZ(p.x))<22&&capeDetailClear(p.x,p.z,.35)).sort((a,b)=>Math.hypot(a.x-328,a.z-350)-Math.hypot(b.x-328,b.z-350)).find(p=>canStand(c,(p.x+1.7)/4,(p.z-1.8)/4,.16));if(!p)throw Error('No real bank root footing');return{x:p.x+1.7,z:p.z-1.8,tx:p.x,tz:p.z,treeId:p.id};});
 report.rootClose=rootClose;await pose(rootClose.x,rootClose.z,rootClose.tx,rootClose.tz,-.42);await capture('root-footing');
 report.liveTerrain=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.diagnostics.terrain);
 await input('end');assert.equal(report.errors.length,0);assert.equal(report.httpErrors.length,0);assert.ok(report.views.every(v=>v.canvas.every(n=>n>0)&&!v.recHud));
 report.textState=await page.evaluate(()=>typeof window.render_game_to_text==='function'?JSON.parse(window.render_game_to_text()):null);assert.ok(report.textState);
 for(const [f,h]of Object.entries(sourceHashes))assert.equal(createHash('sha256').update(await readFile(resolve(root,f))).digest('hex'),h,'Immutable input changed '+f);
 report.passed=true;console.log('Coastal polish 15 native checks passed');
}catch(e){report.passed=false;report.failure=String(e.stack||e);if(page&&!page.isClosed()){report.deviceLoss=await page.evaluate(()=>window.__STREET_DEVICE_LOSS__??null).catch(()=>null);report.finalInputSafety=await backgroundInputState(page).catch(()=>null);}throw e;}
finally{await browser?.close();await new Promise((resolve,reject)=>server.server.close(error=>error?reject(error):resolve()));report.cleanup={browserClosed:true,ownedServerClosed:!server.server.listening};await writeFile(output+'/report.json',JSON.stringify(report,null,2));}
