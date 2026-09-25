// Verify the authored Warden asset through the production game's enemy path.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output='docs/enemy-motion';
await mkdir(output,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const report={url:`http://127.0.0.1:${server.port}/`,errors:[],httpErrors:[],states:[],variants:[]};
page.on('pageerror',error=>report.errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))report.errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))report.httpErrors.push({url:response.url(),status:response.status()});});
try{
 await page.goto(report.url+'?debug=1&build08=enemy-visibility',{waitUntil:'commit',timeout:90000});
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:90000});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,null,{timeout:90000});
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.begin(false));
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.run?.mode==='play',null,{timeout:30000});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._wardenStatus==='ready',null,{timeout:60000});
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.health=10000;});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.run?.course?.enemies?.length>0,null,{timeout:30000});
 const sourceEnemy=await page.evaluate(()=>{
  const d=window.__DEAD_ARRIVAL__,run=d.run;
  const enemy=run.course.enemies[0];
  return {id:enemy.id,kind:enemy.kind,variant:enemy.variant,wave:run.wave};
 });
 await page.evaluate(async id=>{
  const d=window.__DEAD_ARRIVAL__,run=d.run;
  const engine=await import('./engine.js');
  const enemy=run.course.enemies.find(candidate=>candidate.id===id);
  // Exercise the production renderer with the campaign enemy record while
  // bypassing room gates that are unrelated to animation delivery.
  Object.assign(enemy,{kind:2,variant:'warden',dead:false,hp:1000,maxHp:1000,
   attacking:false,windup:0,windupTime:.65,strike:0,flash:0});
  const spawn=run.course.playerSpawn;
  run.x=spawn.x;run.y=spawn.y;run.z=0;run.pitch=0;
  let lane=null;
  for(let distance=2.5;distance<=7;distance+=.5){
   const x=spawn.x+Math.cos(spawn.angle)*distance;
   const y=spawn.y+Math.sin(spawn.angle)*distance;
   if(engine.canStand(run.course,x,y,.16)&&engine.castRay(run.course,spawn.x,spawn.y,spawn.angle,distance+.25).dist>=distance+.25){lane={x,y};break;}
  }
  if(!lane)throw new Error('No clear Warden review lane from player spawn');
  enemy.x=lane.x;enemy.y=lane.y;
  run.angle=Math.atan2(enemy.y-run.y,enemy.x-run.x);
  run.course.enemies=[enemy];
  run.health=10000;
  run.mode='ready';
  d.renderer._firstCameraFrame=true;
  const realRender=d.renderer.render.bind(d.renderer);
  d.renderer.render=()=>{};
  window.__wardenGameQA={d,enemy,realRender,now:performance.now()};
 },sourceEnemy.id);
 const renderState=async(name,changes)=>page.evaluate(({name,changes})=>{
  const q=window.__wardenGameQA;
  if(changes.moveX){q.enemy.x+=changes.moveX;delete changes.moveX;}
  Object.assign(q.enemy,{attacking:false,windup:0,strike:0,flash:0,dead:false,...changes});
  q.now+=100;
  q.realRender(q.d.run,q.now);
  const entry=q.d.renderer._enemyVisuals.get(q.enemy.id);
  const w=entry?.root?.userData?.warden;
  return {name,variant:q.enemy.variant,asset:entry?.template===q.d.renderer.bloodworksWardenTemplate,
   clipNames:w?Object.values(w.actions).map(action=>action.getClip().name):[],
   weights:w?Object.fromEntries(Object.entries(w.actions).map(([key,action])=>[key,action.getEffectiveWeight()])):{},
   visible:!!entry?.root?.visible,drawCalls:q.d.renderer.renderer.info.render.calls};
 },{name,changes});
 for(const variant of ['warden','wardenBulwark','wardenColossus']){
  const row=await renderState('idle',{variant});
  assert.equal(row.asset,true,variant+' should use the new Bloodworks GLB');
  assert.equal(row.visible,true);
  assert.equal(row.clipNames.length,6);
  assert.ok(row.drawCalls>0);
  report.variants.push(row);
 }
 const states=[
  ['walk',{variant:'warden',moveX:.12},'walk'],
  ['windup',{variant:'warden',attacking:true,windup:.15,windupTime:.65},'windup'],
  ['strike',{variant:'warden',strike:.24},'strike'],
  ['hit',{variant:'warden',flash:.16},'hit'],
  ['collapse',{variant:'warden',dead:true},'collapse'],
 ];
 for(const [name,changes,expected] of states){
  const row=await renderState(name,changes);
  assert.equal(row.asset,true);
  assert.ok(row.weights[expected]>.9,`${name} clip must own the pose`);
  report.states.push(row);
 }
 assert.deepEqual(report.errors,[]);
 assert.deepEqual(report.httpErrors,[]);
 report.sourceEnemy=sourceEnemy;
 report.ok=true;
 console.log(JSON.stringify({ok:true,sourceEnemy,variants:report.variants.map(v=>v.variant),states:report.states.map(s=>s.name),errors:report.errors,httpErrors:report.httpErrors},null,2));
}catch(error){report.ok=false;report.failure=String(error?.stack||error);report.snapshot=await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,r=d?.run;return {screen:d?.screen,mode:r?.mode,wave:r?.wave,pending:r?.director?.pending,buttons:[...document.querySelectorAll('button')].map(b=>({text:b.textContent,visible:!!b.getClientRects().length})),enemies:r?.course?.enemies?.map(e=>({kind:e.kind,variant:e.variant,dead:e.dead}))};}).catch(()=>null);await page.screenshot({path:`${output}/warden-in-game-failure.png`}).catch(()=>{});throw error;}
finally{
 await writeFile(`${output}/warden-in-game.json`,JSON.stringify(report,null,2)+'\n');
 await browser.close();
 server.server.closeIdleConnections?.();server.server.closeAllConnections?.();
 await new Promise(resolve=>server.server.close(resolve));
}
