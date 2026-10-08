import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const out=process.argv[2]||'baseline';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--use-angle=d3d11']});
const report={errors:[],stages:[]};let page,heartbeat;
try{
 page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(300000);
 await page.addInitScript(()=>{window.__schedulingYields=0;const scheduler=globalThis.scheduler;if(scheduler?.yield){const yieldMain=scheduler.yield.bind(scheduler);scheduler.yield=()=>{window.__schedulingYields++;return yieldMain();};}});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/?district=harbor&debug',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__);
 console.log('app ready');await page.exposeBinding('__stage',(_source,stage)=>{report.stages.push(stage);console.log(JSON.stringify(stage));});
 heartbeat=setInterval(()=>{page.evaluate(()=>({at:performance.now(),stage:window.__DEAD_ARRIVAL__?.renderer._preparationStage,yields:window.__schedulingYields,screen:window.__DEAD_ARRIVAL__?.screen})).then(value=>console.log(JSON.stringify(value))).catch(()=>{});},30000);
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.renderer;window.__profile=[];for(const key of ['_compilePreparedScene','_renderScene','_prepareCoastalEnemies','_prepareHarborInteriors','_prepareInteractionResources']){const original=r[key];r[key]=function(...args){const begin=performance.now(),stage=this._preparationStage;const result=original.apply(this,args);const save=()=>window.__profile.push({key,stage,ms:performance.now()-begin});if(result?.then)return result.finally(save);save();return result;};}});
 await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.renderer,stage=r._reportPreparation;r._reportPreparation=function(value){window.__stage({value,at:performance.now()});return stage.call(this,value);};});
 const buttons=await page.locator('[data-action="harbor"]').count();await page.locator(buttons?'[data-action="harbor"]':'[data-action="start"]').first().click({force:true});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.renderer._weaponsPrepared);
 report.ready=await page.evaluate(()=>({time:performance.now(),history:window.__DEAD_ARRIVAL__.renderer._preparationHistory,profile:window.__profile,diagnostics:window.__DEAD_ARRIVAL__.renderer._collectDiagnostics(window.__DEAD_ARRIVAL__.run),resources:performance.getEntriesByType('resource').sort((a,b)=>b.duration-a.duration).slice(0,12).map(r=>({name:r.name,duration:r.duration,bytes:r.transferSize}))}));
 await page.screenshot({path:`output/playwright/startup-${out}.png`,timeout:10000});console.log(JSON.stringify(report,null,2));
}catch(error){report.failure=String(error);report.last=await Promise.race([page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__?.screen,history:window.__DEAD_ARRIVAL__?.renderer._preparationHistory,profile:window.__profile,diagnostics:window.__DEAD_ARRIVAL__?.renderer._collectDiagnostics(window.__DEAD_ARRIVAL__.run)})).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve(null),10000))]);console.log(JSON.stringify(report));}finally{clearInterval(heartbeat);await fs.mkdir('output/playwright',{recursive:true});await fs.writeFile(`output/playwright/startup-${out}.json`,JSON.stringify(report,null,2));await browser.close();}
