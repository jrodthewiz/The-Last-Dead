import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const inspection=process.env.BLACKWATER_CAPTURE||'03';assert.match(inspection,/^\d{2}$/);
const output=`output/playwright/blackwater-${inspection}`;await mkdir(output,{recursive:true});
const server=await startServer({port:0,root:process.cwd()});let browser;
const report={scope:'Selected graphic horror: native game assets and engine walking in isolated inspection; production game is verified separately.',errors:[],httpErrors:[],views:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.url());});
 await page.goto(`http://127.0.0.1:${server.port}/blackwater-review.html`);await page.waitForFunction(()=>!!window.__BLACKWATER_REVIEW__,null,{timeout:120000});
 assert.equal(await page.evaluate(()=>window.__BLACKWATER_REVIEW__.diagnostics().look.look),'cartoon','selected direction opens by default');
 await page.addStyleTag({content:'body.capture header,body.capture footer,body.capture #crosshair{visibility:hidden!important}'});
 await page.evaluate(()=>{const q=window.__BLACKWATER_REVIEW__;q.setCaptureMode(true);q.renderer.info.autoReset=false;});
 for(const view of ['downtown','collapse','houses','shop','living','kitchen','yard']){
  await page.locator(`[data-view="${view}"]`).click();
  const data=await page.evaluate(async()=>{const q=window.__BLACKWATER_REVIEW__,times=[];for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);q.renderer.info.reset();const start=performance.now();q.looks.update();q.render();await q.renderer.backend.device.queue.onSubmittedWorkDone();if(i>=8)times.push(performance.now()-start);}times.sort((a,b)=>a-b);return{view:q.diagnostics().view,camera:q.camera.matrixWorld.toArray(),projection:q.camera.projectionMatrix.toArray(),draws:q.renderer.info.render.drawCalls,triangles:q.renderer.info.render.triangles,medianMs:times[11],p95Ms:times[20],memory:q.renderer.info.memory};});
  assert.ok(data.draws>40);report.views.push(data);await page.evaluate(()=>document.body.classList.add('capture'));await page.screenshot({path:`${output}/graphic-${view}.png`});await page.evaluate(()=>document.body.classList.remove('capture'));console.log('Graphic capture',view,data.draws,data.medianMs.toFixed(1));
 }
 if(process.env.BLACKWATER_DIAGNOSTICS==='1'){
  await page.evaluate(()=>{const q=window.__BLACKWATER_REVIEW__;q.selectView('downtown');document.body.classList.add('capture');});
  for(const mode of ['structure','wear']){
   await page.evaluate(async mode=>{const q=window.__BLACKWATER_REVIEW__;q.looks.debug(mode);for(let i=0;i<10;i++){await new Promise(requestAnimationFrame);q.render();}await q.renderer.backend.device.queue.onSubmittedWorkDone();},mode);
   await page.screenshot({path:`${output}/diagnostic-${mode}.png`});
  }
  await page.evaluate(async()=>{const q=window.__BLACKWATER_REVIEW__;q.looks.debug('final');q.selectView('collapse');const {MeshStandardNodeMaterial}=await import('/vendor/three.webgpu.js');const clay=new MeshStandardNodeMaterial({color:'#b8b5af',roughness:1});const saved=[];q.subject.root.traverse(o=>{if(o.isMesh&&!o.userData.lookOutline){saved.push([o,o.material]);o.material=clay;}});try{for(let i=0;i<12;i++){await new Promise(requestAnimationFrame);q.render();}await q.renderer.backend.device.queue.onSubmittedWorkDone();}finally{q.__clayRestore=()=>{for(const [o,m]of saved)o.material=m;clay.dispose();};}});
  await page.screenshot({path:`${output}/diagnostic-clay-collapse.png`});
  await page.evaluate(()=>{const q=window.__BLACKWATER_REVIEW__;q.__clayRestore();delete q.__clayRestore;document.body.classList.remove('capture');q.render();});
  report.diagnostics=['structure','wear','clay-collapse'];
 }
 // The actual engine advances from the road through both real house apertures.
 await page.evaluate(()=>window.__BLACKWATER_REVIEW__.setCaptureMode(false));await page.locator('#walk-house').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('canvas'));
 await page.keyboard.down('w');await page.evaluate(()=>{const q=window.__BLACKWATER_REVIEW__;for(let i=0;i<65&&q.run.y<20.8;i++)q.advance(100);});await page.keyboard.up('w');
 report.house=await page.evaluate(()=>window.__BLACKWATER_REVIEW__.diagnostics());assert.ok(report.house.player.y>=20.8,'W crosses living room, kitchen and rear door');assert.equal(report.house.canStand,true);
 await page.keyboard.down('s');await page.evaluate(()=>{const q=window.__BLACKWATER_REVIEW__;for(let i=0;i<65&&q.run.y>15;i++)q.advance(100);});await page.keyboard.up('s');
 report.houseReturn=await page.evaluate(()=>({player:window.__BLACKWATER_REVIEW__.diagnostics().player,canStand:window.__BLACKWATER_REVIEW__.diagnostics().canStand}));assert.ok(report.houseReturn.player.y<=15);assert.equal(report.houseReturn.canStand,true);
 await page.keyboard.press('Escape');await page.evaluate(()=>document.exitPointerLock?.());await page.locator('#walk').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('canvas'));await page.keyboard.down('w');await page.evaluate(()=>{const q=window.__BLACKWATER_REVIEW__;for(let i=0;i<35&&!q.run.backpack.collected.includes('coast-scrap-bell-pharmacy');i++)q.advance(100);});await page.keyboard.up('w');
 report.pharmacy=await page.evaluate(()=>({player:window.__BLACKWATER_REVIEW__.diagnostics().player,collected:window.__BLACKWATER_REVIEW__.run.backpack.collected}));assert.ok(report.pharmacy.collected.includes('coast-scrap-bell-pharmacy'));
 await page.keyboard.press('Escape');await page.evaluate(()=>document.exitPointerLock?.());await page.setViewportSize({width:390,height:844});await page.locator('[data-view="living"]').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${output}/mobile-controls.png`});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log('Graphic inspection checks passed');
}catch(error){report.failure=String(error.stack||error);throw error;}
finally{await writeFile(`${output}/graphic-report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
