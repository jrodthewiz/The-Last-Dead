import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/';
const output=process.env.POC_QA_OUTPUT||'output/playwright/open-world-poc';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(180000);
const report={errors:[],httpErrors:[],views:[]};
page.on('pageerror',error=>report.errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)report.httpErrors.push(`${response.status()} ${response.url()}`);});
try{
 const startupAt=Date.now();
 await page.goto(`${base}?dungeon=0`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:180000});
 await page.locator('[data-action="start"]').click({force:true});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:180000});
 report.startupMs=Date.now()-startupAt;
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.weaponGroups[0].userData.scavengerFitting?.visible),false);
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.extended),true);
 await page.evaluate(async()=>{
  const app=window.__DEAD_ARRIVAL__,r=app.run;
  const {setDungeonOpeningOpen}=await import('./playground/map/dungeon-course.js');
  r.health=9999;r.course.enemies=[];
  const p=r.dungeonProgression;p.encounterPlan.forEach(n=>n.status='cleared');
  p.completedEncounterIds=p.encounterPlan.map(n=>n.id);p.currentEncounter=null;
  for(const opening of r.course.openings)if(!opening.secret)setDungeonOpeningOpen(r.course,opening.id,true);
 });
 await page.screenshot({path:`${output}/original-section.png`});
 console.log('Normal startup ready; collecting two caches through movement input');
 for(let index=0;index<2;index++){
  const placed=await page.evaluate(async index=>{
   const {canStand,castRay}=await import('./engine.js');const r=window.__DEAD_ARRIVAL__.run;
   const cache=r.course.scavengerPickups[index];
   for(const [dx,dy] of [[.75,0],[-.75,0],[0,.75],[0,-.75]]){
    if(!canStand(r.course,cache.x+dx,cache.y+dy,.1))continue;
    if(castRay(r.course,cache.x+dx,cache.y+dy,Math.atan2(-dy,-dx),1).dist<.75)continue;
    Object.assign(r,{x:cache.x+dx,y:cache.y+dy,z:0,vx:0,vy:0,vz:0,angle:Math.atan2(-dy,-dx),pitch:0});
    return {id:cache.id,x:r.x,y:r.y};
   }
   throw Error('No approach to cache');
  },index);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(id=>window.__DEAD_ARRIVAL__.run.backpack.collected.includes(id),placed.id,{timeout:20000});
  await page.keyboard.up('KeyW');
 }
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.backpack.scrap),8);
 await page.keyboard.press('KeyB');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.packUI.isOpen);
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'pause');
 await page.screenshot({path:`${output}/backpack-before.png`});
 await page.locator('.pack-upgrade').click();
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.backpack.scrap),0);
 assert.equal(await page.locator('.pack-upgrade').isDisabled(),true);
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.backpack.weaponMods[0]),'hardened-fitting');
 await page.screenshot({path:`${output}/backpack-fitted.png`});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&!window.__DEAD_ARRIVAL__.packUI.isOpen);
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.renderer.weaponGroups[0].userData.scavengerFitting?.visible===true);
 await page.screenshot({path:`${output}/visible-weapon-fitting.png`});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');
 await page.keyboard.press('KeyB');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.packUI.isOpen);
 await page.keyboard.press('KeyB');
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'pause','closing pack preserves a pre-existing pause');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 report.preservesPause=true;
 report.combat=await page.evaluate(async()=>{
  const {newRun,makeCourse,shoot}=await import('./engine.js');
  const {upgradeWeapon}=await import('./scavenger-pack.js');
  const measure=fitted=>{
   const r=newRun(makeCourse());r.mode='play';r.x=6;r.y=6;r.angle=0;r.pitch=-.1;
   r.course.blocks=[];r.course.cells=Array.from({length:r.course.w*r.course.h},()=>[0,0,0,0]);
   const e={id:1,x:7,y:6,hp:100,dead:false,kind:'caster',variant:'spitter',speed:0};r.course.enemies=[e];
   if(fitted){r.backpack.scrap=8;upgradeWeapon(r,0);}
   shoot(r);return 100-e.hp;
  };
  return {base:measure(false),fitted:measure(true)};
 });
 assert.ok(report.combat.base>0);assert.ok(Math.abs(report.combat.fitted/report.combat.base-1.25)<.001);
 console.log('Backpack collection, spend, combat factor and resume passed');
 report.annex=await page.evaluate(()=>{
  const app=window.__DEAD_ARRIVAL__,r=app.run;
  const room=r.course.rooms.find(room=>room.section==='annex'&&room.id.includes('pump'))||r.course.rooms.find(room=>room.section==='annex');
  Object.assign(r,{x:room.center.x,y:room.center.y,z:0,vx:0,vy:0,vz:0,angle:-Math.PI/2,pitch:.02});
  r.course.enemies=[];app.renderer.render(r,performance.now());
  const panels=[];app.renderer.worldRoot.traverse(node=>{if(node.name.startsWith('AnnexPanel'))panels.push({name:node.name,count:node.count,map:!!node.material.map,wear:!!node.instanceColor});});
  return {room:room.id,extension:r.course.extension,panels};
 });
 assert.ok(report.annex.panels.length===2&&report.annex.panels.every(p=>p.map&&p.wear));
 for(const angle of [-Math.PI/2,-.25]){
  await page.evaluate(angle=>{window.__DEAD_ARRIVAL__.run.angle=angle;},angle);await page.waitForTimeout(300);
  await page.screenshot({path:`${output}/annex-${angle===-.25?'reverse':'forward'}.png`});
 }
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(200);
  // Resizing a desktop context keeps mouse capture. Real touch contexts do
  // not lock the pointer; use the desktop shortcut in this viewport sweep.
  await page.keyboard.press('KeyB');
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.packUI.isOpen);
  report.views.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
   panel:document.querySelector('.pack-panel').getBoundingClientRect().toJSON(),close:document.querySelector('.pack-close').getBoundingClientRect().toJSON()})));
  assert.ok(report.views.at(-1).scrollWidth<=width);
  assert.ok(report.views.at(-1).close.width>=44&&report.views.at(-1).close.height>=44);
  await page.screenshot({path:`${output}/${name}-pack.png`});
  await page.locator('.pack-close').click();
 }
 report.renderer=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._collectDiagnostics(window.__DEAD_ARRIVAL__.run));
 report.audio=await page.evaluate(()=>window.__DEAD_ARRIVAL__.audio.debugInfo);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
 console.log(JSON.stringify({combat:report.combat,views:report.views.length,errors:report.errors,routeRatio:report.annex.extension.routeRatio}));
}catch(error){report.failure=await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__?.screen,run:window.render_game_to_text?.()})).catch(()=>null);await page.screenshot({path:`${output}/failure.png`,timeout:30000}).catch(()=>{});throw error;}
finally{await writeFile(`${output}/browser-report.json`,JSON.stringify(report,null,2));await browser.close();}
