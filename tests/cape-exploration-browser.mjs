import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const iteration=process.env.CAPE_QA_LABEL||'06';
const roomOnly=process.env.CAPE_QA_ROOM_ONLY==='1';
const output=process.env.CAPE_QA_OUTPUT||`output/playwright/blackwater-${iteration}`;await mkdir(output,{recursive:true});
const buildRoot=resolve(process.env.CAPE_QA_ROOT||'dist');
const captureFiles=['renderer.js','engine.js','main.js','coastal-structures.js','corpse-physics.js','blackwater-render-looks.js','blackwater-graphic-style.js','blackwater-weapon-style.js','blackwater-actor-style.js','webgpu-material-hooks.js','coastal-instancing.js','harbor-static-details.js','harbor-shadow-coverage.js','harbor-visuals.js','coastal-world-layout.js','scavenger-pack.js','scavenger-pack-ui.js','assets/blackwater-kit/architecture.js','assets/blackwater-kit/furniture.js','assets/blackwater-kit/cottage-authored.js','assets/blackwater-kit/cape75-structure.js','assets/blackwater-kit/practicals.js','coastal-terrain.js','forest-vegetation.js','cape-river.js','assets/survivor/viewmodel-arms-v2.glb'];
if(Number(iteration)>=10)captureFiles.push('assets/blackwater-kit/cape75-upstairs-art.js');
if(Number(iteration)>=11)captureFiles.push('assets/blackwater-kit/evacuation-folio.js','assets/survivor/foreground-arms.js','assets/survivor/foreground-anatomy.js','assets/survivor/foreground-sleeves.js','assets/survivor/viewmodel-hold-poses.js','assets/survivor/viewmodel-depth.js');
if(Number(iteration)>=11)captureFiles.push(...["index.html","ui.js","game-interface.css","horror-ui.css","styles.css","scavenger-pack.css"]);
const capturedHashes=Object.fromEntries(await Promise.all(captureFiles.map(async file=>[file,createHash('sha256').update(await readFile(resolve(buildRoot,file))).digest('hex')])));
const server=await startServer({root:buildRoot,port:0});let browser,page;
const report={scope:'Built native game, real Start; free-cursor keyboard traversal, manually paced simulation/debug starting poses and deterministic engine firing. No native pointer/keyboard capture or fullscreen. Desktop GPU at1280x800/DPR1; mobile viewport is not phone hardware.',errors:[],warnings:[],httpErrors:[],views:[],routes:[],inputSafety:[],hudSeparation:[]};
if(roomOnly)report.scope='Actual immutable game on native desktop WebGPU; scoped lower case, street/stairs/room W/Q/B journey, controlled starts and manual120Hz simulation. No native capture, firing, hardware FPS, outdoor traversal or phone-hardware acceptance.';
report.roomOnly=roomOnly;
report.buildRoot=buildRoot;report.capturedBuildHashes=capturedHashes;report.ownedNodePid=process.pid;
const stopOwnedBrowser=()=>{report.interrupted=true;browser?.close().catch(()=>{});};
process.once('SIGINT',stopOwnedBrowser);
try{
 browser=await chromium.launch({headless:true,handleSIGINT:false,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 if(report.interrupted)throw new Error('Owned QA interrupted before browser initialization');
 report.browserVersion=browser.version();console.log('QA browser',report.browserVersion);
 page=await browser.newPage({viewport:{width:1280,height:800}});
 await guardBackgroundInput(page);
 await page.addInitScript(()=>{
  const observe=setInterval(()=>{
   const device=window.__DEAD_ARRIVAL__?.renderer?.renderer?.backend?.device;
   if(!device?.lost)return;clearInterval(observe);
   device.lost.then(info=>{window.__CAPE_QA_DEVICE_LOSS__={reason:info.reason,message:info.message};});
  },50);
 });
 const verifyInput=async stage=>{
  const state=await backgroundInputState(page);report.inputSafety.push({stage,...state});
  assert.equal(state.webdriver,true);assert.equal(state.pointerLocked,false);assert.equal(state.fullscreen,false);
  assert.deepEqual(state.attempts,{pointerLock:0,fullscreen:0,keyboardLock:0},`${stage} attempted forbidden native capture`);
 };
 let rejectRuntime;const runtimeFailure=new Promise((_,reject)=>{rejectRuntime=reject;});runtimeFailure.catch(()=>{});
 page.on('pageerror',e=>{report.errors.push(String(e));console.log('PAGE ERROR',String(e));rejectRuntime(e);});page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.log('CONSOLE ERROR',m.text());rejectRuntime(new Error(m.text()));}if(m.type()==='warning')report.warnings.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
 const started=Date.now();await page.goto(`http://127.0.0.1:${server.port}/?debug=1&horrorqa=1`);await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});if(process.env.CAPE_WEAPON_STYLE==='0')await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer._blackwaterWeaponStyleEnabled=false;});await page.locator('[data-action="start"]').click({timeout:60000});console.log('Cape production Start');
 await Promise.race([page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:240000}),runtimeFailure]);report.startMs=Date.now()-started;console.log('Cape production ready',report.startMs);await writeFile(`${output}/cape-progress.json`,JSON.stringify(report,null,2));
 await page.evaluate(()=>{window.__HORROR_QA__.setManual(true);const q=window.__DEAD_ARRIVAL__;q.renderer.weaponPresentation.equipAge=100;q.run.health=100;q.run.weapon=0;});
 if(roomOnly){report.hudFixture={scope:'Controlled active style total of38 for empty/full pack layout checks; no combat scoring claim.'};await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.stylePending=38;window.advanceTime(0);});}
 await page.evaluate(()=>document.activeElement?.blur());await verifyInput('start');
 report.canvas=await page.evaluate(()=>{const c=window.__DEAD_ARRIVAL__.renderer.renderer.domElement,r=c.getBoundingClientRect();return{displayWidth:r.width,displayHeight:r.height,drawingWidth:c.width,drawingHeight:c.height};});
 assert.ok(Object.values(report.canvas).every(v=>v>0),'actual game canvas must have nonzero display and drawing size');
 report.gpu=await page.evaluate(()=>{const b=window.__DEAD_ARRIVAL__.renderer.renderer.backend,i=b.adapter?.info??b.device?.adapterInfo;return{nativeWebGPU:b.isWebGPUBackend,adapterInfo:i?{vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description}:null};});assert.equal(report.gpu.nativeWebGPU,true);
 const settle=()=>page.evaluate(async frames=>{for(let i=0;i<frames;i++)await new Promise(requestAnimationFrame);await window.__DEAD_ARRIVAL__.renderer.renderer.backend.device.queue.onSubmittedWorkDone();},20);
 const pose=async(x,z,tx,tz,pitch=0)=>{await page.evaluate(({x,z,tx,tz,pitch})=>{const q=window.__DEAD_ARRIVAL__;Object.assign(q.run,{x:x/4,y:z/4,z:0,supportZ:null,supportId:null,structureId:null,angle:Math.atan2(tz-z,tx-x),pitch,vx:0,vy:0,vz:0,damage:0,shot:0});window.advanceTime(16);},{x,z,tx,tz,pitch});await settle();};
 const capture=async name=>{name=name.replace(/^06-/,`${iteration}-`);await verifyInput(name);
  const hud=await page.evaluate(()=>{
   const box=selector=>{const e=document.querySelector(selector);if(!e||e.closest('[hidden]')||!e.getClientRects().length)return null;const s=getComputedStyle(e),r=e.getBoundingClientRect();if(s.visibility==='hidden'||s.display==='none'||r.width<=0||r.height<=0)return null;return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,text:e.textContent.trim()};};
   const q=window.__DEAD_ARRIVAL__;
   return{width:innerWidth,height:innerHeight,screen:q.screen,expectedPack:q.screen==='play'&&!!(q.run.course.extended||q.run.course.scavenging),pack:box('.pack-launcher'),rank:box('#ui [data-hud="rank"]'),pending:box('#ui .style-pending'),caption:box('#ui .rank-caption')};
  });report.hudSeparation.push({stage:name,...hud});
  if(Number(iteration)>=11){
   if(hud.expectedPack)assert.ok(hud.pack,`${name} visible pack must produce a measured rectangle`);
   if(roomOnly&&hud.expectedPack)assert.ok(hud.rank&&hud.pending&&hud.caption,`${name} controlled active style must have measured rank, unbanked and caption rectangles`);
   if(hud.pack){
    assert.ok(hud.pack.left>=0&&hud.pack.top>=0&&hud.pack.right<=hud.width&&hud.pack.bottom<=hud.height,`${name} pack must fit the viewport`);
    for(const text of [hud.rank,hud.pending,hud.caption].filter(Boolean))assert.ok(hud.pack.right+4<=text.left||text.right+4<=hud.pack.left||hud.pack.bottom+4<=text.top||text.bottom+4<=hud.pack.top,`${name} pack/style text must have4px separation`);
   }
  }
  await page.screenshot({path:`${output}/${name}.png`});report.views.push(await page.evaluate(name=>{const q=window.__DEAD_ARRIVAL__,g=q.renderer;return{name,x:q.run.x*4,z:q.run.y*4,camera:g.camera.getWorldPosition(g._capePosition??=g.camera.position.clone()).toArray(),fov:g.camera.fov,forest:g.harborWorld.forest.diagnostics(),recording:g.bodycam.diagnostics(),recHud:!!document.querySelector('#bodycam-hud')};},name));console.log('Captured',name);await writeFile(`${output}/cape-progress.json`,JSON.stringify(report,null,2));};
 const measure=name=>page.evaluate(async name=>{const g=window.__DEAD_ARRIVAL__.renderer,r=g.renderer,draw=g.render,auto=r.info.autoReset,t=[];g.render=()=>{};r.info.autoReset=false;try{for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);r.info.reset();const start=performance.now();g._renderScene();await r.backend.device.queue.onSubmittedWorkDone();if(i>=8)t.push(performance.now()-start);}t.sort((a,b)=>a-b);return{name,scope:'Stationary scene plus clean firstperson resolve;22 fenced samples, not total gameplay FPS.',draws:r.info.render.drawCalls,triangles:r.info.render.triangles,medianMs:t[11],p95Ms:t[20],memoryBytes:r.info.memory.total};}finally{g.render=draw;r.info.autoReset=auto;}},name);
 report.resources=await page.evaluate(()=>{
  const g=window.__DEAD_ARRIVAL__.renderer,w=g.harborWorld,d=w.blackwater.diagnostics;
  const models=d.models.map(m=>({id:m.id,triangleCount:m.triangleCount,drawCalls:m.drawCalls,materialSlots:m.materialSlots,bounds:m.bounds,
   ...(m.plan.structure?{structure:{...m.plan.structure.diagnostics,floors:m.plan.structure.floors,stairWaypoints:m.plan.structure.stairPath.length},
    lowerArtTriangles:[...new Set(m.plan.authoredCottage.placements.map(p=>p.role))].reduce((n,role)=>n+(m.trianglesPerModule[role]||0),0),
    upstairsArtTriangles:Object.entries(m.trianglesPerModule).filter(([role])=>role.startsWith('cape75-upstairs-')).reduce((n,[,t])=>n+t,0),
    upstairsArt:{primitiveCount:m.plan.upstairsArt.diagnostics.primitiveCount,moduleCount:m.plan.upstairsArt.diagnostics.moduleCount,materialSlots:m.plan.upstairsArt.diagnostics.materialSlots,replacedSolidCount:m.plan.upstairsArt.diagnostics.replacedSolidCount,addedCollisionSolids:m.plan.upstairsArt.diagnostics.addedCollisionSolids}}:{})}));
  const buildingBatches=Object.fromEntries(Object.entries(d.buildingBatches).filter(([,v])=>['string','number','boolean'].includes(typeof v)));
  return{district:{...d,models,buildingBatches},terrain:w.diagnostics.terrain,forest:w.forest.diagnostics(),coastalStyle:w.diagnostics.coastalArtDirection,weaponStyle:g.blackwaterWeaponStyle.diagnostics,weaponLightTargets:[g.viewmodelKey,g.viewmodelRim].map(l=>({name:l.name,cameraRelative:l.target.parent===g.weaponRig})),sky:{legacyVisible:w.root.getObjectByName('CoastalSky')?.visible,graphicVisible:w.graphicSky.root.visible,material:w.graphicSky.root.material.type,fog:w.graphicSky.root.material.fog}};
 });
 assert.equal(report.resources.district.enterable.length,94);assert.equal(report.resources.district.practicals.lightCount,Number(iteration)>=10?6:5);assert.equal(report.resources.forest.placements,378);
 report.resources.staticDetails=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.staticDetails?.diagnostics);
 if(!roomOnly){
 await pose(219,62,196,46,.02);await capture('06-downtown');
 await pose(218,346,232,362,-.12);await capture('06-river');
 await pose(340,382,370,398,-.03);await capture('06-forest');
 await pose(344,310,334,287,.03);await capture('06-cottages');
 // A matched street pose makes the aggressive palette/foreground change
 // directly inspectable beside the earlier actual-game capture.
 await pose(206,56,170,56,-.025);await capture('06-street');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q.run.ownedWeapons=[0,1,2,3,4,5,6,7];});await page.keyboard.press('5');await page.evaluate(()=>window.advanceTime(150));await settle();
 report.fireBefore=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.shotSequence||0);
 // This controlled engine shot verifies rendering without acquiring native
 // mouse capture. It is explicitly not a real mouse-input acceptance check.
 report.fireInput={scope:'Deterministic engine shoot() call; no native mouse capture or real mouse firing claim.'};
 await page.evaluate(async()=>{const {shoot}=await import('/engine.js');const q=window.__DEAD_ARRIVAL__;q.run.cooldowns[q.run.weapon]=0;if(!shoot(q.run))throw new Error('Controlled rifle shot rejected');window.advanceTime(8);});
 await settle();await capture('06-rifle-fire');
 report.fireAfter=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.shotSequence||0);assert.ok(report.fireAfter>report.fireBefore);
 await page.evaluate(()=>window.advanceTime(700));await settle();await capture('06-rifle');
 await page.keyboard.press('1');await page.evaluate(()=>window.advanceTime(700));await settle();
 }
 const walkTo=async target=>{
  await page.keyboard.down('w');
  let result;
  try{result=await page.evaluate(async target=>{const q=window.__DEAD_ARRIVAL__,r=q.run,g=q.renderer,{actorGroundAt}=await import('/coastal-structures.js'),draw=g.render;let frames=0,reached=false;g.render=()=>{};
   try{for(;frames<1800;frames++){const d=Math.hypot(target.x-r.x,target.y-r.y);if(d<.027&&Math.abs(actorGroundAt(r.course,r)-target.z)<.06){reached=true;break;}r.angle=Math.atan2(target.y-r.y,target.x-r.x);window.advanceTime(1000/120);}}
   finally{g.render=draw;window.advanceTime(0);}
   return{target,frames,reached,x:r.x,y:r.y,feet:actorGroundAt(r.course,r)+r.z,supportId:r.supportId,structureId:r.structureId,activeInterior:r.course.activeInterior??null,screen:q.screen};},target);}
  finally{await page.keyboard.up('w');}
  assert.equal(result.reached,true,`W route stopped: ${JSON.stringify(result)}`);assert.equal(result.activeInterior,null);assert.equal(result.screen,'play');return result;
 };
 // This one address has supported detail and a useful discovery. Only the
 // starting pose/empty pack are controlled; collection below uses actual W.
 const cottage=await page.evaluate(()=>{const c=window.__DEAD_ARRIVAL__.run.course;return{building:c.coastal.blackwaterSlice.buildings.find(p=>p.label==='CAPE LODGE 75'),cache:c.scavengerPickups.find(p=>p.discoveryLabel)};});
 assert.ok(cottage.cache);await pose(158,244.4,cottage.cache.x*4,cottage.cache.y*4,-.02);
 await page.evaluate(id=>{const q=window.__DEAD_ARRIVAL__;q.run.backpack.scrap=0;q.run.backpack.collected=q.run.backpack.collected.filter(p=>p!==id);window.advanceTime(16);},cottage.cache.id);
 await capture('06-cottage-discovery-before');
 report.discovery={scope:'Controlled starting pose and empty pack; actual W collects the supported repair case.',cache:cottage.cache,before:await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return{scrap:q.run.backpack.scrap,collected:[...q.run.backpack.collected],count:q.renderer._scavengerCaches.meshes[0].count};})};
 assert.equal(report.discovery.before.scrap,0);assert.ok(!report.discovery.before.collected.includes(cottage.cache.id));
 // Follow the real hall around the new open railing; a diagonal through a post is correctly blocked.
 report.discovery.steps=[await walkTo({x:158/4,y:cottage.cache.approach.y,z:.05}),await walkTo({...cottage.cache.approach,z:.05})];await settle();
 report.discovery.after=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return{scrap:q.run.backpack.scrap,collected:[...q.run.backpack.collected],x:q.run.x*4,z:q.run.y*4,count:q.renderer._scavengerCaches.meshes[0].count,screen:q.screen};});
 assert.equal(report.discovery.after.scrap,4);assert.ok(report.discovery.after.collected.includes(cottage.cache.id));assert.equal(report.discovery.after.count,report.discovery.before.count-1);assert.equal(report.discovery.after.screen,'play');await capture('06-cottage-discovery-after');
 // One initial outside pose; every subsequent floor/room transition uses the
 // real held W intent and 120Hz game tick. Aim changes are the only steering.
 const stairPath=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.coastal.structures.find(s=>s.id==='coast-lot-4-0-0-0').stairPath);
 report.stairJourney={scope:'Controlled outside start and temporarily empty enemy cohort; actual held W, aim-only steering, manual120Hz game advancement. Rendering is deferred between waypoint captures; coordinates and floors are never reassigned during the journey.',ascent:[],descent:[]};
 await pose(158,237,158,245,0);
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q._qaStairEnemies=q.run.course.enemies;q._qaStairWave=q.run.waveDelay;q.run.course.enemies=[];q.run.waveDelay=999;});
 const aim=async(x,z,pitch=0)=>{await page.evaluate(({x,z,pitch})=>{const q=window.__DEAD_ARRIVAL__;q.run.angle=Math.atan2(z-q.run.y*4,x-q.run.x*4);q.run.pitch=pitch;window.advanceTime(0);},{x,z,pitch});await settle();};
 report.stairJourney.ascent.push(await walkTo({x:158/4,y:241.6/4,z:.05}));
 for(const [index,point]of stairPath.entries()){
  report.stairJourney.ascent.push(await walkTo(point));
  if(index===0){await aim(160.88,247,-.08);await capture('06-stairs-entry');}
  if(index===10){await aim(162.58,245.8,.14);await capture('06-stairs-turn');}
  if(index===19){await aim(160.88,246.2,-.42);await capture('06-stairs-down');}
 }
 assert.ok(report.stairJourney.ascent.at(-1).feet>.65);
 await aim(155.4,251.6,-.08);await capture('06-upstairs-landing-room');
 report.stairJourney.ascent.push(await walkTo({x:158/4,y:252.5/4,z:.661875}));
 await aim(154.3,254.15,-.12);await capture('06-upstairs-bedroom');
 await aim(162.04,254.54,-.12);await capture('06-upstairs-writing-desk');
 if(Number(iteration)>=10){
  report.stairJourney.ascent.push(await walkTo({x:160.35/4,y:252.5/4,z:.661875}),await walkTo({x:160.35/4,y:253.7/4,z:.661875}));
  await aim(162.04,254.54,-.32);await capture('06-upstairs-listening-desk-close');
  report.upstairsLamp=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.blackwater.diagnostics.practicals.lights.find(l=>l.name.includes('upstairs listening')));
  assert.ok(report.upstairsLamp);assert.equal(report.upstairsLamp.castShadow,false);
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.harborWorld.root.getObjectByName('CAPE LODGE 75 upstairs listening task lamp').intensity=0;});await settle();await capture('06-upstairs-listening-desk-unlit');
  await page.evaluate(intensity=>{window.__DEAD_ARRIVAL__.renderer.harborWorld.root.getObjectByName('CAPE LODGE 75 upstairs listening task lamp').intensity=intensity;},report.upstairsLamp.intensity);await settle();await capture('06-upstairs-listening-desk-lit');
  if(!roomOnly){
  report.upstairsScene=await measure('upstairs-listening');
  await page.evaluate(()=>window.__HORROR_QA__.setManual(false));
  try{report.upstairsLiveFrames=await page.evaluate(async()=>{const frames=[];let last=await new Promise(requestAnimationFrame);for(let i=0;i<90;i++){const now=await new Promise(requestAnimationFrame);if(i>=10)frames.push(now-last);last=now;}frames.sort((a,b)=>a-b);const q=window.__DEAD_ARRIVAL__;return{scope:'Stationary upstairs with normal game loop and temporarily empty enemy cohort;80 RAF intervals after10 warmup frames. Not combat or phone performance.',samples:frames.length,medianMs:frames[40],p95Ms:frames[76],screen:q.screen,structureId:q.run.structureId};});}
  finally{await page.evaluate(()=>window.__HORROR_QA__.setManual(true));}
  assert.equal(report.upstairsLiveFrames.screen,'play');assert.equal(report.upstairsLiveFrames.structureId,'coast-lot-4-0-0-0');
  }
  if(Number(iteration)>=11){
   const folio=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.scavengerPickups.find(p=>p.visualKind==='route-folio'));
   assert.ok(folio);report.routeDiscovery={scope:'Same street-to-stairs journey; actual W reaches the desk, held Q claims the folio with a full fittings pack, then actual B/map-tab shows the existing forest destination.',folio,steps:[]};
   report.routeDiscovery.steps.push(await walkTo({x:160.35/4,y:252.5/4,z:folio.floorZ}),await walkTo({...folio.approach,z:folio.floorZ}));
   await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.backpack.scrap=12;window.advanceTime(16);});
   await aim(folio.x*4,folio.y*4,-.32);await capture('06-route-folio-before');
   const readRoute=()=>page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,p=q.renderer._scavengerCaches;return{scrap:q.run.backpack.scrap,collected:[...q.run.backpack.collected],destination:q.run.coastalDestination??null,cases:p.meshes[0].count,folios:p.folioMeshes[0].count,screen:q.screen};});
   report.routeDiscovery.before=await readRoute();assert.equal(report.routeDiscovery.before.folios,1);assert.ok(!report.routeDiscovery.before.collected.includes(folio.id));
   await page.keyboard.down('q');try{await page.evaluate(()=>window.advanceTime(16));}finally{await page.keyboard.up('q');}await settle();
   report.routeDiscovery.after=await readRoute();assert.equal(report.routeDiscovery.after.destination,'forest');assert.equal(report.routeDiscovery.after.scrap,12);
   assert.ok(report.routeDiscovery.after.collected.includes(folio.id));assert.equal(report.routeDiscovery.after.folios,0);assert.equal(report.routeDiscovery.after.cases,report.routeDiscovery.before.cases);
   assert.equal(report.routeDiscovery.after.screen,'play');await capture('06-route-folio-after');
   await page.keyboard.press('b');await page.locator('[data-pack-view="map"]').click();await settle();
   report.routeDiscovery.fieldMap={destination:await page.locator('.map-destination').innerText(),selected:await page.locator('[data-coast-destination="forest"]').getAttribute('aria-pressed')};
   assert.match(report.routeDiscovery.fieldMap.destination,/Cape Forest Footbridge/);assert.equal(report.routeDiscovery.fieldMap.selected,'true');await capture('06-route-field-map');
   await page.setViewportSize({width:390,height:844});await settle();await capture('06-route-field-map-mobile');
   report.routeDiscovery.mobileMapFits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert.equal(report.routeDiscovery.mobileMapFits,true);
   await page.setViewportSize({width:1280,height:800});await settle();
   await page.keyboard.press('b');await page.evaluate(()=>window.advanceTime(0));assert.equal((await readRoute()).screen,'play');
   // Walk around the chair to inspect the paper from an ordinary standing view.
   report.routeDiscovery.mapInspection={scope:'Same actual-W upstairs journey, chair-right corridor; ordinary first-person FOV (nominal75 degrees), weapon and task lamp unchanged.',steps:[]};
   report.routeDiscovery.mapInspection.steps.push(await walkTo({x:162.9/4,y:252.5/4,z:folio.floorZ}),await walkTo({x:162.9/4,y:253.7/4,z:folio.floorZ}));
   await aim(161.95,254.44,-.58);await capture('06-upstairs-map-near');
   if(process.env.CAPE_MAP_INK_DIAGNOSTIC==='1'){
    report.mapInkDiagnostic={scope:'Matched standing camera; only visible graphic silhouette meshes are temporarily hidden. Same lamp, paper, material, exposure and weapon.'};
    report.mapInkDiagnostic.hiddenMeshes=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,hidden=[];q.renderer.harborWorld.root.traverse(o=>{if(o.userData.graphicInk&&o.visible){hidden.push(o);o.visible=false;}});q._qaMapHiddenInk=hidden;return hidden.length;});
    assert.ok(report.mapInkDiagnostic.hiddenMeshes>0);
    try{await settle();await capture('06-upstairs-map-ink-off');}
    finally{await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;for(const o of q._qaMapHiddenInk||[])o.visible=true;delete q._qaMapHiddenInk;});await settle();}
   }
   if(roomOnly){await page.setViewportSize({width:390,height:844});await settle();await capture('06-upstairs-mobile-pack-full');await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.backpack.scrap=0;window.advanceTime(0);});await capture('06-upstairs-mobile-pack-empty');await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.backpack.scrap=12;window.advanceTime(0);});await page.setViewportSize({width:1280,height:800});await settle();}
   report.routeDiscovery.mapInspection.steps.push(await walkTo({x:162.9/4,y:252.5/4,z:folio.floorZ}));
   report.routeDiscovery.steps.push(await walkTo({x:160.35/4,y:252.5/4,z:folio.floorZ}),await walkTo({x:160.35/4,y:253.7/4,z:folio.floorZ}));
  }
  await aim(163.46,253.2,-.10);await capture('06-upstairs-window');
  report.stairJourney.ascent.push(await walkTo({x:160.35/4,y:252.5/4,z:.661875}),await walkTo({x:156.25/4,y:252.5/4,z:.661875}));
  await aim(154.3,253.85,-.35);await capture('06-upstairs-bed-close');
  report.stairJourney.ascent.push(await walkTo({x:158/4,y:252.5/4,z:.661875}));
 }
 report.stairJourney.descent.push(await walkTo(stairPath.at(-1)));
 for(const point of [...stairPath].reverse())report.stairJourney.descent.push(await walkTo(point));
 report.stairJourney.descent.push(await walkTo({x:158/4,y:241.6/4,z:.05}),await walkTo({x:158/4,y:237/4,z:0}));
 assert.ok(Math.abs(report.stairJourney.descent.at(-1).feet)<1e-6);await capture('06-stairs-exit');
 await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;q.run.course.enemies=q._qaStairEnemies;q.run.waveDelay=q._qaStairWave;delete q._qaStairEnemies;delete q._qaStairWave;});
 if(!roomOnly){
 await pose(158,249.0,161.7,252.0,-.10);await capture('06-cottage-bedroom');
 report.cottageShadow=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,g=q.renderer,w=g.harborWorld;w.blackwaterSun.shadow.updateMatrices(w.blackwaterSun);const p=g.camera.getWorldPosition(g._capePosition).applyMatrix4(w.blackwaterSun.shadow.matrix);return{...w.blackwaterShadowCoverage.diagnostics(),playerProjection:p.toArray()};});
 assert.ok(report.cottageShadow.playerProjection.every(v=>v>0&&v<1),'cottage player is inside the actual sunlight shadow projection');
 await pose(158,249.0,154.0,253.0,-.10);await capture('06-cottage-kitchen');
 await pose(158,247.4,162.0,243.0,-.08);await capture('06-cottage-radio');
 report.taskLamp=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.blackwater.diagnostics.practicals.lights.find(p=>p.name.includes('radio repair')));
 assert.ok(report.taskLamp);assert.equal(report.taskLamp.castShadow,false);
 await page.evaluate(()=>{const w=window.__DEAD_ARRIVAL__.renderer.harborWorld;w.root.getObjectByName('CAPE LODGE 75 radio repair task lamp').intensity=0;});await settle();await capture('06-cottage-radio-lamp-off');
 await page.evaluate(intensity=>{const w=window.__DEAD_ARRIVAL__.renderer.harborWorld;w.root.getObjectByName('CAPE LODGE 75 radio repair task lamp').intensity=intensity;},report.taskLamp.intensity);await settle();await capture('06-cottage-radio-lamp-on');
 await pose(158,247.4,154.0,243.0,-.08);await capture('06-cottage-living');
 await pose(160.5,250.7,162.1,253.1,-.32);await capture('06-cottage-bed-close');
 await pose(156.6,253.6,154.0,254.3,-.22);await capture('06-cottage-kitchen-close');
 await pose(160.25,245.0,162.05,243.2,-.22);await capture('06-cottage-radio-close');
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.harborWorld.root.getObjectByName('CAPE LODGE 75 radio repair task lamp').intensity=0;});await settle();await capture('06-cottage-radio-close-lamp-off');
 await page.evaluate(intensity=>{window.__DEAD_ARRIVAL__.renderer.harborWorld.root.getObjectByName('CAPE LODGE 75 radio repair task lamp').intensity=intensity;},report.taskLamp.intensity);await settle();await capture('06-cottage-radio-close-lamp-on');
 await pose(156,237,158,245,.01);await capture('06-cottage-exterior');
 for(const kind of ['apartment','clinic','workshop','warehouse','house']){
  const interior=await page.evaluate(async kind=>{const {interiorPurpose}=await import('/assets/blackwater-kit/furniture.js');return window.__DEAD_ARRIVAL__.run.course.coastal.blackwaterSlice.interiors.find(p=>interiorPurpose(p).id===(kind==='house'?'cape-cottage':kind));},kind);
  assert.ok(interior,`actual ${kind} interior`);
  const a=interior.route.frontApproach,b=interior.route.frontRoom;
  await pose(a.x,a.z,b.x,b.z,0);await page.keyboard.down('w');
  await page.evaluate(()=>{for(let i=0;i<12;i++)window.advanceTime(100);});await page.keyboard.up('w');await settle();
  const result=await page.evaluate(id=>{const q=window.__DEAD_ARRIVAL__,p=q.run.course.coastal.blackwaterSlice.interiors.find(p=>p.id===id);return{id,label:p.label,x:q.run.x*4,z:q.run.y*4,inside:Math.abs(q.run.x*4-p.x)<p.width/2&&Math.abs(q.run.y*4-p.z)<p.depth/2,screen:q.screen};},interior.id);
  report.routes.push(result);assert.equal(result.inside,true);assert.equal(result.screen,'play');await capture(`06-${kind}`);
 }
 // Walk the actual hill path across the wooden crossing; source authority
 // tests cover every187 aperture, while browser journeys cover archetypes.
 await pose(222,334,222,398,0);await page.keyboard.down('w');
 await page.evaluate(()=>{for(let i=0;i<84;i++)window.advanceTime(100);});await page.keyboard.up('w');await settle();
 report.bridgeWalk=await page.evaluate(async()=>{const q=window.__DEAD_ARRIVAL__,{groundAt}=await import('/coastal-terrain.js'),ground=groundAt(q.run.course,q.run.x,q.run.y)*4;return{x:q.run.x*4,z:q.run.y*4,ground,cameraY:q.renderer.cameraRig.position.y,relativeJump:q.run.z};});
 assert.ok(report.bridgeWalk.z>391);assert.ok(Math.abs(report.bridgeWalk.cameraY-report.bridgeWalk.ground-1.6)<.015);await capture('06-bridge-walk');
 await pose(206,56,182,56,0);
 report.threatSetup=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__,e=q.run.course.enemies.find(e=>e.resident&&!e.dead&&e.kind===0);if(!e)return null;Object.assign(e,{x:200/4,y:56/4,facing:0,attack:1,biteCooldown:20});window.advanceTime(16);return{scope:'Existing game resident placed six metres ahead for a fixed-view art check.',kind:e.kind};});
 assert.ok(report.threatSetup);await settle();await capture('06-threat');
 report.performance=[];
 await pose(219,62,196,46,0);await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.staticDetails.setEnabled(false));await settle();await capture('06-town-original-details');
 report.staticDetailsComparison={original:await measure('town-original-details')};
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.staticDetails.setEnabled(true));await settle();await capture('06-town-instanced-details');
 report.staticDetailsComparison.instanced=await measure('town-instanced-details');
 assert.ok(report.staticDetailsComparison.instanced.draws<report.staticDetailsComparison.original.draws,'native pooled details reduce fixed-view submissions');
 for(const [name,x,z,tx,tz] of [['town',219,62,196,46],['forest',340,382,370,398],['river',218,346,232,362]]){
  await pose(x,z,tx,tz,name==='river'?-.12:0);
  report.performance.push(await measure(name));
 }
 await pose(206,56,244,56,0);
 report.liveShadowWalk={scope:'Three seconds of normal live W input; exercises cached shadow recentering rather than manual simulation.',before:await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return{x:q.run.x*4,z:q.run.y*4,updates:q.renderer.harborWorld.blackwaterShadowCoverage.diagnostics().updates};})};
 await page.evaluate(()=>window.__HORROR_QA__.setManual(false));await page.keyboard.down('w');await page.waitForTimeout(3000);await page.keyboard.up('w');await page.evaluate(()=>window.__HORROR_QA__.setManual(true));await settle();
 report.liveShadowWalk.after=await page.evaluate(()=>{const q=window.__DEAD_ARRIVAL__;return{x:q.run.x*4,z:q.run.y*4,updates:q.renderer.harborWorld.blackwaterShadowCoverage.diagnostics().updates,screen:q.screen};});
 assert.ok(Math.hypot(report.liveShadowWalk.after.x-report.liveShadowWalk.before.x,report.liveShadowWalk.after.z-report.liveShadowWalk.before.z)>4);assert.ok(report.liveShadowWalk.after.updates>report.liveShadowWalk.before.updates);assert.equal(report.liveShadowWalk.after.screen,'play');await capture('06-live-shadow-walk');
 await page.setViewportSize({width:390,height:844});await pose(158,249,154,253,-.10);await capture('06-cottage-mobile');
 if(Number(iteration)>=11){const full=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.backpack.scrap);await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.backpack.scrap=0;window.advanceTime(0);});await capture('06-cottage-mobile-pack-empty');await page.evaluate(full=>{window.__DEAD_ARRIVAL__.run.backpack.scrap=full;window.advanceTime(0);},full);}
 await pose(218,346,232,362,-.12);await capture('06-river-mobile');report.mobileScrollFits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert.equal(report.mobileScrollFits,true);
 }else report.hardwarePerformance='Not measured: scoped native room verification; earlier V2 full-district measurements retained.';
 for(const file of captureFiles)assert.equal(createHash('sha256').update(await readFile(resolve(buildRoot,file))).digest('hex'),capturedHashes[file],`Capture build changed during QA: ${file}`);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log('Cape exploration passed');
}catch(error){report.failure=String(error.stack||error);if(page&&!page.isClosed()){
 report.deviceLoss=await page.evaluate(()=>window.__CAPE_QA_DEVICE_LOSS__??null).catch(()=>({unavailable:true}));
 report.finalInputSafety=await backgroundInputState(page).catch(()=>({unavailable:true}));
 }throw error;}
finally{process.removeListener('SIGINT',stopOwnedBrowser);await writeFile(`${output}/cape-report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
