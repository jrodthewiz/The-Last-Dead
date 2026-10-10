import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';

// An owned browser exercises the production GLB and pose driver on either an
// ephemeral server or ZOMBIE_QA_URL, without changing the player's open tab.
// An existing server is never stopped by this test. The measured
// CPU sample is an animation-update cost, not a game FPS claim.
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.ZOMBIE_HORDE_OUTPUT||'output/playwright/zombie-horde';
await mkdir(output,{recursive:true});
const existingUrl=process.env.ZOMBIE_QA_URL?.replace(/\/+$/,'');
const server=existingUrl?null:await startServer({root:process.env.ZOMBIE_QA_ROOT||process.cwd(),port:0,spaFallback:false});
const baseUrl=existingUrl||`http://127.0.0.1:${server.port}`;
const referenceRoot='C:/Users/wolfk/.codex/skills/';
const referencePaths=[
 'threejs-qa-release/references/qa-release-checklists.md',
 'threejs-qa-release/references/checklists/visual-verification.md',
 'threejs-qa-release/references/checklists/playtest-qa.md',
 'threejs-qa-release/references/checklists/release.md',
 'threejs-aaa-graphics-builder/references/checklists/aaa-game-quality-gate.md',
 'threejs-aaa-graphics-builder/references/checklists/aaa-visual-scorecard.md',
 'threejs-aaa-graphics-builder/references/checklists/procedural-model-quality.md',
 'threejs-aaa-graphics-builder/references/checklists/material-lighting-quality.md',
 'threejs-aaa-graphics-builder/references/checklists/performance-safe-visual-detail.md',
];
const report={baseUrl,ownsServer:!!server,errors:[],requestFailures:[],assetRequests:[],variants:[],captures:[],references:referencePaths.map(path=>({read:true,path:referenceRoot+path,failureReason:null})),scope:'Zombie motion and contact verification; this fixture alone does not certify the entire game or a general AAA quality score.'};
let browser,page;

const fixture=String.raw`<!doctype html><html><head><meta charset="utf-8"><title>Zombie motion QA</title>
<style>html,body{margin:0;background:#111416;color:#e5e3d9;font-family:system-ui}canvas{display:block}#caption{position:absolute;left:28px;top:22px;font-size:18px;letter-spacing:.1em;text-transform:uppercase;pointer-events:none}#caption small{display:block;margin-top:7px;color:#a6ada9;font-size:12px;letter-spacing:.05em}</style></head><body><div id="caption"></div>
<script type="module">
import * as THREE from '/vendor/three.module.js';
import {GLTFLoader} from '/vendor/loaders/GLTFLoader.js';
import * as model from '/npc-afterlife-model.js';
import * as engine from '/engine.js';
import * as ai from '/enemy-ai.js';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1b2427);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.05,100);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.render(scene,camera);});
scene.add(new THREE.HemisphereLight(0xcbd8e3,0x373426,2.8));
const key=new THREE.DirectionalLight(0xffdac0,4.2);key.position.set(-3,4,4);scene.add(key);
const rim=new THREE.DirectionalLight(0xb7dbed,3.2);rim.position.set(3,2,-3);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0x343c3d,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;scene.add(floor);
const grid=new THREE.GridHelper(50,50,0x53615d,0x404946);grid.position.y=-.008;scene.add(grid);
const loader=new GLTFLoader(),parse=loader.parseAsync.bind(loader);let loadedSha256,loadedBytes;
loader.parseAsync=async(bytes,path)=>{loadedBytes=bytes.byteLength;loadedSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');return parse(bytes,path);};
const asset=await model.loadAfterlifeModel(loader);
const q={renderer,scene,camera,asset,loadedSha256,loadedBytes,model,engine,ai,now:1000,roots:[],enemies:[],frames:0};
q.clear=()=>{for(const root of q.roots){scene.remove(root);model.disposeAfterlifeModel(root);}q.roots=[];q.enemies=[];};
q.enemy=(motion='shambler',id=53001,distance=2.5)=>{
 const variant=motion==='runner'?'skitter':'stalker';
 const e={id,x:6,y:9-distance,z:0,hp:100,maxHp:100,kind:0,variant,locomotion:motion,phase:0,moveSpeed:motion==='runner'?1.04:.72,attack:0,attacking:false,strike:0,windup:0,windupTime:motion==='runner'?.2:.28,hits:0,flash:0,stagger:0,dead:false,biteCooldown:999,pack:1};
 ai.createMind(e,{state:'stalk',firstAttack:0,facing:Math.PI/2});return e;
};
q.add=e=>{const root=model.createAfterlifeModel(asset,e.kind,e.id);scene.add(root);q.roots.push(root);q.enemies.push(e);return root;};
q.place=(root,e)=>{root.position.set((e.x-6)*4,0,(e.y-9)*4);root.rotation.y=-e.facing-Math.PI/2;};
q.draw=(root=q.roots[0],wide=false)=>{
 const p=root?.position||new THREE.Vector3(),low=root?.userData?.afterlife?.motionClass==='crawler',portrait=camera.aspect<.8,boost=portrait?(low?1.9:1.45):1;
 camera.position.set(p.x+(wide?15:(low?.8:1.05)*boost),wide?14:low?1.08:1.55,p.z+(wide?29:(low?2.05:3.05)*boost));camera.lookAt(p.x,wide?.8:low?.42:.86,p.z);
 renderer.render(scene,camera);
};
q.reset=(motion='shambler',distance=2.5)=>{
 q.clear();const course=engine.makeCourse();course.cells=Array.from({length:course.w*course.h},(_,i)=>[i<course.w?1:0,i%course.w===course.w-1?1:0,i>=course.w*(course.h-1)?1:0,i%course.w===0?1:0]);course.blocks=[];
 const r=engine.newRun(course);Object.assign(r,{mode:'play',wave:3,waveDelay:999,x:6,y:9,angle:-Math.PI/2,health:1000});
 const e=q.enemy(motion,53001,distance);course.enemies=[e];q.run=r;q.e=e;q.root=q.add(e);q.now+=1000;q.place(q.root,e);model.animateAfterlifeModel(q.root,e,q.now,e.id);q.draw();
};
q.step=()=>{engine.tick(q.run,1/60);q.now+=1000/60;q.frames++;for(let i=0;i<q.roots.length;i++){q.place(q.roots[i],q.enemies[i]);model.animateAfterlifeModel(q.roots[i],q.enemies[i],q.now,q.enemies[i].id);}if(q.frames%60===0)q.draw();};
q.sample=()=>{
 const s=q.root.userData.afterlife,e=q.e;
 const weights=Object.fromEntries(Object.entries(s.actions).map(([name,action])=>[name,action.getEffectiveWeight()]));
 return {state:e.state,motion:e.locomotion,motionIntent:e.motionIntent,moving:e.moving||0,distance:Math.hypot(e.x-q.run.x,e.y-q.run.y),strike:e.strike||0,attacking:e.attacking,health:q.run.health,attackTime:s.attackAction.time,attackWeight:s.attackAction.getEffectiveWeight(),gait:s.gaitPhase,gaitDirection:s.gaitDirection,weights,weight:Object.values(weights).reduce((n,w)=>n+w,0)};
};
q.show=(motion,contortion=0)=>{
 q.clear();const e=q.enemy(motion);e.state='wander';e.mind.state='wander';e.attacking=false;e.strike=0;e.contortion=contortion;e.motionIntent=contortion?'contort':motion;e.facing=Math.PI/2;
 const root=q.add(e);q.root=root;q.e=e;const speed=contortion?0:motion==='runner'?4.5:motion==='crawler'?1.4:.85;
 for(let i=0;i<180;i++){q.now+=1000/60;root.position.z+=speed/60;model.animateAfterlifeModel(root,e,q.now,e.id);}
 let contortPhase=null;
 if(contortion){const action=root.userData.afterlife.contortAction,head=root.userData.afterlife.model.getObjectByName('Head');let best=-Infinity;
  for(let sample=0;sample<36;sample++){action.time=action.getClip().duration*sample/36;model.animateAfterlifeModel(root,e,q.now,e.id);root.updateMatrixWorld(true);const up=new THREE.Vector3(0,1,0).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())),roll=Math.abs(Math.atan2(up.x,up.y));if(roll>best){best=roll;contortPhase=sample/36;}}
  action.time=action.getClip().duration*contortPhase;model.animateAfterlifeModel(root,e,q.now,e.id);
 }
 q.draw(root);root.updateMatrixWorld(true);
 const head=root.userData.afterlife.model.getObjectByName('Head');const p=head?.getWorldPosition(new THREE.Vector3());
 document.getElementById('caption').innerHTML=motion.toUpperCase()+(contortion?' / CONTORTION':'')+'<small>Production rig · distance-driven animation · 1.86 m actor</small>';
 const s=root.userData.afterlife;return {motion,contortion,contortPhase,headHeight:p?.y-root.position.y,motionClass:s.motionClass,weights:Object.fromEntries(Object.entries(s.actions).map(([n,a])=>[n,a.getEffectiveWeight()]))};
};
q.pixels=()=>{
 renderer.render(scene,camera);const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 const colors=new Set();let changed=0;for(let i=0;i<w*h;i+=Math.max(1,Math.floor(w*h/8192))){colors.add((pixels[i*4]>>4)+','+(pixels[i*4+1]>>4)+','+(pixels[i*4+2]>>4));if(pixels[i*4]!==pixels[0]||pixels[i*4+1]!==pixels[1]||pixels[i*4+2]!==pixels[2])changed++;}
 return {colorBuckets:colors.size,changedSamples:changed,canvas:[renderer.domElement.clientWidth,renderer.domElement.clientHeight,w,h],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
};
q.crowd=()=>{
 q.clear();for(let i=0;i<24;i++){const e=q.enemy(['shambler','runner','crawler'][i%3],54000+i),root=q.add(e);root.position.set((i%6-2.5)*2.2,0,(Math.floor(i/6)-1.5)*2.4);e.facing=Math.PI/2;}
 const times=[];let transitionUpdates=0;for(let frame=0;frame<240;frame++){q.now+=1000/60;const started=performance.now();for(let i=0;i<24;i++){const root=q.roots[i],e=q.enemies[i],phase=(frame+i*7)%150;
  if(e.locomotion==='crawler'){
   e.attacking=phase>=30&&phase<47;e.windup=e.attacking?(47-phase)/60:0;e.strike=phase>=47&&phase<61?(61-phase)/60:0;
   e.stagger=phase>=90&&phase<108?(108-phase)/60:0;if(phase===90)e.hits++;
   e.contortion=phase>=125?1:0;if(frame>=200&&i%6===2)e.dead=true;
   if(e.attacking||e.strike>0||e.stagger>0||e.dead)transitionUpdates++;
  }
  if(!e.attacking&&!(e.strike>0)&&!(e.stagger>0)&&!e.dead&&!e.contortion)root.position.z+=(e.locomotion==='runner'?3.4:e.locomotion==='crawler'?.9:.65)/60;
  model.animateAfterlifeModel(root,e,q.now,e.id);
 }times.push(performance.now()-started);}
 const ordered=[...times].sort((a,b)=>a-b),center=new THREE.Vector3();for(const root of q.roots)center.add(root.position);center.divideScalar(q.roots.length);q.draw({position:center},true);document.getElementById('caption').innerHTML='24 ACTOR MOTION SAMPLE<small>Eight shamblers · eight runners · eight crawlers</small>';
 return {actors:24,sampledFrames:240,transitionUpdates,transitionCases:['crawler windup','contact','recovery','hit recoil','contort','death'],meanUpdateMilliseconds:times.reduce((a,b)=>a+b,0)/times.length,p95UpdateMilliseconds:ordered[Math.floor(ordered.length*.95)],maxUpdateMilliseconds:ordered.at(-1),renderer:q.pixels()};
};
window.__ZOMBIE_HORDE_QA__=q;
</script></body></html>`;

try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--use-angle=d3d11']});
 page=await browser.newPage({viewport:{width:1280,height:800}});
 const flagBrowserError=message=>page.evaluate(message=>{window.__ZOMBIE_QA_RESOURCE_ERROR__=message;},message).catch(()=>{});
 page.on('pageerror',e=>{report.errors.push(e.message);console.error('Browser page error:',e.message);flagBrowserError(e.message);});
 page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.error('Browser console error:',m.text());flagBrowserError(m.text());}});
 page.on('response',r=>{if(r.status()>=400){const message=`${r.status()} ${r.url()}`;report.errors.push(message);console.error('HTTP error:',message);flagBrowserError(message);}});
 page.on('requestfailed',r=>report.requestFailures.push(`${r.failure()?.errorText} ${r.url()}`));
 page.on('requestfinished',r=>{if(r.url().includes('.glb'))report.assetRequests.push(r.url());});
 await page.route('**/zombie-horde-fixture.html',route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.goto(`${baseUrl}/zombie-horde-fixture.html`,{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.__ZOMBIE_HORDE_QA__,null,{timeout:120000});
 report.asset=await page.evaluate(()=>{const q=window.__ZOMBIE_HORDE_QA__;return {url:q.asset.url,sha256:q.loadedSha256,bytes:q.loadedBytes,clips:q.asset.clips.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length,metadata:c.userData})),required:q.model.AFTERLIFE_ASH_WITNESS_CLIPS};});
 if(process.env.ZOMBIE_EXPECT_SHA256)assert.equal(report.asset.sha256,process.env.ZOMBIE_EXPECT_SHA256.toLowerCase(),'browser parsed the exact expected delivery');
 for(const name of Object.values(report.asset.required))assert(report.asset.clips.some(c=>c.name===name),`production GLB includes ${name}`);
 assert.equal(report.asset.clips.length,10,'ten authored production clips load');
 for(const motion of ['shambler','runner','crawler']){
  await page.evaluate(m=>window.__ZOMBIE_HORDE_QA__.reset(m),motion);
  const samples=await page.evaluate(()=>{const q=window.__ZOMBIE_HORDE_QA__,out=[];for(let i=0;i<720;i++){q.step();out.push(q.sample());}return out;});
  const contacts=samples.filter((s,i)=>i>0&&s.health<samples[i-1].health),sliding=samples.filter(s=>s.strike>0&&s.moving>.05);
  const locked=samples.filter(s=>s.strike===0&&!s.attacking&&s.moving>.25&&s.attackWeight>.9);
  const summary={motion,attacks:contacts.length,slidingContactFrames:sliding.length,lockedRecoveryFrames:locked.length,states:[...new Set(samples.map(s=>s.state))],minDistance:Math.min(...samples.map(s=>s.distance)),contacts};report.variants.push(summary);
  await writeFile(`${output}/${motion}-samples.json`,JSON.stringify(samples));console.log(JSON.stringify({motion,attacks:contacts.length,slidingContactFrames:sliding.length,lockedRecoveryFrames:locked.length}));
  assert(contacts.length>=3,`${motion} pursues and repeatedly attacks in twelve seconds`);
  assert.equal(sliding.length,0,`${motion} remains planted through contact`);
  assert(locked.length<=contacts.length*3,`${motion} releases attack recovery as locomotion resumes`);
  assert(samples.every(s=>Number.isFinite(s.gait)&&Math.abs(s.weight-1)<1e-5),`${motion} finite, normalized animation`);
  assert(contacts.every(s=>Math.abs(s.attackTime-.375)<.002),`${motion} damage coincides with authored contact`);
 }
 for(const [motion,contortion]of [['shambler',0],['runner',0],['crawler',0],['crawler',1]]){
  const data=await page.evaluate(([m,c])=>window.__ZOMBIE_HORDE_QA__.show(m,c),[motion,contortion]);
  const name=contortion?'crawler-contortion':motion;
  await page.screenshot({path:`${output}/${name}.png`});data.name=name;data.renderer=await page.evaluate(()=>window.__ZOMBIE_HORDE_QA__.pixels());report.captures.push(data);
  assert(data.renderer.colorBuckets>12&&data.renderer.changedSamples>100,'nonblank varied actor capture');
  if(motion==='runner')assert(data.weights.run>.7,'runner selects the dedicated sprint');
  if(motion==='crawler'&&!contortion)assert(data.weights.crawl>.7,'crawler selects its authored hand-supported gait');
  if(contortion)assert(data.weights.contort>.3,'stationary crawler selects authored contortion');
 }
 assert(report.captures.find(c=>c.name==='crawler').headHeight<report.captures.find(c=>c.name==='shambler').headHeight*.65,'crawler silhouette is clearly low');
 report.crowd=await page.evaluate(()=>window.__ZOMBIE_HORDE_QA__.crowd());await page.screenshot({path:`${output}/crowd-24.png`});
 assert(Number.isFinite(report.crowd.meanUpdateMilliseconds),'measured crowd animation CPU cost');
 await page.setViewportSize({width:390,height:844});
 for(const motion of ['runner','crawler']){await page.evaluate(m=>window.__ZOMBIE_HORDE_QA__.show(m,0),motion);await page.screenshot({path:`${output}/portrait-${motion}.png`});}
 await page.setViewportSize({width:1280,height:800});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requestFailures,[]);report.fixtureResult='PASS';report.result='IN_PROGRESS';
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 if(process.env.ZOMBIE_HORDE_GAME_SMOKE==='1'){
  await page.goto(`${baseUrl}/?debug=1`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__||window.__ZOMBIE_QA_RESOURCE_ERROR__||document.querySelector('[role="alert"]'),null,{timeout:90000});
  assert(await page.evaluate(()=>!!window.__DEAD_ARRIVAL__),'native WebGPU game initialized');console.log('Coastal game initialized; starting real game asset preparation');
  await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'||window.__ZOMBIE_QA_RESOURCE_ERROR__||document.querySelector('[data-action="reload"]:not([hidden])'),null,{timeout:240000});
  report.gameStartup=await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__.screen,nativeWebGPU:!!window.__DEAD_ARRIVAL__.renderer.renderer.backend?.isWebGPUBackend,stage:window.__DEAD_ARRIVAL__.renderer._preparationStage,error:window.__ZOMBIE_QA_RESOURCE_ERROR__||null,status:document.querySelector('.loading-stage')?.textContent||null}));
  assert.equal(report.gameStartup.screen,'play',`game preparation failed: ${report.gameStartup.error||report.gameStartup.status}`);
  console.log('Coastal game started');
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._warmupPromise);
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.harborProgress?.initialized,null,{timeout:90000});
  await page.screenshot({path:`${output}/game-coastal-spawn.png`});
  report.game=await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;return {screen:d.screen,harbor:d.run.course.harbor,asset:d.renderer.diagnostics().ashWitness,enemies:d.run.course.enemies.map(e=>({id:e.id,locomotion:e.locomotion,state:e.state,motionIntent:e.motionIntent,x:e.x,y:e.y})),renderer:d.renderer.diagnostics()};});
  assert.equal(report.game.asset.error,null);assert.equal(report.game.asset.clips.length,10);
  assert.equal(report.game.harbor,true);for(const motion of ['shambler','runner','crawler'])assert(report.game.enemies.some(e=>e.locomotion===motion),`natural coastal residents include ${motion}`);
  report.game.approaches=[];
  for(const motion of ['shambler','runner','crawler']){
   const approach=await page.evaluate(async motion=>{
    const d=window.__DEAD_ARRIVAL__,r=d.run,{canStand,castRay}=await import('./engine.js');
    const e=r.course.enemies.find(e=>!e.dead&&e.locomotion===motion);if(!e)throw Error('No natural resident '+motion);
    for(const[dx,dy]of[[0,1.1],[1.1,0],[0,-1.1],[-1.1,0]]){
     const x=e.x+dx,y=e.y+dy,angle=Math.atan2(e.y-y,e.x-x);
     if(canStand(r.course,x,y,.12)&&castRay(r.course,x,y,angle,1.2).dist>1.04){Object.assign(r,{x,y,angle,pitch:-.05,z:0,vx:0,vy:0,vz:0,health:1000});d.renderer._firstCameraFrame=true;d.renderer.render(r,performance.now());return {motion,enemyId:e.id,x,y,enemyX:e.x,enemyY:e.y};}
    }throw Error('No clear resident approach '+motion);
   },motion);
   report.game.approaches.push(approach);await page.screenshot({path:`${output}/game-natural-${motion}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/game-natural-crawler-portrait.png`});
  report.game.portrait=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth}));assert(report.game.portrait.scrollWidth<=390);
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requestFailures,[]);report.result='PASS';console.log(JSON.stringify({result:report.result,crowd:report.crowd,output}));
}catch(error){report.result='FAIL';report.failure=error.stack;await page?.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser?.close();if(server){server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}}
