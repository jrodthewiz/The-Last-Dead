import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const directory='docs/survivor/first-person/game';await mkdir(directory,{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5200/?debug=1');await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared,{},{timeout:120000});
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
 await page.evaluate(async()=>{const d=window.__DEAD_ARRIVAL__;d.run.mode='pause';d.renderer.render(d.run,performance.now());await d.renderer._warmupPromise;});
 const rows=[];
 for(const pose of ['standing','walking','slide','jump'])for(const weapon of [0,1,2,3]){
  await page.evaluate(({pose,weapon})=>{const d=window.__DEAD_ARRIVAL__;Object.assign(d.run,{mode:'pause',weapon,pitch:-1.3,slide:pose==='slide'?1:0,z:pose==='jump'?.5:0,vx:pose==='walking'?1.5:0,vy:0,distance:pose==='walking'?.22:0});for(let i=0;i<15;i++)d.renderer.render(d.run,performance.now());},{pose,weapon});
  const row=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.renderer,b=r._survivors.local,gl=r.renderer.getContext();return{scale:b.scale.toArray(),headHidden:!b.userData.head.visible,depthRange:Array.from(gl.getParameter(gl.DEPTH_RANGE)),calls:r.renderer.info.render.calls};});
  assert.deepEqual(row.scale,[1,1,1]);assert.ok(row.headHidden);assert.deepEqual(row.depthRange,[0,1]);rows.push({pose,weapon,...row});
  if(weapon===0||pose==='slide')await page.screenshot({path:`${directory}/${pose}-${weapon}.png`});
 }
 // A weapon depth boundary must not erase wall depth for subsequent transparent effects.
 const depth=await page.evaluate(async()=>{
  const T=await import('/vendor/three.module.js'),{installViewmodelDepthBoundary}=await import('/assets/survivor/viewmodel-depth.js');
  const r=window.__DEAD_ARRIVAL__.renderer.renderer,scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.1,20),target=new T.WebGLRenderTarget(32,32),previous=r.getRenderTarget();scene.background=new T.Color(0);
  const wall=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshBasicMaterial({color:0x00aa00}));wall.position.z=-3;scene.add(wall);
  const effect=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshBasicMaterial({color:0xff0000,transparent:true,opacity:.9,depthWrite:false}));effect.position.z=-4;scene.add(effect);
  const rig=new T.Group(),gun=new T.Mesh(new T.BoxGeometry(.2,.3,.2),new T.MeshBasicMaterial({color:0xffffff}));gun.position.set(.6,0,-2);rig.add(gun);scene.add(rig);installViewmodelDepthBoundary(rig);
  try{r.setRenderTarget(target);r.render(scene,camera);const pixel=new Uint8Array(4);r.readRenderTargetPixels(target,8,16,1,1,pixel);return Array.from(pixel);}finally{r.setRenderTarget(previous);target.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 });assert.ok(depth[1]>depth[0]*2,'wall must still occlude the red transparent effect after drawing a gun');
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;Object.assign(d.run,{mode:'play',slide:0,z:0,vx:0,vy:0,weapon:0});});
 const before=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.y);await page.keyboard.down('w');await page.waitForTimeout(250);await page.keyboard.up('w');
 const after=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.y);assert.ok(after<before,'actual keyboard movement');
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;d.run.mode='pause';d.run.pitch=-1.3;});await page.setViewportSize({width:390,height:844});await page.screenshot({path:directory+'/mobile-down.png'});
 assert.deepEqual(errors,[]);await writeFile(directory+'/results.json',JSON.stringify({rows,depth,keyboardMovement:true,errors},null,2));console.log(JSON.stringify({poses:rows.length,depth,keyboardMovement:true,errors}));
}finally{await browser.close();}
