import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright-core');
const out='output/playwright/performance';await mkdir(out,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-frame-rate-limit']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.goto(`http://127.0.0.1:${server.port}/?debug=1&world=island`,{waitUntil:'load',timeout:90000});
await page.waitForSelector('#begin:not([disabled])',{timeout:120000});await page.click('#begin');await page.waitForFunction(()=>window.__BLACKWATER__?.mode==='playing',undefined,{timeout:120000});
await page.evaluate(()=>{const a=window.__BLACKWATER__;a.setTime(48);a.teleport(590,7,Math.PI/2);});
const result=await page.evaluate(async()=>{
 const app=window.__BLACKWATER__,fill=app.world.fill,rows=[];
 const sample=async(on,ms=4500)=>{
  fill.visible=on;await new Promise(r=>setTimeout(r,900));
  const a=[];await new Promise(resolve=>{let last=0,start=performance.now();const tick=now=>{if(last)a.push(now-last);last=now;if(now-start<ms)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
  const s=[...a].sort((x,y)=>x-y),at=q=>+s[Math.min(s.length-1,Math.floor(s.length*q))].toFixed(2);
  const row={fill:on,frames:a.length,median:at(.5),p95:at(.95),p99:at(.99),max:at(1),calls:app.renderer.info.render.calls,triangles:app.renderer.info.render.triangles};
  rows.push(row);return row;
 };
 for(const on of [true,false,true,false])await sample(on);
 return {rows,textures:app.renderer.info.memory.textures,programs:app.renderer.info.programs?.length??null};
});
const report={label:'shader-r6-fill-ab',...result,capturedAt:new Date().toISOString()};
await writeFile(`${out}/shader-r6-fill-ab.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,1));
await browser.close();await new Promise(r=>server.server.close(r));
