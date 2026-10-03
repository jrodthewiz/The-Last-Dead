import {compareCaptures} from './image-metrics.mjs';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const debug=Number(process.env.POST_DEBUG||0);const out='output/playwright/webgpu-ab'+(debug?'-debug'+debug:'');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-unsafe-webgpu']});
const report={views:[],errors:[],images:{}};const captures={webgl:{},webgpu:{}};
try{
 for(const backend of ['webgl','webgpu']){
  const page=await browser.newPage({viewport:{width:960,height:600}});
  page.on('pageerror',e=>{report.errors.push({backend,error:String(e.stack)});console.log(String(e.stack));});
  page.on('console',m=>{if(m.type()==='error'){report.errors.push({backend,error:m.text()});console.log(m.text());}});
  await page.goto(`http://127.0.0.1:5200/tests/fixtures/low-tide.html?renderer=${backend}&post=1&postDebug=${debug}`);
  await page.waitForFunction(()=>window.qaReady,{},{timeout:60000});
  for(const view of ['room','street','water']){
   await page.evaluate(view=>{const q=lowTideQA;if(view!=='room'){q.run.course.activeInterior=null;Object.assign(q.run,view==='water'?{x:16,y:28,angle:Math.PI/2}:{x:16,y:16,angle:0});}q.draw();},view);
   captures[backend][view]=await page.screenshot({path:`${out}/${backend}-${view}.png`});
   report.views.push({backend,view,native:await page.evaluate(()=>!!lowTideQA.renderer.backend?.isWebGPUBackend)});
  }
  if(backend==='webgpu')assert.ok(report.views.at(-1).native);
  await page.close();
 }
 const compare=await browser.newPage();for(const view of ['room','street','water']){report.images[view]=await compareCaptures(compare,captures.webgl[view],captures.webgpu[view]);assert.ok(report.images[view].meanAbsoluteRGB<.025,JSON.stringify({view,...report.images[view]}));}await compare.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
