// Desktop WebGPU release check for the live first-person pass.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.BODYCAM_QA_OUTPUT||'output/playwright/bodycam';
await mkdir(output,{recursive:true});
const ownServer=process.env.DEAD_ARRIVAL_URL?null:await startServer({root:resolve('dist'),port:0});
const base=process.env.DEAD_ARRIVAL_URL||`http://127.0.0.1:${ownServer.port}/`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.setDefaultTimeout(15000);
const report={url:base,checks:[],errors:[],frames:{}};
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});

const liveFrame=()=>page.evaluate(()=>{
  const gfx=window.__DEAD_ARRIVAL__.renderer;
  return {
    screen:window.__DEAD_ARRIVAL__.screen,
    backend:!!gfx.renderer?.isWebGPURenderer,
    enabled:gfx.bodycam.enabled,
    reducedMotion:gfx.bodycam.reducedMotion,
    blur:gfx.bodycam.diagnostics().blur,
    target:gfx.bodycam.target&&[gfx.bodycam.target.width,gfx.bodycam.target.height],
    canvas:[gfx.canvas.width,gfx.canvas.height],
    activeIsSource:gfx.renderer.getRenderTarget()===gfx.bodycam.target,
  };
});

try{
  await page.goto(`${base}?debug=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__?.renderer,undefined,{timeout:90000});
  await page.locator('[data-action="settings"]').click();
  await page.getByText('Adaptive exposure',{exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.settings.bodycam),false);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__?.renderer,undefined,{timeout:90000});
  assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.settings.bodycam),false,'render preference persists');
  report.checks.push('Render preference persists after reload');

  await page.locator('[data-action="settings"]').click();
  await page.getByText('Adaptive exposure',{exact:true}).click();
  await page.locator('[data-action="close-settings"]').click();
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play'&&window.__DEAD_ARRIVAL__.renderer._weaponsPrepared,undefined,{timeout:180000});
  report.frames.play=await liveFrame();
  assert.equal(report.frames.play.backend,true,'native WebGPU renderer');
  assert.equal(report.frames.play.enabled,true);
  assert.deepEqual(report.frames.play.target,report.frames.play.canvas,'source target matches drawing buffer');
  assert.equal(report.frames.play.activeIsSource,false,'source target is released after drawing');
  report.checks.push('Live WebGPU pass resolves to the screen');

  report.frames.recovered=await page.evaluate(()=>{
    const gfx=window.__DEAD_ARRIVAL__.renderer;
    gfx.renderer.setRenderTarget(gfx.bodycam.target);
    gfx._renderScene(performance.now());
    return {activeIsSource:gfx.renderer.getRenderTarget()===gfx.bodycam.target,activeIsScreen:gfx.renderer.getRenderTarget()===null};
  });
  assert.equal(report.frames.recovered.activeIsSource,false,'pass cannot read and write its source');
  assert.equal(report.frames.recovered.activeIsScreen,true,'pass restores the screen target');
  report.checks.push('An interrupted source target resolves safely');

  await page.setViewportSize({width:960,height:600});
  await page.waitForTimeout(300);
  report.frames.resized=await liveFrame();
  assert.deepEqual(report.frames.resized.target,report.frames.resized.canvas,'resized source matches drawing buffer');
  assert.equal(report.frames.resized.activeIsSource,false);
  report.checks.push('Desktop resize refreshes the source target');

  await page.keyboard.press('Escape');
  await page.locator('[data-action="settings"]').click();
  await page.getByText('Reduced motion',{exact:true}).click();
  await page.locator('[data-action="close-settings"]').click();
  await page.locator('[data-action="resume"]').click();
  await page.waitForTimeout(300);
  report.frames.reducedMotion=await liveFrame();
  assert.equal(report.frames.reducedMotion.reducedMotion,true);
  assert.deepEqual(report.frames.reducedMotion.blur,[0,0]);
  report.checks.push('Reduced motion removes pass blur');
  await page.screenshot({path:`${output}/desktop-final.png`});
  await page.waitForTimeout(500);
  assert.deepEqual(report.errors,[]);
  report.passed=true;
  console.log(JSON.stringify({checks:report.checks,errors:report.errors,frames:report.frames}));
}catch(error){report.failure=error.stack;throw error;}
finally{
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  await browser.close();
  if(ownServer){ownServer.server.closeAllConnections();await new Promise(resolve=>ownServer.server.close(resolve));}
}
