import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output='docs/chase-impact/final',frames='.codex-temp/chase-impact/frames';
await mkdir(output,{recursive:true});await mkdir(frames,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1280,height:720}}),report={errors:[],httpErrors:[],motion:[],contacts:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
const capture=name=>page.screenshot({path:`${output}/${name}.png`});
try{
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=2`,{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,null,{timeout:90000});
 await page.locator('[data-action="start"]').click();
 await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,engine=await import('./engine.js'),THREE=await import('./vendor/three.module.js'),{makeDungeonCourse}=await import('./playground/map/dungeon-course.js');
  Object.assign(d.run,engine.newRun(makeDungeonCourse(2)),{mode:'play',x:19.5,y:24.2,angle:-Math.PI/2,pitch:-.07});
  for(let i=0;i<315;i++)engine.tick(d.run,1/60);
  d.run.mode='ready';d.renderer._firstCameraFrame=true;
  window.__chaseQA={d,engine,THREE,now:performance.now(),sample:{...d.run.course.enemies.find(e=>e.kind===0)}};
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._warmupPromise);
 await page.evaluate(()=>{
  const q=window.__chaseQA;q.render=q.d.renderer.render.bind(q.d.renderer);q.d.renderer.render=()=>{};
  q.step=(count=1,simulate=true)=>{for(let i=0;i<count;i++){q.now+=1000/60;if(simulate){q.d.run.mode='play';q.engine.tick(q.d.run,1/60);q.d.run.mode='ready';}q.render(q.d.run,q.now);}};
  q.reset=(variant='stalker',distance=2.5)=>{
   q.d.run.course.enemies=[{...q.sample,id:53001,x:19.5,y:24.2-distance,hp:100,maxHp:100,kind:0,variant,attack:0,attacking:false,strike:0,windup:0,hits:0,flash:0,stagger:0,dead:false}];
   Object.assign(q.d.run,{x:19.5,y:24.2,angle:-Math.PI/2,pitch:-.07,weapon:0,health:1000,shot:0,tracers:[],gore:[],blood:[],limbs:[],events:[]});
   q.d.run.waveCount=q.d.run.wave;q.d.renderer._firstCameraFrame=true;q.d.renderer.weaponFX.impacts.clear();q.step(1,false);
  };
  q.sampleState=()=>{
   const e=q.d.run.course.enemies[0],root=q.d.renderer._enemyVisuals.get(e.id)?.root,s=root.userData.afterlife;
   root.updateMatrixWorld(true);
   const bone=name=>s.model.getObjectByName(name)?.getWorldPosition(new q.THREE.Vector3()).toArray();
   return{x:e.x,y:e.y,health:q.d.run.health,windup:e.windup,strike:e.strike,phase:s.attackPhase,
    chaseWeight:s.chaseAction?.getEffectiveWeight(),attackTime:s.attackAction.time,attackWeight:s.attackAction.getEffectiveWeight(),
    leftHand:bone('LeftHand'),rightHand:bone('RightHand'),leftFoot:bone('LeftFoot'),rightFoot:bone('RightFoot')};
  };q.reset();
 });
 console.log('Production scene loaded; recording real chase and swipe.');
 await page.setViewportSize({width:960,height:540});
 for(let frame=0;frame<140;frame++){
  const state=await page.evaluate(()=>{const q=window.__chaseQA;q.step(3);return q.sampleState();});
  report.motion.push(state);
  await page.screenshot({path:`${frames}/${String(frame).padStart(4,'0')}.png`});
  if(frame%35===0)console.log(`Motion capture ${frame}/140`);
 }
 assert.ok(report.motion.some(s=>s.chaseWeight>.9),'chase clip owns fast movement');
 assert.ok(report.motion.some(s=>s.phase==='contact'&&s.attackWeight>.95),'swipe contact is visible');
 assert.ok(report.motion.at(-1).health<1000,'the chase reaches real attack damage');
 await page.setViewportSize({width:1280,height:720});
 for(const variant of ['stalker','skitter','bloodhound']){
  await page.evaluate(v=>window.__chaseQA.reset(v,.28),variant);
  let previousHealth=1000;
  for(let frame=0;frame<90;frame++){
   const state=await page.evaluate(()=>{const q=window.__chaseQA;q.step();return q.sampleState();});
   if(state.health<previousHealth){report.contacts.push({variant,...state});await capture(`${variant}-contact`);break;}
  }
 }
 assert.equal(report.contacts.length,3);
 assert.ok(report.contacts.every(s=>Math.abs(s.attackTime-.375)<.002),'actual GLB contact coincides with damage for both tempos');
 await page.evaluate(()=>{const q=window.__chaseQA;q.reset('stalker',.9);const e=q.d.run.course.enemies[0];e.attack=20;q.d.run.pitch=-.11;q.d.renderer._firstCameraFrame=true;q.step(10);q.d.run.mode='play';q.d.run.cooldowns.fill(0);q.engine.shoot(q.d.run);q.d.run.mode='ready';q.step(3);});
 await capture('bullet-hit');
 report.hit=await page.evaluate(()=>({effects:window.__chaseQA.d.renderer.weaponFX.impacts.detailActive,hits:window.__chaseQA.d.run.course.enemies[0].hits}));
 await page.evaluate(()=>window.__chaseQA.step(85));await capture('settled-blood');
 report.settled=await page.evaluate(()=>window.__chaseQA.d.renderer.weaponFX.impacts.detailActive);
 assert.ok(report.hit.hits>0&&report.hit.effects.drops>0);assert.ok(report.settled.deposits>0,'droplets reach the floor');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const q=window.__chaseQA;q.reset('stalker',1.1);q.step(20);});await capture('mobile-chase');
 await page.setViewportSize({width:1280,height:720});
 const seconds=Number(process.env.CHASE_PLAY_SECONDS??120);
 await page.evaluate(()=>{const q=window.__chaseQA;q.reset('stalker',1.5);q.d.renderer.render=q.render;q.d.run.mode='play';});
 const until=Date.now()+seconds*1000;let inputs=0;
 while(Date.now()<until){
  await page.keyboard.down(inputs%2?'s':'a');await page.waitForTimeout(250);await page.keyboard.up(inputs%2?'s':'a');
  await page.mouse.down();await page.waitForTimeout(180);await page.mouse.up();
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(Math.min(14000,Math.max(0,until-Date.now())));inputs++;
  if(await page.locator('[data-action="restart"]').isVisible())await page.locator('[data-action="restart"]').click();
  console.log(`Live play ${inputs} input cycles.`);
 }
 await capture('active-play');
 report.live={seconds,inputs};
 report.diagnostics=await page.evaluate(()=>window.__chaseQA.d.renderer._collectDiagnostics(window.__chaseQA.d.run));
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.pause());
 await page.locator('[data-action="menu"]').click();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.renderer.menuCinematic?.actors.length===3);
 await capture('menu-regression');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
 report.result='PASS';console.log(JSON.stringify({result:report.result,contacts:report.contacts.map(s=>({variant:s.variant,attackTime:s.attackTime})),hit:report.hit,settled:report.settled,live:report.live,errors:report.errors}));
}catch(error){report.result='FAIL';report.failure=error.stack;await capture('failure').catch(()=>{});throw error;}
finally{await writeFile(`${output}/qa-results.json`,JSON.stringify(report,null,2));await browser.close();server.server.closeIdleConnections?.();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
