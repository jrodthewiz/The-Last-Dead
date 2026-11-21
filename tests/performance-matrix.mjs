import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';

// Measure the production build in isolated desktop Chrome contexts. These are
// observed presentation intervals from the live loop (rAF cadence), plus the
// renderer's own counters, not synthetic gl.finish() timings.
//
// Start flow: the title button is `#begin`, disabled until the coast is
// charted; the debug handle is `window.__BLACKWATER__` and only exists after
// the journey starts. Set PERFORMANCE_PROFILE=1 for per-stage wrap timings and
// PERFORMANCE_WORLDS="island,dungeon" for more than the default island row.
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0});
const directory='output/playwright/performance';
const worlds=(process.env.PERFORMANCE_WORLDS||'island').split(',').map(s=>s.trim()).filter(Boolean);
const report={label:process.argv[2]||'latest',viewport:[1280,720],mode:'desktop Chrome / live presentation / current renderer',rows:[],errors:[]};
await mkdir(directory,{recursive:true});
let browser;

const measure=(page,profile=false)=>page.evaluate(async profile=>{
  const app=window.__BLACKWATER__,gfx=app?.renderer;
  if(!gfx) throw new Error('No renderer on window.__BLACKWATER__');
  const info=gfx.info;
  const before={...info.memory};
  const intervals=[];
  const stages={},originals=[];
  const wrap=(object,key,name=key)=>{
    if(!profile||typeof object?.[key]!=='function')return;
    const original=object[key];originals.push([object,key,original]);
    object[key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const slot=stages[name]||{calls:0,totalMs:0};slot.calls++;slot.totalMs+=performance.now()-start;stages[name]=slot;}};
  };
  wrap(gfx,'render','wholeRender');
  wrap(gfx,'harborWorld','worldObject');
  wrap(gfx.harborWorld,'update','worldUpdate');
  wrap(gfx,'afterlifeLighting','lightingObject');
  wrap(gfx.afterlifeLighting,'update','lightingUpdate');
  wrap(gfx,'_updateEnemies','enemyVisuals');
  wrap(gfx,'_updateCombat','combatVisuals');
  wrap(gfx,'_renderScene','sceneSubmit');
  wrap(gfx.bodycam,'render','imagePass');
  const started=performance.now();
  try{await new Promise(resolve=>{
    let last=0;
    const sample=now=>{
      if(last)intervals.push(now-last);
      last=now;
      if(now-started<8000)requestAnimationFrame(sample);
      else resolve();
    };
    requestAnimationFrame(sample);
  });}finally{for(const [object,key,original] of originals.reverse())object[key]=original;}
  const elapsed=performance.now()-started;
  const sorted=[...intervals].sort((a,b)=>a-b);
  const pick=p=>+(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]||0).toFixed(2);
  let metrics=null;
  try{metrics=app.metrics?.()||null;}catch{}
  const gl=gfx.getContext?.();
  const debugInfo=gl?.getExtension?.('WEBGL_debug_renderer_info');
  const gpu=debugInfo?gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL):'unavailable';
  return {
    mode:app.mode,
    renderer:gfx.isWebGPURenderer?'webgpu':'webgl',
    gpu,
    frames:intervals.length,
    elapsedMs:+elapsed.toFixed(1),
    observedFps:+(intervals.length/elapsed*1000).toFixed(1),
    frameMs:{median:pick(.5),p95:pick(.95),max:pick(1)},
    render:{drawCalls:info.render.calls??metrics?.calls??0,triangles:info.render.triangles??metrics?.triangles??0,frame:info.render.frame??0},
    memory:{beforeBytes:before.total??0,afterBytes:info.memory.total??0},
    metrics,
    stages:Object.fromEntries(Object.entries(stages).map(([key,slot])=>[key,{calls:slot.calls,meanMs:+(slot.totalMs/slot.calls).toFixed(2)}])),
  };
},profile);

const queries={island:'?debug=1&world=island',dungeon:'?debug=1&dungeon=0'};

try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding',...(process.env.PERFORMANCE_UNCAPPED?['--disable-frame-rate-limit']:[])]});
  for(const name of worlds){
    const query=queries[name]||`?debug=1&world=${name}`;
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
    const page=await context.newPage();
    page.on('pageerror',error=>report.errors.push(`${name}: ${error.message}`));
    page.on('console',message=>{if(message.type()==='error')report.errors.push(`${name}: ${message.text()}`);});
    page.on('response',response=>{if(response.status()>=400)report.errors.push(`${name}: ${response.status()} ${response.url()}`);});
    await page.goto(`http://127.0.0.1:${server.port}/${query}`,{waitUntil:'load',timeout:90000});
    await page.waitForSelector('#begin:not([disabled])',{timeout:120000});
    await page.click('#begin');
    await page.waitForFunction(()=>!!window.__BLACKWATER__?.renderer,undefined,{timeout:120000});
    await page.waitForTimeout(2500);
    const runs=[];
    for(let run=0;run<3;run++)runs.push(await measure(page,run===0&&!!process.env.PERFORMANCE_PROFILE));
    const row=runs[runs.length-1];
    const medians=runs.map(r=>r.frameMs.median).sort((a,b)=>a-b);
    report.gpu=row.gpu;
    report.rows.push({name,variant:'default',stableMedianMs:medians[1],runs,...row});
    await page.screenshot({path:`${directory}/${report.label}-${name}.png`});
    await writeFile(`${directory}/${report.label}.json`,JSON.stringify(report,null,2));
    console.log(JSON.stringify({name,...row}));
    assert.equal(row.mode,'playing',`${name}: did not reach the play screen`);
    assert.ok(row.frames>=60,`${name}: presentation stalled`);
    assert.ok(row.render.drawCalls>0,`${name}: no world draw calls`);
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
  report.passed=true;
}finally{
  await writeFile(`${directory}/${report.label}.json`,JSON.stringify(report,null,2));
  await browser?.close();
  server.server.closeAllConnections();
  await new Promise(resolve=>server.server.close(resolve));
}
