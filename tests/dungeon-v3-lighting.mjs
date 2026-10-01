import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/dungeon-v3-lighting';await mkdir(output,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
const report={errors:[]};page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
try{
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 report.sharedWorldMaterials=await page.evaluate(()=>{
  const d=window.__DEAD_ARRIVAL__,r=d.run,materials=new Set(),shared=[];
  d.renderer.weaponRig.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)materials.add(m);});
  d.renderer.worldRoot.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(materials.has(m))shared.push(o.name);});
  Object.assign(r,{x:8.27733159679627,y:13.475337861049569,z:0,angle:0,pitch:-.035});
  r.dungeonProgression.roomsCompleted=['f1-entry','f1-sluice','f1-ward','f1-vault'];
  return shared;
 });assert.deepEqual(report.sharedWorldMaterials,[],'viewmodel light filtering never modifies shared world materials');
 await page.waitForTimeout(20000);
 report.state=await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.run;return{room:r.dungeonProgression.activeRoomId,threats:r.course.enemies.filter(e=>!e.dead).map(e=>({x:e.x,y:e.y})),calls:d.renderer.renderer.info.render.calls,fps:d.fps};});
 assert.equal(report.state.room,'f1-hall');assert.ok(report.state.threats.length>0);
 await page.screenshot({path:`output/playwright/dungeon-v3-lighting/hall-approach.png`});
 assert.deepEqual(report.errors,[]);report.result='PASS';console.log(JSON.stringify(report));
}catch(e){report.result='FAIL';report.failure=e.stack;throw e;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
