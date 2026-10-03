import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/coastal-water';await mkdir(output,{recursive:true});
const running=await startServer({port:0,root:process.cwd()});let browser;
const report={errors:[],consoleErrors:[],views:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',error=>{report.errors.push(error.message);console.log('ERROR',error.message);});
 page.on('console',message=>{if(message.type()==='error'){report.consoleErrors.push(message.text());console.log('CONSOLE',message.text());}});
 await page.goto(`http://127.0.0.1:${running.port}/tests/fixtures/coastal-scene.html`);
 await page.waitForFunction(()=>window.qaReady,{},{timeout:180000});
 for(const view of (process.env.COASTAL_INTERIORS==='1'?['room-0','room-1','room-2','room-3','room-4','room-5','entrance-0','entrance-4','street']:['overview','spawn','street','coast','lighthouse'])){report.views.push(await page.evaluate(name=>window.sceneQA.view(name),view));await page.screenshot({path:`${output}/scene-${view}.png`});console.log('Captured',view);}
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);console.log('Coastal scene passed');
}finally{await writeFile(`${output}/scene-report.json`,JSON.stringify(report,null,2));await browser?.close();await new Promise(resolve=>running.server.close(resolve));}
