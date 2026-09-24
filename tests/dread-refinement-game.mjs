import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const baseline=process.argv.includes('--baseline');
const actionsOnly=process.argv.includes('--actions-only');
const output=process.env.DREAD_QA_OUTPUT||(baseline?'docs/dread-refinement/before-actions':'docs/dread-refinement');
const baseURL=process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/';
await mkdir(output,{recursive:true});
const baselineFiles=new Map();
if(baseline){
 const changed=execFileSync('git',['diff','--name-only','4ed511f','--','*.js','*.html','*.css','assets/models/afterlife-ash-witness.glb'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/).filter(p=>!p.startsWith('docs/')&&!p.startsWith('tests/')&&!p.startsWith('scripts/'));
 for(const p of changed){try{baselineFiles.set(p,execFileSync('git',['show',`4ed511f:${p}`],{maxBuffer:40*1024*1024,stdio:['ignore','pipe','ignore']}));}catch{}}
}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1536,height:864}});
if(baseline)await page.route('http://127.0.0.1:5200/**',route=>{const p=decodeURIComponent(new URL(route.request().url()).pathname).slice(1)||'index.html';const body=baselineFiles.get(p);return body?route.fulfill({status:200,contentType:p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':p.endsWith('.glb')?'model/gltf-binary':'text/javascript',body}):route.continue();});
const report={source:baseline?'git 4ed511f, response overrides in isolated QA browser only':baseURL.includes('/dist/')?'production build':'current working game',captureURL:baseURL,errors:[],requests:[],weapons:[],gait:[],attack:[],blood:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.requests.push({url:r.url(),status:r.status()});});
const capture=name=>page.screenshot({path:`${output}/${name}.png`});
try{
 await page.goto(baseURL+'?debug=1&dungeon=2',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,null,{timeout:60000});
 await page.locator('[data-action="start"]').click();
 await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,engine=await import('./engine.js'),{makeDungeonCourse}=await import('./playground/map/dungeon-course.js'),THREE=await import('./vendor/three.module.js');
  Object.assign(d.run,engine.newRun(makeDungeonCourse(2)),{mode:'play',x:19.5,y:24.2,angle:-Math.PI/2,pitch:-.025});
  for(let i=0;i<315;i++)engine.tick(d.run,1/60,{});d.run.mode='ready';d.renderer._firstCameraFrame=true;
  window.__dreadQA={d,engine,THREE,now:performance.now(),sample:{...d.run.course.enemies.find(e=>e.kind===0)}};
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._warmupPromise);
 await page.evaluate(()=>{
  const q=window.__dreadQA;q.render=q.d.renderer.render.bind(q.d.renderer);q.d.renderer.render=()=>{};
  q.d.run.course.enemies=[];
  q.step=(frames=1,simulate=false)=>{
   for(let i=0;i<frames;i++){
    q.now+=1000/60;
    if(simulate){q.d.run.mode='play';q.engine.tick(q.d.run,1/60,{});q.d.run.mode='ready';}
    else q.d.run.shot=Math.max(0,q.d.run.shot-.08);
    q.render(q.d.run,q.now);
   }
  };
  q.actor=()=>{
   const e=q.d.run.course.enemies[0],root=q.d.renderer._enemyVisuals.get(e.id)?.root,s=root?.userData.afterlife;
   root?.updateMatrixWorld(true);
   const bonePosition=name=>s?.model.getObjectByName(name)?.getWorldPosition(new q.THREE.Vector3()).toArray();
   return {id:e.id,x:e.x,y:e.y,dead:e.dead,attacking:e.attacking,windup:e.windup,strike:e.strike,attackActive:s?.attackActive,hitActive:s?.hitActive,gaitTimeScale:s?.gaitTimeScale,weights:Object.fromEntries(Object.entries(s?.actions||{}).map(([k,a])=>[k,a.getEffectiveWeight()])),clipTimes:Object.fromEntries(Object.entries(s?.actions||{}).map(([k,a])=>[k,a.time])),leftFoot:bonePosition('LeftFoot'),rightFoot:bonePosition('RightFoot'),head:bonePosition('Head'),rootYaw:root?.rotation.y,emissive:s?.materials.map(m=>({color:m.emissive?.getHex(),intensity:m.emissiveIntensity,map:!!m.emissiveMap}))};
  };
  q.weapon=phase=>{
   const keys=['ossuary','breach','arc','reliquary'],key=keys[q.d.run.weapon];let meta;
   q.d.renderer.weaponGroups[q.d.run.weapon].traverse(o=>{if(o.userData[key])meta=o.userData[key];});
   const mechanism=['jawTension','pressurePulse','cagePulse','ritualPulse'][q.d.run.weapon];
   const diag=q.d.renderer._collectDiagnostics(q.d.run);
   return {phase,shot:q.d.run.shot,mechanism,value:meta?.[mechanism],recoil:meta?.recoil,events:q.d.run.events.map(e=>e.type),render:{calls:diag.calls,gpuTriangles:diag.gpuTriangles,textures:diag.rendererTextures}};
  };
 });
 for(let weapon=0;weapon<(baseline?0:4);weapon++){
  const trace=[];
  await page.evaluate(w=>{const q=window.__dreadQA;q.d.run.weapon=w;q.d.run.shot=0;q.step(120);},weapon);
  await capture(`weapon-${weapon+1}-idle`);
  trace.push(await page.evaluate(()=>window.__dreadQA.weapon('idle')));
  await page.evaluate(()=>{const q=window.__dreadQA;q.d.run.mode='play';q.d.run.cooldowns.fill(0);q.engine.shoot(q.d.run);q.d.run.mode='ready';q.step(3,true);});
  await capture(`weapon-${weapon+1}-action`);
  trace.push(await page.evaluate(()=>window.__dreadQA.weapon('action')));
  await page.evaluate(()=>{const q=window.__dreadQA;q.d.run.shot=0;q.d.run.tracers=[];q.d.run.projectiles=[];q.step(150);});
  await capture(`weapon-${weapon+1}-rest`);
  trace.push(await page.evaluate(()=>window.__dreadQA.weapon('rest')));
  report.weapons.push({weapon,trace});
 }
 await page.evaluate(()=>{
  const q=window.__dreadQA;Object.assign(q.d.run,{weapon:0,shot:0,pitch:-.1,health:1000});
  q.d.run.course.enemies=[{...q.sample,id:93001,x:19.5,y:22.85,hp:12,maxHp:12,attack:10,attacking:false,strike:0,windup:0,hits:0,flash:0,dead:false}];
  q.d.renderer._firstCameraFrame=true;q.step(1);
 });
 for(let i=0;i<(baseline?0:4);i++){
  await page.evaluate(()=>window.__dreadQA.step(15,true));
  await capture(`gait-${i}`);report.gait.push(await page.evaluate(()=>window.__dreadQA.actor()));
 }
 await page.evaluate(()=>{
  const q=window.__dreadQA,e=q.d.run.course.enemies[0];Object.assign(e,{x:19.5,y:23.65,attack:0,attacking:false,strike:0,windup:0,moveSpeed:0});q.step(1,true);
 });
 for(const [phase,frames] of (baseline?[]:[['windup',6],['commit',13],['recover',31]])){
  await page.evaluate(n=>window.__dreadQA.step(n,true),frames);await capture('attack-'+phase);report.attack.push({phase,...await page.evaluate(()=>window.__dreadQA.actor())});
 }
 await page.evaluate(()=>{
  const q=window.__dreadQA,e=q.d.run.course.enemies[0];Object.assign(e,{x:19.5,y:23.2,hp:12,maxHp:12,attack:20,attacking:false,strike:0,windup:0,dead:false,flash:0});
  Object.assign(q.d.run,{angle:-Math.PI/2,pitch:-.18,shot:0,weapon:0});q.d.renderer._firstCameraFrame=true;q.step(40);
  q.d.run.mode='play';q.d.run.cooldowns.fill(0);q.engine.shoot(q.d.run);q.d.run.mode='ready';q.step(3,true);
 });
 await capture('blood-hit');report.blood.push(await page.evaluate(()=>{const q=window.__dreadQA,fx=q.d.renderer.weaponFX.impacts;return {phase:'hit',enemy:q.actor(),fx:fx.detailActive,gore:q.d.run.gore.length,blood:q.d.run.blood.length,tracers:q.d.run.tracers,splashes:fx.splashPool.filter(p=>p.age<p.duration).map(p=>({position:p.position.toArray(),age:p.age,size:p.size,duration:p.duration}))};}));
 await page.evaluate(()=>{
  const q=window.__dreadQA;q.step(20,true);q.d.run.course.enemies[0].hp=1;q.d.run.mode='play';q.d.run.cooldowns.fill(0);q.engine.shoot(q.d.run);q.d.run.mode='ready';q.step(6,true);
 });
 await capture('blood-kill');report.blood.push(await page.evaluate(()=>({phase:'kill',dead:window.__dreadQA.d.run.course.enemies[0]?.dead,fx:window.__dreadQA.d.renderer.weaponFX.impacts.detailActive,gore:window.__dreadQA.d.run.gore.length,blood:window.__dreadQA.d.run.blood.length})));
 // A single-wave fixture lets the corpse finish its authored action without
 // a newly spawned actor obscuring the evidence. Damage and time still tick.
 await page.evaluate(()=>{const q=window.__dreadQA;q.d.run.waveCount=q.d.run.wave;q.step(24,true);});
 await capture('collapse-transfer');report.collapse=[await page.evaluate(()=>window.__dreadQA.actor())];
 await page.evaluate(()=>window.__dreadQA.step(106,true));await capture('blood-residue');
 report.collapse.push(await page.evaluate(()=>window.__dreadQA.actor()));
 if(!baseline){
  const yaw=report.collapse.at(-1).rootYaw;
  await page.evaluate(()=>{const q=window.__dreadQA,e=q.d.run.course.enemies[0];q.d.run.x=e.x+1;q.d.run.y=e.y+.4;q.d.run.angle=Math.atan2(e.y-q.d.run.y,e.x-q.d.run.x);q.d.run.pitch=-.25;q.d.renderer._firstCameraFrame=true;q.step(2);});
  await capture('corpse-side');report.collapse.push(await page.evaluate(()=>window.__dreadQA.actor()));
  assert.equal(report.collapse.at(-1).rootYaw,yaw,'corpse orientation stays fixed when the player moves');
  assert.ok(report.collapse.at(-1).head[1]<.65,'settled corpse head reaches the floor instead of remaining at standing height');
 }
 report.diagnostics=await page.evaluate(()=>window.__dreadQA.d.renderer._collectDiagnostics(window.__dreadQA.d.run));
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
 assert.ok(report.blood[0].gore>0,'real shot generated blood');assert.equal(report.blood[1].dead,true,'kill uses real damage simulation');
 if(!baseline)assert.ok(report.attack.some(s=>s.attackActive),'melee lunge triggered');
 assert.ok(report.weapons.every(w=>w.trace[1].value>.1&&w.trace[2].value<.01),'all mechanisms cycle and return');
 if(!baseline&&!actionsOnly){
  await page.evaluate(async()=>{
   const q=window.__dreadQA,{makeDungeonCourse}=await import('./playground/map/dungeon-course.js');
   Object.assign(q.d.run,q.engine.newRun(makeDungeonCourse(2)),{mode:'play',x:19.5,y:24.2,angle:-Math.PI/2,pitch:-.025});
   for(let i=0;i<315;i++)q.engine.tick(q.d.run,1/60,{});
   q.d.run.mode='ready';q.d.renderer._firstCameraFrame=true;q.step(1);
   await q.d.renderer._warmupPromise;q.step(2);
  });
  await capture('scene-after');
  const comparison={errors:report.errors,httpErrors:report.requests,label:'after',scene:await page.evaluate(()=>window.__dreadQA.d.renderer._collectDiagnostics(window.__dreadQA.d.run))};
  report.performance=await page.evaluate(async()=>{
   const q=window.__dreadQA,samples=[];let previous=0;
   await new Promise(resolve=>{const frame=now=>{if(previous)samples.push(now-previous);previous=now;q.step(1);if(samples.length>=180)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);});
   samples.sort((a,b)=>a-b);
   return {kind:'180-frame fixed-view render sample, simulation frozen',medianMs:samples[90],p95Ms:samples[171],heapUsedBytes:performance.memory?.usedJSHeapSize,heapTotalBytes:performance.memory?.totalJSHeapSize};
  });
  comparison.performance=report.performance;
  for(let w=0;w<4;w++){
   await page.evaluate(w=>{const q=window.__dreadQA;q.d.run.weapon=w;q.d.run.shot=0;q.step(2);},w);
   await capture(`weapon-${w+1}-after`);
  }
  await page.evaluate(()=>{
   const q=window.__dreadQA;q.d.run.pitch=-.45;q.d.renderer._firstCameraFrame=true;
   q.d.run.blood=[{id:41,x:19.03,y:23.25,size:.24,age:0,angle:.3},{id:42,x:19.83,y:23.05,size:.21,age:12,angle:2.8},{id:43,x:19.4,y:22.7,size:.33,age:30,angle:1.6},{id:44,x:19.4,y:23.85,size:.11,age:2,angle:-.8}];q.step(2);
  });
  await capture('blood-after');comparison.blood=await page.evaluate(()=>window.__dreadQA.d.renderer._collectDiagnostics(window.__dreadQA.d.run));
  await writeFile(`${output}/capture-after.json`,JSON.stringify(comparison,null,2));
 }
 console.log(JSON.stringify({ok:true,errors:report.errors,attack:report.attack.map(s=>({phase:s.phase,attack:s.attackActive,windup:s.windup,strike:s.strike})),blood:report.blood.map(s=>({phase:s.phase,gore:s.gore,blood:s.blood,dead:s.dead}))}));
}finally{await writeFile(`${output}/actions-qa.json`,JSON.stringify(report,null,2));await browser.close();}
