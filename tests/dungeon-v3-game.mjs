import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.V3_OUTPUT||'output/playwright/dungeon-v3-play';await mkdir(output,{recursive:true});
const server=await startServer({root:process.env.V3_ROOT||fileURLToPath(new URL('../dist/',import.meta.url)),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
const report={errors:[],journey:[],views:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));
async function shot(name){await page.screenshot({path:`${output}/${name}.png`});report.views.push({name,...await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.renderer.renderer;return{calls:r.info.render.calls,triangles:r.info.render.triangles,fps:d.fps,diagnostics:d.renderer._collectDiagnostics(d.run)};})});}
try{
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
 await page.evaluate(async()=>{window.__v3engine=await import('./engine.js');window.__v3Events=[];const a=window.__DEAD_ARRIVAL__.audio,play=a.play.bind(a);a.play=(...args)=>{const e=args[2];if(e&&['spawn','dungeon-ingress','dungeon-encounter-phase','dungeon-room-clear','sector-transition'].includes(e.type)){window.__v3Events.push({...e,time:window.__DEAD_ARRIVAL__.run.time});}return play(...args);};});
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await page.locator('#world').click();
 const seconds=Number(process.env.V3_PLAY_SECONDS||180),end=Date.now()+seconds*1000;let iteration=0,capturedPhase=false;
 while(Date.now()<end){
  const state=await page.evaluate(()=>{
   const d=window.__DEAD_ARRIVAL__,r=d.run,e=window.__v3engine,nav=r.dungeonProgression.navigation;
   const nearby=r.course.enemies.filter(t=>!t.dead).sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y));
   const target=nearby.find(t=>Math.hypot(t.x-r.x,t.y-r.y)<9&&e.castRay(r.course,r.x,r.y,Math.atan2(t.y-r.y,t.x-r.x),10).dist>Math.hypot(t.x-r.x,t.y-r.y)-.15);
   const sound=nav?.hold?nearby[0]:null,point=target||nav?.waypoint||sound;
   if(point){r.angle=Math.atan2(point.y-r.y,point.x-r.x);r.pitch=target?Math.atan2(.4-(r.z+.4),Math.max(.2,Math.hypot(point.x-r.x,point.y-r.y))):-.035;}
   const encounter=r.dungeonProgression.encounter;
   return{mode:r.mode,x:r.x,y:r.y,health:r.health,kills:r.kills,room:r.dungeonProgression.activeRoomId,completed:[...r.dungeonProgression.roomsCompleted],goal:nav?.goal,hold:nav?.hold,phase:encounter.phase,phaseIndex:encounter.phaseIndex,phaseCount:encounter.phaseCount,active:encounter.active,pending:encounter.pending,fire:!!target,move:!!nav?.waypoint&&!nav.hold&&!target};
  });
  if(state.mode==='dead'){report.deaths=(report.deaths||0)+1;await page.keyboard.up('w');await page.mouse.up();await page.locator('[data-action="restart"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await page.locator('#world').click();continue;}
  if(state.move)await page.keyboard.down('w');else await page.keyboard.up('w');if(state.fire)await page.mouse.down();else await page.mouse.up();
  await page.waitForTimeout(250);
  if(iteration++%24===0){report.journey.push(state);console.log(JSON.stringify(state));}
  if(!capturedPhase&&state.phaseIndex>0&&state.active>1){await shot('reinforcement-approach');capturedPhase=true;}
 }
 await page.keyboard.up('w');await page.mouse.up();await shot('sustained-combat');
 report.events=await page.evaluate(()=>window.__v3Events);report.seconds=seconds;
 assert(report.journey.some(s=>s.kills>=10),'live combat kills threats');assert(report.journey.some(s=>s.completed.length>=2),'live route completes multiple rooms');
 const spawns=report.events.filter(e=>e.type==='spawn');assert(spawns.length>=10);assert(spawns.every(e=>e.ingressId&&e.spawnAnim==='none'&&e.z===0),'all observed arrivals use grounded doorway ingress');
 assert(report.events.some(e=>e.type==='dungeon-encounter-phase'&&e.phaseIndex>0),'reinforcement phase is played');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await shot('portrait-navigation');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(report.errors,[]);report.result='PASS';console.log(JSON.stringify({result:report.result,spawns:spawns.length,deaths:report.deaths||0,seconds,views:report.views.map(v=>({name:v.name,fps:v.fps,calls:v.calls}))}));
}catch(e){report.result='FAIL';report.failure=e.stack;await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw e;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
