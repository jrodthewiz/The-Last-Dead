import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const dir='output/playwright/low-tide-final';await fs.mkdir(dir,{recursive:true});const report={errors:[],views:[],sizes:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto('http://127.0.0.1:5200/tests/fixtures/low-tide.html');await page.waitForFunction(()=>window.qaReady);
 for(const id of ['shelter','manifest','identified','battery','fuel','powered','shelter']){
  await page.evaluate(id=>{const q=window.lowTideQA,r=q.run,p=r.course.lowTideStations.find(p=>p.id===id);r.course.activeInterior=r.course.harborRooms.find(room=>room.id===p.roomId);Object.assign(r,{x:p.x,y:p.y,angle:Math.PI,vx:0,vy:0});q.draw();},id);
  await page.screenshot({path:`${dir}/${id}-${report.views.length}.png`});
  await page.keyboard.down('KeyQ');await page.evaluate(()=>window.advanceTime(50));await page.keyboard.up('KeyQ');await page.evaluate(()=>window.advanceTime(20));
  const value=await page.evaluate(id=>window.lowTideQA.run.lowTide[id],id);assert.equal(value,true);report.views.push(id);
 }
 await page.keyboard.press('KeyB');await page.getByRole('button',{name:'JOURNAL',exact:true}).click();assert.equal(await page.locator('.pack-journal article').count(),7);
 for(const [w,h]of [[1280,800],[844,600],[390,844],[320,640]]){
  await page.setViewportSize({width:w,height:h});const overflow=await page.evaluate(()=>{const p=document.querySelector('.pack-panel');return p.scrollWidth>p.clientWidth+1;});assert.equal(overflow,false,`${w}px journal overflow`);
  await page.screenshot({path:`${dir}/journal-${w}.png`});report.sizes.push({width:w,height:h,overflow});
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));await browser.close();}
