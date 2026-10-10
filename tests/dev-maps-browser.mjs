import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=`output/playwright/dev-maps/${process.env.DEV_MAP_RUN||'latest'}`;
await mkdir(output,{recursive:true});
const server=process.env.DEV_MAP_URL?null:await startServer({port:0,root:resolve(process.env.DEV_MAP_ROOT||'dist')});
const url=process.env.DEV_MAP_URL||`http://127.0.0.1:${server.port}/`;
const report={url,errors:[],httpErrors:[],maps:[]};
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',error=>report.errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});});
  await page.goto(`${url}?dev=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});
  await page.locator('.dev-map-picker summary').click();
  await page.screenshot({path:`${output}/map-picker.png`});
  console.log('Development map picker ready.');
  for(const map of ['island','descent']){
    const started=Date.now();
    const selector=map==='island'?'.dev-map-choices':'.dev-camera-maps';
    console.log(`Opening ${map}.`);
    await page.locator(`${selector} [data-dev-map="${map}"]`).click({noWaitAfter:true});
    await page.waitForURL(/inspect=1/,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});
    for(let attempt=0;attempt<90;attempt++){
      const state=await page.evaluate(()=>{const app=window.__DEAD_ARRIVAL__;return{screen:app.screen,inspecting:app.inspector.active,stage:app.renderer._preparationStage};});
      if(attempt%4===0||state.inspecting)console.log(JSON.stringify({map,elapsedMs:Date.now()-started,...state}));
      if(report.errors.length)throw new Error(report.errors.at(-1));
      if(state.screen==='play'&&state.inspecting)break;
      await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play'&&window.__DEAD_ARRIVAL__?.inspector.active,null,{timeout:5000}).catch(error=>{if(error.name!=='TimeoutError')throw error;});
    }
    const state=await page.evaluate(()=>{
      const app=window.__DEAD_ARRIVAL__,course=app.run.course,renderer=app.renderer;
      return{screen:app.screen,inspecting:app.inspector.active,coastal:!!course.coastal,dungeon:!!course.dungeon,floor:course.dungeonIndex,
        draws:renderer.renderer.info.render.calls,pose:{...app.inspector.pose},health:app.run.health,world:renderer.harborWorld?.diagnostics};
    });
    assert.equal(state.screen,'play');assert.equal(state.inspecting,true);
    assert.equal(state.coastal,map==='island');assert.equal(state.dungeon,map==='descent');assert(state.draws>0);
    assert.equal(await page.locator(`.dev-camera-maps [data-dev-map="${map}"]`).getAttribute('aria-current'),'page');
    const readyMs=Date.now()-started;
    await page.keyboard.down('w');await page.waitForTimeout(750);await page.keyboard.up('w');
    const moved=await page.evaluate(()=>({pose:{...window.__DEAD_ARRIVAL__.inspector.pose},health:window.__DEAD_ARRIVAL__.run.health}));
    assert(Math.hypot(moved.pose.x-state.pose.x,moved.pose.z-state.pose.z)>.05,'free camera moves');
    assert.equal(moved.health,state.health,'inspection freezes gameplay');
    await page.screenshot({path:`${output}/${map}.png`});
    report.maps.push({map,readyMs,...state});
  }
  await page.keyboard.press('F2');
  await page.waitForFunction(()=>!window.__DEAD_ARRIVAL__.inspector.active);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
  report.passed=true;console.log(JSON.stringify({passed:true,maps:report.maps.map(({map,readyMs})=>({map,readyMs}))}));
}catch(error){report.failure=String(error.stack||error);throw error;}
finally{
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  await browser?.close();if(server){server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
}
