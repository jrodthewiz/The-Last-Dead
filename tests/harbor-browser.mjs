import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/';
const output=process.env.HARBOR_QA_OUTPUT||'output/playwright/harbor';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(300000);
const report={fixture:'Enemies removed after real harbor initialization; approach positions set near pickups and truck. Pickup, equip, driving, braking and exit use real keyboard/UI input.',errors:[],consoleErrors:[],httpErrors:[],views:[],pickups:[]};
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
page.on('response',response=>{if(response.status()>=400)report.httpErrors.push(`${response.status()} ${response.url()}`);});
async function stash(index){
 const placed=await page.evaluate(async index=>{
  const {canStand,castRay}=await import('./engine.js');const r=window.__DEAD_ARRIVAL__.run;
  const item=r.course.weaponPickups[index];
  for(const[dx,dy]of[[.85,0],[-.85,0],[0,.85],[0,-.85]]){
   const x=item.x+dx,y=item.y+dy,angle=Math.atan2(-dy,-dx);
   if(!canStand(r.course,x,y,.12)||castRay(r.course,x,y,angle,1).dist<.85)continue;
   Object.assign(r,{x,y,z:0,vx:0,vy:0,vz:0,angle,pitch:0});
   return {id:item.id,weaponIndex:item.weaponIndex};
  }throw Error('No clear weapon approach');
 },index);
 await page.keyboard.down('KeyW');
 try{await page.waitForFunction(id=>window.__DEAD_ARRIVAL__.run.backpack.weaponPickups?.includes(id),placed.id,{timeout:25000});}
 finally{await page.keyboard.up('KeyW');}
 assert.ok(await page.evaluate(index=>window.__DEAD_ARRIVAL__.run.ownedWeapons.includes(index),placed.weaponIndex));
 await page.waitForFunction(id=>window.__DEAD_ARRIVAL__.renderer.worldRoot.getObjectByName(`StoryWeaponFind_${id}`)?.visible===false,placed.id,{timeout:15000});
 report.pickups.push(placed);return placed;
}
try{
 const started=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__);
 await page.locator('[data-action="start"]').click({force:true});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.renderer.harborWorld);
 report.assets=await page.evaluate(async()=>await window.__DEAD_ARRIVAL__.renderer.harborWorld.ready);
 report.startupMs=Date.now()-started;
 page.setDefaultTimeout(60000);
 assert.deepEqual(report.assets.errors,[]);assert.ok(report.assets.loaded.length>=8);
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.harbor),true);
 assert.deepEqual(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.ownedWeapons),[0]);
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.harborProgress?.initialized);
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.course.enemies=[];});
 if(process.env.HARBOR_QA_INTERIORS==='1'){
  report.interiors=[];
  for(let i=0;i<6;i++){
   await page.evaluate(i=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,r.course.harborRooms[i].door,{vx:0,vy:0,z:0});},i);
   await page.keyboard.down('KeyQ');try{await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__.run.course.activeInterior,null,{timeout:30000});}finally{await page.keyboard.up('KeyQ');}
   await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.interiors.active===window.__DEAD_ARRIVAL__.run.course.activeInterior.id);
   const start=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.y);
   await page.keyboard.down('KeyW');try{await page.waitForFunction(y=>window.__DEAD_ARRIVAL__.run.y<y-.25,start,{timeout:30000});}finally{await page.keyboard.up('KeyW');}
   await page.screenshot({path:`${output}/room-${i}.png`});
   await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run,p=r.course.activeInterior.cache;Object.assign(r,{x:p.x-.4,y:p.y,vx:0,vy:0});});
   await page.keyboard.down('KeyQ');try{await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__.run.harborRooms?.[window.__DEAD_ARRIVAL__.run.course.activeInterior.id],null,{timeout:30000});}finally{await page.keyboard.up('KeyQ');}
   await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,r.course.activeInterior.exit,{vx:0,vy:0});});
   await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.run.roomInteractHeld);
   await page.keyboard.down('KeyQ');try{await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.run.course.activeInterior,null,{timeout:30000});}finally{await page.keyboard.up('KeyQ');}
   await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.run.roomInteractHeld);
   report.interiors.push({index:i,enterWalkSearchExit:true});
  }
  console.log('All six room enter/walk/search/exit journeys passed');
 }
 console.log('Harbor loaded; real movement pickup checks begin');
 await page.screenshot({path:`${output}/harbor-spawn.png`});
 if(process.env.HARBOR_QA_YARD==='1'){
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:5.5,y:24.7,z:0,vx:0,vy:0,vz:0,angle:-Math.PI/2,pitch:0});});
  await page.screenshot({path:`${output}/netmakers-gate.png`});
  const scrapBefore=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.backpack.scrap);
  await page.keyboard.down('KeyW');
  try{await page.waitForFunction(n=>window.__DEAD_ARRIVAL__.run.backpack.scrap>n,scrapBefore,{timeout:45000});}
  finally{await page.keyboard.up('KeyW');}
  report.yard=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;return{x:r.x,y:r.y,scrap:r.backpack.scrap};});
  assert.ok(report.yard.y<22.2);assert.equal(report.yard.scrap-scrapBefore,4);
  await page.screenshot({path:`${output}/netmakers-salvage.png`});
  await stash(4);
  console.log('Yard gate traversal, scrap and rifle pickup passed');
 }
 await stash(0);
 console.log('Melee stashed; opening inventory');
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.weapon),0,'pickup keeps held weapon');
 await page.keyboard.press('KeyB');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.packUI.isOpen);
 await page.locator('[data-pack-weapon="6"]').click();await page.getByRole('button',{name:'EQUIP',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.weapon),6);
 await page.screenshot({path:`${output}/melee-equipped.png`});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 await stash(1);assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.weapon),6);
 console.log('Melee equipped and second weapon retained; entering truck');
 assert.deepEqual(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.ownedWeapons),process.env.HARBOR_QA_YARD==='1'?[0,5,6,1]:[0,6,1]);
 await page.evaluate(async()=>{
  const {canStand}=await import('./engine.js');const r=window.__DEAD_ARRIVAL__.run,v=r.vehicle;
  const x=v.x-Math.sin(v.angle),y=v.y+Math.cos(v.angle);
  if(!canStand(r.course,x,y,.12))throw Error('Truck approach blocked');
  Object.assign(r,{x,y,z:0,vx:0,vy:0,vz:0,angle:v.angle,pitch:0});
 });
 await page.keyboard.down('KeyQ');try{await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.vehicle.occupied,null,{timeout:30000});}finally{await page.keyboard.up('KeyQ');}
 await page.keyboard.down('KeyW');
 try{await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.vehicle.distance>=1,null,{timeout:30000});}
 finally{await page.keyboard.up('KeyW');}
 await page.keyboard.down('Space');
 try{await page.waitForFunction(()=>Math.abs(window.__DEAD_ARRIVAL__.run.vehicle.speed)<.1,null,{timeout:20000});}
 finally{await page.keyboard.up('Space');}
 await page.screenshot({path:`${output}/truck-driving.png`});
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.weaponGroups.some(group=>group.visible)),false,'first-person weapons hidden while driving');
 report.vehicle=await page.evaluate(()=>({...window.__DEAD_ARRIVAL__.run.vehicle}));
 assert.ok(report.vehicle.distance>=1);
 await page.keyboard.down('KeyQ');try{await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.run.vehicle.occupied,null,{timeout:30000});}finally{await page.keyboard.up('KeyQ');}
 report.safeExit=await page.evaluate(async()=>{
  const {canStand}=await import('./engine.js');const{vehicleContains}=await import('./harbor-vehicle.js');const r=window.__DEAD_ARRIVAL__.run;
  return canStand(r.course,r.x,r.y,.12)&&!vehicleContains(r.vehicle,r.x,r.y,.1);
 });assert.equal(report.safeExit,true);
 console.log('Drive, brake and safe exit passed; capturing waterfront');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:16,y:28,z:0,vx:0,vy:0,vz:0,angle:Math.PI/2,pitch:-.05});});
 const waterBefore=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.water.material.uniforms.time.value);
 await page.waitForTimeout(500);
 const waterAfter=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.water.material.uniforms.time.value);
 assert.ok(waterAfter>waterBefore);report.waterAnimated=true;
 await page.screenshot({path:`${output}/waterfront.png`});
 report.canvas=await page.evaluate(()=>{
  const app=window.__DEAD_ARRIVAL__;app.renderer.render(app.run,performance.now());
  const source=app.renderer.canvas,canvas=document.createElement('canvas');canvas.width=64;canvas.height=36;
  const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0,64,36);const pixels=ctx.getImageData(0,0,64,36).data;
  const colors=new Set();let min=255,max=0;for(let i=0;i<pixels.length;i+=4){colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);const value=(pixels[i]+pixels[i+1]+pixels[i+2])/3;min=Math.min(min,value);max=Math.max(max,value);}
  return {width:source.width,height:source.height,colors:colors.size,range:max-min};
 });assert.ok(report.canvas.width>0&&report.canvas.colors>20&&report.canvas.range>20,'canvas is nonblank and varied');
 for(const[name,width,height]of[['desktop',1440,900],['mobile',390,844],['landscape',844,390]]){
  await page.setViewportSize({width,height});await page.keyboard.press('KeyB');
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.packUI.isOpen);
  const view=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
   panel:document.querySelector('.pack-panel').getBoundingClientRect().toJSON(),
   buttons:[...document.querySelectorAll('.pack-panel button')].map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,overflow:b.scrollWidth>b.clientWidth+1}))}));
  assert.ok(view.scrollWidth<=width);assert.ok(view.buttons.every(b=>b.height>=44&&!b.overflow));
  report.views.push(view);await page.screenshot({path:`${output}/${name}-inventory.png`});
  await page.getByRole('button',{name:'FIELD MAP',exact:true}).click();
  assert.equal(await page.locator('.harbor-field-map').isVisible(),true);
  assert.equal(await page.locator('.pack-map-notes li').count(),6);
  assert.equal(await page.evaluate(()=>{const p=document.querySelector('.pack-panel');return p.scrollWidth>p.clientWidth+1;}),false);
  await page.screenshot({path:`${output}/${name}-field-map.png`});
  await page.getByRole('button',{name:'EQUIPMENT',exact:true}).click();
  await page.locator('.pack-close').click();
 }
 report.renderer=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._collectDiagnostics(window.__DEAD_ARRIVAL__.run));
 report.audio=await page.evaluate(()=>window.__DEAD_ARRIVAL__.audio.debugInfo);
 if(process.env.HARBOR_QA_EXTRACTION==='1'){
  await stash(2);
  await page.evaluate(()=>{
   const r=window.__DEAD_ARRIVAL__.run;
   r.vehicle.distance=Math.max(r.vehicle.distance,8);
   Object.assign(r,{x:r.course.exit.x-.85,y:r.course.exit.y,z:0,vx:0,vy:0,vz:0,angle:0,pitch:0});
  });
  await page.keyboard.down('KeyW');
  try{await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.mode==='win',null,{timeout:25000});}
  finally{await page.keyboard.up('KeyW');}
  report.extraction={passed:true,fixture:'Third weapon collected via movement. Vehicle travel raised to8cells after real drive test; final extraction entered via movement.'};
  await page.screenshot({path:`${output}/extraction.png`});
  console.log('Extraction passed; restarting for clean inventory/vehicle state');
  await page.locator('.finish-screen [data-action="restart"]').click({force:true});
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.run.mode==='play');
  report.restart=await page.evaluate(()=>{
   const r=window.__DEAD_ARRIVAL__.run;
   return{harbor:r.course.harbor,owned:r.ownedWeapons,scrap:r.backpack.scrap,consumed:r.backpack.weaponPickups||[],occupied:r.vehicle.occupied,distance:r.vehicle.distance};
  });
  assert.deepEqual(report.restart,{harbor:true,owned:[0],scrap:0,consumed:[],occupied:false,distance:0});
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);assert.deepEqual(report.consoleErrors,[]);
 report.passed=true;console.log(JSON.stringify({passed:true,startupMs:report.startupMs,pickups:report.pickups,vehicleDistance:report.vehicle.distance,views:report.views.length}));
}catch(error){report.failure=String(error.stack||error);report.state=await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__?.screen,text:window.render_game_to_text?.()})).catch(()=>null);await page.screenshot({path:`${output}/failure.png`,timeout:30000}).catch(()=>{});throw error;}
finally{await writeFile(`${output}/browser-report.json`,JSON.stringify(report,null,2));await browser.close();}
