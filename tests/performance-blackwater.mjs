import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';

// Current Blackwater startup flow: the title's #begin button stays disabled
// until the world/renderer warmup completes. Drive that exact button, then
// measure the live presentation. Supports either the active island entry
// (__BLACKWATER__) or the legacy WebGPU entry (__DEAD_ARRIVAL__).
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright-core');
const label=process.argv[2]||'run';
const world=process.argv[3]||'island';
const root=resolve(process.env.BLACKWATER_QA_ROOT||'dist');
const outDir=resolve('output/playwright/performance');
await mkdir(outDir,{recursive:true});

const server=await startServer({root,port:0});
let browser;
try{
 browser=await chromium.launch({
  headless:process.env.HEADFUL!=='1',
  executablePath:process.env.CHROME_PATH,
  args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding',...(process.env.PERFORMANCE_UNCAPPED?['--disable-frame-rate-limit']:[])],
 });
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push('pageerror: '+error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});
 page.on('requestfailed',request=>errors.push('failed: '+request.url()));

 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&world=${world}`,{waitUntil:'load',timeout:90000});
 await page.waitForSelector('#begin:not([disabled])',{timeout:120000});
 await page.click('#begin');
 await page.waitForFunction(()=>{
  const legacy=window.__DEAD_ARRIVAL__,island=window.__BLACKWATER__;
  return !!((legacy?.renderer&&legacy.screen==='play')||(island?.renderer&&island.mode==='playing'));
 },undefined,{timeout:120000});
 await page.waitForTimeout(4000);

 const row=await page.evaluate(async ()=>{
  const legacy=window.__DEAD_ARRIVAL__,island=window.__BLACKWATER__;
  const app=legacy?.renderer?legacy:island,gfx=app?.renderer;
  if(!gfx)return{error:'no renderer exposed'};
  const intervals=[],stages={},originals=[];
  const wrap=(object,key,name)=>{
   if(typeof object?.[key]!=='function')return;
   const original=object[key];
   originals.push([object,key,original]);
   object[key]=function(...args){
    const start=performance.now();
    try{return original.apply(this,args);}
    finally{const slot=(stages[name]||={calls:0,totalMs:0});slot.calls++;slot.totalMs+=performance.now()-start;}
   };
  };
  wrap(gfx,'render','wholeRender');
  wrap(gfx,'_renderScene','sceneSubmit');
  wrap(gfx,'_updateEnemies','enemyVisuals');
  wrap(gfx,'_updateCombat','combatVisuals');
  const started=performance.now();
  try{
   await new Promise(resolve=>{
    let last=0;
    const sample=now=>{
     if(last)intervals.push(now-last);
     last=now;
     if(now-started<8000)requestAnimationFrame(sample);
     else resolve();
    };
    requestAnimationFrame(sample);
   });
  }finally{for(const [object,key,original] of originals.reverse())object[key]=original;}
  const elapsed=performance.now()-started;
  const sorted=[...intervals].sort((a,b)=>a-b);
  const pick=q=>+(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]||0).toFixed(2);
  const info=gfx.info;
  let metrics=null;try{metrics=app.metrics?.()||null;}catch{}
  return{
   screen:legacy?.screen??island?.mode,
   backend:!!gfx.isWebGPURenderer,
   isWebGLRenderer:!!gfx.isWebGLRenderer,
   frames:intervals.length,
   observedFps:+(intervals.length/elapsed*1000).toFixed(1),
   frameMs:{median:pick(.5),p95:pick(.95),p99:pick(.99),max:pick(1)},
   render:{drawCalls:info.render.drawCalls,triangles:info.render.triangles,frame:info.render.frame},
   programs:info.programs?.length??null,
   memory:info.memory.total,
   metrics,
   stages:Object.fromEntries(Object.entries(stages).map(([key,value])=>[key,{calls:value.calls,meanMs:+(value.totalMs/value.calls).toFixed(2)}])),
   viewport:[innerWidth,innerHeight,devicePixelRatio],
  };
 });

 const shot=`${outDir}/${label}-${world}.png`;
 if(process.env.PERFORMANCE_SCREENSHOT!=='0')await page.screenshot({path:shot});
 const report={label,world,root,measuredAt:new Date().toISOString(),row,errors:[...new Set(errors)].slice(0,10),screenshot:shot};
 await writeFile(`${outDir}/${label}-${world}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,1));
}finally{
 await browser?.close();
 await new Promise(resolve=>server.server.close(resolve));
}
