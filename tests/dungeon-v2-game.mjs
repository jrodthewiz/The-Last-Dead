import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const sharp=process.env.PLAYWRIGHT_PATH?createRequire(`${process.env.PLAYWRIGHT_PATH}/package.json`)('sharp'):require('sharp');
const output=process.env.V2_QA_OUTPUT||'output/playwright/dungeon-v2';await mkdir(output,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
const report={errors:[],httpErrors:[],journey:[],views:[],checks:{}};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(`${r.status()} ${r.url()}`);});
const capture=async name=>{const png=await page.screenshot({path:`${output}/${name}.png`});const pixels=await sharp(png).resize(128,72).removeAlpha().raw().toBuffer();report.views.push({name,pixelLevels:new Set(pixels).size,...await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.renderer.renderer;return{calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures,fps:d.fps,diagnostics:d.renderer._collectDiagnostics(d.run)};})});assert(report.views.at(-1).pixelLevels>4);};
try{
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await page.locator('#world').click();
 await page.evaluate(async()=>{window.__v2engine=await import('./engine.js');});
 await page.waitForTimeout(750);await capture('entry-route');
 report.checks.audio=await page.evaluate(()=>{const a=window.__DEAD_ARRIVAL__.audio;return{state:a.ctx?.state||a.context?.state,loaded:a.debugInfo.loaded,errors:a.debugInfo.errors,mix:a.mixDiagnostics()};});
 assert.equal(report.checks.audio.loaded,true);assert.deepEqual(report.checks.audio.errors,[]);
 const seconds=Number(process.env.V2_PLAY_SECONDS||120),end=Date.now()+seconds*1000;let iterations=0;
 while(Date.now()<end){
  const state=await page.evaluate(()=>{
   const d=window.__DEAD_ARRIVAL__,r=d.run,e=window.__v2engine;
   const targets=r.course.enemies.filter(t=>!t.dead&&Math.hypot(t.x-r.x,t.y-r.y)<8&&e.castRay(r.course,r.x,r.y,Math.atan2(t.y-r.y,t.x-r.x),10).dist>Math.hypot(t.x-r.x,t.y-r.y)-.15).sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y));
   const target=targets[0],nav=r.dungeonProgression?.navigation,point=target||nav?.waypoint;
   if(point){r.angle=Math.atan2(point.y-r.y,point.x-r.x);r.pitch=target?Math.atan2(.40-(r.z+.4),Math.max(.2,Math.hypot(point.x-r.x,point.y-r.y))):-.04;}
   return{mode:r.mode,x:r.x,y:r.y,kills:r.kills,health:r.health,active:r.course.enemies.filter(t=>!t.dead&&!t.dormant).length,pending:r.director?.pending,goal:nav?.goal,completed:r.dungeonProgression?.roomsCompleted,fire:!!target,move:!target||Math.hypot(target.x-r.x,target.y-r.y)>1.3};
  });
  if(state.mode==='dead'){report.checks.deathObserved=true;await page.locator('[data-action="restart"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await page.locator('#world').click();continue;}
  if(state.move)await page.keyboard.down('w');else await page.keyboard.up('w');
  if(state.fire)await page.mouse.down();else await page.mouse.up();
  await page.waitForTimeout(450);if(iterations++%16===0){report.journey.push(state);console.log('Journey',JSON.stringify(state));}
 }
 await page.keyboard.up('w');await page.mouse.up();report.checks.liveSeconds=seconds;await capture('active-combat');
 if(seconds>0){assert(report.journey.some(s=>s.kills>0),'real primary input kills a threat');assert(new Set(report.journey.map(s=>`${s.x.toFixed(1)},${s.y.toFixed(1)}`)).size>1,'navigation drives real movement');}
 // Controlled crowd/effect views complement the real-input journey above.
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.run;r.health=1000;r.ownedWeapons=Array.from({length:8},(_,i)=>i);r.course.enemies=[];r.director=null;r.mode='play';});
 await page.keyboard.press('2');await page.mouse.down({button:'right'});await page.waitForTimeout(40);await page.mouse.up({button:'right'});
 report.checks.core=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run,p=r.projectiles.find(p=>p.core);if(p){r.mode='ready';p.x=r.x+Math.cos(r.angle)*.9;p.y=r.y+Math.sin(r.angle)*.9;p.z=r.z+.36;}return{spawned:!!p,geometry:window.__DEAD_ARRIVAL__.renderer.projectileCore.geometry.name};});
 assert(report.checks.core.spawned,'real alternate input launches mechanical core');await page.waitForTimeout(80);await capture('alternate-core');
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';window.__DEAD_ARRIVAL__.run.projectiles=[];});
 await page.keyboard.press('1');await page.mouse.down({button:'right'});await page.waitForTimeout(40);await page.mouse.up({button:'right'});
 report.checks.coin=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run,p=r.coins[0];if(p){r.mode='ready';p.x=r.x+Math.cos(r.angle)*.65;p.y=r.y+Math.sin(r.angle)*.65;p.z=r.z+.42;}return{spawned:!!p};});assert(report.checks.coin.spawned,'real alternate input throws coin');await page.waitForTimeout(80);await capture('ricochet-coin');
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';});
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.run,item=r.course.supplies?.[0];window.__v2supply=item;if(item){r.x=item.x;r.y=item.y+.5;r.health=50;r.energy=50;}});
 await page.waitForTimeout(500);
 report.checks.supply=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run,item=window.__v2supply;return{exists:!!item,health:r.health,collected:item&&r.dungeonProgression.suppliesCollected.includes(item.id)};});
 assert(report.checks.supply.exists&&report.checks.supply.collected&&report.checks.supply.health>50,'useful recovery cache grants health');
 // Freeze simulation, keep rendering and inspect a measured sixteen-actor crowd.
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.run;Object.assign(r,{x:r.course.playerSpawn.x,y:r.course.playerSpawn.y,angle:-Math.PI/2,pitch:-.07,mode:'ready'});r.course.enemies=Array.from({length:16},(_,i)=>({id:99000+i,x:r.x+(i%4-1.5)*.35,y:r.y-1.3-Math.floor(i/4)*.42,hp:5,kind:0,variant:i%3===0?'skitter':'stalker',state:'stalk',facing:Math.PI/2,attack:10,dead:false}));});
 await page.waitForTimeout(1700);await capture('crowd-16');
 report.checks.frameTimes=await page.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now();function step(t){times.push(t-last);last=t;if(times.length<90)requestAnimationFrame(step);else{times.shift();times.sort((a,b)=>a-b);resolve({median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]});}}requestAnimationFrame(step);}));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await capture('portrait-crowd');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;d.renderer.setSettings({...d.renderer.settings,reducedMotion:true});});await page.waitForTimeout(100);report.checks.reducedMotion=true;
 await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;d.run.mode='play';d.pause();});await page.locator('[data-action="menu"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='menu');await capture('menu-return');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.result='PASS';console.log(JSON.stringify({result:report.result,checks:report.checks,views:report.views.map(v=>({name:v.name,calls:v.calls,triangles:v.triangles,fps:v.fps}))}));
}catch(error){report.result='FAIL';report.failure=error.stack;await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
