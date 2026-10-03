import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/coastal-water';await mkdir(output,{recursive:true});
const running=await startServer({port:0,root:process.cwd()});
let browser;
const report={errors:[],consoleErrors:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
 await page.goto(`http://127.0.0.1:${running.port}/tests/fixtures/coastal-water.html`);
 await page.waitForFunction(()=>window.qaReady,{},{timeout:60000});
 const first=await page.screenshot({path:`${output}/water-t0.png`});
 report.state=await page.evaluate(()=>window.waterQA.advance(4));
 const next=await page.screenshot({path:`${output}/water-t4.png`});
 report.animated=!first.equals(next);
 assert.equal(report.state.backend,'webgpu');assert.ok(report.animated);assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);
 console.log(JSON.stringify(report));
}finally{
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 await browser?.close();await new Promise(resolve=>running.server.close(resolve));
}
