import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=resolve(process.env.BLACKWATER_QA_OUTPUT||'output/playwright/blackwater-continuity/retry');await mkdir(output,{recursive:true});
const server=await startServer({root:resolve(process.env.BLACKWATER_QA_ROOT||'dist'),port:0}),browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist']});
const report={errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});await guardBackgroundInput(page);page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/fps-arms-v5.glb',route=>route.fulfill({status:503,body:'Controlled unavailable asset'}));
 await page.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>document.getElementById('loading').textContent.includes('could not load'),{},{timeout:60000});
 report.failure=await page.locator('#loading').textContent();assert.match(report.failure,/503/);assert.equal(await page.locator('#begin').isDisabled(),true);assert.equal(await page.evaluate(()=>!!window.__BLACKWATER__),false);
 await page.unroute('**/fps-arms-v5.glb');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});assert.equal(await page.locator('#begin').isEnabled(),true);await page.locator('#begin').click();await page.waitForFunction(()=>__BLACKWATER__.state.time>.1);assert.equal(await page.evaluate(()=>__BLACKWATER__.mode),'playing');report.recovered=true;assert.deepEqual(report.errors,[]);
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.server.close(r));console.log(JSON.stringify(report,null,2));}
