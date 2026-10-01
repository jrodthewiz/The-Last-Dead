import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.PROJECTION_OUTPUT||'output/playwright/projection-texture';await mkdir(output,{recursive:true});
const server=await startServer({root:fileURLToPath(new URL('../',import.meta.url)),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),report={errors:[],views:[],benchmarks:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
try{
  await page.goto(`http://127.0.0.1:${server.port}/projection-lab.html`);await page.waitForFunction(()=>window.__PROJECTION_LAB__?.ready);
  for(const kind of ['cabinet','recovery']){
    for(const mode of ['native','baseline','painted','clay']){
      await page.evaluate(async ({kind,mode})=>window.__PROJECTION_LAB__.select(kind,mode),{kind,mode});
      for(const view of mode==='painted'?['front','corner','back','far']:['corner']){
        const data=await page.evaluate(view=>window.__PROJECTION_LAB__.setView(view),view);assert.equal(data.manifest.uvInteriorOverlapTexels,0);assert.equal(data.manifest.triangles,kind==='cabinet'?352:72);
        await page.screenshot({path:`${output}/${kind}-${mode}-${view}.png`});report.views.push(data);
      }
    }
    for(const lighting of ['warm','cool']){
      await page.evaluate(async ({kind,lighting})=>{await window.__PROJECTION_LAB__.select(kind,'painted');window.__PROJECTION_LAB__.lighting(lighting);},{kind,lighting});await page.screenshot({path:`${output}/${kind}-painted-${lighting}.png`});
    }
    await page.evaluate(()=>window.__PROJECTION_LAB__.lighting('neutral'));
    const benchmark=await page.evaluate(()=>window.__PROJECTION_LAB__.benchmark({frames:60,count:64}));
    assert.equal(benchmark.summary.native.triangles,benchmark.summary.painted.triangles);assert.equal(benchmark.summary.painted.draws,1);assert.equal(benchmark.summary.baseline.draws,1);report.benchmarks.push(benchmark);
    console.log(JSON.stringify({kind,summary:benchmark.summary}));
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/portrait.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No portrait horizontal overflow');
  await page.locator('[data-mode="native"]').click();await page.locator('[data-mode="painted"]').click();await page.selectOption('#subject','cabinet');await page.waitForFunction(()=>window.__PROJECTION_LAB__.snapshot().kind==='cabinet');
  const before=await page.evaluate(()=>window.__PROJECTION_LAB__.snapshot().camera);await page.locator('#viewport').hover();await page.mouse.move(140,240);await page.mouse.down();await page.mouse.move(240,300,{steps:6});await page.mouse.up();const after=await page.evaluate(()=>window.__PROJECTION_LAB__.snapshot().camera);assert.notDeepEqual(before,after,'Orbit control works');
  assert.deepEqual(report.errors,[]);report.result='PASS';
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.server.close(resolve));}
console.log(`Projection texture QA ${report.result}: ${output}/report.json`);
