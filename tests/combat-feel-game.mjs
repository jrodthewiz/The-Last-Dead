import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.COMBAT_FEEL_QA_OUTPUT||'docs/combat-feel-pass';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.setDefaultTimeout(120000);
const report={errors:[],requests:[]};
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400)report.requests.push(`${response.status()} ${response.url()}`);});
try{
 await page.goto((process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/')+'?debug=1&dungeon=2',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
 await page.locator('[data-action="start"]').click();
 await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,engine=await import('./engine.js'),{makeDungeonCourse}=await import('./playground/map/dungeon-course.js');
  Object.assign(d.run,engine.newRun(makeDungeonCourse(2)),{mode:'play',x:19.5,y:24.2,angle:-Math.PI/2,pitch:-.18,weapon:4,health:1000,waveDelay:999});
  for(let i=0;i<315;i++)engine.tick(d.run,1/60,{});
  const sample=d.run.course.enemies.find(enemy=>enemy.kind===1)||d.run.course.enemies[0];
  d.run.course.enemies=[{...sample,id:98001,kind:1,variant:'hexer',x:19.5,y:23.2,hp:500,maxHp:500,attack:999,attacking:false,strike:0,windup:0,moveSpeed:0,flash:0,dead:false}];
  d.run.waveDelay=999;d.run.time=12;d.run.mode='ready';d.renderer._firstCameraFrame=true;
  window.__combatFeel={d,engine,now:performance.now(),render:d.renderer.render.bind(d.renderer)};
  d.renderer.render=()=>{};
  window.__combatFeel.step=(frames=1,simulate=false)=>{const q=window.__combatFeel;for(let i=0;i<frames;i++){q.now+=1000/60;if(simulate){q.d.run.mode='play';q.engine.tick(q.d.run,1/60,{});q.d.run.mode='ready';}q.render(q.d.run,q.now);}};
  window.__combatFeel.step(2);
 });
 report.pose=await page.evaluate(async()=>{
  const q=window.__combatFeel,{createAfterlifeEnemy,animateAfterlifeEnemy}=await import('./npc-afterlife.js');
  const r=q.d.renderer,root=createAfterlifeEnemy(r._survivors.template,r._afterlifeClips,1,'hexer',3),state=root.userData.afterlife;
  const enemy={id:98002,kind:1,variant:'hexer',attack:999,attacking:false,windup:0,strike:0,flash:0,dead:false};
  animateAfterlifeEnemy(root,enemy,1000,3);
  const before=Object.entries(state.bones).map(([name,bone])=>({name,quaternion:bone.quaternion.toArray()}));
  animateAfterlifeEnemy(root,enemy,1000,3);
  const after=Object.entries(state.bones).map(([name,bone])=>({name,quaternion:bone.quaternion.toArray()}));
  return{source:root.userData.source,bones:before.length,maxDelta:Math.max(...before.flatMap((bone,i)=>bone.quaternion.map((value,j)=>Math.abs(value-after[i].quaternion[j]))))};
 });
 assert.equal(report.pose.source,'survivor-v02-afterlife');
 assert.ok(report.pose.bones>10&&report.pose.maxDelta<1e-5,'real survivor rig keeps the same pose on an unchanged mixer frame');
 report.burst=await page.evaluate(()=>{
  const q=window.__combatFeel,r=q.d.run,start=r.shotSequence,health=r.course.enemies[0].hp;
  for(let i=0;i<6;i++){r.mode='play';r.cooldowns.fill(0);q.engine.shoot(r);r.mode='ready';q.step(i===5?2:7,true);}
  const fx=q.d.renderer.weaponFX.impacts;
  return{shots:r.shotSequence-start,damage:health-r.course.enemies[0].hp,fleshTraces:r.tracers.filter(t=>t.surface==='flesh').length,casings:q.d.renderer.rifleCasings.mesh.count,impacts:fx.detailActive,gore:r.gore.length,blood:r.blood.length};
 });
 await page.screenshot({path:`${output}/machine-gun-impact.png`});
 assert.equal(report.burst.shots,6);
 assert.ok(report.burst.damage>0&&report.burst.fleshTraces>0,'machine gun hits a rendered enemy');
 assert.ok(report.burst.casings>0&&report.burst.impacts.wounds>0&&report.burst.impacts.drops>0,'firing produces ejected brass and layered flesh impacts');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
 console.log(JSON.stringify(report));
}finally{await browser.close();await writeFile(`${output}/combat-feel-qa.json`,JSON.stringify(report,null,2));}
