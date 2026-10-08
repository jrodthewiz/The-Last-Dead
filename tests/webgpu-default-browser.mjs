import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-unsafe-webgpu']});
const report={errors:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'||m.text().includes('THREE.TSL:'))report.errors.push(m.text());});
 await page.goto('http://127.0.0.1:5200/dist/index.html?district=harbor&debug',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__,{},{timeout:60000});
 report.default=await page.evaluate(()=>({native:!!window.__DEAD_ARRIVAL__.renderer.renderer.backend?.isWebGPUBackend,query:location.search}));assert.ok(report.default.native);assert.ok(!report.default.query.includes('renderer='));
 await page.goto('http://127.0.0.1:5200/dist/index.html?renderer=webgl&district=harbor&debug');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__,{},{timeout:60000});
 report.oldQueryUsesWebGPU=await page.evaluate(()=>!!window.__DEAD_ARRIVAL__.renderer.renderer.backend?.isWebGPUBackend);assert.ok(report.oldQueryUsesWebGPU);
 await page.close();
 const blocked=await browser.newPage();await blocked.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
 await blocked.goto('http://127.0.0.1:5200/dist/index.html?district=harbor&debug');
 await blocked.getByRole('alert').waitFor();report.unsupported=await blocked.getByRole('alert').innerText();assert.match(report.unsupported,/WebGPU/);
 assert.equal(await blocked.getByRole('alert').getByRole('link').count(),0);
 assert.equal(await blocked.evaluate(()=>!!window.__DEAD_ARRIVAL__),false);report.noFallback=true;await blocked.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.mkdir('output/playwright/webgpu-default',{recursive:true});await fs.writeFile('output/playwright/webgpu-default/report.json',JSON.stringify(report,null,2));await browser.close();}
