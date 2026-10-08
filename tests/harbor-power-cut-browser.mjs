import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/harbor-power-cut';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(300000);
const report={errors:[],httpErrors:[],fixture:'Enemies cleared and player placed at north approach. Traversal and pickup use keyboard movement; no encounter-balance claim.'};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(`${r.status()} ${r.url()}`);});
try{
 await page.goto(process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/');
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__);await page.locator('[data-action="start"]').click({force:true});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.renderer.harborWorld);
 report.assets=await page.evaluate(async()=>await window.__DEAD_ARRIVAL__.renderer.harborWorld.ready);assert.deepEqual(report.assets.errors,[]);
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.harborProgress.initialized);
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.course.enemies=[];Object.assign(r,{x:16,y:17,z:0,vx:0,vy:0,vz:0,angle:Math.PI/2,pitch:0});});
 await page.waitForTimeout(300);await page.screenshot({path:`${output}/north-entry.png`});
 console.log('Power Cut ready; walking north to south');
 await page.keyboard.down('KeyW');
 try{await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.y>=24.5,null,{timeout:120000});}finally{await page.keyboard.up('KeyW');}
 report.traversal=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;return{x:r.x,y:r.y,scrap:r.backpack.scrap};});
 assert.equal(report.traversal.scrap,4);
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.angle=-Math.PI/2;});await page.waitForTimeout(300);
 await page.screenshot({path:`${output}/south-entry.png`});
 await page.keyboard.press('KeyB');await page.getByRole('button',{name:'FIELD MAP',exact:true}).click();
 assert.equal(await page.locator('.harbor-field-map').isVisible(),true);await page.screenshot({path:`${output}/field-map.png`});
 await page.locator('.pack-close').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 await page.keyboard.down('KeyW');
 try{await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.y<=17,null,{timeout:120000});}finally{await page.keyboard.up('KeyW');}
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.backpack.scrap),4,'return traversal does not duplicate cache');
 report.returnPassed=true;report.renderer=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._collectDiagnostics(window.__DEAD_ARRIVAL__.run));
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log('Two-way traversal, cache and field map PASS');
}catch(e){report.failure=String(e.stack||e);report.state=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__?.run;return r?{x:r.x,y:r.y,mode:r.mode,scrap:r.backpack.scrap}:null;}).catch(()=>null);await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw e;}
finally{await writeFile(`${output}/browser-report.json`,JSON.stringify(report,null,2));await browser.close();}
