import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const out='output/playwright/ui-polish-2026-10-04';await mkdir(out,{recursive:true});
const phase=process.env.UI_POLISH_PHASE||'after';
const server=await startServer({root:resolve(process.env.UI_POLISH_ROOT||'.'),port:0,spaFallback:false});
const origin=`http://127.0.0.1:${server.port}`;
let browser;
const report={phase,scope:'Real UI and inventory modules over a frozen frame captured from the running game. Layout fixtures inject mission state; separate live-game checks use real inputs.',errors:[],httpErrors:[],views:[],fit:[],controls:[]};
report.runtimeRoot=resolve(process.env.UI_POLISH_ROOT||'.');
report.sourceHashes={};
for(const file of ['ui.js','styles.css','horror-ui.css','menu-cinematic.css','scavenger-pack.css',...(phase==='before'?[]:['game-interface.css'])]){
  const bytes=await readFile(phase==='before'?`${out}/before-files/${file}`:resolve(report.runtimeRoot,file));
  report.sourceHashes[file]=createHash('sha256').update(bytes).digest('hex');
}
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  if(phase==='before'){
    for(const file of ['styles.css','horror-ui.css','menu-cinematic.css','scavenger-pack.css','ui.js']){
      const body=await readFile(`${out}/before-files/${file}`);
      await context.route(`**/${file}`,route=>route.fulfill({contentType:file.endsWith('.js')?'text/javascript':'text/css',body}));
    }
    await context.route('**/game-interface.css',route=>route.fulfill({contentType:'text/css',body:''}));
  }
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
  if(process.env.UI_POLISH_LIVE){
    await page.goto(`${origin}/?debug=1&horrorqa=1`);
    await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});
    await page.screenshot({path:`${out}/${phase}-live-title.png`});
    if(phase==='before'){
      const hidden=await page.addStyleTag({content:'#ui,.scavenger-ui,#bodycam-hud{visibility:hidden!important}'});
      await page.screenshot({path:`${out}/world-frame.png`});await hidden.evaluate(node=>node.remove());
    }
    if(process.env.UI_POLISH_LIVE==='1'){
    await page.locator('[data-action="start"]').click({timeout:60000});
    await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:360000});
    await page.evaluate(()=>{
      window.__HORROR_QA__.setManual(true);const q=window.__DEAD_ARRIVAL__;
      Object.assign(q.run,{x:206/4,y:56/4,z:0,angle:Math.PI,pitch:-.025,vx:0,vy:0,vz:0,speed:0,weapon:0,damage:0});
      // This is a UI journey. Hold the rendered world after the actual game starts
      // so several simultaneous game browsers do not keep allocating render resources.
      q.renderer.render(q.run,performance.now());q.renderer.render=()=>{};
    });
    await page.screenshot({path:`${out}/${phase}-live-hud.png`});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='pause');
    await page.screenshot({path:`${out}/${phase}-live-pause.png`});
    await page.locator('[data-action="settings"]').click();
    await page.getByRole('slider',{name:'Master volume',exact:true}).focus();await page.keyboard.press('ArrowLeft');
    const volume=await page.evaluate(()=>window.__DEAD_ARRIVAL__.ui.prefs.volume);
    assert.equal(volume,.49);await page.screenshot({path:`${out}/${phase}-live-settings.png`,animations:'disabled'});
    await page.getByRole('button',{name:'Close settings',exact:true}).click();
    await page.locator('[data-action="resume"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
    await page.keyboard.press('b');await page.waitForFunction(()=>!document.querySelector('.pack-overlay').hidden);
    await page.getByRole('button',{name:'JOURNAL',exact:true}).click();assert(await page.locator('.pack-journal').isVisible());
    await page.getByRole('button',{name:'FIELD MAP',exact:true}).click();assert(await page.locator('.pack-map').isVisible());
    await page.getByRole('button',{name:'Close backpack and return to game',exact:true}).click();
    await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
    report.live={start:true,pauseResume:true,settingsPersisted:volume,journal:true,map:true,packReturn:true,world:'Actual game started; world frame then held for UI-only inputs.',pointerCapture:'Automation follows the existing webdriver path, which skips pointer lock.'};
    console.log('Live game UI journey passed',phase);
    }
  }
  // Test-only fixture remains outside the production build.
  const body=await readFile('tests/fixtures/ui-polish.html','utf8');
  await page.route('**/ui-polish-fixture',route=>route.fulfill({contentType:'text/html',body}));
  // Source evidence lives outside dist; route the frozen frame into either server.
  const frame=await readFile(`${out}/world-frame.png`);
  await page.route('**/ui-polish-world.png',route=>route.fulfill({contentType:'image/png',body:frame}));
  await page.goto(`${origin}/ui-polish-fixture`);await page.waitForFunction(()=>window.qaReady);
  await page.evaluate(()=>document.body.style.backgroundImage='url("/ui-polish-world.png")');
  for(const [width,height] of phase==='before'?[[1280,800]]:[[1280,800],[1920,1080],[844,480],[390,844],[320,640],[720,360]]){
    await page.setViewportSize({width,height});
    for(const state of ['hud','hud-complete','menu','controls','coop','pause','settings','gear','journal','map','recovery','loading','critical']){
      await page.evaluate(state=>interfacePolishQA.show(state),state);
      const fit=await page.evaluate(()=>{
        const nodes=[...document.querySelectorAll('#ui button,.scavenger-ui button')].filter(node=>{
          const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&!node.closest('[hidden]')&&getComputedStyle(node).visibility!=='hidden'&&getComputedStyle(node).display!=='none';
        });
        const tiny=nodes.filter(node=>{const r=node.getBoundingClientRect();return r.width<43.5||r.height<43.5;}).map(node=>({name:node.getAttribute('aria-label')||node.textContent.trim(),width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}));
        const overflow=[...document.querySelectorAll('.menu-shell,.pause-card,.finish-card,.settings-drawer,.pack-panel')].filter(node=>node.getClientRects().length&&node.scrollWidth>node.clientWidth+2).map(node=>node.className);
        const rows=[...document.querySelectorAll('.settings-drawer.is-open .setting-row')];
        const crowdedSliders=rows.filter((row,index)=>{const range=row.querySelector('input[type="range"]'),next=rows[index+1]?.querySelector('.setting-copy');return range&&next&&range.getBoundingClientRect().bottom>next.getBoundingClientRect().top;}).length;
        const mission=document.querySelector('[data-hud="objective"]');
        const missionClipped=mission&&mission.getClientRects().length>0&&(mission.scrollWidth>mission.clientWidth+2||mission.scrollHeight>mission.clientHeight+2);
        const lifePercent=Number(document.querySelector('.hud')?.style.getPropertyValue('--life'));
        const primary=document.querySelector('.screen .start-button,.screen .pause-actions button:first-child,.screen .finish-actions button:first-child');
        const primaryBounds=primary?.getBoundingClientRect();
        const primaryVisible=!primaryBounds||(primaryBounds.top>=0&&primaryBounds.bottom<=innerHeight);
        return {horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,tiny,overflow,crowdedSliders,missionClipped:!!missionClipped,lifePercent,primaryVisible};
      });
      report.fit.push({width,height,state,...fit});
      if(phase!=='before'){
        assert.equal(fit.horizontalOverflow,false,`${state} ${width} document overflow`);
        assert.deepEqual(fit.overflow,[],`${state} ${width} panel overflow`);
        assert.deepEqual(fit.tiny,[],`${state} ${width} small targets`);
        assert.equal(fit.crowdedSliders,0,`${state} ${width} overlapping setting rows`);
        assert.equal(fit.missionClipped,false,`${state} ${width} clipped mission text`);
        if(['menu','pause','recovery'].includes(state))assert.equal(fit.primaryVisible,true,`${state} ${width} primary action requires scrolling`);
        if(state==='critical')assert.equal(fit.lifePercent,18,'life gauge follows actual health');
        if(state==='hud')assert.equal(fit.lifePercent,100,'life gauge restores on a fresh HUD');
      }
      if(width===1280||width===390||width===844||height===360){
        await page.screenshot({path:`${out}/${phase}-${state}-${width}x${height}.png`});report.views.push(`${phase}-${state}-${width}x${height}.png`);
      }
    }
    console.log('Checked',phase,width,height);
  }
  if(phase!=='before'){
    await page.setViewportSize({width:1280,height:800});
    await page.evaluate(()=>interfacePolishQA.show('menu'));
    await page.locator('[data-action="start"]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>interfacePolishQA.calls.start),1);report.controls.push('Keyboard Start');
    await page.locator('[data-action="guide"]').click();assert(await page.locator('.field-guide').isVisible());
    await page.locator('[data-action="guide"]').click();assert.equal(await page.locator('.field-guide').isVisible(),false);report.controls.push('Controls disclosure');
    await page.evaluate(()=>interfacePolishQA.show('pause'));
    await page.locator('[data-action="resume"]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>interfacePolishQA.calls.resume),1);report.controls.push('Keyboard Resume');
    await page.evaluate(()=>{interfacePolishQA.ui.setInputDevice('gamepad');interfacePolishQA.show('pause');});
    assert.equal(await page.locator('[data-resume-key]').innerText(),'START');report.controls.push('Controller resume cue');
    await page.evaluate(()=>interfacePolishQA.show('settings'));
    await page.getByRole('slider',{name:'Master volume',exact:true}).focus();await page.keyboard.press('ArrowLeft');
    assert.ok(await page.evaluate(()=>interfacePolishQA.calls.settings)>0);report.controls.push('Slider setting callback');
    await page.locator('[data-setting="autoRun"]').focus();await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'close-settings');report.controls.push('Settings forward focus wrap');
    await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.setting),'autoRun');report.controls.push('Settings reverse focus wrap');
    const stickyClose=await page.locator('[data-action="close-settings"]').boundingBox();
    assert.ok(stickyClose.y>=0&&stickyClose.y+stickyClose.height<=800);report.controls.push('Settings close remains visible after scrolling');
    await page.evaluate(()=>interfacePolishQA.ui.escape());assert.equal(await page.locator('.settings-drawer').getAttribute('aria-hidden'),'true');report.controls.push('Settings dismissal');
    assert.equal(await page.locator('.settings-drawer').evaluate(node=>node.inert),true);report.controls.push('Closed settings excluded from focus');
    await page.evaluate(()=>interfacePolishQA.show('journal'));assert.equal(await page.locator('.pack-journal article').count(),7);
    await page.locator('.pack-journal summary').nth(1).focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('.pack-journal details[open]').count(),2);report.controls.push('Keyboard journal expansion');
    await page.evaluate(()=>interfacePolishQA.show('recovery'));await page.locator('[data-action="restart"]').click();
    assert.equal(await page.evaluate(()=>interfacePolishQA.calls.restart),1);report.controls.push('Checkpoint retry');
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error.stack||error);throw error;}
finally{await writeFile(`${out}/${phase}-report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
