import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 await mkdir('.logs',{recursive:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5200/?debug=1');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._wardenStatus==='ready');await page.waitForTimeout(2500);
 const result=await page.evaluate(async()=>{
  const {renderer:r,run}=window.__DEAD_ARRIVAL__;await r._warmupPromise;run.mode='pause';r.render(run,performance.now());const gl=r.renderer.getContext(),rows=[];gl.finish();
  const counts={texImage2D:0,bufferData:0,createProgram:0};for(const name of Object.keys(counts)){const original=gl[name].bind(gl);gl[name]=(...args)=>{counts[name]++;return original(...args);};}
  for(let cycle=0;cycle<3;cycle++)for(const weapon of [1,2,3,0]){const before={...counts};run.weapon=weapon;const start=performance.now();r.render(run,performance.now());gl.finish();rows.push({cycle,weapon,ms:performance.now()-start,...Object.fromEntries(Object.keys(counts).map(k=>[k,counts[k]-before[k]]))});}
  return rows;
 });assert.deepEqual(errors,[]);assert.ok(result.every(r=>r.createProgram===0),'switching must not compile shaders');assert.ok(result.every(r=>r.bufferData===0&&r.texImage2D===0),'switching must not allocate GPU resources');console.log(JSON.stringify({result,errors},null,2));await writeFile('.logs/switch-'+(process.argv[2]||'latest')+'.json',JSON.stringify({result,errors},null,2));
}finally{await browser.close();}
