import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/harbor-qa',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto('http://127.0.0.1:5200/harbor-qa');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/vendor/three.module.js'),{HarborWorld}=await import('/harbor-visuals.js'),{makeHarborCourse}=await import('/harbor-course.js');
  document.body.innerHTML='';document.body.style.margin='0';const scene=new THREE.Scene();scene.background=new THREE.Color(0x728f97);scene.fog=new THREE.Fog(0x728f97,80,280);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1280,800);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.append(renderer.domElement);
  const light=new THREE.DirectionalLight(0xffe1b0,2.2);light.position.set(20,50,0);scene.add(light);
  const world=new HarborWorld(scene,makeHarborCourse());await world.ready;
  const camera=new THREE.PerspectiveCamera(66,1.6,.1,600);camera.position.set(68,2,66);camera.lookAt(83,2,93);world.update(4);renderer.render(scene,camera);
  const rejected=[];world.root.traverse(o=>{if(['FarBankWarehouse','BoundaryWall','BuildingBoundary','Bollard','ChannelBuoy'].includes(o.name))rejected.push(o.name);});
  if(rejected.length)throw Error(`Placeholder objects remain: ${rejected.join(',')}`);
  if(!world.vehicle.getObjectByName('DriveableThaiHilux'))throw Error('Detailed driving vehicle missing');
  window.harborQA={scene,renderer,camera,world};return{...world.diagnostics,render:{...renderer.info.render}};
 });
 await fs.mkdir('output/playwright/harbor',{recursive:true});await page.screenshot({path:'output/playwright/harbor/street.png'});
 await page.evaluate(()=>{const{renderer,scene,camera,world}=window.harborQA;camera.position.set(103,2,114);camera.lookAt(75,0,146);world.update(9);renderer.render(scene,camera);});await page.screenshot({path:'output/playwright/harbor/water.png'});
 await page.evaluate(()=>{const{renderer,scene,camera}=window.harborQA;camera.position.set(74,3,64);camera.lookAt(64,1,56);renderer.render(scene,camera);});await page.screenshot({path:'output/playwright/harbor/truck.png'});
 for(const [name,position,target] of [['market',[44,2.1,40],[38,1.5,26]],['transit',[119,2.1,51],[121,1.7,29]],['yard',[24,2.1,100],[24,2,84]],['district',[151,110,162],[64,0,60]]]){
  await page.evaluate(({position,target})=>{const{renderer,scene,camera}=window.harborQA;camera.position.set(...position);camera.lookAt(...target);renderer.render(scene,camera);},{position,target});
  await page.screenshot({path:`output/playwright/harbor/${name}.png`});
 }
 for(const i of [0,4]){
  await page.evaluate(i=>{const{renderer,scene,camera,world}=window.harborQA;const room=world.course.harborRooms[i],yaw=i===4?-Math.PI/2:0;
   if(!world.root.getObjectByName(`HarborEntrance:${room.id}`))throw Error('Missing entrance');
   camera.position.set(room.door.x*4+Math.sin(yaw)*3,1.8,room.door.y*4+Math.cos(yaw)*3);camera.lookAt(room.door.x*4,1.6,room.door.y*4);renderer.render(scene,camera);
  },i);await page.screenshot({path:`output/playwright/harbor/entrance-${i}.png`});
 }
 for(let i=0;i<6;i++){
  await page.evaluate(i=>{const{renderer,scene,camera,world}=window.harborQA;const room=world.course.harborRooms[i];world.course.activeInterior=room;world.update(10,null,{course:world.course});camera.position.set(room.spawn.x*4,1.9,room.spawn.y*4);camera.lookAt(room.x-1,1.4,room.z-room.depth/2);renderer.render(scene,camera);},i);
  await page.screenshot({path:`output/playwright/harbor/interior-${i}.png`});
 }
 if(result.thai?.placements!==71||result.interiors?.rooms!==6)throw Error('Incomplete Thai district');
 console.log(JSON.stringify({result,errors},null,2));if(errors.length||result.errors.length||result.render.calls<1)process.exitCode=1;
}finally{await browser.close();}
