import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const selectedLook=process.argv.find(a=>a.startsWith('--look='))?.split('=')[1]||'baseline';
const output=selectedLook==='baseline'?'output/playwright/blackwater-01':`output/playwright/blackwater-02/walk-${selectedLook}`;await mkdir(output,{recursive:true});
const inspectionOnly=process.argv.includes('--inspection-only');
const server=await startServer({port:0,root:process.cwd()});let browser;
const report={selectedLook,errors:[],httpErrors:[],views:[],checks:[],scope:'Own browser. Original kit inspection plus integrated HarborWorld scene; engine-backed walking and collision, no combat playthrough.'};
if(inspectionOnly)report.scope='Own browser. Kit inspection, mobile layout, real engine-backed entry/cache/exit; integrated-world checks are recorded separately.';
function summary(data){
 const subject=data.subject||data.diagnostics?.blackwater;
 const compact=subject?{version:subject.version,buildings:subject.buildings,houses:subject.houses,enterable:subject.enterable,street:subject.street,models:subject.models.map(m=>({id:m.id,kind:m.plan.settings.kind,variant:m.plan.residentialVariant,triangleCount:m.triangleCount,drawCalls:m.drawCalls,bounds:m.bounds}))}:undefined;
 if(data.diagnostics)return{name:data.name,backend:data.backend,subject:compact};
 return{...data,subject:compact};
}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.url());});
 const start=Date.now();await page.goto(`http://127.0.0.1:${server.port}/blackwater-review.html?look=${selectedLook}`);await page.waitForFunction(()=>!!window.__BLACKWATER_REVIEW__,null,{timeout:120000});report.reviewReadyMs=Date.now()-start;console.log('Inspection ready',report.reviewReadyMs);
 for(const name of ['downtown','houses','shop','courtyard','overview']){
  await page.locator(`[data-view="${name}"]`).click();
  const data=await page.evaluate(async()=>{const q=window.__BLACKWATER_REVIEW__;q.setCaptureMode(true);q.renderer.info.autoReset=false;const times=[];try{for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);const start=performance.now();q.renderer.info.reset();q.render();await q.renderer.backend.device.queue.onSubmittedWorkDone();times.push(performance.now()-start);}times.sort((a,b)=>a-b);return{...q.diagnostics(),renderMsMedian:times[22],renderMsP95:times[42]};}finally{q.renderer.info.autoReset=true;q.setCaptureMode(false);}});
  report.views.push(summary(data));await page.screenshot({path:`${output}/${name}.png`});console.log('Captured',name,'draws',data.draws,'triangles',data.triangles);
 }
 await page.locator('#walk').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('canvas'));await page.keyboard.down('w');await page.evaluate(()=>{const q=window.__BLACKWATER_REVIEW__;for(let i=0;i<35&&!q.run.backpack.collected.includes('coast-scrap-bell-pharmacy');i++)q.advance(100);});await page.keyboard.up('w');
 report.walk=summary(await page.evaluate(()=>window.__BLACKWATER_REVIEW__.diagnostics()));assert.ok(report.walk.player.y<12,'real W input enters pharmacy');assert.equal(report.walk.canStand,true);assert.ok(report.walk.collected.includes('coast-scrap-bell-pharmacy'),'existing pickup collected');
 report.checks.push('W moves through actual grid doorway and collects persistent pharmacy cache');
 await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.__BLACKWATER_REVIEW__.advance(350));await page.keyboard.up('ArrowRight');await page.evaluate(()=>new Promise(requestAnimationFrame));await page.screenshot({path:`${output}/walk-in.png`});
 await page.keyboard.down('ArrowLeft');await page.evaluate(()=>window.__BLACKWATER_REVIEW__.advance(350));await page.keyboard.up('ArrowLeft');
 await page.keyboard.down('s');await page.evaluate(()=>{const q=window.__BLACKWATER_REVIEW__;for(let i=0;i<35&&q.run.y<13;i++)q.advance(100);});await page.keyboard.up('s');await page.evaluate(()=>new Promise(requestAnimationFrame));
 report.exit=summary(await page.evaluate(()=>window.__BLACKWATER_REVIEW__.diagnostics()));assert.ok(report.exit.player.y>=13,'real S input exits pharmacy');report.checks.push('S returns through the same doorway to Main Street');await page.screenshot({path:`${output}/walk-out.png`});
 await page.keyboard.press('Escape');await page.evaluate(()=>document.exitPointerLock?.());
 await page.setViewportSize({width:390,height:844});await page.locator('[data-view="houses"]').click();await page.screenshot({path:`${output}/mobile.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);report.checks.push('390px inspection UI fits and camera resizes');
 await page.setViewportSize({width:1280,height:800});
 if(!inspectionOnly){
 let html=await readFile('tests/fixtures/coastal-scene.html','utf8');html=html.replace('const views={','const views={blackwater:[[222,1.9,56],[177,4,43]],homes:[[215,1.9,57],[179,3,72]],pharmacy:[[202,1.8,53],[202,1.65,39]],');
 await page.route('**/tests/fixtures/coastal-scene.html',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://127.0.0.1:${server.port}/tests/fixtures/coastal-scene.html`);await page.waitForFunction(()=>window.qaReady,null,{timeout:240000});
 for(const name of ['blackwater','homes','pharmacy']){
  const result=await page.evaluate(name=>window.sceneQA.view(name),name);report.integrated??=[];report.integrated.push(summary(result));await page.screenshot({path:`${output}/integrated-${name}.png`});console.log('Integrated view',name);
 }
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log('Blackwater browser checks passed');
}catch(error){report.failure=String(error.stack||error);throw error;}
finally{await writeFile(`${output}/${inspectionOnly?'inspection-report':'report'}.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
