import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright-core');
const label=process.argv[2]||'shader-debug';
const quick=process.argv[3]==='quick';
const out=`output/playwright/quality/${label}`;
await mkdir(out,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.addInitScript(()=>{
 const noop=()=>Promise.resolve();
 Element.prototype.requestPointerLock=noop;
 if(typeof HTMLElement!=='undefined')HTMLElement.prototype.requestPointerLock=noop;
 document.exitPointerLock=()=>{};
 window.focus=()=>{};
 if(navigator.keyboard?.lock)navigator.keyboard.lock=noop;
});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

const poses=[
 ['15-weapon-hero',{teleport:[590,7,Math.PI/2]}],
 ['02-oldtown',[590,16,7,635,16.5,-2]],
 ['04-waterfront',[1174,16,235,1188,22,178]],
 ['09-generator',[1005,16,-289,1000,16,-302]],
 ['11-wall-close',[-590,21.9,105.0,-591,21.2,108.4]],
 ['12-road-close',[-80,17.2,3,-70,17.0,12]],
 ['13-interior',[-795,40.5,-276,-795,40.1,-283]],
 ['14-canopy-close',[-862,21.5,173,-859.9,23.2,177.7]],
 ['16-actor-close',[744,16.0,82,752,15.3,76]],
];
const selected=quick?poses.filter(([name])=>['15-weapon-hero','11-wall-close','12-road-close','13-interior','14-canopy-close'].includes(name)):poses;

try{
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&world=island`,{waitUntil:'load',timeout:90000});
 await page.waitForSelector('#begin:not([disabled])',{timeout:120000});
 await page.evaluate(()=>document.getElementById('begin')?.click());
 await page.waitForFunction(()=>window.__BLACKWATER__?.renderer,undefined,{timeout:120000});
 await page.evaluate(()=>window.__BLACKWATER__.setTime?.(48));
 await page.waitForTimeout(2500);
 for(const [name,pose] of selected){
  if(Array.isArray(pose))await page.evaluate(p=>window.__BLACKWATER__.setPhoto(...p),pose);
  else await page.evaluate(t=>window.__BLACKWATER__.teleport(...t),pose.teleport);
  await page.waitForTimeout(600);
  for(const [mode,suffix] of [[0,'final'],[1,'normal'],[2,'roughness']]){
   await page.evaluate(value=>{
    const seen=new Set();
    window.__BLACKWATER__.scene.traverse(object=>{
     const materials=Array.isArray(object.material)?object.material:[object.material];
     for(const material of materials)if(material?.userData?.artDebug&&!seen.has(material.userData.artDebug)){seen.add(material.userData.artDebug);material.userData.artDebug.value=value;}
    });
   },mode);
   await page.evaluate(raw=>{window.__BLACKWATER__.presentation.uniforms.raw.value=raw;},mode===0?0:1);
   await page.waitForTimeout(250);
   await page.screenshot({path:`${out}/${name}-${suffix}.png`});
  }
 }
 await page.evaluate(()=>{
  window.__BLACKWATER__.scene.traverse(object=>{
   const materials=Array.isArray(object.material)?object.material:[object.material];
   for(const material of materials)if(material?.userData?.artDebug)material.userData.artDebug.value=0;
  });
  window.__BLACKWATER__.presentation.uniforms.raw.value=0;
 });
 const metrics=await page.evaluate(()=>{try{return window.__BLACKWATER__.metrics();}catch{return null;}});
 await writeFile(`${out}/debug.json`,JSON.stringify({label,poses:selected.map(p=>p[0]),metrics,errors:[...new Set(errors)].slice(0,8)},null,2));
 console.log(JSON.stringify({label,out,shots:selected.length*3,metrics,errors:[...new Set(errors)].slice(0,5)},null,1));
}finally{
 await browser.close();
 await new Promise(resolve=>server.server.close(resolve));
}
