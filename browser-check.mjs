import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const url=process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/';
await mkdir(new URL('./docs/',import.meta.url),{recursive:true});const errors=[],results={};
const screen=p=>p.evaluate(()=>window.__DEAD_ARRIVAL__.screen);
const state=p=>p.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;return{x:r.x,y:r.y,z:r.z,angle:r.angle,pitch:r.pitch,health:r.health,energy:r.energy,weapon:r.weapon,shot:r.shot,wave:r.wave,time:r.time,mode:r.mode,kills:r.kills,coins:r.coins.length,projectiles:r.projectiles.length};});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});p.setDefaultTimeout(15000);
 await p.goto(url+'?debug=1',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared,{},{timeout:60000});await p.screenshot({path:new URL('./docs/menu-desktop.png',import.meta.url).pathname.slice(1)});await p.locator('[data-action="start"]').click();await p.waitForTimeout(200);
 const start=await state(p);await p.keyboard.down('w');await p.waitForTimeout(250);await p.keyboard.up('w');assert.ok((await state(p)).y<start.y-.1,'W movement');
 await p.keyboard.down('Space');await p.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.z>0,{},{timeout:4000});assert.ok((await state(p)).z>0,'jump');await p.keyboard.up('Space');await p.keyboard.down('Shift');await p.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.energy<85,{},{timeout:4000});assert.ok((await state(p)).energy<85,'dash');await p.keyboard.up('Shift');await p.keyboard.down('Control');await p.waitForTimeout(140);await p.keyboard.up('Control');
 const beforeAim=await state(p);await p.mouse.move(820,430);await p.waitForTimeout(50);assert.notEqual((await state(p)).angle,beforeAim.angle,'mouse look');
 await p.keyboard.press('2');await p.mouse.down({button:'right'});await p.waitForTimeout(120);await p.mouse.up({button:'right'});assert.equal((await state(p)).weapon,1,'weapon switch');assert.ok((await state(p)).projectiles>0,'shotgun core');
 await p.keyboard.press('Escape');assert.equal(await screen(p),'pause');const time=(await state(p)).time;await p.waitForTimeout(150);assert.equal((await state(p)).time,time,'solo pause freezes');await p.locator('[data-action="resume"]').click();assert.equal(await screen(p),'play');
 await p.keyboard.press('r');await p.waitForTimeout(200);assert.equal((await state(p)).health,100,'restart');await p.keyboard.press('1');await p.mouse.down({button:'right'});await p.waitForTimeout(80);await p.mouse.up({button:'right'});assert.ok((await state(p)).coins>0,'coin toss');
 await p.screenshot({path:new URL('./docs/gameplay-desktop.png',import.meta.url).pathname.slice(1)});
 results.desktop={controls:true,state:await state(p),diagnostics:await p.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.diagnostics()),fps:await p.evaluate(()=>window.__DEAD_ARRIVAL__.fps)};
 // Lifecycle injections isolate finish/retry from aiming skill, after real input paths above.
 await p.evaluate(()=>window.__DEAD_ARRIVAL__.run.health=0);await p.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='dead');await p.locator('[data-action="restart"]').click();assert.equal((await state(p)).health,100);
 await p.keyboard.press('Escape');await p.locator('[data-action="menu"]').click();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push('mobile '+e.message));await mp.goto(url+'?debug=1',{waitUntil:'networkidle'});await mp.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared,{},{timeout:60000});await mp.screenshot({path:new URL('./docs/menu-mobile.png',import.meta.url).pathname.slice(1)});await mp.locator('[data-action="start"]').tap();await mp.waitForTimeout(150);assert.equal(await screen(mp),'play');
 const box=await mp.locator('[data-action="forward"]').boundingBox();assert.ok(box,'mobile forward visible');const cdp=await mobile.newCDPSession(mp),x=box.x+box.width/2,y=box.y+box.height/2,old=await state(mp);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await mp.waitForTimeout(200);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await state(mp)).y<old.y,'touch movement');
 await mp.screenshot({path:new URL('./docs/gameplay-mobile.png',import.meta.url).pathname.slice(1)});assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile horizontal fit');results.mobile={movement:true,fit:true,diagnostics:await mp.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.diagnostics())};await mobile.close();
 results.errors=errors;assert.deepEqual(errors,[]);console.log(JSON.stringify(results,null,2));await writeFile(new URL('./docs/browser-results.json',import.meta.url),JSON.stringify(results,null,2));
}catch(error){console.error(JSON.stringify({error:error.message,errors},null,2));throw error;}finally{await browser.close();}
