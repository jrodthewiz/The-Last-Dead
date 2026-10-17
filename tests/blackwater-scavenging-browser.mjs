import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=resolve(process.env.BLACKWATER_QA_OUTPUT||'output/playwright/blackwater-scavenging/current');await mkdir(output,{recursive:true});
const server=await startServer({root:resolve(process.env.BLACKWATER_QA_ROOT||'.'),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist']});const report={errors:[],httpErrors:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:output+'/video',size:{width:960,height:600}}}),page=await context.newPage();await guardBackgroundInput(page);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push([r.status(),r.url()]);});
 await page.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});await page.locator('#begin').click();
 await page.evaluate(async()=>{const g=window.__BLACKWATER__;await g.armoryModels.ready;for(const e of g.actors.enemies)e.alive=false;g.setTime(48);});
 report.loot=await page.evaluate(()=>{const g=window.__BLACKWATER__;return g.loot.map(c=>({id:c.id,name:c.name,x:c.x,z:c.z,loot:c.loot}));});assert.ok(report.loot.length>40);
 report.routes=await page.evaluate(async()=>{
  const g=window.__BLACKWATER__,{clearShot}=await import('/island/simulation.js'),results=[];
  for(const c of g.loot){const b=g.data.buildings.find(b=>c.id==='stash-'+b.id);if(!b)continue;
   const start={x:b.x,z:b.z+b.d/2-.7},queue=[start],seen=new Set(['0,0']);let reached=false;
   for(let i=0;i<queue.length&&i<6000;i++){const p=queue[i],y=g.grid.floorAt(p.x,p.z),dx=c.x-p.x,dz=c.z-p.z,dy=c.y+.5-y-1.7,length=Math.hypot(dx,dy,dz);if(Math.hypot(dx,dz)<2.45&&clearShot([p.x,y+1.7,p.z],[dx/length,dy/length,dz/length],length-.7,g.grid)){reached=true;break;}
    for(const [xx,zz]of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){const x=p.x+xx,z=p.z+zz,key=Math.round((x-start.x)*2)+','+Math.round((z-start.z)*2);if(seen.has(key)||Math.abs(x-b.x)>b.w/2+2||Math.abs(z-b.z)>b.d/2+2)continue;seen.add(key);const yy=g.grid.floorAt(x,z);if(Math.abs(yy-y)<.6&&!g.grid.blocked(x,z,yy,.42))queue.push({x,z});}}
   results.push({id:c.id,reached});
  }return results;
 });assert.equal(report.routes.filter(r=>!r.reached).length,0,JSON.stringify(report.routes.filter(r=>!r.reached)));

 await page.evaluate(()=>{const g=window.__BLACKWATER__,c=g.loot.find(c=>c.id.includes('arrival-house'));g.teleport(c.x,c.z+1.65,0);g.state.pitch=-.4;});await page.waitForTimeout(200);await page.screenshot({path:output+'/search-before.png'});
 await page.evaluate(()=>window.__BLACKWATER__.selectWeapon('bat'));await page.waitForFunction(()=>window.__BLACKWATER__.combat.shotCooldown<=0);assert.equal(await page.evaluate(()=>{const g=window.__BLACKWATER__;g.shoot();g.interact();return !!g.searching;}),false,'Rummaging cannot overlap a pending melee contact');await page.waitForTimeout(800);await page.evaluate(()=>window.__BLACKWATER__.selectWeapon('carbine'));report.meleeInteractionGuard=true;
 await page.keyboard.press('KeyE');await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>!!window.__BLACKWATER__.searching));await page.screenshot({path:output+'/search-live.png'});await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>window.__BLACKWATER__.mode),'backpack');await page.screenshot({path:output+'/loot.png'});
 await page.getByRole('button',{name:'Take all that fits',exact:true}).click();assert.ok(await page.evaluate(()=>Object.values(window.__BLACKWATER__.state.backpack.items).some(n=>n>0)));await page.getByRole('button',{name:'Supplies',exact:true}).click();await page.screenshot({path:output+'/backpack.png'});
 await page.evaluate(()=>{window.__BLACKWATER__.state.health=40;});await page.keyboard.press('KeyB');await page.keyboard.press('KeyH');await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__BLACKWATER__.state.health),40);await page.screenshot({path:output+'/heal-live.png'});await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>window.__BLACKWATER__.state.health),85);
 await page.keyboard.press('KeyB');await page.getByRole('button',{name:'Weapons',exact:true}).click();await page.screenshot({path:output+'/weapons.png'});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Supplies',exact:true}).click();await page.waitForTimeout(250);await page.screenshot({path:output+'/backpack-portrait.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.keyboard.press('KeyB');await page.evaluate(()=>{const g=window.__BLACKWATER__;g.state.health=40;g.state.backpack.items.bandage=1;g.useRemedy('bandage');});await page.waitForTimeout(250);await page.evaluate(()=>window.__BLACKWATER__.takeDamage(5));await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>window.__BLACKWATER__.state.health),35);assert.equal(await page.evaluate(()=>window.__BLACKWATER__.state.backpack.items.bandage),1);
 // The last individually collected row must hand keyboard focus to Return.
 await page.evaluate(()=>{const g=window.__BLACKWATER__,c=g.loot[0];g.state.backpack.searched.push(c.id);g.state.backpack.remaining[c.id]={cloth:1};g.openPack(c);});await page.getByRole('button',{name:'Take Clean cloth',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'pack-close');report.lastLootFocus='pack-close';

 report.contextLost=await page.evaluate(()=>window.__BLACKWATER__.renderer.getContext().isContextLost());assert.equal(report.contextLost,false);assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);await context.close();
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mobile=await mobileContext.newPage();await guardBackgroundInput(mobile);mobile.on('pageerror',e=>report.errors.push(e.message));await mobile.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'networkidle',timeout:120000});await mobile.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});await mobile.locator('#begin').tap();await mobile.locator('#mobile-pack').tap();assert.equal(await mobile.evaluate(()=>window.__BLACKWATER__.mode),'backpack');await mobile.screenshot({path:output+'/touch-pack.png'});await mobile.locator('#pack-close').tap();await mobile.setViewportSize({width:844,height:390});assert.equal(await mobile.locator('#mobile-pack').isVisible(),true);await mobile.locator('#mobile-pack').tap();await mobile.getByRole('button',{name:'Weapons',exact:true}).tap();await mobile.screenshot({path:output+'/touch-landscape-arsenal.png'});assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobileContext.close();report.touchPack=true;assert.deepEqual(report.errors,[]);

}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.server.close(r));console.log(JSON.stringify({errors:report.errors,httpErrors:report.httpErrors,loot:report.loot?.length,contextLost:report.contextLost}));}
