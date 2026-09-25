import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)});
const errors=[],report={};
try{
 const p=await browser.newPage({viewport:{width:1440,height:1080}});
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url())});
 await p.goto('http://127.0.0.1:5200/promotion/descent-film/index.html',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>document.querySelector('video').readyState>=2,null,{timeout:60000});
 await p.locator('video').evaluate(async v=>{v.muted=true;await v.play()});
 await p.waitForFunction(()=>document.querySelector('video').currentTime>.6);
 report.playback=await p.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,currentTime:v.currentTime,error:v.error,frames:v.getVideoPlaybackQuality().totalVideoFrames}));
 await p.locator('[data-time="24"]').click();await p.waitForFunction(()=>document.querySelector('video').currentTime>=24.5);await p.locator('video').evaluate(v=>v.pause());
 report.chapter=await p.locator('[data-time="24"]').getAttribute('aria-current');
 await p.screenshot({path:'promotion/descent-film/Previews/player-desktop.png'});
 await p.setViewportSize({width:390,height:844});
 report.mobileOverflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 await p.screenshot({path:'promotion/descent-film/Previews/player-mobile.png',fullPage:true});
 report.errors=errors;
 if(errors.length||report.playback.error||report.mobileOverflow||report.chapter!=='true')throw new Error(JSON.stringify(report));
 console.log(JSON.stringify(report));
 await writeFile('promotion/descent-film/.tesseract-work/playback-verification.json',JSON.stringify(report,null,2));
}finally{await browser.close()}
