import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {startServer} from '../server.mjs';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH);
await mkdir('docs/build10',{recursive:true});
const server=await startServer({root:path.resolve('dist'),port:0,host:'127.0.0.1'});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=d3d11']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1&build10=blood`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="start"]').click({noWaitAfter:true});
  await page.waitForTimeout(500);
  const result=await page.evaluate(()=>{
    const a=window.__DEAD_ARRIVAL__,r=a.run;
    r.mode='play'; a.ui.play?.(); a.ui.hide?.(); document.body.classList.add('playing'); r.course.enemies=[]; r.tracers=[{id:7001,x:r.x,y:r.y,z:.42,tx:r.x,ty:r.y+1.15,tz:.68,surface:'flesh',normal:{x:0,y:0,z:1},ownerId:r.playerId||'host',life:.16,duration:.18,weapon:0}];
    return {before:r.tracers.length};
  });
  await page.waitForTimeout(120);
  const effects=await page.evaluate(()=>{const fx=window.__DEAD_ARRIVAL__.renderer.weaponFX.impacts;return {active:fx.active,detailActive:fx.detailActive};});
  await page.screenshot({path:'docs/build10/blood-impact.png'});
  assert.ok(effects.detailActive.splashes>0,'flesh splash pool should be active');
  assert.ok(effects.detailActive.drops>0,'flesh droplet pool should be active');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:{before:result.before},effects,errors,passed:true}));
} finally {
  await browser.close(); server.server.closeAllConnections(); await new Promise(resolve=>server.server.close(resolve));
}
