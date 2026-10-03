import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const out='output/playwright/low-tide-ui-quality';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={fixture:'Actual harbor, UI and backpack modules. Completed mission flags injected only for maximum-content layout checks.',errors:[],views:[],checks:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto('http://127.0.0.1:5200/tests/fixtures/low-tide.html');await page.waitForFunction(()=>window.qaReady);
 const shot=async name=>{await page.screenshot({path:`${out}/${name}.png`});report.views.push(name);};
 await shot('hud-before');await page.keyboard.down('KeyQ');await page.evaluate(()=>advanceTime(50));await page.keyboard.up('KeyQ');await page.evaluate(()=>advanceTime(20));await shot('hud-record');
 assert.equal(await page.locator('[data-hud=journey-text]').innerText(),'Record filed / B to read in your journal');
 await page.evaluate(()=>{const q=lowTideQA;for(const k of ['shelter','manifest','identified','battery','fuel','powered','answered'])q.run.lowTide[k]=true;q.run.lowTide.revision++;q.draw();});
 await page.keyboard.press('KeyB');await shot('equipment');
 assert.equal(await page.locator('.pack-empty').count(),3);assert.equal(await page.locator('#pack-title').innerText(),'FIELD EQUIPMENT');
 await page.getByRole('button',{name:'JOURNAL',exact:true}).click();
 assert.equal(await page.locator('.pack-journal article').count(),7);assert.equal(await page.locator('.pack-journal details[open]').count(),1);
 const record=page.locator('.pack-journal summary').nth(1);await record.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.pack-journal details[open]').count(),2);
 await page.locator('.pack-close').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SUMMARY');
 for(const [w,h]of [[1440,900],[1280,720],[844,480],[390,844],[320,640]]){
  await page.setViewportSize({width:w,height:h});
  const fit=await page.evaluate(()=>{const p=document.querySelector('.pack-panel'),close=document.querySelector('.pack-close').getBoundingClientRect(),content=document.querySelector('.pack-content');content.scrollTop=content.scrollHeight;return{overflow:p.scrollWidth>p.clientWidth+1,closeY:close.y,closeBottom:close.bottom,scroll:content.scrollTop,window:innerHeight};});
  assert.equal(fit.overflow,false,`${w}px horizontal overflow`);assert.ok(fit.closeY>=0&&fit.closeBottom<=h,'close remains reachable');
  await page.evaluate(()=>document.querySelector('.pack-content').scrollTop=0);await shot(`journal-${w}x${h}`);report.checks.push({size:[w,h],...fit});
 }
 await page.setViewportSize({width:1280,height:720});await page.getByRole('button',{name:'FIELD MAP',exact:true}).click();await shot('indoor-map');
 assert.match(await page.locator('.pack-map-notes').innerText(),/ROOM PLAN/);assert.doesNotMatch(await page.locator('.pack-map-notes').innerText(),/by street|FERRY/);
 await page.evaluate(()=>{const q=lowTideQA;q.run.course.activeInterior=null;Object.assign(q.run,{x:16,y:16});q.draw();});await shot('district-map');assert.equal(await page.locator('.pack-map-notes li').count(),6);
 await page.locator('.pack-close').click();
 await page.evaluate(()=>lowTideQA.ui.pause());await shot('pause');
 await page.evaluate(()=>{const q=lowTideQA;q.pack.open();});await page.getByRole('button',{name:'JOURNAL',exact:true}).click();assert.equal(await page.locator('.pause-screen').isVisible(),false);await shot('journal-over-pause');await page.locator('.pack-close').click();
 await page.evaluate(()=>{const q=lowTideQA;q.run.health=0;q.run.mode='dead';q.ui.finish(q.run,false);});await shot('recovery');
 assert.equal(await page.getByRole('button',{name:/RETURN TO CHECKPOINT/}).count(),1);assert.doesNotMatch(await page.locator('.finish-card').innerText(),/style earned|best combo|final rank/);
 await page.evaluate(()=>{window.retryPressed=0;lowTideQA.ui.callbacks.onRestart=()=>window.retryPressed++;});await page.getByRole('button',{name:/RETURN TO CHECKPOINT/}).click();assert.equal(await page.evaluate(()=>window.retryPressed),1);
 await page.setViewportSize({width:844,height:480});await shot('recovery-short');
 await page.evaluate(()=>{const q=lowTideQA;for(const k of ['shelter','manifest','identified','battery','fuel','powered','answered'])q.run.lowTide[k]=false;q.ui.finish(q.run,false);});assert.equal(await page.getByRole('button',{name:/TRY AGAIN/}).count(),1);await shot('no-checkpoint');
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
