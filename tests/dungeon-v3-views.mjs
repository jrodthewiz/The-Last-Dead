import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const sharp=process.env.PLAYWRIGHT_PATH?createRequire(`${process.env.PLAYWRIGHT_PATH}/package.json`)('sharp'):require('sharp');
const output=process.env.V3_OUTPUT||'output/playwright/dungeon-v3';await mkdir(output,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
const report={errors:[],views:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));
async function shot(name){await page.waitForTimeout(450);const png=await page.screenshot({path:`${output}/${name}.png`}),v=page.viewportSize();const pixels=await sharp(png).extract({left:Math.floor(v.width*.2),top:Math.floor(v.height*.25),width:Math.floor(v.width*.6),height:Math.floor(v.height*.5)}).resize(96,64).removeAlpha().raw().toBuffer();const mean=pixels.reduce((a,b)=>a+b,0)/pixels.length;assert(new Set(pixels).size>16&&mean>6,'scene pixels contain lit geometry');report.views.push({name,scenePixelMean:mean,pixelLevels:new Set(pixels).size,...await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.renderer.renderer;return{calls:r.info.render.calls,triangles:r.info.render.triangles,fps:d.fps,position:[d.run.x,d.run.y,d.run.angle],diagnostics:d.renderer._collectDiagnostics(d.run)};})});console.log('Captured',name);}
try{
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.mode='ready';r.pitch=-.04;});
 if(process.env.V3_FOCUS==='old-intake-return'||process.env.V3_FOCUS==='old-intake-doorway'){
  const doorway=process.env.V3_FOCUS==='old-intake-doorway';
  await page.evaluate(x=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x,y:21.5,angle:0,pitch:-.035,mode:'ready'});},doorway?20.5:22.5);await shot(doorway?'old-intake-doorway':'old-intake-return');
 }else{
 await shot('arrival');
 // Stable views from inside authored rooms; keep the same camera in before/after captures.
 for(const roomId of ['f1-hall','f1-court','f1-pump','f1-vault']){
  await page.evaluate(id=>{const r=window.__DEAD_ARRIVAL__.run,room=r.course.rooms.find(room=>room.id===id);if(!room)throw Error('missing '+id);const c=room.center,b=room.bounds;Object.assign(r,{mode:'ready',x:c.x,y:Math.min(b.maxZ-1.5,c.y+2.5),z:0,angle:-Math.PI/2,pitch:-.035});r.dungeonProgression.activeRoomId=id;r.dungeonProgression.navigation={goal:room.flow?.goal||'Continue',kind:'room',roomId:id,waypoint:{x:c.x,y:c.y-2},target:{x:c.x,y:c.y-2},path:[{x:c.x,y:c.y-2}],distance:3,blocked:false};},roomId);await shot(roomId);
 }
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:17.5,y:10.5,angle:-Math.PI/2,pitch:-.035,mode:'ready'});});await shot('f1-court-apron');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:20.5,y:21.5,angle:0,pitch:-.035,mode:'ready'});});await shot('old-intake-return');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run,room=r.course.rooms.find(x=>x.id==='f1-court');Object.assign(r,{x:room.center.x,y:room.bounds.maxZ-1.2,angle:-Math.PI/2,pitch:0});r.dungeonProgression.activeRoomId=room.id;r.dungeonProgression.roomsCompleted=[room.id];});await shot('pulse-engine-restored');
 await page.setViewportSize({width:390,height:844});await shot('portrait');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1280,height:720});
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:18,y:10.5,angle:-Math.PI/2,pitch:-.035,mode:'ready'});});await shot('f2-theater-shelf');
 }
 assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(e){report.result='FAIL';report.failure=e.stack;throw e;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
