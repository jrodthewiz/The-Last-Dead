import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=resolve(process.env.BLACKWATER_QA_OUTPUT||'output/playwright/blackwater-continuity/loading');await mkdir(output,{recursive:true});
const server=await startServer({root:resolve(process.env.BLACKWATER_QA_ROOT||'dist'),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist']});
const report={errors:[],httpErrors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});await guardBackgroundInput(page);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push([r.status(),r.url()]);});
 await page.addInitScript(()=>{window.loadStages=[];window.longTasks=[];window.glbLoads=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.longTasks.push({at:e.startTime,ms:e.duration});}).observe({type:'longtask',buffered:true});document.addEventListener('DOMContentLoaded',()=>{const el=document.getElementById('loading');new MutationObserver(()=>window.loadStages.push({at:performance.now(),text:el.textContent})).observe(el,{childList:true});});});
 // Instrument the same loader without changing its scheduling or ownership.
 await page.route('**/assets/load-glb.js',async route=>{let source=await readFile(resolve('assets/load-glb.js'),'utf8');source=source.replace('const response=await fetch(url);','const record={url,at:performance.now()};window.glbLoads.push(record);const response=await fetch(url);').replace('return new GLTFLoader().parseAsync(data,base);','record.fetchedAt=performance.now();const result=await new GLTFLoader().parseAsync(data,base);record.readyAt=performance.now();return result;');await route.fulfill({contentType:'text/javascript',body:source});});
 if(process.env.BLACKWATER_BASELINE_ROOT)await page.route('**/island/*.js',async route=>{try{await route.fulfill({contentType:'text/javascript',body:await readFile(resolve(process.env.BLACKWATER_BASELINE_ROOT,new URL(route.request().url()).pathname.split('/').pop()),'utf8')});}catch{await route.continue();}});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 await page.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});
 Object.assign(report,await page.evaluate(()=>({readyMs:performance.now(),warmup:__BLACKWATER__.warmup,stages:window.loadStages,glbs:window.glbLoads,longTasks:window.longTasks,resources:performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').slice(-2).join('/'),start:e.startTime,duration:e.duration,bytes:e.decodedBodySize})).sort((a,b)=>b.duration-a.duration).slice(0,20)})));
 const {profile}=await cdp.send('Profiler.stop');await writeFile(output+'/startup.cpuprofile',JSON.stringify(profile));const nodes=new Map(profile.nodes.map(n=>[n.id,n])),times=new Map();profile.samples.forEach((id,i)=>times.set(id,(times.get(id)||0)+(profile.timeDeltas[i]||0)));report.cpuTop=[...times].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([id,us])=>({name:nodes.get(id).callFrame.functionName,url:nodes.get(id).callFrame.url,line:nodes.get(id).callFrame.lineNumber+1,selfMs:us/1000}));
 await page.screenshot({path:output+'/title.png'});await page.locator('#begin').click();await page.waitForTimeout(2000);report.contextLost=await page.evaluate(()=>__BLACKWATER__.renderer.getContext().isContextLost());assert.equal(report.contextLost,false);assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.server.close(r));console.log(JSON.stringify({readyMs:report.readyMs,warmup:report.warmup,stages:report.stages,cpuTop:report.cpuTop,errors:report.errors},null,2));}
