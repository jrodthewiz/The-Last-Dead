import {createRequire} from 'node:module';
import {mkdir,writeFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const sharp=process.env.PLAYWRIGHT_PATH?createRequire(`${process.env.PLAYWRIGHT_PATH}/package.json`)('sharp'):require('sharp');
const output=process.env.V5_OUTPUT||'output/playwright/map-v5';await mkdir(output,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
const report={errors:[],views:[],benchmarks:[],fixedRenderTimeMs:123000};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));
async function load(floor){
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=${floor}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared&&window.__DEAD_ARRIVAL__.renderer.materials.afterlifeWood.map.image?.complete);
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,a=d.renderer,original=a.render;d.run.mode='ready';a.render=function(r){this._lastNow=123000-16;return original.call(this,r,123000);};});
}
async function shot(name){
 await page.waitForTimeout(350);const png=await page.screenshot({path:`${output}/${name}.png`}),v=page.viewportSize();
 const pixels=await sharp(png).extract({left:Math.floor(v.width*.2),top:Math.floor(v.height*.25),width:Math.floor(v.width*.6),height:Math.floor(v.height*.5)}).resize(96,64).removeAlpha().raw().toBuffer();
 const mean=pixels.reduce((a,b)=>a+b,0)/pixels.length;assert(new Set(pixels).size>16&&mean>6,'scene pixels contain lit geometry');
 report.views.push({name,scenePixelMean:mean,...await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,a=d.renderer,r=a.renderer;return{position:[d.run.x,d.run.y,d.run.angle],freeCamera:a.freeCamera||null,bodycam:a.settings.bodycam,calls:r.info.render.calls,triangles:r.info.render.triangles,memory:r.info.memory,programs:r.info.programs.length,diagnostics:a._collectDiagnostics(d.run)};})});console.log('Captured',name);
}
try{
 for(const name of ['afterlife-cabinet-wood-v1.webp','afterlife-cabinet-wood-projected-v3.webp']){
  const path=fileURLToPath(new URL(`../assets/textures/${name}`,import.meta.url)),metadata=await sharp(path).metadata();assert.equal(metadata.width,512);assert.equal(metadata.height,512);
  (report.textureFiles||=[]).push({name,dimensions:[metadata.width,metadata.height],bytes:(await stat(path)).size,gpuRGBA8WithMips:1398101});
 }
 assert(report.textureFiles[1].bytes<=report.textureFiles[0].bytes,'Replacement stays inside the existing download budget');
 const boundaries=[];
 for(const {name} of report.textureFiles){
  const tile=await sharp(fileURLToPath(new URL(`../assets/textures/${name}`,import.meta.url))).removeAlpha().raw().toBuffer();let max=0;
  for(let n=0;n<512;n++)for(let c=0;c<3;c++)max=Math.max(max,Math.abs(tile[n*3+c]-tile[(511*512+n)*3+c]),Math.abs(tile[(n*512)*3+c]-tile[(n*512+511)*3+c]));boundaries.push(max);
 }
 assert(boundaries[1]<=boundaries[0],'Decoded repeat seam is no worse than the shipped tile');report.decodedBoundaryMax=boundaries;
 await load(0);
 report.woodSetup=await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,a=d.renderer,source=a.materials.afterlifeWood.map.source,maps=new Set([a.materials.afterlifeWood.map]);
  a.scene.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m?.map?.source===source)maps.add(m.map);});
  const old=new Image();old.src='./assets/textures/afterlife-cabinet-wood-v1.webp';await old.decode();
  window.__wood={source,maps,old,painted:source.data};window.__woodSwap=mode=>{source.data=window.__wood[mode];source.needsUpdate=true;for(const map of maps)map.needsUpdate=true;};
  const slot=a.afterlifeMapDesign.diagnostics.propSlots.find(p=>p.kind==='mourning-cabinet');
  if(!slot)throw Error('No actual map cabinet');window.__cabinetSlot=slot;
  return{slot,sharedMapObjects:maps.size,colorSpace:a.materials.afterlifeWood.map.colorSpace,anisotropy:a.materials.afterlifeWood.map.anisotropy,wrap:[a.materials.afterlifeWood.map.wrapS,a.materials.afterlifeWood.map.wrapT]};
 });
 // Actual map geometry and authored lighting. Inspection camera hides only the player.
 for(const distance of [2.8,5,10]){
  await page.evaluate(distance=>{const a=window.__DEAD_ARRIVAL__.renderer,p=window.__cabinetSlot.position;a.settings.bodycam=false;a.freeCamera={x:p[0]+distance,y:1.45,z:p[2]+.35,angle:Math.atan2(-.35,-distance),pitch:-.08};},distance);
  for(const mode of distance===2.8?['old','painted']:['painted']){await page.evaluate(mode=>window.__woodSwap(mode),mode);await shot(`cabinet-${mode}-${distance}m-no-post`);}
 }
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,a=d.renderer;a.freeCamera=null;a.settings.bodycam=true;Object.assign(d.run,{x:15,y:21.5,angle:Math.PI,pitch:-.035});});
 for(const mode of ['old','painted']){await page.evaluate(mode=>window.__woodSwap(mode),mode);await shot(`old-intake-${mode}-final`);}
 report.benchmarks.push(await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,a=d.renderer,r=a.renderer,gl=r.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve)),median=values=>{const v=[...values].sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null;};
  const original=a.render;let collection=null;
  // Freeze the authored scene pose as well as the camera. Full scene,
  // transmission and bodycam passes still render; animation/FX decay cannot
  // change draw counts between artwork variants. CPU is render submission only.
  a.render=function(){const c=collection,q=c&&ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const start=performance.now();this._transmissionRegion.begin(this.camera);try{this._renderScene(123000);}finally{this._transmissionRegion.end();if(c){c.cpu.push(performance.now()-start);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);c.pending.push(q);}c.budget={calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures,geometries:r.info.memory.geometries,programs:r.info.programs.length};}}};
  const runs=[];
  try{
   for(const mode of ['old','painted','painted','old']){
    window.__woodSwap(mode);for(let i=0;i<60;i++)await raf();
    const c={cpu:[],gpu:[],pending:[],budget:null};collection=c;for(let i=0;i<75;i++)await raf();collection=null;
    for(let tries=0;c.pending.length&&tries<180;tries++){await raf();if(gl.getParameter(ext.GPU_DISJOINT_EXT)){for(const q of c.pending)gl.deleteQuery(q);c.pending.length=0;c.gpu.length=0;break;}for(let i=c.pending.length-1;i>=0;i--){const q=c.pending[i];if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){c.gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);c.pending.splice(i,1);}}}
    for(const q of c.pending)gl.deleteQuery(q);
    runs.push({mode,cpuSubmitMedianMs:median(c.cpu),gpuMedianMs:median(c.gpu),gpuSamples:c.gpu.length,frames:c.cpu.length,budget:c.budget});
   }
   return{scope:'Frozen actual game pose; full scene/transmission/bodycam rendering; CPU submission only',renderer:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER),viewport:[r.domElement.width,r.domElement.height],timerSupported:!!ext,runs};
  }finally{collection=null;a.render=original;window.__woodSwap('painted');}
 }));
 const bench=report.benchmarks[0];for(const run of bench.runs)assert.deepEqual(run.budget,bench.runs[0].budget,'Replacement retains draw/triangle/texture/geometry/program budgets');
 console.log(JSON.stringify(bench));
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');
 await page.locator('[data-action="resume"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.pause());await page.locator('[data-action="restart"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 report.pauseResumeRestart='PASS';
 await load(2);
 await page.evaluate(async()=>{window.__course=await import('./playground/map/dungeon-course.js');});
 for(const [name,x,y,angle] of [['south',19.5,17.5,-Math.PI/2],['east',23.5,15.5,Math.PI]]){
  await page.evaluate(({x,y,angle})=>{const d=window.__DEAD_ARRIVAL__;Object.assign(d.run,{x,y,angle,pitch:-.035,mode:'ready'});d.run.dungeonProgression.activeRoomId='f3-hub';d.renderer.settings.bodycam=true;},{x,y,angle});
  if(name==='south')await shot('f3-south-door-closed-final');
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;for(const o of r.course.openings)window.__course.setDungeonOpeningOpen(r.course,o.id,true);});
  await shot(`f3-${name}-final`);
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.settings.bodycam=false);await shot(`f3-${name}-no-post`);
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.settings.bodycam=true);await shot('f3-portrait');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(e){report.result='FAIL';report.failure=e.stack;await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw e;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
console.log(`Map v5 QA ${report.result}: ${output}/report.json`);
