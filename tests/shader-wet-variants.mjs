import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright-core');
const out='output/playwright/quality/shader-r4-wet-variants';
await mkdir(out,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.goto(`http://127.0.0.1:${server.port}/?debug=1&world=island`,{waitUntil:'load',timeout:90000});
await page.waitForSelector('#begin:not([disabled])',{timeout:120000});await page.click('#begin');await page.waitForFunction(()=>window.__BLACKWATER__?.mode==='playing',undefined,{timeout:120000});
await page.evaluate(()=>window.__BLACKWATER__.setTime?.(48));
for(const [name,pose] of [['02-oldtown',[590,16,7,635,16.5,-2]],['12-road-close',[-80,17.2,3,-70,17.0,12]]]){
 if(pose)await page.evaluate(p=>window.__BLACKWATER__.setPhoto(...p),pose);
 await page.waitForTimeout(600);
 for(const wet of [0,.6,1,1.5]){
  await page.evaluate(v=>{window.__BLACKWATER__.presentation.uniforms.wetRefl.value=v;},wet);
  await page.waitForTimeout(250);
  await page.screenshot({path:`${out}/${name}-wet-${String(wet).replace('.','_')}.png`});
 }
}
console.log({out,shots:8});
await browser.close();await new Promise(r=>server.server.close(r));
