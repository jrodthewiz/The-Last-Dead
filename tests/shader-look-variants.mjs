import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright-core');
const out='output/playwright/quality/shader-r6-looks';await mkdir(out,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.goto(`http://127.0.0.1:${server.port}/?debug=1&world=island`,{waitUntil:'load',timeout:90000});
await page.waitForSelector('#begin:not([disabled])',{timeout:120000});await page.click('#begin');await page.waitForFunction(()=>window.__BLACKWATER__?.mode==='playing',undefined,{timeout:120000});
await page.evaluate(()=>window.__BLACKWATER__.setTime?.(48));
const looks={
 A: {sat:1.04,contrast:1.09,warm:0,lift:1},
 B: {sat:1.13,contrast:1.17,warm:1.0,lift:.65},
 C: {sat:1.07,contrast:1.23,warm:.15,lift:.4},
 D: {sat:1.03,contrast:1.07,warm:.35,lift:1.15},
};
const poses=[
 ['02-oldtown',[590,16,7,635,16.5,-2]],
 ['04-waterfront',[1174,16,235,1188,22,178]],
 ['09-generator',[1005,16,-289,1000,16,-302]],
 ['11-wall-close',[-590,21.9,105,-591,21.2,108.4]],
 ['14-canopy-close',[-862,21.5,173,-859.9,23.2,177.7]],
];
for(const [tag,preset] of Object.entries(looks)){
 await page.evaluate(p=>{const u=window.__BLACKWATER__.presentation.uniforms;u.sat.value=p.sat;u.contrast.value=p.contrast;u.warm.value=p.warm;u.lift.value=p.lift;},preset);
 for(const [name,pose] of poses){
  await page.evaluate(p=>window.__BLACKWATER__.setPhoto(...p),pose);
  await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/${name}-${tag}.png`});
 }
}
console.log({out,shots:20,looks});await browser.close();await new Promise(r=>server.server.close(r));
