import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/gore-proof-browser';await mkdir(output,{recursive:true});
const server=await startServer({root:process.cwd(),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:800}}),report={errors:[],views:[]};
page.on('pageerror',error=>report.errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));
async function capture(name){
  await page.waitForTimeout(350);await page.screenshot({path:`${output}/${name}.png`});
  const data=await page.evaluate(name=>{
    const d=window.__GORE_PROOF__,gl=d.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);
    const buckets=new Set();for(let i=0;i<w*h;i+=Math.max(1,Math.floor(w*h/8192)))buckets.add(`${p[i*4]>>4},${p[i*4+1]>>4},${p[i*4+2]>>4}`);
    const c=document.querySelector('canvas').getBoundingClientRect(),caption=document.querySelector('[data-status]').getBoundingClientRect();
    return{name,...d.diagnostics(),camera:d.camera.position.toArray(),colorBuckets:buckets.size,overflow:document.documentElement.scrollWidth>innerWidth,captionClear:caption.bottom<=c.top};
  },name);report.views.push(data);assert(data.colorBuckets>12,`${name} renders varied visible geometry`);assert.equal(data.overflow,false);assert.equal(data.captionClear,true);assert(data.camera.every(Number.isFinite));
}
try{
  await page.goto(`http://127.0.0.1:${server.port}/gore-proof.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__GORE_PROOF__?.diagnostics().ready||window.__goreProofError);
  assert.equal(await page.evaluate(()=>window.__goreProofError),undefined);
  await capture('packed-neutral');
  await page.locator('[data-pose="spill"]').click();await page.waitForFunction(()=>window.__GORE_PROOF__.diagnostics().morph>.995);await capture('spilled-neutral');
  assert(report.views.at(-1).morphParts>=1,'exported spill shape survives glTF loading');
  await page.locator('[data-light="warm"]').click();await capture('spilled-warm');
  await page.locator('[data-light="cold"]').click();await capture('spilled-cold');
  await page.locator('[data-surface="clay"]').click();await capture('spilled-clay');
  await page.locator('[data-view="back"]').click();await capture('closed-back');
  await page.locator('[data-surface="pbr"]').click();await page.locator('[data-pose="packed"]').click();await page.locator('[data-view="side"]').click();await capture('packed-side');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-view="front"]').click();await capture('portrait-packed');
  await page.locator('[data-pose="spill"]').click();await page.waitForFunction(()=>window.__GORE_PROOF__.diagnostics().morph>.995);await capture('portrait-spilled');
  await page.locator('[data-view="detail"]').click();await page.locator('[data-light="neutral"]').click();await capture('portrait-cavity-detail');assert.equal(report.views.at(-1).focus,'detail');
  const before=await page.evaluate(()=>window.__GORE_PROOF__.camera.position.toArray());
  const rect=await page.locator('canvas').boundingBox();await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.55);await page.mouse.up();
  await page.waitForTimeout(150);const after=await page.evaluate(()=>window.__GORE_PROOF__.camera.position.toArray());assert.notDeepEqual(after,before,'real pointer drag orbits the model');
  assert(report.views.every(v=>v.triangles<=15000&&v.materials<=3),'candidate obeys its scoped budget');
  assert.deepEqual(report.errors,[]);report.result='PASS';console.log(JSON.stringify({result:report.result,views:report.views.map(v=>({name:v.name,calls:v.calls,triangles:v.triangles,materials:v.materials,colorBuckets:v.colorBuckets}))}));
}catch(error){report.result='FAIL';report.failure=error.stack;await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
