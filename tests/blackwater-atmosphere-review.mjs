import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=resolve(process.env.BLACKWATER_QA_OUTPUT||'output/playwright/blackwater-atmosphere');await mkdir(output,{recursive:true});
const server=await startServer({root:resolve(process.env.BLACKWATER_QA_ROOT||'dist'),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist']});
const report={views:{},errors:[],httpErrors:[],scope:'Fixed seed and time48, identical cameras and 240p image. Gameplay, world photography, no-post and portrait samples. No long-session or physical-phone claim.'};
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:output+'/video',size:{width:960,height:600}}}),page=await context.newPage();await guardBackgroundInput(page);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push([r.status(),r.url()]);});
 await page.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});await page.locator('#begin').click();
 await page.evaluate(()=>{const g=window.__BLACKWATER__;g.setTime(48);for(const e of g.actors.enemies)e.alive=false;g.teleport(-745,282,1.27);});await page.waitForTimeout(900);await page.screenshot({path:output+'/01-arrival-play.png'});
 const views=[
  ['02-coast',[-890,100,-130,-800,40,-275]],
  ['03-village',[-495,48,260,-390,25,120]],
  ['04-oldtown',[590,16,7,635,16.5,-2]],
  ['05-civic',[672,16,8,742,27,0]],
  ['06-waterfront',[1174,16,235,1188,22,178]],
  ['07-bridge',[90,65,130,380,24,0]],
  ['08-island',[-1030,310,620,-320,35,-40]],
  ['09-street',[469,16,6,850,20,6]],
  ['10-lookout',[-914,42,-15,-935,25,-45]],
 ];
 for(const [name,pose]of views){await page.evaluate(p=>window.__BLACKWATER__.setPhoto(...p),pose);await page.waitForTimeout(700);await page.screenshot({path:output+'/'+name+'.png'});report.views[name]=await page.evaluate(()=>window.__BLACKWATER__.metrics());}
 await page.evaluate(async()=>{const g=window.__BLACKWATER__,{terrainHeight}=await import('/island/data.js');g.setPhoto(-870,terrainHeight(-870,170)+1.7,170,-850,terrainHeight(-850,110)+4,110);});await page.waitForTimeout(500);await page.screenshot({path:output+'/11-forest.png'});
 await page.evaluate(()=>{const g=window.__BLACKWATER__;g.setPhoto(672,16,8,742,27,0);g.presentation.enabled=false;});await page.waitForTimeout(400);await page.screenshot({path:output+'/12-no-post.png'});
 await page.evaluate(()=>{const g=window.__BLACKWATER__;g.presentation.enabled=true;g.begin(false);for(const e of g.actors.enemies)e.alive=false;g.teleport(469,6,Math.PI/2);});await page.waitForTimeout(700);await page.screenshot({path:output+'/13-street-play.png'});
 await page.keyboard.press('KeyI');await page.waitForTimeout(500);await page.screenshot({path:output+'/14-survivor.png'});await page.locator('#inspect-close').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);await page.screenshot({path:output+'/15-portrait.png'});
 await page.setViewportSize({width:1440,height:900});await page.evaluate(async()=>{const g=window.__BLACKWATER__,{terrainHeight}=await import('/island/data.js');g.state.relays=[];g.setPhoto(-860,76,-204,-820,terrainHeight(-820,-260)+25,-260);});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__BLACKWATER__.world.coastalMotion.lens.visible),false);await page.screenshot({path:output+'/16-beacon-off.png'});
 await page.evaluate(()=>window.__BLACKWATER__.state.relays.push('lighthouse'));await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>window.__BLACKWATER__.world.coastalMotion.lens.visible));await page.screenshot({path:output+'/17-beacon-restored.png'});
 await page.evaluate(()=>window.__BLACKWATER__.setTime(null));await page.waitForTimeout(200);const startAngle=await page.evaluate(()=>window.__BLACKWATER__.world.coastalMotion.rotor.rotation.y);await page.waitForTimeout(4200);report.motion=await page.evaluate(start=>({startAngle:start,endAngle:window.__BLACKWATER__.world.coastalMotion.rotor.rotation.y,waterTime:window.__BLACKWATER__.world.water.time.value,cloudTime:window.__BLACKWATER__.world.sky.uniforms.time.value}),startAngle);assert.ok(report.motion.endAngle-report.motion.startAngle>.4);await page.screenshot({path:output+'/18-coastal-motion.png'});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);await context.close();
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.server.close(r));console.log(JSON.stringify(report,null,2));}
