import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.INJURY_OUTPUT||'output/playwright/player-injury';
const desktopOnly=process.env.INJURY_DESKTOP_ONLY==='1';
await mkdir(output,{recursive:true});
const server=await startServer({root:process.env.DEAD_ARRIVAL_RUNTIME||fileURLToPath(new URL('../dist/',import.meta.url)),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.setDefaultTimeout(180000);
const report={runtimeRoot:process.env.DEAD_ARRIVAL_RUNTIME||fileURLToPath(new URL('../dist/',import.meta.url)),errors:[],views:[]};
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});
page.on('requestfailed',request=>report.errors.push(`${request.failure()?.errorText} ${request.url()}`));

async function fixture(phase,wounds={},gore=true){
  await page.evaluate(async ({phase,wounds,gore})=>{
    const d=window.__DEAD_ARRIVAL__,r=d.run;
    if(!window.__injuryAnchor){
      const {castRay}=await import('./engine.js');
      const angles=Array.from({length:24},(_,i)=>i*Math.PI/12);
      const angle=angles.sort((a,b)=>castRay(r.course,r.x,r.y,b,8).dist-castRay(r.course,r.x,r.y,a,8).dist)[0];
      window.__injuryAnchor={x:r.x,y:r.y,angle};
    }
    const anchor=window.__injuryAnchor;
    // Freeze simulation, but keep the normal render/HUD loop for staged art
    // captures. A timer competing with fixed-step combat can release the bite
    // immediately before a HUD frame and produce a false missing-prompt result.
    r.x=anchor.x;r.y=anchor.y;r.z=0;r.angle=anchor.angle;r.pitch=0;r.health=phase==='terminal'?0:30;r.mode='ready';
    if(!window.__injuryEnemy){
      window.__injuryEnemy={id:r.nextId++,kind:0,variant:'stalker',x:anchor.x+Math.cos(anchor.angle)*.28,y:anchor.y+Math.sin(anchor.angle)*.28,z:0,hp:30,maxHp:30,dead:false,flash:0,attack:100,phase:0,biteTargetId:'host',bitePhase:'held',biteProgress:1};
      r.course.enemies=[window.__injuryEnemy];
    }
    d.renderer.setSettings({gore,reducedMotion:false,bodycam:true});
    const elapsed=phase==='terminal'?.65:phase==='windup'?.32:.35;
    const e=window.__injuryEnemy;
    r.course.enemies=[e];e.x=anchor.x+Math.cos(anchor.angle)*.28;e.y=anchor.y+Math.sin(anchor.angle)*.28;e.hp=30;e.dead=false;e.attack=100;e.biteTargetId='host';e.bitePhase=phase;e.biteProgress=phase==='windup'?.5:1;
    r.bite={phase,enemyId:e.id,elapsed,escape:.46,damageStage:phase==='windup'?0:phase==='terminal'?3:1,sequence:phase==='terminal'?13:phase==='released'?12:11,cooldown:0,side:'left',limb:'leftArm'};
    r.playerWounds={leftArm:'intact',rightArm:'intact',leftLeg:'intact',rightLeg:'intact',neck:0,torso:0,eviscerated:false,...wounds};
    d.ui.hud(r,{fps:d.fps});
  },{phase,wounds,gore});
  await page.waitForTimeout(350);
}
async function shot(name){
  await page.screenshot({path:`${output}/${name}.png`});
  report.views.push(await page.evaluate(name=>{
    const d=window.__DEAD_ARRIVAL__,r=d.renderer.renderer,p=document.querySelector('[data-bite-prompt]'),w=document.querySelector('[data-hud="wounds"]');
    const camera=d.renderer.camera.getWorldPosition(d.renderer.camera.position.clone()).toArray();
    const health=document.querySelector('[data-hud="health"]'),rect=p?.getBoundingClientRect(),hr=health?.getBoundingClientRect();
    const healthOverlap=!!(rect&&hr&&rect.left<hr.right&&rect.right>hr.left&&rect.top<hr.bottom&&rect.bottom>hr.top);
    const v=d.renderer.playerInjuryVisuals,up=d.renderer.camera.position.clone().set(0,1,0);
    const jaw=d.renderer._enemyVisuals.get(d.run.bite?.enemyId)?.root.getObjectByName('Jaw');let faceDot=null;
    if(jaw){const facing=up.clone().set(0,0,1).applyQuaternion(jaw.getWorldQuaternion(d.renderer.camera.quaternion.clone())),toward=d.renderer.camera.getWorldPosition(up.clone()).sub(jaw.getWorldPosition(up.clone()));facing.y=toward.y=0;faceDot=facing.normalize().dot(toward.normalize());}
    return{name,promptVisible:!!p&&p.checkVisibility(),prompt:p?.innerText,wounds:w?.innerText,blood:v?.blood.count,fragments:v?.fragments.filter(f=>f.mesh.visible).length,entrails:v?.diagnostics().entrails,visuals:v?.diagnostics(),weaponPosition:d.renderer.weaponRig.position.toArray(),faceDot,corpseUp:v?up.applyQuaternion(v.intactCorpse.quaternion).y:null,healthOverlap,calls:r.info.render.calls,triangles:r.info.render.triangles,camera};
  },name));
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
}

async function inspectCanvas(name){
  const pixels=await page.evaluate(()=>{
    const d=window.__DEAD_ARRIVAL__,r=d.renderer.renderer;
    d.renderer.render(d.run,performance.now());
    const gl=r.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
    const data=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    const colors=new Set();let min=255,max=0,lit=0;
    const stride=Math.max(1,Math.floor(width*height/4096));
    for(let i=0;i<width*height;i+=stride){const k=i*4,red=data[k],green=data[k+1],blue=data[k+2];min=Math.min(min,red,green,blue);max=Math.max(max,red,green,blue);if(red+green+blue>18)lit++;colors.add(`${red>>4},${green>>4},${blue>>4}`);}
    return{width,height,spread:max-min,colorBuckets:colors.size,lit};
  });
  assert(pixels.width>0&&pixels.height>0&&pixels.spread>8&&pixels.colorBuckets>3&&pixels.lit>100,'canvas contains varied rendered geometry');
  (report.canvas??=[]).push({name,...pixels});
}

try{
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1&campaign=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.renderer._ashWitnessAsset||window.__DEAD_ARRIVAL__.renderer._ashWitnessError);
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play'&&window.__DEAD_ARRIVAL__.renderer._weaponsPrepared);
  console.log('Production assets prepared; testing natural escape and fatality.');
  await page.evaluate(async()=>{
    const d=window.__DEAD_ARRIVAL__,r=d.run,{castRay}=await import('./engine.js'),{createMind}=await import('./enemy-ai.js');
    const angles=Array.from({length:24},(_,i)=>i*Math.PI/12),angle=angles.sort((a,b)=>castRay(r.course,r.x,r.y,b,8).dist-castRay(r.course,r.x,r.y,a,8).dist)[0];
    r.angle=angle;r.pitch=0;r.course.enemies=[];
    const id=r.nextId++,e={id,x:r.x+Math.cos(angle)*.28,y:r.y+Math.sin(angle)*.28,z:0,hp:100,maxHp:100,kind:0,variant:'stalker',dead:false,flash:0,phase:0,attack:0,moveSpeed:.3,contactDamage:12,biteAttackCount:(2-id%3+3)%3};
    createMind(e,{state:'stalk',firstAttack:0});e.mind.token=true;r.course.enemies.push(e);
    window.__naturalBiteEvents=[];const oldPlay=d.audio.play.bind(d.audio);
    d.audio.play=(type,weapon,event)=>{if(type==='shot')window.__injuryLiveShots=(window.__injuryLiveShots||0)+1;if(type.startsWith('bite-')||type==='player-injury')window.__naturalBiteEvents.push({type,playerId:event?.playerId,sequence:event?.sequence});return oldPlay(type,weapon,event);};
    // Capture the main frame callback at latch. Slow browser/IPC scheduling
    // must not spend the damage-free window before delivering the first key.
    // Native RAF remains available to Playwright polling and other UI work.
    window.__injuryNativeRAF=window.requestAnimationFrame.bind(window);
    window.__injuryProtectLatch=true;window.__injuryControlled=false;
    window.requestAnimationFrame=callback=>{
      if(window.__injuryControlled&&callback.name==='frame'){window.__injuryFrame=callback;return 0;}
      return window.__injuryNativeRAF(callback);
    };
    window.__injuryDriveUntil=predicate=>{
      for(let i=0;i<300;i++){
        if(predicate())return;
        window.__injuryFrame(window.__injuryClock+=1000/60);
      }
      throw new Error('Natural bite did not reach its phase: '+JSON.stringify({mode:d.run.mode,bite:d.run.bite,health:d.run.health}));
    };
    const oldHud=d.ui.hud.bind(d.ui);d.ui.hud=(run,stats)=>{
      oldHud(run,stats);
      if(window.__injuryProtectLatch&&run.bite?.phase==='held'){
        window.__injuryProtectLatch=false;window.__injuryControlled=true;window.__injuryClock=performance.now();
      }
      if(run.bite?.phase==='terminal'&&d.screen==='play'&&document.querySelector('[data-bite-prompt]')?.checkVisibility())window.__naturalFatalPrompt={visible:true,screen:d.screen,mode:run.mode};
    };
  });
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.bite.phase==='held',null,{timeout:10000});
  // Do not spend the damage-free window waiting for a GPU screenshot.
  await page.keyboard.press('f');
  await page.evaluate(()=>{for(let i=0;i<6;i++)window.__injuryFrame(window.__injuryClock+=100);});
  assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.parryCooldown),0,'advance the real game loop through the first parry cooldown');
  await page.keyboard.press('f');
  await page.evaluate(()=>window.__injuryFrame(window.__injuryClock+=100));
  await page.waitForFunction(()=>['released','idle'].includes(window.__DEAD_ARRIVAL__.run.bite.phase),null,{timeout:5000});
  await page.waitForFunction(()=>window.__naturalBiteEvents.some(e=>e.type==='bite-release'),null,{timeout:5000});
  report.natural=await page.evaluate(()=>({health:window.__DEAD_ARRIVAL__.run.health,events:window.__naturalBiteEvents}));
  assert.equal(report.natural.health,100,'two parries break the grip before first bite damage');
  assert(report.natural.events.some(e=>e.type==='bite-start')&&report.natural.events.some(e=>e.type==='bite-release'),'actual combat dispatches latch and release');
  await shot('natural-escape');
  // Let authoritative combat cause a torso fatality; never force terminal mode.
  await page.evaluate(async()=>{
    const d=window.__DEAD_ARRIVAL__,r=d.run,{createMind}=await import('./enemy-ai.js');
    const sequence=r.bite.sequence+1;
    const id=r.nextId+((2-sequence%3-r.nextId%3+6)%3);r.nextId=id+1;
    const e={id,x:r.x+Math.cos(r.angle)*.28,y:r.y+Math.sin(r.angle)*.28,z:0,hp:100,maxHp:100,kind:0,variant:'stalker',dead:false,flash:0,phase:0,attack:0,moveSpeed:.3,contactDamage:12,biteAttackCount:(2-id%3+3)%3};
    createMind(e,{state:'stalk',firstAttack:0});e.mind.token=true;r.course.enemies=[e];
    // This is a fresh grab fixture, not an attacker entering the previous
    // escape's still-active parry window and being forced into a lethal slash.
    Object.assign(r,{health:8,autoRun:false,vx:0,vy:0,parryTime:0,parryCooldown:0});r.bite.phase='idle';r.bite.cooldown=0;
    window.__injuryDriveUntil(()=>r.bite.phase==='held'&&r.bite.elapsed>=.2);r.mode='ready';
  });
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.bite.phase==='held'&&window.__DEAD_ARRIVAL__.run.bite.elapsed>=.2,null,{timeout:10000});
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';});
  await page.waitForTimeout(200);await shot('natural-held');
  const naturalHeld=report.views.at(-1);
  assert.equal(naturalHeld.visuals.gripHands,2,'actual combat latch uses both hands');
  assert.ok(naturalHeld.visuals.contactDistance<.75,'actual combat puts the head within neck reach');
  assert.equal(naturalHeld.visuals.articulation.jawRig,true,'the actual attacker loads its weighted jaw');
  assert.equal(naturalHeld.visuals.articulation.gripControls,2,'both weighted group-curl controls load');
  assert(naturalHeld.visuals.articulation.leftGrip>.8,'canonical held bite closes the grip');
  assert(naturalHeld.faceDot>.65,'actual post-latch actor presents its face toward the held victim');
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.mode='play';window.__injuryDriveUntil(()=>r.bite.phase==='held'&&r.bite.elapsed>=.98);r.mode='ready';});
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.bite.phase==='held'&&window.__DEAD_ARRIVAL__.run.bite.elapsed>=.98,null,{timeout:10000});
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';});
  await page.waitForTimeout(80);await shot('natural-bite-preparation');
  assert(report.views.at(-1).faceDot>.65&&report.views.at(-1).visuals.articulation.jawOpen>.55,'natural pre-contact damage beat opens the weighted mouth toward its victim');
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.mode='play';window.__injuryDriveUntil(()=>r.bite.phase==='terminal');});
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.bite.phase==='terminal',null,{timeout:10000});
  console.log('Authoritative fatality reached; checking fatal HUD and restart.');
  await page.waitForFunction(()=>window.__naturalFatalPrompt,null,{timeout:10000});
  report.fatality=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.bite.reason);
  assert.equal(report.fatality,'torso','fixture selects the torso outcome using the next grab sequence');
  report.fatalPrompt=await page.evaluate(()=>window.__naturalFatalPrompt);
  assert.deepEqual(report.fatalPrompt,{visible:true,screen:'play',mode:'dead'},'fatal prompt survives the actual dead-mode animation beat');
  await page.evaluate(()=>window.__injuryDriveUntil(()=>window.__DEAD_ARRIVAL__.screen==='dead'));
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='dead');
  await shot('natural-death-screen');
  assert.equal(report.views.at(-1).entrails,3,'authoritative torso fatality releases organs');
  assert(report.views.at(-1).visuals.articulation.leftGrip<.2,'natural terminal bite releases its rig despite frozen engine elapsed');
  await page.evaluate(async()=>{
    // Keep the restored native RAF timestamp monotonic after manual frames.
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,window.__injuryClock-performance.now())));
    window.__injuryControlled=false;window.requestAnimationFrame=window.__injuryNativeRAF;
    window.__injuryNativeRAF(window.__injuryFrame);
  });
  await page.locator('[data-action="restart"]').click();
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.run.bite.phase==='idle');
  report.restart=await page.evaluate(()=>({health:window.__DEAD_ARRIVAL__.run.health,wounds:window.__DEAD_ARRIVAL__.run.playerWounds,visuals:window.__DEAD_ARRIVAL__.renderer.playerInjuryVisuals.diagnostics()}));
  assert.equal(report.restart.health,100);assert.equal(report.restart.wounds.eviscerated,false);
  assert.equal(report.restart.visuals.visibleFragments,0);assert.equal(report.restart.visuals.entrails,0);
  // Drive real guest snapshot application through two terminal rounds. The
  // second restart must retain the full camera/HUD beat rather than reuse an
  // expired deadline from the first death.
  async function guestStart(){
    await page.evaluate(()=>{
      const d=window.__DEAD_ARRIVAL__,s=d.snapshot();
      s.host.mode='ready';s.host.bite={phase:'idle',sequence:0};s.host.health=100;
      s.guest=structuredClone(s.host);s.enemies=[];s.audioEvents=[];
      d.receive({t:'start',s});
    });
  }
  await guestStart();
  report.guestAudio=await page.evaluate(()=>{
    const d=window.__DEAD_ARRIVAL__,s=d.snapshot(),before=window.__naturalBiteEvents.length;
    s.guest={...structuredClone(s.host),health:92,bite:{phase:'released',sequence:1}};
    s.audioEvents=[{seq:1001,type:'bite-damage',playerId:'peer'},{seq:1002,type:'bite-release',playerId:'peer'}];
    const oldPlay=d.audio.play,played=[];d.audio.play=(...args)=>{played.push(args[0]);return oldPlay(...args);};
    d.receive({t:'snapshot',s});s.seq++;d.receive({t:'snapshot',s});d.audio.play=oldPlay;
    return{played,injuryCues:window.__naturalBiteEvents.length-before};
  });
  assert.deepEqual(report.guestAudio.played,['bite-damage','bite-release']);
  assert.equal(report.guestAudio.injuryCues,2,'guest snapshots deduplicate the canonical injury audio');
  report.guestFatalBeats=[];
  for(let round=0;round<2;round++){
    await guestStart();
    await page.evaluate(round=>{
      const d=window.__DEAD_ARRIVAL__,s=d.snapshot();s.host.mode='dead';
      s.guest={...structuredClone(s.host),health:0,bite:{phase:'terminal',reason:'neck',sequence:round+20}};
      d.receive({t:'snapshot',s});
    },round);
    await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.renderer.playerInjuryVisuals.fatal);
    const beat=await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__.screen,prompt:document.querySelector('[data-bite-prompt]')?.checkVisibility()}));
    report.guestFatalBeats.push(beat);
    assert.deepEqual(beat,{screen:'play',prompt:true},'each guest restart gets its fatal HUD/camera beat');
    await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='dead');
  }
  await page.evaluate(()=>{window.__injuryEnemy=null;});
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.begin(false));
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.run.bite.phase==='idle');
  await fixture('windup');await shot('bite-windup');
  await fixture('held',{leftArm:'injured',neck:1});await shot('bite-held');
  for(let weapon=0;weapon<8;weapon++){
    await page.evaluate(weapon=>{const r=window.__DEAD_ARRIVAL__.run;r.weapon=weapon;r.bite.elapsed=1.04;r.bite.damageStage=0;},weapon);
    await page.waitForTimeout(150);await shot(`bite-weapon-${weapon}`);
    assert(report.views.at(-1).weaponPosition[1]<-.18,'assembled weapon clears the face during a held bite');
  }
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.weapon=0;});
  report.peerArticulation=await page.evaluate(async()=>{
    const d=window.__DEAD_ARRIVAL__,r=d.run,saved=r.peer,e=window.__injuryEnemy,second={...e,id:r.nextId++,x:e.x+.5};
    r.course.enemies.push(second);r.bite.elapsed=.35;
    r.peer={...(saved||{}),x:r.x+.5,y:r.y,z:0,angle:r.angle,pitch:0,health:100,playerWounds:{},bite:{...r.bite,enemyId:second.id,elapsed:1.04,damageStage:0}};
    d.renderer.render(r,performance.now());
    const local=d.renderer._enemyVisuals.get(e.id).root.userData.afterlife.articulation,peer=d.renderer._enemyVisuals.get(second.id).root.userData.afterlife.articulation;
    const result={distinct:local!==peer,local:{...local.pose},peer:{...peer.pose},peerControls:peer.controls.length};
    r.peer=saved;r.course.enemies=[e];return result;
  });
  assert(report.peerArticulation.distinct&&report.peerArticulation.peerControls===4);
  assert(report.peerArticulation.peer.jawOpen>report.peerArticulation.local.jawOpen+.4,'each attacker uses its own victim canonical clock');
  await fixture('released',{leftArm:'severed',neck:2,torso:1});await shot('survived-sever');
  await fixture('terminal',{leftArm:'severed',rightLeg:'severed',neck:3,torso:3,eviscerated:true});await shot('terminal-body');
  await page.waitForTimeout(750);await shot('terminal-settled');
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.course.enemies=[];});await page.waitForTimeout(150);await shot('terminal-body-clear');
  await fixture('terminal',{leftArm:'severed',rightLeg:'severed',neck:3,torso:3,eviscerated:true},false);await shot('gore-off');
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.course.enemies=[];});await page.waitForTimeout(150);await shot('gore-off-clear');
  if(!desktopOnly){
  await page.setViewportSize({width:390,height:844});
  await fixture('held',{leftLeg:'injured',neck:1});await shot('portrait-held');
  await inspectCanvas('portrait-held');
  for(let weapon=0;weapon<8;weapon++){
    await page.evaluate(weapon=>{const r=window.__DEAD_ARRIVAL__.run;r.weapon=weapon;r.bite.elapsed=1.04;r.bite.damageStage=0;},weapon);
    await page.waitForTimeout(120);await shot(`portrait-bite-weapon-${weapon}`);
    assert.equal(report.views.at(-1).healthOverlap,false);
  }
  }
  // This check must own a held attacker even when portrait coverage is skipped.
  await fixture('held',{leftLeg:'injured',neck:1});
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.setSettings({reducedMotion:true}));await page.waitForTimeout(120);await shot('reduced-motion-bite');
  assert(report.views.at(-1).visuals.articulation.jawOpen<=.42,'real reduced-motion setting bounds jaw travel');
  await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;d.run.weapon=0;d.renderer.setSettings({reducedMotion:false});});
  const view=name=>report.views.find(v=>v.name===name);
  assert(view('bite-windup').promptVisible&&view('bite-held').promptVisible,'bite stages present a readable struggle prompt');
  assert.match(view('bite-held').prompt,/BREAK THE GRIP/);
  assert.equal(view('bite-held').visuals.gripHands,2,'both actual rig hands grip the shoulders');
  assert.ok(view('bite-held').visuals.contactDistance<.75,'the held head is within neck reach');
  assert.match(view('survived-sever').wounds,/\b(?:LEFT|L) ARM LOST\b/);
  assert(view('terminal-body').fragments>0,'fatal damage releases modeled anatomy');
  assert.equal(view('gore-off').fragments,0,'gore setting hides detached anatomy');
  assert.equal(view('gore-off').entrails,0,'gore setting hides organs');
  assert.equal(view('gore-off').visuals.intactCorpse,true,'gore-off uses a coherent whole-body fall');
  assert.ok(Math.abs(view('gore-off').corpseUp)<.15,'gore-off corpse is settled horizontally');
  if(!desktopOnly){
  assert.equal(view('portrait-held').healthOverlap,false,'portrait struggle prompt does not cover health');
  assert.match(view('portrait-held').prompt,/F PARRY/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'portrait HUD fits viewport');
  }
  assert(report.views.every(v=>v.camera.every(Number.isFinite)),'finite camera pose');
  // Return to an unmodified simulation and exercise controls for two minutes.
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;d.renderer.setSettings({gore:true});d.begin(false);window.__injuryLiveShots=0;});
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.run.mode==='play');
  await page.mouse.move(640,360);await page.locator('canvas').click();
  await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('canvas'));
  const seconds=Number(process.env.INJURY_PLAY_SECONDS??120),until=Date.now()+seconds*1000;
  let cycles=0;
  while(Date.now()<until){
    await page.keyboard.down(cycles%2?'s':'a');await page.waitForTimeout(250);await page.keyboard.up(cycles%2?'s':'a');
    await page.mouse.down();await page.waitForTimeout(180);await page.mouse.up();
    await page.keyboard.press('f');await page.keyboard.press('Space');
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(Math.min(10000,Math.max(0,until-Date.now())));cycles++;
    if(await page.locator('[data-action="restart"]').isVisible())await page.locator('[data-action="restart"]').click();
    console.log(`Injury regression play ${cycles} input cycles.`);
  }
  report.live=await page.evaluate(({seconds,cycles})=>{const d=window.__DEAD_ARRIVAL__;return{seconds,cycles,kills:d.run.kills,shots:window.__injuryLiveShots,distance:d.run.distance,fps:d.fps,diagnostics:d.renderer._collectDiagnostics(d.run)};},{seconds,cycles});
  if(seconds>0){assert(report.live.shots>0,'actual mouse input fires the weapon');assert(report.live.distance>0,'actual movement input travels through the world');}
  await shot('active-play');
  await inspectCanvas('active-play');
  // Screenshot/readback can outlast the final death beat. Start a fresh run
  // for menu navigation so a real combat death cannot race the pause button.
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.begin(false));
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.run.mode==='play');
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.pause());
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.pause());
  await page.locator('[data-action="menu"]').click();
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='menu');
  assert.deepEqual(report.errors,[],'no browser, network or WebGL errors');
  report.result='PASS';
  console.log(JSON.stringify({result:report.result,views:report.views.map(({name,promptVisible,fragments,blood,calls})=>({name,promptVisible,fragments,blood,calls}))}));
}catch(error){report.result='FAIL';report.failure=error.stack;await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally{
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  await browser.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));
}
