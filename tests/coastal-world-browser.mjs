import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/coastal-world';await mkdir(output,{recursive:true});
const server=await startServer({port:0,root:process.cwd()});
const url=`http://127.0.0.1:${server.port}/?district=harbor`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(300000);
const started=Date.now();
const report={url,errors:[],httpErrors:[],fixture:'Clean production app, enemies removed after initialization; positions set for bounded route, pickup and vehicle tests; all tested movement and interactions use keyboard.',views:[]};
page.on('pageerror',e=>{report.errors.push(String(e));console.error('PAGEERROR',String(e));});page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(`${r.status()} ${r.url()}`);});
async function pressUntil(key,fn,arg){await page.keyboard.down(key);try{await page.waitForFunction(fn,arg,{timeout:30000});}finally{await page.keyboard.up(key);}await page.waitForTimeout(150);}
async function place(x,y,angle=0,pitch=0){await page.evaluate(p=>{Object.assign(window.__DEAD_ARRIVAL__.run,{...p,z:0,vx:0,vy:0,vz:0});},{x,y,angle,pitch});await page.waitForTimeout(350);}
try{
 console.log('Navigating',url);await page.goto(url,{waitUntil:'domcontentloaded'});console.log('DOM loaded');await page.screenshot({path:output+'/loading.png',timeout:15000}).catch(e=>console.log('Early screenshot',e.message));await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__);console.log('App exposed');
 if(await page.locator('[data-action="start"]').count())await page.locator('[data-action="start"]').click({force:true});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&!!window.__DEAD_ARRIVAL__.renderer.harborWorld);
 report.startupMs=Date.now()-started;console.log('Play started',report.startupMs);await page.screenshot({path:output+'/warming.png'});report.assets=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.ready);console.log('Assets ready');assert.deepEqual(report.assets.errors,[]);
 report.world=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.course.enemies=[];return {w:r.course.w,h:r.course.h,coastal:r.course.coastal};});assert.ok(report.world.coastal);assert.equal(report.world.w,96);assert.equal(report.world.h,80);
 await page.screenshot({path:`${output}/spawn.png`});
 await page.keyboard.press('KeyB');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.packUI.isOpen);await page.getByRole('button',{name:'FIELD MAP',exact:true}).click();await page.locator('[data-coast-destination="lighthouse"]').click();assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.coastalDestination),'lighthouse');await page.screenshot({path:`${output}/field-map.png`});await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');report.mapDestination=true;
 await place(31,14);await pressUntil('KeyW',()=>window.__DEAD_ARRIVAL__.run.x>33);report.crossedOriginalBoundary=await page.evaluate(()=>({x:window.__DEAD_ARRIVAL__.run.x,y:window.__DEAD_ARRIVAL__.run.y}));
 await page.screenshot({path:`${output}/dock-road-crossing.png`});
 const item=await page.evaluate(async()=>{const r=window.__DEAD_ARRIVAL__.run,{canStand,castRay}=await import('./engine.js');for(const p of r.course.weaponPickups){for(const [dx,dy]of [[.85,0],[-.85,0],[0,.85],[0,-.85]]){const x=p.x+dx,y=p.y+dy,angle=Math.atan2(-dy,-dx);if(canStand(r.course,x,y,.12)&&castRay(r.course,x,y,angle,1).dist>=.85){Object.assign(r,{x,y,angle,z:0,vx:0,vy:0});return p;}}}throw Error('No pickup approach');});
 await pressUntil('KeyW',id=>window.__DEAD_ARRIVAL__.run.backpack.weaponPickups?.includes(id),item.id);report.pickup=item.id;
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run,v=r.vehicle;Object.assign(r,{x:v.x-Math.sin(v.angle),y:v.y+Math.cos(v.angle),angle:v.angle,pitch:0,z:0,vx:0,vy:0});});
 await pressUntil('KeyQ',()=>window.__DEAD_ARRIVAL__.run.vehicle.occupied);await pressUntil('KeyW',()=>window.__DEAD_ARRIVAL__.run.vehicle.distance>=1);await pressUntil('Space',()=>Math.abs(window.__DEAD_ARRIVAL__.run.vehicle.speed)<.1);
 report.vehicle=await page.evaluate(()=>({...window.__DEAD_ARRIVAL__.run.vehicle}));await page.screenshot({path:`${output}/truck.png`});await pressUntil('KeyQ',()=>!window.__DEAD_ARRIVAL__.run.vehicle.occupied);
 for(const [name,x,y,angle]of [['east-district',58,14,0],['south-district',58,44,Math.PI/2],['water',58,78,Math.PI/2]]){await place(x,y,angle,-.12);await page.screenshot({path:`${output}/${name}.png`});report.views.push(name);}
 const before=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.harborWorld.water.material.uniforms.time.value);await page.waitForTimeout(500);report.waterAnimated=await page.evaluate(t=>window.__DEAD_ARRIVAL__.renderer.harborWorld.water.material.uniforms.time.value>t,before);assert.ok(report.waterAnimated);
 report.diagnostics=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._collectDiagnostics(window.__DEAD_ARRIVAL__.run));
 report.canvas=await page.evaluate(()=>{const source=window.__DEAD_ARRIVAL__.renderer.canvas;return {width:source.width,height:source.height,cssWidth:source.clientWidth,cssHeight:source.clientHeight};});assert.ok(report.canvas.width>0&&report.canvas.height>0);
 report.text=await page.evaluate(()=>window.render_game_to_text());
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.freeCamera={x:180,y:270,z:440,angle:-Math.PI/2,pitch:-.7};});await page.waitForTimeout(500);await page.screenshot({path:`${output}/overview.png`});
 if(process.env.COASTAL_SKILL_CLIENT==='1'){
  let client=await readFile('C:/Users/wolfk/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js','utf8');
  client=client.replace('import { chromium } from "playwright";','import {createRequire} from "node:module"; const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||"playwright");').replace('args: ["--use-gl=angle", "--use-angle=swiftshader"],','executablePath:process.env.CHROME_PATH,').replace('a: "KeyA",','a: "KeyA", w:"KeyW",');
  client=client.replace('await page.waitForTimeout(500);','await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:180000});').replace('await page.waitForTimeout(250);','await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==="play",null,{timeout:180000});');
  await writeFile(`${output}/skill-client.mjs`,client);await writeFile(`${output}/actions.json`,JSON.stringify({steps:[{buttons:['w'],frames:24},{buttons:[],frames:12}]}));
  report.skillClientExit=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[`${output}/skill-client.mjs`,'--url',url,'--click-selector','[data-action="start"]','--actions-file',`${output}/actions.json`,'--iterations','1','--screenshot-dir',`${output}/skill`],{stdio:'inherit'});p.once('error',reject);p.once('exit',resolve);});assert.equal(report.skillClientExit,0);
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log(JSON.stringify({passed:true,world:[report.world.w,report.world.h],waterAnimated:report.waterAnimated}));
}catch(e){console.error('FAIL',e);report.failure=String(e.stack);report.text=await page.evaluate(()=>window.render_game_to_text?.()).catch(()=>null);await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw e;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.server.close(resolve));}


