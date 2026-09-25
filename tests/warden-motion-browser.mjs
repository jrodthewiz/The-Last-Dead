import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=path.resolve('docs/enemy-motion');
const base=process.env.GAME_URL||'http://127.0.0.1:5200/';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1100,height:760},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
 await page.goto(new URL('npc-review.html',base).href,{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForFunction(()=>!!window.__NPC__,null,{timeout:20000});
 errors.length=0; // The review page has no favicon; Chrome logs that initial 404.
 const loaded=await page.evaluate(async()=>{
  const {GLTFLoader}=await import('./vendor/loaders/GLTFLoader.js');
  const {createWarden,animateWarden}=await import('./npc-warden.js');
  const gltf=await new GLTFLoader().loadAsync('./assets/models/bloodworks-warden.glb');
  const review=window.__NPC__;
  review.npc.visible=false;
  review.variants=[]; // The page loop otherwise makes its legacy review actor visible again.
  const root=createWarden(gltf.scene,gltf.animations,2,'warden',.5);
  root.rotation.y=Math.PI;
  review.scene.add(root);
  review.camera.position.set(0,1.45,4.8);
  review.camera.lookAt(0,1.1,0);
  review.bloodworks={root,animateWarden};
  document.querySelector('#label').textContent='BLOODWORKS WARDEN / AUTHORED MOTION';
  let joints=0;root.traverse(object=>{if(object.isBone)joints++;});
  return {clips:gltf.animations.map(clip=>clip.name),joints,sourceHeight:root.userData.warden.sourceHeight};
 });
 assert.deepEqual(loaded.clips.slice().sort(),['TLD_Collapse','TLD_Hit','TLD_Idle','TLD_Strike','TLD_Walk','TLD_Windup']);
 assert.equal(loaded.joints,24);
 const poses=[
  ['idle',{attacking:false,windup:0,windupTime:.65,strike:0,flash:0,dead:false},0],
  ['windup',{attacking:true,windup:.10,windupTime:.65,strike:0,flash:0,dead:false},100],
  ['strike',{attacking:false,windup:0,windupTime:.65,strike:.22,flash:0,dead:false},200],
  ['hit',{attacking:false,windup:0,windupTime:.65,strike:0,flash:.16,dead:false},300],
  ['collapse',{attacking:false,windup:0,windupTime:.65,strike:0,flash:0,dead:true},1100],
 ];
 const records=[];
 for(const [name,enemy,time] of poses){
  const state=await page.evaluate(({enemy,time})=>{
   const review=window.__NPC__;
   review.bloodworks.animateWarden(review.bloodworks.root,enemy,time,.5);
   review.renderer.render(review.scene,review.camera);
   const w=review.bloodworks.root.userData.warden;
   return {visible:review.bloodworks.root.visible,weights:Object.fromEntries(Object.entries(w.actions).map(([key,action])=>[key,action.getEffectiveWeight()])),renderCalls:review.renderer.info.render.calls};
  },{enemy,time});
  assert.equal(state.visible,true,name+' visual should be present');
  assert.ok(state.renderCalls>0,name+' should draw');
  const png=path.join(output,'warden-runtime-'+name+'.png');
  await page.locator('canvas').screenshot({path:png});
  records.push({name,png,state});
 }
 assert.deepEqual(errors,[]);
 const report={ok:true,url:base,loaded,records,errors};
 await writeFile(path.join(output,'warden-browser-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({ok:true,loaded,poses:records.map(item=>({name:item.name,renderCalls:item.state.renderCalls})),errors},null,2));
}finally{await browser.close();}
