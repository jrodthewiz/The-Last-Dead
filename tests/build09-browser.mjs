import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH);
await mkdir('docs/build09',{recursive:true});const server=await startServer({root:path.resolve('dist'),port:0,host:'127.0.0.1'});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=d3d11']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1`,{waitUntil:'domcontentloaded'});await page.bringToFront();await page.locator('[data-action="start"]').click();
 const result=await page.evaluate(async()=>{
  const {shoot}=await import('./engine.js'),THREE=await import('./vendor/three.module.js'),a=window.__DEAD_ARRIVAL__,r=a.run,v=a.renderer,checks=[];
  r.mode='pause';r.course.enemies=[];r.waveDelay=999;r.damage=0;r.punch=0;a.ui._clearToasts();
  let time=performance.now();
  for(const pitch of [-.8,0,.8])for(const weapon of [0,2]){
   Object.assign(r,{pitch,weapon,shot:0,tracers:[],mode:'play'});r.cooldowns[weapon]=0;shoot(r);r.mode='pause';v.render(r,time+=16);
   const t=r.tracers[0],endpoint=new THREE.Vector3(t.tx*4,t.tz*4,t.ty*4).project(v.camera);
   const socket=v.weaponGroups[weapon].userData.muzzle.getWorldPosition(new THREE.Vector3()),flash=v.muzzleFlash.getWorldPosition(new THREE.Vector3());
   checks.push({pitch,weapon,crosshairError:Math.hypot(endpoint.x,endpoint.y),flashError:socket.distanceTo(flash)});
  }
  r.pitch=0;r.shot=0;r.weapon=1;r.tracers=[];v.render(r,time+=16);
  return {checks,arms:v.weaponGroups.map(g=>{let n=0;g.traverse(o=>{if(o.name==='GripPalm')n++});return n;}),canvas:[v.canvas.clientWidth,v.canvas.clientHeight],calls:v.renderer.info.render.calls};
 });
 assert.ok(result.checks.every(c=>c.crosshairError<1e-5&&c.flashError<1e-6),JSON.stringify(result));assert.deepEqual(result.arms,[1,2,2,2]);
 for(const weapon of [0,1,2,3]){await page.evaluate(weapon=>{const a=window.__DEAD_ARRIVAL__;a.run.weapon=weapon;a.run.shot=0;},weapon);await page.waitForTimeout(350);await page.screenshot({path:`docs/build09/weapon-${weapon}.png`});}
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);await page.screenshot({path:'docs/build09/mobile.png'});
 assert.deepEqual(errors,[]);await writeFile('docs/build09/alignment-browser.json',JSON.stringify({...result,errors,passed:true},null,2));console.log(JSON.stringify({...result,errors,passed:true}));
}finally{await browser.close();server.server.closeAllConnections();await new Promise(r=>server.server.close(r));}
