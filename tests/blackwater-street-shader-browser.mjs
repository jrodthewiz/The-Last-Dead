import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/blackwater-12/shader-isolation';await mkdir(output,{recursive:true});
const server=await startServer({root:process.cwd(),port:0});let browser,page;
const report={scope:'Native production road material compilation on two planes. Diagnostic isolation only; this is not an actual game capture.',errors:[],httpErrors:[],views:[]};
try{
 browser=await chromium.launch({headless:true,handleSIGINT:false,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});report.browserVersion=browser.version();page=await browser.newPage({viewport:{width:960,height:600}});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({status:r.status(),url:r.url()});});
 await page.goto('http://127.0.0.1:'+server.port+'/tests/fixtures/blackwater-street-native.html');await page.waitForFunction(()=>window.streetReady,null,{timeout:90000});
 report.adapter=await page.evaluate(()=>{const b=window.streetPreview.renderer.backend,i=b.adapter?.info??b.device?.adapterInfo;return{native:b.isWebGPUBackend,vendor:i?.vendor,architecture:i?.architecture};});assert.equal(report.adapter.native,true);
 report.finalPavingPixels=await page.evaluate(()=>window.samplePaving());
 for(const sample of report.finalPavingPixels)assert.ok([sample.bottom,sample.top].some(p=>Math.min(...p.slice(0,3))>20&&Math.max(...p.slice(0,3))-Math.min(...p.slice(0,3))<70),'Production paving must have visible neutral body between joints');
 for(const field of ['final','repair','repairSeam','braking','cracks','gutter','joints']){await page.evaluate(name=>window.setStreetField(name),field);await page.screenshot({path:output+'/'+field+'.png'});report.views.push(field);}
 await page.evaluate(()=>window.setStreetField('final'));report.restoredPavingPixels=await page.evaluate(()=>window.samplePaving());
 for(const sample of report.restoredPavingPixels)assert.ok([sample.bottom,sample.top].some(p=>Math.min(...p.slice(0,3))>20&&Math.max(...p.slice(0,3))-Math.min(...p.slice(0,3))<70),'Exiting diagnostics must restore the material body');
 assert.equal(report.errors.length,0);assert.equal(report.httpErrors.length,0);report.passed=true;
}catch(e){report.passed=false;report.failure=String(e.stack||e);report.deviceLoss=await page?.evaluate(()=>window.streetDeviceLoss??null).catch(()=>null);throw e;}
finally{await browser?.close();await new Promise((resolve,reject)=>server.server.close(e=>e?reject(e):resolve()));await writeFile(output+'/report.json',JSON.stringify(report,null,2));}
