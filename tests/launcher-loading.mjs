import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=`output/playwright/launcher-loading/${process.env.STARTUP_RUN||'latest'}`;
await mkdir(output,{recursive:true});
const server=process.env.STARTUP_URL?null:await startServer({port:0,root:resolve(process.env.STARTUP_ROOT||'.')});
const url=process.env.STARTUP_URL||`http://127.0.0.1:${server.port}/`;
const action=process.env.STARTUP_ACTION||'campaign';
assert(['campaign','free-camera'].includes(action));
const report={errors:[],httpErrors:[],assetRequests:[],stages:[],compilations:[],draws:[],viewport:{width:1280,height:800},dpr:1,concurrency:Number(process.env.STARTUP_CONCURRENCY||8),budgetMs:Number(process.env.STARTUP_BUDGET||8)};
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 const page=await browser.newPage({viewport:report.viewport,deviceScaleFactor:report.dpr});
 if(process.env.STARTUP_BODYCAM==='0')await page.addInitScript(()=>localStorage.setItem('dead-arrival-prefs-v1',JSON.stringify({bodycam:false})));
 const cpu=process.env.STARTUP_CPU?await page.context().newCDPSession(page):null;
 if(cpu){await cpu.send('Profiler.enable');await cpu.send('Profiler.start');}
 await page.addInitScript(()=>{window.startupLongTasks=[];new PerformanceObserver(list=>{for(const task of list.getEntries())window.startupLongTasks.push({start:task.startTime,ms:task.duration});}).observe({type:'longtask',buffered:true});});
 page.on('pageerror',error=>report.errors.push(String(error)));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});if(response.url().endsWith('.glb'))report.assetRequests.push(response.url());});
 const started=Date.now();
 await page.goto(`${url}?debug=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});
 report.menuMs=Date.now()-started;
 report.adapter=await page.evaluate(async()=>{const backend=window.__DEAD_ARRIVAL__.renderer.renderer.backend;const adapter=backend.adapter||await navigator.gpu.requestAdapter();return adapter?.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description}:null;});
 console.log(JSON.stringify({menuMs:report.menuMs,adapter:report.adapter}));
 await page.evaluate(({concurrency,budgetMs})=>{
  const owner=window.__DEAD_ARRIVAL__.renderer;
  owner.renderer.compilationConcurrency=concurrency;
  owner.renderer.compilationBudgetMs=budgetMs;
  window.startupProfile={compilations:[],draws:[],dependencies:{},hookedAt:performance.now(),nodes:{count:0,ms:0,slow:[]},pipelines:{count:0,ms:0,slow:[]},syncPipelines:[]};
  const utils=owner.renderer.backend.pipelineUtils,create=utils.createRenderPipeline.bind(utils);
  utils.createRenderPipeline=(object,promises)=>{const start=performance.now();try{return create(object,promises);}finally{if(promises===null)window.startupProfile.syncPipelines.push({name:object.object.name,material:object.material.name,start,ms:performance.now()-start});}};
  const resources={world:owner.harborWorld?.ready,materials:owner._materialsReady,wardens:owner._wardenReady,survivor:owner._survivorReady,witness:owner._ashWitnessReady,combat:owner.brutalCombatVisuals.ready,vermin:owner.verminVisuals.ready,cutaways:owner.extractionVFX?.cutaways?.ready};
  for(const [name,promise]of Object.entries(resources))Promise.resolve(promise).then(()=>{window.startupProfile.dependencies[name]=performance.now();});
  const native=owner.renderer,nodes=native._nodes.getForRenderAsync.bind(native._nodes),pipelines=native._pipelines.getForRender.bind(native._pipelines);
  native._nodes.getForRenderAsync=async object=>{
   const start=performance.now(),stats=window.startupProfile.nodes;
   stats.current={name:object.object.name,material:object.material.name,instances:object.object.instanceMatrix?.count,start};
   try{return await nodes(object);}finally{const ms=performance.now()-start;stats.count++;stats.ms+=ms;if(ms>100)stats.slow.push({...stats.current,ms});stats.slow.sort((a,b)=>b.ms-a.ms);stats.slow.length=Math.min(10,stats.slow.length);stats.current=null;}
  };
  native._pipelines.getForRender=(object,promises)=>{
   const result=pipelines(object,promises);
   if(promises?.length){const stats=window.startupProfile.pipelines,start=performance.now();stats.current={name:object.object.name,material:object.material.name,instances:object.object.instanceMatrix?.count,start};
    promises.push(Promise.all([...promises]).then(()=>{const ms=performance.now()-start;stats.count++;stats.ms+=ms;if(ms>100)stats.slow.push({...stats.current,ms});stats.slow.sort((a,b)=>b.ms-a.ms);stats.slow.length=Math.min(10,stats.slow.length);stats.current=null;}));
   }
   return result;
  };
  const compile=owner._compilePreparedScene.bind(owner);
  owner._compilePreparedScene=async (renderer,...args)=>{
   const sample={stage:owner._preparationStage,start:performance.now(),meshes:0,materials:0};
   const materials=new Set();owner.scene.traverseVisible(object=>{if(object.isMesh){sample.meshes++;for(const material of [object.material].flat())materials.add(material);}});sample.materials=materials.size;
   window.startupProfile.compilations.push(sample);
   try{return await compile(renderer,...args);}finally{sample.ms=performance.now()-sample.start;}
  };
  const draw=owner._renderScene.bind(owner);
  owner._renderScene=(...args)=>{const start=performance.now();const result=draw(...args);if(window.startupProfile.draws.length<40)window.startupProfile.draws.push({stage:owner._preparationStage,ms:performance.now()-start});return result;};
 },{concurrency:report.concurrency,budgetMs:report.budgetMs});
 if(action==='free-camera')await page.locator('.dev-map-picker summary').click();
 await page.locator(action==='free-camera'?'[data-dev-inspect]':'[data-action="start"]').click({timeout:60000});
 let lastStage;
 for(let attempt=0;attempt<72;attempt++){
  const state=await page.evaluate(()=>{const app=window.__DEAD_ARRIVAL__;return{screen:app.screen,stage:app.renderer._preparationStage,history:app.renderer._preparationHistory,profile:window.startupProfile};});
  report.stages=state.history;report.compilations=state.profile.compilations;report.draws=state.profile.draws;report.nodes=state.profile.nodes;report.pipelines=state.profile.pipelines;
  if(state.stage!==lastStage||attempt%4===0||state.screen==='play')console.log(JSON.stringify({elapsedMs:Date.now()-started,screen:state.screen,stage:state.stage,compilation:report.compilations.at(-1),nodes:{count:report.nodes.count,ms:report.nodes.ms,current:report.nodes.current},pipelines:{count:report.pipelines.count,ms:report.pipelines.ms,current:report.pipelines.current},errors:report.errors.slice(-2)}));
  lastStage=state.stage;
  if(report.errors.length)throw new Error(`Map preparation failed: ${report.errors.at(-1)}`);
  if(state.screen==='play')break;
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:5000}).catch(error=>{if(error.name!=='TimeoutError')throw error;});
 }
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'play','launcher source reaches gameplay');
 report.readyMs=Date.now()-started;
 if(cpu){const {profile}=await cpu.send('Profiler.stop');await writeFile(`${output}/cpu-profile.json`,JSON.stringify(profile));const counts=new Map();for(let i=0;i<(profile.samples||[]).length;i++)counts.set(profile.samples[i],(counts.get(profile.samples[i])||0)+profile.timeDeltas[i]);report.cpu=profile.nodes.map(n=>({function:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber+1,ms:(counts.get(n.id)||0)/1000})).sort((a,b)=>b.ms-a.ms).slice(0,30);}
 report.dependencies=await page.evaluate(()=>({hookedAt:startupProfile.hookedAt,ready:startupProfile.dependencies}));
 report.syncPipelines=await page.evaluate(()=>startupProfile.syncPipelines);
 report.longTasks=await page.evaluate(()=>window.startupLongTasks);
 report.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:r.name,ms:r.duration,start:r.startTime,bytes:r.encodedBodySize})).sort((a,b)=>b.ms-a.ms).slice(0,30));
 await page.screenshot({path:`${output}/ready.png`});
 report.action=action;
 report.runtime=await page.evaluate(()=>{const app=window.__DEAD_ARRIVAL__,r=app.renderer;return{backend:r.renderer.migration.backend,render:r.renderer.info.render,memory:r.renderer.info.memory,canvas:{width:r.canvas.width,height:r.canvas.height},world:r.harborWorld?.diagnostics||{dungeon:app.run.course.dungeon,floor:app.run.course.dungeonIndex},inspecting:app.inspector.active,bodycam:r.settings.bodycam};});
 assert.equal(report.runtime.inspecting,action==='free-camera');
 const before=await page.evaluate(()=>{const app=window.__DEAD_ARRIVAL__;return app.inspector.active?{x:app.inspector.pose.x,y:app.inspector.pose.z}:{x:app.run.x,y:app.run.y};});
 await page.keyboard.down('w');await page.waitForTimeout(750);await page.keyboard.up('w');
 report.movement=await page.evaluate(()=>{const app=window.__DEAD_ARRIVAL__;return{screen:app.screen,x:app.inspector.active?app.inspector.pose.x:app.run.x,y:app.inspector.active?app.inspector.pose.z:app.run.y,health:app.run.health};});
 assert.equal(report.movement.screen,'play');
 assert(Math.hypot(report.movement.x-before.x,report.movement.y-before.y)>.05,'real movement works after loading');
 report.frameTiming=await page.evaluate(async()=>{const intervals=[];let last=performance.now();for(let i=0;i<120;i++){const now=await new Promise(requestAnimationFrame);intervals.push(now-last);last=now;}intervals.sort((a,b)=>a-b);return{medianMs:intervals[60],p95Ms:intervals[114],maxMs:intervals.at(-1)};});
 if(action==='campaign')await page.keyboard.press('F2');await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__.renderer.freeCamera);
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(600);await page.keyboard.up('ArrowRight');await page.screenshot({path:`${output}/turned.png`});await page.keyboard.press('F2');
 if(await page.evaluate(()=>!!window.__DEAD_ARRIVAL__.run.course.harborRooms?.length)){
  report.interior=await page.evaluate(()=>{const app=window.__DEAD_ARRIVAL__,room=app.run.course.harborRooms[0];Object.assign(app.run,room.door,{vx:0,vy:0,z:0});return room.id;});
  await page.keyboard.down('q');await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__.run.course.activeInterior,null,{timeout:15000});await page.keyboard.up('q');
  await page.screenshot({path:`${output}/interior.png`});
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
 report.passed=true;
 console.log(JSON.stringify({readyMs:report.readyMs,menuMs:report.menuMs,passed:true}));
}catch(error){report.failure=String(error.stack||error);throw error;}
finally{
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 await browser?.close();if(server){server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
}
