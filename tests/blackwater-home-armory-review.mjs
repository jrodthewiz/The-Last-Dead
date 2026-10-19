import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=resolve(process.env.BLACKWATER_QA_OUTPUT||'output/home-armory-pass/handling');await mkdir(output,{recursive:true});
const server=process.env.BLACKWATER_QA_URL?null:await startServer({root:resolve(process.env.BLACKWATER_QA_ROOT||'.'),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist']});
const report={errors:[],httpErrors:[],finds:[],reloads:[]};let page;
const url=(process.env.BLACKWATER_QA_URL||`http://127.0.0.1:${server.port}/`)+'?debug';
async function setup(options={}){
 const p=await browser.newPage({viewport:{width:1280,height:800},...options});await guardBackgroundInput(p);
 p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)report.httpErrors.push([r.status(),r.url()]);});
 await p.goto(url,{waitUntil:'networkidle',timeout:120000});await p.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});await p.locator('#begin').click();
 await p.evaluate(async()=>{const g=__BLACKWATER__;await g.armoryModels.ready;for(const e of g.actors.enemies)e.alive=false;g.setTime(48);});return p;
}
try{
 page=await setup();await page.waitForTimeout(1000);
 // Every authored weapon find must be targetable with the actual scenery and
 // furniture in place. The E press takes the target shown by the production HUD.
 const finds=await page.evaluate(()=>__BLACKWATER__.caches);
 for(const c of finds){
  let acquired=false;
  for(const [dx,dz]of [[0,1.8],[-1.8,0],[1.8,0],[0,-1.8],[-1.3,1.3],[1.3,1.3]]){
   await page.evaluate(({c,dx,dz})=>{const g=__BLACKWATER__;g.teleport(c.x+dx,c.z+dz,Math.atan2(-dx,dz));g.state.pitch=-.45;},{c,dx,dz});await page.waitForTimeout(180);
   const target=await page.locator('#interaction-name').textContent();
   const name=await page.evaluate(async id=>(await import('/island/armory-state.js')).WEAPONS.find(w=>w.id===id).name,c.weapon);
   if(target!==name)continue;
   if(c.weapon==='ossuary'){
    await page.evaluate(()=>{const g=__BLACKWATER__;g.state.ammo=1;g.doReload();});await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>__BLACKWATER__.state.armory.ossuary.owned),false);
    await page.waitForFunction(()=>__BLACKWATER__.combat.reload<=0);
   }
   await page.keyboard.press('KeyE');acquired=await page.evaluate(id=>__BLACKWATER__.state.collected.includes(id),c.id);if(acquired)break;
  }
  assert.equal(acquired,true,'Cannot recover '+c.weapon);assert.equal(await page.evaluate(()=>__BLACKWATER__.state.weapon),c.weapon);
  await page.waitForTimeout(350);if(['ossuary','breach','mourning'].includes(c.weapon))await page.screenshot({path:output+'/find-'+c.weapon+'.png'});
  report.finds.push(c.weapon);
 }
 // A separate source of the same weapon yields a bounded reserve receipt.
 await page.evaluate(()=>{const g=__BLACKWATER__,c=g.caches[0];g.state.collected=g.state.collected.filter(id=>id!==c.id);g.state.armory.ossuary.reserve=997;g.teleport(c.x,c.z+1.8,0);});await page.waitForTimeout(180);await page.keyboard.press('KeyE');
 assert.equal(await page.evaluate(()=>__BLACKWATER__.state.armory.ossuary.reserve),999);assert.match(await page.locator('#pickup-feed').innerText(),/\+2/);report.spareAmmo=true;
 // Each reload conserves its own loaded and reserve pools. No shot is queued
 // across the reload, even when fire was held just before pressing R.
 const profiles=await page.evaluate(async()=>(await import('/island/armory-state.js')).WEAPONS.filter(w=>w.capacity));
 for(const w of profiles){
  await page.evaluate(w=>{const g=__BLACKWATER__;g.selectWeapon(w.id);g.state.ammo=Math.max(0,w.capacity-3);g.state.reserve=7;},w);await page.waitForTimeout(350);await page.evaluate(()=>__BLACKWATER__.holdFire(true));await page.keyboard.press('KeyR');
  await page.waitForFunction(()=>__BLACKWATER__.combat.reload>0);if(w.id==='breach'){await page.waitForTimeout(1100);await page.screenshot({path:output+'/break-action-reload.png'});}
  await page.waitForFunction(()=>__BLACKWATER__.combat.reload<=0);const state=await page.evaluate(()=>({ammo:__BLACKWATER__.state.ammo,reserve:__BLACKWATER__.state.reserve}));
  assert.equal(state.ammo,w.capacity);assert.equal(state.reserve,7-Math.min(3,w.capacity));report.reloads.push({weapon:w.id,...state});
 }
 await page.evaluate(()=>{const g=__BLACKWATER__;g.selectWeapon('bat');});await page.waitForTimeout(350);await page.keyboard.press('KeyF');await page.keyboard.press('Digit1');
 assert.equal(await page.evaluate(()=>__BLACKWATER__.state.weapon),'bat','A swing cannot be cancelled by a weapon swap');await page.waitForTimeout(750);report.swingCommit=true;
 // Interior photos use a standing player's eye height and the real render path.
 for(const id of ['building-0','building-1','building-7','orchard-house','lightkeeper']){
  await page.evaluate(id=>{const g=__BLACKWATER__,b=g.data.buildings.find(b=>b.id===id);g.setPhoto(b.x,b.baseY+1.85,b.z+b.d/2-1.1,b.x,b.baseY+1.35,b.z-3);},id);await page.waitForTimeout(180);await page.screenshot({path:output+'/home-'+id+'.png'});
 }
 report.metrics=await page.evaluate(()=>__BLACKWATER__.metrics());await page.close();
 page=await setup({viewport:{width:844,height:390},isMobile:true,hasTouch:true});await page.evaluate(()=>{const g=__BLACKWATER__;g.teleport(170,0,Math.PI/2);for(const id of ['carrion','breach','chainsaw','arc'])g.collectWeapon(id);});await page.waitForTimeout(450);
 const fire=page.locator('[data-touch=fire]');
 // Real pointer holds discriminate semi-auto fire from automatic/sustained tools.
 for(const id of ['carbine','breach','carrion','chainsaw','arc']){
  await page.evaluate(id=>{const g=__BLACKWATER__;g.selectWeapon(id);},id);await page.waitForTimeout(380);const before=await page.evaluate(()=>__BLACKWATER__.state.ammo);
  const rect=await fire.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.waitForTimeout(id==='arc'?1600:1100);await page.mouse.up();
  const used=before-await page.evaluate(()=>__BLACKWATER__.state.ammo);if(['carbine','breach'].includes(id))assert.equal(used,1,id+' repeats on a held trigger');else assert.ok(used>=(id==='arc'?1:3),id+' failed sustained fire');
  (report.trigger??=[]).push({weapon:id,used});
 }
 await page.evaluate(()=>{const g=__BLACKWATER__;g.selectWeapon('carbine');g.state.ammo=0;g.state.reserve=0;});await page.waitForTimeout(380);await fire.tap();await page.waitForTimeout(180);assert.match(await page.locator('#weapon-status').innerText(),/NO AMMUNITION/);assert.equal(await page.evaluate(()=>__BLACKWATER__.state.ammo),0);report.dryFire=true;
 await page.screenshot({path:output+'/touch-empty-weapon.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);
}catch(error){report.failure=error.stack;await page?.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}
finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();if(server)await new Promise(r=>server.server.close(r));console.log(JSON.stringify(report));}
