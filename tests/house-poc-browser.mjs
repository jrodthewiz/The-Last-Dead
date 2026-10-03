import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/house-poc';await mkdir(output,{recursive:true});
const server=await startServer({root:process.cwd(),port:0,host:'127.0.0.1'});
let browser;const report={errors:[],variants:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const page=await browser.newPage({viewport:{width:960,height:720}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.port}/scavenger-pack.js`);
 await page.setContent('<body style="margin:0"></body>');
 await page.evaluate(async()=>{
  const THREE=await import('/vendor/three.module.js');
  const {GLTFLoader}=await import('/vendor/loaders/GLTFLoader.js');
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(960,720);document.body.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x222b30);
  scene.add(new THREE.HemisphereLight(0xe2f0ff,0x616051,2));
  const light=new THREE.DirectionalLight(0xffe4b6,2);light.position.set(4,7,5);scene.add(light);
  const camera=new THREE.PerspectiveCamera(50,960/720,.05,100);
  window.houseQA={THREE,GLTFLoader,renderer,scene,camera};
 });
 for(const variant of ['intact','storm-damaged']){
  const result=await page.evaluate(async variant=>{
   const {THREE,GLTFLoader,renderer,scene,camera}=window.houseQA;
   if(window.houseQA.model)scene.remove(window.houseQA.model);
   const base=`/output/house-poc/house-${variant}`;
   const model=(await new GLTFLoader().loadAsync(`${base}.glb`)).scene;
   const metadata=await (await fetch(`${base}.json`)).json();scene.add(model);model.updateMatrixWorld(true);window.houseQA.model=model;
   const mismatches=[];
   for(const proxy of metadata.colliders){
    const node=model.getObjectByName(proxy.id);
    if(!node){mismatches.push(proxy.id);continue;}
    const box=new THREE.Box3().setFromObject(node),center=box.getCenter(new THREE.Vector3()).toArray(),size=box.getSize(new THREE.Vector3()).toArray();
    if(center.some((v,i)=>Math.abs(v-proxy.position[i])>.001)||size.some((v,i)=>Math.abs(v-proxy.size[i])>.001))mismatches.push(proxy.id);
   }
   camera.position.set(10,7,12);camera.lookAt(0,1,0);renderer.render(scene,camera);
   return {variant,mismatches,checks:metadata.checks,triangles:renderer.info.render.triangles,draws:renderer.info.render.calls};
  },variant);
  assert.deepEqual(result.mismatches,[]);assert.equal(result.checks.duplicateFaces,0);
  await page.screenshot({path:`${output}/${variant}-exterior.png`});
  await page.evaluate(()=>{const {renderer,scene,camera}=window.houseQA;camera.position.set(0,1.65,2.8);camera.lookAt(0,1.65,6);renderer.render(scene,camera);});
  await page.screenshot({path:`${output}/${variant}-door.png`});report.variants.push(result);
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}finally{
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));
}
