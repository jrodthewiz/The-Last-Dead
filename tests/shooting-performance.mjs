import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 await mkdir('.logs',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5200/?debug=1');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__);
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.render(window.__DEAD_ARRIVAL__.run,performance.now()));
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared,{},{timeout:60000});
 await page.waitForTimeout(2500);
 const result=await page.evaluate(async()=>{
  const {renderer:r,run}=window.__DEAD_ARRIVAL__,{shoot,tick}=await import('/engine.js');run.mode='pause';
  if(r._warmupPromise)await r._warmupPromise;
  const gl=r.renderer.getContext(),rows=[];
  // The old empty-arena test missed skinned enemies and the Arc glass pass.
  run.mode='play';for(let i=0;i<360;i++)tick(run,1/120,{});run.mode='pause';
  if(!run.course.enemies.length)throw Error('combat regression needs a spawned enemy');
  const known=new Set(r.renderer.info.programs);
  r.render(run,performance.now());
  const late=r.renderer.info.programs.filter(p=>!known.has(p)&&p.cacheKey.startsWith('physical'));
  if(late.length)throw Error('first enemy spawn compiled physical shaders after preparation');
  for(let weapon=0;weapon<4;weapon++)for(let shot=0;shot<3;shot++){
   run.weapon=weapon;run.shot=0;r.render(run,performance.now());gl.finish();
   const before=r.renderer.info.programs.length;run.cooldowns.fill(0);run.mode='play';const fired=shoot(run,false);run.mode='pause';
   const start=performance.now();r.render(run,performance.now());gl.finish();
   rows.push({weapon,shot,fired,ms:performance.now()-start,newPrograms:r.renderer.info.programs.length-before});
   run.tracers.length=0;run.projectiles.length=0;
  }
  return rows;
 });
 assert.deepEqual(errors,[]);assert.ok(result.every(r=>r.fired),'all four weapons must fire');assert.ok(result.every(r=>r.newPrograms===0),'shooting must not compile shader programs after warmup');
 console.log(JSON.stringify({result,errors},null,2));await writeFile('.logs/shooting-'+(process.argv[2]||'latest')+'.json',JSON.stringify({result,errors},null,2));
}finally{await browser.close();}
