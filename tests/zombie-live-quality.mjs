import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startPeerBroker} from './peerjs-broker-fixture.mjs';
import {startServer} from '../server.mjs';
import path from 'node:path';

// Isolated production preview. Signaling is local; gameplay uses real WebRTC.
const pwPath=process.env.PLAYWRIGHT_PATH||'playwright';
const {chromium}=createRequire(import.meta.url)(pwPath);
const out='output/playwright/zombie-live-quality';await mkdir(out,{recursive:true});
const server=await startServer({root:path.resolve('dist'),host:'127.0.0.1',port:0});
const broker=await startPeerBroker(pwPath);
const url=`http://127.0.0.1:${server.port}/`;
const report={date:new Date().toISOString(),status:'RUNNING',url,viewport:{width:1280,height:720},dpr:1,errors:[],performance:[],coop:[],liveP2PTested:false,physicalControllerTested:false};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=WebRtcHideLocalIpsWithMdns']});
const browsers=[browser];
const bounded=(promise,ms=5000)=>Promise.race([promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Diagnostic timed out')),ms);timer.unref();})]);
async function page(campaign=false){
 const owner=campaign?await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--disable-features=WebRtcHideLocalIpsWithMdns']}):browser;if(owner!==browser)browsers.push(owner);
 const context=await owner.newContext({viewport:report.viewport,deviceScaleFactor:1});
 await context.addInitScript(port=>{window.__DEAD_ARRIVAL_PEER_CONFIG__={host:'127.0.0.1',port,path:'/',secure:false,config:{iceServers:[]}};},broker.port);
 const p=await context.newPage();p.setDefaultTimeout(180000);
 p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 p.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await p.goto(url+'?debug=1'+(campaign?'&campaign=1':''),{waitUntil:'networkidle'});
 await p.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._ashWitnessAsset&&window.__DEAD_ARRIVAL__.renderer._survivors?.status==='ready');
 // Each headless context remains visible. Freeze only the title cinematic
 // while another client initializes; gameplay rendering is always restored.
 await p.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.renderer;window.__menuRender=r.renderMenu;r.renderMenu=()=>{};});
 return p;
}
async function ready(p){await p.waitForFunction(()=>{const r=window.__DEAD_ARRIVAL__?.renderer;return r?._weaponsPrepared&&r.brutalCombatVisuals.bodySpear.status==='ready'&&r.diagnostics().zombieAppearances.filter(x=>x.status==='ready').length===3;});await p.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._warmupPromise);}
async function quiet(p){await p.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.run;r.health=10000;r.waveDelay=10000;if(r.director){r.director.queue=[];r.director.pending=0;r.director.state='combat';}r.spawnTelegraphs=[];r.course.enemies=[];});}
async function profile(p,name,ms=4000){
 const data=await p.evaluate(async({name,ms})=>{
  const d=window.__DEAD_ARRIVAL__,r=d.renderer,stages={},restore=[];let frameCost=0;
  const wrap=(object,key,label)=>{if(!object?.[key])return;const original=object[key];object[key]=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{const elapsed=performance.now()-t;if(label==='render')frameCost=elapsed;(stages[label]??=[]).push(elapsed);}};restore.push(()=>object[key]=original);};
  wrap(r,'render','render');wrap(r,'_updateEnemies','animation');wrap(r.brutalCombatVisuals,'update','brutal');wrap(r.brutalCombatVisuals.bodySpear,'frame','surface-fit');
  for(const key of ['pose','bindActor','placeWound','attachWound'])wrap(r.brutalCombatVisuals,key,key);
  for(const key of ['update','sync','ensureRagdoll','syncCourseWalls'])wrap(r.brutalCombatVisuals.physics,key,'physics-'+key);
  wrap(r.brutalCombatVisuals.anatomy,'capturePoses','body-capsules');wrap(r.brutalCombatVisuals.chest,'dropWeapon','drop-weapon');
  const longs=[],observer=new PerformanceObserver(list=>longs.push(...list.getEntries().map(e=>e.duration)));observer.observe({entryTypes:['longtask']});
  const intervals=[],cpu=[],start=performance.now();let previous=start;
  try{await new Promise(resolve=>{function sample(t){intervals.push(t-previous);previous=t;cpu.push(frameCost);if(t-start>=ms)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});}
  finally{for(const undo of restore.reverse())undo();observer.disconnect();}
  const stats=a=>{const b=a.slice().sort((a,b)=>a-b);return{samples:b.length,medianMs:b[Math.floor(b.length*.5)]||0,p95Ms:b[Math.floor(b.length*.95)]||0,maxMs:b.at(-1)||0,meanMs:a.reduce((s,n)=>s+n,0)/(a.length||1)};};
  const info=r.renderer.info,device=r.renderer.backend.device?.adapterInfo;
  return{name,seconds:(performance.now()-start)/1000,interval:stats(intervals.slice(1)),cpu:stats(cpu.slice(1)),stages:Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,stats(v)])),longTasks:stats(longs),backend:r.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL',adapter:device?{vendor:device.vendor,architecture:device.architecture,device:device.device,description:device.description}:null,render:{...info.render},memory:{...info.memory},physics:r.brutalCombatVisuals.physics.diagnostics(),enemyCount:d.run.course.enemies.length};
 },{name,ms});report.performance.push(data);console.log('PROFILE',name,JSON.stringify({interval:data.interval,cpu:data.cpu,stages:data.stages}));return data;
}
async function fixture(host,guest,appearance,actor){
 const point=await host.evaluate(async({appearance,actor})=>{
  const d=window.__DEAD_ARRIVAL__,r=d.run,{castRay,canStand}=await import('./engine.js');let point;
  for(let y=2;y<11&&!point;y+=.5)for(let x=2;x<11&&!point;x+=.5)if(canStand(r.course,x,y,.2)&&canStand(r.course,x,y-.22,.2)&&canStand(r.course,x-.8,y,.2)&&castRay(r.course,x,y,-Math.PI/2,1).dist>.9)point={x,y};
  if(!point)throw Error('No clear interaction lane');
  for(const [id,p] of [['host',r],['peer',r.peer]])if(p)Object.assign(p,{x:point.x+(id===actor?0:-.8),y:point.y,z:0,vx:0,vy:0,vz:0,angle:-Math.PI/2,pitch:0,health:10000,energy:100,weapon:4,cooldowns:Array(8).fill(0),extraction:{phase:'idle'},bite:{phase:'idle',sequence:0,cooldown:100},brutal:{phase:'idle',sequence:p.brutal?.sequence||0},playerWounds:{leftArm:'intact',rightArm:'intact',leftLeg:'intact',rightLeg:'intact',neck:0,torso:0,eviscerated:false}});
  r.waveDelay=10000;r.course.enemies=[{id:r.nextId++,kind:0,variant:appearance==='crooked-crawler'?'skitter':'stalker',locomotion:appearance==='crooked-crawler'?'crawler':appearance==='fever-runner'?'runner':'shambler',appearance,x:point.x,y:point.y-.22,z:0,hp:15,maxHp:30,dead:false,flash:0,attack:100,phase:0,biteCooldown:100,stagger:100,facing:Math.PI/2}];
  return{...point,id:r.course.enemies[0].id,actor};
 },{appearance,actor});
 if(guest){await guest.evaluate(p=>{const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:p.x+(p.actor==='peer'?0:-.8),y:p.y,angle:-Math.PI/2,pitch:0,weapon:4});},point);try{await guest.waitForFunction(id=>window.__DEAD_ARRIVAL__.run.course.enemies[0]?.id===id,point.id,{timeout:30000});}catch(e){console.log('Snapshot delivery diagnostics',JSON.stringify(await Promise.all([host,guest].map(p=>p.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;return{screen:d.screen,run:{mode:d.run.mode,time:d.run.time,x:d.run.x,y:d.run.y,peer:d.run.peer,enemies:d.run.course.enemies},messages:window.__zombieMessages?.slice(-2),transport:window.__zombieTransport,snapshot:d.snapshot()};})))));throw e;}}
 return point;
}
const state=p=>p.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.run,e=r.course.enemies[0],v=d.renderer.brutalCombatVisuals,root=d.renderer._enemyVisuals.get(e?.id)?.root,s=v.actors.get(root);return{playerId:r.playerId,brutal:r.brutal,peerBrutal:r.peer?.brutal,enemy:e&&{id:e.id,hp:e.hp,dead:e.dead,wound:e.brutalWound,heartRemoved:e.heartRemoved},source:root?.userData.afterlife?.appearance,anatomyVisible:!!s?.attachments.visible,spearOpen:s?.uniforms.uSpearOpen.value,connected:d.session?.connected,transport:d.session?._connection?.dataChannel?.readyState};});
try{
 let host=await page(process.argv.includes('--coop-only'));
 if(!process.argv.includes('--coop-only')){await host.locator('[data-action="start"]').click();await ready(host);await quiet(host);}console.log('Production preview ready');
 report.device=await host.evaluate(async()=>{const a=await navigator.gpu.requestAdapter();return{userAgent:navigator.userAgent,adapter:{vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description}};});
 if(!process.argv.includes('--coop-only')){
 await profile(host,'ordinary-scene');
 await host.evaluate(async()=>{const d=window.__DEAD_ARRIVAL__,r=d.run,{castRay}=await import('./engine.js');const a=Array.from({length:24},(_,i)=>i*Math.PI/12).sort((a,b)=>castRay(r.course,r.x,r.y,b,8).dist-castRay(r.course,r.x,r.y,a,8).dist)[0];r.angle=a;r.course.enemies=['ash-witness','drowned-dockworker','fever-runner','crooked-crawler'].map((appearance,i)=>({id:r.nextId++,kind:0,variant:i===3?'skitter':'stalker',locomotion:i===3?'crawler':i===2?'runner':'shambler',appearance,x:r.x+Math.cos(a)*(1+i*.15),y:r.y+Math.sin(a)*(1+i*.15),hp:30,maxHp:30,dead:false,attack:100,phase:0,biteCooldown:100}));});
 await host.waitForTimeout(3000);await profile(host,'four-zombies-active');
 await quiet(host);await fixture(host,null,'ash-witness','host');
 const cold=profile(host,'first-spear',2500);await host.keyboard.press('v');await cold;
 await host.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.brutal.phase==='idle');
 await fixture(host,null,'ash-witness','host');const warm=profile(host,'second-spear',2500);await host.keyboard.press('v');await warm;
 }
 if(process.argv.includes('--profile-only')){assert.deepEqual(report.errors,[]);report.status='PROFILED';process.exitCode=0;}else{
 // Fresh campaign contexts keep the harbor profile's large GPU world out of
 // the two-client parity test. Both use the actual public room-code lobby.
 if(!process.argv.includes('--coop-only')){await host.context().close();host=await page(true);}
 const guest=await page(true);
 for(const p of [host,guest]){await p.locator('[data-action="start"]').click();await ready(p);await p.keyboard.press('Escape');await p.locator('[data-action="menu"]').click();}console.log('Both campaign clients prepared before rendezvous');
 // Two native draw loops can saturate this single GPU during connection.
 // The production game loop, input, host simulation and data channel stay
 // active. Warm loading may render; gameplay visuals are inspected in turn.
 for(const p of [host,guest])await p.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.renderer;window.__gameRender=r.render;window.__drawGame=false;r.render=function(...args){if(window.__drawGame||this._beginPending||this._preparedCourse!==d.run.course)return window.__gameRender.apply(this,args);};});
 report.sequentialNativeVisualChecks=true;
 await host.locator('[data-action="coop-toggle"]').click();await host.locator('[data-action="host"]').click();await host.waitForFunction(()=>document.querySelector('[name="roomCode"]')?.value.length===6);
 const code=await host.locator('[name="roomCode"]').inputValue();
 await guest.locator('[data-action="coop-toggle"]').click();await guest.locator('[name="joinCode"]').fill(code);await guest.locator('[data-action="join"]').click();
 await Promise.all([host,guest].map(p=>p.waitForFunction(()=>window.__DEAD_ARRIVAL__.session?.connected&&window.__DEAD_ARRIVAL__.screen==='play')));
 await Promise.all([host,guest].map(p=>p.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.renderMenu=window.__menuRender;})));report.titleCinematicsFrozenDuringRendezvous=true;
 await Promise.all([ready(host),ready(guest)]);await quiet(host);console.log('Live room-code WebRTC connected');
 for(const p of [host,guest])await p.evaluate(()=>{const s=window.__DEAD_ARRIVAL__.session,original=s._onMessage,send=s.send,status=s._onStatus;window.__zombieMessages=[];window.__zombieTransport={sent:0,rejected:0,statuses:[]};s.send=function(m){const ok=send.call(this,m);window.__zombieTransport.sent++;if(!ok)window.__zombieTransport.rejected++;return ok;};s._onStatus=function(type,...args){if(type!=='rtt')window.__zombieTransport.statuses.push({type,args});return status.call(this,type,...args);};s._onMessage=function(m,...args){if(m.s){const e=m.s.enemies?.[0];window.__zombieMessages.push({seq:m.s.seq,host:m.s.host.brutal,peer:m.s.guest.brutal,enemy:e&&{id:e.id,hp:e.hp,dead:e.dead,wound:e.brutalWound,heartRemoved:e.heartRemoved}});}return original.call(this,m,...args);};});
 for(const [appearance,actor] of [['ash-witness','host'],['drowned-dockworker','peer'],['fever-runner','peer'],['crooked-crawler','peer']]){
  await fixture(host,guest,appearance,actor);await guest.waitForTimeout(300);
  const before=await state(host);assert.equal(before.enemy.hp,15);assert.equal(before.enemy.dead,false);
  await (actor==='host'?host:guest).keyboard.press('v');
  await host.waitForFunction(actor=>{const r=window.__DEAD_ARRIVAL__.run;return(actor==='host'?r:r.peer).brutal.phase!=='idle';},actor);
  await guest.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0]?.heartRemoved===true);
  for(const p of [host,guest]){await p.evaluate(()=>window.__drawGame=true);await p.waitForFunction(()=>[...window.__DEAD_ARRIVAL__.renderer.brutalCombatVisuals.actors.values()].some(s=>s.wound?.type==='pierce'&&s.uniforms.uSpearOpen.value===1));await p.evaluate(()=>window.__drawGame=false);}
  const h=await state(host),g=await state(guest);assert.deepEqual(g.enemy,h.enemy);assert.equal(h.source,appearance);assert.equal(g.source,appearance);assert.equal(h.spearOpen,1);assert.equal(g.spearOpen,1);
  await guest.evaluate(()=>window.__drawGame=true);await guest.screenshot({path:`${out}/${appearance}-live-guest.png`});await guest.evaluate(()=>window.__drawGame=false);
  await host.waitForFunction(actor=>{const r=window.__DEAD_ARRIVAL__.run;return(actor==='host'?r:r.peer).brutal.phase==='idle';},actor);
  const messages=await guest.evaluate(id=>window.__zombieMessages.filter(m=>m.enemy?.id===id),h.enemy.id);
  assert.ok(messages.some(m=>m.enemy.hp===15&&!m.enemy.dead));assert.ok(messages.some(m=>m.enemy.dead&&m.enemy.wound?.type==='pierce'));assert.ok(messages.some(m=>m.enemy.heartRemoved));
  report.coop.push({appearance,actor,host:h,guest:g,snapshots:messages});console.log('Live parity passed',appearance,actor);
 }
 report.liveP2PTested=true;report.signaling={...broker.counts};assert.deepEqual(report.errors,[]);report.status='PASS';
 }
}catch(e){report.status='FAIL';report.failure=e.stack;report.failureStates=await Promise.all(browsers.flatMap(b=>b.contexts()).flatMap(c=>c.pages()).map(p=>bounded(p.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,pc=d?.session?._connection?.peerConnection;return{screen:d?.screen,mode:d?.run.mode,session:d?.session&&{role:d.session.role,connected:d.session.connected},ui:document.body.innerText.slice(0,1000),messages:window.__zombieMessages?.slice(-2),transport:window.__zombieTransport,rtc:pc&&{connection:pc.connectionState,ice:pc.iceConnectionState}};})).catch(e=>({failure:e.message}))));console.log('Failure states',JSON.stringify(report.failureStates));process.exitCode=1;}
finally{report.signaling={...broker.counts};await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await bounded(Promise.all(browsers.map(b=>b.close())),10000).catch(()=>{});await broker.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
