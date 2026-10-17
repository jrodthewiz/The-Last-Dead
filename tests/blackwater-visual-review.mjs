import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=resolve('output/playwright/blackwater-iteration/review');await mkdir(output,{recursive:true});
const server=await startServer({root:resolve(process.env.BLACKWATER_QA_ROOT||'dist'),port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-webgl','--ignore-gpu-blocklist']});
const report={views:{},errors:[],scope:'Fixed time 48, seed 641979. Ground-level views, final/no-post pair, neutral weapon and sampled real-time reload. No full-playthrough or physical-phone claim.'};
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:output+'/video',size:{width:960,height:600}}});
 const page=await context.newPage();await guardBackgroundInput(page);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});
 await page.getByRole('button',{name:'Begin journey'}).click();await page.evaluate(()=>{const g=window.__BLACKWATER__;g.setTime(48);g.teleport(-745,282,1.27);});await page.waitForTimeout(1000);await page.screenshot({path:output+'/01-ordinary-play.png'});
 for(const [name,pose] of [
   ['02-oldtown',[590,16,7,635,16.5,-2]],
   ['03-civic',[672,16,8,742,27,0]],
   ['04-waterfront',[1174,16,235,1188,22,178]],
   ['05-bridge-approach',[-20,17.7,2,190,24,0]],
   ['06-keeper-house',[-799,39,-260,-795,39,-280]],
   ['07-signal-stairs',[-440,81,-277,-407,85,-286]],
   ['08-island',[-900,210,520,-170,20,-50]],
   ['09-generator',[1005,16,-289,1000,16,-302]],
   ['10-forest',[-870,20,170,-870,28,60]]
 ]){
   await page.evaluate(p=>window.__BLACKWATER__.setPhoto(...p),pose);await page.waitForTimeout(500);await page.screenshot({path:output+'/'+name+'.png'});report.views[name]=await page.evaluate(()=>window.__BLACKWATER__.metrics());
 }
 await page.evaluate(()=>{const g=window.__BLACKWATER__;g.setPhoto(469,16,6,850,20,6);g.presentation.uniforms.strength.value=.32;});await page.waitForTimeout(300);await page.screenshot({path:output+'/11-final-picture.png'});
 await page.evaluate(()=>window.__BLACKWATER__.presentation.uniforms.strength.value=1);await page.waitForTimeout(150);await page.screenshot({path:output+'/12-full-dither.png'});
 await page.evaluate(()=>window.__BLACKWATER__.presentation.enabled=false);await page.waitForTimeout(150);await page.screenshot({path:output+'/13-no-post.png'});
 // Neutral weapon uses the same geometry and pose function under plain lights.
 await page.evaluate(async()=>{
   const T=await import('/vendor/three.module.js'),{makeRifle}=await import('/island/carbine.js');
   const scene=new T.Scene();scene.background=new T.Color(0x777a72);scene.add(new T.HemisphereLight(0xffffff,0x64645a,2));const key=new T.DirectionalLight(0xfff3d9,2);key.position.set(1,2,1);scene.add(key);
   const camera=new T.PerspectiveCamera(39,innerWidth/innerHeight,.01,10);camera.position.set(1,.35,.7);camera.lookAt(0,-.06,-.18);
   const weapon=makeRifle(new T.PerspectiveCamera());scene.add(weapon.gun);window.__WEAPON_REVIEW__={scene,camera,weapon};window.__BLACKWATER__.setReviewScene({scene,camera});
 });await page.waitForTimeout(200);await page.screenshot({path:output+'/14-neutral-three-quarter.png'});
 await page.evaluate(()=>{const {camera}=window.__WEAPON_REVIEW__;camera.position.set(1.2,.10,-.20);camera.lookAt(0,-.04,-.20);});await page.waitForTimeout(200);await page.screenshot({path:output+'/15-neutral-side.png'});
 for(const [i,phase] of [0,.23,.39,.60,.80,.835,.875,.98].entries()){
   await page.evaluate(p=>{const {weapon,camera}=window.__WEAPON_REVIEW__;camera.position.set(.85,-.10,.45);camera.lookAt(0,-.07,-.15);weapon.update(0,false,0,0,p,true);},phase);await page.waitForTimeout(130);await page.screenshot({path:output+`/16-neutral-reload-${i}.png`});
 }
 await page.evaluate(()=>{const g=window.__BLACKWATER__;g.setReviewScene(null);g.presentation.enabled=true;g.presentation.uniforms.strength.value=.32;g.begin(false);g.teleport(-745,282,1.27);g.state.ammo=3;});
 await page.waitForTimeout(500);await page.keyboard.press('KeyR');
 for(let i=0;i<7;i++){await page.waitForTimeout(180);await page.screenshot({path:output+`/17-live-reload-${i}.png`});}
 report.reloadResult=await page.evaluate(()=>({ammo:window.__BLACKWATER__.state.ammo,reserve:window.__BLACKWATER__.state.reserve}));
 await context.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});await guardBackgroundInput(mobile);
 await mobile.goto(`http://127.0.0.1:${server.port}/?debug`,{waitUntil:'networkidle'});await mobile.waitForFunction(()=>!!window.__BLACKWATER__,{},{timeout:120000});await mobile.getByRole('button',{name:'Begin journey'}).click();await mobile.waitForTimeout(600);await mobile.screenshot({path:output+'/18-mobile-arrival.png'});await mobile.waitForTimeout(4500);await mobile.screenshot({path:output+'/19-mobile-settled.png'});await mobile.close();
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.server.close(r));console.log(JSON.stringify(report,null,2));}
