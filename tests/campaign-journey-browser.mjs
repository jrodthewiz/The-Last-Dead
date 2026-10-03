import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/';
const output=process.env.JOURNEY_QA_OUTPUT||'docs/no-further-transfers/qa';
const floors=process.env.JOURNEY_QA_FLOORS?process.env.JOURNEY_QA_FLOORS.split(',').map(Number):[0,1,2,3,4];
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={errors:[],httpErrors:[],chapters:[],views:[]};
page.on('pageerror',error=>report.errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)report.httpErrors.push(`${response.status()} ${response.url()}`);});
try {
 await page.goto(`${base}?dungeon=${floors[0]}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:180000});
 await page.locator('[data-action="start"]').click();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:180000});
 assert.ok(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.journey),'normal entry opts into the chapter journey');
 // Engine tests cover reachable travel and encounter gating. This fixture
 // isolates actual input, scene assembly, HUD, phase animation and lifecycle.
 for(const index of floors) {
  console.log(`Preparing chapter ${index+1}`);
  await page.evaluate(async index=>{
   const app=window.__DEAD_ARRIVAL__;
   const [{newRun},{makeDungeonCourse,setDungeonOpeningOpen}]=await Promise.all([import('./engine.js'),import('./playground/map/dungeon-course.js')]);
   Object.assign(app.run,newRun(makeDungeonCourse(index,{journey:true})),{mode:'play',health:9999});
   for(const node of app.run.dungeonProgression.encounterPlan)node.status='cleared';
   app.run.dungeonProgression.completedEncounterIds=app.run.dungeonProgression.encounterPlan.map(node=>node.id);
   app.run.dungeonProgression.currentEncounter=null;
   app.run.dungeonProgression.keysCollected=app.run.course.keys.map(key=>key.id);
   app.run.dungeonProgression.lootCollected=app.run.course.loot.map(item=>item.id);
   for(const opening of app.run.course.openings)if(!opening.secret)setDungeonOpeningOpen(app.run.course,opening.id,true);
   app.run.course.enemies=[];
   app.renderer.render(app.run,performance.now());
   await Promise.race([app.renderer._warmupPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('chapter preparation timed out')),180000))]);
   app.run.course.enemies=[];
  },index);
  const count=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.journey.stations.length);
  for(let step=0;step<count;step++) {
   await page.evaluate(step=>{
    const app=window.__DEAD_ARRIVAL__,run=app.run,station=run.journey.stations[step];
    const entry=app.renderer.journeyVisuals?.entries.find(entry=>entry.id===station.id);
    const yaw=entry?.root.rotation.y||0;
    // Stand at the free operating point and face the actual cell-side mechanism.
    Object.assign(run,{x:station.x+Math.sin(yaw)*.3,y:station.y+Math.cos(yaw)*.3,z:0,vx:0,vy:0,vz:0,angle:Math.atan2(-Math.cos(yaw),-Math.sin(yaw)),pitch:0});
    run.course.enemies=[];
   },step);
   await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__.run.journey.prompt,null,{timeout:20000});
   await page.waitForTimeout(120);
   assert.equal(await page.locator('[data-journey-prompt]').isVisible(),true,'actual contextual prompt is visible');
   if(step===0)await page.screenshot({path:`${output}/chapter-${index+1}-before.png`});
   await page.keyboard.down('KeyQ');
   await page.waitForFunction(step=>window.__DEAD_ARRIVAL__.run.journey.step>step,step,{timeout:12000});
   await page.keyboard.up('KeyQ');
  }
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.journey.phase==='complete',null,{timeout:20000});
  await page.screenshot({path:`${output}/chapter-${index+1}-after.png`});
  report.chapters.push(await page.evaluate(()=>{
   const app=window.__DEAD_ARRIVAL__,run=app.run;
   return {index:run.course.dungeonIndex,title:run.journey.title,phase:run.journey.phase,
    stations:run.journey.stations,exitReady:run.dungeonProgression.exitReady,
    transmission:document.querySelector('[data-hud="journey-text"]').textContent,
    visuals:app.renderer.journeyVisuals?.diagnostics(),renderer:app.renderer._collectDiagnostics(run),contextLost:app.renderer.renderer.getContext().isContextLost()};
  }));
  assert.equal(report.chapters.at(-1).contextLost,false);
 }
 console.log('All chapter inputs complete');
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'pause');
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'play');
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]]) {
  await page.setViewportSize({width,height});await page.waitForTimeout(200);
  report.views.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
   source:document.querySelector('[data-hud="journey-source"]').textContent})));
  assert.ok(report.views.at(-1).scrollWidth<=width,'chapter HUD fits viewport');
  await page.screenshot({path:`${output}/${name}.png`});
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
 console.log(JSON.stringify({chapters:report.chapters.length,views:report.views.length,errors:report.errors}));
}finally{await writeFile(`${output}/browser-report.json`,JSON.stringify(report,null,2));await browser.close();}
