import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const output='output/playwright/coastal-map';await mkdir(output,{recursive:true});
const running=await startServer({port:0,root:fileURLToPath(new URL('../',import.meta.url))});
let browser;
const report={fixture:'Real coastal course and field-kit UI without gameplay renderer',errors:[],consoleErrors:[],httpErrors:[],views:[]};
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'});
  const page=await browser.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.httpErrors.push(`${r.status()} ${r.url()}`);});
  for(const viewport of [{width:1440,height:900},{width:960,height:640}]){
    await page.setViewportSize(viewport);await page.goto(`http://127.0.0.1:${running.port}/tests/fixtures/coastal-map.html`);
    await page.waitForFunction(()=>!!window.coastalMapQA);
    await page.keyboard.press('KeyB');await page.locator('[data-pack-view="map"]').click();
    await page.locator('[data-coast-destination="lighthouse"]').click();
    assert.equal(await page.evaluate(()=>window.coastalMapQA.navigation().target.id),'lighthouse');
    assert.equal(await page.locator('[data-coast-destination="lighthouse"]').getAttribute('aria-pressed'),'true');
    const layout=await page.evaluate(()=>{
      const panel=document.querySelector('.pack-panel'),content=document.querySelector('.pack-content'),svg=document.querySelector('.coastal-field-map'),rect=panel.getBoundingClientRect();
      return {panel:{x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom},documentOverflow:document.documentElement.scrollWidth>innerWidth,contentOverflow:content.scrollWidth>content.clientWidth+1,svgWidth:svg.getBoundingClientRect().width,route:window.coastalMapQA.navigation().distance};
    });
    assert.ok(layout.panel.x>=0&&layout.panel.y>=0&&layout.panel.right<=viewport.width+1&&layout.panel.bottom<=viewport.height+1,'dialog within viewport');
    assert.equal(layout.documentOverflow,false);assert.equal(layout.contentOverflow,false);assert.ok(layout.svgWidth>200);
    await page.screenshot({path:`${output}/field-map-${viewport.width}.png`});report.views.push({viewport,...layout});
    await page.keyboard.press('Escape');assert.equal(await page.locator('.pack-overlay').isHidden(),true);
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.httpErrors,[]);
  console.log(JSON.stringify(report,null,2));
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser?.close();await new Promise(resolve=>running.server.close(resolve));}
