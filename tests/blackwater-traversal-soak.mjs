import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=resolve(process.env.BLACKWATER_QA_OUTPUT||'output/playwright/blackwater-soak');
await mkdir(output,{recursive:true});
const server=await startServer({root:resolve(process.env.BLACKWATER_QA_ROOT||'dist'),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist']});
const report={errors:[],httpErrors:[],samples:[],conditions:{viewport:[1440,900],dpr:1,quality:'retro',profile:!!process.env.BLACKWATER_PROFILE,invulnerable:true,notes:'Continuous real keyboard walking with camera steering; each ground leg starts at its named location. Photo flyover is a separate continuous culling route. Captures are outside measured phases.'}};
const deadline=setTimeout(()=>{report.errors.push('Owned QA exceeded its eight-minute deadline');void browser.close();},480000);
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});await guardBackgroundInput(page);
 page.on('crash',()=>{report.errors.push('Owned background page crashed');void browser.close();});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push([r.status(),r.url()]);});
 await page.route('**/*.js',async route=>{
  const path=new URL(route.request().url()).pathname.slice(1);let source;
  if(process.env.BLACKWATER_BASELINE_ROOT){const control=path.startsWith('island/')?path:path==='assets/survivor/fps-arms.js'?'fps-arms.js':path==='weapon-melee.js'?path:null;if(control)try{source=await readFile(resolve(process.env.BLACKWATER_BASELINE_ROOT,control),'utf8');}catch{}}
  if(path==='island/navigation.js'){source??=await readFile(resolve(process.env.BLACKWATER_QA_ROOT||'dist',path),'utf8');source=source.replace('export function findLocalPath(','function profileFindLocalPath(');source+='\nexport function findLocalPath(...args){const start=performance.now(),result=profileFindLocalPath(...args),ms=performance.now()-start;if(window.measuring)(window.navEvents??=[]).push({at:start,ms,phase:window.currentPhase});return result;}';}
  if(path==='island/actors.js'){source??=await readFile(resolve(process.env.BLACKWATER_QA_ROOT||'dist',path),'utf8');source=source.replace('export function updateEnemies(','function profileUpdateEnemies(');source+='\nexport function updateEnemies(...args){const damage=args[5];args[5]=(...hit)=>{window.enemyAttackEvents=(window.enemyAttackEvents||0)+1;return damage(...hit);};return profileUpdateEnemies(...args);}';}
  if(source!==undefined)await route.fulfill({contentType:'text/javascript',body:source});else await route.continue();
 });
 await page.addInitScript(()=>{window.slowGPU=[];for(const name of ['compileShader','linkProgram','getProgramParameter','getProgramInfoLog','texImage2D','bufferData']){const proto=WebGL2RenderingContext.prototype,fn=proto[name];proto[name]=function(...args){const start=performance.now(),result=fn.apply(this,args),ms=performance.now()-start;if(ms>8)window.slowGPU.push({name,at:start,ms});return result;};}window.longTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.longTasks.push({at:e.startTime,ms:e.duration});}).observe({type:'longtask',buffered:true});});
 const start=Date.now();await page.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});report.readyMs=Date.now()-start;
 await page.locator('#begin').click();await page.waitForTimeout(1200);
 report.device=await page.evaluate(()=>{const g=__BLACKWATER__,gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],warmup:g.warmup};});
 const cdp=await page.context().newCDPSession(page);if(process.env.BLACKWATER_PROFILE){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:2000});await cdp.send('Profiler.start');report.profilerAnchor=await page.evaluate(()=>performance.now());}
 await page.evaluate(async()=>{
  const g=__BLACKWATER__;g.setTime(48);window.costs={};window.slowCPU=[];window.currentPhase='setup';
  const actorModule=await import('/island/actors.js');window.queueMetrics=()=>actorModule.navigationMetrics?.(g.grid)??null;window.noise=(await import('/island/enemy-behavior.js')).hearNoise;
  window.saveEvents=[];const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){const start=performance.now(),result=setItem.apply(this,args);if(window.measuring)window.saveEvents.push({at:start,ms:performance.now()-start,key:args[0]});return result;};
  for(const key of ['world','scenery','exploration','rifle','armoryModels','actionHands','crimsonVisuals','lootVisuals','presentation']){const obj=g[key],name=key==='presentation'?'render':'update',fn=obj[name];obj[name]=function(...args){const start=performance.now(),result=fn.apply(this,args),ms=performance.now()-start;if(window.measuring){(window.costs[key]??=[]).push(ms);if(ms>20)window.slowCPU.push({phase:window.currentPhase,key,at:start,ms});}return result;};}
  window.runRoute=async({name,seconds,points,fly=false,combat=false})=>{
   const start=performance.now(),end=start+seconds*1000,attackStart=window.enemyAttackEvents||0,frames=[],trace=[],resources=[],spikes=[],flyLengths=fly?points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1],p[2]-points[i][2])):null;let previous=null,leg=0,distance=0,oldX=g.state.x,oldZ=g.state.z,lastAction=-1,lastNoise=-1,timeToReach=null,damageEvents=0;
   window.currentPhase=name;window.costs={};window.measuring=true;
   const stats=a=>{a=a.slice().sort((a,b)=>a-b);return{n:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1),over34:a.filter(v=>v>34).length,over50:a.filter(v=>v>50).length};};
   return await new Promise(resolve=>{function tick(now){
    const t=Math.max(0,(now-start)/1000);if(g.state.health<100)damageEvents++;g.state.health=100;
    if(previous!==null){const ms=now-previous;frames.push(ms);if(ms>34)spikes.push({at:now,ms,x:g.camera.position.x,z:g.camera.position.z,calls:g.renderer.info.render.calls,programs:g.renderer.info.programs.length,navigation:window.queueMetrics()&&{...window.queueMetrics()}});}previous=now;
    if(fly){const lengths=flyLengths,total=lengths.reduce((a,b)=>a+b,0);let along=Math.min(.999999,t/seconds)*total,index=0;while(along>lengths[index]&&index<lengths.length-1)along-=lengths[index++];const a=points[index],b=points[index+1],f=along/lengths[index],x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f,z=a[2]+(b[2]-a[2])*f;g.setPhoto(x,y,z,x+90,y-24,z-60);
    }else if(points){const p=points[leg];if(Math.hypot(g.state.x-p[0],g.state.z-p[1])<3)leg=(leg+1)%points.length;const q=points[leg];g.state.yaw=Math.atan2(q[0]-g.state.x,-(q[1]-g.state.z));g.state.pitch=-.04;distance+=Math.hypot(g.state.x-oldX,g.state.z-oldZ);oldX=g.state.x;oldZ=g.state.z;}
    if(!fly){const action=Math.floor(t/5);if(action!==lastAction){lastAction=action;const ids=combat?['carbine','bat','chainsaw','breach','carrion','mourning','arc','ossuary','reliquary']:['carbine','bat'];const id=ids[action%ids.length];g.collectWeapon(id);g.selectWeapon(id);g.state.ammo=40;g.state.reserve=100;g.shoot();}if(combat&&Math.floor(t*2)%2===0)g.shoot();}
    if(combat){if(Math.floor(t)!==lastNoise){lastNoise=Math.floor(t);window.noise(g.actors.enemies,g.state.x,g.state.z,70);}if(timeToReach===null&&window.pursuers.some(e=>Math.hypot(e.x-g.state.x,e.z-g.state.z)<1.8))timeToReach=t;}
    if(!trace.length||t-trace.at(-1).t>=1){trace.push({t,x:g.state.x,y:g.state.y,z:g.state.z,camera:g.camera.position.toArray(),mode:g.mode,leg,weapon:g.state.weapon,living:g.actors.enemies.filter(e=>e.alive&&e.root.visible).length,pursuers:window.pursuers?.map(e=>({x:e.x,z:e.z,alive:e.alive,path:e.path.length})),navigation:window.queueMetrics()&&{...window.queueMetrics()}});resources.push({t,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures,programs:g.renderer.info.programs.length,heap:performance.memory?.usedJSHeapSize});}
    if(now<end)requestAnimationFrame(tick);else{window.measuring=false;resolve({name,elapsedMs:now-start,distance,timeToReach,damageEvents,enemyAttacks:(window.enemyAttackEvents||0)-attackStart,frames:stats(frames),spikes,cpu:Object.fromEntries(Object.entries(window.costs).map(([k,v])=>[k,stats(v)])),trace,resources,navigation:window.queueMetrics()&&{...window.queueMetrics()},slowGPU:window.slowGPU.filter(e=>e.at>=start),longTasks:window.longTasks.filter(e=>e.at>=start),position:[g.state.x,g.state.y,g.state.z]});}
   }requestAnimationFrame(tick);});
  };
 });
 const scale=Number(process.env.BLACKWATER_SOAK_SCALE||1);
 for(const [name,origin,points,seconds]of process.env.BLACKWATER_SKIP_GROUND?[]:[
  ['coast-road',[-690,265],[[-570,240],[-440,180],[-340,135],[-260,65]],80],
  ['bridge-crossing',[70,0],[[430,0]],65],
  ['city-street',[469,6],[[850,6],[850,-220]],80],
 ]){
  await page.evaluate(({origin})=>{__BLACKWATER__.teleport(...origin);__BLACKWATER__.state.health=100;},{origin});
  await page.keyboard.down('KeyW');const sample=await page.evaluate(options=>window.runRoute(options),{name,seconds:seconds*scale,points});await page.keyboard.up('KeyW');report.samples.push(sample);await writeFile(output+'/progress.json',JSON.stringify(report));console.log(name,JSON.stringify({distance:sample.distance,...sample.frames}));await page.screenshot({path:output+'/'+name+'.png'});
  assert.ok(sample.distance>seconds*scale*3,`${name} must traverse rather than stay blocked`);
 }
 // A controlled obstructed pursuit keeps six existing infected alive. Their
 // simulation, perception, collision and attack timing stay on the real path.
 report.pursuitSetup=await page.evaluate(async()=>{
  const g=__BLACKWATER__,{findLocalPath}=await import('/island/navigation.js'),{setEnemyAction,resetNavigation}=await import('/island/actors.js');resetNavigation?.(g.grid);
  for(const b of g.data.buildings.filter(b=>b.x>400&&b.x<650&&!b.enterable)){
   const sx=b.x-b.w/2-3,tx=b.x+b.w/2+3,z=b.z,spots=[];if(g.grid.blocked(tx,z,14,.5)||g.grid.floorAt(tx,z)!==14)continue;
   for(let dz=-2;dz<=2;dz+=1)for(let dx=-2;dx<=0;dx+=1)if(!g.grid.blocked(sx+dx,z+dz,14,.5))spots.push([sx+dx,z+dz]);
   if(spots.length<6||!findLocalPath(g.grid,sx,z,tx,z).length)continue;g.teleport(tx,z,-Math.PI/2);window.pursuers=g.actors.enemies.slice(0,6);
   for(const [i,e]of window.pursuers.entries()){const [x,zz]=spots[i];Object.assign(e,{x,z:zz,health:10000,alive:true,notice:8,hit:0,crimsonWindow:0,finisherHeld:false,pushX:0,pushZ:0,cooldown:0,path:[],navTimer:0,attackTimer:0,lastKnown:{x:tx,z},seesPlayer:false,sightTimer:0});e.root.position.set(x,14,zz);setEnemyAction(e,'idle');}
   window.pursuitBuilding=b.id;return{building:b.id,start:spots.slice(0,6),target:[tx,z],healthPerPursuer:10000,repeatedNoise:'once per second'};
  }throw new Error('No safe obstructed city pursuit site');
 });
 const combat=await page.evaluate(options=>window.runRoute(options),{name:'city-combat',seconds:75*scale,combat:true});report.samples.push(combat);assert.ok(combat.trace.every(f=>f.pursuers?.every(e=>e.alive)));assert.ok(combat.timeToReach!==null&&combat.enemyAttacks>0,'Pursuers must route and attack');await page.screenshot({path:output+'/city-combat.png'});console.log('city-combat complete',JSON.stringify({timeToReach:combat.timeToReach,enemyAttacks:combat.enemyAttacks,frames:combat.frames}));
 report.samples.push(await page.evaluate(options=>window.runRoute(options),{name:'continuous-island-city-return',seconds:90*scale,fly:true,points:[[-900,90,320],[-600,75,130],[-450,120,-230],[-150,75,0],[400,45,0],[850,65,-300],[1210,55,220],[850,55,300],[400,45,0],[-200,75,0],[-900,90,320]]}));await page.screenshot({path:output+'/return.png'});console.log('continuous flyover complete');
 if(await page.evaluate(()=>!!window.queueMetrics())){
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.evaluate(()=>{const g=__BLACKWATER__,b=g.data.buildings.find(b=>b.id===window.pursuitBuilding);g.teleport(b.x,b.z);for(const e of window.pursuers){e.notice=8;e.lastKnown={x:b.x,z:b.z};e.path=[];e.navTimer=0;e.sightTimer=10;e.seesPlayer=false;}});
  await page.waitForFunction(()=>window.queueMetrics().active>0);report.pendingBeforeRetry=await page.evaluate(()=>({...window.queueMetrics()}));await page.evaluate(()=>{__BLACKWATER__.takeDamage(100);__BLACKWATER__.retry();});
  report.retryQueue=await page.evaluate(()=>({active:window.queueMetrics().active,paths:__BLACKWATER__.actors.enemies.reduce((n,e)=>n+e.path.length,0),mode:__BLACKWATER__.mode}));assert.deepEqual(report.retryQueue,{active:0,paths:0,mode:'playing'});
 }
 if(process.env.BLACKWATER_PROFILE){const {profile}=await cdp.send('Profiler.stop');await writeFile(output+'/cpu.cpuprofile',JSON.stringify(profile));const nodes=new Map(profile.nodes.map(n=>[n.id,n])),times=new Map();profile.samples.forEach((id,i)=>times.set(id,(times.get(id)||0)+(profile.timeDeltas[i]||0)));report.cpuTop=[...times].sort((a,b)=>b[1]-a[1]).slice(0,45).map(([id,us])=>({name:nodes.get(id).callFrame.functionName,url:nodes.get(id).callFrame.url,line:nodes.get(id).callFrame.lineNumber+1,selfMs:us/1000}));}
 report.slowCPU=await page.evaluate(()=>window.slowCPU);report.navigation=await page.evaluate(()=>window.navEvents||[]);report.saves=await page.evaluate(()=>window.saveEvents);report.contextLost=await page.evaluate(()=>__BLACKWATER__.renderer.getContext().isContextLost());assert.equal(report.contextLost,false);assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
}catch(e){report.failure=e.message;if(page){report.failureState=await Promise.race([page.evaluate(()=>({loading:document.getElementById('loading')?.textContent,begin:document.getElementById('begin')?.disabled,mode:window.__BLACKWATER__?.mode})).catch(()=>null),new Promise(r=>setTimeout(()=>r(null),2000))]);await page.screenshot({path:output+'/failure.png',timeout:5000}).catch(()=>{});}throw e;}finally{clearTimeout(deadline);await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.server.close(r));console.log(JSON.stringify({output,readyMs:report.readyMs,errors:report.errors,failure:report.failure,failureState:report.failureState,samples:report.samples.map(s=>({name:s.name,distance:s.distance,frames:s.frames,longTasks:s.longTasks}))}));}
