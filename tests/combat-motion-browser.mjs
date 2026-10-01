import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.COMBAT_MOTION_OUTPUT||'output/playwright/combat-motion';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:output,size:{width:1280,height:720}}});
const page=await context.newPage();
const report={errors:[],poses:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
try{
  await page.goto((process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/')+'combat-review.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__COMBAT_REVIEW__?.ready,null,{timeout:180000});
  await page.locator('#weapon').selectOption('4');
  await page.locator('#motion').selectOption('idle');
  await page.waitForTimeout(900);
  await page.screenshot({path:`${output}/carrion-idle.png`});
  for(const mode of ['look','walk','land','aim','fire']){
    await page.locator('#motion').selectOption(mode);
    await page.waitForTimeout(mode==='walk'?3400:1400);
    report.poses.push(await page.evaluate(mode=>{
      const a=window.__COMBAT_REVIEW__,rig=a.renderer.weaponRig;
      return{mode,position:rig.position.toArray(),rotation:rig.rotation.toArray().slice(0,3),sequence:a.run.shotSequence,diagnostics:a.renderer.diagnostics()};
    },mode));
    await page.screenshot({path:`${output}/carrion-${mode}.png`});
  }
  assert.ok(report.poses.at(-1).sequence>0,'actual shoot path drives rifle');
  assert.ok(report.poses.every(p=>[...p.position,...p.rotation].every(Number.isFinite)),'finite poses');
  assert.ok(new Set(report.poses.map(p=>JSON.stringify(p.position))).size>3,'distinct motion responses');
  await page.locator('#motion').selectOption('idle');
  await page.locator('#pause').click();
  report.weapons=[];
  for(let weapon=0;weapon<8;weapon++){
    const result=await page.evaluate(weapon=>{
      const a=window.__COMBAT_REVIEW__;a.select(weapon);
      for(let i=0;i<80;i++)a.step(1/120);
      const r=a.renderer.renderer,gl=r.getContext(),pixel=new Uint8Array(64*64*4);
      gl.readPixels(gl.drawingBufferWidth/2-32,gl.drawingBufferHeight/2-32,64,64,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      return{weapon,name:a.renderer.weaponGroups[weapon].name,calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures,levels:new Set(pixel.filter((_,i)=>i%4!==3)).size};
    },weapon);
    assert.ok(result.levels>2,'nonblank world');report.weapons.push(result);
    await page.screenshot({path:`${output}/weapon-${weapon}-idle.png`});
    if(weapon===0)await page.screenshot({path:`${output}/ossuary-idle.png`});
  }
  await page.locator('#weapon').selectOption('4');
  await page.locator('#reduced').check();
  await page.evaluate(()=>{const a=window.__COMBAT_REVIEW__;for(let i=0;i<30;i++)a.step(1/60);});
  assert.equal(await page.evaluate(()=>window.__COMBAT_REVIEW__.renderer.settings.reducedMotion),true);
  await page.locator('#bodycam').uncheck();
  await page.evaluate(()=>window.__COMBAT_REVIEW__.step(1/60));
  await page.screenshot({path:`${output}/carrion-no-bodycam.png`});
  await page.locator('#bodycam').check();
  await page.setViewportSize({width:1600,height:900});
  await page.evaluate(()=>{const a=window.__COMBAT_REVIEW__;a.renderer.resize();a.step(1/60);});
  await page.screenshot({path:`${output}/carrion-wide-desktop.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'review fits widescreen desktop');
  assert.deepEqual(report.errors,[]);report.ok=true;
  console.log(JSON.stringify({ok:true,weapons:report.weapons,output}));
}catch(error){report.failure=error.message;throw error;}finally{
  await context.close();await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();
}
