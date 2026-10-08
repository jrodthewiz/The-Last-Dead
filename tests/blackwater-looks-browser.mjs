import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/blackwater-02';await mkdir(output,{recursive:true});
const server=await startServer({port:0,root:process.cwd()});let browser;
const report={scope:'Native WebGPU renders of actual Blackwater game models in the engine-backed inspection scene. Same seeds/cameras; no AI images or retouched scene pixels.',errors:[],httpErrors:[],views:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.url());});
 await page.goto(`http://127.0.0.1:${server.port}/blackwater-review.html?look=baseline`);
 await page.waitForFunction(()=>!!window.__BLACKWATER_REVIEW__,null,{timeout:120000});
 await page.addStyleTag({content:'body.capture header,body.capture footer,body.capture #crosshair{visibility:hidden!important}'});
 const manifest=await page.evaluate(()=>{const q=window.__BLACKWATER_REVIEW__;q.setCaptureMode(true);return{backend:q.renderer.migration.backend,viewport:[innerWidth,innerHeight],DPR:devicePixelRatio,cameras:q.views,seeds:q.subject.diagnostics.models.map(m=>({id:m.id,seed:m.plan.settings.seed})),geometries:q.subject.models.map(m=>m.root.children.filter(o=>o.isMesh&&!o.userData.lookOutline).map(o=>o.geometry.uuid)),materials:q.subject.models.map(m=>m.root.children.filter(o=>o.isMesh&&!o.userData.lookOutline).map(o=>o.material.uuid))};});report.manifest=manifest;
 for(const look of ['baseline','cartoon','realism']){
  await page.locator(`[data-look="${look}"]`).click();
  for(const view of ['downtown','houses','shop','overview']){
   await page.locator(`[data-view="${view}"]`).click();
   const data=await page.evaluate(async()=>{const q=window.__BLACKWATER_REVIEW__,times=[];q.renderer.info.autoReset=false;for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);q.renderer.info.reset();const start=performance.now();q.looks.update();q.render();await q.renderer.backend.device.queue.onSubmittedWorkDone();if(i>=8)times.push(performance.now()-start);}times.sort((a,b)=>a-b);const d=q.diagnostics();return{view:d.view,look:d.look,draws:d.draws,triangles:d.triangles,submitFenceMedianMs:times[11],submitFenceP95Ms:times[20],memory:q.renderer.info.memory,camera:q.camera.matrixWorld.toArray(),projection:q.camera.projectionMatrix.toArray()};});
   assert.ok(data.draws>100,'each measured frame must refresh the scene passes');report.views.push(data);await page.evaluate(()=>document.body.classList.add('capture'));await page.screenshot({path:`${output}/${look}-${view}.png`});await page.evaluate(()=>document.body.classList.remove('capture'));console.log('Captured',look,view,data.draws,data.submitFenceMedianMs.toFixed(1));
  }
 }
 await page.locator('[data-view="downtown"]').click();
 for(const debug of ['ao','depth','normals']){
  await page.evaluate(async debug=>{const q=window.__BLACKWATER_REVIEW__;q.pipeline.debug(debug);await new Promise(requestAnimationFrame);q.render();await q.renderer.backend.device.queue.onSubmittedWorkDone();document.body.classList.add('capture');},debug);
  await page.screenshot({path:`${output}/pipeline-${debug}.png`});await page.evaluate(()=>document.body.classList.remove('capture'));
 }
 await page.evaluate(async()=>{const q=window.__BLACKWATER_REVIEW__;q.pipeline.debug('final');q.pipeline.setAOEnabled(false);await new Promise(requestAnimationFrame);q.render();await q.renderer.backend.device.queue.onSubmittedWorkDone();document.body.classList.add('capture');});
 await page.screenshot({path:`${output}/realism-no-ao.png`});await page.evaluate(()=>{document.body.classList.remove('capture');window.__BLACKWATER_REVIEW__.pipeline.setAOEnabled(true);});
 await page.locator('[data-view="shop"]').click();
 for(const debug of ['albedo','roughness','normals']){
  await page.evaluate(async debug=>{const q=window.__BLACKWATER_REVIEW__;q.looks.debug(debug);q.render();await q.renderer.backend.device.queue.onSubmittedWorkDone();document.body.classList.add('capture');},debug);
  await page.screenshot({path:`${output}/realism-${debug}.png`});await page.evaluate(()=>document.body.classList.remove('capture'));
 }
 await page.evaluate(async()=>{const q=window.__BLACKWATER_REVIEW__;q.selectView('downtown');q.looks.debug('roughness');q.looks.update();q.render();await q.renderer.backend.device.queue.onSubmittedWorkDone();document.body.classList.add('capture');});
 await page.screenshot({path:`${output}/realism-road-roughness.png`});await page.evaluate(()=>document.body.classList.remove('capture'));
 // Translation and recovery exercise the world-space fields and sky centring.
 for(const look of ['cartoon','realism']){
  await page.evaluate(async look=>{const q=window.__BLACKWATER_REVIEW__;q.selectLook(look);q.selectView('downtown');const origin=q.camera.position.clone();for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);q.camera.position.x=origin.x+Math.sin(i/23*Math.PI)*1.5;q.looks.update();q.render();await q.renderer.backend.device.queue.onSubmittedWorkDone();}q.camera.position.copy(origin);await new Promise(requestAnimationFrame);q.looks.update();q.render();},look);
 }
 const after=await page.evaluate(()=>window.__BLACKWATER_REVIEW__.subject.models.map(m=>m.root.children.filter(o=>o.isMesh&&!o.userData.lookOutline).map(o=>o.geometry.uuid)));
 assert.deepEqual(after,manifest.geometries,'source geometry preserved across styles');
 for(const view of ['downtown','houses','shop','overview']){
  const shots=report.views.filter(r=>r.view===view);assert.ok(shots.every(r=>JSON.stringify(r.camera)===JSON.stringify(shots[0].camera)&&JSON.stringify(r.projection)===JSON.stringify(shots[0].projection)),'matching camera matrices');
 }
 await page.evaluate(()=>window.__BLACKWATER_REVIEW__.selectLook('baseline'));
 const original=await page.evaluate(()=>window.__BLACKWATER_REVIEW__.subject.models.map(m=>m.root.children.filter(o=>o.isMesh&&!o.userData.lookOutline).map(o=>o.material.uuid)));
 assert.deepEqual(original,manifest.materials,'original materials restored after repeated style changes');
 await page.setViewportSize({width:390,height:844});
 for(const look of ['cartoon','realism']){await page.locator(`[data-look="${look}"]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.screenshot({path:`${output}/mobile-controls.png`});
 // Release study-owned resources, then render borrowed originals again.
 const restored=await page.evaluate(async()=>{const q=window.__BLACKWATER_REVIEW__;let borrowedDisposals=0;const borrowed=new Set();q.selectLook('baseline');q.subject.models.forEach(m=>m.root.children.filter(o=>o.isMesh&&!o.userData.lookOutline).forEach(o=>borrowed.add(o.material)));for(const material of borrowed)material.addEventListener('dispose',()=>borrowedDisposals++);q.pipeline.dispose();q.looks.dispose();q.looks.dispose();q.render();await q.renderer.backend.device.queue.onSubmittedWorkDone();let outlines=0;q.subject.root.traverse(o=>{if(o.userData.lookOutline)outlines++;});return{borrowedDisposals,outlines,environment:q.scene.environment,skyPresent:Boolean(q.scene.getObjectByName('BlackwaterLookSky')),exposure:q.renderer.toneMappingExposure};});
 assert.deepEqual(restored,{borrowedDisposals:0,outlines:0,environment:null,skyPresent:false,exposure:1.25},'disposal restores the original lighting without disposing borrowed materials');report.restored=restored;
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log('Rendering look checks passed');
}catch(error){report.failure=String(error.stack||error);throw error;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
