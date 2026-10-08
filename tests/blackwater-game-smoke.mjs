import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const inspection=process.env.BLACKWATER_CAPTURE||'03';assert.match(inspection,/^\d{2}$/);
const output=`output/playwright/blackwater-${inspection}`;await mkdir(output,{recursive:true});
const server=await startServer({port:0,root:resolve('dist')});let browser;
const report={errors:[],httpErrors:[],scope:'Built production app, own browser/server, real Start and movement; debug position setup into authored district. No complete combat campaign playthrough.'};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
 const start=Date.now();await page.goto(`http://127.0.0.1:${server.port}/?debug=1`);
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});
 await page.locator('[data-action="start"]').click({timeout:60000});console.log('Production Start pressed');
 for(let i=0;i<20;i++){
  const phase=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return{screen:q.screen,stage:q.renderer._preparationStage,history:q.renderer._preparationHistory};});
  report.phase=phase;console.log('Production phase',phase.screen,phase.stage||'menu');
  if(phase.screen==='play')break;
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:15000}).catch(error=>{if(!String(error).includes('Timeout'))throw error;});
 }
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'play','production reaches play');report.startMs=Date.now()-start;console.log('Production play ready',report.startMs);
 // Preparation outlasts the Start gesture, so capture the mouse with the
 // normal canvas click after the loading overlay has gone.
 await page.locator('#world').click({position:{x:640,y:400}});
 await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#world'));
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<20;i++)await new Promise(requestAnimationFrame);await window.__DEAD_ARRIVAL__.renderer.renderer.backend.device.queue.onSubmittedWorkDone();});
 const profile=async view=>{report.performance??=[];report.performance.push(await page.evaluate(async view=>{const game=window.__DEAD_ARRIVAL__.renderer,r=game.renderer,originalRender=game.render,auto=r.info.autoReset,times=[];game.render=()=>{};r.info.autoReset=false;try{for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);r.info.reset();const start=performance.now();game._renderScene();await r.backend.device.queue.onSubmittedWorkDone();if(i>=8)times.push(performance.now()-start);}times.sort((a,b)=>a-b);return{view,scope:'stationary built-game scene plus bodycam, own browser, submit-fenced render timing; simulation/UI continue separately',draws:r.info.render.drawCalls,triangles:r.info.render.triangles,medianMs:times[11],p95Ms:times[20],memory:r.info.memory.total};}finally{game.render=originalRender;r.info.autoReset=auto;}},view));};
 report.district=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,r=q.run;Object.assign(r,{x:202/4,y:55/4,z:0,angle:-Math.PI/2,pitch:0,vx:0,vy:0,vz:0});window.advanceTime(16);const d=q.renderer.harborWorld.diagnostics.blackwater;return{buildings:d.buildings,houses:d.houses,enterable:d.enterable,streetProps:d.street.props,artDirection:d.artDirection};});
 assert.equal(report.district.buildings,94);assert.equal(report.district.houses,28);
 assert.equal(report.district.enterable.length,94);assert.equal(report.district.artDirection.direction,'graphic-horror');
 await page.screenshot({path:`${output}/production-entrance.png`});
 await page.keyboard.down('w');await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;for(let i=0;i<35&&!q.run.backpack.collected.includes('coast-scrap-bell-pharmacy');i++)window.advanceTime(100);});await page.keyboard.up('w');
 report.walk=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,r=q.run;return{screen:q.screen,x:r.x,y:r.y,health:r.health,collected:r.backpack.collected};});
 assert.equal(report.walk.screen,'play');assert.ok(report.walk.y<12);assert.ok(report.walk.collected.includes('coast-scrap-bell-pharmacy'));
 await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.advanceTime(350));await page.keyboard.up('ArrowRight');await page.screenshot({path:`${output}/production-pharmacy.png`});
 await page.keyboard.down('ArrowLeft');await page.evaluate(()=>window.advanceTime(350));await page.keyboard.up('ArrowLeft');
 await page.keyboard.down('s');await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;for(let i=0;i<35&&q.run.y<13;i++)window.advanceTime(100);});await page.keyboard.up('s');
 report.exit=await page.evaluate(()=>({y:window.__DEAD_ARRIVAL__.run.y,screen:window.__DEAD_ARRIVAL__.screen}));assert.ok(report.exit.y>=13);
 await page.evaluate(()=>{Object.assign(window.__DEAD_ARRIVAL__.run,{x:194/4,y:62/4,z:0,angle:Math.PI/2,pitch:0,vx:0,vy:0,vz:0});window.advanceTime(16);});
 await page.keyboard.down('w');await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;for(let i=0;i<20&&q.run.y<17;i++)window.advanceTime(100);});await page.keyboard.up('w');
 report.houseEntry=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;return{x:r.x,y:r.y,screen:window.__DEAD_ARRIVAL__.screen};});assert.ok(report.houseEntry.y>=17,'real input enters living room');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.angle=Math.atan2(69.9-r.y*4,187.6-r.x*4);r.pitch=-.13;window.advanceTime(16);});
 await settle();await profile('living');await page.screenshot({path:`${output}/production-living.png`});
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.angle=Math.PI/2;r.pitch=0;});
 await page.keyboard.down('w');await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;for(let i=0;i<20&&q.run.y<18.6;i++)window.advanceTime(100);});await page.keyboard.up('w');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.angle=Math.atan2(77.5-r.y*4,187.6-r.x*4);r.pitch=-.12;window.advanceTime(16);});
 await settle();await page.screenshot({path:`${output}/production-kitchen.png`});
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.angle=Math.PI/2;r.pitch=0;});
 await page.keyboard.down('w');await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;for(let i=0;i<25&&q.run.y<20.7;i++)window.advanceTime(100);});await page.keyboard.up('w');
 report.houseExit=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;return{x:r.x,y:r.y,screen:window.__DEAD_ARRIVAL__.screen,health:r.health};});assert.ok(report.houseExit.y>=20.7,'real input leaves through rear door');
 await page.evaluate(()=>{Object.assign(window.__DEAD_ARRIVAL__.run,{x:219/4,y:62/4,z:0,angle:Math.atan2(46-62,196-219),pitch:.025,vx:0,vy:0,vz:0});window.advanceTime(16);});
 await settle();await profile('downtown');await page.screenshot({path:`${output}/production-downtown.png`});
 await page.evaluate(()=>{Object.assign(window.__DEAD_ARRIVAL__.run,{x:215/4,y:56/4,z:0,angle:Math.atan2(48-56,200-215),pitch:Math.atan2(7-1.75,17),vx:0,vy:0,vz:0});window.advanceTime(16);});
 await settle();await page.screenshot({path:`${output}/production-collapse.png`});
 if(process.env.BLACKWATER_ENCOUNTER==='1'){
  // Reuse a normally spawned resident, with debug position setup for a bounded
  // combat fixture. Damage still comes through real mouse input and game AI.
  report.encounterSetup=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,r=q.run,e=r.course.enemies.find(e=>e.resident&&!e.dead&&e.kind===0);if(!e)throw Error('No normal resident available for combat fixture');Object.assign(r,{x:206/4,y:56/4,z:0,angle:Math.PI,pitch:-.025,vx:0,vy:0,vz:0,weapon:0});Object.assign(e,{x:198/4,y:56/4,facing:0,attack:1,biteCooldown:20});window.advanceTime(16);return{id:e.id,variant:e.variant,hp:e.hp,resident:e.resident,scope:'Existing normally spawned resident repositioned for deterministic QA; not a new scripted encounter.'};});
  await settle();await page.screenshot({path:`${output}/production-encounter.png`});
  await page.mouse.down();
  await page.waitForFunction(id=>{const e=window.__DEAD_ARRIVAL__.run.course.enemies.find(e=>e.id===id);return e.dead||e.hp<e.maxHp;},report.encounterSetup.id,{timeout:10000});
  await page.mouse.up();
  report.encounter=await page.evaluate(id=>{const q=window.__DEAD_ARRIVAL__,r=q.run,e=r.course.enemies.find(e=>e.id===id);return{id:e.id,hp:e.hp,dead:e.dead,shots:r.shotSequence,health:r.health,screen:q.screen};},report.encounterSetup.id);
  assert.ok(report.encounter.hp<report.encounterSetup.hp,'real mouse fire damages the resident');assert.equal(report.encounter.screen,'play');
  const checkPackFit=async()=>page.evaluate(()=>{
   const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   const pack=rect(document.querySelector('.pack-launcher'));
   const selectors=['#ui .rank-caption','#ui [data-hud="rank"]','#ui .style-pending','#ui .combat-feed','#ui .hud-pause','#ui .objective','#ui .weapon-card'];
   const neighbours=selectors.flatMap(selector=>{const el=document.querySelector(selector);if(!el||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')return[];const r=rect(el);return r.width&&r.height?[{selector,...r}]:[];});
   return{width:innerWidth,height:innerHeight,pack,overlaps:neighbours.filter(r=>pack.x<r.right&&pack.right>r.x&&pack.y<r.bottom&&pack.bottom>r.y).map(r=>r.selector),inBounds:pack.x>=0&&pack.y>=0&&pack.right<=innerWidth&&pack.bottom<=innerHeight,touchTarget:pack.width>=44&&pack.height>=44,styleActive:document.querySelector('#ui .hud').dataset.styleActive,scrollFits:document.documentElement.scrollWidth<=innerWidth};
  });
  report.hudFits=[];
  const fit=await checkPackFit();report.hudFits.push(fit);assert.equal(fit.styleActive,'true','verify HUD after real hit');assert.deepEqual(fit.overlaps,[]);assert.equal(fit.inBounds,true);
  await page.screenshot({path:`${output}/production-hit.png`});
  await page.setViewportSize({width:390,height:844});await settle();await page.screenshot({path:`${output}/production-mobile.png`});
  report.mobile={width:390,height:844,scrollFits:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),scope:'Viewport emulation, desktop GPU; not phone hardware performance.'};assert.equal(report.mobile.scrollFits,true);
  // Keep the real combat state during resize; an empty score column hid the
  // original collision between PACK and the active grade.
  for(const viewport of [{width:390,height:844},{width:320,height:740},{width:844,height:390}]){
   // This is a responsive-state fixture, not a survival-duration check. Give
   // each view a live health budget; normal damage and warning clocks continue.
   report.hudHealthSetup??=[];report.hudHealthSetup.push(await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;const before=q.run.health;if(q.screen!=='play')throw Error('HUD fixture left play before resize');q.run.health=100;return{before,after:q.run.health};}));
   await page.setViewportSize(viewport);await settle();const fit=await checkPackFit();report.hudFits.push(fit);assert.deepEqual(fit.overlaps,[],`PACK overlap at ${viewport.width}x${viewport.height}`);assert.equal(fit.inBounds,true);assert.equal(fit.touchTarget,true);assert.equal(fit.scrollFits,true);
   if(viewport.height<520){
    await page.locator('[data-bite-prompt]:not([hidden])').waitFor({state:'visible',timeout:10000});
    report.contactHud=await page.evaluate(()=>{const prompt=document.querySelector('[data-bite-prompt]'),p=prompt.getBoundingClientRect(),objective=document.querySelector('#ui .objective');return{phase:prompt.dataset.phase,label:prompt.querySelector('strong').textContent,visible:!prompt.hidden,objectiveSuppressed:getComputedStyle(objective).visibility==='hidden',inBounds:p.x>=0&&p.y>=0&&p.right<=innerWidth&&p.bottom<=innerHeight,health:window.__DEAD_ARRIVAL__.run.health};});
    assert.equal(report.contactHud.visible,true);assert.equal(report.contactHud.objectiveSuppressed,true);assert.equal(report.contactHud.inBounds,true);
   }
   await page.screenshot({path:`${output}/production-hud-${viewport.width}x${viewport.height}.png`});
  }
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log('Built game smoke passed');
}catch(error){report.failure=String(error.stack||error);throw error;}
finally{await writeFile(`${output}/production-report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
