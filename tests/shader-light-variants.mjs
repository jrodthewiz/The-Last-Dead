import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright-core');
const out='output/playwright/quality/shader-r6-light';await mkdir(out,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.goto(`http://127.0.0.1:${server.port}/?debug=1&world=island`,{waitUntil:'load',timeout:90000});
await page.waitForSelector('#begin:not([disabled])',{timeout:120000});await page.click('#begin');await page.waitForFunction(()=>window.__BLACKWATER__?.mode==='playing',undefined,{timeout:120000});
await page.evaluate(()=>window.__BLACKWATER__.setTime?.(48));
const looks={
 A:{key:1,fill:1,sun:0xcdd9e0,sky:0xc6d7dc,ground:0x5a5f4f},
 B:{key:2.2,fill:.8,sun:0xffd6a0,sky:0x9fbdcc,ground:0x544d3c},
 C:{key:3,fill:.55,sun:0xffe0b0,sky:0x8da8b8,ground:0x3e3b30},
 D:{key:1.75,fill:.95,sun:0xffc98f,sky:0xa9c3d1,ground:0x5c5240},
};
const poses=[
 ['02-oldtown',[590,16,7,635,16.5,-2]],
 ['04-waterfront',[1174,16,235,1188,22,178]],
 ['09-generator',[1005,16,-289,1000,16,-302]],
 ['11-wall-close',[-590,21.9,105,-591,21.2,108.4]],
 ['14-canopy-close',[-862,21.5,173,-859.9,23.2,177.7]],
];
for(const [tag,p] of Object.entries(looks)){
 await page.evaluate(p=>{const w=window.__BLACKWATER__.world;w.lighting.key=p.key;w.lighting.fill=p.fill;w.sun.color.setHex(p.sun);w.hemi.color.setHex(p.sky);w.hemi.groundColor.setHex(p.ground);const u=window.__BLACKWATER__.presentation.uniforms;u.sat.value=1.04;u.contrast.value=1.09;u.warm.value=0;u.lift.value=1;},p);
 for(const [name,pose] of poses){
  await page.evaluate(p=>window.__BLACKWATER__.setPhoto(...p),pose);
  await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/${name}-${tag}.png`});
 }
}
console.log({out,shots:20,looks});await browser.close();await new Promise(r=>server.server.close(r));
