import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';

// Focused image-quality comparison for the active Blackwater renderer. The
// production page is still served by island/game.js; the older performance
// matrix targets a retired __DEAD_ARRIVAL__ WebGPU entry and cannot boot this
// build. Keep this harness self-contained so before/after numbers use one path.
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const label=process.argv[2]||'latest';
const directory=`output/playwright/blackwater-shader-review/${label}`;
const poses=[
 ['01-ordinary-play',null],
 ['02-oldtown',[590,16,7,635,16.5,-2]],
 ['03-civic',[672,16,8,742,27,0]],
 ['04-waterfront',[1174,16,235,1188,22,178]],
 ['05-bridge-approach',[-20,17.7,2,190,24,0]],
 ['06-keeper-house',[-799,39,-260,-795,39,-280]],
 ['07-signal-stairs',[-440,81,-277,-407,85,-286]],
 ['08-island',[-900,210,520,-170,20,-50]],
 ['09-generator',[1005,16,-289,1000,16,-302]],
 ['10-forest',[-870,20,170,-870,28,60]]
];
const performancePoses=[
 ['arrival',[-745,282,1.27]],
 ['oldtown',[590,16,7]],
 ['bridge',[-20,17.7,2]],
 ['city',[1005,16,-289]]
];
const report={label,viewport:[1280,720],mode:'desktop Chrome / WebGL2 / live presentation',game:'island/game.js',buildRoot:resolve(process.env.BLACKWATER_QA_ROOT||'dist'),screenshots:{},performance:{},errors:[]};
await mkdir(directory,{recursive:true});
const server=await startServer({root:report.buildRoot,port:0});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});
 await page.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'networkidle',timeout:120000});
 await page.waitForFunction(()=>!!window.__BLACKWATER__,undefined,{timeout:120000});
 await page.getByRole('button',{name:'Begin journey'}).click();
 await page.evaluate(()=>window.__BLACKWATER__.setTime(48));
 await page.waitForTimeout(1200);

 // Sample three short passes per pose before screenshots, so screenshot
 // allocation cannot leave a garbage-collection spike inside the timing data.
 report.performance=await page.evaluate(async poses=>{
  const g=window.__BLACKWATER__,out={};
  const sample=()=>new Promise(resolve=>{
   const intervals=[],started=performance.now();
   let last=0;
   const tick=now=>{
    if(last)intervals.push(now-last);
    last=now;
    if(now-started<3000)requestAnimationFrame(tick);
    else resolve({intervals,elapsed:performance.now()-started});
   };
   requestAnimationFrame(tick);
  });
  for(const [name,[x,z,yaw]] of poses){
   g.teleport(x,z,yaw);
   await new Promise(resolve=>setTimeout(resolve,900));
   const runs=[];
   for(let pass=0;pass<3;pass++){
    const {intervals,elapsed}=await sample();
    // Drop the first frames after each measurement's rAF restart; they include
    // the browser's periodic five-second housekeeping tick.
    runs.push({intervals:intervals.slice(4),elapsed});
    await new Promise(resolve=>setTimeout(resolve,180));
   }
   const values=runs.flatMap(run=>run.intervals).sort((a,b)=>a-b);
   const elapsed=runs.reduce((sum,run)=>sum+run.intervals.reduce((a,b)=>a+b,0),0);
   const pick=p=>+values[Math.min(values.length-1,Math.floor(values.length*p))].toFixed(2);
   out[name]={
    frames:values.length,
    observedFps:+(values.length/elapsed*1000).toFixed(1),
    frameMs:{median:pick(.5),p95:pick(.95),p99:pick(.99),max:pick(1)},
    passMedians:runs.map(run=>{const sorted=[...run.intervals].sort((a,b)=>a-b);return +sorted[Math.floor(sorted.length*.5)].toFixed(2);})
   };
  }
  return out;
 },performancePoses);
 report.performance.meta=await page.evaluate(()=>{const r=window.__BLACKWATER__.renderer;return{metrics:window.__BLACKWATER__.metrics(),renderer:{isWebGLRenderer:r.isWebGLRenderer,isWebGPURenderer:r.isWebGPURenderer,canvas:[r.domElement.width,r.domElement.height],css:[innerWidth,innerHeight],pixelRatio:r.getPixelRatio()}};});
 report.performance.gpu=await page.evaluate(async ()=>{
  const g=window.__BLACKWATER__,gl=g.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if(!ext)return{available:false,reason:'EXT_disjoint_timer_query_webgl2 unavailable'};
  const run=async([x,z,yaw])=>{
   g.teleport(x,z,yaw);await new Promise(resolve=>setTimeout(resolve,700));
   const queries=[],samples=[];
   const original=g.presentation.render;
   g.presentation.render=function(world,view){const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);try{original.call(this,world,view);}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push(q);}};
   const started=performance.now();
   let disjoint=0,timedOut=false;
   await new Promise(resolve=>{
    const finish=()=>{
     g.presentation.render=original;
     for(const q of queries)gl.deleteQuery(q);
     queries.length=0;
    };
    const poll=()=>{
     if(gl.getParameter(ext.GPU_DISJOINT_EXT))disjoint++;
     while(queries.length&&gl.getQueryParameter(queries[0],gl.QUERY_RESULT_AVAILABLE)){
      const q=queries.shift(),ns=gl.getQueryParameter(q,gl.QUERY_RESULT);gl.deleteQuery(q);samples.push(ns/1e6);
     }
     const elapsed=performance.now()-started;
     if((elapsed>4200&&queries.length===0)||elapsed>6500){
      timedOut=queries.length>0;finish();resolve();
     }else requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
   });
   samples.sort((a,b)=>a-b);
   const pick=p=>+samples[Math.min(samples.length-1,Math.floor(samples.length*p))].toFixed(3);
   return{samples:samples.length,timedOut,disjoint,medianMs:pick(.5),p95Ms:pick(.95),p99Ms:pick(.99),maxMs:pick(1)};
  };
  return{available:true,arrival:await run([-745,282,1.27]),city:await run([1005,16,-289])};
 });

 // Source-resolution before/after images at identical fixed poses.
 const ordinary=poses[0];
 await page.evaluate(()=>window.__BLACKWATER__.teleport(-745,282,1.27));
 await page.waitForTimeout(700);
 await page.screenshot({path:`${directory}/${ordinary[0]}.png`});
 report.screenshots[ordinary[0]]={path:`${directory}/${ordinary[0]}.png`,metrics:await page.evaluate(()=>window.__BLACKWATER__.metrics())};
 for(const [name,pose] of poses.slice(1)){
  await page.evaluate(p=>window.__BLACKWATER__.setPhoto(...p),pose);
  await page.waitForTimeout(600);
  const path=`${directory}/${name}.png`;
  await page.screenshot({path});
  report.screenshots[name]={path,metrics:await page.evaluate(()=>window.__BLACKWATER__.metrics())};
 }
 assert.equal(report.errors.length,0,`runtime errors: ${report.errors.join(' | ')}`);
 for(const [name,data] of Object.entries(report.performance))if(!['meta','gpu'].includes(name))assert.ok(data.frames>=180,`${name}: stalled (${data.frames} frames)`);
 if(report.performance.gpu.available)for(const name of ['arrival','city'])if(!report.performance.gpu[name].timedOut)assert.ok(report.performance.gpu[name].samples>=30,`${name}: GPU timer stalled`);
 report.passed=true;
}finally{
 await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));
 await browser?.close();
 await new Promise(resolve=>server.server.close(resolve));
 console.log(JSON.stringify(report,null,2));
}