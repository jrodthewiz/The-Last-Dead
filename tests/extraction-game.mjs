import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.EXTRACTION_QA_OUTPUT||'docs/extraction-pass';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const report={errors:[],frames:[],checks:{}};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.setDefaultTimeout(120000);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});
 await page.goto((process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/')+'?debug=1&sector=0',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer);
 // Headless Chrome can leave compileAsync unresolved on this large scene; the
 // QA harness exercises gameplay after forcing the optional shader warmup gate.
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer._weaponsPrepared=true;});
 await page.locator('[data-action="start"]').click();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 await page.locator('#world').click();
 await page.waitForFunction(()=>document.pointerLockElement);
 const fixture=await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,r=d.run;
  const {castRay}=await import('/engine.js');
  const choices=Array.from({length:16},(_,i)=>({angle:i*Math.PI/8,clear:castRay(r.course,r.x,r.y,i*Math.PI/8,1.4).dist}));
  const facing=choices.sort((a,b)=>b.clear-a.clear)[0];
  r.angle=facing.angle;r.pitch=-.32;
  r.vx=0;r.vy=0;r.vz=0;r.speed=0;r.z=0;r.health=100;r.damage=0;r.waveDelay=999;
  r.course.enemies=[{id:981,x:r.x+Math.cos(r.angle)*.72,y:r.y+Math.sin(r.angle)*.72,z:0,hp:0,maxHp:5,kind:0,variant:'stalker',dead:true,meleeZ:0,flash:0,attack:99,phase:0}];
  r.style=0;r.styleTotal=0;r.stylePending=84;
  window.__extractionAudio=[];
  const originalPlay=d.audio.play.bind(d.audio);
  d.audio.play=(type,...args)=>{
   const played=originalPlay(type,...args);
   if(String(type).startsWith('extract-'))window.__extractionAudio.push({type,played:!!played});
   return played;
  };
  return{x:r.x,y:r.y,angle:r.angle,clear:facing.clear,enemy:r.course.enemies[0],cell:r.course.cells[Math.floor(r.y)*r.course.w+Math.floor(r.x)]};
 });
 report.fixture=fixture;
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.extractCandidateId===981);
 assert.equal(await page.locator('[data-extraction-prompt]').isVisible(),true);
 const capture=async name=>{
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';});
  const state=await page.evaluate(()=>{
   const d=window.__DEAD_ARRIVAL__,r=d.run,fx=d.renderer.extractionVFX;
   return{phase:r.extraction.phase,progress:r.extraction.progress,style:r.style,styleTotal:r.styleTotal,pending:r.stylePending,
    extracted:r.course.enemies[0]?.extracted===true,fx:fx.diagnostics(),gunVisible:d.renderer.weaponGroups.some(group=>group.visible),
    prompt:document.querySelector('[data-extraction-prompt]')?.textContent?.replace(/\s+/g,' ').trim(),
    audio:d.audio.debugInfo,drawCalls:d.renderer.renderer.info.render.calls,triangles:d.renderer.renderer.info.render.triangles};
  });
  await page.screenshot({path:`${output}/${name}.png`});
  report.frames.push({name,...state});
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';});
  return state;
 };
 const freezeWhen=async(phase,field,threshold)=>page.waitForFunction(({phase,field,threshold})=>{
  const r=window.__DEAD_ARRIVAL__.run;
  if(r.extraction.phase!==phase||(r.extraction[field]||0)<=threshold)return false;
  r.mode='ready';
  return true;
 },{phase,field,threshold});
 await capture('ready');
 await page.keyboard.down('g');
 await freezeWhen('draw','progress',.10);
 const draw=await capture('blood-draw');
 assert.equal(draw.styleTotal,0);assert.equal(draw.gunVisible,false);
 await freezeWhen('incise','stageProgress',.28);
 const incise=await capture('incision');
 assert.equal(incise.styleTotal,0);
 await freezeWhen('rip','stageProgress',.40);
 const rip=await capture('heart-rip');
 assert.equal(rip.styleTotal,0);assert.ok(rip.fx.droplets>0);
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies[0].extracted===true);
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.renderer.extractionVFX.diagnostics().phase==='complete');
 await page.keyboard.up('g');
 const complete=await capture('extracted');
 assert.ok(complete.styleTotal>0);assert.equal(complete.pending,0);
 assert.equal(complete.extracted,true);
 assert.equal(complete.fx.worldVisible,true);
 assert.equal(complete.gunVisible,false);
 report.checks.desktopSequence=true;
 report.checks.scoreGated=true;
 report.checks.audioLoaded=complete.audio.loaded===true&&complete.audio.errors.length===0;
 assert.equal(report.checks.audioLoaded,true);
 report.audioEvents=await page.evaluate(()=>window.__extractionAudio);
 for(const type of ['extract-start','extract-draw','extract-incise','extract-rip','extract-complete'])
  assert.ok(report.audioEvents.some(event=>event.type===type&&event.played),`${type} should trigger a sound`);
 report.checks.stageAudio=true;
 assert.deepEqual(report.errors,[]);
 console.log(JSON.stringify({checks:report.checks,frames:report.frames.map(({name,phase,styleTotal,fx,gunVisible})=>({name,phase,styleTotal,fx,gunVisible})),errors:report.errors}));
}catch(error){report.failure=error.stack||error.message;throw error;}finally{
 await browser.close();
 await writeFile(`${output}/qa-results.json`,JSON.stringify(report,null,2));
}
