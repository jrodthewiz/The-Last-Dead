import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/fps-arms-v5-workshop';await mkdir(output,{recursive:true});
const server=await startServer({root:process.cwd(),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const video=process.env.FP_WORKSHOP_VIDEO==='1';
const context=await browser.newContext({viewport:{width:1280,height:800},...(video?{recordVideo:{dir:output+'/video',size:{width:1280,height:800}}}:{})});
const page=await context.newPage(),report={errors:[],poses:[]};
page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.port}/fps-arms-review.html`);
 await page.waitForFunction(()=>window.__FPS_WORKSHOP__,null,{timeout:90000});
 for(let weapon=0;weapon<8;weapon++){
  const diagnostic=await page.evaluate(i=>window.__FPS_WORKSHOP__.select(i,'idle',0),weapon);
  for(const arm of diagnostic.arms){assert(arm.gap<1e-5);assert(arm.wristDegrees<=arm.wristLimitDegrees+.005);}
  report.poses.push({weapon,...diagnostic});await page.screenshot({path:`${output}/hold-${weapon}.png`});
 }
 for(const weapon of [1,6,7]){
  for(const [phase,time]of [['draw',0],['draw',.2],[weapon<6?'fire':'strike',weapon<6?.075:.46]]){
   await page.evaluate(({weapon,phase,time})=>window.__FPS_WORKSHOP__.select(weapon,phase,time),{weapon,phase,time});
   await page.screenshot({path:`${output}/${weapon}-${phase}-${time}.png`});
  }
 }
 await page.locator('#clay').check();await page.evaluate(()=>window.__FPS_WORKSHOP__.select(1,'idle',0));await page.screenshot({path:`${output}/breach-clay.png`});
 await page.locator('#clay').uncheck();
 for(const side of ['right','left']){
  await page.evaluate(()=>window.__FPS_WORKSHOP__.select(1,'idle',0));
  report.render=await page.evaluate(side=>window.__FPS_WORKSHOP__.detail(side),side);
  await page.screenshot({path:`${output}/breach-${side}-detail.png`});
 }
 if(video){
  for(const [weapon,phase,duration]of [[1,'draw',1400],[1,'fire',1800],[1,'walk',2000],[6,'strike',2200],[7,'strike',2200]]){
   await page.evaluate(({weapon,phase})=>window.__FPS_WORKSHOP__.select(weapon,phase,0),{weapon,phase});
   await page.locator('#play').click();await page.waitForTimeout(duration);await page.locator('#play').click();
  }
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;}
finally{await context.close();if(video)report.video=await page.video().path();await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
console.log(JSON.stringify({status:report.status,poses:report.poses.length,errors:report.errors,failure:report.failure}));
