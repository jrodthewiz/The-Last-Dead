import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const base=process.env.DEAD_ARRIVAL_BASE||'http://127.0.0.1:5200';
const output=new URL('../docs/survivor/meshy-in-game/',import.meta.url);
await mkdir(output,{recursive:true});
const file=name=>new URL(name,output).pathname.replace(/^\/([A-Z]:)/i,'$1');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});const errors=[],httpErrors=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR '+e.stack);});page.on('response',r=>{if(r.status()>=400)httpErrors.push(`${r.status()} ${r.url()}`);});
 await page.goto(base+'/?debug=1',{waitUntil:'domcontentloaded'});
 console.log('PAGE_LOADED');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared).catch(async error=>{console.log(await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__?.renderer;return {ready:r?._weaponsPrepared,status:r?._survivors?.status,error:r?._survivors?.error,warden:r?._wardenStatus,begin:r?._beginPending};}));throw error;});
 const loaded=await page.evaluate(()=>{const s=window.__DEAD_ARRIVAL__.renderer._survivors;return {status:s.status,error:s.error,viewSleeves:s.viewSleeves,local:s.local.userData.source,headHidden:!s.local.userData.head.visible,armsHidden:!s.local.userData.arms.visible};});
 assert.equal(loaded.status,'ready');assert.equal(loaded.local,'meshy-v02');assert.equal(loaded.viewSleeves,7);assert.ok(loaded.headHidden&&loaded.armsHidden);
 console.log('ASSET_READY '+JSON.stringify(loaded));
 await page.locator('[data-action="start"]').click({force:true,noWaitAfter:true});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');console.log('PLAY_STARTED');
 await page.locator('#world').click();await page.waitForFunction(()=>document.pointerLockElement);
 const start=await page.evaluate(()=>({x:window.__DEAD_ARRIVAL__.run.x,y:window.__DEAD_ARRIVAL__.run.y}));
 await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');
 const moved=await page.evaluate(()=>({x:window.__DEAD_ARRIVAL__.run.x,y:window.__DEAD_ARRIVAL__.run.y}));
 assert.ok(Math.hypot(start.x-moved.x,start.y-moved.y)>.05,'W moves the player');
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.z>.05);
 const jump=await page.evaluate(()=>({z:window.__DEAD_ARRIVAL__.run.z,animation:window.__DEAD_ARRIVAL__.renderer._survivors.local.userData.animation}));
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.z<.02);
 await page.keyboard.down('w');await page.keyboard.down('ControlLeft');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.slide>.4);
 const slide=await page.evaluate(()=>({slide:window.__DEAD_ARRIVAL__.run.slide,animation:window.__DEAD_ARRIVAL__.renderer._survivors.local.userData.animation}));
 await page.keyboard.up('ControlLeft');await page.keyboard.up('w');
 const weapons=[];
 for(let weapon=0;weapon<4;weapon++) {
  await page.keyboard.press(String(weapon+1));await page.waitForFunction(i=>window.__DEAD_ARRIVAL__.run.weapon===i,weapon);
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:6,y:10.4,z:0,vx:0,vy:0,slide:0,angle:-Math.PI/2,pitch:0,waveDelay:999,health:100,energy:100});r.cooldowns.fill(0);r.course.enemies=[];});
  await page.mouse.down();await page.waitForFunction(()=>{const r=window.__DEAD_ARRIVAL__.run;if(r.shot>.3){r.mode='pause';return true;}return false;});
  const fired=await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.run,g=d.renderer.weaponGroups[r.weapon];return {index:r.weapon,name:g.name,shot:r.shot,tracers:r.tracers.length,projectiles:r.projectiles.length,visible:d.renderer.weaponGroups.map(o=>o.visible),sleeves:[],grips:[]};});
  await page.mouse.up();assert.ok(fired.shot>.3,'Weapon fires from real pointer input');console.log('FIRED '+fired.name);
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='pause';});
  await page.screenshot({path:file(`weapon-${weapon}.png`)});
  const fits=await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,g=d.renderer.weaponGroups[d.run.weapon],found=[];g.traverse(o=>{if(o.userData.gripSocket){const p=o.userData.gripSocket;found.push({source:o.userData.viewmodelSource,sleeve:!!o.getObjectByName(o.userData.side<0?'MeshySleeve_Left':'MeshySleeve_Right'),world:p.getWorldPosition(p.position.clone()).toArray()});}});return found;});
  assert.ok(fits.every(f=>f.sleeve&&f.world.every(Number.isFinite)));fired.grips=fits;weapons.push(fired);
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.pitch=-1.3;});await page.waitForTimeout(80);
  await page.screenshot({path:file(`look-down-${weapon}.png`)});
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';});
 }
 // The game aims with look input; right mouse is alternate fire, not ADS.
 const oldPitch=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.pitch);
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(250);await page.keyboard.up('ArrowUp');
 const aim=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.pitch);assert.ok(aim>oldPitch,'look input aims upward');
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.mode='pause';r.pitch=-1.3;r.slide=1;r.z=0;});await page.waitForTimeout(150);
 await page.screenshot({path:file('slide.png')});
 const stability=await page.evaluate(async()=>{
  const {renderer,run}=window.__DEAD_ARRIVAL__,s=renderer._survivors.local;
  const {animateMeshySurvivor}=await import('/assets/survivor/meshy-survivor.js');
  animateMeshySurvivor(s,run,0);const before=s.userData.bones.LeftUpLeg.quaternion.toArray();
  for(let i=0;i<120;i++)animateMeshySurvivor(s,run,0);
  return {before,after:s.userData.bones.LeftUpLeg.quaternion.toArray(),position:s.position.toArray(),samples:s.userData.soleSamples.length};
 });assert.deepEqual(stability.before,stability.after);assert.ok(stability.samples>0);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.slide=0;});await page.waitForTimeout(120);await page.screenshot({path:file('mobile.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
 const result={loaded,movement:{start,moved},jump,slide,aim,weapons,stability,errors,httpErrors};
 await writeFile(new URL('results.json',output),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {await browser.close();}
