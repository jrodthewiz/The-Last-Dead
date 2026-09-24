import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=(process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/dist/').replace(/\/?$/,'/');
const out=process.env.MELEE_QA_OUTPUT||'docs/melee-pass/verification/input-coop';
await mkdir(out,{recursive:true});
const report={url:base,checks:{},errors:[],samples:[]};
const pages=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const inspect=page=>{
 pages.push(page);
 page.setDefaultTimeout(30000);
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
};
const ready=page=>page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,undefined,{timeout:90000});
const state=page=>page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.run;return{screen:d.screen,weapon:r.weapon,health:r.health,mode:r.mode,saw:r.sawActive,rev:r.sawRev,sequence:r.meleeSequence,active:r.meleeActive,enemies:r.course.enemies.map(e=>({id:e.id,hp:e.hp,hits:e.hits,dead:e.dead})),audio:d.audio.meleeDiagnostics(),memory:{...d.renderer.renderer.info.memory}};});
async function touchControls(page){
 const cdp=await page.context().newCDPSession(page);
 return {
  async down(action){const b=await page.locator(`.touch-layer [data-action="${action}"]`).boundingBox();assert.ok(b);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});},
  async up(){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});},
  async cancel(){await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});},
 };
}
async function soloTarget(page,hp=100){await page.evaluate(hp=>{
 const r=window.__DEAD_ARRIVAL__.run;Object.assign(r,{x:19.5,y:24.2,z:0,vx:0,vy:0,angle:-Math.PI/2,pitch:-.08,health:100,waveDelay:999});
 r.course.enemies=[{id:98001,x:19.5,y:23.53,z:0,hp,maxHp:hp,kind:0,variant:'stalker',dead:false,flash:0,hits:0,attack:999,phase:0,moveSpeed:.000001}];
},hp);}
try{
 if(!process.argv.includes('--coop-only')){
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await mobile.newPage();inspect(page);
 await page.goto(base+'?debug=1&dungeon=2',{waitUntil:'domcontentloaded'});await ready(page);
 await page.locator('[data-action="start"]').tap();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 const touch=await touchControls(page),weapon=page.locator('.touch-layer [data-action="weapon"]');
 for(let i=0;i<6;i++)await weapon.tap();
 assert.equal((await state(page)).weapon,6);await soloTarget(page);
 await page.locator('.touch-layer [data-action="fire"]').tap();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits===1);
 await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.run.meleeActive);
 assert.equal((await state(page)).enemies[0].hp,93);report.checks.touchBat=true;
 await page.locator('.touch-layer [data-action="alt"]').tap();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits===2);
 assert.equal((await state(page)).enemies[0].hp,81);report.checks.touchHeavy=true;
 await weapon.tap();assert.equal((await state(page)).weapon,7);await soloTarget(page);
 const chainPhase=()=>page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.weaponGroups[7].userData.model.userData.melee.chainPhase);
 const idlePhase=await chainPhase();await page.waitForTimeout(160);assert.equal(await chainPhase(),idlePhase);
 await touch.down('fire');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits>=3);
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.audio.assetsLoaded);
 assert.equal((await state(page)).audio.motorSources,1);
 await touch.cancel();await page.waitForTimeout(420);
 const stopped=await state(page);assert.equal(stopped.saw,false);assert.equal(stopped.audio.motorSources,0);
 await page.waitForTimeout(200);assert.equal((await state(page)).enemies[0].hp,stopped.enemies[0].hp);
 const releasedPhase=await chainPhase();await page.waitForTimeout(160);assert.equal(await chainPhase(),releasedPhase);report.checks.stoppedChainIsStill=true;
 report.checks.touchCancelStopsSaw=true;
 await page.screenshot({path:out+'/touch-portrait.png'});
 await page.setViewportSize({width:844,height:390});await soloTarget(page);
 await touch.down('fire');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits>=2);await touch.up();
 await page.waitForTimeout(400);assert.equal((await state(page)).saw,false);
 const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,aspect:window.__DEAD_ARRIVAL__.renderer.camera.aspect,expected:innerWidth/innerHeight}));
 assert.equal(layout.overflow,false);assert.ok(Math.abs(layout.aspect-layout.expected)<.001);report.checks.touchLandscape=true;
 await page.screenshot({path:out+'/touch-landscape.png'});
 await weapon.tap();assert.equal((await state(page)).weapon,0);report.checks.touchWrap=true;
 console.log('Mobile touch, cancel and orientation checks passed.');
 await mobile.close();
 }

 // Real room-code rendezvous and RTCDataChannel; no snapshot/transport mocks.
 if(!process.argv.includes('--mobile-only')){
 const hostContext=await browser.newContext({viewport:{width:960,height:720},hasTouch:true,isMobile:true});
 const guestContext=await browser.newContext({viewport:{width:960,height:720},hasTouch:true,isMobile:true});
 const host=await hostContext.newPage(),guest=await guestContext.newPage();inspect(host);inspect(guest);
 await Promise.all([host.goto(base+'?debug=1',{waitUntil:'domcontentloaded'}),guest.goto(base+'?debug=1',{waitUntil:'domcontentloaded'})]);
 await Promise.all([ready(host),ready(guest)]);
 await host.locator('[data-action="coop-toggle"]').tap();await host.locator('[data-action="host"]').tap();
 await host.waitForFunction(()=>document.querySelector('[name="roomCode"]')?.value.length===6);
 const code=await host.locator('[name="roomCode"]').inputValue();
 await guest.locator('[data-action="coop-toggle"]').tap();await guest.locator('[name="joinCode"]').fill(code);await guest.locator('[data-action="join"]').tap();
 await Promise.all([host.waitForFunction(()=>window.__DEAD_ARRIVAL__.session?.connected),guest.waitForFunction(()=>window.__DEAD_ARRIVAL__.session?.connected)]);
 await guest.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 console.log('Two local clients connected through room code and RTCDataChannel.');
 for(const p of [host,guest])await p.evaluate(()=>{
  const a=window.__DEAD_ARRIVAL__.audio,play=a.play.bind(a);window.__meleeSounds=[];
  a.play=(name,...args)=>{if(['melee-hit','melee-wall','chainsaw-hit'].includes(name))window.__meleeSounds.push(name);return play(name,...args);};
  const s=window.__DEAD_ARRIVAL__.session,send=s.send.bind(s),receive=s._onMessage,status=s._onStatus;
  const summarize=m=>({type:m.t,seq:m.s?.seq,bytes:JSON.stringify(m).length,counts:m.s&&Object.fromEntries(['enemies','projectiles','coins','gore','blood','tracers','spawnTelegraphs','explosions'].map(k=>[k,m.s[k]?.length]))});
  window.__meleeTransport={statuses:[],sent:0,received:0,rejected:0,maxReceivedBytes:0};const log=window.__meleeTransport;
  s.send=m=>{const ok=send(m);log.sent++;if(!ok)log.rejected++;log.lastSent={...summarize(m),ok,buffered:s._connection?.dataChannel?.bufferedAmount};return ok;};
  s._onMessage=(m,...args)=>{log.received++;log.lastReceived=summarize(m);log.maxReceivedBytes=Math.max(log.maxReceivedBytes,log.lastReceived.bytes);if(m.t==='qa-large-probe')log.largeProbe=m.data;return receive(m,...args);};
  s._onStatus=(state,details)=>{if(state!=='rtt'){log.statuses.push({state,details});log.statuses=log.statuses.slice(-10);}return status(state,details);};
 });
 // A crowded combat snapshot must survive the old 16 KiB channel boundary.
 await host.evaluate(()=>window.__DEAD_ARRIVAL__.session.send({t:'qa-large-probe',data:'melee-chunk-'.repeat(4096)}));
 await guest.waitForFunction(()=>window.__meleeTransport.largeProbe==='melee-chunk-'.repeat(4096));
 await guest.evaluate(()=>delete window.__meleeTransport.largeProbe);report.checks.chunkedPayload=true;
 let targetId=99000;
 async function peerTarget(){targetId++;const point=await host.evaluate(async id=>{
  const {canStand,castRay}=await import('./engine.js');
  const r=window.__DEAD_ARRIVAL__.run;let point;
  for(let y=2;y<11&&!point;y+=.5)for(let x=2;x<11&&!point;x+=.5){
   if(canStand(r.course,x,y,.2)&&canStand(r.course,x,y-.67,.2)&&canStand(r.course,x-.8,y,.2)&&castRay(r.course,x,y,-Math.PI/2,1).dist>.9)point={x,y};
  }
  if(!point)throw new Error('No unobstructed co-op melee fixture');
  const {x,y}=point;Object.assign(r,{x:x-.8,y,health:100,waveDelay:999});
  Object.assign(r.peer,{x,y,z:0,vx:0,vy:0,angle:-Math.PI/2,pitch:0,health:100});
  if(r.director){r.director.queue=[];r.director.pending=0;r.director.state='combat';}
  r.course.enemies=[{id,x,y:y-.67,z:0,hp:100,maxHp:100,kind:0,variant:'stalker',dead:false,flash:0,hits:0,attack:999,phase:0,moveSpeed:.000001}];
  return point;
 },targetId);
 await guest.evaluate(point=>Object.assign(window.__DEAD_ARRIVAL__.run,{...point,z:0,vx:0,vy:0,angle:-Math.PI/2,pitch:0}),point);
 await guest.waitForFunction(id=>window.__DEAD_ARRIVAL__.run.course.enemies.some(e=>e.id===id),targetId);
 }
 const guestTouch=await touchControls(guest);
 await guest.keyboard.press('7');await peerTarget();
 await guest.locator('.touch-layer [data-action="fire"]').tap();
 await host.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits===1);
 await guest.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hp===93);
 await guest.waitForFunction(()=>window.__meleeSounds.includes('melee-hit'));
 await guest.waitForTimeout(900);
 assert.equal((await state(host)).enemies[0].hp,93,'one guest swing deals one authoritative hit');
 report.checks.coopBat=true;
 await peerTarget();
 await host.evaluate(()=>{
  const d=window.__DEAD_ARRIVAL__,p=d.run.peer,i={angle:p.angle,pitch:p.pitch,weapon:6,fire:true};
  // Ordered network delivery can batch a tap and its release before a frame.
  d.receive({t:'input',i});d.receive({t:'input',i:{...i,fire:false}});
 });
 await guest.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hp===93);
 await guest.waitForTimeout(850);assert.equal((await state(host)).enemies[0].hits,1);report.checks.coalescedTriggerTap=true;
 await peerTarget();
 await host.evaluate(()=>{
  const d=window.__DEAD_ARRIVAL__,p=d.run.peer,i={angle:p.angle,pitch:p.pitch,weapon:6,fire:true};
  d.receive({t:'input',i});d.receive({t:'input',i:{...i,weapon:5,fire:false}});
 });
 await guest.waitForTimeout(850);assert.equal((await state(host)).enemies[0].hp,100,'switching cancels an unconsumed trigger tap');report.checks.coalescedSwitchCancels=true;
 await guest.keyboard.press('8');await peerTarget();await guestTouch.down('fire');
 await host.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits>=3);
 await guest.waitForFunction(()=>window.__meleeSounds.includes('chainsaw-hit'));
 await guestTouch.up();await guest.waitForTimeout(600);
 const authority=await state(host);await guest.waitForFunction(hp=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hp===hp,authority.enemies[0].hp);
 const hp=authority.enemies[0].hp;await guest.waitForTimeout(350);assert.equal((await state(host)).enemies[0].hp,hp);
 report.checks.coopSawRelease=true;
 await peerTarget();await guestTouch.down('fire');await guest.waitForTimeout(350);await guest.keyboard.press('Escape');await guestTouch.cancel();await guest.waitForTimeout(600);
 assert.equal(await host.evaluate(()=>window.__DEAD_ARRIVAL__.run.peer.sawActive),false);
 assert.equal((await state(guest)).audio.motorSources,0);report.checks.coopPause=true;
 await guest.screenshot({path:out+'/coop-paused.png'});
 await guest.locator('[data-action="resume"]').tap();
 // Repeated live input changes exercise animation, pools and loop teardown for two minutes.
 const start=Date.now();let iteration=0;
 console.log('Co-op melee checks passed; starting two-minute input/audio soak.');
 while(!process.argv.includes('--skip-soak')&&Date.now()-start<120000){
  await peerTarget();await guest.keyboard.press(iteration%2?'7':'8');
  await guestTouch.down(iteration%4===3?'alt':'fire');
  await host.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits>=1);
  await guest.waitForTimeout(200);await guestTouch.up();
  await guest.waitForTimeout(450);
  if(iteration%10===0){const sample=await state(guest);report.samples.push({seconds:(Date.now()-start)/1000,...sample});assert.ok(sample.audio.motorSources<=1&&sample.audio.contactSources<=1);}
  iteration++;
 }
 report.checks.coopSoak={seconds:(Date.now()-start)/1000,iterations:iteration};
 report.transport=await Promise.all([host,guest].map(p=>p.evaluate(()=>window.__meleeTransport)));
 for(const t of report.transport){assert.equal(t.rejected,0);assert.deepEqual(t.statuses,[]);}
 await guest.keyboard.press('1');await guest.waitForTimeout(2100);
 const end=await state(guest);assert.equal(end.audio.motorSources,0);assert.equal(end.audio.contactSources,0);assert.equal(end.audio.startupSources,0);assert.equal(end.audio.shutdownSources,0);
 report.final=end;await guest.screenshot({path:out+'/coop-final.png'});
 await guest.evaluate(()=>window.__DEAD_ARRIVAL__.session.close());
 await host.waitForFunction(()=>!window.__DEAD_ARRIVAL__.run.peer);report.checks.disconnect=true;
 await hostContext.close();await guestContext.close();assert.deepEqual(report.errors,[]);
 }
 assert.deepEqual(report.errors,[]);
 console.log(JSON.stringify({checks:report.checks,errors:report.errors,samples:report.samples.length}));
}catch(error){report.failure=error.stack;report.failureStates=await Promise.all(pages.filter(p=>!p.isClosed()).map(p=>p.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d?.run;return{screen:d?.screen,mode:r?.mode,connected:d?.session?.connected,transport:window.__meleeTransport,counts:r&&Object.fromEntries(['projectiles','coins','gore','blood','tracers','spawnTelegraphs','explosions'].map(k=>[k,r[k]?.length])),player:{x:r?.x,y:r?.y,z:r?.z,angle:r?.angle,pitch:r?.pitch,health:r?.health,weapon:r?.weapon,sequence:r?.meleeSequence,active:r?.meleeActive},peer:r?.peer&&{x:r.peer.x,y:r.peer.y,z:r.peer.z,angle:r.peer.angle,pitch:r.peer.pitch,health:r.peer.health,weapon:r.peer.weapon,mode:r.peer.mode,sequence:r.peer.meleeSequence,active:r.peer.meleeActive},enemies:r?.course.enemies,audio:window.__meleeSounds};}).catch(e=>({error:e.message}))));throw error;}finally{await browser.close();await writeFile(out+'/qa-results.json',JSON.stringify(report,null,2));}
