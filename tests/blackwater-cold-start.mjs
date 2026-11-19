import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=resolve(process.env.BLACKWATER_QA_OUTPUT||'output/playwright/cold-start/latest');
const trials=Number(process.env.BLACKWATER_TRIALS||3);
assert.ok(Number.isInteger(trials)&&trials>0);
await mkdir(output,{recursive:true});
const server=await startServer({root:resolve(process.env.BLACKWATER_QA_ROOT||'.'),port:0});
const reports=[];
try{
 for(let trial=1;trial<=trials;trial++){
  const report={trial,errors:[],httpErrors:[]};reports.push(report);
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist']});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
   await guardBackgroundInput(page);
   page.on('pageerror',e=>report.errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   page.on('response',r=>{if(r.status()>=400)report.httpErrors.push([r.status(),r.url()]);});
   await page.addInitScript(()=>{
    // Activate the real Begin handler as soon as it becomes enabled. The
    // observer avoids charging browser automation polling delays to startup.
    new MutationObserver((_,observer)=>{
     const begin=document.getElementById('begin');
     if(!begin||begin.disabled)return;
     observer.disconnect();
     window.titleReadyMs=performance.now();
     begin.click();
    }).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
   });
   await page.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'commit',timeout:120000});
   await page.waitForFunction(()=>window.__BLACKWATER__?.mode==='playing'&&window.__BLACKWATER__.state.time>0,null,{timeout:180000});
   Object.assign(report,await page.evaluate(async()=>{
    const g=window.__BLACKWATER__,gl=g.renderer.getContext();
    const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
    if(!fence)throw Error('Could not create gameplay render fence');
    gl.flush();
    const deadline=performance.now()+120000;
    try{
     for(;;){
      const status=gl.clientWaitSync(fence,0,0);
      if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)break;
      if(status===gl.WAIT_FAILED||performance.now()>deadline)throw Error('Gameplay render did not complete');
      await new Promise(r=>setTimeout(r,10));
     }
    }finally{gl.deleteSync(fence);}
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {titleMs:window.titleReadyMs,playMs:performance.now(),warmup:g.warmup,
     adapter:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),metrics:g.metrics(),size:[gl.drawingBufferWidth,gl.drawingBufferHeight]};
   }));
   assert.deepEqual(report.size,[1440,900]);
   assert.ok(report.metrics.calls>0&&report.metrics.triangles>0,'Gameplay draws the world');
   const before=await page.evaluate(()=>[__BLACKWATER__.state.x,__BLACKWATER__.state.z]);
   await page.keyboard.down('KeyW');
   try{await page.waitForFunction(([x,z])=>Math.hypot(__BLACKWATER__.state.x-x,__BLACKWATER__.state.z-z)>1,before,{timeout:90000});}
   finally{await page.keyboard.up('KeyW');}
   if(trial===1)await page.screenshot({path:resolve(output,'gameplay.png'),timeout:90000});
   assert.deepEqual(report.errors,[]);
   assert.deepEqual(report.httpErrors,[]);
   report.passed=true;
  }catch(error){report.failure=String(error);throw error;}
  finally{console.log(JSON.stringify(report));await browser.close();}
 }
}finally{
 await writeFile(resolve(output,'report.json'),JSON.stringify(reports,null,2));
 server.server.closeAllConnections?.();
 await new Promise(r=>server.server.close(r));
}
