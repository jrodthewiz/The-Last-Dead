import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/blackwater-05';await mkdir(`${output}/video`,{recursive:true});
const server=await startServer({port:0,root:resolve('dist')});let browser,context,page,video;
const report={scope:'Built game, actual imported resident and renderer/bodycam. Existing residents are repositioned for controlled QA. Material comparisons freeze one rendered pose; motion uses normal AI/input. Not a full campaign or phone-hardware test.',errors:[],httpErrors:[],comparisons:[],performance:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:process.env.BLACKWATER_ACTOR_VIDEO==='1'?{dir:`${output}/video`,size:{width:1280,height:800}}:undefined});
 const recordingStart=Date.now();page=await context.newPage();video=page.video();
 await page.addInitScript(()=>{window.__BW_ERROR_TRACES=[];const original=console.error;console.error=(...args)=>{window.__BW_ERROR_TRACES.push({at:performance.now(),message:args.map(String).join(' '),stack:new Error().stack});original.apply(console,args);};});
 page.on('pageerror',error=>report.errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});});
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&horrorqa=1`);
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});await page.locator('[data-action="start"]').click({timeout:60000});console.log('Actor production Start pressed');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:120000});report.startMs=Date.now()-recordingStart;console.log('Actor production play ready',report.startMs);
 await page.locator('#world').click({position:{x:640,y:400}});await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#world'));
 report.fixture=await page.evaluate(()=>{
  const q=window.__DEAD_ARRIVAL__,e=q.run.course.enemies.find(e=>e.resident&&!e.dead&&e.kind===0);if(!e)throw Error('No normal melee resident available');window.__HORROR_QA__.setManual(true);
  window.__BW_ACTOR_ID=e.id;window.__BW_OTHER_POSITIONS=q.run.course.enemies.filter(other=>other!==e).map(other=>({enemy:other,x:other.x,y:other.y}));
  for(const {enemy}of window.__BW_OTHER_POSITIONS){enemy.x=10;enemy.y=10;}
  return{id:e.id,variant:e.variant,hp:e.hp,existingResidents:q.run.course.enemies.map(e=>({id:e.id,kind:e.kind,variant:e.variant}))};
 });
 const setup=async(background,distance)=>page.evaluate(({background,distance})=>{
  const q=window.__DEAD_ARRIVAL__,r=q.run,e=r.course.enemies.find(e=>e.id===window.__BW_ACTOR_ID),g=q.renderer;
  const house=background==='house';Object.assign(r,{x:(house?194:206)/4,y:(house?77:56)/4,z:0,angle:house?-Math.PI/2:Math.PI,pitch:-.055,vx:0,vy:0,vz:0,shot:0,damage:0});
  Object.assign(e,{x:(house?194:206-distance)/4,y:(house?77-distance:56)/4,z:0,facing:house?Math.PI/2:0,attack:1,biteCooldown:20});
  g._blackwaterActorStyleEnabled=true;g.bodycamMotion?.reset();g.render(r,performance.now());const entry=g._enemyVisuals.get(e.id),style=entry?.root.userData.blackwaterActorStyle;if(!style)throw Error('Missing integrated actor adapter');
  window.__BW_RENDER=g.render;g.render=()=>{};window.__BW_STYLE=style;
  const bones=[];entry.root.traverse(object=>{if(object.isBone)bones.push({name:object.name,position:object.position.toArray(),quaternion:object.quaternion.toArray()});});
  return{background,distance,actualDistance:Math.hypot(e.x-r.x,e.y-r.y)*4,actor:style.diagnostics,bones,contactShadowCount:g.enemyContactShadows.count};
 },{background,distance});
 const renderLook=async enabled=>page.evaluate(async enabled=>{const g=window.__DEAD_ARRIVAL__.renderer,r=g.renderer;window.__BW_STYLE.setEnabled(enabled);r.info.autoReset=false;r.info.reset();g._renderScene();await r.backend.device.queue.onSubmittedWorkDone();const stats={draws:r.info.render.drawCalls,triangles:r.info.render.triangles,memory:r.info.memory.total};r.info.autoReset=true;return stats;},enabled);
 const profile=async(enabled,background)=>page.evaluate(async({enabled,background})=>{
  const g=window.__DEAD_ARRIVAL__.renderer,r=g.renderer,times=[];window.__BW_STYLE.setEnabled(enabled);r.info.autoReset=false;
  try{for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);r.info.reset();const start=performance.now();g._renderScene();await r.backend.device.queue.onSubmittedWorkDone();if(i>=8)times.push(performance.now()-start);}times.sort((a,b)=>a-b);return{background,enabled,scope:'same frozen actor/pose, stationary scene+bodycam submit-fenced render samples; not total gameplay FPS',draws:r.info.render.drawCalls,triangles:r.info.render.triangles,medianMs:times[11],p95Ms:times[20],memory:r.info.memory.total};}finally{r.info.autoReset=true;}
 },{enabled,background});
 const restore=()=>page.evaluate(()=>{const g=window.__DEAD_ARRIVAL__.renderer;window.__BW_STYLE.setEnabled(true);g.render=window.__BW_RENDER;delete window.__BW_RENDER;});
 for(const background of ['street','house'])for(const distance of [12,6,3]){
  const before=await setup(background,distance),baseline=await renderLook(false);await page.screenshot({path:`${output}/actor-${background}-${distance}m-before.png`});
  if(distance===6)report.performance.push(await profile(false,background));
  const after=await renderLook(true);await page.screenshot({path:`${output}/actor-${background}-${distance}m-after.png`});if(distance===6)report.performance.push(await profile(true,background));
  const bonesAfter=await page.evaluate(()=>{const bones=[],entry=window.__DEAD_ARRIVAL__.renderer._enemyVisuals.get(window.__BW_ACTOR_ID);entry.root.traverse(o=>{if(o.isBone)bones.push({name:o.name,position:o.position.toArray(),quaternion:o.quaternion.toArray()});});return bones;});
  assert.deepEqual(bonesAfter,before.bones,'comparison preserves exact imported pose');assert.equal(after.triangles,baseline.triangles,'material treatment adds no triangles');assert.equal(after.draws,baseline.draws,'material treatment adds no draws');
  report.comparisons.push({...before,bones:undefined,baseline,after});await restore();console.log('Actor comparison',background,distance);
 }
 // Narrow viewport uses the normal game camera rather than a rescaled frame.
 await page.setViewportSize({width:390,height:844});await setup('street',6);await renderLook(true);await page.screenshot({path:`${output}/actor-portrait-after.png`});await restore();
 report.portrait=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollFits:document.documentElement.scrollWidth<=innerWidth}));assert.equal(report.portrait.scrollFits,true);await page.setViewportSize({width:1280,height:800});
 await setup('street',12);await restore();
 report.motionStartSeconds=(Date.now()-recordingStart)/1000;
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q.run.health=100;q.run.damage=0;window.__HORROR_QA__.setManual(false);window.__BW_TRACE=[];const started=performance.now();window.__BW_TRACE_TIMER=setInterval(()=>{const q=window.__DEAD_ARRIVAL__,e=q.run.course.enemies.find(e=>e.id===window.__BW_ACTOR_ID),actor=q.renderer._enemyVisuals.get(e.id)?.root.userData.afterlife;window.__BW_TRACE.push({t:(performance.now()-started)/1000,x:e.x*4,z:e.y*4,distance:Math.hypot(e.x-q.run.x,e.y-q.run.y)*4,hp:e.hp,dead:e.dead,attacking:e.attacking,windup:e.windup,strike:e.strike,bitePhase:e.bitePhase,health:q.run.health,gait:actor?.gaitPhase,attackPhase:actor?.attackPhase});},100);});
 await page.waitForFunction(()=>{const q=window.__DEAD_ARRIVAL__,e=q.run.course.enemies.find(e=>e.id===window.__BW_ACTOR_ID);return Math.hypot(e.x-q.run.x,e.y-q.run.y)*4<3;},null,{timeout:20000});await page.screenshot({path:`${output}/actor-motion-near.png`});
 await page.waitForFunction(()=>{const q=window.__DEAD_ARRIVAL__,e=q.run.course.enemies.find(e=>e.id===window.__BW_ACTOR_ID);return e.attacking||e.bitePhase==='windup';},null,{timeout:10000});await page.screenshot({path:`${output}/actor-motion-windup.png`});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.health<100,null,{timeout:10000});await page.screenshot({path:`${output}/actor-motion-contact.png`});
 // The resident flanks during contact. Track it through real pointer motion,
 // using the existing look sensitivity, instead of firing at the empty lane.
 let aimX=640,aimY=400;await page.mouse.down();
 for(let attempt=0;attempt<50;attempt++){
  const aim=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,r=q.run,e=r.course.enemies.find(e=>e.id===window.__BW_ACTOR_ID),angle=Math.atan2(e.y-r.y,e.x-r.x),distance=Math.hypot(e.x-r.x,e.y-r.y)*4;return{dead:e.dead,dx:Math.atan2(Math.sin(angle-r.angle),Math.cos(angle-r.angle))/.002,dy:(r.pitch-Math.atan2(1.12-1.75,Math.max(.5,distance)))/.002};});
  if(aim.dead)break;aimX+=Math.max(-240,Math.min(240,aim.dx));aimY+=Math.max(-160,Math.min(160,aim.dy));await page.mouse.move(aimX,aimY);await page.waitForTimeout(100);
 }
 await page.mouse.up();assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.enemies.find(e=>e.id===window.__BW_ACTOR_ID).dead),true,'tracked real mouse fire kills resident');
 await page.evaluate(async()=>{for(let i=0;i<45;i++)await new Promise(requestAnimationFrame);clearInterval(window.__BW_TRACE_TIMER);});await page.screenshot({path:`${output}/actor-motion-death.png`});
 report.motion=await page.evaluate(()=>({trace:window.__BW_TRACE,screen:window.__DEAD_ARRIVAL__.screen,health:window.__DEAD_ARRIVAL__.run.health,enemy:window.__DEAD_ARRIVAL__.run.course.enemies.find(e=>e.id===window.__BW_ACTOR_ID).dead}));report.motionEndSeconds=(Date.now()-recordingStart)/1000;
 assert.equal(report.motion.screen,'play');assert.equal(report.motion.enemy,true);assert.ok(report.motion.trace.some(frame=>frame.attacking||frame.bitePhase==='windup'));assert.ok(report.motion.trace.some(frame=>frame.health<100));assert.ok(new Set(report.motion.trace.map(frame=>Math.round((frame.gait||0)*100))).size>4,'actual gait advances during approach');
 // Verify source restoration and the integrated resource cleanup on an actual
 // course restart, including native compile/prepared actors in the new course.
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');await page.locator('[data-action="restart"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:120000});
 report.restart=await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__.screen,health:window.__DEAD_ARRIVAL__.run.health,prepared:window.__DEAD_ARRIVAL__.renderer._coastalEnemyPreparedCourse===window.__DEAD_ARRIVAL__.run.course}));assert.equal(report.restart.health,100);assert.equal(report.restart.prepared,true);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log('Actor built-game comparisons, motion/contact/death and restart passed');
}catch(error){report.failure=String(error.stack||error);if(page)report.failedState=await page.evaluate(()=>({trace:window.__BW_TRACE,screen:window.__DEAD_ARRIVAL__?.screen,health:window.__DEAD_ARRIVAL__?.run.health,pointerLock:!!document.pointerLockElement,errorTraces:window.__BW_ERROR_TRACES})).catch(()=>null);throw error;}
finally{await context?.close();if(video)report.videoPath=await video.path();await writeFile(`${output}/actor-report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
