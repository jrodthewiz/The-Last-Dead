import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {measureCounterArms,assertCounterSleeves} from './interaction-arm-qa.mjs';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.BRUTAL_OUTPUT||'output/playwright/brutal-combat';await mkdir(output,{recursive:true});
const server=await startServer({root:process.env.DEAD_ARRIVAL_RUNTIME||process.cwd()+'/dist',port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
const report={runtimeRoot:process.env.DEAD_ARRIVAL_RUNTIME||process.cwd()+'/dist',errors:[],views:[],inputs:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
async function fixture(kind,options={}){
  await page.evaluate(async ({kind,options})=>{
    const d=window.__DEAD_ARRIVAL__,r=d.run,{castRay}=await import('./engine.js');
    // Each forced fixture starts a new presentation run. Prior-action rigid
    // debris otherwise remains mid-flight while these snapshots skip time.
    // Exercise the existing run-boundary cleanup; live gameplay keeps debris.
    d.renderer.brutalCombatVisuals.run=null;
    if(!window.__counterAnchor){const angles=Array.from({length:24},(_,i)=>i*Math.PI/12);const angle=angles.sort((a,b)=>castRay(r.course,r.x,r.y,b,8).dist-castRay(r.course,r.x,r.y,a,8).dist)[0];window.__counterAnchor={x:r.x,y:r.y,angle};}
    const a=window.__counterAnchor;r.x=a.x;r.y=a.y;r.z=0;r.vx=r.vy=r.vz=0;r.angle=a.angle;r.pitch=0;r.health=100;r.energy=100;r.weapon=0;r.parryCooldown=0;r.parryTime=0;r.waveDelay=1000;r.director=null;r.projectiles=[];
    r.brutal={phase:'idle',sequence:r.brutal.sequence};r.bite={phase:'idle',enemyId:null,sequence:0,cooldown:100};
    const e={id:r.nextId++,kind:0,variant:'stalker',x:r.x+Math.cos(a.angle)*.22,y:r.y+Math.sin(a.angle)*.22,hp:kind==='twist'?8:30,maxHp:30,dead:false,flash:0,attack:100,phase:0,biteCooldown:100,stagger:kind==='twist'?1.2:0,facing:a.angle+Math.PI};
    r.course.enemies=[e];r.mode='play';
    if(kind==='rip'){r.bite={phase:'held',enemyId:e.id,elapsed:.2,escape:0,damageStage:0,sequence:++r.nextId,cooldown:0,side:'left',limb:'leftArm'};e.biteTargetId='host';e.bitePhase='held';e.biteProgress=1;}
    d.renderer.brutalCombatVisuals.tracePose=true;
    d.renderer.setSettings({gore:options.gore!==false,reducedMotion:!!options.reducedMotion,bodycam:true});d.renderer.render(r,performance.now());
  },{kind,options});
}
async function shot(name){
  // Freeze one actual render for both the image and its coordinates. Letting
  // an independently advancing recoil mixer run during screenshot transport
  // makes the two receipts describe different poses.
  await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;window.__counterRender=d.renderer.render;d.renderer.render=()=>{};window.__counterRender.call(d.renderer,d.run,performance.now());});
  await page.waitForTimeout(80);await page.screenshot({path:`${output}/${name}.png`});
  report.views.push(await page.evaluate(async name=>{
    const d=window.__DEAD_ARRIVAL__,r=d.renderer,v=r.brutalCombatVisuals,info=r.renderer.info.render,THREE=await import('./vendor/three.module.js');
    const root=r._enemyVisuals.get(d.run.course.enemies[0]?.id)?.root,cam=r.camera.getWorldPosition(new THREE.Vector3());
    const projection=node=>{if(!node)return null;const p=node.getWorldPosition(new THREE.Vector3()),n=p.clone().project(r.camera);return{world:p.toArray(),screen:n.toArray()};};
    const facing=node=>{if(!node)return null;const f=new THREE.Vector3(0,0,1).applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion())),toward=cam.clone().sub(node.getWorldPosition(new THREE.Vector3()));f.y=toward.y=0;return f.normalize().dot(toward.normalize());};
    const state=v.actors.get(root),fragment=v.fragments.find(f=>f.enemyId===d.run.brutal.enemyId),bundle=state?.attachments.getObjectByName('AttachedIntestines');
    const box=fragment?new THREE.Box3().setFromObject(fragment.piece,true):null;
    return{name,brutal:{...d.run.brutal},bite:{...d.run.bite},enemy:{hp:d.run.course.enemies[0]?.hp,wound:d.run.course.enemies[0]?.brutalWound,dead:d.run.course.enemies[0]?.dead},visuals:v.diagnostics(),framing:{camera:cam.toArray(),rootYaw:root?.rotation.y,pivot:root?.userData.afterlife?.pivot.rotation.toArray(),faceDot:facing(root?.getObjectByName('Jaw')),abdomenDot:facing(root?.getObjectByName('Socket_Abdomen')),head:projection(root?.getObjectByName('Head')),abdomen:projection(root?.getObjectByName('Socket_Abdomen')),attachment:projection(state?.attachments),bundle:projection(bundle),fragmentCenter:box?.getCenter(new THREE.Vector3()).toArray(),fragmentSize:box?.getSize(new THREE.Vector3()).toArray()},calls:info.calls,triangles:info.triangles,prompt:document.querySelector('[data-bite-prompt]')?.innerText,promptVisible:document.querySelector('[data-bite-prompt]')?.checkVisibility(),health:d.run.health};
  },name));
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  const view=report.views.at(-1);view.sleeves=await page.evaluate(measureCounterArms);
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  assertCounterSleeves(view.sleeves,assert,name);
  if(name.endsWith('-contact')&&view.sleeves.active){
    assert.equal(view.visuals.contactDistances.length,2,'both actual wrist targets measured');
    assert(view.visuals.contactDistances.every(p=>p.distance<.02),name+' actual wrists stay within 20mm of their contact targets');
  }
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.render=window.__counterRender;});
}
async function stepTo(elapsed){await page.evaluate(async elapsed=>{const d=window.__DEAD_ARRIVAL__,r=d.run,{tick}=await import('./engine.js');r.mode='play';for(let i=0;i<300&&r.brutal.phase!=='idle'&&r.brutal.elapsed<elapsed;i++)tick(r,1/120,{});r.mode='ready';},elapsed);}
try{
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._ashWitnessAsset&&window.__DEAD_ARRIVAL__?.renderer._survivors?.status==='ready');
  assert.deepEqual(report.errors,[],'runtime boot loads styles and assets without browser resource errors');
  await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.renderer.brutalCombatVisuals.status==='ready');
  for(const kind of process.env.BRUTAL_KIND?[process.env.BRUTAL_KIND]:['chop','twist','rip']){
    await fixture(kind);
    await page.keyboard.press('f');
    if(kind==='rip'){
      const escape=await page.evaluate(()=>({health:window.__DEAD_ARRIVAL__.run.health,escape:window.__DEAD_ARRIVAL__.run.bite.escape}));assert(escape.escape>=.65);assert.equal(escape.health,100);
      await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';});await shot('rip-first-parry');
      await page.evaluate(async()=>{const r=window.__DEAD_ARRIVAL__.run,{tick}=await import('./engine.js');r.mode='play';for(let i=0;i<55;i++)tick(r,1/120,{});});
      await page.keyboard.press('f');
    }
    const input=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.mode='ready';return{...r.brutal,health:r.health};});report.inputs.push({kind,...input});assert.equal(input.kind,kind);assert.notEqual(input.phase,'idle');
    await shot(`${kind}-windup`);await stepTo(input.contactAt+.015);await shot(`${kind}-contact`);
    const contact=report.views.at(-1);assert.equal(contact.enemy.wound.type,kind);assert.equal(contact.visuals.hands,2);assert.equal(contact.visuals.status,'ready');assert(contact.visuals.spray>0);
    assert(contact.framing.abdomenDot>.9,'the counter must keep the actual torso facing its victim');
    await stepTo(input.contactAt+.28);await shot(`${kind}-follow-through`);
    await stepTo(input.duration);await shot(`${kind}-aftermath`);assert.equal(report.views.at(-1).brutal.phase,'idle');
  }
  await fixture('twist',{gore:false,reducedMotion:true});await page.keyboard.press('f');await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';});await stepTo(.26);await shot('gore-off-contact');
  assert.equal(report.views.at(-1).enemy.dead,true);assert.equal(report.views.at(-1).visuals.spray,0);
  await fixture('rip',{reducedMotion:true});
  await page.keyboard.press('f');await page.evaluate(async()=>{const r=window.__DEAD_ARRIVAL__.run,{tick}=await import('./engine.js');for(let i=0;i<55;i++)tick(r,1/120,{});});await page.keyboard.press('f');await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';});await stepTo(.25);await shot('reduced-motion-rip-contact');
  assert(report.views.at(-1).framing.abdomenDot>.9,'reduced-motion contact cannot expose the back of the actor');
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.begin());await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await shot('restart-clean');
  const clean=report.views.at(-1).visuals;assert.equal(clean.fragments,0);assert.equal(clean.woundedActors,0);assert.equal(clean.spray,0);
  await page.keyboard.press('Escape');await page.locator('[data-action="resume"]').click();await page.waitForTimeout(150);await shot('pause-resume');
  assert.deepEqual(report.errors,[]);report.status='PASS';await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,views:report.views.length,inputs:report.inputs,errors:report.errors},null,2));
}catch(error){report.failure=error.stack;await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));throw error;}
finally{await browser.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
