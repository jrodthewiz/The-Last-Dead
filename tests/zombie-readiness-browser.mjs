import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const baseline=process.env.ZOMBIE_BASELINE==='1';
const output=process.env.ZOMBIE_QA_OUTPUT||`output/playwright/zombie-readiness/${baseline?'before':'after'}`;
await mkdir(output,{recursive:true});
const server=await startServer({root:process.env.ZOMBIE_QA_ROOT||process.cwd(),port:0,spaFallback:false});
let browser;
const report={baseline,errors:[],requestFailures:[],variants:[],captures:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 if(process.env.ZOMBIE_QA_SOURCE_OVERRIDE)for(const name of ['enemy-ai.js','npc-afterlife-model.js']){
  const source=await readFile(`${process.env.ZOMBIE_QA_SOURCE_OVERRIDE}/${name}`,'utf8');
  await page.route(`**/${name}`,route=>route.fulfill({contentType:'text/javascript',body:source}));
 }
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 page.on('requestfailed',r=>report.requestFailures.push(`${r.failure()?.errorText} ${r.url()}`));
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=2`,{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,null,{timeout:180000});
 await page.locator('[data-action="start"]').click();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:180000});
 await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,engine=await import('./engine.js'),ai=await import('./enemy-ai.js'),THREE=await import('./vendor/three.module.js');
  d.run.mode='ready';
  window.__zombieQA={d,engine,ai,THREE,now:performance.now(),origin:{...d.run.course.playerSpawn}};
 });
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._warmupPromise);
 await page.evaluate(()=>{
  const q=window.__zombieQA;q.render=q.d.renderer.render.bind(q.d.renderer);q.d.renderer.render=()=>{};
  q.reset=(variant='stalker',distance=2.5)=>{
   const {x,y}=q.origin;
   if(q.engine.castRay(q.d.run.course,x,y,-Math.PI/2,4).dist<3)throw new Error('Fixture requires a clear approach');
   const profile={stalker:{speed:.72,windup:.28},skitter:{speed:1.04,windup:.2},bloodhound:{speed:.9,windup:.24}}[variant];
   const e={id:53001,x,y:y-distance,hp:100,maxHp:100,kind:0,variant,phase:0,moveSpeed:profile.speed,attack:0,attacking:false,strike:0,windup:0,windupTime:profile.windup,hits:0,flash:0,stagger:0,dead:false,biteCooldown:999};
   q.ai.createMind(e,{state:'stalk',firstAttack:0,facing:Math.PI/2});
   q.d.run.course.enemies=[e];q.e=e;
   Object.assign(q.d.run,{x,y,angle:-Math.PI/2,pitch:-.06,health:1000,weapon:0,events:[],projectiles:[],tracers:[],gore:[],blood:[],limbs:[],pools:[]});
   // Keep the actual map/collision/renderer while isolating the enemy from
   // the encounter director, which otherwise adds reinforcements to fixtures.
   q.d.run.course.dungeon=false;q.d.run.dungeonProgression=null;q.d.run.waveCount=q.d.run.wave;q.d.run.waveDelay=999;
   q.d.renderer._firstCameraFrame=true;q.now+=1000;q.render(q.d.run,q.now);
  };
  q.step=()=>{
   q.d.run.mode='play';q.engine.tick(q.d.run,1/60);q.d.run.mode='ready';q.now+=1000/60;
   // Exercise the game's real pose pass at 60Hz; render the unchanged world
   // periodically so a deterministic simulation does not queue 2,160 GPU frames.
   if((q.frames=(q.frames||0)+1)%6===0)q.render(q.d.run,q.now);
   else q.d.renderer._updateEnemies(q.d.run,q.now);
  };
  q.sample=()=>{
   const s=q.d.renderer._enemyVisuals.get(q.e.id).root.userData.afterlife;
   return {state:q.e.state,moving:q.e.moving||0,distance:Math.hypot(q.e.x-q.d.run.x,q.e.y-q.d.run.y),strike:q.e.strike||0,attacking:q.e.attacking,health:q.d.run.health,attackTime:s.attackAction.time,attackWeight:s.attackAction.getEffectiveWeight(),hitWeight:s.hitAction.getEffectiveWeight(),gait:s.gaitPhase,gaitDirection:s.gaitDirection,locomotion:s.shuffleAction.getEffectiveWeight()+s.chaseAction.getEffectiveWeight(),weight:Object.values(s.actions).reduce((n,a)=>n+a.getEffectiveWeight(),0)};
  };
  q.reset();
 });
 for(const variant of ['stalker','skitter','bloodhound']){
  await page.evaluate(v=>window.__zombieQA.reset(v),variant);
  const samples=await page.evaluate(()=>{
   const q=window.__zombieQA,out=[];for(let i=0;i<720;i++){q.step();out.push(q.sample());}return out;
  });
  const contacts=samples.filter((s,i)=>i>0&&s.health<samples[i-1].health);
  const slidingContact=samples.filter(s=>s.strike>0&&s.moving>.05);
  const lockedRecovery=samples.filter(s=>s.strike===0&&!s.attacking&&s.moving>.25&&s.attackWeight>.9);
  const summary={variant,attacks:contacts.length,slidingContactFrames:slidingContact.length,lockedRecoveryFrames:lockedRecovery.length,states:[...new Set(samples.map(s=>s.state))],minDistance:Math.min(...samples.map(s=>s.distance)),contacts};
  report.variants.push(summary);
  console.log(JSON.stringify({variant,attacks:summary.attacks,slidingContactFrames:slidingContact.length,lockedRecoveryFrames:lockedRecovery.length}));
  await writeFile(`${output}/${variant}-samples.json`,JSON.stringify(samples));
  if(!baseline){
   assert(contacts.length>=3,`${variant} keeps pursuing and attacking`);
   assert.equal(slidingContact.length,0,`${variant} plants feet through swipe contact`);
   assert(lockedRecovery.length<=contacts.length*3,`${variant} releases the full-body swipe promptly as footwork resumes`);
   assert(samples.every(s=>Number.isFinite(s.gait)&&Math.abs(s.weight-1)<1e-5),'finite, normalized animation throughout');
   assert(contacts.every(s=>Math.abs(s.attackTime-.375)<.002),'authored swipe contacts coincide with actual damage');
  }
 }
 await page.evaluate(()=>window.__zombieQA.reset('stalker',.65));
 for(const state of ['dormant','wander','investigate','stalk','recover','stagger','attack','dead']){
  await page.evaluate(state=>{
   const q=window.__zombieQA;q.reset('stalker',state==='attack'?.28:.65);
   q.e.state=state;q.e.mind.state=state==='dead'?'stalk':state;
   for(let i=0;i<36;i++){
    if(state==='attack')q.step();
    else {q.now+=1000/60;if(state==='stagger'){q.e.stagger=.4;q.e.hits=1;}if(state==='dead')q.e.dead=true;q.render(q.d.run,q.now);}
    if(state==='attack'&&q.e.strike>0)break;
   }
   q.render(q.d.run,q.now);
  },state);
  await page.screenshot({path:`${output}/${state}.png`});report.captures.push(state);
 }
 report.diagnostics=await page.evaluate(()=>{
  const q=window.__zombieQA;q.render(q.d.run,q.now);const r=q.d.renderer.renderer,gl=r.getContext(),pixels=new Uint8Array(64*64*4);
  gl.readPixels(gl.drawingBufferWidth/2-32,gl.drawingBufferHeight/2-32,64,64,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const canvas=document.querySelector('canvas');return {calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures,canvas:[canvas.clientWidth,canvas.clientHeight,canvas.width,canvas.height],colorLevels:new Set(pixels.filter((_,i)=>i%4!==3)).size,asset:q.d.renderer.diagnostics().ashWitness};
 });
 assert(report.diagnostics.colorLevels>5,'nonblank rendered game');assert.equal(report.diagnostics.asset.error,null);assert.equal(report.diagnostics.asset.clips.length,10);
 assert.deepEqual(report.errors,[]);report.result='PASS';console.log(JSON.stringify({result:report.result,variants:report.variants,output}));
}catch(error){report.result='FAIL';report.failure=error.stack;throw error;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
