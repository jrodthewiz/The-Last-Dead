import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/playtest-controls';await mkdir(output,{recursive:true});
const server=await startServer({root:resolve('dist'),port:0});
const report={scope:'Actual campaign start, god/flight/landing controls, E to coast, Q safehouse entry/claim, B box transfers and reload. Controlled poses and inventory isolate travel and saving; combat completion is covered by simulation tests.',checks:[],errors:[],httpErrors:[]};
let browser,page,timer;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(480000);await guardBackgroundInput(page);
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',response=>{if(response.status()>=400)report.httpErrors.push(`${response.status()} ${response.url()}`);});
 const url=`http://127.0.0.1:${server.port}/?dev=1&debug=1&horrorqa=1&worldSeed=7317`;
 timer=setInterval(async()=>{try{console.log(await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return {screen:q?.screen,stage:q?.renderer._preparationStage};}));}catch{}},30000);
 const ready=()=>page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:480000});
 const shot=async name=>{await page.screenshot({path:`${output}/${name}.png`});};
 const press=async key=>{await page.keyboard.down(key);await page.evaluate(()=>window.advanceTime(50));await page.keyboard.up(key);await page.evaluate(()=>window.advanceTime(20));};
 await page.goto(url);await page.locator('[data-action=start]').click();await ready();
 report.canvas=await page.evaluate(()=>{const canvas=document.querySelector('#world'),renderer=window.__DEAD_ARRIVAL__.renderer.renderer;return{width:canvas.width,height:canvas.height,backend:renderer.backend?.isWebGPUBackend,drawCalls:renderer.info.render?.drawCalls??renderer.info.render?.calls??null,triangles:renderer.info.render?.triangles??null};});
 assert.ok(report.canvas.width>0&&report.canvas.height>0&&report.canvas.backend,'the built game draws into a native WebGPU canvas');
 const startPosition=await page.evaluate(()=>({x:window.__DEAD_ARRIVAL__.run.x,y:window.__DEAD_ARRIVAL__.run.y}));
 let walked=false;
 for(const key of ['w','a','s','d']){
  await page.keyboard.down(key);await page.evaluate(()=>window.advanceTime(180));await page.keyboard.up(key);
  walked=await page.evaluate(({x,y})=>Math.hypot(window.__DEAD_ARRIVAL__.run.x-x,window.__DEAD_ARRIVAL__.run.y-y)>.03,startPosition);
  if(walked)break;
 }
 assert.ok(walked,'real keyboard movement moves the player from the entry spawn');report.checks.push('WASD moves the live player');
 await page.evaluate(()=>{window.__HORROR_QA__.setManual(true);document.activeElement?.blur();});
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.dungeonIndex),0);
 await page.keyboard.press('F3');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.godMode),true);
 await page.keyboard.press('Escape');await page.locator('[data-dev-god]').click();assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.godMode),false);
 await page.locator('[data-dev-god]').click();await shot('01-playtest-menu');await page.keyboard.press('Escape');
 await page.keyboard.press('F2');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.inspector.active),true);
 const before=await page.evaluate(()=>({...window.__DEAD_ARRIVAL__.inspector.pose}));
 await page.keyboard.down('w');await page.waitForFunction(x=>window.__DEAD_ARRIVAL__.inspector.pose.x!==x,before.x);await page.keyboard.up('w');
 await page.locator('[data-dev-route]').click();await shot('02-flight');await page.keyboard.press('F4');
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.inspector.active),false);
 report.checks.push('F3 and pause toggle; F2 flight movement; return-stair view; F4 landing');
 await page.keyboard.press('e');await ready();
 assert.equal(await page.evaluate(()=>!!window.__DEAD_ARRIVAL__.run.course.coastal),true);
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.godMode),true);
 report.checks.push('E climbs from default dungeon to island and carries god mode');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,r.course.harborRooms[3].door,{z:0,vx:0,vy:0,vz:0});window.advanceTime(0);});
 await press('q');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.activeInterior?.id),'harbor-block-3');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run,p=r.course.lowTideStations.find(p=>p.id==='shelter');Object.assign(r,{x:p.x,y:p.y});});
 await press('q');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.lowTide.shelter),true);
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run,p=r.course.lowTideStations.find(p=>p.id==='stash');Object.assign(r,{x:p.x,y:p.y,ownedWeapons:[0,4,5],weapon:4});r.backpack.weaponMods[4]='hardened-fitting';r.backpack.supplies={cloth:3,antiseptic:1,bandage:1};r.backpack.scrap=8;window.advanceTime(0);});
 await page.keyboard.press('b');
 await page.locator('[data-stash-direction=store][data-stash-kind=weapon][data-stash-id="4"]').click();
 await page.locator('[data-stash-direction=store][data-stash-kind=supply][data-stash-id=cloth]').click();
 await page.locator('[data-stash-direction=store][data-stash-kind=scrap]').click();
 await page.locator('.pack-storage').scrollIntoViewIfNeeded();await shot('03-storage-box');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('thelastdead.low-tide.v1')));
 assert.deepEqual(saved.mission.stash.weapons,[4]);assert.equal(saved.mission.stash.weaponMods[4],'hardened-fitting');assert.equal(saved.mission.stash.supplies.cloth,1);assert.equal(saved.mission.bank,8);assert.deepEqual(saved.owned,[0,5]);
 await page.locator('[data-stash-direction=take][data-stash-kind=weapon][data-stash-id="4"]').click();
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.backpack.weaponMods[4]),'hardened-fitting');
 await page.locator('[data-stash-direction=store][data-stash-kind=weapon][data-stash-id="4"]').click();
 if(process.env.PLAYTEST_MOBILE==='1'){
  await page.setViewportSize({width:390,height:844});await page.locator('.pack-storage').scrollIntoViewIfNeeded();await shot('04-storage-mobile');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 report.checks.push('Q enters and claims Netmakers; B stores/retrieves fitted gun, medical supplies and scrap');
 await page.setViewportSize({width:1280,height:800});await page.reload();await page.locator('[data-action=start]').click();await ready();
 const reloaded=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;return {owned:r.ownedWeapons,supplies:r.backpack.supplies,save:JSON.parse(localStorage.getItem('thelastdead.low-tide.v1'))};});
 assert.deepEqual(reloaded.owned,[0,5]);assert.equal(reloaded.supplies.cloth,2);assert.deepEqual(reloaded.save.mission.stash.weapons,[4]);
 report.checks.push('Reload and Play Campaign restore carried inventory and retain saved box');
 await page.evaluate(()=>{window.__preRetryRun=window.__DEAD_ARRIVAL__.run;window.__preRetryRun.health=0;window.__preRetryRun.mode='dead';});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='dead');await page.keyboard.press('Enter');await ready();
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run!==window.__preRetryRun),true);
 report.checks.push('Enter retries from defeat into a fresh playable run');
 report.input=await backgroundInputState(page);assert.deepEqual(report.input.attempts,{pointerLock:0,fullscreen:0,keyboardLock:0});assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;
}catch(e){report.failure=String(e.stack||e);await page?.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw e;}
finally{clearInterval(timer);await browser?.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
