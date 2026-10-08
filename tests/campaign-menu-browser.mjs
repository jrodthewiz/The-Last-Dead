import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=d3d11']});
const server=process.env.DEAD_ARRIVAL_URL?null:await startServer({root:path.resolve('dist'),port:0,host:'127.0.0.1'});
const base=process.env.DEAD_ARRIVAL_URL||`http://127.0.0.1:${server.port}/`;
await mkdir('output/playwright/campaign-menu',{recursive:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(300000);
const report={errors:[],consoleErrors:[],httpErrors:[],checks:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(`${r.status()} ${r.url()}`);});
const state=()=>page.evaluate(()=>{const a=window.__DEAD_ARRIVAL__;return{screen:a.screen,course:a.run.course.id,coastal:!!a.run.course.coastal,harbor:a.run.course.harbor,prepared:a.renderer._preparedCourse===a.run.course,inspector:a.inspector.active,pose:a.inspector.pose,position:{x:a.run.x,y:a.run.y,z:a.run.z}};});
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.start-button').waitFor();
 assert.equal(await page.locator('[data-action="harbor"]').count(),0);assert.equal(await page.locator('[data-dev-inspect]').count(),1);
 await page.screenshot({path:'output/playwright/campaign-menu/live-menu.png',timeout:60000});console.log('Live menu captured');
 const started=Date.now();await page.locator('[data-action="start"]').click();
 await page.waitForFunction(()=>['play','pause'].includes(window.__DEAD_ARRIVAL__?.screen));report.startMs=Date.now()-started;report.start=await state();assert.equal(report.start.coastal,true);assert.equal(report.start.prepared,true);console.log('Campaign loaded',report.startMs);
 await page.keyboard.press('F2');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.inspector.active&&window.__DEAD_ARRIVAL__.screen==='play');
 report.flightBefore=await state();await page.keyboard.down('KeyE');await page.waitForFunction(y=>window.__DEAD_ARRIVAL__.inspector.pose.y>y+.2,report.flightBefore.pose.y,{timeout:30000});await page.keyboard.up('KeyE');report.flightAfter=await state();assert.deepEqual(report.flightAfter.position,report.flightBefore.position);report.checks.push('F2 activates flight; E changes altitude while player position stays fixed');
 await page.screenshot({path:'output/playwright/campaign-menu/live-flight.png',timeout:60000});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');report.checks.push('Escape pauses flight');
 await page.locator('[data-action="resume"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');report.checks.push('Resume works');
 await page.keyboard.press('F2');await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.inspector.active);report.checks.push('F2 returns to player');
 if((await state()).screen!=='pause'){await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');}
 const retryStarted=Date.now();await page.locator('[data-action="restart"]').click();await page.waitForFunction(()=>{const a=window.__DEAD_ARRIVAL__;return ['play','pause'].includes(a.screen)&&!a.renderer._beginPending&&a.renderer._preparedCourse===a.run.course;});report.retryMs=Date.now()-retryStarted;report.restart=await state();assert.equal(report.restart.coastal,true);assert.equal(report.restart.prepared,true);report.checks.push('Restart retains coastal campaign');console.log('Restart passed',report.retryMs);
 if((await state()).screen!=='pause'){await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');}
 await page.locator('[data-action="menu"]').click();await page.locator('.start-button').waitFor();
 await page.locator('.menu-actions [data-dev-inspect]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.inspector.active&&window.__DEAD_ARRIVAL__.screen==='play');report.menuFly=await state();assert.equal(report.menuFly.coastal,true);assert.equal(report.menuFly.prepared,true);report.checks.push('Dev Mode button loads same campaign in flight');
} catch(error){report.failure=String(error);throw error;} finally{await writeFile('output/playwright/campaign-menu/live-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(server){server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}}


