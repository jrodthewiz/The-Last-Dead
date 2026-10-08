import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
// Own an ephemeral server/browser so the user's port 5200 and game tab survive.
const server=await startServer({root:fileURLToPath(new URL('../',import.meta.url)),port:0});
const output='.logs/retry-input',report={errors:[],checks:[]};
let browser;
try{
 await mkdir(output,{recursive:true});
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});
 await page.goto(`http://127.0.0.1:${server.port}/?dungeon=0`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:180000});
 await page.locator('[data-action="start"]').click();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play',null,{timeout:180000});
 await page.evaluate(()=>{
  const run=window.__DEAD_ARRIVAL__.run;window.__retryInputRun=run;
  // Freeze simulation to isolate key handling from enemy damage.
  Object.assign(run,{mode:'ready',health:63,kills:12});
 });
 await page.keyboard.press('KeyR');
 const status=await page.evaluate(()=>({sameRun:window.__retryInputRun===window.__DEAD_ARRIVAL__.run,
  health:window.__DEAD_ARRIVAL__.run.health,kills:window.__DEAD_ARRIVAL__.run.kills,
  screen:window.__DEAD_ARRIVAL__.screen,text:document.body.textContent}));
 assert.equal(status.sameRun,true);assert.equal(status.health,63);assert.equal(status.kills,12);assert.equal(status.screen,'play');
 assert.match(status.text,/Weapons replenish automatically — no reload needed\./);
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run===window.__retryInputRun),true);
 report.checks.push('Real R and Enter during play preserve run, health and kills; R explains automatic replenishment');
 await page.screenshot({path:`${output}/weapon-status.png`});
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='dead';});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='dead');
 assert.match(await page.locator('.finish-screen [data-action="restart"]').textContent(),/ENTER/);
 await page.keyboard.press('KeyR');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run===window.__retryInputRun),true);
 await page.screenshot({path:`${output}/retry-screen.png`});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.run!==window.__retryInputRun,null,{timeout:180000});
 assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.kills),0);
 report.checks.push('Real Enter on death screen retries a fresh run; R on death screen preserves it');
 await page.evaluate(()=>{window.__retryInputRun=window.__DEAD_ARRIVAL__.run;window.__DEAD_ARRIVAL__.run.health=10000;});
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'pause');
 await page.locator('.pause-screen [data-action="restart"]').click();
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.run!==window.__retryInputRun,null,{timeout:180000});
 report.checks.push('Pause-menu restart button remains functional');
 assert.deepEqual(report.errors,[]);report.status='PASS';console.log(JSON.stringify(report));
}finally{
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 await browser?.close();await new Promise(resolve=>server.server.close(resolve));
}
