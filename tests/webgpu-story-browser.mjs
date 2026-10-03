import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const output='output/playwright/webgpu-story';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-unsafe-webgpu']});
const report={errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(300000);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'||m.text().includes('THREE.TSL:'))report.errors.push(m.text());});
 await page.goto('http://127.0.0.1:5200/?debug=1&dungeon=0');await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__);
 await page.locator('[data-action=start]').click({force:true,noWaitAfter:true});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 assert.ok(await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.renderer.backend?.isWebGPUBackend));
 const before=await page.evaluate(()=>({x:window.__DEAD_ARRIVAL__.run.x,y:window.__DEAD_ARRIVAL__.run.y}));
 await page.keyboard.down('KeyW');await page.waitForTimeout(700);await page.keyboard.up('KeyW');
 report.position=await page.evaluate(()=>({x:window.__DEAD_ARRIVAL__.run.x,y:window.__DEAD_ARRIVAL__.run.y}));assert.notDeepEqual(report.position,before);
 await page.mouse.move(640,360);await page.mouse.down({button:'right'});await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();await page.mouse.up({button:'right'});
 await page.screenshot({path:`${output}/play.png`});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'pause');await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 report.state=await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__.screen,backend:window.__DEAD_ARRIVAL__.renderer.renderer.migration}));assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
