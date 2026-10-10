import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.UI_OUTPUT||'output/playwright/game-interface';await mkdir(output,{recursive:true});
const server=await startServer({port:0,root:resolve(process.env.UI_ROOT||'dist')});
const url=`http://127.0.0.1:${server.port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
const report={errors:[],httpErrors:[],fit:[],controls:[],buildRoot:process.env.UI_ROOT||'dist'};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',error=>report.errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});});
 const fixture=await readFile('tests/fixtures/game-interface.html','utf8');
 await page.route('**/ui-qa',route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.goto(`${url}/ui-qa`);await page.waitForFunction(()=>window.qaReady);
 await page.evaluate(()=>interfaceQA.pause());assert.equal(await page.getByRole('button',{name:'RESUME ESC',exact:true}).isVisible(),true);assert.equal(await page.getByRole('button',{name:'FREE CAMERA F2',exact:true}).isVisible(),true);
 await page.evaluate(()=>interfaceQA.ui.setInputDevice('gamepad'));assert.equal(await page.getByRole('button',{name:'RESUME START',exact:true}).isVisible(),true);await page.evaluate(()=>{interfaceQA.ui.setInputDevice('keyboard');interfaceQA.flight();});
 await page.locator('[data-dev-help]').click();assert.equal(await page.locator('#dev-camera-help').isVisible(),true);
 await page.locator('[data-dev-help]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#dev-camera-help').isVisible(),false);
 await page.evaluate(()=>{interfaceQA.state.pointerLocked=true;interfaceQA.flight();});assert.equal(await page.locator('[data-camera-look]').innerText(),'RELEASE MOUSE');
 await page.evaluate(()=>{interfaceQA.state.pointerLocked=false;Object.assign(interfaceQA.state.pose,{x:-999999.9,y:999999.9,z:-999999.9});interfaceQA.state.speed=96;interfaceQA.flight();});
 for(const [width,height]of [[1440,900],[1280,720],[844,480],[390,844],[320,640],[720,360]]){
  await page.setViewportSize({width,height});
  for(const state of ['flight','help','pause','menu']){
   await page.evaluate(state=>{const qa=interfaceQA;if(state==='help'){qa.flight();qa.camera.help.hidden=true;qa.camera.toggleHelp();}else{qa.camera.help.hidden=true;qa.camera.helpButton.setAttribute('aria-expanded','false');qa[state]();}},state);
   const fit=await page.evaluate(state=>{
    const root=state==='flight'||state==='help'?document.querySelector('.dev-inspector'):document.querySelector('.screen');
    const selector=state==='flight'||state==='help'?'.dev-flight-actions button':state==='pause'?'.pause-actions button':'.menu-actions>button,.coop-toggle';
    const controls=[...root.querySelectorAll(selector)].map(node=>{const r=node.getBoundingClientRect();return{text:node.innerText.replaceAll('\n',' '),x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,overflow:node.scrollWidth>node.clientWidth+1};});
    const textOverflow=[...root.querySelectorAll('.dev-camera-position output,.dev-camera-speed output')].some(node=>node.scrollWidth>node.clientWidth+1);
    return{width:innerWidth,height:innerHeight,state,rootOverflow:root.scrollWidth>root.clientWidth+1,textOverflow,controls};
   },state);
   assert.equal(fit.rootOverflow,false,`${width}x${height} ${state} horizontal overflow`);assert.equal(fit.textOverflow,false,`${width}x${height} telemetry overflow`);
   for(const control of fit.controls){assert.equal(control.overflow,false,`${width}x${height} ${state} ${control.text} text fit`);assert.ok(control.x>=0&&control.right<=width+1,`${width}x${height} ${state} ${control.text} horizontal fit`);assert.ok(control.height>=44,'44px action targets');if(state==='flight'||state==='help')assert.ok(control.y>=0&&control.bottom<=height+1,'camera controls stay in viewport');}
   report.fit.push(fit);if(width===1280||width===390)await page.screenshot({path:`${output}/fixture-${state}-${width}.png`});
  }
 }
 await page.evaluate(()=>interfaceQA.pause());await page.locator('[data-action="resume"]').click();assert.equal(await page.evaluate(()=>window.resumed),1);
 await page.locator('[data-action="restart"]').click();assert.equal(await page.evaluate(()=>window.restarted),1);report.controls.push('Fixture: keyboard help, captured-mouse state, resume/restart callbacks, large telemetry values, six viewport sizes');
 if(!process.env.UI_FIXTURE_ONLY){
  await page.setViewportSize({width:1280,height:800});await page.goto(`${url}/?debug=1`);await page.waitForFunction(()=>window.__DEAD_ARRIVAL__,null,{timeout:60000});await page.screenshot({path:`${output}/title.png`});
  const started=Date.now();await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:360000});report.readyMs=Date.now()-started;console.log(JSON.stringify({readyMs:report.readyMs}));
  await page.screenshot({path:`${output}/gameplay.png`});await page.keyboard.press('F2');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.inspector.active&&!!document.querySelector('.dev-inspector:not([hidden])'));
  const before=await page.evaluate(()=>{const a=window.__DEAD_ARRIVAL__;return{pose:{...a.inspector.pose},time:a.run.time,health:a.run.health};});
  await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');
  assert.ok(await page.evaluate(before=>Math.hypot(window.__DEAD_ARRIVAL__.inspector.pose.x-before.x,window.__DEAD_ARRIVAL__.inspector.pose.z-before.z)>1,before.pose));
  await page.keyboard.press('r');await page.waitForFunction(pose=>JSON.stringify(window.__DEAD_ARRIVAL__.inspector.pose)===JSON.stringify(pose),before.pose);
  await page.screenshot({path:`${output}/free-camera.png`});
  await page.keyboard.press('h');await page.waitForFunction(()=>!document.querySelector('#dev-camera-help').hidden);await page.screenshot({path:`${output}/free-camera-help.png`});await page.keyboard.press('h');
  await page.locator('[data-dev-capture]').click();await page.waitForFunction(()=>document.pointerLockElement?.id==='world');await page.waitForFunction(()=>document.querySelector('[data-camera-look]').textContent==='RELEASE MOUSE');
  await page.keyboard.press('Tab');await page.waitForFunction(()=>!document.pointerLockElement);await page.waitForFunction(()=>document.querySelector('[data-camera-look]').textContent==='LOOK WITH MOUSE');
  assert.deepEqual(await page.evaluate(()=>({time:window.__DEAD_ARRIVAL__.run.time,health:window.__DEAD_ARRIVAL__.run.health})),{time:before.time,health:before.health},'player stays frozen while inspecting');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');await page.screenshot({path:`${output}/pause.png`});
  await page.locator('.pause-actions [data-action="settings"]').click();assert.equal(await page.locator('.settings-drawer.is-open').isVisible(),true);await page.locator('[data-action="close-settings"]').click();
  await page.locator('.pause-actions [data-dev-inspect]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.inspector.active);
  assert.equal(await page.evaluate(()=>!!document.pointerLockElement),false,'resuming inspection leaves the mouse available for camera actions');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/free-camera-narrow.png`});await page.locator('.dev-inspector [data-dev-inspect]').click();await page.waitForFunction(before=>!window.__DEAD_ARRIVAL__.inspector.active&&window.__DEAD_ARRIVAL__.run.time>before.time,before);
  report.controls.push('Production game: Start, F2, WASD fly, R reset, H help, mouse capture, Tab release, frozen player, Esc pause, Settings, pause-to-camera, return to player');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log(JSON.stringify({passed:true,views:report.fit.length,controls:report.controls}));
}catch(error){report.failure=String(error.stack||error);throw error;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections?.();await new Promise(done=>server.server.close(done));}
