import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import{mkdir,writeFile}from'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5200/survivor-playground.html?version='+(process.argv[2]||'candidate'));await page.waitForFunction(()=>window.__IMG2THREEJS_READY__,{},{timeout:120000});await page.evaluate(()=>document.body.classList.add('capture'));
const dir='docs/survivor/first-person/'+(process.argv[3]||'baseline');await mkdir(dir,{recursive:true});const results=[];
for(const options of [{pose:'standing',view:'first',pitch:-1.3},{pose:'standing',view:'first',pitch:0},{pose:'walking',view:'first',pitch:-1.3},{pose:'slide',view:'first',pitch:-1.3},{pose:'jump',view:'first',pitch:-1.3},{pose:'standing',view:'left35'},{pose:'standing',view:'right35'},{pose:'standing',view:'rear'}]){const metrics=await page.evaluate(o=>window.__BODY_PLAYGROUND__.captureState(o),options);assert.ok(metrics.headHidden&&metrics.armsHidden,'local head and duplicate arms hidden');const name=options.pose+'-'+options.view+(options.pitch===0?'-forward':'');await page.screenshot({path:dir+'/'+name+'.png'});results.push({name,...metrics});}
for(let weapon=0;weapon<4;weapon++){await page.evaluate(weapon=>window.__BODY_PLAYGROUND__.captureState({pose:'slide',view:'first',pitch:-1.3,weapon}),weapon);await page.screenshot({path:dir+'/slide-weapon-'+weapon+'.png'});}
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__BODY_PLAYGROUND__.captureState({pose:'standing',view:'first',pitch:-1.3,weapon:0}));await page.screenshot({path:dir+'/mobile-down.png'});
assert.deepEqual(errors,[]);
await writeFile(dir+'/metrics.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
