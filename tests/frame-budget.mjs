import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const label=process.argv[2]||'latest',width=Number(process.env.PERF_WIDTH||1920),height=Number(process.env.PERF_HEIGHT||1080);
console.log('benchmark: launch');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--disable-frame-rate-limit','--disable-gpu-vsync']});
try{
 console.log('benchmark: browser ready');
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE ERROR',String(e));});page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE ERROR',m.text());});page.on('requestfailed',r=>console.error('REQUEST FAILED',r.url(),r.failure()?.errorText));page.on('console',m=>{if(m.text().startsWith('benchmark:'))console.log(m.text());});
 await page.goto((process.env.GAME_URL||'http://127.0.0.1:5200/')+'?debug=1',{waitUntil:'domcontentloaded',timeout:120000});console.log('benchmark: DOM ready');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,{},{timeout:180000});
 console.log('benchmark: assets and shaders ready');
 const deadline=setTimeout(()=>{console.error('benchmark: capture deadline exceeded');browser.close();},180000);
 const results=await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,r=d.renderer,g=r.renderer,gl=g.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const device={renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,devicePixelRatio,hardwareConcurrency:navigator.hardwareConcurrency};
  const engine=await import(new URL('engine.js',location.href).href);const original=d.run;original.mode='pause';
  const run=engine.newRun(engine.makeCampaignCourse(0),{requireEntry:true});run.mode='play';run.health=100000;
  for(let i=0;i<1200;i++){run.health=100000;engine.tick(run,1/120,{});}run.mode='pause';
  const originalRender=r.render;r.render=()=>{};console.log('benchmark: deterministic combat prepared');originalRender.call(r,run,performance.now());await r._warmupPromise;console.log('benchmark: scene warm');
  const scenes=[];
  const stats=values=>{const a=values.slice().sort((x,y)=>x-y);return{count:a.length,mean:a.reduce((x,y)=>x+y,0)/Math.max(1,a.length),p50:a[Math.floor(a.length*.5)]||null,p95:a[Math.floor(a.length*.95)]||null,p99:a[Math.floor(a.length*.99)]||null};};
  try{for(const weapon of [0,2]){
   run.weapon=weapon;r._renderScale=1;r.resize();for(let i=0;i<20;i++){originalRender.call(r,run,performance.now());await new Promise(requestAnimationFrame);}
   const cpu=[],gpu=[],frames=[],queries=[];let previous=performance.now();
   for(let i=0;i<120;i++){
    await new Promise(requestAnimationFrame);const start=performance.now();frames.push(start-previous);previous=start;
    const q=ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
    originalRender.call(r,run,start);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push(q);}cpu.push(performance.now()-start);
    while(queries.length&&gl.getQueryParameter(queries[0],gl.QUERY_RESULT_AVAILABLE)){const old=queries.shift();if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(old,gl.QUERY_RESULT)/1e6);gl.deleteQuery(old);}
   }
   for(const q of queries)gl.deleteQuery(q);
   console.log('benchmark: weapon '+weapon+' sampled');scenes.push({weapon,enemies:run.course.enemies.filter(e=>!e.dead).length,frameMs:stats(frames),renderCpuMs:stats(cpu),gpuMs:stats(gpu),diagnostics:r.diagnostics(),targetMs:1000/144,meets144:stats(frames).p95<=1000/144});
  }}finally{r.render=originalRender;}
  return{device,scenes};
 });
 clearTimeout(deadline);
 await mkdir('.logs',{recursive:true});await writeFile('.logs/frame-budget-'+label+'.json',JSON.stringify({label,results,errors},null,2));console.log(JSON.stringify({label,results,errors},null,2));
}finally{await browser.close();}
