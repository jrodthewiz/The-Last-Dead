import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=resolve(process.env.BLACKWATER_QA_OUTPUT||'output/playwright/blackwater-recovery');await mkdir(output,{recursive:true});
const server=await startServer({root:resolve(process.env.BLACKWATER_QA_ROOT||'dist'),port:0}),browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist']});
const report={errors:[],httpErrors:[],reducedMotion:!!process.env.BLACKWATER_REDUCED_MOTION};
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:output+'/video',size:{width:960,height:600}}}),page=await context.newPage();await guardBackgroundInput(page);
 if(process.env.BLACKWATER_REDUCED_MOTION)await page.addInitScript(()=>localStorage.setItem('blackwater-settings',JSON.stringify({quality:'retro',pictureRevision:2,sensitivity:1,volume:.45,motion:false})));
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push([r.status(),r.url()]);});
 await page.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});await page.locator('#begin').click();
 report.heritage=await page.evaluate(()=>({stats:__BLACKWATER__.exploration.stats,expectedAssets:new Set(__BLACKWATER__.exploration.items.map(p=>p.name)).size}));assert.equal(report.heritage.stats.assets,report.heritage.expectedAssets);assert.ok(report.heritage.stats.props>0&&report.heritage.stats.batches>0);
 await page.evaluate(()=>{const g=__BLACKWATER__;for(const e of g.actors.enemies)e.alive=false;g.setTime(48);g.teleport(469,6,Math.PI/2);g.state.pitch=-.1;g.collectWeapon('bat');g.selectWeapon('bat');document.getElementById('toast').style.visibility='hidden';});await page.waitForTimeout(650);
 // Actual render frames retain the authored performance BEFORE contact solve,
 // plus the solved palm error. This distinguishes easing from accumulated IK.
 await page.evaluate(()=>{
  const g=__BLACKWATER__;window.motion=[];window.recordMotion=true;
  function record(now){const group=g.armoryModels.groups.find(g=>g.visible),s=group?.userData.authoredFPS;if(s)window.motion.push({at:now,weapon:s.name,phase:s.phase,time:s.sampleTime,blend:!!s.transition,poses:s.sampled.map(p=>p.quaternion.toArray()),gaps:s.arms.map(a=>a.gap),distance:g.stride.phase});if(window.recordMotion)requestAnimationFrame(record);}requestAnimationFrame(record);
 });
 await page.evaluate(()=>__BLACKWATER__.shoot());await page.waitForTimeout(300);await page.screenshot({path:output+'/bat-contact.png'});await page.waitForTimeout(650);await page.screenshot({path:output+'/bat-return.png'});
 const walkStart=await page.evaluate(()=>({x:__BLACKWATER__.state.x,z:__BLACKWATER__.state.z}));
 await page.keyboard.down('KeyW');await page.waitForTimeout(1100);await page.keyboard.up('KeyW');await page.waitForTimeout(450);await page.screenshot({path:output+'/walk-settled.png'});
 report.walkDistance=await page.evaluate(start=>Math.hypot(__BLACKWATER__.state.x-start.x,__BLACKWATER__.state.z-start.z),walkStart);assert.ok(report.walkDistance>3,'Real walking still moves the survivor in either motion setting');
 await page.evaluate(()=>{const g=__BLACKWATER__;g.collectWeapon('chainsaw');g.selectWeapon('chainsaw');g.state.ammo=100;g.state.reserve=100;});await page.waitForTimeout(600);
 await page.evaluate(()=>__BLACKWATER__.holdFire(true));await page.waitForTimeout(900);await page.screenshot({path:output+'/saw-cut.png'});await page.evaluate(()=>__BLACKWATER__.holdFire(false));await page.waitForTimeout(450);await page.screenshot({path:output+'/saw-release.png'});
 // Hiding the saw for a remedy must not leave a revved motor waiting to resume.
 await page.evaluate(()=>{const g=__BLACKWATER__;g.state.health=50;g.state.medkits=2;g.holdFire(true);});await page.waitForTimeout(350);await page.keyboard.press('KeyH');await page.waitForFunction(()=>!!__BLACKWATER__.healing);await page.waitForFunction(()=>!__BLACKWATER__.healing);await page.waitForTimeout(650);
 report.sawReturn=await page.evaluate(()=>{const g=__BLACKWATER__,s=g.armoryModels.groups[7].userData.authoredFPS;return{phase:s.phase,health:g.state.health,chain:g.armoryModels.models[7].userData.melee.chainPhase};});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__BLACKWATER__.armoryModels.models[7].userData.melee.chainPhase),report.sawReturn.chain);assert.equal(report.sawReturn.phase,'idle');assert.equal(report.sawReturn.health,95);
 report.frames=await page.evaluate(()=>{window.recordMotion=false;return window.motion;});
 const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((n,v,i)=>n+v*b[i],0))));
 report.transitions=[];
 for(let i=1;i<report.frames.length;i++){const prev=report.frames[i-1],next=report.frames[i];assert.ok(next.gaps.every(g=>g<1e-5));if(prev.weapon!==next.weapon||prev.phase===next.phase)continue;
  const maxRadians=Math.max(...prev.poses.map((p,k)=>angle(p,next.poses[k])));report.transitions.push({weapon:next.weapon,from:prev.phase,to:next.phase,maxRadians,blending:next.blend});
  if(['idle','walk'].includes(next.phase)){assert.ok(next.blend,'locomotion/recovery must create a real transition');assert.ok(maxRadians<.00001,'the first recovery frame must preserve the outgoing authored pose');}
 }
 assert.ok(report.transitions.some(t=>t.weapon==='bat'&&t.from==='strike'&&t.to==='idle'));
 if(report.reducedMotion)assert.ok(report.frames.filter(f=>f.weapon==='bat').every(f=>f.phase!=='walk'),'Reduced motion intentionally suppresses the walking arm clip');
 else assert.ok(report.transitions.some(t=>t.weapon==='bat'&&t.from==='walk'&&t.to==='idle'));
 assert.ok(report.transitions.some(t=>t.weapon==='chainsaw'&&t.from==='strike'&&t.to==='idle'));
 assert.ok(report.frames.filter(f=>f.weapon==='chainsaw').every(f=>f.phase!=='fire'),'saw never dispatches a missing firearm action');
 report.allWeaponPoses=[];
 for(const id of ['ossuary','breach','arc','reliquary','carrion','mourning','bat','chainsaw']){
  await page.evaluate(id=>{const g=__BLACKWATER__;g.collectWeapon(id);g.selectWeapon(id);},id);await page.waitForTimeout(400);
  report.allWeaponPoses.push(await page.evaluate(()=>{const g=__BLACKWATER__,group=g.armoryModels.groups.find(g=>g.visible),s=group.userData.authoredFPS;return{id:s.name,phase:s.phase,valid:s.actions.has(s.phase),gaps:s.arms.map(a=>a.gap)};}));
 }
 assert.ok(report.allWeaponPoses.every(p=>p.valid&&p.gaps.every(g=>g<1e-5)));
 await page.evaluate(()=>__BLACKWATER__.selectWeapon('bat'));await page.waitForTimeout(450);
 await page.evaluate(async()=>{const T=await import('/vendor/three.module.js');__BLACKWATER__.armoryModels.groups[6].traverse(o=>{if(o.isMesh){o.userData.savedReviewMaterial=o.material;o.material=new T.MeshLambertMaterial({color:0xaaaaaa,flatShading:true});}});});await page.screenshot({path:output+'/bat-neutral.png'});
 await page.evaluate(()=>__BLACKWATER__.armoryModels.groups[6].traverse(o=>{if(o.userData.savedReviewMaterial){o.material.dispose();o.material=o.userData.savedReviewMaterial;delete o.userData.savedReviewMaterial;}}));
 await page.evaluate(()=>{const g=__BLACKWATER__,c=g.caches.find(c=>c.weapon==='carrion'),y=g.grid.floorAt(c.x,c.z);g.state.armory.carrion.owned=false;window.fieldReview={c,y};g.setPhoto(c.x+1.4,y+1.4,c.z+2.2,c.x,y+.5,c.z);});await page.waitForTimeout(150);await page.screenshot({path:output+'/field-carrion.png'});
 assert.equal(await page.evaluate(()=>__BLACKWATER__.scene.getObjectByName('carrion field cache').visible),true);
 await page.evaluate(()=>__BLACKWATER__.setPhoto(1200,80,400,900,20,0));await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>__BLACKWATER__.scene.getObjectByName('carrion field cache').visible),false);
 await page.evaluate(()=>{const {c,y}=fieldReview;__BLACKWATER__.setPhoto(c.x+1.4,y+1.4,c.z+2.2,c.x,y+.5,c.z);});await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>__BLACKWATER__.scene.getObjectByName('carrion field cache').visible),true);
 await page.evaluate(()=>__BLACKWATER__.collectWeapon('carrion'));await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>__BLACKWATER__.scene.getObjectByName('carrion field cache').visible),false);report.flightCacheCulling=true;
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);await context.close();
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.server.close(r));console.log(JSON.stringify({...report,frames:report.frames?.length},null,2));}
