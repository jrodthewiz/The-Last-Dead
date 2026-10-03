import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const out=`output/playwright/coastal-density/${process.env.DENSITY_RUN||'baseline'}`;await mkdir(out,{recursive:true});
const server=await startServer({port:0,root:'.'});let browser;
const report={errors:[],httpErrors:[],views:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(r.url());});
 let html=await readFile('tests/fixtures/coastal-scene.html','utf8');html=html.replace('const views={','const views={saltwind:[[232,1.8,56],[310,1.8,56]],industrial:[[280,1.8,168],[330,1.8,168]],cape:[[320,1.8,304],[357,8,292]],courtyard:[[245,1.8,84],[300,1.8,84]],');html=html.replace('window.sceneQA={renderer,world,course,','window.sceneQA={renderer,world,course,scene,camera,run,');
 await page.route('**/tests/fixtures/coastal-scene.html',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://127.0.0.1:${server.port}/tests/fixtures/coastal-scene.html`);await page.waitForFunction(()=>window.qaReady,null,{timeout:180000});
 for(const name of ['saltwind','overview','industrial','cape','courtyard','coast']){
  const data=await page.evaluate(async name=>{const q=window.sceneQA;await q.view(name);q.renderer.info.autoReset=false;const frames=[],renders=[];let last=performance.now();for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-last);last=now;q.world.update(4+i/60,null,q.run);q.renderer.info.reset();q.renderer.render(q.scene,q.camera);renders.push({...q.renderer.info.render});}await q.renderer.backend.device.queue.onSubmittedWorkDone();frames.sort((a,b)=>a-b);return{name,p50:frames[45],p95:frames[85],max:frames.at(-1),render:renders.at(-1),drawCallsMax:Math.max(...renders.map(r=>r.drawCalls)),trianglesMax:Math.max(...renders.map(r=>r.triangles)),diagnostics:q.world.diagnostics};},name);
  report.views.push(data);await page.screenshot({path:`${out}/${name}.png`});console.log(JSON.stringify(data));
 }
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(r=>server.server.close(r));}
