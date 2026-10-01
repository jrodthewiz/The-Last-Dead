// Exercise the production frame/input path with browser-standard pad snapshots.
// This is integration evidence, not a physical controller/hardware certification.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.CONTROLLER_OUTPUT||'output/playwright/brutal-combat/controller';await mkdir(output,{recursive:true});
const server=await startServer({root:process.env.DEAD_ARRIVAL_RUNTIME||process.cwd()+'/dist',port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
const report={runtimeRoot:process.env.DEAD_ARRIVAL_RUNTIME||process.cwd()+'/dist',errors:[],checks:[],views:[],hardwareTested:false};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{
  window.__testPad={id:'Integration Standard Controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
  window.__testPadConnected=true;
  Object.defineProperty(navigator,'getGamepads',{value:()=>window.__testPadConnected?[window.__testPad]:[]});
});
async function pad(buttons=[],axes=[0,0,0,0]){
  await page.evaluate(({buttons,axes})=>{window.__testPad.axes=axes;window.__testPad.buttons=Array.from({length:17},(_,i)=>({pressed:buttons.includes(i),touched:buttons.includes(i),value:buttons.includes(i)?1:0}));},{buttons,axes});
}
async function neutral(){await pad();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.controller.armed);}
async function press(button){await pad([button]);await page.waitForTimeout(180);await pad();await page.waitForTimeout(180);}
async function shot(name){await page.screenshot({path:`${output}/${name}.png`});report.views.push({name,...await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__.screen,controller:window.__DEAD_ARRIVAL__.controller,brutal:window.__DEAD_ARRIVAL__.run.brutal,prompt:document.querySelector('[data-bite-prompt]')?.innerText}))});}
async function fixture(kind){
  await neutral();await page.evaluate(async kind=>{
    const d=window.__DEAD_ARRIVAL__,r=d.run,{castRay}=await import('./engine.js');
    const angles=Array.from({length:24},(_,i)=>i*Math.PI/12),angle=angles.sort((a,b)=>castRay(r.course,r.x,r.y,b,8).dist-castRay(r.course,r.x,r.y,a,8).dist)[0];
    Object.assign(r,{mode:'play',z:0,vx:0,vy:0,vz:0,angle,pitch:0,health:100,energy:100,weapon:0,parryCooldown:0,parryTime:0,waveDelay:1000,director:null,projectiles:[]});
    r.brutal={phase:'idle',sequence:r.brutal.sequence};r.playerWounds={leftArm:'intact',rightArm:'intact',leftLeg:'intact',rightLeg:'intact',neck:0,torso:0,eviscerated:false};
    if(r.dungeonProgression){r.dungeonProgression.currentEncounter=null;r.dungeonProgression.reliefUntil=1e6;r.dungeonProgression.pacing||=(await import('./enemy-ai.js')).createPacing();r.dungeonProgression.pacing.ambushes=999;}r.spawnTelegraphs=[];
    r.bite={phase:'idle',enemyId:null,sequence:0,cooldown:100};
    const e={id:r.nextId++,kind:0,variant:'stalker',x:r.x+Math.cos(angle)*.22,y:r.y+Math.sin(angle)*.22,z:0,hp:30,maxHp:30,dead:false,flash:0,attack:100,phase:0,biteCooldown:100,stagger:0,facing:angle+Math.PI};r.course.enemies=[e];
    if(kind==='rip'){r.bite={phase:'held',enemyId:e.id,elapsed:.2,escape:0,damageStage:0,sequence:++r.nextId,cooldown:0,side:'left',limb:'leftArm'};e.biteTargetId='host';e.bitePhase='held';e.biteProgress=1;}
  },kind);
}
try{
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.controller.connected&&window.__DEAD_ARRIVAL__?.renderer._ashWitnessAsset&&window.__DEAD_ARRIVAL__?.renderer._survivors?.status==='ready');
  await neutral();
  await page.locator('[data-action="guide"]').focus();await press(0);await page.waitForFunction(()=>!document.querySelector('.field-guide').hidden);await shot('controller-guide');
  const scrollTotal=()=>{let total=0;for(let n=document.querySelector('.field-guide');n;n=n.parentElement)total+=n.scrollTop;return total;};
  const beforeScroll=await page.evaluate(scrollTotal);await press(13);await press(13);
  assert((await page.evaluate(scrollTotal))>beforeScroll,'D-pad scrolls the existing controls sheet');
  assert(await page.evaluate(()=>{const r=[...document.querySelectorAll('.guide-controls b')].at(-1).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'last controller binding remains readable');
  await shot('controller-bindings');report.checks.push('D-pad scroll reaches the final controller binding');
  await press(1);assert.equal(await page.locator('.field-guide').isVisible(),false,'B closes the controls panel');report.checks.push('A opens controls and B closes the panel');
  await page.locator('[data-action="start"]').focus();await press(13);await press(12);
  assert(await page.evaluate(()=>document.activeElement?.tagName==='BUTTON'),'D-pad navigates real menu focus');
  await page.locator('[data-action="start"]').focus();await pad([0]);
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await neutral();
  assert.equal(await page.evaluate(()=>!!document.pointerLockElement),false,'controller start does not request mouse capture');report.checks.push('D-pad focus, A starts game without pointer lock');
  await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d.run;r.director=null;r.waveDelay=1000;r.course.enemies=[];r.health=100;window.__controllerShots=0;const play=d.audio.play.bind(d.audio);d.audio.play=(type,...args)=>{if(type==='shot')window.__controllerShots++;return play(type,...args);};});
  const origin=await page.evaluate(()=>({distance:window.__DEAD_ARRIVAL__.run.distance,angle:window.__DEAD_ARRIVAL__.run.angle}));
  await pad([],[-.6,-.6,.5,0]);await page.waitForTimeout(550);await neutral();
  const moved=await page.evaluate(()=>({distance:window.__DEAD_ARRIVAL__.run.distance,angle:window.__DEAD_ARRIVAL__.run.angle}));
  assert(moved.distance>origin.distance+.03);assert(Math.abs(moved.angle-origin.angle)>.1);report.checks.push('actual fixed-tick stick movement and aiming');
  await pad([7]);await page.waitForFunction(()=>window.__controllerShots>0);await neutral();report.checks.push('RT emits actual weapon shots');
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.cooldowns[0]=0;r.altCooldown=0;});await pad([6]);
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.coins.length>0);await neutral();report.checks.push('LT emits actual alternate-fire coin');
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.ownedWeapons=Array.from({length:8},(_,i)=>i);});const weapon=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.weapon);await press(3);
  assert.notEqual(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.weapon),weapon);report.checks.push('Y cycles owned weapons');
  await fixture('chop');await pad([5]);await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].brutalWound?.type==='chop');
  await shot('controller-chop');const chop=await page.evaluate(()=>({sequence:window.__DEAD_ARRIVAL__.run.brutal.sequence,hp:window.__DEAD_ARRIVAL__.run.course.enemies[0].hp}));
  await page.waitForTimeout(750);assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.brutal.sequence),chop.sequence);assert.equal(chop.hp,22);
  await neutral();report.checks.push('held RB commits exactly one authoritative arm chop');
  await fixture('rip');await pad([5]);await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.bite.escape>=.65);await pad();
  assert.match(await page.locator('[data-bite-prompt]').innerText(),/RB PARRY/,'bite prompt matches the active controller');
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.parryCooldown<=0);await pad([5]);
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.brutal.kind==='rip'&&window.__DEAD_ARRIVAL__.run.brutal.phase!=='idle');
  assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.bite.phase),'released');await shot('controller-rip');await neutral();
  report.checks.push('two deliberate RB presses free a bite and start torso rip');
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.brutal.phase==='idle');
  await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.course.enemies=[];r.bite={phase:'idle',cooldown:100};r.health=100;});
  await pad([7,9]);await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');await pad([7]);await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.controller.armed),false,'held fire cannot rearm through pause');
  await neutral();const shots=await page.evaluate(()=>window.__controllerShots);await pad([7,9]);
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await pad([7]);await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>window.__controllerShots),shots,'resume suppresses held fire until a neutral release');
  assert.equal(await page.evaluate(()=>!!document.pointerLockElement),false);await neutral();report.checks.push('Start pauses/resumes without stuck fire or pointer lock');
  await page.evaluate(()=>{window.__testPadConnected=false;});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');
  assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.controller.intent.fire),undefined);await page.evaluate(()=>{window.__testPadConnected=true;});await neutral();await press(9);
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');report.checks.push('disconnect pauses and reconnect requires fresh neutral input');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');
  await pad([7]);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.controller.armed),false);await neutral();await press(9);await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');report.checks.push('blur/focus clears held controller input');
  await press(9);await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');await shot('controller-pause');
  await pad([1]);await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await neutral();report.checks.push('B resumes the pause menu');
  await page.keyboard.press('Escape');await page.locator('[data-action="resume"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
  assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.controller.inputDevice),'keyboard');await shot('keyboard-return');report.checks.push('keyboard/mouse UI path remains available');
  assert.deepEqual(report.errors,[]);report.result='PASS';console.log(JSON.stringify({result:report.result,checks:report.checks,errors:report.errors,hardwareTested:false}));
}catch(error){report.result='FAIL';report.failure=error.stack;await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
