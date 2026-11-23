import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright-core');
const label=process.argv[2]||'shader-r2-walk';
const out=`output/playwright/quality/${label}`;
await mkdir(out,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:out,size:{width:1280,height:720}}});
const page=await context.newPage();
await page.addInitScript(()=>{
 const noop=()=>Promise.resolve();
 Element.prototype.requestPointerLock=noop;
 if(typeof HTMLElement!=='undefined')HTMLElement.prototype.requestPointerLock=noop;
 document.exitPointerLock=()=>{};
 window.focus=()=>{};
 if(navigator.keyboard?.lock)navigator.keyboard.lock=noop;
});
const video=page.video();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&world=island`,{waitUntil:'load',timeout:90000});
 await page.waitForSelector('#begin:not([disabled])',{timeout:120000});
 await page.evaluate(()=>document.getElementById('begin')?.click());
 await page.waitForFunction(()=>window.__BLACKWATER__?.renderer&&window.__BLACKWATER__.mode==='playing',undefined,{timeout:120000});
 await page.evaluate(()=>window.__BLACKWATER__.setTime?.(48));
 await page.evaluate(()=>window.__BLACKWATER__.teleport(-745,282,1.27));
 await page.waitForTimeout(800);
 await page.screenshot({path:`${out}/frame-start.png`});
 await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true})));
 const started=Date.now();
 let midSaved=false;
 await page.evaluate(async()=>{
  const app=window.__BLACKWATER__,start=performance.now();
  while(performance.now()-start<5000){app.state.yaw+=.0024;await new Promise(resolve=>setTimeout(resolve,16));}
 });
 await page.screenshot({path:`${out}/frame-mid.png`});
 midSaved=true;
 await page.evaluate(async()=>{
  const app=window.__BLACKWATER__,start=performance.now();
  while(performance.now()-start<5000){app.state.yaw+=.0024;await new Promise(resolve=>setTimeout(resolve,16));}
 });
 await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true})));
 await page.waitForTimeout(500);
 await page.screenshot({path:`${out}/frame-end.png`});
 await page.close();
 await context.close();
 const file=await video.path();
 const report={label,durationSeconds:Math.round((Date.now()-started)/1000),midSaved,viewport:[1280,720],frames:[`${out}/frame-start.png`,`${out}/frame-mid.png`,`${out}/frame-end.png`],video:file,errors:[...new Set(errors)].slice(0,8)};
 await writeFile(`${out}/walk.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,1));
}finally{
 await browser.close();
 await new Promise(resolve=>server.server.close(resolve));
}
