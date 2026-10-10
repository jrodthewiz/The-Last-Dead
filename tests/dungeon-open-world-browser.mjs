import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from '../tests/background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const shortRoute=process.env.DUNGEON_SHORT_ROUTE==='1';
const output=resolve(process.env.DUNGEON_OUTPUT||'output/playwright/dungeon-open-world');await mkdir(output,{recursive:true});
const server=process.env.DUNGEON_URL?null:await startServer({root:resolve('dist'),port:0});
const gameUrl=process.env.DUNGEON_URL||`http://127.0.0.1:${server.port}/`;
const report={scope:'Built game; fresh Play Campaign and real E/Q stair interactions in an owned headless browser. Controlled poses and floor-ready state for backtracking; no combat-completion claim.',errors:[],httpErrors:[],views:[],areas:[]};
let browser,page,progressTimer;
const save=()=>writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 page=await browser.newPage({viewport:{width:1280,height:800}});await guardBackgroundInput(page);
 progressTimer=setInterval(async()=>{try{const status=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return q?{screen:q.screen,area:q.run.course.harbor?'coast':`floor-${q.run.course.dungeonIndex}`,stage:q.renderer._preparationStage,deferredViews:q.renderer._deferredWorldGeometry?.size||0}:null;});console.log('Loading status',JSON.stringify(status));}catch{}},30000);
 report.shortRoute=shortRoute;
 if(shortRoute)report.scope='Built game; fresh underground campaign, E travel to the coast and back to the same first floor, repeated coast visit, and Q interior entry/exit. Controlled poses for rendered views; deeper-floor backtracking is omitted in this focused run.';
 if(process.env.DUNGEON_GPU_PROBE==='1')await page.addInitScript(()=>{
  const records=[];window.__QA_GPU_BUFFERS__=records;
  const create=GPUDevice.prototype.createBuffer;
  GPUDevice.prototype.createBuffer=function(descriptor){
   const record={label:`area-probe-${records.length}`,size:descriptor.size,created:new Error().stack,stage:window.__QA_GPU_STAGE__||'startup'};
   const buffer=create.call(this,{...descriptor,label:record.label});records.push(record);
   const destroy=buffer.destroy.bind(buffer);buffer.destroy=()=>{record.destroyed=new Error().stack;record.destroyStage=window.__QA_GPU_STAGE__||'startup';destroy();};
   return buffer;
  };
 });
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('GPU ERROR',m.text());}});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
 await page.goto(`${gameUrl}?debug=1&horrorqa=1&worldSeed=7317`);
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__,null,{timeout:90000});
 await page.locator('[data-action="start"]').click();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:480000});
 await page.evaluate(()=>{window.__HORROR_QA__.setManual(true);document.activeElement?.blur();window.__QA_START_RUN__=window.__DEAD_ARRIVAL__.run;});
 const area=async name=>{
  const state=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return{screen:q.screen,dungeon:!!q.run.course.dungeon,harbor:!!q.run.course.harbor,floor:q.run.course.dungeonIndex,portal:q.run.course.basementPortal,health:q.run.health};});
  await page.evaluate(name=>window.__QA_GPU_STAGE__=name,name);report.areas.push({name,...state});console.log(name,JSON.stringify(state));await save();return state;
 };
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<15;i++)await new Promise(requestAnimationFrame);await window.__DEAD_ARRIVAL__.renderer.renderer.backend.device.queue.onSubmittedWorkDone();});
 const capture=async name=>{await settle();const shot=await page.screenshot({path:`${output}/${name}.png`});assert.ok(shot.length>20000);report.views.push(name);await save();};
 const useStairs=async()=>{await page.keyboard.press('e');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:480000});await settle();};
 assert.equal((await area('fresh-start')).floor,0);assert.equal(report.areas[0].dungeon,true);
 await capture('01-underground-start');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.dungeonProgression.keysCollected.push('qa-retained');r.backpack.scrap=7;});
 await useStairs();assert.equal((await area('ascend')).harbor,true);
 report.polish=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.diagnostics.worldPolish);assert.ok(report.polish.stations>=30);
 await capture('02-customs-return-street');
 await useStairs();assert.equal((await area('revisit')).floor,0);
 assert.ok(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run===window.__QA_START_RUN__&&window.__DEAD_ARRIVAL__.run.dungeonProgression.keysCollected.includes('qa-retained')&&window.__DEAD_ARRIVAL__.run.backpack.scrap===7));
 if(!shortRoute&&process.env.DUNGEON_GPU_PROBE!=='1'){
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,r.course.exit);r.dungeonProgression.exitReady=true;});
 await useStairs();assert.equal((await area('deeper-lift')).floor,1);await capture('03-upper-floor-return-lift');
 await useStairs();assert.equal((await area('backtrack')).floor,0);
 }
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,r.course.playerSpawn);});await useStairs();assert.equal((await area('surface-again')).harbor,true);
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,p=q.run.course.coastal.polish.stations.find(p=>p.kind==='bench');Object.assign(q.run,{x:p.x/4,y:(p.z-3)/4,z:0,angle:Math.PI/2,pitch:-.08,supportZ:null,supportId:null,structureId:null});window.advanceTime(0);});await capture('04-street-detail');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,p=q.run.course.coastal.polish.stations.find(p=>p.kind==='shore'&&p.x>300);Object.assign(q.run,{x:(p.x-4)/4,y:(p.z+3)/4,z:0,angle:Math.atan2(-3,4),pitch:-.04,supportZ:null,supportId:null,structureId:null});window.advanceTime(0);});await capture('05-shore-detail');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,r=q.run;Object.assign(r,r.course.harborRooms[0].door,{z:0,vx:0,vy:0,vz:0});window.advanceTime(0);});
 await page.keyboard.down('q');await page.evaluate(()=>window.advanceTime(30));await page.keyboard.up('q');
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.activeInterior?.id),'harbor-block-0');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,r=q.run,room=r.course.activeInterior;Object.assign(r,{x:room.x/4,y:(room.z+1)/4,angle:-Math.PI/2,pitch:-.02});window.advanceTime(0);});await capture('06-customs-interior');
 await page.keyboard.down('w');await page.evaluate(()=>window.advanceTime(300));await page.keyboard.up('w');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;Object.assign(q.run,q.run.course.activeInterior.exit);window.advanceTime(15);});await page.keyboard.down('q');await page.evaluate(()=>window.advanceTime(30));await page.keyboard.up('q');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.activeInterior),null);
 report.inputSafety=await backgroundInputState(page);assert.deepEqual(report.inputSafety.attempts,{pointerLock:0,fullscreen:0,keyboardLock:0});
 if(process.env.DUNGEON_GPU_PROBE==='1')report.gpuBuffers=await page.evaluate(()=>window.__QA_GPU_BUFFERS__.filter(r=>r.destroyed));assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log('Dungeon/world browser journey passed');await save();
 }catch(e){report.failure=String(e.stack||e);try{report.loading=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return {screen:q.screen,stage:q.renderer._preparationStage,history:q.renderer._preparationHistory};});await page.screenshot({path:`${output}/failure.png`});}catch{}await save();throw e;}
finally{clearInterval(progressTimer);await browser?.close();if(server){server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}}
