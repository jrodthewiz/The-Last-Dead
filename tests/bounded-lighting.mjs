import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE ERROR',String(e));});page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE ERROR',m.text());});page.on('requestfailed',r=>console.error('REQUEST FAILED',r.url(),r.failure()?.errorText));
 await page.goto('http://127.0.0.1:5200/tests/fixtures/lighting.html',{waitUntil:'domcontentloaded',timeout:120000});
 const result=await page.evaluate(async()=>{
  const T=await import('/vendor/three.module.js'),{installBoundedLightEvaluation}=await import('/bounded-lighting.js');
  const g=new T.WebGLRenderer({canvas:document.querySelector('canvas')}),scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1.6,.1,100);camera.position.set(0,1.3,6);camera.lookAt(0,0,0);g.setSize(512,320);g.shadowMap.enabled=true;
  const key=new T.DirectionalLight(0xffcc99,2);key.position.set(3,6,4);key.castShadow=true;scene.add(key,new T.HemisphereLight(0xffffff,0x333333,1));
  for(let i=0;i<5;i++){const light=new T.PointLight(i%2?0x2266ff:0xff3322,30,4);light.position.set((i-2)*6,2,0);scene.add(light);}
  const sphere=new T.Mesh(new T.SphereGeometry(1,32,24),new T.MeshPhysicalMaterial({color:0x748a93,roughness:.28,metalness:.5,clearcoat:.7,sheen:.5,sheenRoughness:.7}));sphere.castShadow=true;sphere.receiveShadow=true;scene.add(sphere);
  const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x9a8971,roughness:.75,metalness:.15}));floor.rotation.x=-Math.PI/2;floor.position.y=-1;floor.receiveShadow=true;scene.add(floor);
  const target=new T.WebGLRenderTarget(512,320),before=new Uint8Array(512*320*4),after=new Uint8Array(before.length);
  try{g.setRenderTarget(target);g.render(scene,camera);g.readRenderTargetPixels(target,0,0,512,320,before);installBoundedLightEvaluation();scene.traverse(o=>{if(o.material){o.material.customProgramCacheKey=()=> 'bounded-light-verification';o.material.needsUpdate=true;}});await g.compileAsync(scene,camera);g.render(scene,camera);g.readRenderTargetPixels(target,0,0,512,320,after);
   let maximum=0,sum=0,changed=0;for(let i=0;i<before.length;i++){const delta=Math.abs(before[i]-after[i]);maximum=Math.max(maximum,delta);sum+=delta;if(delta>2)changed++;}return{maximum,meanAbsoluteError:sum/before.length,channelsOverTwo:changed,channels:before.length};
  }finally{target.dispose();g.dispose();}
 });assert.deepEqual(errors,[]);assert.ok(result.maximum<=3&&result.channelsOverTwo<result.channels*.0001,'zero-radiance branch must preserve rendered pixels');await mkdir('.logs',{recursive:true});await writeFile('.logs/bounded-lighting.json',JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors}));
}finally{await browser.close();}
