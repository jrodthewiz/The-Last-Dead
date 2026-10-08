import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const output='output/playwright/low-tide';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(300000);
const report={fixture:'Production entrypoint, own browser/storage. Enemies retained. Position fixtures place player near each entrance/station; real Q and W inputs use the diagnostic fixed-step clock. No mission flags are injected.',errors:[],steps:[]};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
async function key(code,ms=60){await page.keyboard.down(code);try{await page.evaluate(ms=>window.advanceTime(ms),ms);}finally{await page.keyboard.up(code);}await page.evaluate(()=>window.advanceTime(20));}
try{
 const start=Date.now();await page.goto('http://127.0.0.1:5200/?district=harbor&debug');
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__);await page.locator('[data-action="start"]').click({force:true});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.renderer.harborWorld?.lowTideVisuals);
 report.startupMs=Date.now()-start;console.log(`Low Tide loaded in ${report.startupMs} ms`);
 page.setDefaultTimeout(60000);
 for(const id of ['shelter','manifest','identified','fuel','battery','powered','shelter']){
  await page.evaluate(id=>{const r=window.__DEAD_ARRIVAL__.run,p=r.course.lowTideStations.find(p=>p.id===id),room=r.course.harborRooms.find(room=>room.id===p.roomId);r.course.activeInterior=null;Object.assign(r,room.door,{z:0,vx:0,vy:0,vz:0});window.advanceTime(20);},id);
  await key('KeyQ');assert.ok(await page.evaluate(()=>!!window.__DEAD_ARRIVAL__.run.course.activeInterior),id);
  const before=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.y);await key('KeyW',300);assert.ok(await page.evaluate(y=>window.__DEAD_ARRIVAL__.run.y<y-.1,before),'walk inside '+id);
  await page.evaluate(id=>{const r=window.__DEAD_ARRIVAL__.run,p=r.course.lowTideStations.find(p=>p.id===id);Object.assign(r,{x:p.x,y:p.y,z:0,vx:0,vy:0,angle:Math.PI,pitch:-.08});window.advanceTime(20);},id);
  await page.screenshot({path:`${output}/${id}-before-${report.steps.length}.png`});await key('KeyQ');
  const state=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.ok(state.lowTide[id]);report.steps.push({id,state:state.lowTide,objective:state.missionObjective});
  await page.screenshot({path:`${output}/${id}-after-${report.steps.length}.png`});
  if(id==='powered'){
   await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,r.course.activeInterior.exit,{vx:0,vy:0});window.advanceTime(20);});await key('KeyQ');
   assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.activeInterior),null);
   await page.evaluate(()=>window.advanceTime(1000));report.bell=await page.evaluate(()=>({remaining:window.__DEAD_ARRIVAL__.run.lowTide.bellRemaining,minds:window.__DEAD_ARRIVAL__.run.course.enemies.map(e=>({state:e.mind?.state,noise:e.mind?.noise}))}));
  }
 }
 assert.ok(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.lowTide.answered));
 await key('KeyB');await page.getByRole('button',{name:'JOURNAL',exact:true}).click();
 assert.equal(await page.locator('.pack-journal article').count(),7);assert.match(await page.locator('.pack-journal').innerText(),/Don’t send the ferry yet/);
 for(const [name,width,height]of [['desktop',1280,800],['compact',844,600]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.querySelector('.pack-panel').scrollWidth>document.querySelector('.pack-panel').clientWidth+1),false);await page.screenshot({path:`${output}/journal-${name}.png`});}
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('thelastdead.low-tide.v1')));assert.ok(saved.mission.answered);
 // Exercise the actual menu/restart recovery owner rather than only the codec.
 await page.locator('.pack-close').click();await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.health=0;window.__DEAD_ARRIVAL__.run.mode='dead';});
 await page.waitForSelector('.finish-screen [data-action="restart"]');await page.locator('.finish-screen [data-action="restart"]').click();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.mode==='play'&&window.__DEAD_ARRIVAL__.run.lowTide?.answered);
 report.recovery=await page.evaluate(()=>({room:window.__DEAD_ARRIVAL__.run.course.activeInterior?.id,health:window.__DEAD_ARRIVAL__.run.health}));assert.equal(report.recovery.room,'harbor-block-3');assert.equal(report.recovery.health,100);
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e.stack||e);await page.screenshot({path:`${output}/failure.png`,timeout:15000}).catch(()=>{});throw e;}
finally{await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
