import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';

// Measure the production build in isolated desktop Chrome contexts. WebGPU
// work is asynchronous, so these are observed presentation intervals, not
// synthetic gl.finish() timings from the retired WebGL renderer.
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0});
const directory='output/playwright/performance';
const report={label:process.argv[2]||'latest',viewport:[1280,720],mode:'desktop Chrome / native WebGPU / live presentation',rows:[],errors:[]};
await mkdir(directory,{recursive:true});
let browser;

const measure=(page,profile=false)=>page.evaluate(async profile=>{
  const app=window.__DEAD_ARRIVAL__,gfx=app.renderer;
  const before={...gfx.renderer.info.memory};
  const intervals=[];
  const stages={},originals=[];
  const wrap=(object,key,name=key)=>{
    if(!profile||typeof object?.[key]!=='function')return;
    const original=object[key];originals.push([object,key,original]);
    object[key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const slot=stages[name]||{calls:0,totalMs:0};slot.calls++;slot.totalMs+=performance.now()-start;stages[name]=slot;}};
  };
  wrap(gfx,'render','wholeRender');
  wrap(gfx.harborWorld,'update','worldUpdate');
  wrap(gfx.afterlifeLighting,'update','lighting');
  wrap(gfx,'_updateEnemies','enemyVisuals');
  wrap(gfx,'_updateCombat','combatVisuals');
  wrap(gfx,'_renderScene','sceneSubmit');
  wrap(gfx.bodycam,'render','imagePass');
  wrap(gfx,'_collectDiagnostics','diagnostics');
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
  intervals.sort((a,b)=>a-b);
  const pick=p=>+intervals[Math.min(intervals.length-1,Math.floor(intervals.length*p))].toFixed(2);
  const elapsed=performance.now()-started;
  return {
    course:app.run.course.name||app.run.course.id,
    screen:app.screen,
    backend:!!gfx.renderer.isWebGPURenderer,
    frames:intervals.length,
    elapsedMs:+elapsed.toFixed(1),
    observedFps:+(intervals.length/elapsed*1000).toFixed(1),
    frameMs:{median:pick(.5),p95:pick(.95),max:pick(1)},
    render:{drawCalls:gfx.renderer.info.render.drawCalls,triangles:gfx.renderer.info.render.triangles},
    memory:{beforeBytes:before.total,afterBytes:gfx.renderer.info.memory.total},
    enemyCount:app.run.course.enemies.length,
    stages:Object.fromEntries(Object.entries(stages).map(([key,slot])=>[key,{calls:slot.calls,meanMs:+(slot.totalMs/slot.calls).toFixed(2)}])),
  };
},profile);

try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  for(const [name,query] of [['dungeon','?debug=1&dungeon=0'],['island','?debug=1&world=island']]){
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
    const page=await context.newPage();
    page.on('pageerror',error=>report.errors.push(`${name}: ${error.message}`));
    page.on('console',message=>{if(message.type()==='error')report.errors.push(`${name}: ${message.text()}`);});
    page.on('response',response=>{if(response.status()>=400)report.errors.push(`${name}: ${response.status()} ${response.url()}`);});
    await page.goto(`http://127.0.0.1:${server.port}/${query}`,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__?.renderer,undefined,{timeout:90000});
    await page.locator('[data-action="start"]').click();
    await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play'&&window.__DEAD_ARRIVAL__.renderer._weaponsPrepared,undefined,{timeout:180000});
    await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.health=10000;});
    const row=await measure(page,!!process.env.PERFORMANCE_PROFILE);
    report.rows.push({name,variant:'default',...row});
    await page.screenshot({path:`${directory}/${report.label}-${name}.png`});
    await writeFile(`${directory}/${report.label}.json`,JSON.stringify(report,null,2));
    console.log(JSON.stringify({name,...row}));
    assert.equal(row.screen,'play');
    assert.equal(row.backend,true);
    assert.ok(row.frames>=60,`${name}: presentation stalled`);
    assert.ok(row.render.drawCalls>0,`${name}: no world draw calls`);
    if(name==='island'&&process.env.PERFORMANCE_DIAGNOSE){
      for(const [variant,configure] of [
        ['direct',()=>{const gfx=window.__DEAD_ARRIVAL__.renderer;gfx.settings.bodycam=false;}],
        ['scale-80',()=>{const gfx=window.__DEAD_ARRIVAL__.renderer;gfx.settings.bodycam=true;gfx._renderScale=.8;gfx.resize();}],
      ]){
        await page.evaluate(configure);
        await page.waitForTimeout(500);
        const diagnostic=await measure(page);
        report.rows.push({name,variant,...diagnostic});
        console.log(JSON.stringify({name,variant,...diagnostic}));
      }
    }
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
