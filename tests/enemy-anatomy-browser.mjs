import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.ANATOMY_QA_OUTPUT||'output/playwright/enemy-anatomy';await mkdir(output,{recursive:true});
const server=await startServer({root:process.env.ANATOMY_QA_ROOT||process.cwd(),port:0,spaFallback:false});let browser,page;
const report={errors:[],views:[],timings:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--disk-cache-size=1048576','--media-cache-size=1048576']});page=await browser.newPage({viewport:{width:1280,height:720}});console.log('anatomy QA browser ready',server.port);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID_|INVALID_(OPERATION|VALUE)|Shader Error/.test(m.text()))report.errors.push(m.text()+' '+(m.location().url||''));});page.on('requestfailed',r=>(report.failedRequests ||= []).push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=2`,{waitUntil:'domcontentloaded',timeout:120000});console.log('anatomy QA document loaded');
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:180000});await page.evaluate(()=>window.__DEAD_ARRIVAL__.begin());await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.renderer._weaponsPrepared,null,{timeout:180000});await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._warmupPromise);
 // Loading consumes Start's transient user activation. Capture the mouse as a
 // player does before firing; a first unlocked click only requests that lock.
 await page.locator('canvas').first().click({force:true,timeout:180000});await page.waitForFunction(()=>!!document.pointerLockElement,null,{timeout:10000});
 await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,engine=await import('./engine.js'),anatomy=await import('./enemy-anatomy.js'),THREE=await import('./vendor/three.module.js');d.run.mode='ready';
  const q=window.__anatomyQA={d,engine,anatomy,THREE,now:performance.now(),render:d.renderer.render.bind(d.renderer),origin:{...d.run.course.playerSpawn},id:64001};d.renderer.render=()=>{};
  q.reset=(extra={})=>{
   const {x,y}=q.origin;Object.assign(d.run,{x,y,z:0,slide:0,angle:-Math.PI/2,pitch:-.08,health:1000,weapon:5,events:[],tracers:[],gore:[],blood:[],limbs:[],projectiles:[],waveDelay:999});
   d.run.course.dungeon=false;d.run.dungeonProgression=null;d.run.waveCount=d.run.wave;
   q.e={id:q.id++,x,y:y-.55,hp:100,maxHp:100,kind:0,variant:'bloodhound',phase:0,moveSpeed:.6,baseMoveSpeed:.6,attack:99,facing:Math.PI/2,dead:false,hits:0,flash:0,wounds:{arm:false,leg:false},...extra};d.run.course.enemies=[q.e];d.renderer._firstCameraFrame=true;q.now+=1000;q.render(d.run,q.now);q.maxFrameMs=0;
   q.root=d.renderer._enemyVisuals.get(q.e.id).root;return q.e.id;
  };
  q.renderOne=()=>{q.now+=1000/60;d.run.time+=1/60;const t=performance.now();q.render(d.run,q.now);const frame=performance.now()-t;if(frame>q.maxFrameMs)q.peakStage={pending:d.renderer.brutalCombatVisuals.anatomy.jobs.size,compiled:d.renderer.brutalCombatVisuals.anatomy.compiled};q.maxFrameMs=Math.max(q.maxFrameMs,frame);return frame;};
  q.cut=(part,z,fraction,source='slice',tilt)=>{
   const t=performance.now(),c=q.anatomy.applyAnatomyDamage(q.e,9,{x:q.e.x,y:q.e.y,z,part,fraction,angle:d.run.angle,pitch:tilt??d.run.pitch},d.run.time,source),logic=performance.now()-t;
   if(q.e.hp<=0){q.e.dead=true;q.e.deathTime=0;}const frame=q.renderOne();return{cut:c,logic,frame};
  };
  q.reset();d.run.mode='play';q.render(d.run,q.now);d.run.mode='ready';
 });
 await page.evaluate(()=>window.__anatomyQA.d.renderer.brutalCombatVisuals.anatomy.warmupPromise);
 const waitCut=async()=>{
  await page.waitForFunction(()=>{const q=window.__anatomyQA;return !q.d.renderer.brutalCombatVisuals.anatomy.jobs.size;},null,{timeout:30000});
  await page.evaluate(()=>{const q=window.__anatomyQA;for(let i=0;i<36;i++)q.renderOne();});
 };
 const capture=async name=>{
  await page.evaluate(()=>window.__anatomyQA.renderOne());await page.screenshot({path:`${output}/${name}.png`});console.log('anatomy QA view',name);
  const data=await page.evaluate(()=>{const q=window.__anatomyQA,b=q.d.renderer.brutalCombatVisuals,geometry=[];q.root.traverse(m=>{if(m.isSkinnedMesh)geometry.push({index:m.geometry.index.count,vertices:m.geometry.attributes.position.count,attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([key,a])=>[key,a.count]))});});return{hp:q.e.hp,dead:q.e.dead,brain:q.e.brainIntegrity,locomotion:q.e.locomotion,damage:q.e.anatomy,wounds:q.e.wounds,pitch:q.d.run.pitch,cut:q.root.userData.anatomy,geometry,maxFrameMs:q.maxFrameMs,peakStage:q.peakStage,fragments:b.fragments.length,physics:b.physics.diagnostics(),anatomy:b.anatomy.diagnostics(),calls:q.d.renderer.renderer.info.render.calls};});for(const m of data.geometry)for(const count of Object.values(m.attributes))assert.equal(count,m.vertices);report.views.push({name,...data});return data;
 };
 // Actual mouse input and authoritative marksman hit, aimed using rig bones.
 report.aim=await page.evaluate(()=>{const q=window.__anatomyQA,r=q.d.run,foot=q.root.getObjectByName('LeftLeg').getWorldPosition(new q.THREE.Vector3()).multiplyScalar(.25);r.x=foot.x;r.pitch=Math.atan2(foot.y-q.engine.eye(r),Math.abs(foot.z-r.y));q.e.moveSpeed=.001;q.e.attack=999;q.renderOne();const c=Math.cos(r.pitch),trace=q.anatomy.traceEnemyBody(q.e,{x:r.x,y:r.y,z:q.engine.eye(r)},{x:Math.cos(r.angle)*c,y:Math.sin(r.angle)*c,z:Math.sin(r.pitch)},2);r.mode='play';return{foot:foot.toArray(),player:{x:r.x,y:r.y,z:q.engine.eye(r),pitch:r.pitch,angle:r.angle},trace};});
 await page.mouse.down();await page.waitForFunction(()=>window.__anatomyQA.e.hits>0,null,{timeout:10000});await page.mouse.up();await page.evaluate(()=>{const q=window.__anatomyQA;q.d.run.mode='ready';q.renderOne();});await waitCut();
 let view=await capture('marksman-leg');assert.equal(view.locomotion,'crawl');assert(view.cut?.lastPart.endsWith('Leg'));
 await page.evaluate(()=>{const q=window.__anatomyQA;for(let i=0;i<45;i++)q.renderOne();});await capture('leg-loss-crawl');
 report.handAim=await page.evaluate(()=>{const q=window.__anatomyQA;q.reset();const arm=q.root.getObjectByName('RightForeArm').getWorldPosition(new q.THREE.Vector3()).multiplyScalar(.25),r=q.d.run;r.x=arm.x+Math.sign(arm.x-q.e.x)*.012;r.pitch=Math.atan2(arm.y-q.engine.eye(r),Math.abs(arm.z-r.y));q.e.moveSpeed=.001;q.renderOne();r.mode='play';const c=Math.cos(r.pitch);return q.anatomy.traceEnemyBody(q.e,{x:r.x,y:r.y,z:q.engine.eye(r)},{x:Math.cos(r.angle)*c,y:Math.sin(r.angle)*c,z:Math.sin(r.pitch)},.65);});assert.equal(report.handAim?.part,'rightArm');
 await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.__anatomyQA.e.anatomy?.cuts?.some(c=>c.part==='rightArm'),null,{timeout:10000});await page.evaluate(()=>{window.__anatomyQA.d.run.mode='ready';window.__anatomyQA.renderOne();});await waitCut();view=await capture('hand-slice-arm');assert.equal(view.cut.lastPart,'rightArm');
 for(const [name,part,fraction,tilt]of [['arm-diagonal','rightArm',.58,-.55],['half-head','head',.72,.45],['torso-oblique','torso',.18,-.5]]){
  await page.evaluate(()=>window.__anatomyQA.reset());const timing=await page.evaluate(({part,fraction,tilt})=>window.__anatomyQA.cut(part,part==='head'?.44:part==='torso'?.3:.28,fraction,'slice',tilt),{part,fraction,tilt});report.timings.push({name,...timing});await waitCut();view=await capture(name);assert(view.cut?.capLoops>0);if(part==='head')assert(view.brain>0&&view.hp>0);
 }
 // Two cuts on one actor retain the first missing part and the source skin.
 await page.evaluate(()=>window.__anatomyQA.reset());await page.evaluate(()=>window.__anatomyQA.cut('leftLeg',.13,.52));await waitCut();await page.evaluate(()=>window.__anatomyQA.cut('rightArm',.28,.55));await waitCut();view=await capture('two-cuts');assert.equal(view.cut.cuts.length,2);
 // Ragdoll -> articulated rise uses the last solved pose, not a fresh standing clone.
 await page.evaluate(()=>{const q=window.__anatomyQA;q.reset({hp:0,reanimates:true});q.anatomy.beginReanimation(q.e,q.d.run.time);for(let i=0;i<90;i++)q.renderOne();q.downPose=q.root.getObjectByName('Spine02').getWorldPosition(new q.THREE.Vector3()).toArray();});view=await capture('hunter-down');assert(view.physics.ragdolls>0);
 const riseDistance=await page.evaluate(()=>{const q=window.__anatomyQA;q.d.run.time=q.e.reanimate.wakeAt;q.anatomy.advanceReanimation(q.e,q.d.run.time);q.renderOne();return q.root.getObjectByName('Spine02').getWorldPosition(new q.THREE.Vector3()).distanceTo(new q.THREE.Vector3().fromArray(q.downPose));});assert(riseDistance<.08,'revival starts from the solved ragdoll pose');await capture('hunter-rise-start');
 await page.evaluate(()=>{const q=window.__anatomyQA;for(let i=0;i<65;i++)q.renderOne();});view=await capture('hunter-risen');assert.equal(view.dead,false);assert.equal(view.physics.ragdolls,0);
 // Brain finishing while down prevents the same revival.
 await page.evaluate(()=>{const q=window.__anatomyQA;q.reset({hp:0,reanimates:true});q.anatomy.beginReanimation(q.e,q.d.run.time);for(let i=0;i<30;i++)q.renderOne();q.anatomy.applyAnatomyDamage(q.e,11,{part:'head',x:q.e.x,y:q.e.y,z:.4,fraction:.25},q.d.run.time);q.d.run.time=q.e.reanimate.wakeAt+1;q.anatomy.advanceReanimation(q.e,q.d.run.time);q.renderOne();});await waitCut();view=await capture('brain-finished');assert.equal(view.dead,true);assert.equal(view.brain,0);
 await page.evaluate(()=>{const q=window.__anatomyQA;q.d.renderer.settings.gore=false;q.renderOne();});view=await capture('gore-off');assert.equal(view.brain,0);
 await page.evaluate(()=>{const q=window.__anatomyQA;q.d.renderer.render=q.render;q.d.begin();});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:180000});
 await page.evaluate(()=>{const q=window.__anatomyQA;q.d.run.mode='ready';q.d.renderer.render=()=>{};q.origin={...q.d.run.course.playerSpawn};q.d.renderer.settings.gore=true;q.reset();q.renderOne();});view=await capture('clean-reset');assert.equal(view.fragments,0);assert.equal(view.anatomy.actors,0);
 assert.deepEqual(report.errors,[]);await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({views:report.views.length,errors:report.errors,timings:report.timings}));
}catch(error){report.failure=String(error.stack||error);report.boot=await page?.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d?.renderer;return{screen:d?.screen,ready:r?._weaponsPrepared,status:r?._preparationStatus,error:String(r?._preparationError||''),models:{ash:r?._ashWitnessError,warden:r?._wardenError},body:document.body.innerText.slice(-800)};}).catch(()=>null);throw error;
}finally{try{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));}finally{await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}}
