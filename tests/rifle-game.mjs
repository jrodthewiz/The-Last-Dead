import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.RIFLE_QA_OUTPUT||'docs/rifle-pass';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={errors:[],frames:[],checks:{}};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto((process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/')+'?debug=1&dungeon=2',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
 await page.locator('[data-action="start"]').click();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 await page.locator('#world').click();
 await page.waitForFunction(()=>document.pointerLockElement);
 await page.evaluate(()=>{
  const d=window.__DEAD_ARRIVAL__;d.run.waveDelay=999;d.run.health=100;d.run.course.enemies=[];
  window.__rifleQA={render:d.renderer.render.bind(d.renderer)};
 });
 const state=()=>page.evaluate(()=>{
  const r=window.__DEAD_ARRIVAL__.run;
  return{weapon:r.weapon,sequence:r.shotSequence,shot:r.shot,heat:r.rifleHeat,charge:r.rifleCharge,burst:r.rifleBurst,mode:r.lastShotMode,cooldown:r.cooldowns[r.weapon]};
 });
 const capture=async name=>{
  const frame=await page.evaluate(()=>{
   const d=window.__DEAD_ARRIVAL__,r=d.run;
   r.mode='ready';window.__rifleQA.render(r,performance.now());d.renderer.render=()=>{};
   const renderer=d.renderer.renderer,gl=renderer.getContext(),pixels=new Uint8Array(16*16*4);
   gl.readPixels(gl.drawingBufferWidth/2-8,gl.drawingBufferHeight/2-8,16,16,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   const model=d.renderer.weaponGroups[r.weapon],mechanisms=[];
   model.traverse(n=>{if(n.userData.weaponMechanism)mechanisms.push({name:n.name,position:n.position.toArray(),rotation:n.rotation.toArray().slice(0,3),scale:n.scale.toArray()});});
   return{weapon:r.weapon,sequence:r.shotSequence,shot:r.shot,mode:r.lastShotMode,charge:r.rifleCharge,heat:r.rifleHeat,
    flash:d.renderer.muzzleFlash.children[0].visible,pressure:d.renderer.muzzleFlash.children[1].visible,
    casings:d.renderer.rifleCasings.mesh.count,kick:r.rifleKick||0,
    calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,
    fov:d.renderer.camera.fov,pixelLevels:new Set(pixels.filter((_,i)=>i%4!==3)).size,mechanisms};
  });
  assert.ok(frame.pixelLevels>2,'nonblank rendered canvas');
  await page.screenshot({path:`${output}/${name}.png`});report.frames.push({name,...frame});
  await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;d.renderer.render=window.__rifleQA.render;d.run.mode='play';});
 };
 // The original slots remain usable after extending input/HUD arrays.
 for(let i=0;i<4;i++){
  await page.keyboard.press(String(i+1));await page.mouse.down();
  await page.waitForFunction(w=>window.__DEAD_ARRIVAL__.run.weapon===w&&window.__DEAD_ARRIVAL__.run.cooldowns[w]>0,i);
  await page.mouse.up();
  if(i===0){await page.waitForTimeout(250);await capture('ossuary-reference');}
 }
 report.checks.originalSlots='4/4 switched and fired';
 await page.keyboard.press('5');await page.waitForTimeout(250);await capture('carrion-idle');
 let before=await state();await page.mouse.down();
 await page.waitForFunction(n=>window.__DEAD_ARRIVAL__.run.shotSequence>=n+4,before.sequence);
 await capture('carrion-auto');await page.mouse.up();
 assert.ok(report.frames.at(-1).casings>0&&report.frames.at(-1).kick>0,'automatic round ejects casings and kicks the weapon');
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.shot=.95;});await capture('carrion-flash');
 assert.ok(report.frames.at(-1).flash&&report.frames.at(-1).pressure,'automatic round shows muzzle and pressure flashes');
 assert.equal((await state()).mode,'auto');report.checks.automatic='held input produced >=4 shots';
 await page.waitForTimeout(600);await capture('carrion-return');
 before=await state();await page.mouse.down({button:'right'});await page.waitForTimeout(35);await page.mouse.up({button:'right'});
 await page.waitForFunction(n=>window.__DEAD_ARRIVAL__.run.shotSequence===n+3,before.sequence);
 await capture('carrion-burst');report.checks.burst='tap completed exactly three rounds';
 assert.ok(report.frames.at(-1).casings>0,'burst ejects casings');
 await page.keyboard.press('6');await page.waitForTimeout(350);await capture('mourning-idle');
 before=await state();await page.mouse.down();await page.waitForFunction(n=>window.__DEAD_ARRIVAL__.run.shotSequence>n,before.sequence);
 await capture('mourning-snap');await page.mouse.up();await page.waitForTimeout(900);
 before=await state();await page.mouse.down({button:'right'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.rifleCharge>.25);await capture('mourning-charge');
 await page.mouse.up({button:'right'});await page.waitForTimeout(100);
 assert.equal((await state()).sequence,before.sequence,'released charge must not fire');
 report.checks.chargeCancellation=true;
 await page.mouse.down({button:'right'});await page.waitForFunction(n=>window.__DEAD_ARRIVAL__.run.shotSequence>n,before.sequence);
 await capture('mourning-charged-shot');await page.mouse.up({button:'right'});
 assert.equal((await state()).mode,'charged');await page.waitForTimeout(1400);await capture('mourning-return');
 report.checks.chargedShot=true;
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await capture('rifles-mobile');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'narrow HUD must fit');
 await page.keyboard.press('5');await page.waitForTimeout(200);await capture('carrion-mobile');
 report.checks.mobileFit=true;
 report.audio=await page.evaluate(()=>{const a=window.__DEAD_ARRIVAL__.audio;return{...a.debugInfo,
  rifles:[4,5].map(w=>({weapon:w,shot:a._chooseBuffer('shot',w)?.duration,mechanism:!!a._chooseBuffer('mechanism',w)})),
  charge:!!a._chooseBuffer('rifle-charge',5)};});
 assert.equal(report.audio.loaded,true);assert.deepEqual(report.audio.errors,[]);
 assert.ok(report.audio.rifles.every(p=>p.shot>0&&p.mechanism)&&report.audio.charge,'both rifles decode distinct sounds and charge cue');
 assert.notEqual(report.audio.rifles[0].shot,report.audio.rifles[1].shot);
 assert.deepEqual(report.errors,[]);
 console.log(JSON.stringify({checks:report.checks,frames:report.frames.map(({name,calls,triangles})=>({name,calls,triangles})),errors:report.errors}));
}catch(error){report.failure=error.message;throw error;}finally{
 await browser.close();await writeFile(`${output}/qa-results.json`,JSON.stringify(report,null,2));
}
