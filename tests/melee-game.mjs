import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.MELEE_QA_OUTPUT||'docs/melee-pass/source';
const audioRequired=process.argv.includes('--audio');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={errors:[],frames:[],checks:{},source:process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/'};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(report.source+'?debug=1&dungeon=2',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._ashWitnessAsset);
 await page.locator('[data-action="start"]').click();await page.locator('#world').click();
 await page.waitForFunction(()=>document.pointerLockElement);
 await page.evaluate(()=>{
  const d=window.__DEAD_ARRIVAL__,r=d.run;
  Object.assign(r,{x:19.5,y:24.2,angle:-Math.PI/2,pitch:-.08,health:100,waveDelay:999});
  window.__meleeQA={render:d.renderer.render.bind(d.renderer),nextId:97001};
  window.__meleeQA.target=(hp=40)=>{
   const e={id:window.__meleeQA.nextId++,x:19.5,y:23.53,z:0,hp,maxHp:hp,kind:0,variant:'stalker',dead:false,flash:0,hits:0,attack:99,phase:0,moveSpeed:.000001};
   r.course.enemies=[e];r.waveDelay=999;return e;
  };
  window.__meleeQA.target();d.renderer._firstCameraFrame=true;
 });
 const capture=async name=>{
  const frame=await page.evaluate(()=>{
   const d=window.__DEAD_ARRIVAL__,r=d.run,e=r.course.enemies[0];r.mode='ready';
   window.__meleeQA.render(r,performance.now());d.renderer.render=()=>{};
   const renderer=d.renderer.renderer,gl=renderer.getContext(),p=new Uint8Array(16*16*4);
   gl.readPixels(gl.drawingBufferWidth/2-8,gl.drawingBufferHeight/2-8,16,16,gl.RGBA,gl.UNSIGNED_BYTE,p);
   const group=d.renderer.weaponGroups[r.weapon],model=group.userData.model||group;
   const actor=d.renderer._enemyVisuals.get(e?.id)?.root,s=actor?.userData.afterlife;
   actor?.updateMatrixWorld(true);
   return{weapon:r.weapon,progress:r.meleeProgress,contact:r.meleeContact,sawRev:r.sawRev,sawContact:r.sawContact,
    position:model.position.toArray(),rotation:model.rotation.toArray().slice(0,3),
    chainPhase:model.userData.melee?.chainPhase,enemy:e?{id:e.id,hp:e.hp,hits:e.hits,dead:e.dead,x:e.x,y:e.y,lift:e.meleeZ||0}:null,
    reaction:s?.meleeReaction?.diagnostics,headY:s?.model.getObjectByName('Head')?.matrixWorld.elements[13],
    calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,
    armsConnected:(group.userData.meleeArms||[]).every(s=>s.wrist.parent===s.limb&&s.sleeve.parent===s.limb),
    tracerBeams:d.renderer.weaponFX.beams.count,pixelLevels:new Set(p.filter((_,i)=>i%4!==3)).size};
  });
  assert.ok(frame.pixelLevels>2,'canvas contains rendered content');
  assert.equal(frame.armsConnected,true,'loaded assets preserve the moving wrist and sleeve assembly');
  await page.screenshot({path:`${output}/${name}.png`});report.frames.push({name,...frame});
  await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;d.renderer.render=window.__meleeQA.render;d.run.mode='play';});
  return frame;
 };
 await page.mouse.up();await page.mouse.up({button:'right'});
 await page.keyboard.press('7');
 await page.waitForTimeout(180);
 await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.run.meleeActive&&window.__DEAD_ARRIVAL__.run.cooldowns[6]===0);
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.meleeActive),false,'released input leaves the equipped bat idle');
 await page.evaluate(()=>window.__meleeQA.target());await capture('bat-idle');
 await page.mouse.down();await page.waitForTimeout(30);await page.mouse.up();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.meleeProgress>.12);await capture('bat-windup');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits>0);
 const hit=await capture('bat-contact');assert.equal(hit.enemy.hits,1);assert.ok(hit.enemy.hp<40);assert.equal(hit.tracerBeams,0);
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.meleeProgress>.66);await capture('bat-followthrough');
 await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.run.meleeActive);await capture('bat-return');report.checks.bat='real input: windup/contact/followthrough/return; one hit';
 await page.evaluate(()=>{window.__meleeQA.target(1);window.__DEAD_ARRIVAL__.run.cooldowns[6]=0;});
 await page.mouse.down({button:'right'});await page.waitForTimeout(30);await page.mouse.up({button:'right'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].dead);await capture('bat-finisher');
 await page.waitForTimeout(1900);const settled=await capture('bat-corpse');
 assert.equal(settled.enemy.lift,0);assert.ok(settled.reaction?.boneCount>=8);assert.ok(settled.reaction?.finite);assert.ok(settled.headY<.65);
 report.checks.reaction='lethal impulse, articulated overlay, grounded corpse';
 await page.evaluate(()=>window.__meleeQA.target(80));await page.keyboard.press('8');await page.waitForTimeout(180);await capture('chainsaw-idle');
 await page.mouse.down();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits>=3);
 const cutting=await capture('chainsaw-contact');assert.ok(cutting.sawRev>.62);assert.ok(cutting.sawContact>0);assert.equal(cutting.tracerBeams,0);
 await page.mouse.up();await page.waitForTimeout(450);const released=await capture('chainsaw-return');assert.equal(released.sawRev,0);
 const releasedHits=released.enemy.hits;await page.waitForTimeout(180);
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits),releasedHits);report.checks.chainsaw='spin-up, repeated real contacts, release stops damage';
 await page.mouse.down({button:'right'});await page.waitForTimeout(30);await page.mouse.up({button:'right'});
 await page.waitForFunction(n=>window.__DEAD_ARRIVAL__.run.course.enemies[0].hits>n,releasedHits);await capture('chainsaw-shove');
 await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.run.meleeActive);report.checks.shove=true;
 // Keyboard/wheel/touch selection share the same eight-slot path.
 await page.mouse.wheel(0,100);await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.weapon===0);report.checks.wheelWrap=true;
 await page.evaluate(()=>window.__meleeQA.target(80));
 await page.keyboard.press('8');await page.mouse.down();await page.waitForTimeout(500);
 const audioState=()=>page.evaluate(()=>window.__DEAD_ARRIVAL__.audio.meleeDiagnostics());
 const assertStopped=state=>{assert.equal(state.motorSources,0);assert.equal(state.contactSources,0);assert.equal(state.running,false);assert.equal(state.startupSources,0);};
 if(audioRequired){
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.audio.assetsLoaded);
  report.audio=await page.evaluate(()=>{const a=window.__DEAD_ARRIVAL__.audio;return{...a.debugInfo,melee:a.meleeDiagnostics?.()??a.debugInfo.melee??null};});
  assert.equal(report.audio.loaded,true);assert.deepEqual(report.audio.errors,[]);
  assert.equal(report.audio.melee.motorSources,1);assert.equal(report.audio.melee.contactSources,1);
  assert.ok(report.audio.melee.startupSources<=1);assert.ok(report.audio.melee.shutdownSources<=1);
  await page.waitForTimeout(160);assert.equal((await audioState()).motorSources,1);
  await page.evaluate(()=>{const a=window.__DEAD_ARRIVAL__.audio;a.setGroupVolume('sfx',0);a.setMuted(true);});
  await page.waitForTimeout(150);
  const muted=await page.evaluate(()=>{const a=window.__DEAD_ARRIVAL__.audio;return{master:a._master.gain.value,sfx:a._groups.get('sfx').gain.value};});
  assert.equal(muted.master,0);assert.ok(muted.sfx<.001);
  await page.evaluate(()=>{const a=window.__DEAD_ARRIVAL__.audio;a.setMuted(false);a.setGroupVolume('sfx',1);});
  report.checks.audioMutedThroughGroups=true;
 }
 await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(220);
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.sawActive),false);report.checks.pauseCancels=true;
 if(audioRequired){report.audio.paused=await audioState();assertStopped(report.audio.paused);assert.equal(report.audio.paused.shutdownSources,0);}
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.resume());await page.locator('#world').click();
 await page.mouse.down();await page.waitForTimeout(220);await page.keyboard.press('7');await page.mouse.up();
 if(audioRequired){await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.audio.meleeDiagnostics().motorSources===0);report.audio.switched=await audioState();assertStopped(report.audio.switched);}
 await page.setViewportSize({width:390,height:844});await page.keyboard.press('7');await page.waitForTimeout(180);await capture('bat-mobile');
 await page.keyboard.press('8');await page.waitForTimeout(180);await capture('chainsaw-mobile');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);report.checks.mobileFit=true;
 await page.keyboard.press('r');await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.weapon),0);assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.sawRev),0);report.checks.restart=true;
 if(audioRequired){
  report.audio.restarted=await audioState();assertStopped(report.audio.restarted);
  await page.keyboard.press('8');await page.mouse.down();await page.waitForTimeout(160);
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.health=0;r.mode='dead';});
  await page.mouse.up();await page.waitForTimeout(150);
  report.audio.dead=await audioState();assertStopped(report.audio.dead);assert.equal(report.audio.dead.shutdownSources,0);
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.audio.dispose());report.audio.disposed=await audioState();assertStopped(report.audio.disposed);
  report.checks.audioLifecycle='one motor/contact loop; group mute; pause, switch, restart, death and dispose cleanup';
 }
 assert.deepEqual(report.errors,[]);
 console.log(JSON.stringify({checks:report.checks,frames:report.frames.map(({name,calls,triangles})=>({name,calls,triangles})),audio:report.audio,errors:report.errors}));
}catch(e){report.failure=e.message;throw e;}finally{
 await browser.close();await writeFile(`${output}/qa-results.json`,JSON.stringify(report,null,2));
}
