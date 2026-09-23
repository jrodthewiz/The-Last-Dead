import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'C:/Users/wolfk/Desktop/dogfight/node_modules/playwright');
const root=new URL('../../',import.meta.url);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:5200/**',async route=>{
  const path=new URL(route.request().url()).pathname.slice(1);
  if(path==='rig-validation')return route.fulfill({body:'<!doctype html><html><body style="margin:0"></body></html>',contentType:'text/html'});
  try{await route.fulfill({body:await readFile(new URL(path,root)),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.glb')?'model/gltf-binary':'application/octet-stream'});}catch{await route.fulfill({status:404,body:'Missing local file'});}
 });
 await page.goto('http://127.0.0.1:5200/rig-validation');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/vendor/three.module.js');const {GLTFLoader}=await import('/vendor/loaders/GLTFLoader.js');
  const gltf=await new GLTFLoader().loadAsync('/art/survivor-rig/exports/tld-survivor-rig.glb');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#252c34');scene.add(gltf.scene);
  scene.add(new THREE.HemisphereLight(0xc8deff,0x4f3b29,2.3));const sun=new THREE.DirectionalLight(0xffecd5,3);sun.position.set(-2,4,-3);scene.add(sun);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,800);document.body.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(42,1.25,.02,30);camera.position.set(1.6,1.65,-3.2);camera.lookAt(0,.9,0);
  const mixer=new THREE.AnimationMixer(gltf.scene),skins=[];let badWeights=0;
  gltf.scene.traverse(o=>{if(o.isSkinnedMesh){skins.push(o);const w=o.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)if(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)>1e-4)badWeights++;}});
  if(gltf.animations.length!==7)throw new Error('Expected exactly seven animation clips, got '+gltf.animations.length);
  const clips={};let nonFinite=0;const point=new THREE.Vector3();
  for(const clip of gltf.animations){
   mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
   const boxes=[];
   for(const t of [0,clip.duration*.25,clip.duration*.5,clip.duration*.75,clip.duration]){
    mixer.setTime(t);scene.updateMatrixWorld(true);const box=new THREE.Box3();
    for(const mesh of skins){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
     mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);if(![point.x,point.y,point.z].every(Number.isFinite))nonFinite++;box.expandByPoint(point);
    }}boxes.push({min:box.min.toArray(),max:box.max.toArray()});
   }clips[clip.name]={duration:clip.duration,tracks:clip.tracks.length,bounds:boxes};
  }
  mixer.stopAllAction();mixer.clipAction(gltf.animations.find(c=>c.name==='Idle_Ready')).play();mixer.setTime(0);scene.updateMatrixWorld(true);renderer.render(scene,camera);
  return {clips,skinnedPrimitives:skins.length,badWeights,nonFinite,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
 });
 assert.equal(result.badWeights,0);assert.equal(result.nonFinite,0);
 for(const n of ['Idle_Ready','Walk_Forward','Sprint_Forward','Crouch_Idle','Jump','Slide','Recoil'])assert.ok(result.clips[n],`Missing ${n}`);
 assert.equal(errors.length,0);result.browserErrors=errors;
 await page.screenshot({path:new URL('review/threejs-export.png',import.meta.url).pathname.replace(/^\/(?:([A-Z]:))\//i,'$1/')});
 await writeFile(new URL('threejs-validation.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify({clips:Object.keys(result.clips),skinnedPrimitives:result.skinnedPrimitives,badWeights:result.badWeights,nonFinite:result.nonFinite,drawCalls:result.drawCalls,triangles:result.triangles,browserErrors:errors}));
}finally{await browser.close();}
