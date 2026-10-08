import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL as fileURL} from 'node:url';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';

const root=resolve(process.env.SCAVENGE_QA_ROOT||'dist');
const output=resolve(process.env.SCAVENGE_QA_OUTPUT||'output/playwright/coastal-scavenging/before');
await mkdir(output,{recursive:true});
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
// Run the installed skill's unchanged action/capture/state helpers in this
// owned game journey. The main driver must support several inventory stages.
const clientPath='C:/Users/wolfk/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js';
let client=await readFile(clientPath,'utf8');
client=client.replace('import { chromium } from "playwright";','');
client=client.slice(0,client.indexOf('async function main()'));
client=client.replace('a: "KeyA",','a: "KeyA", w: "KeyW", q: "KeyQ", b: "KeyB",');
client+='\nexport {doChoreography,getCanvasHandle,captureScreenshot,ConsoleErrorTracker};\n';
const adapted=output+'/installed-skill-client.mjs';await writeFile(adapted,client);
const {doChoreography,getCanvasHandle,captureScreenshot,ConsoleErrorTracker}=await import(fileURL(adapted));
const files=['main.js','engine.js','renderer.js','coastal-scavenging.js','coastal-world-layout.js','harbor-navigation.js',
 'scavenger-pack.js','scavenger-pack-ui.js','scavenger-pack.css','game-interface.css','coastal-world-map.js','weapon-inventory.js',
 'dungeon-weapon-loot.js','assets/blackwater-kit/furniture.js','assets/blackwater-kit/practicals.js','assets/survivor/fps-arms-v3.glb'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={scope:'Desktop actual native game visuals and real W/Q/B/DOM inputs. Four unused startup preparations omitted, controlled starting/transit poses and initial health/scrap; enemies omitted only during this bounded scavenging journey. No mobile, full-startup or performance certification.',
 root,sourceHashes:Object.fromEntries(await Promise.all(files.map(async p=>[p,hash(await readFile(root+'/'+p))]))),
 views:[],walks:[],errors:[],warnings:[],httpErrors:[],inputSafety:[],ownedNodePid:process.pid};
const server=await startServer({root,port:0});let browser,page;
const persist=()=>writeFile(output+'/report.json',JSON.stringify(report,null,2));
try{
 browser=await chromium.launch({headless:true,handleSIGINT:false,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 page=await browser.newPage({viewport:{width:1280,height:800}});await guardBackgroundInput(page);
 const errors=new ConsoleErrorTracker();
 page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());errors.ingest({type:'console',text:m.text()});}else if(m.type()==='warning')report.warnings.push(m.text());});
 page.on('pageerror',e=>{report.errors.push(String(e));errors.ingest({type:'pageerror',text:String(e)});});
 page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
 await page.addInitScript(()=>{
  Object.defineProperty(window,'__DEAD_ARRIVAL__',{configurable:true,set(q){
   const g=q.renderer,c=q.run.course,seen=new WeakSet(),draw=g.render.bind(g),state=window.__SCAVENGE_QA_SCOPE__={skipped:[]};
   const first=c.scavengerPickups.find(p=>p.visualKind==='supply-case'&&p.contents.antiseptic===2);
   const door=c.coastal.blackwaterSlice.interiors.find(b=>b.id===first.roomId).route.frontApproach;
   g.render=(r,...args)=>{
    if(r.course===c&&!seen.has(r)){seen.add(r);Object.assign(r,{x:door.x/4,y:door.z/4,z:0,supportZ:null,supportId:null,structureId:null,angle:Math.PI/2,pitch:-.12,vx:0,vy:0,vz:0});}
    return draw(r,...args);
   };
   g.renderer.compilationConcurrency=1;
   for(const name of ['_prepareHarborInteriors','_prepareInteractionResources','_prepareCoastalEnemies'])g[name]=async()=>state.skipped.push(name);
   const compile=g._compilePreparedScene.bind(g);
   g._compilePreparedScene=async r=>{if(g._course?.coastal&&g._preparationStage==='Preparing the open coast'){state.skipped.push('forced whole-exterior precompile');return;}return compile(r);};
   Object.defineProperty(window,'__DEAD_ARRIVAL__',{value:q,writable:true,configurable:true});
  }});
 });
 await writeFile(output+'/owned-process.json',JSON.stringify({nodePid:process.pid,port:server.port,root}));
 const start=Date.now();await page.goto(`http://127.0.0.1:${server.port}/?debug=1&horrorqa=1`);
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});
 await page.locator('[data-action=start]').click({timeout:60000});console.log('Scavenging actual Start');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:240000});
 report.startMs=Date.now()-start;console.log('Scavenging ready',report.startMs);
 report.startupScope=await page.evaluate(()=>window.__SCAVENGE_QA_SCOPE__);
 await page.evaluate(()=>{
  window.__HORROR_QA__.setManual(true);const q=window.__DEAD_ARRIVAL__,g=q.renderer;
  const original=g.render.bind(g),advance=window.advanceTime;let explicit=false;
  // Prevent automatic main-loop renders from advancing a captured view after
  // the explicit game step. Retain production advanceTime/update ownership.
  g.render=(...args)=>{if(explicit)return original(...args);};
  window.advanceTime=ms=>{explicit=true;try{return advance(ms);}finally{explicit=false;}};
  q._qaEnemies=q.run.course.enemies;q.run.course.enemies=[];q.run.health=60;
  g.weaponPresentation.equipAge=100;window.advanceTime(0);
 });
 report.gpu=await page.evaluate(()=>{const b=window.__DEAD_ARRIVAL__.renderer.renderer.backend,i=b.adapter?.info??b.device?.adapterInfo;return{native:b.isWebGPUBackend,vendor:i?.vendor,architecture:i?.architecture,device:i?.device};});
 assert.equal(report.gpu.native,true);
 const canvas=await getCanvasHandle(page);
 const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 const settle=()=>page.evaluate(async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);await window.__DEAD_ARRIVAL__.renderer.renderer.backend.device.queue.onSubmittedWorkDone();});
 const capture=async name=>{
  await page.evaluate(()=>window.advanceTime(0));await settle();
  const guard=await backgroundInputState(page);report.inputSafety.push({name,...guard});
  assert.deepEqual(guard.attempts,{pointerLock:0,fullscreen:0,keyboardLock:0});assert.equal(guard.pointerLocked,false);
  await page.screenshot({path:output+'/'+name+'.png'});await writeFile(output+'/'+name+'.json',JSON.stringify(await state(),null,2));
  report.views.push(name);console.log('Captured',name);await persist();
 };
 const press=async key=>{await doChoreography(page,canvas,[{buttons:[key],frames:1},{buttons:[],frames:1}]);};
 const pose=async target=>{await page.evaluate(p=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:p.x,y:p.y,z:0,supportZ:null,supportId:null,structureId:null,vx:0,vy:0,vz:0,angle:p.angle??r.angle,pitch:-.22});window.advanceTime(0);},target);};
 const face=async p=>{
  const diagnostic=await page.evaluate(async p=>{const q=window.__DEAD_ARRIVAL__,r=q.run,g=q.renderer;r.angle=Math.atan2(p.y-r.y,p.x-r.x);r.pitch=-.27;window.advanceTime(0);
   const T=await import('/vendor/three.module.js');g.scene.updateMatrixWorld(true);const origin=g.camera.getWorldPosition(new T.Vector3()),target=new T.Vector3(p.x*4,(p.itemZ??.3)*4,p.y*4),ray=new T.Raycaster(origin,target.clone().sub(origin).normalize(),0,origin.distanceTo(target)+.1);
   const visible=o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};return{id:p.id,eye:origin.toArray(),target:target.toArray(),hits:ray.intersectObjects(g.worldRoot.children,true).filter(h=>visible(h.object)).slice(0,5).map(h=>{let find=null;for(let a=h.object;a;a=a.parent)if(a.name.startsWith('StowedWeapon_'))find=a.name;return{name:h.object.name,parent:h.object.parent?.name,find,distance:h.distance,point:h.point.toArray()};})};},p);
  (report.sightlines??=[]).push(diagnostic);
  if(p.displayKind==='stowed')assert.equal(diagnostic.hits[0]?.find,'StowedWeapon_'+p.id,'Rifle must be visible from its routed approach');
 };
 const walk=async points=>{
  for(const p of points){await page.keyboard.down('w');let result;
   try{result=await page.evaluate(p=>{const q=window.__DEAD_ARRIVAL__,r=q.run,g=q.renderer,draw=g.render;g.render=()=>{};let n=0;
    try{for(;n<1600;n++){if(Math.hypot(p.x-r.x,p.y-r.y)<.022)break;r.angle=Math.atan2(p.y-r.y,p.x-r.x);window.advanceTime(1000/120);}}
    finally{g.render=draw;window.advanceTime(0);}return{target:p,actual:{x:r.x,y:r.y},frames:n,reached:Math.hypot(p.x-r.x,p.y-r.y)<.025};},p);}
   finally{await page.keyboard.up('w');}report.walks.push(result);assert.equal(result.reached,true,JSON.stringify(result));
  }
 };
 const targetRoute=async destination=>page.evaluate(async destination=>{const q=window.__DEAD_ARRIVAL__;if(typeof destination==='object'){q.run.course.coastal.landmarks=q.run.course.coastal.landmarks.filter(p=>p.id!==destination.id);q.run.course.coastal.landmarks.push(destination);destination=destination.id;}q.run.coastalDestination=destination;const m=await import('/harbor-navigation.js');return m.harborNavigation(q.run)?.points;},destination);
 const medical=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.scavengerPickups.find(p=>p.visualKind==='supply-case'&&p.contents.antiseptic===2));
 await capture('01-clinic-entrance');await walk(await targetRoute('medical-supplies'));await face(medical);await capture('02-medical-case-before');
 assert.equal(await page.locator('.pack-world-hint').isVisible(),true,'Search hint remains visible at the case');
 await press('q');report.medicalPickup=(await state()).backpack;assert.ok(report.medicalPickup.collected.includes(medical.id));
 await capture('03-medical-case-searched');await press('b');await page.locator('.pack-overlay').waitFor({state:'visible'});await capture('04-pouch-materials');
 const pouchLayout=await page.evaluate(()=>{const contents=document.querySelector('.pack-content'),pouch=document.querySelector('.pack-supplies'),a=contents.getBoundingClientRect(),b=pouch.getBoundingClientRect();return{scrollTop:contents.scrollTop,top:b.top,bottom:b.bottom,viewportTop:a.top,viewportBottom:a.bottom};});
 assert.equal(pouchLayout.scrollTop,0);assert.ok(pouchLayout.top>=pouchLayout.viewportTop&&pouchLayout.bottom<=pouchLayout.viewportBottom);report.pouchLayout=pouchLayout;
 await page.locator('[data-pack-bench-route]').click();const benchTarget=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.coastalDestination);
 await capture('05-workshop-map');assert.equal(await page.locator('.pack-content').evaluate(e=>e.scrollTop),0);await press('b');
 // Transit between inspection stops is controlled; each room entrance and
 // final approach below uses real W input with no coordinate writes.
 const workshop=await page.evaluate(id=>{const c=window.__DEAD_ARRIVAL__.run.course,s=c.coastal.workbenches.find(s=>'bench-'+s.id===id),b=c.coastal.blackwaterSlice.interiors.find(b=>b.id===s.buildingId);return{station:s,door:{x:b.route.frontApproach.x/4,y:b.route.frontApproach.z/4},case:c.scavengerPickups.find(p=>p.roomId===s.buildingId&&p.visualKind==='supply-case')};},benchTarget);
 await pose(workshop.door);await walk(await targetRoute(benchTarget));await face(workshop.station);await capture('06-workbench');
 if(workshop.case){await walk(await targetRoute({id:'qa-case',name:'Workshop supplies',...workshop.case.approach}));await face(workshop.case);await capture('07-workshop-case-before');await press('q');assert.ok((await state()).backpack.collected.includes(workshop.case.id));await walk(await targetRoute(benchTarget));await face(workshop.station);}
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.backpack.scrap=8;window.advanceTime(0);});report.controlledInputs={health:60,scrap:8,reason:'UI fitting/healing transaction states; cloth and antiseptic came from actual Q searches.'};
 await press('b');await page.locator('[data-pack-view=gear]').click();await capture('08-workshop-equipment');
 await page.locator('[data-pack-craft]').click();assert.equal((await state()).backpack.supplies.bandage,1);await capture('09-bandage-crafted');
 await page.locator('[data-pack-heal]').click();assert.equal((await state()).player.health,95);assert.equal((await state()).backpack.supplies.bandage,0);await capture('10-bandage-used');
 await page.locator('.pack-upgrade').click();assert.equal((await state()).backpack.scrap,0);assert.equal((await state()).backpack.weaponMods[0],'hardened-fitting');await page.locator('.pack-fitting').scrollIntoViewIfNeeded();await capture('11-weapon-fitted');await press('b');
 for(const id of ['coast-weapon-works','coast-weapon-lighthouse']){
  const data=await page.evaluate(id=>{const c=window.__DEAD_ARRIVAL__.run.course,p=c.weaponPickups.find(p=>p.id===id),b=c.coastal.blackwaterSlice.interiors.find(b=>b.id===p.roomId);return{item:p,door:{x:b.route.frontApproach.x/4,y:b.route.frontApproach.z/4}};},id);
  await pose(data.door);await walk(await targetRoute('find-'+id));await face(data.item);await capture(id+'-stowed');
  const beforeStash=(await state()).backpack;
  assert.ok(!beforeStash.weaponPickups.includes(id));await press('q');const afterStash=(await state()).backpack;assert.ok(afterStash.weaponPickups.includes(id));assert.equal((await state()).player.weapon,0);
  assert.deepEqual(afterStash.collected,beforeStash.collected,'One Q cannot also search a nearby case');assert.deepEqual(afterStash.supplies,beforeStash.supplies);
  await capture(id+'-taken');
 }
 await press('b');await page.locator('[data-pack-view=gear]').click();await page.locator('[data-pack-weapon="4"]').click();await page.locator('.pack-equip').click();assert.equal((await state()).player.weapon,4);await capture('12-rifle-backpack');await press('b');await capture('13-rifle-equipped');
 await captureScreenshot(page,canvas,output+'/skill-client-shot.png');await writeFile(output+'/skill-client-state.json',JSON.stringify(await state(),null,2));
 report.skillClient={source:clientPath,hash:hash(await readFile(clientPath)),helpers:'Installed doChoreography, getCanvasHandle, captureScreenshot and state capture; actual Q/B action bursts.'};
 assert.equal(report.errors.length,0);assert.equal(report.httpErrors.length,0);
 for(const [p,h]of Object.entries(report.sourceHashes))assert.equal(hash(await readFile(root+'/'+p)),h,'Snapshot changed '+p);
 report.passed=true;console.log('Coastal scavenging desktop QA passed');
}catch(e){report.passed=false;report.failure=String(e.stack||e);if(page&&!page.isClosed())await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw e;}
finally{await browser?.close();await new Promise((ok,bad)=>server.server.close(e=>e?bad(e):ok()));report.cleanup={browserClosed:true,ownedServerClosed:!server.server.listening};await persist();}
